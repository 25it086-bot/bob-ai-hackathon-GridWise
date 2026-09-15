from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel
from typing import Literal

AlertSeverity = Literal["critical", "high", "medium", "low", "info"]
AlertType = Literal[
    "RISK_ELEVATED", "THRESHOLD_BREACH", "MAINTENANCE_DUE",
    "EQUIPMENT_OFFLINE", "PREDICTION_ALERT"
]


class Alert(BaseModel):
    id: str
    equipment_id: str
    zone_id: str | None = None
    equipment_name: str | None = None
    created_at: datetime
    severity: AlertSeverity
    alert_type: AlertType
    message: str
    acknowledged: bool = False
    acknowledged_at: datetime | None = None


class AlertAcknowledgeRequest(BaseModel):
    acknowledged: bool = True
