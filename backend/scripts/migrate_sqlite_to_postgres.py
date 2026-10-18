"""One-time, append-only migration of the existing SQLite rows to PostgreSQL.

Run after `alembic upgrade head` on the empty Neon database. The source is opened
read-only. This importer refuses a target containing application rows and rolls
back all target inserts if any row or sequence update fails.
"""

from __future__ import annotations

import argparse
import asyncio
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import settings
import app.models  # noqa: F401 - register all tables on Base.metadata
from app.models.base import Base


EXPECTED_REVISION = "418405211d15"
TARGET_REVISION = "73b28e0c19ad"
BATCH_SIZE = 250


def _read_only_source_engine(path: Path):
    source_uri = path.resolve().as_uri() + "?mode=ro"

    def connect_source():
        return sqlite3.connect(
            source_uri,
            uri=True,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )

    return create_engine("sqlite://", creator=connect_source, poolclass=StaticPool)


async def migrate(source_path: Path) -> int:
    if not settings.database_url.startswith("postgresql+asyncpg://"):
        raise RuntimeError("DATABASE_URL must be configured for PostgreSQL with asyncpg")
    if not source_path.is_file():
        raise RuntimeError("SQLite source database file does not exist")

    source_engine = _read_only_source_engine(source_path)
    target_engine = create_async_engine(settings.database_url, echo=False)
    copied_total = 0
    try:
        with source_engine.connect() as source:
            with source.begin():
                source_revision = source.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
                if source_revision != EXPECTED_REVISION:
                    raise RuntimeError("SQLite source is not at the expected Alembic revision")

                source_inspector = inspect(source)
                source_tables = set(source_inspector.get_table_names())
                current_tables = {table.name for table in Base.metadata.sorted_tables} | {"alembic_version"}
                source_expected = current_tables - {"auth_credentials"}
                if source_tables not in (source_expected, current_tables):
                    raise RuntimeError("SQLite source schema does not match the application migration")

                async with target_engine.begin() as target:
                    target_tables = await target.run_sync(lambda conn: set(inspect(conn).get_table_names()))
                    if target_tables != current_tables:
                        raise RuntimeError("Target schema is missing tables; run Alembic upgrade first")

                    target_revision = await target.execute(text("SELECT version_num FROM alembic_version"))
                    if target_revision.scalar_one_or_none() != TARGET_REVISION:
                        raise RuntimeError("Target database is not at the current Alembic revision")

                    for table in Base.metadata.sorted_tables:
                        if table.name == "alembic_version" or table.name not in source_tables:
                            continue
                        count = await target.scalar(text(f'SELECT COUNT(*) FROM "{table.name}"'))
                        if count:
                            raise RuntimeError("Target contains application data; refusing to append duplicate rows")

                    for table in Base.metadata.sorted_tables:
                        if table.name == "alembic_version" or table.name not in source_tables:
                            continue
                        result = source.execute(table.select().execution_options(stream_results=True))
                        while batch := [dict(row._mapping) for row in result.fetchmany(BATCH_SIZE)]:
                            await target.execute(table.insert(), batch)
                            copied_total += len(batch)

                    for table in Base.metadata.sorted_tables:
                        if table.name == "alembic_version" or table.name not in source_tables:
                            continue
                        primary_key = list(table.primary_key.columns)
                        if len(primary_key) != 1 or primary_key[0].name != "id":
                            continue
                        max_id = await target.scalar(text(f'SELECT MAX("id") FROM "{table.name}"'))
                        if max_id is None:
                            continue
                        sequence = await target.scalar(
                            text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
                            {"table_name": table.name},
                        )
                        if sequence:
                            await target.execute(
                                text("SELECT setval(CAST(:sequence AS regclass), :max_id, true)"),
                                {"sequence": sequence, "max_id": max_id},
                            )

                    for table in Base.metadata.sorted_tables:
                        if table.name == "alembic_version":
                            continue
                        source_count = source.execute(text(f'SELECT COUNT(*) FROM "{table.name}"')).scalar_one()
                        target_count = await target.scalar(text(f'SELECT COUNT(*) FROM "{table.name}"'))
                        if source_count != target_count:
                            raise RuntimeError("Post-migration row counts differ; target transaction rolled back")
    finally:
        source_engine.dispose()
        await target_engine.dispose()
    return copied_total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "agriedge.db",
        help="SQLite database file (opened read-only)",
    )
    args = parser.parse_args()
    copied = asyncio.run(migrate(args.source))
    print(f"Imported {copied} rows. SQLite source was left unchanged.")


if __name__ == "__main__":
    main()
