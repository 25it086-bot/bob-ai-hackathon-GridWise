from __future__ import annotations
import math
from fastapi import APIRouter, Query
from ..schemas.alert import Alert, AlertAcknowledgeRequest
from ..schemas.common import PaginatedResponse, PaginationMeta
from ..middleware.error_handler import NotFoundError
from ..data.store import store

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=PaginatedResponse[Alert])
async def list_alerts(
    severity: str | None = None,
    acknowledged: bool | None = None,
    zone_id: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    items = list(store.alerts)
    if severity:
        sevs = set(severity.split(","))
        items = [a for a in items if a.get("severity") in sevs]
    if acknowledged is not None:
        items = [a for a in items if a.get("acknowledged") == acknowledged]
    if zone_id:
        items = [a for a in items if a.get("zone_id") == zone_id]
    items.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    return PaginatedResponse(
        data=[Alert(**a) for a in items[start:start + page_size]],
        meta=PaginationMeta(page=page, page_size=page_size, total=total,
                            total_pages=math.ceil(total / page_size) if total else 0),
    )


@router.get("/unread-count")
async def unread_count():
    return {"count": len(store.unacknowledged_alerts())}


@router.patch("/{alert_id}/acknowledge", response_model=Alert)
async def acknowledge_alert(alert_id: str, body: AlertAcknowledgeRequest):
    for alert in store.alerts:
        if alert["id"] == alert_id:
            alert["acknowledged"] = body.acknowledged
            from datetime import datetime, timezone
            alert["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
            return Alert(**alert)
    raise NotFoundError("Alert", alert_id)
