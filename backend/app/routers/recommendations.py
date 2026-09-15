from __future__ import annotations
import math
from fastapi import APIRouter, Query
from ..schemas.recommendation import Recommendation, RecommendationDismissRequest
from ..schemas.common import PaginatedResponse, PaginationMeta
from ..middleware.error_handler import NotFoundError
from ..data.store import store

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=PaginatedResponse[Recommendation])
async def list_recommendations(
    priority: str | None = None,
    dismissed: bool | None = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    all_recs = []
    for recs in store.recommendations.values():
        all_recs.extend(recs)
    if priority:
        pris = set(priority.split(","))
        all_recs = [r for r in all_recs if r.get("priority") in pris]
    if dismissed is not None:
        all_recs = [r for r in all_recs if r.get("dismissed") == dismissed]
    all_recs.sort(key=lambda r: {"urgent": 0, "scheduled": 1, "monitor": 2}.get(r.get("priority"), 3))
    total = len(all_recs)
    start = (page - 1) * page_size
    return PaginatedResponse(
        data=[Recommendation(**r) for r in all_recs[start:start + page_size]],
        meta=PaginationMeta(page=page, page_size=page_size, total=total,
                            total_pages=math.ceil(total / page_size) if total else 0),
    )


@router.patch("/{rec_id}/dismiss", response_model=Recommendation)
async def dismiss_recommendation(rec_id: str, body: RecommendationDismissRequest):
    for recs in store.recommendations.values():
        for r in recs:
            if r["id"] == rec_id:
                r["dismissed"] = body.dismissed
                return Recommendation(**r)
    raise NotFoundError("Recommendation", rec_id)
