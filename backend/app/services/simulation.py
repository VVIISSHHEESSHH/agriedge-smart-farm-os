"""
Deterministic soil and environmental sensor simulation service.

Generates realistic, physically-grounded readings:
- Soil moisture (%) with diurnal evaporation curve
- Temperature (°C) with day/night oscillation
- Soil pH around crop-specific optimal bands
- N-P-K nutrient levels (ppm)

EVERY reading generated has `is_simulated = True` and an identifiable `sim_seed`.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Idealized crop profiles for realistic variation
CROP_PROFILES: Dict[str, Dict[str, float]] = {
    "Tomato": {"moisture_mean": 48.0, "temp_mean": 26.0, "ph_mean": 6.5, "n": 45.0, "p": 25.0, "k": 35.0},
    "Rice": {"moisture_mean": 75.0, "temp_mean": 29.0, "ph_mean": 6.0, "n": 60.0, "p": 30.0, "k": 40.0},
    "Cotton": {"moisture_mean": 42.0, "temp_mean": 30.0, "ph_mean": 6.8, "n": 50.0, "p": 20.0, "k": 30.0},
    "Wheat": {"moisture_mean": 45.0, "temp_mean": 22.0, "ph_mean": 6.7, "n": 55.0, "p": 25.0, "k": 35.0},
    "Cassava": {"moisture_mean": 40.0, "temp_mean": 28.0, "ph_mean": 5.8, "n": 35.0, "p": 18.0, "k": 45.0},
}


def simulate_reading_for_sector(
    sector_id: int,
    crop: str,
    timestamp: Optional[datetime] = None,
    seed_offset: int = 0,
) -> Dict[str, Any]:
    """
    Generate a deterministic, realistic sensor reading for a sector.
    
    Uses time-of-day mathematics + pseudo-random jitter seeded by (sector_id + day_of_year).
    """
    dt = timestamp or datetime.now(timezone.utc)
    hour = dt.hour + (dt.minute / 60.0)
    day_of_year = dt.timetuple().tm_yday

    # Deterministic RNG per sector & timestamp window
    sim_seed_str = f"sec-{sector_id}-d{day_of_year}-h{int(hour)}-{seed_offset}"
    rng = random.Random(sim_seed_str)

    profile = CROP_PROFILES.get(crop, {"moisture_mean": 45.0, "temp_mean": 25.0, "ph_mean": 6.5, "n": 40.0, "p": 20.0, "k": 30.0})

    # Diurnal temperature cycle: peaks around 14:00 (hour 14), lowest at 04:00 (hour 4)
    temp_variation = 6.0 * math.sin((hour - 8.0) * math.pi / 12.0)
    temp_c = round(profile["temp_mean"] + temp_variation + rng.uniform(-0.8, 0.8), 1)

    # Moisture inverse to daily heat: higher in early morning, dries in midday
    moisture_variation = -5.0 * math.sin((hour - 8.0) * math.pi / 12.0)
    moisture_pct = round(max(10.0, min(95.0, profile["moisture_mean"] + moisture_variation + rng.uniform(-1.5, 1.5))), 1)

    # pH: stable with minor soil micro-fluctuations
    ph = round(max(4.0, min(9.0, profile["ph_mean"] + rng.uniform(-0.2, 0.2))), 2)

    # N-P-K with slow drift
    nitrogen = round(max(5.0, profile["n"] + rng.uniform(-3.0, 3.0)), 1)
    phosphorus = round(max(5.0, profile["p"] + rng.uniform(-2.0, 2.0)), 1)
    potassium = round(max(5.0, profile["k"] + rng.uniform(-2.5, 2.5)), 1)

    return {
        "sector_id": sector_id,
        "moisture_pct": moisture_pct,
        "temp_c": temp_c,
        "ph": ph,
        "nitrogen_ppm": nitrogen,
        "phosphorus_ppm": phosphorus,
        "potassium_ppm": potassium,
        "is_simulated": True,
        "sim_seed": sim_seed_str,
        "recorded_at": dt,
    }
