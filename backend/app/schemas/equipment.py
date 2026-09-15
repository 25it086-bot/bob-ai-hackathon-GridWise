from __future__ import annotations
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


EquipmentType   = Literal["transformer", "substation", "feeder", "switchgear"]
EquipmentStatus = Literal["operational", "degraded", "critical", "offline", "maintenance"]
WeatherCondition= Literal["normal", "extreme_heat", "storm", "high_wind"]
MaintenanceType = Literal["routine", "inspection", "repair", "emergency"]
FailureSeverity = Literal["critical", "high", "medium", "low"]


# ---------------------------------------------------------------------------
# Equipment (static asset record)
# ---------------------------------------------------------------------------

class EquipmentRecord(BaseModel):
    """Canonical equipment asset record — used by the data service."""

    id:                   str             = Field(..., min_length=3, max_length=20)
    name:                 str             = Field(..., min_length=3, max_length=120)
    type:                 EquipmentType
    substation_id:        str             = Field(..., min_length=3, max_length=20)
    substation_name:      str             = Field(..., min_length=3, max_length=120)
    zone_id:              str             = Field(..., min_length=2, max_length=10)
    zone_name:            str             = Field(..., min_length=3, max_length=80)
    age_years:            int             = Field(..., ge=0, le=60)
    status:               EquipmentStatus
    customers_affected:   int             = Field(..., ge=0, le=500_000)
    manufacturer:         str | None      = Field(None, max_length=80)
    model:                str | None      = Field(None, max_length=80)
    nominal_voltage_kv:   float | None    = Field(None, gt=0, le=1000)
    latitude:             float | None    = Field(None, ge=-90,  le=90)
    longitude:            float | None    = Field(None, ge=-180, le=180)
    installed_at:         date | None     = None
    last_inspected_at:    date | None     = None
    maintenance_days_ago: int             = Field(..., ge=0, le=9999)
    previous_failures_2yr:int            = Field(..., ge=0, le=50)

    @field_validator("age_years")
    @classmethod
    def age_must_be_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("age_years must be >= 0")
        return v

    @field_validator("maintenance_days_ago")
    @classmethod
    def maintenance_gap_not_before_install(cls, v: int) -> int:
        if v > 9999:
            raise ValueError("maintenance_days_ago cannot exceed 9999 (no-record sentinel)")
        return v

    @model_validator(mode="after")
    def inspect_date_not_before_install(self) -> "EquipmentRecord":
        if self.installed_at and self.last_inspected_at:
            if self.last_inspected_at < self.installed_at:
                raise ValueError(
                    f"last_inspected_at ({self.last_inspected_at}) "
                    f"cannot be before installed_at ({self.installed_at})"
                )
        return self


# ---------------------------------------------------------------------------
# Equipment reading (sensor snapshot)
# ---------------------------------------------------------------------------

class EquipmentReading(BaseModel):
    """A single sensor snapshot for one equipment unit."""

    id:                     str             = Field(..., min_length=3)
    equipment_id:           str             = Field(..., min_length=3, max_length=20)
    recorded_at:            datetime
    temperature_c:          float           = Field(..., ge=  -20.0, le=  200.0)
    load_pct:               float           = Field(..., ge=    0.0, le=  100.0)
    voltage_kv:             float           = Field(..., ge=    0.1, le= 1500.0)
    voltage_deviation_pct:  float           = Field(..., ge= -100.0, le=  100.0)
    vibration_mms:          float           = Field(..., ge=    0.0, le=   50.0)
    humidity_pct:           float           = Field(..., ge=    0.0, le=  100.0)
    weather_condition:      WeatherCondition
    # Denormalized operational context fields
    maintenance_days_ago:   int             = Field(..., ge=0, le=9999)
    previous_failures_2yr:  int             = Field(..., ge=0, le=50)
    customer_count:         int             = Field(..., ge=0, le=500_000)
    equipment_status:       EquipmentStatus

    @field_validator("temperature_c")
    @classmethod
    def temperature_physically_sane(cls, v: float) -> float:
        if v > 150:
            raise ValueError(
                f"temperature_c={v} exceeds 150°C — physically unrealistic for grid equipment"
            )
        return v

    @field_validator("load_pct")
    @classmethod
    def load_in_range(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError(f"load_pct={v} must be 0–100")
        return round(v, 2)

    @field_validator("voltage_deviation_pct")
    @classmethod
    def voltage_deviation_sane(cls, v: float) -> float:
        if abs(v) > 25:
            raise ValueError(
                f"voltage_deviation_pct={v} exceeds ±25% — likely a data error"
            )
        return round(v, 3)


# ---------------------------------------------------------------------------
# Backward-compatible aliases used by routers (minimal fields)
# ---------------------------------------------------------------------------

class EquipmentBase(BaseModel):
    id:                 str
    name:               str
    type:               EquipmentType
    zone_id:            str
    age_years:          int
    status:             EquipmentStatus
    customers_affected: int
    manufacturer:       str | None      = None
    model:              str | None      = None
    nominal_voltage_kv: float | None    = None
    latitude:           float | None    = None
    longitude:          float | None    = None
    installed_at:       date | None     = None
    last_inspected_at:  date | None     = None
    # New fields (optional so old code doesn't break)
    substation_id:      str | None      = None
    substation_name:    str | None      = None
    zone_name:          str | None      = None
    maintenance_days_ago:  int          = 0
    previous_failures_2yr: int          = 0


class EquipmentSummary(BaseModel):
    id:                   str
    name:                 str
    type:                 EquipmentType
    zone_id:              str
    zone_name:            str | None          = None
    substation_name:      str | None          = None
    age_years:            int
    status:               EquipmentStatus
    customers_affected:   int
    risk_score:           float | None        = None
    risk_level:           str | None          = None
    load_pct:             float | None        = None
    temperature_c:        float | None        = None
    vibration_mms:        float | None        = None
    days_since_maintenance: int | None        = None
    previous_failures_2yr:  int               = 0


class MaintenanceRecord(BaseModel):
    id:               str
    equipment_id:     str
    maintenance_date: date
    maintenance_type: MaintenanceType
    technician:       str
    notes:            str
    issue_found:      bool
    duration_hours:   float | None = None

    @field_validator("maintenance_type", mode="before")
    @classmethod
    def coerce_maintenance_type(cls, v: str) -> str:
        # Tolerate legacy values from old generator
        mapping = {"preventive": "routine", "corrective": "repair"}
        return mapping.get(v, v)


class FailureEvent(BaseModel):
    id:                 str
    equipment_id:       str
    occurred_at:        datetime
    severity:           FailureSeverity
    cause:              str
    downtime_hours:     float           = Field(..., ge=0, le=8760)
    customers_affected: int             = Field(..., ge=0)
    resolved_at:        datetime | None = None

    @field_validator("severity", mode="before")
    @classmethod
    def normalise_severity(cls, v: str) -> str:
        return v.lower().strip()


class EquipmentDetail(EquipmentBase):
    current_reading:     EquipmentReading | None  = None
    maintenance_records: list[MaintenanceRecord]  = []
    failure_events:      list[FailureEvent]        = []
