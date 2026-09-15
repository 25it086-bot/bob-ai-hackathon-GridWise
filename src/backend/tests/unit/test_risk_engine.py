"""
Unit tests for the GridWise Risk Intelligence Engine.

Scenarios covered
-----------------
1. Low-risk equipment
2. Medium-risk equipment
3. High-risk equipment
4. Critical-risk equipment
5. Missing / None values (graceful degradation with safe defaults)
6. Boundary values (0, 100, edge-of-level thresholds)

DISCLAIMER: Scores are produced by a heuristic model for demonstration
purposes.  They are not scientifically validated predictions.
"""
from __future__ import annotations

import pytest
from datetime import datetime

from app.engine.risk_engine import (
    RiskEngine,
    WeightedFactorScorer,
    _level_from_score,
    _norm_age,
    _norm_failures,
    _norm_load,
    _norm_maintenance,
    _norm_temperature,
    _norm_vibration,
    _norm_weather,
    score,
)
from app.schemas.risk import FactorScore, RiskInput, RiskOutput


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_input(**kwargs) -> RiskInput:
    """Build a RiskInput with sensible defaults; override via kwargs."""
    defaults = dict(
        equipment_id="EQ-TEST-001",
        temperature_c=30.0,
        load_pct=40.0,
        vibration_mms=1.0,
        age_years=5,
        days_since_maintenance=60,
        previous_failures=0,
        weather_condition="normal",
        customers_affected=500,
    )
    defaults.update(kwargs)
    return RiskInput(**defaults)


# ---------------------------------------------------------------------------
# 1. Low-risk equipment  (target: 0–24)
# ---------------------------------------------------------------------------

class TestLowRisk:
    def test_score_in_low_range(self):
        inp = _make_input(
            temperature_c=25.0,
            load_pct=20.0,
            vibration_mms=0.5,
            age_years=2,
            days_since_maintenance=30,
            previous_failures=0,
            weather_condition="normal",
        )
        result = score(inp)
        assert result.risk_score < 25, f"Expected low risk, got {result.risk_score}"
        assert result.risk_level == "low"

    def test_low_risk_has_no_urgent_actions(self):
        inp = _make_input(
            temperature_c=25.0,
            load_pct=20.0,
            vibration_mms=0.5,
            age_years=2,
            days_since_maintenance=30,
            previous_failures=0,
            weather_condition="normal",
        )
        result = score(inp)
        actions_text = " ".join(result.recommended_actions).lower()
        assert "emergency" not in actions_text
        assert "immediately" not in actions_text

    def test_low_risk_has_standard_monitoring_action(self):
        inp = _make_input(
            temperature_c=25.0,
            load_pct=20.0,
            vibration_mms=0.5,
            age_years=2,
            days_since_maintenance=30,
            previous_failures=0,
            weather_condition="normal",
        )
        result = score(inp)
        combined = " ".join(result.recommended_actions).lower()
        assert "standard monitoring" in combined or "no immediate action" in combined

    def test_output_has_required_fields(self):
        result = score(_make_input())
        assert isinstance(result.risk_score, float)
        assert isinstance(result.risk_level, str)
        assert isinstance(result.contributing_factors, list)
        assert isinstance(result.factor_scores, list)
        assert isinstance(result.recommended_actions, list)
        assert isinstance(result.scored_at, datetime)


# ---------------------------------------------------------------------------
# 2. Medium-risk equipment  (target: 25–49)
# ---------------------------------------------------------------------------

class TestMediumRisk:
    def test_score_in_medium_range(self):
        inp = _make_input(
            temperature_c=55.0,
            load_pct=60.0,
            vibration_mms=2.0,
            age_years=12,
            days_since_maintenance=200,
            previous_failures=1,
            weather_condition="normal",
        )
        result = score(inp)
        assert 25.0 <= result.risk_score < 50.0, (
            f"Expected medium risk (25–49), got {result.risk_score}"
        )
        assert result.risk_level == "medium"

    def test_medium_has_inspection_recommendation(self):
        inp = _make_input(
            temperature_c=55.0,
            load_pct=60.0,
            vibration_mms=2.0,
            age_years=12,
            days_since_maintenance=200,
            previous_failures=1,
            weather_condition="normal",
        )
        result = score(inp)
        combined = " ".join(result.recommended_actions).lower()
        assert "inspect" in combined or "schedul" in combined or "maintenance" in combined

    def test_medium_has_contributing_factors(self):
        inp = _make_input(
            temperature_c=55.0,
            load_pct=60.0,
            vibration_mms=2.0,
            age_years=12,
            days_since_maintenance=200,
            previous_failures=1,
            weather_condition="normal",
        )
        result = score(inp)
        assert len(result.contributing_factors) >= 1


# ---------------------------------------------------------------------------
# 3. High-risk equipment  (target: 50–74)
# ---------------------------------------------------------------------------

class TestHighRisk:
    def test_score_in_high_range(self):
        inp = _make_input(
            temperature_c=75.0,
            load_pct=88.0,
            vibration_mms=5.0,
            age_years=20,
            days_since_maintenance=300,
            previous_failures=2,
            weather_condition="high_wind",
        )
        result = score(inp)
        assert 50.0 <= result.risk_score < 75.0, (
            f"Expected high risk (50–74), got {result.risk_score}"
        )
        assert result.risk_level == "high"

    def test_high_risk_load_action_present(self):
        inp = _make_input(
            temperature_c=75.0,
            load_pct=88.0,
            vibration_mms=5.0,
            age_years=20,
            days_since_maintenance=300,
            previous_failures=2,
            weather_condition="high_wind",
        )
        result = score(inp)
        combined = " ".join(result.recommended_actions).lower()
        assert "load" in combined

    def test_high_risk_primary_driver_flagged(self):
        inp = _make_input(
            temperature_c=75.0,
            load_pct=88.0,
            vibration_mms=5.0,
            age_years=20,
            days_since_maintenance=300,
            previous_failures=2,
            weather_condition="high_wind",
        )
        result = score(inp)
        primary_drivers = [f for f in result.factor_scores if f.is_primary_driver]
        assert len(primary_drivers) == 1


# ---------------------------------------------------------------------------
# 4. Critical-risk equipment  (target: 75–100)
# ---------------------------------------------------------------------------

class TestCriticalRisk:
    def test_score_in_critical_range(self):
        inp = _make_input(
            temperature_c=100.0,
            load_pct=100.0,
            vibration_mms=9.0,
            age_years=30,
            days_since_maintenance=400,
            previous_failures=5,
            weather_condition="storm",
        )
        result = score(inp)
        assert result.risk_score >= 75.0, (
            f"Expected critical risk (≥75), got {result.risk_score}"
        )
        assert result.risk_level == "critical"

    def test_critical_risk_emergency_action_present(self):
        inp = _make_input(
            temperature_c=100.0,
            load_pct=100.0,
            vibration_mms=9.0,
            age_years=30,
            days_since_maintenance=400,
            previous_failures=5,
            weather_condition="storm",
        )
        result = score(inp)
        combined = " ".join(result.recommended_actions).lower()
        assert "emergency" in combined or "immediately" in combined

    def test_critical_storm_action_mentioned(self):
        inp = _make_input(
            temperature_c=100.0,
            load_pct=100.0,
            vibration_mms=9.0,
            age_years=30,
            days_since_maintenance=400,
            previous_failures=5,
            weather_condition="storm",
        )
        result = score(inp)
        combined = " ".join(result.recommended_actions).lower()
        assert "storm" in combined

    def test_critical_has_multiple_contributing_factors(self):
        inp = _make_input(
            temperature_c=100.0,
            load_pct=100.0,
            vibration_mms=9.0,
            age_years=30,
            days_since_maintenance=400,
            previous_failures=5,
            weather_condition="storm",
        )
        result = score(inp)
        assert len(result.contributing_factors) >= 3

    def test_factor_scores_sum_approximates_risk_score(self):
        """Sum of score_contributions must equal risk_score (within float rounding)."""
        inp = _make_input(
            temperature_c=100.0,
            load_pct=100.0,
            vibration_mms=9.0,
            age_years=30,
            days_since_maintenance=400,
            previous_failures=5,
            weather_condition="storm",
        )
        result = score(inp)
        total = sum(f.score_contribution for f in result.factor_scores)
        assert abs(total - result.risk_score) < 0.5, (
            f"Factor contributions sum ({total:.2f}) should ≈ risk_score ({result.risk_score})"
        )


# ---------------------------------------------------------------------------
# 5. Missing / None values — graceful degradation
# ---------------------------------------------------------------------------

class TestMissingValues:
    def test_all_none_returns_valid_output(self):
        inp = RiskInput(equipment_id="EQ-MISSING")
        result = score(inp)
        assert 0.0 <= result.risk_score <= 100.0
        assert result.risk_level in ("low", "medium", "high", "critical")
        assert len(result.factor_scores) == 7  # one per factor

    def test_partial_none_returns_valid_output(self):
        inp = RiskInput(
            equipment_id="EQ-PARTIAL",
            temperature_c=None,
            load_pct=80.0,
            vibration_mms=None,
            age_years=None,
            days_since_maintenance=300,
            previous_failures=None,
        )
        result = score(inp)
        assert 0.0 <= result.risk_score <= 100.0
        assert result.risk_level in ("low", "medium", "high", "critical")

    def test_none_temperature_uses_safe_default(self):
        inp_none = RiskInput(equipment_id="EQ-A", temperature_c=None)
        inp_def  = RiskInput(equipment_id="EQ-B", temperature_c=40.0)  # matches safe default
        r_none = score(inp_none)
        r_def  = score(inp_def)
        # Scores should be identical because 40°C is the safe default
        assert abs(r_none.risk_score - r_def.risk_score) < 0.1

    def test_none_weather_treated_as_normal(self):
        inp_none   = RiskInput(equipment_id="EQ-A", weather_condition=None)
        inp_normal = RiskInput(equipment_id="EQ-B", weather_condition="normal")
        r_none   = score(inp_none)
        r_normal = score(inp_normal)
        assert abs(r_none.risk_score - r_normal.risk_score) < 0.1

    def test_output_structure_complete_on_missing_input(self):
        result = score(RiskInput(equipment_id="EQ-EMPTY"))
        assert result.equipment_id == "EQ-EMPTY"
        assert isinstance(result.contributing_factors, list)
        assert isinstance(result.factor_scores, list)
        assert isinstance(result.recommended_actions, list)
        assert isinstance(result.scored_at, datetime)


# ---------------------------------------------------------------------------
# 6. Boundary values
# ---------------------------------------------------------------------------

class TestBoundaryValues:
    def test_zero_score_possible_with_min_inputs(self):
        """All inputs at their minimum → score should be very low (near 0)."""
        inp = _make_input(
            temperature_c=0.0,
            load_pct=0.0,
            vibration_mms=0.0,
            age_years=0,
            days_since_maintenance=0,
            previous_failures=0,
            weather_condition="normal",
        )
        result = score(inp)
        assert result.risk_score < 15.0, f"Expected near-zero score, got {result.risk_score}"

    def test_max_inputs_gives_critical_level(self):
        """Maximum plausible inputs → critical risk (≥75; temperature sigmoid never reaches exactly 1.0)."""
        inp = _make_input(
            temperature_c=150.0,
            load_pct=100.0,
            vibration_mms=50.0,
            age_years=60,
            days_since_maintenance=9999,
            previous_failures=50,
            weather_condition="storm",
        )
        result = score(inp)
        assert result.risk_level == "critical"
        assert result.risk_score >= 75.0

    def test_score_exactly_at_low_medium_boundary(self):
        """_level_from_score: 24.9 → low, 25.0 → medium."""
        assert _level_from_score(24.9) == "low"
        assert _level_from_score(25.0) == "medium"

    def test_score_exactly_at_medium_high_boundary(self):
        assert _level_from_score(49.9) == "medium"
        assert _level_from_score(50.0) == "high"

    def test_score_exactly_at_high_critical_boundary(self):
        assert _level_from_score(74.9) == "high"
        assert _level_from_score(75.0) == "critical"

    def test_score_capped_at_100(self):
        """Over-range inputs must not produce a score > 100."""
        inp = _make_input(
            temperature_c=150.0,
            load_pct=100.0,
            vibration_mms=50.0,
            age_years=60,
            days_since_maintenance=9999,
            previous_failures=50,
            weather_condition="storm",
        )
        result = score(inp)
        assert result.risk_score <= 100.0

    def test_score_floored_at_0(self):
        """Zero-everything inputs must not produce a score < 0."""
        inp = _make_input(
            temperature_c=0.0,
            load_pct=0.0,
            vibration_mms=0.0,
            age_years=0,
            days_since_maintenance=0,
            previous_failures=0,
            weather_condition="normal",
        )
        result = score(inp)
        assert result.risk_score >= 0.0

    def test_all_seven_factors_present(self):
        result = score(_make_input())
        keys = {f.factor for f in result.factor_scores}
        assert keys == {"temperature", "load", "vibration", "age", "maintenance", "previous_failures", "weather"}


# ---------------------------------------------------------------------------
# Normalisation unit tests
# ---------------------------------------------------------------------------

class TestNormalisationHelpers:
    def test_norm_load_range(self):
        assert _norm_load(0.0)   == 0.0
        assert _norm_load(100.0) == 1.0
        assert _norm_load(50.0)  == 0.5

    def test_norm_load_clamped(self):
        assert _norm_load(-5.0)  == 0.0
        assert _norm_load(110.0) == 1.0

    def test_norm_age_range(self):
        assert _norm_age(0)  == 0.0
        assert _norm_age(30) == 1.0
        assert _norm_age(60) == 1.0   # capped

    def test_norm_maintenance_range(self):
        assert _norm_maintenance(0)   == 0.0
        assert _norm_maintenance(365) == 1.0
        assert _norm_maintenance(730) == 1.0  # capped

    def test_norm_failures_range(self):
        assert _norm_failures(0) == 0.0
        assert _norm_failures(5) == 1.0
        assert _norm_failures(9) == 1.0  # capped at 1.0

    def test_norm_vibration_range(self):
        assert _norm_vibration(0.0)  == 0.0
        assert _norm_vibration(10.0) == 1.0
        assert _norm_vibration(20.0) == 1.0  # capped

    def test_norm_weather_known_conditions(self):
        assert _norm_weather("normal")       == 0.00
        assert _norm_weather("high_wind")    == 0.30
        assert _norm_weather("storm")        == 0.65
        assert _norm_weather("extreme_heat") == 0.50

    def test_norm_weather_none(self):
        assert _norm_weather(None) == 0.0

    def test_norm_weather_unknown_condition(self):
        assert _norm_weather("blizzard") == 0.0


# ---------------------------------------------------------------------------
# Pluggable scorer (ML seam) test
# ---------------------------------------------------------------------------

class TestPluggableScorer:
    def test_custom_scorer_is_called(self):
        """RiskEngine accepts and delegates to a custom ScoringStrategy."""
        from app.engine.risk_engine import _RawScores

        class ConstantScorer:
            """Always returns 0.5 for every factor — predictable test double."""
            def __call__(self, inp: RiskInput) -> _RawScores:
                from app.engine.risk_engine import _FACTOR_WEIGHTS
                return _RawScores({k: (None, 0.5) for k in _FACTOR_WEIGHTS})

        engine = RiskEngine(scorer=ConstantScorer())
        result = engine.score(_make_input())
        # 0.5 * sum(weights) * 100 == 50.0
        assert result.risk_score == pytest.approx(50.0, abs=0.1)
        assert result.risk_level == "high"

    def test_default_engine_uses_weighted_factor_scorer(self):
        engine = RiskEngine()
        assert isinstance(engine._scorer, WeightedFactorScorer)
