"""
Outage Risk Router
==================
Endpoints for zone-level and fleet-level outage risk analysis.

These endpoints return PROTOTYPE ESTIMATES based on simulated data.
All responses include a disclaimer field.
"""
from __future__ import annotations
import math
from fastapi import APIRouter, Query
from ..schemas.outage import OutageScenario, OutageSummary, OutageFleetSummary
from ..middleware.error_handler import NotFoundError
from ..data.store import store
from ..engine.outage_analyzer import analyze_zone, analyze_fleet

router = APIRouter(prefix="/outage", tags=["outage"])


def _to_summary(scenario: OutageScenario) -> OutageSummary:
    primary_factor = (
        scenario.key_risk_factors[0].factor_label
        if scenario.key_risk_factors
        else "No significant risk factors"
    )
    return OutageSummary(
        zone_id                        = scenario.zone_id,
        zone_name                      = scenario.zone_name,
        outage_risk_score              = scenario.outage_risk_score,
        risk_level                     = scenario.risk_level,
        outage_probability             = scenario.outage_probability,
        potentially_affected_customers = scenario.potentially_affected_customers,
        total_zone_customers           = scenario.total_zone_customers,
        critical_equipment             = scenario.critical_equipment_count,
        high_risk_equipment            = scenario.high_risk_equipment_count,
        primary_risk_driver            = primary_factor,
    )


@router.get("/predictions", response_model=list[OutageSummary])
async def get_outage_predictions(
    min_score: float = Query(0.0,  ge=0, le=100),
    risk_level: str | None = Query(None),
    sort_by: str = Query("outage_risk_score"),
    sort_dir: str = Query("desc"),
):
    """
    Return outage risk summaries for all zones, sorted by risk.

    - **min_score**: filter zones with outage_risk_score >= this value
    - **risk_level**: filter by level (critical, high, medium, low, minimal)
    - **sort_by**: outage_risk_score | outage_probability | potentially_affected_customers
    - **sort_dir**: desc | asc
    """
    scenarios, fleet_summary = analyze_fleet(store.zones, store.equipment, store.risk_scores)
    _ = fleet_summary  # used in /fleet endpoint; not needed here

    results = [_to_summary(s) for s in scenarios]

    if min_score > 0:
        results = [r for r in results if r.outage_risk_score >= min_score]
    if risk_level:
        levels = {l.strip() for l in risk_level.split(",")}
        results = [r for r in results if r.risk_level in levels]

    reverse = sort_dir.lower() != "asc"
    sort_keys = {
        "outage_risk_score":            lambda r: r.outage_risk_score,
        "outage_probability":           lambda r: r.outage_probability,
        "potentially_affected_customers":lambda r: r.potentially_affected_customers,
    }
    key_fn = sort_keys.get(sort_by, sort_keys["outage_risk_score"])
    results.sort(key=key_fn, reverse=reverse)

    return results


@router.get("/fleet", response_model=OutageFleetSummary)
async def get_fleet_summary():
    """Fleet-wide outage risk overview."""
    _, summary = analyze_fleet(store.zones, store.equipment, store.risk_scores)
    return summary


@router.get("/zones/{zone_id}", response_model=OutageScenario)
async def get_zone_outage_scenario(zone_id: str):
    """
    Full outage risk scenario for a specific zone.

    Returns the complete OutageScenario with:
    - outage_risk_score and risk_level
    - outage_probability (independent failure model)
    - potentially_affected_customers
    - estimated_impact (expected value, worst case, downtime, complexity)
    - contributing_equipment (top units by outage contribution)
    - key_risk_factors (aggregated from contributing equipment)
    - disclaimer
    """
    zone = store.zone_by_id(zone_id)
    if not zone:
        raise NotFoundError("Zone", zone_id)

    equipment_in_zone = store.equipment_in_zone(zone_id)
    scenario = analyze_zone(zone, equipment_in_zone, store.risk_scores)
    return scenario


@router.get("/impact", response_model=list[dict])
async def get_customer_impact():
    """
    Customer impact summary per zone — useful for the impact bar chart.
    Returns zones sorted by expected_customers_affected descending.
    """
    scenarios, _ = analyze_fleet(store.zones, store.equipment, store.risk_scores)
    result = []
    for s in scenarios:
        result.append({
            "zone_id":                     s.zone_id,
            "zone_name":                   s.zone_name,
            "risk_level":                  s.risk_level,
            "outage_risk_score":           s.outage_risk_score,
            "expected_customers_affected": s.potentially_affected_customers,
            "worst_case_customers":        s.total_zone_customers,
            "critical_equipment":          s.critical_equipment_count,
            "high_risk_equipment":         s.high_risk_equipment_count,
        })
    result.sort(key=lambda r: r["expected_customers_affected"], reverse=True)
    return result
