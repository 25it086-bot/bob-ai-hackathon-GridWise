from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel
from typing import Literal

RecommendationPriority = Literal["urgent", "scheduled", "monitor"]


class Recommendation(BaseModel):
    id: str
    equipment_id: str
    equipment_name: str | None = None
    zone_id: str | None = None
    priority: RecommendationPriority
    action: str
    rationale: str
    generated_at: datetime
    dismissed: bool = False


class RecommendationDismissRequest(BaseModel):
    dismissed: bool = True
