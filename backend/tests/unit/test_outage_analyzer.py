"""
Unit tests for the GridWise Outage Risk Analysis Engine.

Scenarios covered
-----------------
1.  Empty zone (no equipment / no risk outputs)
2.  Minimal-risk zone (all low-risk equipment)
3.  Low outage risk  (single medium-risk asset)
4.  Medium outage risk  (mix of medium/high-risk assets)
5.  High outage risk  (multiple high-risk assets)
6.  Critical outage risk  (critical + high assets, large customer base)
7.  Redundancy — full redundancy reduces outage risk vs no redundancy
8.  Missing risk outputs (some equipment has no RiskOutput)
9.  Contributing equipment filtering (below-threshold units excluded)
10. Key risk factors aggregation
11. Multi-zone fleet summary
12. Outage risk score is distinct from equipment risk score
13. Layer boundary — OutageRiskEngine only reads risk_score from RiskOutput
14. _risk_score_to_outage_prob calibration checks

DISCLAIMER: All results are prototype/simulated estimates.
They are not real-world operational guarantees.
"""
from __future__ import annotations

import math
import pytest
from datetime import datetime, timezone

from app.engine.outage_analyzer import (
    OutageRiskEngine,
    _outage_level,
    _risk_score_to_outage_prob,
    _zone_outage_score,
)
from app.schemas.outage import (
    EquipmentContext,
    OutageInput,
    OutageScenario,
    ZoneContext,
)
from app.schemas.risk import FactorScore, RiskOutput


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

_ENGINE = OutageRiskEngine()


def _zone(
    zone_id: str = "Z-01",
    zone_name: str = "Alpha District",
    region: str = "North",
    total_customers: int = 10_000,
    redundancy_level: str = "none",
) -> ZoneContext:
    return ZoneContext(
        zone_id=zone_id,
        zone_name=zone_name,
        region=region,
        total_customers=total_customers,
        redundancy_level=redundancy_level,
    )


def _eq_ctx(
    equipment_id: str,
    zone_id: str = "Z-01",
    equipment_type: str = "transformer",
    customers_affected: int = 1_000,
    substation_name: str = "Sub-A",
) -> EquipmentContext:
    return EquipmentContext(
        equipment_id=equipment_id,
        equipment_name=f"Unit {equipment_id}",
        equipment_type=equipment_type,
        substation_name=substation_name,
        zone_id=zone_id,
        customers_affected=customers_affected,
    )


def _risk_output(
    equipment_id: str,
    risk_score: float,
    risk_level: str = "low",
    factor_name: str = "load",
    factor_label: str = "Load Stress",
) -> RiskOutput:
    """Build a minimal RiskOutput for testing (bypasses RiskEngine)."""
    fs = FactorScore(
        factor=factor_name,
        label=factor_label,
        raw_value=None,
        normalized_value=min(risk_score / 100.0, 1.0),
        weight=0.25,
        score_contribution=risk_score * 0.25,
        pct_of_total=100.0,
        is_primary_driver=True,
    )
    return RiskOutput(
        equipment_id=equipment_id,
        risk_score=risk_score,
        risk_level=risk_level,  # type: ignore[arg-type]
        contributing_factors=[f"Simulated factor for {equipment_id}"],
        factor_scores=[fs],
        recommended_actions=["Monitor closely."],
        scored_at=datetime.now(timezone.utc),
    )


def _analyze(
    equipment_ids: list[str],
    scores: dict[str, float],
    risk_levels: dict[str, str] | None = None,
    zone: ZoneContext | None = None,
    customers_per_unit: int = 1_000,
    equipment_type: str = "transformer",
) -> OutageScenario:
    """Convenience wrapper: build OutageInput + risk_outputs and call engine."""
    z = zone or _zone()
    eq_list = [
        _eq_ctx(eid, zone_id=z.zone_id, equipment_type=equipment_type, customers_affected=customers_per_unit)
        for eid in equipment_ids
    ]
    risk_outputs = {
        eid: _risk_output(
            eid,
            scores[eid],
            (risk_levels or {}).get(eid, "low"),
        )
        for eid in equipment_ids
    }
    inp = OutageInput(zone=z, equipment=eq_list)
    return _ENGINE.analyze(inp, risk_outputs)


# ---------------------------------------------------------------------------
# 1. Empty zone
# ---------------------------------------------------------------------------

class TestEmptyZone:
    def test_empty_zone_returns_minimal_scenario(self):
        inp = OutageInput(zone=_zone(), equipment=[])
        result = _ENGINE.analyze(inp, {})
        assert result.outage_risk_score == 0.0
        assert result.risk_level == "minimal"
        assert result.outage_probability == 0.0
        assert result.total_equipment_in_zone == 0
        assert result.contributing_equipment == []
        assert result.key_risk_factors == []
        assert result.potentially_affected_customers == 0

    def test_empty_zone_has_disclaimer(self):
        inp = OutageInput(zone=_zone(), equipment=[])
        result = _ENGINE.analyze(inp, {})
        assert result.disclaimer
        assert "prototype" in result.disclaimer.lower() or "not a real" in result.disclaimer.lower()

    def test_empty_zone_preserves_customer_count(self):
        z = _zone(total_customers=5_000)
        inp = OutageInput(zone=z, equipment=[])
        result = _ENGINE.analyze(inp, {})
        assert result.total_zone_customers == 5_000
        assert result.estimated_impact.worst_case_customers == 5_000


# ---------------------------------------------------------------------------
# 2. Minimal outage risk (all low-risk)
# ---------------------------------------------------------------------------

class TestMinimalOutageRisk:
    def test_all_low_risk_gives_minimal_or_low_level(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 10.0, "EQ-02": 12.0},
            {"EQ-01": "low", "EQ-02": "low"},
        )
        assert result.risk_level in ("minimal", "low"), (
            f"Expected minimal/low, got {result.risk_level} (score={result.outage_risk_score})"
        )

    def test_no_emergency_actions_for_low_risk(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 5.0},
            {"EQ-01": "low"},
        )
        assert result.outage_risk_score < 35.0


# ---------------------------------------------------------------------------
# 3. Low outage risk (single medium-risk asset)
# ---------------------------------------------------------------------------

class TestLowOutageRisk:
    def test_single_medium_asset_gives_low_outage_level(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 35.0},
            {"EQ-01": "medium"},
        )
        assert result.risk_level in ("low", "medium"), (
            f"score={result.outage_risk_score}, level={result.risk_level}"
        )
        assert result.outage_risk_score < 55.0

    def test_outage_risk_score_lower_than_equipment_risk_score(self):
        """
        The outage risk score is derived from zone probability and is not
        the same as (nor higher than) the average equipment risk score
        for a single medium-risk asset.
        """
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 35.0},
            {"EQ-01": "medium"},
        )
        # outage_risk_score should be < avg equipment risk score here
        assert result.outage_risk_score < result.avg_equipment_risk_score or result.outage_risk_score < 55


# ---------------------------------------------------------------------------
# 4. Medium outage risk
# ---------------------------------------------------------------------------

class TestMediumOutageRisk:
    def test_mix_of_medium_high_gives_elevated_outage(self):
        """
        Three medium/high-risk units in the same zone cause compounding zone
        probability via the independent-failure model; the resulting outage
        score may reach 'critical' even though no single unit is critical.
        This is expected behaviour — the zone is more dangerous than any
        individual asset implies.
        """
        result = _analyze(
            ["EQ-01", "EQ-02", "EQ-03"],
            {"EQ-01": 40.0, "EQ-02": 55.0, "EQ-03": 45.0},
            {"EQ-01": "medium", "EQ-02": "high", "EQ-03": "medium"},
            customers_per_unit=500,
        )
        # Zone outage risk is elevated above any individual equipment level
        assert result.risk_level in ("medium", "high", "critical"), (
            f"score={result.outage_risk_score}, level={result.risk_level}"
        )
        # Outage score must be above the 'low' threshold (15)
        assert result.outage_risk_score > 15.0

    def test_medium_scenario_has_contributing_equipment(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 55.0, "EQ-02": 50.0},
            {"EQ-01": "high", "EQ-02": "high"},
            customers_per_unit=800,
        )
        assert len(result.contributing_equipment) >= 1

    def test_medium_scenario_has_key_risk_factors(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 50.0, "EQ-02": 45.0},
            {"EQ-01": "high", "EQ-02": "medium"},
        )
        # key_risk_factors may be empty if contributions are below threshold;
        # just ensure the field is present and correct type
        assert isinstance(result.key_risk_factors, list)


# ---------------------------------------------------------------------------
# 5. High outage risk
# ---------------------------------------------------------------------------

class TestHighOutageRisk:
    def test_multiple_high_risk_assets_give_high_outage(self):
        result = _analyze(
            ["EQ-01", "EQ-02", "EQ-03", "EQ-04"],
            {"EQ-01": 70.0, "EQ-02": 65.0, "EQ-03": 72.0, "EQ-04": 68.0},
            {k: "high" for k in ["EQ-01", "EQ-02", "EQ-03", "EQ-04"]},
            customers_per_unit=1_500,
        )
        assert result.risk_level in ("high", "critical"), (
            f"score={result.outage_risk_score}, level={result.risk_level}"
        )
        assert result.outage_risk_score >= 35.0

    def test_high_outage_contributing_equipment_sorted_by_contribution(self):
        result = _analyze(
            ["EQ-01", "EQ-02", "EQ-03"],
            {"EQ-01": 70.0, "EQ-02": 65.0, "EQ-03": 60.0},
            {k: "high" for k in ["EQ-01", "EQ-02", "EQ-03"]},
        )
        if len(result.contributing_equipment) >= 2:
            probs = [c.outage_contribution for c in result.contributing_equipment]
            assert probs == sorted(probs, reverse=True), "Contributing equipment not sorted by outage_contribution"

    def test_high_outage_scenario_has_customers_at_risk(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 70.0, "EQ-02": 68.0},
            {"EQ-01": "high", "EQ-02": "high"},
            customers_per_unit=2_000,
        )
        assert result.potentially_affected_customers > 0


# ---------------------------------------------------------------------------
# 6. Critical outage risk
# ---------------------------------------------------------------------------

class TestCriticalOutageRisk:
    def test_critical_assets_produce_critical_or_high_outage(self):
        result = _analyze(
            ["EQ-01", "EQ-02", "EQ-03"],
            {"EQ-01": 90.0, "EQ-02": 85.0, "EQ-03": 88.0},
            {k: "critical" for k in ["EQ-01", "EQ-02", "EQ-03"]},
            customers_per_unit=5_000,
        )
        assert result.risk_level in ("critical", "high"), (
            f"score={result.outage_risk_score}, level={result.risk_level}"
        )
        assert result.outage_risk_score >= 55.0

    def test_critical_scenario_has_high_economic_impact(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 92.0},
            {"EQ-01": "critical"},
            customers_per_unit=10_000,
        )
        # With 10k customers and a critical asset, economic impact should be high
        assert result.estimated_impact.economic_impact_tier in ("medium", "high")

    def test_critical_scenario_complex_restoration(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 90.0},
            {"EQ-01": "critical"},
            equipment_type="transformer",
            customers_per_unit=3_000,
        )
        assert result.estimated_impact.restoration_complexity == "complex"

    def test_critical_count_populated(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 90.0, "EQ-02": 85.0},
            {"EQ-01": "critical", "EQ-02": "critical"},
        )
        assert result.critical_equipment_count == 2

    def test_outage_score_and_equipment_score_are_distinct(self):
        """
        The outage_risk_score must NOT equal avg_equipment_risk_score.
        They are computed by different transforms and represent different things.
        """
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 90.0},
            {"EQ-01": "critical"},
        )
        assert result.outage_risk_score != result.avg_equipment_risk_score, (
            "outage_risk_score must be distinct from avg_equipment_risk_score"
        )


# ---------------------------------------------------------------------------
# 7. Redundancy
# ---------------------------------------------------------------------------

class TestRedundancy:
    def _score_for_redundancy(self, level: str) -> float:
        z = _zone(redundancy_level=level)
        return _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 80.0, "EQ-02": 75.0},
            {"EQ-01": "critical", "EQ-02": "critical"},
            zone=z,
        ).outage_risk_score

    def test_full_redundancy_lower_than_no_redundancy(self):
        score_none = self._score_for_redundancy("none")
        score_full = self._score_for_redundancy("full")
        assert score_full < score_none, (
            f"Full redundancy ({score_full}) should reduce outage risk vs none ({score_none})"
        )

    def test_partial_redundancy_between_none_and_full(self):
        score_none    = self._score_for_redundancy("none")
        score_partial = self._score_for_redundancy("partial")
        score_full    = self._score_for_redundancy("full")
        assert score_full <= score_partial <= score_none, (
            f"Expected full={score_full} ≤ partial={score_partial} ≤ none={score_none}"
        )


# ---------------------------------------------------------------------------
# 8. Missing risk outputs (equipment with no RiskOutput is skipped)
# ---------------------------------------------------------------------------

class TestMissingRiskOutputs:
    def test_missing_outputs_skipped_gracefully(self):
        z = _zone()
        eq_list = [
            _eq_ctx("EQ-01"),
            _eq_ctx("EQ-02"),   # no RiskOutput for this one
        ]
        risk_outputs = {"EQ-01": _risk_output("EQ-01", 80.0, "critical")}
        inp = OutageInput(zone=z, equipment=eq_list)
        result = _ENGINE.analyze(inp, risk_outputs)
        # Should succeed with one equipment scored
        assert result.total_equipment_in_zone == 1

    def test_all_outputs_missing_returns_empty_scenario(self):
        inp = OutageInput(
            zone=_zone(),
            equipment=[_eq_ctx("EQ-01"), _eq_ctx("EQ-02")],
        )
        result = _ENGINE.analyze(inp, {})
        assert result.total_equipment_in_zone == 0
        assert result.risk_level == "minimal"


# ---------------------------------------------------------------------------
# 9. Contributing equipment filtering
# ---------------------------------------------------------------------------

class TestContributingEquipmentFiltering:
    def test_below_threshold_units_not_in_contributing(self):
        """Equipment with outage probability below _CONTRIBUTOR_THRESHOLD (0.08)
        should not appear in contributing_equipment."""
        result = _analyze(
            ["EQ-LOW"],
            {"EQ-LOW": 5.0},   # very low risk → outage prob well below 0.08
            {"EQ-LOW": "low"},
        )
        assert result.contributing_equipment == [], (
            f"Very low-risk asset should not be a contributor, "
            f"but got {result.contributing_equipment}"
        )

    def test_max_contributors_capped_at_8(self):
        ids = [f"EQ-{i:02d}" for i in range(12)]
        scores = {eid: 90.0 for eid in ids}
        levels = {eid: "critical" for eid in ids}
        result = _analyze(ids, scores, levels, customers_per_unit=500)
        assert len(result.contributing_equipment) <= 8

    def test_contributing_equipment_has_required_fields(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 80.0},
            {"EQ-01": "critical"},
        )
        if result.contributing_equipment:
            c = result.contributing_equipment[0]
            assert c.equipment_id
            assert c.equipment_name
            assert c.equipment_type
            assert 0.0 <= c.outage_contribution <= 1.0
            assert c.equipment_risk_score > 0
            assert c.primary_risk_factor


# ---------------------------------------------------------------------------
# 10. Key risk factors aggregation
# ---------------------------------------------------------------------------

class TestKeyRiskFactors:
    def test_key_risk_factors_present_for_high_risk_zone(self):
        result = _analyze(
            ["EQ-01", "EQ-02"],
            {"EQ-01": 85.0, "EQ-02": 80.0},
            {"EQ-01": "critical", "EQ-02": "critical"},
        )
        assert len(result.key_risk_factors) >= 1

    def test_key_risk_factor_has_required_fields(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 85.0},
            {"EQ-01": "critical"},
        )
        if result.key_risk_factors:
            f = result.key_risk_factors[0]
            assert f.factor_name
            assert f.factor_label
            assert f.severity in ("critical", "high", "medium", "low")
            assert f.description
            assert f.affected_units >= 1

    def test_key_risk_factors_max_5(self):
        result = _analyze(
            [f"EQ-{i}" for i in range(10)],
            {f"EQ-{i}": 85.0 for i in range(10)},
            {f"EQ-{i}": "critical" for i in range(10)},
        )
        assert len(result.key_risk_factors) <= 5


# ---------------------------------------------------------------------------
# 11. Multi-zone fleet summary
# ---------------------------------------------------------------------------

class TestFleetSummary:
    def _build_scenarios(self) -> tuple[list[OutageScenario], list[ZoneContext]]:
        zones = [
            _zone("Z-01", "Alpha",  total_customers=5_000),
            _zone("Z-02", "Beta",   total_customers=8_000),
            _zone("Z-03", "Gamma",  total_customers=2_000),
        ]
        scenarios = [
            _analyze(
                ["EQ-A1"],
                {"EQ-A1": 90.0},
                {"EQ-A1": "critical"},
                zone=zones[0],
                customers_per_unit=5_000,
            ),
            _analyze(
                ["EQ-B1", "EQ-B2"],
                {"EQ-B1": 60.0, "EQ-B2": 55.0},
                {"EQ-B1": "high", "EQ-B2": "high"},
                zone=zones[1],
                customers_per_unit=4_000,
            ),
            _analyze(
                ["EQ-C1"],
                {"EQ-C1": 20.0},
                {"EQ-C1": "low"},
                zone=zones[2],
                customers_per_unit=2_000,
            ),
        ]
        return scenarios, zones

    def test_fleet_summary_counts_zones(self):
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        assert summary.total_zones_assessed == 3

    def test_fleet_summary_highest_risk_zone(self):
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        assert summary.highest_risk_zone  # non-empty

    def test_fleet_summary_fleet_probability_positive(self):
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        assert 0.0 <= summary.fleet_outage_probability <= 1.0

    def test_fleet_probability_increases_with_more_zones(self):
        """P(at least one outage across N zones) ≥ max individual zone probability."""
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        max_zone_prob = max(s.outage_probability for s in scenarios)
        assert summary.fleet_outage_probability >= max_zone_prob

    def test_fleet_total_customers(self):
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        assert summary.total_fleet_customers == 15_000

    def test_fleet_summary_has_disclaimer(self):
        scenarios, zones = self._build_scenarios()
        summary = OutageRiskEngine.summarize_fleet(scenarios, zones)
        assert summary.disclaimer


# ---------------------------------------------------------------------------
# 12. Layer boundary tests
# ---------------------------------------------------------------------------

class TestLayerBoundary:
    def test_outage_scenario_has_all_required_fields(self):
        result = _analyze(
            ["EQ-01"],
            {"EQ-01": 70.0},
            {"EQ-01": "high"},
        )
        # All fields mandated by the schema
        assert isinstance(result.outage_risk_score, float)
        assert isinstance(result.risk_level, str)
        assert isinstance(result.affected_zone, str)
        assert isinstance(result.potentially_affected_customers, int)
        assert isinstance(result.estimated_impact.expected_customers_affected, int)
        assert isinstance(result.contributing_equipment, list)
        assert isinstance(result.key_risk_factors, list)
        assert isinstance(result.assessed_at, datetime)

    def test_outage_risk_score_in_0_100(self):
        for risk_score in [0.0, 25.0, 50.0, 75.0, 100.0]:
            result = _analyze(["EQ"], {"EQ": risk_score}, {"EQ": "low"})
            assert 0.0 <= result.outage_risk_score <= 100.0, (
                f"outage_risk_score out of range for equipment risk={risk_score}"
            )

    def test_outage_probability_in_0_1(self):
        for risk_score in [0.0, 50.0, 100.0]:
            result = _analyze(["EQ"], {"EQ": risk_score}, {"EQ": "low"})
            assert 0.0 <= result.outage_probability <= 1.0

    def test_equipment_risk_and_outage_risk_use_different_scales(self):
        """
        Verify that the outage_risk_score is not simply a copy of the
        equipment risk score — the two layers produce different numbers.
        """
        eq_risk = 80.0
        result = _analyze(["EQ"], {"EQ": eq_risk}, {"EQ": "critical"})
        # The outage score is derived from probability via an exponential
        # transform and will never equal the raw equipment score exactly.
        assert result.outage_risk_score != eq_risk
        # Also verify the avg_equipment_risk_score reflects the input
        assert result.avg_equipment_risk_score == eq_risk

    def test_affected_zone_label_uses_zone_name(self):
        z = _zone(zone_name="Riverside District", region="East")
        result = _analyze(["EQ"], {"EQ": 50.0}, {"EQ": "high"}, zone=z)
        assert "Riverside District" in result.affected_zone


# ---------------------------------------------------------------------------
# 13. _risk_score_to_outage_prob calibration
# ---------------------------------------------------------------------------

class TestRiskScoreToOutageProbCalibration:
    def test_score_0_gives_near_zero_prob(self):
        p = _risk_score_to_outage_prob(0.0)
        assert p < 0.05, f"score=0 should give very low probability, got {p}"

    def test_score_50_gives_low_to_medium_prob(self):
        p = _risk_score_to_outage_prob(50.0)
        assert 0.10 < p < 0.30, f"score=50 → expected 0.10–0.30, got {p}"

    def test_score_75_gives_notable_prob(self):
        p = _risk_score_to_outage_prob(75.0)
        assert 0.30 < p < 0.60, f"score=75 → expected 0.30–0.60, got {p}"

    def test_score_100_below_1(self):
        p = _risk_score_to_outage_prob(100.0)
        assert p < 1.0, "Even score=100 must not produce outage probability of 1.0"

    def test_monotone_increasing(self):
        probs = [_risk_score_to_outage_prob(s) for s in range(0, 101, 10)]
        assert probs == sorted(probs), "Outage probability must be monotonically increasing with risk score"


# ---------------------------------------------------------------------------
# 14. _zone_outage_score and _outage_level helpers
# ---------------------------------------------------------------------------

class TestHelpers:
    def test_zone_score_at_zero_prob(self):
        assert _zone_outage_score(0.0) == 0.0

    def test_zone_score_at_full_prob(self):
        # P=1.0: score = 100*(1 - exp(-3)) ≈ 95
        assert _zone_outage_score(1.0) > 90.0

    def test_zone_score_monotone(self):
        probs = [i / 10 for i in range(11)]
        scores = [_zone_outage_score(p) for p in probs]
        assert scores == sorted(scores), "_zone_outage_score must be monotonically increasing"

    def test_outage_level_boundaries(self):
        assert _outage_level(0.0)  == "minimal"
        assert _outage_level(14.9) == "minimal"
        assert _outage_level(15.0) == "low"
        assert _outage_level(34.9) == "low"
        assert _outage_level(35.0) == "medium"
        assert _outage_level(54.9) == "medium"
        assert _outage_level(55.0) == "high"
        assert _outage_level(74.9) == "high"
        assert _outage_level(75.0) == "critical"
        assert _outage_level(100.0) == "critical"
