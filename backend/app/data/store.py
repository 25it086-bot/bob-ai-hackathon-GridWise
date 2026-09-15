"""
In-memory data store for GridWise MVP.
Loaded once at startup from JSON files.
Repository pattern means this can be replaced with a DB later.
"""
from __future__ import annotations
import asyncio
from datetime import datetime


class GridWiseStore:
    """Single in-memory store holding all loaded grid data."""

    def __init__(self) -> None:
        self.equipment:       list[dict]       = []
        self.readings:        list[dict]       = []
        self.zones:           list[dict]       = []
        self.substations:     list[dict]       = []          # new in v2
        self.maintenance:     list[dict]       = []
        self.failures:        list[dict]       = []
        self.alerts:          list[dict]       = []
        self.risk_scores:     dict[str, dict]  = {}          # keyed by equipment_id
        self.recommendations: dict[str, list[dict]] = {}     # keyed by equipment_id
        self._lock  = asyncio.Lock()
        self._loaded = False

    # ── Index helpers ──────────────────────────────────────────────────────

    def equipment_by_id(self, eid: str) -> dict | None:
        return next((e for e in self.equipment if e["id"] == eid), None)

    def zone_by_id(self, zid: str) -> dict | None:
        return next((z for z in self.zones if z["id"] == zid), None)

    def substation_by_id(self, sid: str) -> dict | None:
        return next((s for s in self.substations if s["id"] == sid), None)

    def equipment_in_zone(self, zid: str) -> list[dict]:
        return [e for e in self.equipment if e.get("zone_id") == zid]

    def equipment_in_substation(self, sid: str) -> list[dict]:
        return [e for e in self.equipment if e.get("substation_id") == sid]

    def latest_reading(self, eid: str) -> dict | None:
        readings = [r for r in self.readings if r["equipment_id"] == eid]
        if not readings:
            return None
        return max(readings, key=lambda r: r["recorded_at"])

    def maintenance_for(self, eid: str) -> list[dict]:
        return sorted(
            [m for m in self.maintenance if m["equipment_id"] == eid],
            key=lambda m: m["maintenance_date"],
            reverse=True,
        )

    def failures_for(self, eid: str) -> list[dict]:
        return sorted(
            [f for f in self.failures if f["equipment_id"] == eid],
            key=lambda f: f["occurred_at"],
            reverse=True,
        )

    def days_since_maintenance(self, eid: str) -> int:
        recs = self.maintenance_for(eid)
        if not recs:
            return 9999
        last = recs[0]["maintenance_date"]
        last_dt = (
            datetime.strptime(last, "%Y-%m-%d")
            if isinstance(last, str)
            else last
        )
        return (datetime.now() - last_dt).days

    def failure_count_2yr(self, eid: str) -> int:
        # Use date-only cutoff string (YYYY-MM-DD) so it compares correctly
        # against date-only occurred_at values stored in the data.
        cutoff = f"{datetime.now().year - 2}-01-01"
        return sum(
            1 for f in self.failures_for(eid)
            if str(f.get("occurred_at", ""))[:10] >= cutoff
        )

    def unacknowledged_alerts(self) -> list[dict]:
        return [a for a in self.alerts if not a.get("acknowledged", False)]


# Singleton
store = GridWiseStore()
