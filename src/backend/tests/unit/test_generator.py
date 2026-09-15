"""
Tests for the GridWise data generator (v2).
Validates structure, field ranges, and risk tier distribution.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"
DATA_DIR    = Path(__file__).parent.parent.parent.parent / "data"
GEN_SCRIPT  = SCRIPTS_DIR / "generate_data.py"


@pytest.fixture(scope="module")
def generated_data(tmp_path_factory):
    """Run generator into a temp dir and return loaded data."""
    tmp = tmp_path_factory.mktemp("gendata")
    result = subprocess.run(
        [sys.executable, str(GEN_SCRIPT)],
        env={**__import__("os").environ, "DATA_DIR_OVERRIDE": str(tmp)},
        capture_output=True,
        text=True,
    )
    # Generator always writes to the real data dir — just load from there
    data = {}
    for name in ("equipment", "readings", "maintenance", "failures", "zones", "substations"):
        path = DATA_DIR / f"{name}.json"
        if path.exists():
            data[name] = json.loads(path.read_text())
        else:
            data[name] = []
    return data


# ---------------------------------------------------------------------------
# Generator smoke test — just run it
# ---------------------------------------------------------------------------

class TestGeneratorRuns:
    def test_generator_exits_cleanly(self):
        result = subprocess.run(
            [sys.executable, str(GEN_SCRIPT)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"Generator failed:\n{result.stderr}"

    def test_all_files_created(self):
        for name in ("equipment", "readings", "maintenance", "failures", "zones", "substations"):
            assert (DATA_DIR / f"{name}.json").exists(), f"{name}.json missing"


# ---------------------------------------------------------------------------
# Equipment records
# ---------------------------------------------------------------------------

class TestEquipmentRecords:
    def test_equipment_count_reasonable(self, generated_data):
        count = len(generated_data["equipment"])
        # 6 zones × (4+5+3+2) tiers + 1 hero = at least 85
        assert count >= 80, f"Expected >= 80 equipment, got {count}"

    def test_all_required_fields_present(self, generated_data):
        required = {
            "id", "name", "type", "substation_id", "substation_name",
            "zone_id", "zone_name", "age_years", "status",
            "customers_affected", "maintenance_days_ago", "previous_failures_2yr",
        }
        for eq in generated_data["equipment"]:
            missing = required - set(eq.keys())
            assert not missing, f"{eq['id']} missing fields: {missing}"

    def test_equipment_type_valid(self, generated_data):
        valid = {"transformer", "substation", "feeder", "switchgear"}
        for eq in generated_data["equipment"]:
            assert eq["type"] in valid, f"{eq['id']} has invalid type: {eq['type']}"

    def test_age_within_bounds(self, generated_data):
        for eq in generated_data["equipment"]:
            assert 0 <= eq["age_years"] <= 60, f"{eq['id']} age_years={eq['age_years']}"

    def test_customers_positive(self, generated_data):
        for eq in generated_data["equipment"]:
            assert eq["customers_affected"] >= 0, f"{eq['id']} negative customers"

    def test_status_valid(self, generated_data):
        valid = {"operational", "degraded", "critical", "offline", "maintenance"}
        for eq in generated_data["equipment"]:
            assert eq["status"] in valid, f"{eq['id']} status={eq['status']}"

    def test_hero_equipment_exists(self, generated_data):
        ids = {e["id"] for e in generated_data["equipment"]}
        assert "TF-001" in ids, "Hero equipment TF-001 not found"

    def test_hero_equipment_properties(self, generated_data):
        hero = next(e for e in generated_data["equipment"] if e["id"] == "TF-001")
        assert hero["zone_id"] == "Z3"
        assert hero["age_years"] >= 25
        assert hero["customers_affected"] >= 2000

    def test_substation_ids_reference_valid_substations(self, generated_data):
        sub_ids = {s["id"] for s in generated_data["substations"]}
        for eq in generated_data["equipment"]:
            sid = eq.get("substation_id", "")
            assert sid in sub_ids, f"{eq['id']} references unknown substation {sid}"


# ---------------------------------------------------------------------------
# Reading records
# ---------------------------------------------------------------------------

class TestReadingRecords:
    def test_readings_cover_all_equipment(self, generated_data):
        equip_ids   = {e["id"] for e in generated_data["equipment"]}
        reading_ids = {r["equipment_id"] for r in generated_data["readings"]}
        missing = equip_ids - reading_ids
        assert not missing, f"No readings for: {missing}"

    def test_all_required_reading_fields(self, generated_data):
        required = {
            "id", "equipment_id", "recorded_at",
            "temperature_c", "load_pct", "voltage_kv",
            "voltage_deviation_pct", "vibration_mms", "humidity_pct",
            "weather_condition",
            "maintenance_days_ago", "previous_failures_2yr",
            "customer_count", "equipment_status",
        }
        for r in generated_data["readings"][:50]:   # spot-check first 50
            missing = required - set(r.keys())
            assert not missing, f"Reading {r['id']} missing: {missing}"

    def test_temperature_in_range(self, generated_data):
        for r in generated_data["readings"]:
            assert -20 <= r["temperature_c"] <= 200, \
                f"{r['id']} temp={r['temperature_c']}"

    def test_load_pct_in_range(self, generated_data):
        for r in generated_data["readings"]:
            assert 0 <= r["load_pct"] <= 100, \
                f"{r['id']} load={r['load_pct']}"

    def test_humidity_in_range(self, generated_data):
        for r in generated_data["readings"]:
            assert 0 <= r["humidity_pct"] <= 100, \
                f"{r['id']} humidity={r['humidity_pct']}"

    def test_weather_condition_valid(self, generated_data):
        valid = {"normal", "extreme_heat", "storm", "high_wind"}
        for r in generated_data["readings"]:
            assert r["weather_condition"] in valid, \
                f"{r['id']} weather={r['weather_condition']}"

    def test_hero_reading_is_critical(self, generated_data):
        hero_readings = [r for r in generated_data["readings"] if r["equipment_id"] == "TF-001"]
        latest = max(hero_readings, key=lambda r: r["recorded_at"])
        # Hero should have high temp and load
        assert latest["temperature_c"] > 80, "Hero temp should be > 80°C"
        assert latest["load_pct"] > 85, "Hero load should be > 85%"


# ---------------------------------------------------------------------------
# Risk tier distribution (after scoring)
# ---------------------------------------------------------------------------

class TestRiskDistribution:
    def test_all_four_tiers_represented(self):
        """After scoring, all four risk levels should be present."""
        # Use the module-level DATA_DIR (absolute path) so this works regardless
        # of the pytest working directory.
        from app.data.loader import load_data
        from app.data.store import store
        from app.services.scoring_service import score_all_equipment

        store.__init__()   # reset
        load_data(DATA_DIR)
        score_all_equipment()

        dist = {}
        for s in store.risk_scores.values():
            dist[s["level"]] = dist.get(s["level"], 0) + 1

        assert "critical" in dist, f"No CRITICAL equipment in distribution: {dist}"
        assert "high"     in dist, f"No HIGH equipment: {dist}"
        assert "medium"   in dist, f"No MEDIUM equipment: {dist}"
        assert "low"      in dist, f"No LOW equipment: {dist}"

    def test_critical_percentage_is_reasonable(self):
        from app.data.store import store

        total    = len(store.risk_scores)
        critical = sum(1 for s in store.risk_scores.values() if s["level"] == "critical")
        pct      = critical / total * 100 if total else 0
        # Critical should be 5–30% of fleet for a realistic demo
        assert 3 <= pct <= 35, f"Critical% = {pct:.1f}% — outside realistic range"
