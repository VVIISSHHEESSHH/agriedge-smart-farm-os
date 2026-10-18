"""Add password credential storage without changing existing farmer rows."""
from alembic import op
import sqlalchemy as sa

revision = "73b28e0c19ad"
down_revision = "418405211d15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_credentials",
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("farmer_id"),
    )


def downgrade() -> None:
    op.drop_table("auth_credentials")
