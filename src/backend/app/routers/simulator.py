"""
GridWise What-If Simulator Router
===================================
POST /simulator/score  — run the Risk Intelligence Engine on a user-supplied
                          input bundle and return a full RiskOutput.

The simulator does NOT persist any scores or modify the live data store.
It is a stateless, read-only calculation endpoint.

All results are prototype estimates — see RiskOutput.contributing_factors.
"""
from __future__ import annotations

from fastapi import APIRouter

from ..engine.risk_engine import score as engine_score
from ..schemas.risk import RiskInput, RiskOutput

router = APIRouter(prefix="/simulator", tags=["simulator"])


@router.post("/score", response_model=RiskOutput)
async def simulate_score(payload: RiskInput) -> RiskOutput:
    """
    Run the Risk Intelligence Engine on the supplied ``RiskInput`` and return
    the full ``RiskOutput`` — including ``factor_scores``,
    ``contributing_factors``, and ``recommended_actions``.

    This endpoint is **stateless**: it does not modify any stored risk scores
    or recommendations.  Use it to evaluate what-if scenarios interactively.
    """
    return engine_score(payload)
