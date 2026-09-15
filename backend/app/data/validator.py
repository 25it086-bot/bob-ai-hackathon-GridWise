"""
GridWise Data Validator
=======================
Validates raw JSON records loaded from disk before they enter the store.
Returns structured ValidationResult objects — never silently swallows errors.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from ..schemas.equipment import EquipmentRecord, EquipmentReading, MaintenanceRecord, FailureEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class FieldError:
    record_index: int
    record_id:    str
    field:        str
    message:      str


@dataclass
class ValidationResult:
    entity:     str
    total:      int
    passed:     int
    errors:     list[FieldError] = field(default_factory=list)

    @property
    def failed(self) -> int:
        return self.total - self.passed

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        return (
            f"[{self.entity}] {self.passed}/{self.total} valid"
            + (f"  |  {self.failed} invalid" if self.failed else "")
        )


# ---------------------------------------------------------------------------
# Individual record validators
# ---------------------------------------------------------------------------

def _validate_records(
    records: list[dict],
    model: type,
    entity: str,
    id_field: str = "id",
) -> tuple[list[dict], ValidationResult]:
    """
    Validate a list of raw dicts against a Pydantic model.
    Returns (valid_records, result).
    Invalid records are excluded from valid_records and logged.
    """
    valid:   list[dict] = []
    errors:  list[FieldError] = []

    for idx, raw in enumerate(records):
        rid = raw.get(id_field, f"<index {idx}>")
        try:
            model.model_validate(raw)
            valid.append(raw)
        except ValidationError as exc:
            for e in exc.errors():
                loc   = ".".join(str(x) for x in e["loc"])
                msg   = e["msg"]
                errors.append(FieldError(
                    record_index=idx,
                    record_id=str(rid),
                    field=loc,
                    message=msg,
                ))
                logger.debug(
                    "Validation error in %s[%s].%s: %s",
                    entity, rid, loc, msg,
                )

    result = ValidationResult(
        entity=entity,
        total=len(records),
        passed=len(valid),
        errors=errors,
    )

    if errors:
        logger.warning(
            "%s: %d/%d records failed validation — excluded from store",
            entity, result.failed, result.total,
        )
    else:
        logger.debug("%s: all %d records valid", entity, result.total)

    return valid, result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_equipment(records: list[dict]) -> tuple[list[dict], ValidationResult]:
    return _validate_records(records, EquipmentRecord, "equipment")


def validate_readings(records: list[dict]) -> tuple[list[dict], ValidationResult]:
    return _validate_records(records, EquipmentReading, "readings")


def validate_maintenance(records: list[dict]) -> tuple[list[dict], ValidationResult]:
    return _validate_records(records, MaintenanceRecord, "maintenance")


def validate_failures(records: list[dict]) -> tuple[list[dict], ValidationResult]:
    return _validate_records(records, FailureEvent, "failures")


def validate_all(
    equipment: list[dict],
    readings:  list[dict],
    maintenance: list[dict],
    failures:  list[dict],
) -> dict[str, ValidationResult]:
    """Validate all four entity types and return a results dict."""
    eq_ok,  eq_res  = validate_equipment(equipment)
    rd_ok,  rd_res  = validate_readings(readings)
    mt_ok,  mt_res  = validate_maintenance(maintenance)
    fl_ok,  fl_res  = validate_failures(failures)

    # Replace originals with cleaned lists in-place (caller should use returned dicts)
    results = {
        "equipment":   eq_res,
        "readings":    rd_res,
        "maintenance": mt_res,
        "failures":    fl_res,
    }

    for name, res in results.items():
        if res.ok:
            logger.info("  ✓  %-12s  %d records", name, res.total)
        else:
            logger.warning("  ✗  %-12s  %d/%d valid", name, res.passed, res.total)

    return results


def validate_and_filter(
    equipment: list[dict],
    readings:  list[dict],
    maintenance: list[dict],
    failures:  list[dict],
) -> tuple[list[dict], list[dict], list[dict], list[dict], dict[str, ValidationResult]]:
    """
    Validate all records and return ONLY the valid ones together with results.
    Invalid records are excluded — the store receives clean data.
    """
    eq_valid,  eq_res  = validate_equipment(equipment)
    rd_valid,  rd_res  = validate_readings(readings)
    mt_valid,  mt_res  = validate_maintenance(maintenance)
    fl_valid,  fl_res  = validate_failures(failures)

    results = {
        "equipment":   eq_res,
        "readings":    rd_res,
        "maintenance": mt_res,
        "failures":    fl_res,
    }
    return eq_valid, rd_valid, mt_valid, fl_valid, results
