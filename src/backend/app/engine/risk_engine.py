"""
GridWise Risk Intelligence Engine
==================================
Calculates an *explainable* equipment failure risk score (0–100).

Architecture
------------
The public entry-point is ``score(input: RiskInput) -> RiskOutput``.
All scoring logic is delegated to a ``ScoringStrategy`` — a plain callable
with the signature ``(RiskInput) -> _RawScores`` — so the weighted-factor
implementation below can be swapped for a machine-learning model without
touching the rest of the pipeline.

Disclaimer
----------
This is a heuristic, rule-based model for demonstration purposes.
It is **not** a scientifically validated real-world failure-prediction model.
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Protocol

from ..schemas.risk import FactorScore, RiskInput, RiskLevel, RiskOutput

# ---------------------------------------------------------------------------
# Risk level thresholds (match settings defaults; kept local so the engine
# can be tested without the full FastAPI settings stack)
# ---------------------------------------------------------------------------
LEVEL_THRESHOLDS: dict[str, float] = {
    "critical": 75.0,
    "high":     50.0,
    "medium":   25.0,
}


def _level_from_score(score: float) -> RiskLevel:
    if score >= LEVEL_THRESHOLDS["critical"]:
        return "critical"
    if score >= LEVEL_THRESHOLDS["high"]:
        return "high"
    if score >= LEVEL_THRESHOLDS["medium"]:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Factor definitions — weights, labels, safe defaults for missing values
# ---------------------------------------------------------------------------

# Weights must sum to 1.0
_FACTOR_WEIGHTS: dict[str, float] = {
    "temperature":        0.20,
    "load":               0.25,
    "vibration":          0.04,
    "age":                0.18,
    "maintenance":        0.15,
    "previous_failures":  0.12,
    "weather":            0.06,
}
assert abs(sum(_FACTOR_WEIGHTS.values()) - 1.0) < 1e-9, "Factor weights must sum to 1.0"

_FACTOR_LABELS: dict[str, str] = {
    "temperature":       "Thermal Stress",
    "load":              "Load Stress",
    "vibration":         "Vibration Level",
    "age":               "Equipment Age",
    "maintenance":       "Maintenance Gap",
    "previous_failures": "Failure History",
    "weather":           "Weather / Environmental",
}

# Safe defaults used when a field is None (conservative mid-range values)
_SAFE_DEFAULTS: dict[str, float] = {
    "temperature":       40.0,   # °C — mild
    "load":              50.0,   # % — moderate
    "vibration":          1.0,   # mm/s — low
    "age":                5,     # years — relatively new
    "maintenance":       90,     # days — recently maintained
    "previous_failures":  0,     # no recent failures
    "weather":            0.0,   # numeric weather penalty
}

# Weather condition → bonus risk penalty on [0, 1] scale
_WEATHER_PENALTIES: dict[str, float] = {
    "normal":       0.00,
    "high_wind":    0.30,
    "storm":        0.65,
    "extreme_heat": 0.50,
}


# ---------------------------------------------------------------------------
# Normalisation helpers — map raw values to [0, 1]
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _norm_temperature(temp_c: float) -> float:
    """Sigmoid centred at 50 °C; approaches 1 near 100 °C+."""
    return _sigmoid((temp_c - 50) / 20)


def _norm_load(load_pct: float) -> float:
    """Linear: 100 % load → 1.0."""
    return max(0.0, min(load_pct / 100.0, 1.0))


def _norm_vibration(vib_mms: float) -> float:
    """Linear: 10 mm/s → 1.0 (capped)."""
    return max(0.0, min(vib_mms / 10.0, 1.0))


def _norm_age(age_years: int) -> float:
    """Linear: 30-year lifespan → 1.0 (capped)."""
    return max(0.0, min(age_years / 30.0, 1.0))


def _norm_maintenance(days: int) -> float:
    """Linear: 365 days without maintenance → 1.0 (capped)."""
    return max(0.0, min(days / 365.0, 1.0))


def _norm_failures(count: int) -> float:
    """Each failure adds 0.2; capped at 1.0 (5+ failures)."""
    return max(0.0, min(count * 0.2, 1.0))


def _norm_weather(condition: str | None) -> float:
    if condition is None:
        return 0.0
    return _WEATHER_PENALTIES.get(condition.lower().strip(), 0.0)


# ---------------------------------------------------------------------------
# Internal raw-score container
# ---------------------------------------------------------------------------

class _RawScores:
    """Holds per-factor (raw_value, normalized_value) pairs."""

    def __init__(self, items: dict[str, tuple[float | None, float]]) -> None:
        # items: {factor_key: (raw_value, normalized_0_to_1)}
        self._items = items

    def __iter__(self):
        return iter(self._items.items())

    def normalized(self, key: str) -> float:
        return self._items[key][1]

    def raw(self, key: str) -> float | None:
        return self._items[key][0]


# ---------------------------------------------------------------------------
# Scoring strategy protocol — swap this for an ML model
# ---------------------------------------------------------------------------

class ScoringStrategy(Protocol):
    """
    Any callable that accepts a ``RiskInput`` and returns ``_RawScores``
    satisfies this protocol.

    To replace the weighted-factor heuristic with a machine-learning model,
    implement a class or function with this signature and pass it to
    ``RiskEngine``.
    """

    def __call__(self, inp: RiskInput) -> _RawScores: ...


# ---------------------------------------------------------------------------
# Default heuristic scoring strategy
# ---------------------------------------------------------------------------

class WeightedFactorScorer:
    """
    Heuristic weighted-factor scorer.

    Each input field is normalised to [0, 1]; missing values fall back to
    conservative safe defaults.  The weighted sum × 100 is the risk score.
    """

    def __call__(self, inp: RiskInput) -> _RawScores:
        temp   = inp.temperature_c      if inp.temperature_c      is not None else _SAFE_DEFAULTS["temperature"]
        load   = inp.load_pct           if inp.load_pct           is not None else _SAFE_DEFAULTS["load"]
        vib    = inp.vibration_mms      if inp.vibration_mms      is not None else _SAFE_DEFAULTS["vibration"]
        age    = inp.age_years          if inp.age_years           is not None else _SAFE_DEFAULTS["age"]
        maint  = inp.days_since_maintenance if inp.days_since_maintenance is not None else _SAFE_DEFAULTS["maintenance"]
        fails  = inp.previous_failures  if inp.previous_failures  is not None else _SAFE_DEFAULTS["previous_failures"]
        wx_str = inp.weather_condition

        return _RawScores({
            "temperature":       (inp.temperature_c,           _norm_temperature(temp)),
            "load":              (inp.load_pct,                _norm_load(load)),
            "vibration":         (inp.vibration_mms,           _norm_vibration(vib)),
            "age":               (inp.age_years,               _norm_age(int(age))),
            "maintenance":       (inp.days_since_maintenance,  _norm_maintenance(int(maint))),
            "previous_failures": (inp.previous_failures,       _norm_failures(int(fails))),
            "weather":           (inp.weather_condition,       _norm_weather(wx_str)),
        })


# ---------------------------------------------------------------------------
# Explanation builder
# ---------------------------------------------------------------------------

def _build_explanation(
    factor_key: str,
    label: str,
    nval: float,
    raw: float | str | None,
) -> str | None:
    """
    Return a plain-English sentence for a factor if its normalised value
    exceeds a threshold worth mentioning.  Returns None for low-risk factors.

    ``raw`` may be a float, an int, a string category (for weather), or None.
    Each branch is evaluated lazily to avoid format-type errors.
    """
    if nval < 0.25:
        return None

    pct = f"{nval * 100:.0f}"

    if factor_key == "temperature":
        val_str = f"{float(raw):.1f}°C" if raw is not None else "elevated"
        return f"Temperature is {val_str} (thermal stress: {pct}/100)."

    if factor_key == "load":
        val_str = f"{float(raw):.0f}%" if raw is not None else "high levels"
        return f"Load is at {val_str} of rated capacity (load stress: {pct}/100)."

    if factor_key == "vibration":
        val_str = f"{float(raw):.1f} mm/s" if raw is not None else "elevated"
        return f"Vibration is {val_str} (vibration index: {pct}/100)."

    if factor_key == "age":
        val_str = f"{int(float(raw))} years old" if raw is not None else "ageing"
        return f"Equipment is {val_str} (age factor: {pct}/100)."

    if factor_key == "maintenance":
        val_str = f"{int(float(raw))} days ago" if raw is not None else "overdue"
        return f"Last maintenance was {val_str} (maintenance gap: {pct}/100)."

    if factor_key == "previous_failures":
        val_str = f"{int(float(raw))} failure(s)" if raw is not None else "Multiple failures"
        return f"{val_str} recorded in the past 2 years (failure history: {pct}/100)."

    if factor_key == "weather":
        val_str = f'"{raw}"' if raw is not None else "adverse"
        return f"Current weather condition is {val_str} (weather penalty: {pct}/100)."

    return None


# ---------------------------------------------------------------------------
# Recommended actions
# ---------------------------------------------------------------------------

def _build_actions(inp: RiskInput, level: RiskLevel, raw_scores: _RawScores) -> list[str]:
    actions: list[str] = []

    load   = inp.load_pct           if inp.load_pct           is not None else 0.0
    temp   = inp.temperature_c      if inp.temperature_c      is not None else 0.0
    maint  = inp.days_since_maintenance if inp.days_since_maintenance is not None else 0
    age    = inp.age_years          if inp.age_years           is not None else 0
    fails  = inp.previous_failures  if inp.previous_failures  is not None else 0
    vib    = inp.vibration_mms      if inp.vibration_mms      is not None else 0.0

    if level == "critical":
        actions.append("Dispatch field crew for emergency inspection within 24 hours.")

    if load > 85:
        actions.append(f"Reduce load immediately — currently at {load:.0f}% of rated capacity.")
    elif load > 70 and level in ("high", "critical"):
        actions.append(f"Consider load shedding — load at {load:.0f}%.")

    if temp > 90:
        actions.append(f"Investigate thermal condition — temperature at {temp:.1f}°C exceeds safe threshold (75°C).")
    elif temp > 75 and level in ("high", "critical"):
        actions.append(f"Monitor cooling system — temperature at {temp:.1f}°C is above recommended limit.")

    if maint > 365:
        actions.append(f"Perform overdue maintenance immediately — last service was {maint} days ago.")
    elif maint > 180 and level in ("medium", "high", "critical"):
        actions.append(f"Schedule maintenance within 7 days — {maint} days since last service.")

    if age > 25:
        actions.append(f"Conduct end-of-life assessment — unit is {age} years old.")

    if fails >= 3:
        actions.append(f"Review root cause of {fails} failures in the past 2 years; consider replacement.")
    elif fails >= 1 and level in ("high", "critical"):
        actions.append(f"Investigate recurring failure patterns ({fails} in 2 years).")

    if vib > 7.0:
        actions.append(f"Inspect for mechanical loosening — vibration at {vib:.1f} mm/s.")
    elif vib > 4.0 and level in ("high", "critical"):
        actions.append(f"Monitor vibration closely — reading of {vib:.1f} mm/s is above normal.")

    wx = inp.weather_condition or "normal"
    if wx == "storm":
        actions.append("Activate storm-response protocol; check structural integrity post-event.")
    elif wx == "extreme_heat":
        actions.append("Apply heat-management procedures; increase monitoring frequency.")
    elif wx == "high_wind":
        actions.append("Inspect for wind-induced mechanical stress after event.")

    if level in ("high", "critical") and not actions:
        actions.append("Increase sensor polling frequency and review alert thresholds.")

    if level == "medium":
        actions.append("Schedule routine inspection within 30 days.")

    if level == "low":
        actions.append("Continue standard monitoring schedule — no immediate action required.")

    return actions


# ---------------------------------------------------------------------------
# Risk Intelligence Engine
# ---------------------------------------------------------------------------

class RiskEngine:
    """
    Orchestrates input validation, scoring, explanation, and recommendations.

    Pass a custom ``ScoringStrategy`` to replace the heuristic scorer with
    an ML model::

        engine = RiskEngine(scorer=MyMLScorer())
        result = engine.score(inp)
    """

    def __init__(self, scorer: ScoringStrategy | None = None) -> None:
        self._scorer: ScoringStrategy = scorer or WeightedFactorScorer()

    def score(self, inp: RiskInput) -> RiskOutput:
        raw_scores = self._scorer(inp)

        # Weighted sum → 0–100
        weighted_sum = sum(
            raw_scores.normalized(k) * _FACTOR_WEIGHTS[k]
            for k in _FACTOR_WEIGHTS
        )
        risk_score = round(min(weighted_sum * 100.0, 100.0), 1)
        level = _level_from_score(risk_score)

        # Build factor_scores
        factor_scores: list[FactorScore] = []
        for key, weight in _FACTOR_WEIGHTS.items():
            nval = raw_scores.normalized(key)
            contribution = nval * weight * 100.0
            pct = (contribution / risk_score * 100.0) if risk_score > 0 else 0.0
            factor_scores.append(FactorScore(
                factor=key,
                label=_FACTOR_LABELS[key],
                raw_value=raw_scores.raw(key) if not isinstance(raw_scores.raw(key), str) else None,
                normalized_value=round(nval, 4),
                weight=weight,
                score_contribution=round(contribution, 2),
                pct_of_total=round(pct, 1),
            ))

        factor_scores.sort(key=lambda f: f.score_contribution, reverse=True)
        if factor_scores:
            factor_scores[0].is_primary_driver = True

        # Build contributing_factors (human-readable explanations).
        # Pass the original raw value from _RawScores (may be str for weather).
        contributing_factors: list[str] = []
        for fs in factor_scores:
            sentence = _build_explanation(
                fs.factor, fs.label, fs.normalized_value, raw_scores.raw(fs.factor)
            )
            if sentence:
                contributing_factors.append(sentence)

        recommended_actions = _build_actions(inp, level, raw_scores)

        return RiskOutput(
            equipment_id=inp.equipment_id,
            risk_score=risk_score,
            risk_level=level,
            contributing_factors=contributing_factors,
            factor_scores=factor_scores,
            recommended_actions=recommended_actions,
            scored_at=datetime.now(timezone.utc),
        )


# ---------------------------------------------------------------------------
# Module-level convenience function (uses default WeightedFactorScorer)
# ---------------------------------------------------------------------------

_default_engine = RiskEngine()


def score(inp: RiskInput) -> RiskOutput:
    """
    Score a single equipment record using the default heuristic engine.

    For custom scorers use ``RiskEngine(scorer=...).score(inp)`` directly.
    """
    return _default_engine.score(inp)
