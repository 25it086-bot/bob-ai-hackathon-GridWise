"""
Tests for the GridWise DataService.
"""
import pytest
from app.data.store import GridWiseStore
from app.data.service import DataService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

EQUIPMENT_RECORDS = [
    {
        "id": "TF-001", "name": "North Alpha Transformer 1", "type": "transformer",
        "substation_id": "SUB-Z3-A", "substation_name": "North Alpha Primary",
        "zone_id": "Z3", "zone_name": "Zone 3 - Northern",
        "age_years": 28, "status": "degraded", "customers_affected": 4200,
        "manufacturer": "ABB", "model": "PowerFlex 500", "nominal_voltage_kv": 132.0,
        "latitude": 40.82, "longitude": -73.92,
        "installed_at": "1995-06-12", "last_inspected_at": "2022-11-04",
        "maintenance_days_ago": 437, "previous_failures_2yr": 3,
    },
    {
        "id": "FD-002", "name": "Eastfield Feeder 2", "type": "feeder",
        "substation_id": "SUB-Z1-A", "substation_name": "Eastfield Primary",
        "zone_id": "Z1", "zone_name": "Zone 1 - Eastern",
        "age_years": 6, "status": "operational", "customers_affected": 850,
        "manufacturer": "Siemens", "model": "LiteFeed F1", "nominal_voltage_kv": 11.0,
        "latitude": 40.71, "longitude": -73.98,
        "installed_at": "2018-03-20", "last_inspected_at": "2024-01-05",
        "maintenance_days_ago": 10, "previous_failures_2yr": 0,
    },
    {
        "id": "SW-003", "name": "Industrial Switchgear 3", "type": "switchgear",
        "substation_id": "SUB-Z6-A", "substation_name": "Industrial Park Primary",
        "zone_id": "Z6", "zone_name": "Zone 6 - Industrial",
        "age_years": 22, "status": "operational", "customers_affected": 1600,
        "manufacturer": "Eaton", "model": "IsoSwitch G3", "nominal_voltage_kv": 33.0,
        "latitude": 40.68, "longitude": -74.16,
        "installed_at": "2002-07-14", "last_inspected_at": "2023-09-22",
        "maintenance_days_ago": 280, "previous_failures_2yr": 2,
    },
]

READING_RECORDS = [
    {
        "id": "R-TF-001-0000", "equipment_id": "TF-001",
        "recorded_at": "2024-01-15T14:32:00",
        "temperature_c": 97.4, "load_pct": 96.8,
        "voltage_kv": 145.2, "voltage_deviation_pct": 10.0,
        "vibration_mms": 8.7, "humidity_pct": 72.0,
        "weather_condition": "extreme_heat",
        "maintenance_days_ago": 437, "previous_failures_2yr": 3,
        "customer_count": 4200, "equipment_status": "degraded",
    },
    {
        "id": "R-FD-002-0000", "equipment_id": "FD-002",
        "recorded_at": "2024-01-15T14:32:00",
        "temperature_c": 32.5, "load_pct": 45.0,
        "voltage_kv": 11.2, "voltage_deviation_pct": 1.8,
        "vibration_mms": 0.5, "humidity_pct": 55.0,
        "weather_condition": "normal",
        "maintenance_days_ago": 10, "previous_failures_2yr": 0,
        "customer_count": 850, "equipment_status": "operational",
    },
    {
        "id": "R-SW-003-0000", "equipment_id": "SW-003",
        "recorded_at": "2024-01-15T14:32:00",
        "temperature_c": 74.1, "load_pct": 82.0,
        "voltage_kv": 34.8, "voltage_deviation_pct": 5.5,
        "vibration_mms": 4.1, "humidity_pct": 63.0,
        "weather_condition": "normal",
        "maintenance_days_ago": 280, "previous_failures_2yr": 2,
        "customer_count": 1600, "equipment_status": "operational",
    },
]

RISK_SCORES = {
    "TF-001": {"score": 85.0, "level": "critical", "outage_probability": 0.82, "factors": []},
    "FD-002": {"score": 18.0, "level": "low",      "outage_probability": 0.05, "factors": []},
    "SW-003": {"score": 62.0, "level": "high",     "outage_probability": 0.45, "factors": []},
}


@pytest.fixture
def svc():
    """DataService backed by an isolated in-memory store."""
    s = GridWiseStore()
    s.equipment  = list(EQUIPMENT_RECORDS)
    s.readings   = list(READING_RECORDS)
    s.maintenance= []
    s.failures   = []
    s.zones      = [
        {"id": "Z1", "name": "Zone 1 - Eastern", "region": "Eastern", "total_customers": 15200},
        {"id": "Z3", "name": "Zone 3 - Northern","region": "Northern","total_customers": 18400},
        {"id": "Z6", "name": "Zone 6 - Industrial","region":"Industrial","total_customers": 8300},
    ]
    s.risk_scores = dict(RISK_SCORES)
    s._loaded = True
    return DataService(data_store=s)


# ---------------------------------------------------------------------------
# get_flat_record
# ---------------------------------------------------------------------------

class TestGetFlatRecord:
    def test_returns_flat_record_for_known_id(self, svc):
        rec = svc.get_flat_record("TF-001")
        assert rec is not None
        assert rec.equipment_id == "TF-001"

    def test_returns_none_for_unknown_id(self, svc):
        assert svc.get_flat_record("XX-999") is None

    def test_flat_record_has_reading_fields(self, svc):
        rec = svc.get_flat_record("TF-001")
        assert rec.temperature      == 97.4
        assert rec.load_percentage  == 96.8
        assert rec.vibration        == 8.7
        assert rec.weather_condition == "extreme_heat"

    def test_flat_record_has_asset_fields(self, svc):
        rec = svc.get_flat_record("TF-001")
        assert rec.equipment_type    == "transformer"
        assert rec.zone              == "Z3"
        assert rec.substation_name   == "North Alpha Primary"
        assert rec.age_years         == 28
        assert rec.customer_count    == 4200

    def test_flat_record_has_risk_fields(self, svc):
        rec = svc.get_flat_record("TF-001")
        assert rec.risk_score        == 85.0
        assert rec.risk_level        == "critical"
        assert rec.outage_probability == 0.82

    def test_flat_record_has_denormalized_fields(self, svc):
        rec = svc.get_flat_record("TF-001")
        assert rec.maintenance_days_ago == 437
        assert rec.previous_failures    == 3

    def test_low_risk_record_correct(self, svc):
        rec = svc.get_flat_record("FD-002")
        assert rec.risk_level == "low"
        assert rec.temperature == 32.5
        assert rec.maintenance_days_ago == 10


# ---------------------------------------------------------------------------
# get_flat_records (filtered/paginated)
# ---------------------------------------------------------------------------

class TestGetFlatRecords:
    def test_returns_all_by_default(self, svc):
        page = svc.get_flat_records()
        assert page.total == 3

    def test_filter_by_zone_id(self, svc):
        page = svc.get_flat_records(zone_id="Z3")
        assert page.total == 1
        assert page.items[0].zone == "Z3"

    def test_filter_by_risk_level(self, svc):
        page = svc.get_flat_records(risk_level="critical")
        assert page.total == 1
        assert page.items[0].equipment_id == "TF-001"

    def test_filter_by_equipment_type(self, svc):
        page = svc.get_flat_records(equip_type="feeder")
        assert page.total == 1
        assert page.items[0].equipment_type == "feeder"

    def test_filter_by_status(self, svc):
        page = svc.get_flat_records(status="degraded")
        assert page.total == 1
        assert page.items[0].equipment_status == "degraded"

    def test_search_by_id(self, svc):
        page = svc.get_flat_records(search="TF-001")
        assert page.total == 1

    def test_search_by_name_substring(self, svc):
        page = svc.get_flat_records(search="eastfield")
        assert page.total == 1

    def test_sort_by_risk_score_desc(self, svc):
        page = svc.get_flat_records(sort_by="risk_score", sort_dir="desc")
        scores = [r.risk_score for r in page.items]
        assert scores == sorted(scores, reverse=True)

    def test_sort_by_risk_score_asc(self, svc):
        page = svc.get_flat_records(sort_by="risk_score", sort_dir="asc")
        scores = [r.risk_score for r in page.items]
        assert scores == sorted(scores)

    def test_pagination(self, svc):
        page1 = svc.get_flat_records(page=1, page_size=2)
        page2 = svc.get_flat_records(page=2, page_size=2)
        assert len(page1.items) == 2
        assert len(page2.items) == 1
        assert page1.total == 3
        assert page1.total_pages == 2

    def test_empty_result_for_no_match(self, svc):
        page = svc.get_flat_records(zone_id="Z99")
        assert page.total == 0
        assert page.items == []


# ---------------------------------------------------------------------------
# get_ranking
# ---------------------------------------------------------------------------

class TestGetRanking:
    def test_ranking_sorted_by_risk_desc(self, svc):
        ranking = svc.get_ranking(limit=3)
        scores = [r.risk_score for r in ranking]
        assert scores == sorted(scores, reverse=True)

    def test_ranking_limit_respected(self, svc):
        ranking = svc.get_ranking(limit=2)
        assert len(ranking) == 2

    def test_ranking_top_is_highest_risk(self, svc):
        ranking = svc.get_ranking(limit=1)
        assert ranking[0].equipment_id == "TF-001"

    def test_ranking_filter_by_zone(self, svc):
        ranking = svc.get_ranking(zone_id="Z1")
        assert all(r.zone == "Z1" for r in ranking)


# ---------------------------------------------------------------------------
# grid_health_score
# ---------------------------------------------------------------------------

class TestGridHealthScore:
    def test_health_score_is_100_minus_avg(self, svc):
        avg = (85.0 + 18.0 + 62.0) / 3  # = 55.0
        expected = round(100.0 - avg, 1)  # = 45.0
        assert svc.grid_health_score() == expected

    def test_health_score_no_scores_returns_100(self, svc):
        svc._store.risk_scores = {}
        assert svc.grid_health_score() == 100.0


# ---------------------------------------------------------------------------
# risk_distribution
# ---------------------------------------------------------------------------

class TestRiskDistribution:
    def test_distribution_counts_correct(self, svc):
        dist = svc.risk_distribution()
        assert dist["critical"] == 1
        assert dist["high"]     == 1
        assert dist["low"]      == 1
        assert dist.get("medium", 0) == 0

    def test_distribution_all_four_keys_present(self, svc):
        dist = svc.risk_distribution()
        for level in ("critical", "high", "medium", "low"):
            assert level in dist


# ---------------------------------------------------------------------------
# dataset_status
# ---------------------------------------------------------------------------

class TestDatasetStatus:
    def test_status_has_expected_keys(self, svc):
        status = svc.dataset_status()
        for key in ("loaded", "equipment_count", "reading_count", "zone_count",
                    "scored_count"):
            assert key in status, f"Missing key: {key}"

    def test_counts_accurate(self, svc):
        status = svc.dataset_status()
        assert status["equipment_count"] == 3
        assert status["reading_count"]   == 3
        assert status["scored_count"]    == 3


# ---------------------------------------------------------------------------
# referential integrity
# ---------------------------------------------------------------------------

class TestReferentialIntegrity:
    def test_clean_data_has_no_issues(self, svc):
        issues = svc.check_referential_integrity()
        assert issues == {}

    def test_orphan_reading_detected(self, svc):
        svc._store.readings.append({
            **READING_RECORDS[0],
            "id": "R-ORPHAN-0000",
            "equipment_id": "NONEXISTENT-999",
        })
        issues = svc.check_referential_integrity()
        assert "orphan_readings" in issues
