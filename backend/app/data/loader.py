"""
GridWise Data Loader
====================
Loads JSON data files into the GridWiseStore and runs validation.
Invalid records are excluded from the store with a logged warning.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from .store import store
from .validator import validate_and_filter

logger = logging.getLogger(__name__)


def load_data(data_dir: str | Path) -> None:
    data_dir = Path(data_dir)
    if not data_dir.exists():
        logger.warning("Data directory %s not found — running data generator...", data_dir)
        _run_generator()

    def _load(name: str) -> list:
        path = data_dir / f"{name}.json"
        if not path.exists():
            logger.warning("Data file not found: %s", path)
            return []
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    raw_zones       = _load("zones")
    raw_substations = _load("substations")   # new in v2
    raw_equipment   = _load("equipment")
    raw_readings    = _load("readings")
    raw_maintenance = _load("maintenance")
    raw_failures    = _load("failures")
    raw_alerts      = _load("alerts")

    # ── Validate and filter ────────────────────────────────────────────────
    logger.info("Validating loaded data...")
    eq_valid, rd_valid, mt_valid, fl_valid, results = validate_and_filter(
        raw_equipment,
        raw_readings,
        raw_maintenance,
        raw_failures,
    )

    for entity, result in results.items():
        if result.ok:
            logger.info("  ✓  %-12s  %d records valid", entity, result.total)
        else:
            logger.warning(
                "  ✗  %-12s  %d/%d valid  (%d invalid excluded)",
                entity, result.passed, result.total, result.failed,
            )
            for err in result.errors[:5]:   # log first 5 only
                logger.warning(
                    "      [%s] %s.%s: %s",
                    err.record_id, entity, err.field, err.message,
                )

    # ── Populate store ─────────────────────────────────────────────────────
    store.zones        = raw_zones
    store.substations  = raw_substations
    store.equipment    = eq_valid
    store.readings     = rd_valid
    store.maintenance  = mt_valid
    store.failures     = fl_valid
    store.alerts       = raw_alerts
    store._loaded      = True

    logger.info(
        "Store ready: %d equipment, %d readings, %d zones, %d substations",
        len(store.equipment),
        len(store.readings),
        len(store.zones),
        len(store.substations),
    )


def _run_generator() -> None:
    """Automatically generate simulated data if files are missing."""
    import subprocess, sys
    scripts_dir = Path(__file__).parent.parent.parent / "scripts"
    gen_script  = scripts_dir / "generate_data.py"
    if gen_script.exists():
        logger.info("Running data generator at %s", gen_script)
        subprocess.run([sys.executable, str(gen_script)], check=True)
    else:
        logger.error("Generator script not found at %s", gen_script)
