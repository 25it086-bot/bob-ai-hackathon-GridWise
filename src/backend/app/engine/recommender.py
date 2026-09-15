"""Rule-based preventive action recommender."""
from __future__ import annotations
from datetime import datetime, timezone
from ..schemas.recommendation import Recommendation
from ..schemas.risk import RiskScore


_counter = 0


def _new_id() -> str:
    global _counter
    _counter += 1
    return f"REC-{_counter:04d}"


def generate_recommendations(
    equipment: dict,
    risk: RiskScore,
    days_since_maintenance: int,
    reading: dict,
) -> list[Recommendation]:
    recs: list[Recommendation] = []
    name = equipment.get("name", equipment["id"])
    zone_id = equipment.get("zone_id")
    now = datetime.now(timezone.utc)

    # URGENT rules
    if risk.score >= 80 and reading.get("load_pct", 0) > 85:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="urgent",
            action="Schedule emergency inspection within 24 hours",
            rationale=(
                f"Load at {reading['load_pct']:.0f}% with risk score {risk.score:.0f}/100. "
                f"Combined thermal and load stress exceeds safe operational thresholds."
            ),
            generated_at=now,
        ))

    if days_since_maintenance > 365:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="urgent",
            action="Perform overdue maintenance immediately",
            rationale=(
                f"No maintenance recorded in {days_since_maintenance} days, "
                f"exceeding the maximum safe interval of 365 days."
            ),
            generated_at=now,
        ))

    if reading.get("temperature_c", 0) > 90:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="urgent",
            action="Investigate thermal condition immediately",
            rationale=(
                f"Operating temperature {reading['temperature_c']:.1f}°C is "
                f"{reading['temperature_c'] - 75:.1f}°C above safe threshold (75°C)."
            ),
            generated_at=now,
        ))

    # SCHEDULED rules
    if risk.score >= 60 and days_since_maintenance > 180:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="scheduled",
            action="Schedule routine maintenance within 7 days",
            rationale=(
                f"Risk score {risk.score:.0f}/100 with {days_since_maintenance} days "
                f"since last maintenance. Preventive action can reduce risk significantly."
            ),
            generated_at=now,
        ))

    if equipment.get("age_years", 0) > 25:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="scheduled",
            action="Conduct end-of-life assessment",
            rationale=(
                f"Equipment is {equipment['age_years']} years old. "
                f"Units over 25 years require formal lifecycle evaluation."
            ),
            generated_at=now,
        ))

    # MONITOR rules
    if risk.score >= 40:
        recs.append(Recommendation(
            id=_new_id(),
            equipment_id=equipment["id"],
            equipment_name=name,
            zone_id=zone_id,
            priority="monitor",
            action="Increase monitoring frequency to every 4 hours",
            rationale=(
                f"Risk score {risk.score:.0f}/100 warrants elevated monitoring. "
                f"Alert thresholds should be reviewed."
            ),
            generated_at=now,
        ))

    # Deduplicate by action text
    seen: set[str] = set()
    unique: list[Recommendation] = []
    for r in recs:
        if r.action not in seen:
            seen.add(r.action)
            unique.append(r)

    return unique
