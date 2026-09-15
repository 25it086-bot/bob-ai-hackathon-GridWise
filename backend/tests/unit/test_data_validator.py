"""
Tests for the GridWise data validator.
"""
import pytest
from app.data.validator import (
    validate_equipment,
    validate_readings,
    validate_maintenance,
    validate_failures,
    validate_and_filter,
    FieldError,
    ValidationResult,
)


# ---------------------------------------------------------------------------
# Good records
# ---------------------------------------------------------------------------

GOOD_EQUIPMENT = {
    "id":                    "TF-001",
    "name":                  "North Alpha Primary — Transformer 1",
    "type":                  "transformer",
    "substation_id":         "SUB-Z3-A",
    "substation_name":       "North Alpha Primary",
    "zone_id":               "Z3",
    "zone_name":             "Zone 3 - Northern",
    "age_years":             28,
    "status":                "degraded",
    "customers_affected":    4200,
    "nominal_voltage_kv":    132.0,
    "latitude":              40.8205,
    "longitude":            -73.9198,
    "installed_at":          "1995-06-12",
    "last_inspected_at":     "2022-11-04",
    "maintenance_days_ago":  437,
    "previous_failures_2yr": 3,
}

GOOD_READING = {
    "id":                    "R-TF-001-0000",
    "equipment_id":          "TF-001",
    "recorded_at":           "2024-01-15T14:32:00",
    "temperature_c":         97.4,
    "load_pct":              96.8,
    "voltage_kv":            145.2,
    "voltage_deviation_pct": 10.0,
    "vibration_mms":         8.7,
    "humidity_pct":          72.0,
    "weather_condition":     "extreme_heat",
    "maintenance_days_ago":  437,
    "previous_failures_2yr": 3,
    "customer_count":        4200,
    "equipment_status":      "degraded",
}

GOOD_MAINTENANCE = {
    "id":               "M-TF-001-01",
    "equipment_id":     "TF-001",
    "maintenance_date": "2022-11-04",
    "maintenance_type": "inspection",
    "technician":       "Marcus Webb",
    "notes":            "Detailed internal inspection. Corrosion found on terminal board.",
    "issue_found":      True,
    "duration_hours":   6.5,
}

GOOD_FAILURE = {
    "id":                  "F-TF-001-01",
    "equipment_id":        "TF-001",
    "occurred_at":         "2022-06-10T03:17:00",
    "severity":            "high",
    "cause":               "Insulation breakdown due to prolonged thermal overload",
    "downtime_hours":      6.0,
    "customers_affected":  4200,
    "resolved_at":         "2022-06-10T09:20:00",
}


# ---------------------------------------------------------------------------
# Equipment validation
# ---------------------------------------------------------------------------

class TestEquipmentValidation:
    def test_valid_record_passes(self):
        valid, result = validate_equipment([GOOD_EQUIPMENT])
        assert result.passed == 1
        assert result.failed == 0
        assert len(valid) == 1

    def test_invalid_type_rejected(self):
        bad = {**GOOD_EQUIPMENT, "type": "nuclear_reactor"}
        valid, result = validate_equipment([bad])
        assert result.failed == 1
        assert len(valid) == 0

    def test_negative_age_rejected(self):
        bad = {**GOOD_EQUIPMENT, "age_years": -5}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_age_over_60_rejected(self):
        bad = {**GOOD_EQUIPMENT, "age_years": 61}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_negative_customers_rejected(self):
        bad = {**GOOD_EQUIPMENT, "customers_affected": -1}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_invalid_status_rejected(self):
        bad = {**GOOD_EQUIPMENT, "status": "unknown_state"}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_empty_id_rejected(self):
        bad = {**GOOD_EQUIPMENT, "id": ""}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_missing_required_field_rejected(self):
        bad = {k: v for k, v in GOOD_EQUIPMENT.items() if k != "zone_id"}
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_last_inspected_before_install_rejected(self):
        bad = {
            **GOOD_EQUIPMENT,
            "installed_at":      "2020-01-01",
            "last_inspected_at": "2019-12-31",  # before install
        }
        valid, result = validate_equipment([bad])
        assert result.failed == 1

    def test_multiple_records_mixed(self):
        bad = {**GOOD_EQUIPMENT, "age_years": -1}
        valid, result = validate_equipment([GOOD_EQUIPMENT, bad])
        assert result.passed == 1
        assert result.failed == 1
        assert len(valid) == 1

    def test_error_contains_field_name(self):
        bad = {**GOOD_EQUIPMENT, "type": "plasma_conduit"}
        _, result = validate_equipment([bad])
        assert any("type" in e.field for e in result.errors)

    def test_error_contains_record_id(self):
        bad = {**GOOD_EQUIPMENT, "age_years": -1}
        _, result = validate_equipment([bad])
        assert result.errors[0].record_id == "TF-001"


# ---------------------------------------------------------------------------
# Reading validation
# ---------------------------------------------------------------------------

class TestReadingValidation:
    def test_valid_reading_passes(self):
        valid, result = validate_readings([GOOD_READING])
        assert result.passed == 1

    def test_temperature_above_150_rejected(self):
        bad = {**GOOD_READING, "temperature_c": 155.0}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_temperature_below_minus20_rejected(self):
        bad = {**GOOD_READING, "temperature_c": -25.0}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_load_above_100_rejected(self):
        bad = {**GOOD_READING, "load_pct": 101.0}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_load_below_0_rejected(self):
        bad = {**GOOD_READING, "load_pct": -0.1}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_voltage_deviation_beyond_25pct_rejected(self):
        bad = {**GOOD_READING, "voltage_deviation_pct": 30.0}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_invalid_weather_rejected(self):
        bad = {**GOOD_READING, "weather_condition": "tornado"}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_invalid_equipment_status_rejected(self):
        bad = {**GOOD_READING, "equipment_status": "broken"}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_negative_humidity_rejected(self):
        bad = {**GOOD_READING, "humidity_pct": -1.0}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_humidity_above_100_rejected(self):
        bad = {**GOOD_READING, "humidity_pct": 100.1}
        valid, result = validate_readings([bad])
        assert result.failed == 1

    def test_zero_vibration_allowed(self):
        ok = {**GOOD_READING, "vibration_mms": 0.0}
        valid, result = validate_readings([ok])
        assert result.passed == 1

    def test_negative_vibration_rejected(self):
        bad = {**GOOD_READING, "vibration_mms": -0.1}
        valid, result = validate_readings([bad])
        assert result.failed == 1


# ---------------------------------------------------------------------------
# Maintenance validation
# ---------------------------------------------------------------------------

class TestMaintenanceValidation:
    def test_valid_record_passes(self):
        valid, result = validate_maintenance([GOOD_MAINTENANCE])
        assert result.passed == 1

    def test_invalid_maintenance_type_coerced(self):
        # "preventive" should be coerced to "routine" by the schema validator
        ok = {**GOOD_MAINTENANCE, "maintenance_type": "preventive"}
        valid, result = validate_maintenance([ok])
        assert result.passed == 1

    def test_unknown_maintenance_type_rejected(self):
        bad = {**GOOD_MAINTENANCE, "maintenance_type": "alien_probe"}
        _, result = validate_maintenance([bad])
        assert result.failed == 1


# ---------------------------------------------------------------------------
# Failure validation
# ---------------------------------------------------------------------------

class TestFailureValidation:
    def test_valid_record_passes(self):
        valid, result = validate_failures([GOOD_FAILURE])
        assert result.passed == 1

    def test_severity_case_insensitive(self):
        ok = {**GOOD_FAILURE, "severity": "HIGH"}
        valid, result = validate_failures([ok])
        assert result.passed == 1

    def test_invalid_severity_rejected(self):
        bad = {**GOOD_FAILURE, "severity": "catastrophic"}
        _, result = validate_failures([bad])
        assert result.failed == 1

    def test_negative_downtime_rejected(self):
        bad = {**GOOD_FAILURE, "downtime_hours": -1.0}
        _, result = validate_failures([bad])
        assert result.failed == 1

    def test_downtime_over_year_rejected(self):
        bad = {**GOOD_FAILURE, "downtime_hours": 9000.0}
        _, result = validate_failures([bad])
        assert result.failed == 1


# ---------------------------------------------------------------------------
# ValidationResult helpers
# ---------------------------------------------------------------------------

class TestValidationResult:
    def test_ok_true_when_no_errors(self):
        result = ValidationResult(entity="test", total=5, passed=5)
        assert result.ok is True

    def test_ok_false_when_errors_exist(self):
        result = ValidationResult(entity="test", total=5, passed=4,
                                  errors=[FieldError(0, "x", "f", "msg")])
        assert result.ok is False

    def test_failed_count(self):
        result = ValidationResult(entity="test", total=10, passed=7)
        assert result.failed == 3

    def test_summary_string(self):
        result = ValidationResult(entity="equipment", total=10, passed=9,
                                  errors=[FieldError(0, "x", "f", "msg")])
        s = result.summary()
        assert "9/10" in s
        assert "1 invalid" in s


# ---------------------------------------------------------------------------
# validate_and_filter integration
# ---------------------------------------------------------------------------

class TestValidateAndFilter:
    def test_clean_data_passes_all(self):
        eq_v, rd_v, mt_v, fl_v, results = validate_and_filter(
            [GOOD_EQUIPMENT], [GOOD_READING], [GOOD_MAINTENANCE], [GOOD_FAILURE]
        )
        assert len(eq_v) == 1
        assert len(rd_v) == 1
        assert len(mt_v) == 1
        assert len(fl_v) == 1

    def test_bad_equipment_excluded(self):
        bad = {**GOOD_EQUIPMENT, "age_years": 999}
        eq_v, _, _, _, results = validate_and_filter(
            [bad], [GOOD_READING], [GOOD_MAINTENANCE], [GOOD_FAILURE]
        )
        assert len(eq_v) == 0
        assert results["equipment"].failed == 1

    def test_results_keys_present(self):
        _, _, _, _, results = validate_and_filter(
            [GOOD_EQUIPMENT], [GOOD_READING], [GOOD_MAINTENANCE], [GOOD_FAILURE]
        )
        assert set(results.keys()) == {"equipment", "readings", "maintenance", "failures"}
