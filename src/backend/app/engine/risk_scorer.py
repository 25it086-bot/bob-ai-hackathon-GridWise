"""
GridWise Risk Scoring Engine.
Weighted multi-factor model — every score is fully explainable.
"""
from __future__ import annotations
import math
from datetime import datetime, timezone
from ..schemas.risk import RiskScore, RiskFactor, RiskLevel
from ..config import settings

FACTOR_WEIGHTS: dict[str, float] = {
    "load":        0.25,
    "temperature": 0.20,
    "age":         0.18,
    "maintenance": 0.15,
    "failure":     0.12,
    "voltage":     0.06,
    "vibration":   0.04,
}
assert abs(sum(FACTOR_WEIGHTS.values()) - 1.0) < 1e-9, "Factor weights must sum to 1.0"

FACTOR_LABELS: dict[str, str] = {
    "load":        "Load Stress",
    "temperature": "Thermal Stress",
    "age":         "Equipment Age",
    "maintenance": "Maintenance Gap",
    "failure":     "Failure History",
    "voltage":     "Voltage Deviation",
    "vibration":   "Vibration Level",
}

WEATHER_MODIFIERS: dict[str, dict[str, float]] = {
    "extreme_heat": {"temperature": 0.15},
    "storm":        {"vibration": 0.10},
    "high_wind":    {"vibration": 0.07},
}


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _normalize_load(load_pct: float) -> float:
    return load_pct / 100.0


def _normalize_temperature(temp_c: float) -> float:
    return _sigmoid((temp_c - 50) / 20)


def _normalize_age(age_years: int) -> float:
    return min(age_years / 30.0, 1.0)


def _normalize_maintenance_gap(days: int) -> float:
    return min(days / 365.0, 1.0)


def _normalize_failure_history(failure_count: int) -> float:
    return min(failure_count * 0.2, 1.0)


def _normalize_voltage_deviation(dev_pct: float) -> float:
    return min(abs(dev_pct) / 20.0, 1.0)


def _normalize_vibration(vib_mms: float) -> float:
    return min(vib_mms / 10.0, 1.0)


def _outage_probability(risk_score: float) -> float:
    """Logistic transform of risk score to outage probability."""
    return _sigmoid((risk_score - 65) / 12)


def _level_from_score(score: float) -> RiskLevel:
    if score >= settings.RISK_CRITICAL_THRESHOLD:
        return "critical"
    if score >= settings.RISK_HIGH_THRESHOLD:
        return "high"
    if score >= settings.RISK_MEDIUM_THRESHOLD:
        return "medium"
    return "low"


def compute_risk_score(
    equipment: dict,
    reading: dict,
    days_since_maintenance: int,
    failure_count_2yr: int,
) -> RiskScore:
    weather = reading.get("weather_condition", "normal")
    modifiers = WEATHER_MODIFIERS.get(weather, {})

    raw: dict[str, float] = {
        "load":        _normalize_load(reading.get("load_pct", 50.0)),
        "temperature": min(_normalize_temperature(reading.get("temperature_c", 40.0)) + modifiers.get("temperature", 0), 1.0),
        "age":         _normalize_age(equipment.get("age_years", 5)),
        "maintenance": _normalize_maintenance_gap(days_since_maintenance),
        "failure":     _normalize_failure_history(failure_count_2yr),
        "voltage":     _normalize_voltage_deviation(reading.get("voltage_deviation_pct", 0.0)),
        "vibration":   min(_normalize_vibration(reading.get("vibration_mms", 0.0)) + modifiers.get("vibration", 0), 1.0),
    }

    weighted_sum = sum(raw[k] * FACTOR_WEIGHTS[k] for k in raw)
    score = round(weighted_sum * 100, 1)
    level = _level_from_score(score)

    total_contribution = sum(raw[k] * FACTOR_WEIGHTS[k] for k in raw)
    factors = []
    for key, nval in raw.items():
        contribution = nval * FACTOR_WEIGHTS[key]
        factors.append(RiskFactor(
            name=key,
            label=FACTOR_LABELS[key],
            normalized_value=round(nval, 4),
            weighted_contribution=round(contribution / total_contribution * 100, 1) if total_contribution > 0 else 0,
            weight=FACTOR_WEIGHTS[key],
        ))

    # Mark primary driver
    if factors:
        primary = max(factors, key=lambda f: f.weighted_contribution)
        primary.is_primary_driver = True

    factors.sort(key=lambda f: f.weighted_contribution, reverse=True)

    outage_prob = round(_outage_probability(score), 4)

    return RiskScore(
        equipment_id=equipment["id"],
        score=score,
        level=level,
        factors=factors,
        outage_probability=outage_prob,
        estimated_customers_affected=round(equipment["customers_affected"] * outage_prob),
        scored_at=datetime.now(timezone.utc),
    )
