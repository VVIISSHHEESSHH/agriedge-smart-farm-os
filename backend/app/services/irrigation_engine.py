"""
Transparent, rule-based irrigation recommendation engine.

Evaluates:
1. Current soil moisture vs configured sector threshold
2. Telemetry freshness (stale sensors should not trigger automatic irrigation blindly)
3. Simulated rain / weather forecast probabilities
4. Water requirement calculations per crop type

Outputs structured decisions with plain-language rationales and decision codes.
DOES NOT interact with physical pumps, relays or GPIO.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Any, Optional

CROP_WATER_NEEDS = {
    "Tomato": {"standard_minutes": 25, "critical_min": 30.0, "target": 55.0},
    "Rice": {"standard_minutes": 45, "critical_min": 60.0, "target": 80.0},
    "Cotton": {"standard_minutes": 20, "critical_min": 28.0, "target": 50.0},
    "Wheat": {"standard_minutes": 25, "critical_min": 32.0, "target": 52.0},
    "Cassava": {"standard_minutes": 15, "critical_min": 25.0, "target": 45.0},
}


def evaluate_irrigation(
    sector_id: int,
    crop: str,
    moisture_pct: float,
    reading_time: datetime,
    target_moisture_min: float = 35.0,
    forecast_rain_chance: float = 0.10,
    is_manual_override: bool = False,
    override_action: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluate irrigation rules and return a transparent decision.
    """
    now = datetime.now(timezone.utc)
    # Check sensor freshness (if reading is > 6 hours old, warn stale)
    reading_age_hours = (now - (reading_time if reading_time.tzinfo else reading_time.replace(tzinfo=timezone.utc))).total_seconds() / 3600.0
    
    spec = CROP_WATER_NEEDS.get(crop, {"standard_minutes": 20, "critical_min": target_moisture_min, "target": target_moisture_min + 20.0})

    # Rule 0: Manual Override
    if is_manual_override and override_action:
        return {
            "decision": override_action,
            "reason_plain": f"Manual override triggered by farmer: {override_action.upper()}.",
            "rule_code": "R0_MANUAL_OVERRIDE",
            "duration_minutes": spec["standard_minutes"] if override_action == "irrigate" else 0,
            "moisture_at_decision": moisture_pct,
            "is_simulated": True,
            "sensor_stale": reading_age_hours > 6.0,
        }

    # Rule 1: Stale telemetry safety check
    if reading_age_hours > 6.0:
        return {
            "decision": "skip",
            "reason_plain": f"Sensor reading is {round(reading_age_hours, 1)} hours old. Please check soil sensor telemetry before irrigating.",
            "rule_code": "R1_STALE_SENSOR_CHECK",
            "duration_minutes": 0,
            "moisture_at_decision": moisture_pct,
            "is_simulated": True,
            "sensor_stale": True,
        }

    # Rule 2: High rain forecasted (> 60% probability)
    if forecast_rain_chance >= 0.60:
        return {
            "decision": "delay",
            "reason_plain": f"High probability of rainfall ({int(forecast_rain_chance * 100)}%). Delaying irrigation to conserve water.",
            "rule_code": "R2_RAIN_FORECAST_DELAY",
            "duration_minutes": 0,
            "moisture_at_decision": moisture_pct,
            "is_simulated": True,
            "sensor_stale": False,
        }

    # Rule 3: Critical soil drought (moisture < critical_min)
    effective_min = max(spec["critical_min"], target_moisture_min)
    if moisture_pct < (effective_min - 10.0):
        # Severe water deficit
        duration = int(spec["standard_minutes"] * 1.4)
        return {
            "decision": "irrigate",
            "reason_plain": f"Soil moisture critically low ({moisture_pct}%). Immediate irrigation recommended for {duration} mins.",
            "rule_code": "R3_CRITICAL_DROUGHT",
            "duration_minutes": duration,
            "moisture_at_decision": moisture_pct,
            "is_simulated": True,
            "sensor_stale": False,
        }

    # Rule 4: Standard soil moisture threshold deficit
    if moisture_pct < effective_min:
        duration = spec["standard_minutes"]
        return {
            "decision": "irrigate",
            "reason_plain": f"Soil moisture ({moisture_pct}%) is below minimum target of {effective_min}%. Scheduled watering for {duration} mins.",
            "rule_code": "R4_THRESHOLD_DEFICIT",
            "duration_minutes": duration,
            "moisture_at_decision": moisture_pct,
            "is_simulated": True,
            "sensor_stale": False,
        }

    # Rule 5: Sufficient moisture
    return {
        "decision": "skip",
        "reason_plain": f"Soil moisture is optimal ({moisture_pct}% >= {effective_min}%). No irrigation required.",
        "rule_code": "R5_OPTIMAL_MOISTURE",
        "duration_minutes": 0,
        "moisture_at_decision": moisture_pct,
        "is_simulated": True,
        "sensor_stale": False,
    }
