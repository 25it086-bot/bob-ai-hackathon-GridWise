"""
Outage risk schemas.

IMPORTANT: These are prototype estimates based on simulated data.
They do not represent real-world operational guarantees.
"""
from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

OutageRiskLevel = Literal["critical", "high", "medium", "low", "minimal"]

DISCLAIMER = (
    "Prototype estimate based on simulated grid data. "
    "Not a real-world operational guarantee. "
    "For demonstration purposes only."
)


# ── Sub-models ────────────────────────────────────────────────────────────────

class ContributingEquipment(BaseModel):
    """An equipment unit that contributes materially to zone outage risk."""
    equipment_id:         str
    equipment_name:       str
    equipment_type:       str
    substation_name:      str
    equipment_risk_score: float = Field(..., description="Equipment failure risk 0-100")
    equipment_risk_level: str
    outage_contribution:  float = Field(..., description="This unit's individual outage probability 0-1")
    customers_at_risk:    int   = Field(..., description="Expected customers affected if this unit fails")
    primary_risk_factor:  str   = Field(..., description="The dominant factor driving this unit's risk")


class KeyRiskFactor(BaseModel):
    """A high-level risk factor that drives zone outage risk."""
    factor_name:   str
    factor_label:  str
    severity:      str   = Field(..., description="critical | high | medium | low")
    description:   str
    affected_units:int   = Field(..., description="Number of equipment units where this factor is primary")


class EstimatedImpact(BaseModel):
    """Consequence estimate for a potential outage scenario."""
    expected_customers_affected: int   = Field(..., description="Expected-value customers: sum of P_i * customers_i")
    worst_case_customers:        int   = Field(..., description="All customers in zone if full zone outage occurs")
    expected_downtime_hours:     float = Field(..., description="Historical average downtime for similar equipment types")
    economic_impact_tier:        str   = Field(..., description="high | medium | low — relative economic severity tier")
    restoration_complexity:      str   = Field(..., description="complex | moderate | straightforward")


class OutageScenario(BaseModel):
    """
    Outage risk assessment for a single grid zone.

    Separation of concerns:
      - equipment_risk_score  : individual equipment failure probability (equipment layer)
      - outage_risk_score     : zone-level outage probability (outage layer)

    The outage_risk_score is NOT the average equipment score.
    It is computed from the independent-failure zone probability model.
    """
    zone_id:                     str
    zone_name:                   str
    outage_risk_score:           float = Field(..., ge=0, le=100, description="Zone outage risk 0-100")
    risk_level:                  OutageRiskLevel
    outage_probability:          float = Field(..., ge=0, le=1,   description="Zone outage probability 0-1")
    affected_zone:               str   = Field(..., description="Human-readable zone description")
    potentially_affected_customers: int
    total_zone_customers:        int
    estimated_impact:            EstimatedImpact
    contributing_equipment:      list[ContributingEquipment]
    key_risk_factors:            list[KeyRiskFactor]
    total_equipment_in_zone:     int
    critical_equipment_count:    int
    high_risk_equipment_count:   int
    avg_equipment_risk_score:    float
    assessed_at:                 datetime
    disclaimer:                  str   = DISCLAIMER


# ── Outage Risk Engine typed inputs ──────────────────────────────────────────

class EquipmentContext(BaseModel):
    """
    Equipment asset context passed to the OutageRiskEngine.

    Carries the static/operational attributes needed for outage impact
    estimation that are not present on the RiskOutput itself.
    """

    equipment_id:       str   = Field(..., description="Must match RiskOutput.equipment_id")
    equipment_name:     str
    equipment_type:     str   = Field(..., description="transformer | substation | feeder | switchgear")
    substation_name:    str   = ""
    zone_id:            str
    customers_affected: int   = Field(0, ge=0)


class ZoneContext(BaseModel):
    """
    Zone-level context passed to the OutageRiskEngine.

    Carries geographic and customer data that are separate from equipment
    risk and used only in outage consequence estimation.
    """

    zone_id:          str
    zone_name:        str
    region:           str   = ""
    total_customers:  int   = Field(0, ge=0)
    redundancy_level: str   = Field(
        "none",
        description=(
            "Grid redundancy for this zone: "
            "'none' (any failure → outage), "
            "'partial' (moderate mitigation), "
            "'full' (strong mitigation). "
            "Affects the zone outage probability scaling."
        ),
    )


class OutageInput(BaseModel):
    """
    Typed input bundle for the OutageRiskEngine.

    Contains all information needed to compute a zone OutageScenario from
    pre-computed equipment RiskOutputs.  Keeping this separate from the
    RiskOutput models enforces the architectural boundary between the
    equipment-failure layer and the outage-risk layer.
    """

    zone:       ZoneContext
    equipment:  list[EquipmentContext]  = Field(default_factory=list)


class OutageSummary(BaseModel):
    """Lightweight outage summary for a zone — used in list views."""
    zone_id:                str
    zone_name:              str
    outage_risk_score:      float
    risk_level:             OutageRiskLevel
    outage_probability:     float
    potentially_affected_customers: int
    total_zone_customers:   int
    critical_equipment:     int
    high_risk_equipment:    int
    primary_risk_driver:    str


class OutageFleetSummary(BaseModel):
    """Fleet-wide outage risk summary."""
    total_zones_assessed:        int
    critical_outage_zones:       int
    high_outage_zones:           int
    total_customers_at_risk:     int
    total_fleet_customers:       int
    highest_risk_zone:           str
    highest_risk_score:          float
    fleet_outage_probability:    float = Field(..., description="P(at least one zone outage) across the fleet")
    assessed_at:                 datetime
    disclaimer:                  str   = DISCLAIMER
