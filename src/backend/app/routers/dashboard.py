from __future__ import annotations
import math
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from ..schemas.dashboard import DashboardSummary
from ..schemas.risk import RiskTrendPoint
from ..schemas.zone import ZoneSummary
from ..schemas.alert import Alert
from ..schemas.recommendation import Recommendation
from ..data.store import store

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _risk_level(score: float, s) -> str:
    if score >= s.RISK_CRITICAL_THRESHOLD:
        return "critical"
    if score >= s.RISK_HIGH_THRESHOLD:
        return "high"
    if score >= s.RISK_MEDIUM_THRESHOLD:
        return "medium"
    return "low"


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    from ..config import settings

    scores = list(store.risk_scores.values())
    critical = sum(1 for s in scores if s.get("level") == "critical")
    high = sum(1 for s in scores if s.get("level") == "high")
    medium = sum(1 for s in scores if s.get("level") == "medium")
    low = sum(1 for s in scores if s.get("level") == "low")
    total = len(store.equipment)

    # Grid health: 100 - weighted average risk score
    avg_score = (sum(s.get("score", 0) for s in scores) / len(scores)) if scores else 0
    grid_health = round(max(0, 100 - avg_score), 1)

    # Zone summaries
    zone_summaries = []
    for zone in store.zones:
        equip_in_zone = store.equipment_in_zone(zone["id"])
        zone_scores = [store.risk_scores.get(e["id"], {}) for e in equip_in_zone]
        zone_scores = [s for s in zone_scores if s]
        zavg = (sum(s.get("score", 0) for s in zone_scores) / len(zone_scores)) if zone_scores else 0
        z_crit = sum(1 for s in zone_scores if s.get("level") == "critical")
        z_high = sum(1 for s in zone_scores if s.get("level") == "high")
        z_med = sum(1 for s in zone_scores if s.get("level") == "medium")
        z_low = sum(1 for s in zone_scores if s.get("level") == "low")
        z_level = _risk_level(zavg, settings)
        # Zone outage prob
        z_probs = [s.get("outage_probability", 0) for s in zone_scores]
        zone_outage = 1.0 - math.prod(1 - p for p in z_probs) if z_probs else 0.0

        zone_summaries.append(ZoneSummary(
            id=zone["id"],
            name=zone["name"],
            region=zone["region"],
            total_equipment=len(equip_in_zone),
            total_customers=zone.get("total_customers", 0),
            critical_count=z_crit,
            high_count=z_high,
            medium_count=z_med,
            low_count=z_low,
            zone_risk_score=round(zavg, 1),
            zone_risk_level=z_level,
            outage_probability=round(zone_outage, 4),
        ))

    outage_risk_zones = sum(
        1 for z in zone_summaries
        if (z.outage_probability or 0) >= settings.OUTAGE_HIGH_PROBABILITY_THRESHOLD
    )

    estimated_customers_at_risk = sum(
        s.get("estimated_customers_affected", 0) for s in scores
    )

    # 7-day risk trend (simulated from current scores with small variance)
    trend: list[RiskTrendPoint] = []
    base_date = datetime.now(timezone.utc)
    import random as rng
    rng.seed(99)
    for day in range(6, -1, -1):
        d = base_date - timedelta(days=day)
        noise = lambda base: max(0, base + rng.randint(-2, 2))
        trend.append(RiskTrendPoint(
            date=d.strftime("%Y-%m-%d"),
            critical_count=noise(critical),
            high_count=noise(high),
            medium_count=noise(medium),
            low_count=noise(low),
        ))

    recent_alerts = sorted(
        store.alerts, key=lambda a: a["created_at"], reverse=True
    )[:5]

    top_recs = []
    for recs in store.recommendations.values():
        top_recs.extend(recs)
    top_recs = sorted(
        [r for r in top_recs if not r.get("dismissed")],
        key=lambda r: {"urgent": 0, "scheduled": 1, "monitor": 2}.get(r.get("priority"), 3)
    )[:4]

    last_scored = None
    if scores:
        last_scored = max(
            (s.get("scored_at", "") for s in scores), default=None
        )

    return DashboardSummary(
        grid_health_score=grid_health,
        critical_count=critical,
        high_count=high,
        medium_count=medium,
        low_count=low,
        total_equipment=total,
        outage_risk_zones=outage_risk_zones,
        estimated_customers_at_risk=estimated_customers_at_risk,
        risk_trend_7d=trend,
        zone_summaries=zone_summaries,
        recent_alerts=[Alert(**a) for a in recent_alerts],
        top_recommendations=[Recommendation(**r) for r in top_recs],
        last_scored_at=last_scored,
    )
