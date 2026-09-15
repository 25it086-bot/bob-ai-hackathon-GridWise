from __future__ import annotations
from pydantic import BaseModel


class ZoneSummary(BaseModel):
    id: str
    name: str
    region: str
    total_equipment: int
    total_customers: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    zone_risk_score: float
    zone_risk_level: str
    outage_probability: float | None = None


class ZoneDetail(ZoneSummary):
    equipment_ids: list[str] = []
