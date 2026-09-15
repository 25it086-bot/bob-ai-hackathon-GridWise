from fastapi import APIRouter
from ..data.store import store
from ..data.service import data_service

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/status")
async def data_status():
    return {"data": data_service.dataset_status()}


@router.get("/integrity")
async def integrity_check():
    issues = data_service.check_referential_integrity()
    return {"data": {"issues": issues, "ok": len(issues) == 0}}


@router.post("/refresh")
async def refresh_data():
    from ..services.scoring_service import score_all_equipment
    result = score_all_equipment()
    return {"data": result}


@router.get("/distribution")
async def risk_distribution():
    dist = data_service.risk_distribution()
    total = sum(dist.values())
    return {"data": {"distribution": dist, "total": total}}
