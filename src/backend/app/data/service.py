"""
GridWise DataService
====================
Clean, typed access layer over the in-memory GridWiseStore.

All business queries go through DataService — no router should
touch the store directly for data-retrieval logic.

Responsibilities:
  - Flat record assembly (EquipmentRecord + latest reading joined)
  - Filtering, sorting, pagination helpers
  - Referential integrity checks
  - Exposure of validation summaries
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from .store import store, GridWiseStore
from .validator import validate_and_filter, ValidationResult
from ..schemas.equipment import (
    EquipmentRecord,
    EquipmentReading,
    MaintenanceRecord,
    FailureEvent,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lightweight result wrappers
# ---------------------------------------------------------------------------

@dataclass
class Page:
    items:      list[Any]
    total:      int
    page:       int
    page_size:  int

    @property
    def total_pages(self) -> int:
        import math
        return math.ceil(self.total / self.page_size) if self.page_size else 0


@dataclass
class FlatEquipmentRecord:
    """
    Joined view: equipment asset fields + latest sensor reading fields.
    Matches the field set requested by the task specification.
    """
    # ── Asset fields ──
    equipment_id:           str
    equipment_type:         str
    substation_id:          str
    substation_name:        str
    zone:                   str
    zone_name:              str
    age_years:              int
    equipment_status:       str
    customer_count:         int
    manufacturer:           str | None
    model:                  str | None
    nominal_voltage_kv:     float | None
    installed_at:           str | None
    # ── Reading fields (latest snapshot) ──
    temperature:            float | None
    load_percentage:        float | None
    voltage:                float | None
    voltage_deviation_pct:  float | None
    vibration:              float | None
    humidity_pct:           float | None
    weather_condition:      str | None
    # ── Derived / denormalized fields ──
    maintenance_days_ago:   int
    previous_failures:      int
    # ── Risk output (populated after scoring) ──
    risk_score:             float | None = None
    risk_level:             str | None   = None
    outage_probability:     float | None = None


# ---------------------------------------------------------------------------
# DataService
# ---------------------------------------------------------------------------

class DataService:
    """
    Singleton service layer over GridWiseStore.
    All read operations return clean Python objects or dicts.
    """

    def __init__(self, data_store: GridWiseStore | None = None) -> None:
        self._store = data_store or store

    # ── Validation ────────────────────────────────────────────────────────

    def validate_store(self) -> dict[str, ValidationResult]:
        """Run full validation over current store contents. Returns results dict."""
        eq_v, rd_v, mt_v, fl_v, results = validate_and_filter(
            self._store.equipment,
            self._store.readings,
            self._store.maintenance,
            self._store.failures,
        )
        # Replace store contents with validated-only records
        self._store.equipment    = eq_v
        self._store.readings     = rd_v
        self._store.maintenance  = mt_v
        self._store.failures     = fl_v
        logger.info("DataService.validate_store complete: %s", {k: v.summary() for k, v in results.items()})
        return results

    # ── Flat record assembly ───────────────────────────────────────────────

    def get_flat_record(self, equipment_id: str) -> FlatEquipmentRecord | None:
        """Return a single flat joined record for one equipment unit."""
        eq = self._store.equipment_by_id(equipment_id)
        if eq is None:
            return None
        return self._assemble_flat(eq)

    def get_flat_records(
        self,
        *,
        zone_id:     str | None = None,
        risk_level:  str | None = None,
        equip_type:  str | None = None,
        status:      str | None = None,
        search:      str | None = None,
        sort_by:     str        = "risk_score",
        sort_dir:    str        = "desc",
        page:        int        = 1,
        page_size:   int        = 25,
    ) -> Page:
        """Return paginated, filtered, sorted flat records."""
        items = list(self._store.equipment)

        # ── Filters ──
        if zone_id:
            zones = {z.strip() for z in zone_id.split(",")}
            items = [e for e in items if e.get("zone_id") in zones]

        if equip_type:
            types = {t.strip() for t in equip_type.split(",")}
            items = [e for e in items if e.get("type") in types]

        if status:
            statuses = {s.strip() for s in status.split(",")}
            items = [e for e in items if e.get("status") in statuses]

        if search:
            q = search.lower()
            items = [
                e for e in items
                if q in e.get("id", "").lower()
                or q in e.get("name", "").lower()
                or q in e.get("substation_name", "").lower()
            ]

        # ── Assemble flat records ──
        flat = [self._assemble_flat(e) for e in items]

        # ── Filter by risk_level (needs assembled record) ──
        if risk_level:
            levels = {r.strip() for r in risk_level.split(",")}
            flat = [r for r in flat if r.risk_level in levels]

        # ── Sort ──
        reverse = sort_dir.lower() != "asc"
        sort_key_map = {
            "risk_score":         lambda r: r.risk_score or 0.0,
            "age_years":          lambda r: r.age_years,
            "temperature":        lambda r: r.temperature or 0.0,
            "load_percentage":    lambda r: r.load_percentage or 0.0,
            "maintenance_days_ago":lambda r: r.maintenance_days_ago,
            "customer_count":     lambda r: r.customer_count,
            "name":               lambda r: r.equipment_id,
        }
        key_fn = sort_key_map.get(sort_by, sort_key_map["risk_score"])
        flat.sort(key=key_fn, reverse=reverse)

        # ── Paginate ──
        total = len(flat)
        start = (page - 1) * page_size
        page_items = flat[start : start + page_size]

        return Page(items=page_items, total=total, page=page, page_size=page_size)

    def get_ranking(self, limit: int = 10, zone_id: str | None = None) -> list[FlatEquipmentRecord]:
        """Return top-N equipment sorted by risk score descending."""
        items = list(self._store.equipment)
        if zone_id:
            items = [e for e in items if e.get("zone_id") == zone_id]
        flat = [self._assemble_flat(e) for e in items]
        flat.sort(key=lambda r: r.risk_score or 0.0, reverse=True)
        return flat[:limit]

    # ── Zone helpers ───────────────────────────────────────────────────────

    def zone_flat_records(self, zone_id: str) -> list[FlatEquipmentRecord]:
        equip = self._store.equipment_in_zone(zone_id)
        return [self._assemble_flat(e) for e in equip]

    # ── Risk distribution helpers ──────────────────────────────────────────

    def risk_distribution(self) -> dict[str, int]:
        dist: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for score in self._store.risk_scores.values():
            level = score.get("level", "low")
            dist[level] = dist.get(level, 0) + 1
        return dist

    def grid_health_score(self) -> float:
        """100 minus weighted average risk score."""
        scores = list(self._store.risk_scores.values())
        if not scores:
            return 100.0
        avg = sum(s.get("score", 0) for s in scores) / len(scores)
        return round(max(0.0, 100.0 - avg), 1)

    # ── Detail helpers ─────────────────────────────────────────────────────

    def get_maintenance(self, equipment_id: str) -> list[dict]:
        return self._store.maintenance_for(equipment_id)

    def get_failures(self, equipment_id: str) -> list[dict]:
        return self._store.failures_for(equipment_id)

    def get_latest_reading(self, equipment_id: str) -> dict | None:
        return self._store.latest_reading(equipment_id)

    # ── Dataset status ─────────────────────────────────────────────────────

    def dataset_status(self) -> dict:
        return {
            "loaded":              self._store._loaded,
            "equipment_count":     len(self._store.equipment),
            "reading_count":       len(self._store.readings),
            "zone_count":          len(self._store.zones),
            "maintenance_count":   len(self._store.maintenance),
            "failure_count":       len(self._store.failures),
            "alert_count":         len(self._store.alerts),
            "scored_count":        len(self._store.risk_scores),
            "recommendation_count":sum(len(v) for v in self._store.recommendations.values()),
        }

    # ── Referential integrity check ────────────────────────────────────────

    def check_referential_integrity(self) -> dict[str, list[str]]:
        """
        Return any orphaned records (readings/maintenance/failures
        that reference non-existent equipment IDs).
        """
        equip_ids = {e["id"] for e in self._store.equipment}
        issues: dict[str, list[str]] = {}

        orphan_readings = [
            r["id"] for r in self._store.readings
            if r.get("equipment_id") not in equip_ids
        ]
        if orphan_readings:
            issues["orphan_readings"] = orphan_readings[:20]  # cap at 20

        orphan_maint = [
            m["id"] for m in self._store.maintenance
            if m.get("equipment_id") not in equip_ids
        ]
        if orphan_maint:
            issues["orphan_maintenance"] = orphan_maint[:20]

        orphan_fail = [
            f["id"] for f in self._store.failures
            if f.get("equipment_id") not in equip_ids
        ]
        if orphan_fail:
            issues["orphan_failures"] = orphan_fail[:20]

        return issues

    # ── Private helpers ────────────────────────────────────────────────────

    def _assemble_flat(self, eq: dict) -> FlatEquipmentRecord:
        reading = self._store.latest_reading(eq["id"])
        score   = self._store.risk_scores.get(eq["id"])

        return FlatEquipmentRecord(
            equipment_id          = eq["id"],
            equipment_type        = eq.get("type", "transformer"),
            substation_id         = eq.get("substation_id") or "",
            substation_name       = eq.get("substation_name") or "",
            zone                  = eq.get("zone_id", ""),
            zone_name             = eq.get("zone_name") or eq.get("zone_id", ""),
            age_years             = eq.get("age_years", 0),
            equipment_status      = eq.get("status", "operational"),
            customer_count        = eq.get("customers_affected", 0),
            manufacturer          = eq.get("manufacturer"),
            model                 = eq.get("model"),
            nominal_voltage_kv    = eq.get("nominal_voltage_kv"),
            installed_at          = str(eq["installed_at"]) if eq.get("installed_at") else None,
            temperature           = reading["temperature_c"]         if reading else None,
            load_percentage       = reading["load_pct"]              if reading else None,
            voltage               = reading["voltage_kv"]            if reading else None,
            voltage_deviation_pct = reading["voltage_deviation_pct"] if reading else None,
            vibration             = reading["vibration_mms"]         if reading else None,
            humidity_pct          = reading["humidity_pct"]          if reading else None,
            weather_condition     = reading["weather_condition"]      if reading else None,
            maintenance_days_ago  = (
                reading["maintenance_days_ago"]
                if reading and "maintenance_days_ago" in reading
                else self._store.days_since_maintenance(eq["id"])
            ),
            previous_failures     = (
                reading["previous_failures_2yr"]
                if reading and "previous_failures_2yr" in reading
                else self._store.failure_count_2yr(eq["id"])
            ),
            risk_score            = score["score"]              if score else None,
            risk_level            = score["level"]              if score else None,
            outage_probability    = score["outage_probability"] if score else None,
        )


# Singleton
data_service = DataService()
