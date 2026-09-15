from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field

RiskLevel = Literal["critical", "high", "medium", "low", "unknown"]


class RiskFactor(BaseModel):
    name: str
    label: str
    normalized_value: float
    weighted_contribution: float
    weight: float
    is_primary_driver: bool = False


class RiskScore(BaseModel):
    equipment_id: str
    score: float
    level: RiskLevel
    factors: list[RiskFactor] = []
    outage_probability: float
    estimated_customers_affected: int
    scored_at: datetime


class RiskTrendPoint(BaseModel):
    date: str
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int


# ---------------------------------------------------------------------------
# Risk Intelligence Engine — input / output models
# ---------------------------------------------------------------------------

class RiskInput(BaseModel):
    """
    Flat, normalised input for the Risk Intelligence Engine.

    All fields are optional so the engine can handle partial / missing data
    gracefully using safe defaults.  Callers should provide as many fields
    as are available.
    """

    equipment_id: str = Field(..., description="Unique asset identifier")

    # Sensor readings
    temperature_c: float | None = Field(
        None, ge=-20.0, le=200.0,
        description="Operating temperature in °C",
    )
    load_pct: float | None = Field(
        None, ge=0.0, le=100.0,
        description="Load as a percentage of rated capacity",
    )
    vibration_mms: float | None = Field(
        None, ge=0.0, le=50.0,
        description="Vibration level in mm/s",
    )

    # Asset attributes
    age_years: int | None = Field(
        None, ge=0, le=60,
        description="Equipment age in full years",
    )

    # Maintenance & history
    days_since_maintenance: int | None = Field(
        None, ge=0,
        description="Calendar days since last recorded maintenance",
    )
    previous_failures: int | None = Field(
        None, ge=0,
        description="Number of failures recorded in the last 2 years",
    )

    # Environmental / weather
    weather_condition: str | None = Field(
        None,
        description="Current weather condition label (normal, extreme_heat, storm, high_wind)",
    )

    # Optional extras used when building full RiskScore from equipment records
    customers_affected: int = Field(
        0, ge=0,
        description="Number of customers served (for impact estimate)",
    )


class FactorScore(BaseModel):
    """Contribution of a single factor to the overall risk score."""

    factor: str = Field(..., description="Machine-readable factor key")
    label: str = Field(..., description="Human-readable factor name")
    raw_value: float | None = Field(None, description="Original input value (before normalisation)")
    normalized_value: float = Field(..., ge=0.0, le=1.0, description="Normalised 0–1 score")
    weight: float = Field(..., description="Factor weight in the weighted sum")
    score_contribution: float = Field(..., description="Absolute points contributed to risk_score (0–100 scale)")
    pct_of_total: float = Field(..., description="Percentage of total risk attributable to this factor")
    is_primary_driver: bool = False


class RiskOutput(BaseModel):
    """
    Full output of the Risk Intelligence Engine for a single equipment record.

    NOTE: This model is intentionally decoupled from any specific scoring
    implementation so that the weighted-factor scorer can be replaced by a
    machine-learning model without changing the API contract.
    """

    equipment_id: str
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Composite risk score 0–100")
    risk_level: RiskLevel
    contributing_factors: list[str] = Field(
        default_factory=list,
        description="Human-readable sentences explaining why the score is what it is",
    )
    factor_scores: list[FactorScore] = Field(
        default_factory=list,
        description="Per-factor breakdown used to reconstruct or audit the score",
    )
    recommended_actions: list[str] = Field(
        default_factory=list,
        description="Ordered list of recommended actions (highest priority first)",
    )
    scored_at: datetime
