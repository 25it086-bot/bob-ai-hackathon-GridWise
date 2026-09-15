from __future__ import annotations
import math
from fastapi import APIRouter
from ..schemas.zone import ZoneSummary, ZoneDetail
from ..middleware.error_handler import NotFoundError
from ..data.store import store
from ..config import settings

router = APIRouter(prefix="/zones", tags=["zones"])


def _zone_summary(zone: dict) -> ZoneSummary:
    equip = store.equipment_in_zone(zone["id"])
    zone_scores = [store.risk_scores.get(e["id"], {}) for e in equip]
    zone_scores = [s for s in zone_scores if s]
    zavg = (sum(s.get("score", 0) for s in zone_scores) / len(zone_scores)) if zone_scores else 0

    def level(score):
        if score >= settings.RISK_CRITICAL_THRESHOLD: return "critical"
        if score >= settings.RISK_HIGH_THRESHOLD: return "high"
        if score >= settings.RISK_MEDIUM_THRESHOLD: return "medium"
        return "low"

    z_probs = [s.get("outage_probability", 0) for s in zone_scores]
    zone_outage = 1.0 - math.prod(1 - p for p in z_probs) if z_probs else 0.0

    return ZoneSummary(
        id=zone["id"],
        name=zone["name"],
        region=zone["region"],
        total_equipment=len(equip),
        total_customers=zone.get("total_customers", 0),
        critical_count=sum(1 for s in zone_scores if s.get("level") == "critical"),
        high_count=sum(1 for s in zone_scores if s.get("level") == "high"),
        medium_count=sum(1 for s in zone_scores if s.get("level") == "medium"),
        low_count=sum(1 for s in zone_scores if s.get("level") == "low"),
        zone_risk_score=round(zavg, 1),
        zone_risk_level=level(zavg),
        outage_probability=round(zone_outage, 4),
    )


@router.get("", response_model=list[ZoneSummary])
async def list_zones():
    return [_zone_summary(z) for z in store.zones]


@router.get("/{zone_id}", response_model=ZoneDetail)
async def get_zone(zone_id: str):
    zone = store.zone_by_id(zone_id)
    if not zone:
        raise NotFoundError("Zone", zone_id)
    summary = _zone_summary(zone)
    equip_ids = [e["id"] for e in store.equipment_in_zone(zone_id)]
    return ZoneDetail(**summary.model_dump(), equipment_ids=equip_ids)
