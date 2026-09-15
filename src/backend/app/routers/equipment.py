from __future__ import annotations
import math
from fastapi import APIRouter, Query
from ..schemas.equipment import EquipmentSummary, EquipmentDetail, EquipmentReading, MaintenanceRecord, FailureEvent
from ..schemas.risk import RiskScore
from ..schemas.recommendation import Recommendation
from ..schemas.common import PaginatedResponse, PaginationMeta
from ..middleware.error_handler import NotFoundError
from ..data.store import store
from ..data.service import data_service

router = APIRouter(prefix="/equipment", tags=["equipment"])


def _summary_from_flat(flat) -> EquipmentSummary:
    return EquipmentSummary(
        id=flat.equipment_id,
        name=store.equipment_by_id(flat.equipment_id).get("name", flat.equipment_id),
        type=flat.equipment_type,
        zone_id=flat.zone,
        zone_name=flat.zone_name,
        substation_name=flat.substation_name,
        age_years=flat.age_years,
        status=flat.equipment_status,
        customers_affected=flat.customer_count,
        risk_score=flat.risk_score,
        risk_level=flat.risk_level,
        load_pct=flat.load_percentage,
        temperature_c=flat.temperature,
        vibration_mms=flat.vibration,
        days_since_maintenance=flat.maintenance_days_ago,
        previous_failures_2yr=flat.previous_failures,
    )


@router.get("", response_model=PaginatedResponse[EquipmentSummary])
async def list_equipment(
    zone_id:    str | None = Query(None),
    risk_level: str | None = Query(None),
    type:       str | None = Query(None),
    status:     str | None = Query(None),
    search:     str | None = Query(None),
    page:       int = Query(1, ge=1),
    page_size:  int = Query(25, ge=1, le=100),
    sort_by:    str = Query("risk_score"),
    sort_dir:   str = Query("desc"),
):
    page_result = data_service.get_flat_records(
        zone_id=zone_id,
        risk_level=risk_level,
        equip_type=type,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        data=[_summary_from_flat(r) for r in page_result.items],
        meta=PaginationMeta(
            page=page_result.page,
            page_size=page_result.page_size,
            total=page_result.total,
            total_pages=page_result.total_pages,
        ),
    )


@router.get("/ranking")
async def get_ranking(limit: int = Query(10, ge=1, le=50), zone_id: str | None = None):
    flat_list = data_service.get_ranking(limit=limit, zone_id=zone_id)
    return {"data": [_summary_from_flat(r) for r in flat_list]}


@router.get("/{equipment_id}", response_model=EquipmentDetail)
async def get_equipment_detail(equipment_id: str):
    eq = store.equipment_by_id(equipment_id)
    if not eq:
        raise NotFoundError("Equipment", equipment_id)

    reading_raw = store.latest_reading(equipment_id)
    reading     = EquipmentReading(**reading_raw) if reading_raw else None
    maintenance = [MaintenanceRecord(**m) for m in store.maintenance_for(equipment_id)]
    failures    = [FailureEvent(**f) for f in store.failures_for(equipment_id)]

    return EquipmentDetail(
        **eq,
        current_reading=reading,
        maintenance_records=maintenance,
        failure_events=failures,
    )


@router.get("/{equipment_id}/risk", response_model=RiskScore)
async def get_equipment_risk(equipment_id: str):
    eq = store.equipment_by_id(equipment_id)
    if not eq:
        raise NotFoundError("Equipment", equipment_id)
    risk = store.risk_scores.get(equipment_id)
    if not risk:
        raise NotFoundError("RiskScore", equipment_id)
    return RiskScore(**risk)


@router.get("/{equipment_id}/recommendations")
async def get_equipment_recommendations(equipment_id: str):
    eq = store.equipment_by_id(equipment_id)
    if not eq:
        raise NotFoundError("Equipment", equipment_id)
    recs = store.recommendations.get(equipment_id, [])
    return {"data": [Recommendation(**r) for r in recs if not r.get("dismissed")]}
