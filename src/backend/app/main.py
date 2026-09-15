"""
GridWise Backend — FastAPI Application
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .config import settings
from .middleware.cors import add_cors
from .middleware.error_handler import add_error_handlers
from .data.loader import load_data
from .services.scoring_service import score_all_equipment

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    logger.info("GridWise %s starting up...", settings.APP_VERSION)
    load_data(settings.DATA_DIR)
    if settings.RESCORE_ON_STARTUP:
        result = score_all_equipment()
        logger.info("Startup scoring: %s", result)
    from .data.store import store as _store
    logger.info("GridWise ready. %d equipment loaded.", len(_store.equipment))
    yield
    # ── Shutdown ──
    logger.info("GridWise shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-powered grid reliability and equipment risk intelligence platform",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    add_cors(app)
    add_error_handlers(app)

    # ── Routers ──
    from .routers import dashboard, equipment, zones, alerts, recommendations, data as data_router, outage, simulator
    prefix = settings.API_V1_PREFIX
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(equipment.router, prefix=prefix)
    app.include_router(zones.router, prefix=prefix)
    app.include_router(alerts.router, prefix=prefix)
    app.include_router(recommendations.router, prefix=prefix)
    app.include_router(data_router.router, prefix=prefix)
    app.include_router(outage.router, prefix=prefix)
    app.include_router(simulator.router, prefix=prefix)

    @app.get("/health")
    async def health():
        from .data.store import store
        return JSONResponse({
            "status": "ok",
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "data_loaded": store._loaded,
            "equipment_count": len(store.equipment),
        })

    return app


app = create_app()
