from __future__ import annotations
from pydantic import BaseModel
from .risk import RiskTrendPoint
from .alert import Alert
from .recommendation import Recommendation
from .zone import ZoneSummary


class DashboardSummary(BaseModel):
    grid_health_score: float
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    total_equipment: int
    outage_risk_zones: int
    estimated_customers_at_risk: int
    risk_trend_7d: list[RiskTrendPoint]
    zone_summaries: list[ZoneSummary]
    recent_alerts: list[Alert]
    top_recommendations: list[Recommendation]
    last_scored_at: str | None = None
