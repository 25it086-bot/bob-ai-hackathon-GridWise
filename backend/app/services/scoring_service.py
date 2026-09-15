"""
Orchestrates risk scoring across all equipment and populates the store.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from ..data.store import store
from ..engine.risk_scorer import compute_risk_score
from ..engine.recommender import generate_recommendations
from ..schemas.alert import Alert

logger = logging.getLogger(__name__)
_alert_counter = 0


def _next_alert_id() -> str:
    global _alert_counter
    _alert_counter += 1
    return f"AL-{_alert_counter:04d}"


def score_all_equipment() -> dict:
    """Re-score every equipment item and update the store."""
    if not store._loaded:
        logger.warning("Store not loaded; skipping scoring")
        return {"scored": 0, "errors": 0}

    scored = 0
    errors = 0
    new_alerts: list[dict] = []

    for eq in store.equipment:
        try:
            reading = store.latest_reading(eq["id"])
            if reading is None:
                continue

            days_maintenance = store.days_since_maintenance(eq["id"])
            failure_count = store.failure_count_2yr(eq["id"])

            risk = compute_risk_score(eq, reading, days_maintenance, failure_count)
            store.risk_scores[eq["id"]] = risk.model_dump(mode="json")

            recs = generate_recommendations(eq, risk, days_maintenance, reading)
            store.recommendations[eq["id"]] = [r.model_dump(mode="json") for r in recs]

            # Auto-generate alerts for threshold breaches
            existing_equip_alerts = {
                a["alert_type"] for a in store.alerts
                if a["equipment_id"] == eq["id"] and not a.get("acknowledged")
            }
            if risk.level == "critical" and "RISK_ELEVATED" not in existing_equip_alerts:
                new_alerts.append(Alert(
                    id=_next_alert_id(),
                    equipment_id=eq["id"],
                    zone_id=eq.get("zone_id"),
                    equipment_name=eq.get("name"),
                    created_at=datetime.now(timezone.utc),
                    severity="critical",
                    alert_type="RISK_ELEVATED",
                    message=(
                        f"Risk score elevated to {risk.score:.0f}/100 — "
                        f"load {reading['load_pct']:.0f}%, temp {reading['temperature_c']:.0f}°C"
                    ),
                    acknowledged=False,
                ).model_dump(mode="json"))

            scored += 1
        except Exception as exc:
            logger.exception("Failed to score equipment %s: %s", eq["id"], exc)
            errors += 1

    store.alerts.extend(new_alerts)
    logger.info("Scoring complete: %d scored, %d errors, %d new alerts", scored, errors, len(new_alerts))
    return {"scored": scored, "errors": errors, "new_alerts": len(new_alerts)}
