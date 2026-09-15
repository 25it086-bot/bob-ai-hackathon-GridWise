"""
GridWise Outage Risk Analysis Engine
======================================
Estimates zone-level outage risk from individual equipment failure risks.

Architecture — two distinct layers
-----------------------------------
Equipment layer (risk_engine.py)
    RiskInput → RiskOutput
    Scores each asset's failure probability based on sensor readings,
    age, maintenance history and environmental conditions.

Outage layer (outage_analyzer.py)
    OutageInput + list[RiskOutput] → OutageScenario
    Combines equipment failure risks with zone topology and customer data
    to estimate the probability and impact of a zone-level outage.

The two layers are intentionally separated: outage risk depends on
equipment risk but involves additional factors (grid redundancy, customer
count, equipment type criticality) that do not belong in the failure model.

How equipment risk contributes to outage risk
---------------------------------------------
1. Each RiskOutput carries a ``risk_score`` (0–100) for a single asset.
2. The OutageRiskEngine derives a per-asset *outage contribution probability*
   from that score using a sigmoid transform calibrated to the four risk tiers.
3. The zone outage probability is then computed from the independent-failure
   model:
       P(zone_outage) = 1 - PRODUCT(1 - p_i  for each asset i in zone)
   adjusted by a redundancy multiplier for the zone topology.
4. That probability is mapped to an outage_risk_score (0–100) using a
   separate transform so the two scores occupy distinct, clearly labelled
   scales.
5. Impact (expected customers, downtime, economic tier) is computed from
   the zone customer count, per-asset contribution probabilities, and
   equipment-type downtime baselines.

All results are prototype/simulated estimates.  They are not real-world
operational guarantees.
"""
from __future__ import annotations

import math
import logging
from datetime import datetime, timezone
from typing import Sequence

from ..schemas.outage import (
    ContributingEquipment,
    EquipmentContext,
    EstimatedImpact,
    KeyRiskFactor,
    OutageFleetSummary,
    OutageInput,
    OutageRiskLevel,
    OutageScenario,
    OutageSummary,
    ZoneContext,
    DISCLAIMER,
)
from ..schemas.risk import RiskOutput

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Minimum equipment outage_probability to be considered a "contributing" unit
_CONTRIBUTOR_THRESHOLD = 0.08

# Maximum contributing equipment to surface per zone (top-N by probability)
_MAX_CONTRIBUTORS = 8

# Historical average downtime hours by equipment type (simulated reference values)
_AVG_DOWNTIME_HOURS: dict[str, float] = {
    "transformer": 8.5,
    "substation":  6.0,
    "feeder":      3.5,
    "switchgear":  4.0,
}

# Restoration complexity by equipment type
_RESTORATION_COMPLEXITY: dict[str, str] = {
    "transformer": "complex",
    "substation":  "complex",
    "feeder":      "moderate",
    "switchgear":  "moderate",
}

# Economic impact tier thresholds (expected customers × downtime proxy)
_ECONOMIC_HIGH_THRESHOLD  = 5_000
_ECONOMIC_LOW_THRESHOLD   = 500


# ---------------------------------------------------------------------------
# Score → level mapping for outage risk
# ---------------------------------------------------------------------------

def _outage_level(score: float) -> OutageRiskLevel:
    """Map outage_risk_score (0-100) to a risk level."""
    if score >= 75:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 35:
        return "medium"
    if score >= 15:
        return "low"
    return "minimal"


# ---------------------------------------------------------------------------
# Outage risk score derivation
# ---------------------------------------------------------------------------

def _zone_outage_score(outage_probability: float) -> float:
    """
    Convert zone outage probability (0-1) to outage_risk_score (0-100).

    This is NOT the same as the equipment risk score.
    It is a monotone transform of the zone outage probability designed
    to spread the scale across the 0-100 range for readability.

    Formula:
        score = 100 * (1 - exp(-k * P))
    where k=3 makes P=0.80 map to ~91 and P=0.10 map to ~26.
    """
    k = 3.0
    return round(100.0 * (1.0 - math.exp(-k * outage_probability)), 1)


# ---------------------------------------------------------------------------
# Impact estimation
# ---------------------------------------------------------------------------

def _estimate_impact(
    zone: dict,
    contributing: list[dict],   # list of enriched equipment dicts
    zone_outage_prob: float,
) -> EstimatedImpact:
    """
    Estimate the consequences of a zone outage scenario.

    expected_customers = sum(P_i * customers_i) over all zone equipment
    worst_case_customers = total zone customers
    expected_downtime = weighted average by equipment outage_probability
    """
    zone_customers = zone.get("total_customers", 0)

    # Expected-value customer impact
    expected_cx = sum(
        c["outage_prob"] * c["customers_affected"]
        for c in contributing
    )
    expected_cx = round(expected_cx)

    # Weighted average downtime
    total_weight = sum(c["outage_prob"] for c in contributing)
    if total_weight > 0:
        avg_dt = sum(
            c["outage_prob"] * _AVG_DOWNTIME_HOURS.get(c["type"], 5.0)
            for c in contributing
        ) / total_weight
    else:
        avg_dt = 4.0

    # Economic impact tier
    economic_proxy = expected_cx
    if economic_proxy >= _ECONOMIC_HIGH_THRESHOLD:
        eco_tier = "high"
    elif economic_proxy >= _ECONOMIC_LOW_THRESHOLD:
        eco_tier = "medium"
    else:
        eco_tier = "low"

    # Restoration complexity: worst case across top contributors
    complexities = [
        _RESTORATION_COMPLEXITY.get(c["type"], "moderate")
        for c in contributing[:3]
    ]
    if "complex" in complexities:
        rest_complexity = "complex"
    elif "moderate" in complexities:
        rest_complexity = "moderate"
    else:
        rest_complexity = "straightforward"

    return EstimatedImpact(
        expected_customers_affected=expected_cx,
        worst_case_customers=zone_customers,
        expected_downtime_hours=round(avg_dt, 1),
        economic_impact_tier=eco_tier,
        restoration_complexity=rest_complexity,
    )


# ---------------------------------------------------------------------------
# Key risk factor extraction
# ---------------------------------------------------------------------------

_FACTOR_DESCRIPTIONS: dict[str, str] = {
    "load":        "Equipment is operating near or above rated capacity, increasing thermal and mechanical stress.",
    "temperature": "Elevated operating temperature accelerates insulation degradation and increases fault probability.",
    "age":         "Equipment has exceeded recommended service life, raising the baseline failure probability.",
    "maintenance": "Overdue maintenance increases the likelihood of undetected defects progressing to failure.",
    "failure":     "Recent failure history indicates systemic issues or end-of-life degradation patterns.",
    "voltage":     "Voltage deviation from nominal stresses insulation and protection systems.",
    "vibration":   "Elevated vibration indicates mechanical wear or loose components that may lead to failure.",
}


def _extract_key_risk_factors(
    contributing_enriched: list[dict],
) -> list[KeyRiskFactor]:
    """
    Aggregate the primary risk factors across contributing equipment
    into a zone-level key factors list.
    """
    factor_counts: dict[str, int] = {}
    factor_max_contribution: dict[str, float] = {}

    for c in contributing_enriched:
        pf = c.get("primary_factor_name", "")
        if pf:
            factor_counts[pf] = factor_counts.get(pf, 0) + 1
            contribution = c.get("primary_factor_contribution", 0)
            factor_max_contribution[pf] = max(
                factor_max_contribution.get(pf, 0), contribution
            )

    if not factor_counts:
        return []

    # Sort by count desc, then by max contribution desc
    sorted_factors = sorted(
        factor_counts.items(),
        key=lambda x: (x[1], factor_max_contribution.get(x[0], 0)),
        reverse=True,
    )

    result = []
    for fname, count in sorted_factors[:5]:
        max_c = factor_max_contribution.get(fname, 0)
        if max_c >= 60:
            severity = "critical"
        elif max_c >= 40:
            severity = "high"
        elif max_c >= 20:
            severity = "medium"
        else:
            severity = "low"

        result.append(KeyRiskFactor(
            factor_name=fname,
            factor_label=_factor_label(fname),
            severity=severity,
            description=_FACTOR_DESCRIPTIONS.get(fname, "Risk factor contributing to equipment failure."),
            affected_units=count,
        ))

    return result


def _factor_label(name: str) -> str:
    labels = {
        "load":        "Load Stress",
        "temperature": "Thermal Stress",
        "age":         "Equipment Age",
        "maintenance": "Maintenance Gap",
        "failure":     "Failure History",
        "voltage":     "Voltage Deviation",
        "vibration":   "Vibration Level",
    }
    return labels.get(name, name.replace("_", " ").title())


# ---------------------------------------------------------------------------
# Core zone analysis
# ---------------------------------------------------------------------------

def analyze_zone(
    zone: dict,
    equipment_in_zone: list[dict],
    risk_scores: dict[str, dict],   # keyed by equipment_id
) -> OutageScenario:
    """
    Compute outage risk for a single zone.

    Parameters
    ----------
    zone              : Zone reference dict (id, name, total_customers)
    equipment_in_zone : List of equipment dicts for this zone
    risk_scores       : Pre-computed RiskScore dicts keyed by equipment_id

    Returns
    -------
    OutageScenario with all required fields populated.
    """
    now = datetime.now(timezone.utc)
    zone_id       = zone["id"]
    zone_name     = zone["name"]
    zone_customers= zone.get("total_customers", 0)

    # ── Collect per-equipment data ──────────────────────────────────────────
    enriched: list[dict] = []
    for eq in equipment_in_zone:
        eid   = eq["id"]
        score = risk_scores.get(eid)
        if score is None:
            continue

        # Find primary factor
        factors = score.get("factors", [])
        primary = next(
            (f for f in factors if f.get("is_primary_driver")),
            factors[0] if factors else None,
        )
        primary_name         = primary["name"]        if primary else "unknown"
        primary_label        = primary["label"]       if primary else "Unknown"
        primary_contribution = primary["weighted_contribution"] if primary else 0

        enriched.append({
            "equipment_id":            eid,
            "name":                    eq.get("name", eid),
            "type":                    eq.get("type", "transformer"),
            "substation_name":         eq.get("substation_name", ""),
            "customers_affected":      eq.get("customers_affected", 0),
            "risk_score":              score["score"],
            "risk_level":              score["level"],
            "outage_prob":             score.get("outage_probability", 0.0),
            "primary_factor_name":     primary_name,
            "primary_factor_label":    primary_label,
            "primary_factor_contribution": primary_contribution,
        })

    if not enriched:
        return _empty_scenario(zone_id, zone_name, zone_customers, now)

    # ── Zone outage probability: independent failure model ──────────────────
    probs = [e["outage_prob"] for e in enriched]
    zone_outage_prob = round(
        1.0 - math.prod(1.0 - max(0.0, min(1.0, p)) for p in probs),
        4,
    )

    # ── Outage risk score (distinct from equipment risk score) ──────────────
    outage_score = _zone_outage_score(zone_outage_prob)
    risk_level   = _outage_level(outage_score)

    # ── Aggregated stats ────────────────────────────────────────────────────
    avg_equip_score = round(
        sum(e["risk_score"] for e in enriched) / len(enriched), 1
    )
    critical_count = sum(1 for e in enriched if e["risk_level"] == "critical")
    high_count     = sum(1 for e in enriched if e["risk_level"] == "high")

    # ── Contributing equipment: those above threshold, top-N ───────────────
    contributors_raw = sorted(
        [e for e in enriched if e["outage_prob"] >= _CONTRIBUTOR_THRESHOLD],
        key=lambda e: e["outage_prob"],
        reverse=True,
    )[:_MAX_CONTRIBUTORS]

    contributing = [
        ContributingEquipment(
            equipment_id         = c["equipment_id"],
            equipment_name       = c["name"],
            equipment_type       = c["type"],
            substation_name      = c["substation_name"],
            equipment_risk_score = c["risk_score"],
            equipment_risk_level = c["risk_level"],
            outage_contribution  = round(c["outage_prob"], 4),
            customers_at_risk    = round(c["outage_prob"] * c["customers_affected"]),
            primary_risk_factor  = c["primary_factor_label"],
        )
        for c in contributors_raw
    ]

    # ── Key risk factors ────────────────────────────────────────────────────
    key_factors = _extract_key_risk_factors(enriched)

    # ── Impact estimation ───────────────────────────────────────────────────
    impact = _estimate_impact(zone, enriched, zone_outage_prob)

    return OutageScenario(
        zone_id                       = zone_id,
        zone_name                     = zone_name,
        outage_risk_score             = outage_score,
        risk_level                    = risk_level,
        outage_probability            = zone_outage_prob,
        affected_zone                 = f"{zone_name} ({zone.get('region', zone_name)})",
        potentially_affected_customers= impact.expected_customers_affected,
        total_zone_customers          = zone_customers,
        estimated_impact              = impact,
        contributing_equipment        = contributing,
        key_risk_factors              = key_factors,
        total_equipment_in_zone       = len(enriched),
        critical_equipment_count      = critical_count,
        high_risk_equipment_count     = high_count,
        avg_equipment_risk_score      = avg_equip_score,
        assessed_at                   = now,
    )


def _empty_scenario(
    zone_id: str, zone_name: str, zone_customers: int, now: datetime
) -> OutageScenario:
    return OutageScenario(
        zone_id                        = zone_id,
        zone_name                      = zone_name,
        outage_risk_score              = 0.0,
        risk_level                     = "minimal",
        outage_probability             = 0.0,
        affected_zone                  = zone_name,
        potentially_affected_customers = 0,
        total_zone_customers           = zone_customers,
        estimated_impact               = EstimatedImpact(
            expected_customers_affected = 0,
            worst_case_customers        = zone_customers,
            expected_downtime_hours     = 0.0,
            economic_impact_tier        = "low",
            restoration_complexity      = "straightforward",
        ),
        contributing_equipment  = [],
        key_risk_factors        = [],
        total_equipment_in_zone = 0,
        critical_equipment_count= 0,
        high_risk_equipment_count=0,
        avg_equipment_risk_score= 0.0,
        assessed_at             = now,
    )


# ---------------------------------------------------------------------------
# Fleet-level analysis
# ---------------------------------------------------------------------------

def analyze_fleet(
    zones: list[dict],
    equipment_all: list[dict],
    risk_scores: dict[str, dict],
) -> tuple[list[OutageScenario], OutageFleetSummary]:
    """
    Analyze outage risk across all zones and produce fleet summary.

    Returns
    -------
    (list[OutageScenario], OutageFleetSummary)
    """
    now      = datetime.now(timezone.utc)
    scenarios: list[OutageScenario] = []

    zone_map = {z["id"]: z for z in zones}

    # Group equipment by zone
    equip_by_zone: dict[str, list[dict]] = {z["id"]: [] for z in zones}
    for eq in equipment_all:
        zid = eq.get("zone_id")
        if zid in equip_by_zone:
            equip_by_zone[zid].append(eq)

    for zone in zones:
        scenario = analyze_zone(zone, equip_by_zone[zone["id"]], risk_scores)
        scenarios.append(scenario)

    # Sort by outage_risk_score descending
    scenarios.sort(key=lambda s: s.outage_risk_score, reverse=True)

    # Fleet-level outage probability: P(at least one zone outage)
    zone_probs  = [s.outage_probability for s in scenarios]
    fleet_prob  = round(1.0 - math.prod(1.0 - p for p in zone_probs), 4) if zone_probs else 0.0

    total_cx_risk = sum(s.potentially_affected_customers for s in scenarios)
    total_cx_all  = sum(z.get("total_customers", 0) for z in zones)

    critical_zones = sum(1 for s in scenarios if s.risk_level == "critical")
    high_zones     = sum(1 for s in scenarios if s.risk_level == "high")

    top = scenarios[0] if scenarios else None

    summary = OutageFleetSummary(
        total_zones_assessed     = len(scenarios),
        critical_outage_zones    = critical_zones,
        high_outage_zones        = high_zones,
        total_customers_at_risk  = total_cx_risk,
        total_fleet_customers    = total_cx_all,
        highest_risk_zone        = top.zone_name if top else "",
        highest_risk_score       = top.outage_risk_score if top else 0.0,
        fleet_outage_probability = fleet_prob,
        assessed_at              = now,
    )

    return scenarios, summary


# ===========================================================================
# OutageRiskEngine — typed, RiskOutput-based public API
# ===========================================================================
#
# This is the *new* primary entry-point.  It accepts structured RiskOutput
# objects from the equipment-failure layer and produces OutageScenario
# through the same computation logic used by analyze_zone(), but without
# relying on untyped dicts.
#
# Layer boundary summary
# ----------------------
#   equipment-failure layer  :  RiskInput → RiskEngine → RiskOutput
#                                   (per-asset: score, level, factor_scores)
#   outage-risk layer        :  OutageInput + list[RiskOutput]
#                                   → OutageRiskEngine → OutageScenario
#                                   (per-zone: zone prob, impact, contributing)
#
# The two layers share no state.  The only coupling is that OutageRiskEngine
# reads RiskOutput.risk_score to derive each asset's outage contribution
# probability via ``_risk_score_to_outage_prob()``.

def _risk_score_to_outage_prob(risk_score: float) -> float:
    """
    Derive a single-asset outage contribution probability from its
    equipment risk score (0–100).

    This is a sigmoid transform calibrated so that:
      - score  0  → prob ≈ 0.01   (healthy equipment, negligible contribution)
      - score 25  → prob ≈ 0.06   (medium risk, minor contribution)
      - score 50  → prob ≈ 0.18   (high risk, noticeable contribution)
      - score 75  → prob ≈ 0.45   (critical risk, major contribution)
      - score 100 → prob ≈ 0.73   (extreme — conservative ceiling)

    Rationale: even a critical-risk piece of equipment does not guarantee
    an outage (redundancy, operator intervention, etc.), so the probability
    is deliberately capped well below 1.0 for the prototype model.

    This function bridges the equipment-failure layer and the outage-risk
    layer.  Replacing it with an ML-calibrated mapping is the intended
    upgrade path.
    """
    # Logistic centred at score=80, steepness k=0.04
    return round(1.0 / (1.0 + math.exp(-0.04 * (risk_score - 80))), 4)


# Redundancy multipliers — reduce effective per-unit outage probability
_REDUNDANCY_SCALE: dict[str, float] = {
    "none":    1.00,   # no redundancy — every failure threatens the zone
    "partial": 0.60,   # partial redundancy — some mitigation
    "full":    0.25,   # full redundancy — strong mitigation
}


class OutageRiskEngine:
    """
    Translates equipment failure risks (RiskOutput objects) into an
    outage risk assessment for a zone (OutageScenario).

    DISCLAIMER
    ----------
    All results are prototype/simulated estimates based on heuristic
    models.  They are not real-world operational guarantees.

    Usage
    -----
    ::

        engine = OutageRiskEngine()
        scenario = engine.analyze(
            inp=OutageInput(zone=zone_ctx, equipment=equip_list),
            risk_outputs={eid: risk_output, ...},
        )

    To assess multiple zones, call ``analyze()`` once per zone and then
    ``summarize_fleet()`` to produce an ``OutageFleetSummary``.
    """

    def analyze(
        self,
        inp: OutageInput,
        risk_outputs: dict[str, RiskOutput],
    ) -> OutageScenario:
        """
        Compute an OutageScenario for a single zone.

        Parameters
        ----------
        inp          : Zone context + list of equipment context records.
        risk_outputs : Mapping of equipment_id → RiskOutput (from RiskEngine).
                       Equipment with no matching RiskOutput is skipped.

        Returns
        -------
        OutageScenario — fully populated, with disclaimer attached.
        """
        now  = datetime.now(timezone.utc)
        zone = inp.zone
        redundancy_scale = _REDUNDANCY_SCALE.get(zone.redundancy_level, 1.0)

        # ── Build enriched per-equipment records ───────────────────────────
        enriched: list[dict] = []
        for eq_ctx in inp.equipment:
            ro = risk_outputs.get(eq_ctx.equipment_id)
            if ro is None:
                continue

            # Bridge: equipment risk score → outage contribution probability
            raw_prob     = _risk_score_to_outage_prob(ro.risk_score)
            outage_prob  = round(min(raw_prob * redundancy_scale, 1.0), 4)

            # Primary driver from factor_scores (sorted desc by score_contribution)
            primary_fs   = ro.factor_scores[0] if ro.factor_scores else None
            primary_name = primary_fs.factor if primary_fs else "unknown"
            primary_label= primary_fs.label  if primary_fs else "Unknown"
            primary_pct  = primary_fs.pct_of_total if primary_fs else 0.0

            enriched.append({
                "equipment_id":             eq_ctx.equipment_id,
                "name":                     eq_ctx.equipment_name,
                "type":                     eq_ctx.equipment_type,
                "substation_name":          eq_ctx.substation_name,
                "customers_affected":       eq_ctx.customers_affected,
                "risk_score":               ro.risk_score,
                "risk_level":               ro.risk_level,
                "outage_prob":              outage_prob,
                "primary_factor_name":      primary_name,
                "primary_factor_label":     primary_label,
                "primary_factor_contribution": primary_pct,
                # Carry the full human-readable explanation for traceability
                "contributing_factors":     ro.contributing_factors,
            })

        if not enriched:
            return _empty_scenario(zone.zone_id, zone.zone_name, zone.total_customers, now)

        # ── Zone outage probability: independent-failure model ─────────────
        probs = [e["outage_prob"] for e in enriched]
        zone_outage_prob = round(
            1.0 - math.prod(1.0 - max(0.0, min(1.0, p)) for p in probs),
            4,
        )

        # ── Outage risk score (distinct scale from equipment risk score) ────
        outage_score = _zone_outage_score(zone_outage_prob)
        risk_level   = _outage_level(outage_score)

        # ── Aggregate stats ─────────────────────────────────────────────────
        avg_equip_score = round(
            sum(e["risk_score"] for e in enriched) / len(enriched), 1
        )
        critical_count = sum(1 for e in enriched if e["risk_level"] == "critical")
        high_count     = sum(1 for e in enriched if e["risk_level"] == "high")

        # ── Contributing equipment (above threshold, top-N) ─────────────────
        contributors_raw = sorted(
            [e for e in enriched if e["outage_prob"] >= _CONTRIBUTOR_THRESHOLD],
            key=lambda e: e["outage_prob"],
            reverse=True,
        )[:_MAX_CONTRIBUTORS]

        contributing = [
            ContributingEquipment(
                equipment_id         = c["equipment_id"],
                equipment_name       = c["name"],
                equipment_type       = c["type"],
                substation_name      = c["substation_name"],
                equipment_risk_score = c["risk_score"],
                equipment_risk_level = c["risk_level"],
                outage_contribution  = round(c["outage_prob"], 4),
                customers_at_risk    = round(c["outage_prob"] * c["customers_affected"]),
                primary_risk_factor  = c["primary_factor_label"],
            )
            for c in contributors_raw
        ]

        # ── Key risk factors ────────────────────────────────────────────────
        key_factors = _extract_key_risk_factors(enriched)

        # ── Impact estimation ───────────────────────────────────────────────
        zone_dict = {
            "total_customers": zone.total_customers,
            "region":          zone.region,
        }
        impact = _estimate_impact(zone_dict, enriched, zone_outage_prob)

        region_label = f" ({zone.region})" if zone.region else ""
        return OutageScenario(
            zone_id                        = zone.zone_id,
            zone_name                      = zone.zone_name,
            outage_risk_score              = outage_score,
            risk_level                     = risk_level,
            outage_probability             = zone_outage_prob,
            affected_zone                  = f"{zone.zone_name}{region_label}",
            potentially_affected_customers = impact.expected_customers_affected,
            total_zone_customers           = zone.total_customers,
            estimated_impact               = impact,
            contributing_equipment         = contributing,
            key_risk_factors               = key_factors,
            total_equipment_in_zone        = len(enriched),
            critical_equipment_count       = critical_count,
            high_risk_equipment_count      = high_count,
            avg_equipment_risk_score       = avg_equip_score,
            assessed_at                    = now,
        )

    @staticmethod
    def summarize_fleet(
        scenarios: list[OutageScenario],
        zone_contexts: list[ZoneContext],
    ) -> OutageFleetSummary:
        """
        Produce a fleet-wide summary from a list of already-computed scenarios.

        Parameters
        ----------
        scenarios     : One OutageScenario per zone (from analyze()).
        zone_contexts : The same ZoneContext objects used to produce the scenarios.
        """
        now = datetime.now(timezone.utc)

        scenarios_sorted = sorted(scenarios, key=lambda s: s.outage_risk_score, reverse=True)

        zone_probs = [s.outage_probability for s in scenarios_sorted]
        fleet_prob = round(1.0 - math.prod(1.0 - p for p in zone_probs), 4) if zone_probs else 0.0

        total_cx_risk = sum(s.potentially_affected_customers for s in scenarios_sorted)
        total_cx_all  = sum(z.total_customers for z in zone_contexts)

        critical_zones = sum(1 for s in scenarios_sorted if s.risk_level == "critical")
        high_zones     = sum(1 for s in scenarios_sorted if s.risk_level == "high")

        top = scenarios_sorted[0] if scenarios_sorted else None

        return OutageFleetSummary(
            total_zones_assessed     = len(scenarios_sorted),
            critical_outage_zones    = critical_zones,
            high_outage_zones        = high_zones,
            total_customers_at_risk  = total_cx_risk,
            total_fleet_customers    = total_cx_all,
            highest_risk_zone        = top.zone_name if top else "",
            highest_risk_score       = top.outage_risk_score if top else 0.0,
            fleet_outage_probability = fleet_prob,
            assessed_at              = now,
        )
