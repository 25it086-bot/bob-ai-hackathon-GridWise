"""
GridWise Simulated Grid Data Generator  v2
==========================================
Seed=42 — fully reproducible dataset.

Design principles:
  - 4 explicit risk tiers: LOW / MEDIUM / HIGH / CRITICAL
  - Each tier has a realistic *profile* (correlated fields)
  - Substation topology added: each zone has named substations
  - Equipment is assigned to a substation within its zone
  - Readings include denormalized maintenance_days_ago + previous_failures_2yr
    so the data service can serve flat records without joins
  - Weather is zone-correlated (Industrial zone gets more extreme events)
  - Failure causes are domain-specific, not lorem ipsum
  - Maintenance notes are operational, not lorem ipsum
  - All numeric values stay within physically realistic bounds

Risk tier targets (approximate):
  CRITICAL : ~10%  (score 80-100)
  HIGH     : ~25%  (score 60-79)
  MEDIUM   : ~40%  (score 40-59)
  LOW      : ~25%  (score  0-39)

Run:
  python scripts/generate_data.py
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, date
from pathlib import Path

# ---------------------------------------------------------------------------
# Seeded RNG
# ---------------------------------------------------------------------------
rng = random.Random(42)

BASE_DATE = datetime(2024, 1, 15, 14, 32, 0)
DATA_DIR   = Path(__file__).parent.parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Zone & substation topology
# ---------------------------------------------------------------------------
ZONES = [
    {"id": "Z1", "name": "Zone 1 - Eastern",    "region": "Eastern District",    "total_customers": 15200},
    {"id": "Z2", "name": "Zone 2 - Western",     "region": "Western District",    "total_customers": 12800},
    {"id": "Z3", "name": "Zone 3 - Northern",    "region": "Northern District",   "total_customers": 18400},
    {"id": "Z4", "name": "Zone 4 - Southern",    "region": "Southern District",   "total_customers":  9600},
    {"id": "Z5", "name": "Zone 5 - Central",     "region": "Central District",    "total_customers": 22100},
    {"id": "Z6", "name": "Zone 6 - Industrial",  "region": "Industrial Corridor", "total_customers":  8300},
]

# Three substations per zone
SUBSTATIONS: dict[str, list[dict]] = {
    "Z1": [
        {"id": "SUB-Z1-A", "name": "Eastfield Primary",    "latitude": 40.7120, "longitude": -73.9850},
        {"id": "SUB-Z1-B", "name": "Riverside Secondary",  "latitude": 40.6950, "longitude": -73.9540},
        {"id": "SUB-Z1-C", "name": "Harbor Distribution",  "latitude": 40.7280, "longitude": -73.9680},
    ],
    "Z2": [
        {"id": "SUB-Z2-A", "name": "Westgate Primary",     "latitude": 40.7350, "longitude": -74.1200},
        {"id": "SUB-Z2-B", "name": "Oakwood Secondary",    "latitude": 40.7180, "longitude": -74.1450},
        {"id": "SUB-Z2-C", "name": "Lakeview Distribution","latitude": 40.7520, "longitude": -74.0980},
    ],
    "Z3": [
        {"id": "SUB-Z3-A", "name": "North Alpha Primary",  "latitude": 40.8200, "longitude": -73.9200},
        {"id": "SUB-Z3-B", "name": "Highland Secondary",   "latitude": 40.8450, "longitude": -73.9050},
        {"id": "SUB-Z3-C", "name": "Ridgeline Distribution","latitude": 40.8100, "longitude": -73.9380},
    ],
    "Z4": [
        {"id": "SUB-Z4-A", "name": "Southfield Primary",   "latitude": 40.6300, "longitude": -74.0100},
        {"id": "SUB-Z4-B", "name": "Valleyview Secondary", "latitude": 40.6150, "longitude": -74.0350},
        {"id": "SUB-Z4-C", "name": "Creekside Distribution","latitude": 40.6420, "longitude": -73.9900},
    ],
    "Z5": [
        {"id": "SUB-Z5-A", "name": "Central Hub Primary",  "latitude": 40.7580, "longitude": -74.0050},
        {"id": "SUB-Z5-B", "name": "Midtown Secondary",    "latitude": 40.7680, "longitude": -73.9920},
        {"id": "SUB-Z5-C", "name": "Downtown Distribution","latitude": 40.7500, "longitude": -74.0180},
    ],
    "Z6": [
        {"id": "SUB-Z6-A", "name": "Industrial Park Primary",  "latitude": 40.6800, "longitude": -74.1600},
        {"id": "SUB-Z6-B", "name": "Manufacturing Secondary",  "latitude": 40.6650, "longitude": -74.1750},
        {"id": "SUB-Z6-C", "name": "Freight Yard Distribution","latitude": 40.6950, "longitude": -74.1480},
    ],
}

# ---------------------------------------------------------------------------
# Equipment metadata
# ---------------------------------------------------------------------------
MANUFACTURERS = ["ABB", "Siemens", "GE Grid Solutions", "Schneider Electric", "Eaton", "Hitachi Energy"]

TYPE_PREFIXES = {
    "transformer": "TF",
    "substation":  "SS",
    "feeder":      "FD",
    "switchgear":  "SW",
}
_counters: dict[str, int] = {t: 0 for t in TYPE_PREFIXES}

NOMINAL_VOLTAGES = {
    "transformer": [11.0, 33.0, 66.0, 132.0],
    "substation":  [33.0, 66.0, 132.0],
    "feeder":      [11.0, 33.0],
    "switchgear":  [11.0, 33.0, 66.0],
}

MODEL_NAMES = {
    "transformer": ["PowerFlex 500", "OilGuard T3", "TriVolt TX", "HVTrans Pro", "CoreShield X"],
    "substation":  ["SubPlex 200",   "GridPoint S4",  "NexGrid SS", "UrbanFlex SF", "CityGrid C2"],
    "feeder":      ["LiteFeed F1",   "FlexLine F3",   "DistFeed D2","LoadShare FX", "SplitPath F7"],
    "switchgear":  ["IsoSwitch G3",  "BreakPro SW5",  "VacuGuard V2","ProtectX GX","SafeArc S9"],
}

# Realistic failure causes by equipment type
FAILURE_CAUSES = {
    "transformer": [
        "Insulation breakdown due to prolonged thermal overload",
        "Oil contamination from moisture ingress",
        "Winding short circuit caused by voltage surge",
        "Core overheating from sustained high load",
        "Bushing failure due to tracking and flashover",
        "Tap changer mechanical jam under load",
        "Lightning strike induced surge damage",
    ],
    "substation": [
        "Busbar flashover during fault current",
        "Control panel relay failure",
        "Battery backup system depleted — protection loss",
        "Switchboard corrosion from humidity ingress",
        "Earth fault on outgoing feeder uncleared",
        "CT/VT secondary wiring failure",
    ],
    "feeder": [
        "Cable insulation aged beyond service life",
        "Joint failure due to thermal cycling",
        "Conductor sag and contact with vegetation",
        "Rodent damage to cable duct",
        "Ground fault from storm debris",
        "Overcurrent trip due to downstream fault",
    ],
    "switchgear": [
        "Vacuum interrupter end-of-life failure",
        "Mechanism jam — spring charge failure",
        "Contact erosion beyond tolerance",
        "Insulation degradation from partial discharge",
        "Trip coil burnout",
        "Operating handle seizure from corrosion",
    ],
}

MAINTENANCE_NOTES = {
    "routine": [
        "Oil sample analysis — dielectric strength within spec.",
        "Thermal imaging scan — no hotspots detected.",
        "Insulation resistance test passed. Recorded in asset register.",
        "Visual inspection complete. No anomalies observed.",
        "Cooling fans and radiators cleaned. Airflow confirmed.",
        "All relay settings verified against protection schedule.",
        "Control wiring continuity checks completed satisfactorily.",
    ],
    "inspection": [
        "Detailed internal inspection. Corrosion found on terminal board — treated.",
        "Dissolved gas analysis performed. H2 slightly elevated — monitor closely.",
        "Infrared thermography completed. Terminal connection running 8°C above ambient.",
        "Bushing condition assessment. Surface tracking noted — cleaning applied.",
        "Tap changer contact wear measured. Within acceptable limits.",
        "Earthing system resistance test: 0.4 Ω (within 1 Ω limit).",
        "Protection relay functional test completed. All trip signals verified.",
    ],
    "repair": [
        "Replaced degraded gasket on main tank inspection cover.",
        "Repaired breached cable duct insulation — new heat-shrink sleeve applied.",
        "Replaced faulty temperature indicator relay.",
        "Rewound and retested control panel terminal connections.",
        "Replaced oil conservator breather silica gel — previous material saturated.",
        "Replaced tripped overcurrent relay after downstream fault clearance.",
        "Cleaned and re-greased tap changer mechanism.",
    ],
    "emergency": [
        "Emergency restoration following thermal trip. Root cause: sustained overload.",
        "Cable splice replacement after insulation failure. Restored in 4h.",
        "Fuse replacement after downstream fault — circuit re-energised.",
        "Emergency oil top-up following minor leak identified during patrol.",
        "Bypass switching during bushing replacement under contingency.",
    ],
}

# ---------------------------------------------------------------------------
# Risk tier profiles
# ---------------------------------------------------------------------------
# Each profile defines ranges that drive correlated sensor readings.
# The risk score emerges naturally from these parameters —
# there is no hardcoded score, only realistic input values.

RISK_PROFILES = {
    "low": {
        "age_range":         (2, 12),
        "temp_base":         (25, 45),
        "load_base":         (30, 60),
        "voltage_dev_abs":   (0.0, 2.0),
        "vibration":         (0.0, 1.5),
        "maintenance_days":  (15, 120),
        "failures_2yr":      0,
        "weather_weights":   {"normal": 0.92, "high_wind": 0.05, "storm": 0.02, "extreme_heat": 0.01},
        "status_weights":    {"operational": 0.98, "maintenance": 0.02},
        "customer_range":    (200, 1500),
        "count_per_zone":    4,
    },
    "medium": {
        "age_range":         (10, 22),
        "temp_base":         (50, 70),
        "load_base":         (60, 78),
        "voltage_dev_abs":   (1.5, 4.5),
        "vibration":         (1.0, 3.5),
        "maintenance_days":  (90, 250),
        "failures_2yr":      1,
        "weather_weights":   {"normal": 0.78, "high_wind": 0.12, "storm": 0.06, "extreme_heat": 0.04},
        "status_weights":    {"operational": 0.90, "degraded": 0.08, "maintenance": 0.02},
        "customer_range":    (800, 3000),
        "count_per_zone":    5,
    },
    "high": {
        "age_range":         (18, 30),
        "temp_base":         (70, 87),
        "load_base":         (78, 92),
        "voltage_dev_abs":   (3.5, 8.0),
        "vibration":         (3.0, 6.5),
        "maintenance_days":  (200, 420),
        "failures_2yr":      2,
        "weather_weights":   {"normal": 0.60, "high_wind": 0.18, "storm": 0.12, "extreme_heat": 0.10},
        "status_weights":    {"operational": 0.72, "degraded": 0.22, "maintenance": 0.06},
        "customer_range":    (1500, 4500),
        "count_per_zone":    3,
    },
    "critical": {
        "age_range":         (25, 40),
        "temp_base":         (85, 115),
        "load_base":         (88, 100),
        "voltage_dev_abs":   (6.0, 15.0),
        "vibration":         (5.5, 12.0),
        "maintenance_days":  (380, 730),
        "failures_2yr":      3,
        "weather_weights":   {"normal": 0.40, "high_wind": 0.22, "storm": 0.18, "extreme_heat": 0.20},
        "status_weights":    {"operational": 0.50, "degraded": 0.35, "critical": 0.15},
        "customer_range":    (2000, 6000),
        "count_per_zone":    2,
    },
}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _weighted_choice(weights: dict[str, float]) -> str:
    keys   = list(weights.keys())
    probs  = list(weights.values())
    return rng.choices(keys, weights=probs, k=1)[0]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _gauss(mu: float, sigma: float) -> float:
    return rng.gauss(mu, sigma)


def _make_equipment_id(etype: str) -> str:
    _counters[etype] += 1
    return f"{TYPE_PREFIXES[etype]}-{_counters[etype]:03d}"


def _pick_substation(zone_id: str) -> dict:
    return rng.choice(SUBSTATIONS[zone_id])


def _equipment_name(etype: str, sub: dict, counter: int) -> str:
    return f"{sub['name']} — {etype.title()} {counter}"


# ---------------------------------------------------------------------------
# Record builders
# ---------------------------------------------------------------------------

def _build_equipment(zone: dict, etype: str, profile: dict) -> dict:
    sub = _pick_substation(zone["id"])
    eid = _make_equipment_id(etype)
    counter = _counters[etype]

    age = rng.randint(*profile["age_range"])
    customers = rng.randint(*profile["customer_range"])
    status = _weighted_choice(profile["status_weights"])
    maintenance_days = rng.randint(*profile["maintenance_days"])

    installed = (BASE_DATE - timedelta(days=age * 365 + rng.randint(0, 180))).date().isoformat()
    last_inspected = (BASE_DATE - timedelta(days=rng.randint(20, max(21, maintenance_days)))).date().isoformat()

    # Slight coordinate scatter around substation
    lat = round(sub["latitude"]  + _gauss(0, 0.008), 4)
    lon = round(sub["longitude"] + _gauss(0, 0.008), 4)

    return {
        "id":                 eid,
        "name":               _equipment_name(etype, sub, counter),
        "type":               etype,
        "substation_id":      sub["id"],
        "substation_name":    sub["name"],
        "zone_id":            zone["id"],
        "zone_name":          zone["name"],
        "age_years":          age,
        "status":             status,
        "customers_affected": customers,
        "manufacturer":       rng.choice(MANUFACTURERS),
        "model":              rng.choice(MODEL_NAMES[etype]),
        "nominal_voltage_kv": rng.choice(NOMINAL_VOLTAGES[etype]),
        "latitude":           lat,
        "longitude":          lon,
        "installed_at":       installed,
        "last_inspected_at":  last_inspected,
        # Denormalized convenience fields (also stored on readings)
        "maintenance_days_ago": maintenance_days,
        "previous_failures_2yr": profile["failures_2yr"] + rng.randint(0, 1),
    }


def _build_reading(equip: dict, profile: dict, offset_hours: int = 0) -> dict:
    """Build a sensor reading record.

    Latest reading (offset_hours=0) is deterministic from profile.
    Historical readings have small Gaussian noise added.
    """
    is_latest = (offset_hours == 0)
    noise = 0.0 if is_latest else _gauss(0, 1)

    t_lo, t_hi = profile["temp_base"]
    l_lo, l_hi = profile["load_base"]
    d_lo, d_hi = profile["voltage_dev_abs"]
    v_lo, v_hi = profile["vibration"]

    temp      = _clamp(_gauss((t_lo + t_hi) / 2, (t_hi - t_lo) / 5) + noise, 15.0, 125.0)
    load      = _clamp(_gauss((l_lo + l_hi) / 2, (l_hi - l_lo) / 5) + noise, 0.0, 100.0)
    vibration = _clamp(_gauss((v_lo + v_hi) / 2, (v_hi - v_lo) / 4) + abs(noise) * 0.2, 0.0, 15.0)
    weather   = _weighted_choice(profile["weather_weights"])

    # Voltage deviation as % of nominal, clamped to +-20%
    nom_v     = equip.get("nominal_voltage_kv", 66.0) or 66.0
    dev_sign  = rng.choice([-1, 1])
    dev_mag   = _clamp(_gauss((d_lo + d_hi) / 2, (d_hi - d_lo) / 4), d_lo, d_hi)
    dev_pct   = _clamp((dev_mag / nom_v) * 100, 0.0, 20.0)
    volt_dev  = round(_clamp(dev_sign * dev_pct + noise * 0.3, -20.0, 20.0), 2)

    # Weather modifiers
    if weather == "extreme_heat":
        temp = _clamp(temp + _gauss(10, 3), 15.0, 125.0)
    elif weather == "storm":
        vibration = _clamp(vibration + _gauss(1.5, 0.5), 0.0, 15.0)
    elif weather == "high_wind":
        vibration = _clamp(vibration + _gauss(0.8, 0.3), 0.0, 15.0)

    ts = (BASE_DATE - timedelta(hours=offset_hours)).isoformat()

    return {
        "id":                    f"R-{equip['id']}-{offset_hours:04d}",
        "equipment_id":          equip["id"],
        "recorded_at":           ts,
        "temperature_c":         round(temp, 1),
        "load_pct":              round(load, 1),
        "voltage_kv":            round(nom_v * (1 + volt_dev / 100), 2),
        "voltage_deviation_pct": volt_dev,
        "vibration_mms":         round(vibration, 2),
        "humidity_pct":          round(_clamp(_gauss(58, 12), 25.0, 95.0), 1),
        "weather_condition":     weather,
        # Denormalized fields so the data service can serve flat records
        "maintenance_days_ago":  equip["maintenance_days_ago"],
        "previous_failures_2yr": equip["previous_failures_2yr"],
        "customer_count":        equip["customers_affected"],
        "equipment_status":      equip["status"],
    }


def _build_maintenance(equip: dict, profile: dict) -> list[dict]:
    """Build a realistic maintenance history."""
    num = rng.randint(3, 8)
    records: list[dict] = []
    days_ago = equip["maintenance_days_ago"]  # most recent first

    for i in range(num):
        # Space records back in time with increasing gaps
        days_ago += rng.randint(90, 365)
        mdate = (BASE_DATE - timedelta(days=days_ago)).date().isoformat()
        mtype = _weighted_choice({
            "routine":   0.50,
            "inspection":0.25,
            "repair":    0.18,
            "emergency": 0.07,
        })
        # Higher-risk equipment more likely to have had issues found
        issue_prob = {"low": 0.08, "medium": 0.20, "high": 0.38, "critical": 0.60}
        tier = _equip_tier(equip)
        issue = rng.random() < issue_prob.get(tier, 0.2)
        note  = rng.choice(MAINTENANCE_NOTES[mtype])

        records.append({
            "id":               f"M-{equip['id']}-{i+1:02d}",
            "equipment_id":     equip["id"],
            "maintenance_date": mdate,
            "maintenance_type": mtype,
            "technician":       _random_technician(),
            "notes":            note,
            "issue_found":      issue,
            "duration_hours":   round(_clamp(_gauss(5, 2.5), 1.0, 16.0), 1),
        })

    return records


def _build_failures(equip: dict, profile: dict) -> list[dict]:
    """Build failure history correlated with the risk tier."""
    tier      = _equip_tier(equip)
    base_num  = profile["failures_2yr"]
    # Older equipment accumulates more lifetime failures
    lifetime  = max(0, int(equip["age_years"] / 8) + rng.randint(-1, 2))
    events: list[dict] = []

    for i in range(lifetime):
        # Spread over equipment lifetime
        max_days = equip["age_years"] * 365
        days_ago = rng.randint(180, max_days)
        occ      = (BASE_DATE - timedelta(days=days_ago)).isoformat()
        dt_h     = round(_clamp(_gauss(6, 4), 0.5, 72.0), 1)
        res      = (datetime.fromisoformat(occ) + timedelta(hours=dt_h)).isoformat()
        # Critical/high equipment has more severe failures
        sev_weights = {
            "critical": {"critical": 0.35, "high": 0.40, "medium": 0.20, "low": 0.05},
            "high":     {"critical": 0.10, "high": 0.45, "medium": 0.35, "low": 0.10},
            "medium":   {"critical": 0.02, "high": 0.25, "medium": 0.50, "low": 0.23},
            "low":      {"critical": 0.00, "high": 0.10, "medium": 0.40, "low": 0.50},
        }
        severity = _weighted_choice(sev_weights.get(tier, sev_weights["medium"]))
        cause    = rng.choice(FAILURE_CAUSES.get(equip["type"], FAILURE_CAUSES["transformer"]))

        events.append({
            "id":                  f"F-{equip['id']}-{i+1:02d}",
            "equipment_id":        equip["id"],
            "occurred_at":         occ,
            "severity":            severity,
            "cause":               cause,
            "downtime_hours":      dt_h,
            "customers_affected":  equip["customers_affected"],
            "resolved_at":         res,
        })

    return sorted(events, key=lambda e: e["occurred_at"], reverse=True)


# ---------------------------------------------------------------------------
# Named hero records (anchor points for demo)
# ---------------------------------------------------------------------------

HERO_EQUIPMENT = [
    # The single most prominent CRITICAL unit — always TF-001
    {
        "id":                   "TF-001",
        "name":                 "North Alpha Primary — Transformer 1",
        "type":                 "transformer",
        "substation_id":        "SUB-Z3-A",
        "substation_name":      "North Alpha Primary",
        "zone_id":              "Z3",
        "zone_name":            "Zone 3 - Northern",
        "age_years":            28,
        "status":               "degraded",
        "customers_affected":   4200,
        "manufacturer":         "ABB",
        "model":                "PowerFlex 500",
        "nominal_voltage_kv":   132.0,
        "latitude":             40.8205,
        "longitude":           -73.9198,
        "installed_at":         "1995-06-12",
        "last_inspected_at":    "2022-11-04",
        "maintenance_days_ago": 437,
        "previous_failures_2yr":3,
    },
]

HERO_READINGS = {
    "TF-001": {
        "temperature_c":         97.4,
        "load_pct":              96.8,
        "voltage_kv":            145.2,
        "voltage_deviation_pct": 10.0,
        "vibration_mms":         8.7,
        "humidity_pct":          72.0,
        "weather_condition":     "extreme_heat",
    },
}

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

_TECHNICIANS = [
    "Marcus Webb",    "Sandra Osei",    "Jamal Torres",    "Li Wei",
    "Priya Sharma",   "Connor O'Brien", "Fatima Al-Rashid","Derek Muller",
    "Yuki Tanaka",    "Carlos Reyes",   "Anna Kovacs",     "Samuel Okonkwo",
]


def _random_technician() -> str:
    return rng.choice(_TECHNICIANS)


def _equip_tier(equip: dict) -> str:
    """Determine the tier of an equipment record from its profile fields."""
    m = equip.get("maintenance_days_ago", 100)
    f = equip.get("previous_failures_2yr", 0)
    a = equip.get("age_years", 10)
    if m > 380 or f >= 3 or a >= 25:
        return "critical"
    if m > 200 or f >= 2 or a >= 18:
        return "high"
    if m > 90  or f >= 1 or a >= 10:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

EQUIP_TYPES = list(TYPE_PREFIXES.keys())

def generate() -> None:
    equipment_list:  list[dict] = []
    readings_list:   list[dict] = []
    maintenance_list:list[dict] = []
    failures_list:   list[dict] = []

    # Add hero equipment first so IDs are deterministic
    hero_ids = {h["id"] for h in HERO_EQUIPMENT}
    # Reserve counter slots
    _counters["transformer"] = 1   # TF-001 is reserved
    equipment_list.extend(HERO_EQUIPMENT)

    # Build readings, maintenance, failures for heroes
    for hero in HERO_EQUIPMENT:
        tier = _equip_tier(hero)
        profile = RISK_PROFILES[tier]
        # Latest reading: use hero overrides
        base_r = _build_reading(hero, profile, 0)
        override = HERO_READINGS.get(hero["id"], {})
        base_r.update(override)
        # Sync denormalized fields
        base_r["maintenance_days_ago"]   = hero["maintenance_days_ago"]
        base_r["previous_failures_2yr"]  = hero["previous_failures_2yr"]
        base_r["customer_count"]         = hero["customers_affected"]
        base_r["equipment_status"]       = hero["status"]
        readings_list.append(base_r)
        # Historical readings (7 days, every 4 hours)
        for h in range(4, 7 * 24, 4):
            readings_list.append(_build_reading(hero, profile, h))
        maintenance_list.extend(_build_maintenance(hero, profile))
        failures_list.extend(_build_failures(hero, profile))

    # Generate per-zone equipment by tier
    for zone in ZONES:
        for tier, profile in RISK_PROFILES.items():
            count = profile["count_per_zone"]
            # Z6 Industrial gets extra HIGH/CRITICAL because of harsh environment
            if zone["id"] == "Z6" and tier in ("high", "critical"):
                count += 1

            for _ in range(count):
                etype = rng.choice(EQUIP_TYPES)
                equip = _build_equipment(zone, etype, profile)

                # Skip if this ID was already used by a hero
                if equip["id"] in hero_ids:
                    continue

                equipment_list.append(equip)

                # Latest reading
                readings_list.append(_build_reading(equip, profile, 0))
                # Historical readings (7 days, every 4 hours)
                for h in range(4, 7 * 24, 4):
                    readings_list.append(_build_reading(equip, profile, h))

                maintenance_list.extend(_build_maintenance(equip, profile))
                failures_list.extend(_build_failures(equip, profile))

    # ── Write files ──────────────────────────────────────────────────────────
    def save(name: str, data: list) -> None:
        path = DATA_DIR / f"{name}.json"
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, default=str)
        print(f"  {len(data):>5}  records  ->  {path.name}")

    # Build substation list for reference
    substation_list = [
        sub
        for subs in SUBSTATIONS.values()
        for sub in subs
    ]

    print("=" * 60)
    print("GridWise Data Generator v2  (seed=42)")
    print("=" * 60)
    save("zones",       ZONES)
    save("substations", substation_list)
    save("equipment",   equipment_list)
    save("readings",    readings_list)
    save("maintenance", maintenance_list)
    save("failures",    failures_list)
    save("alerts",      [])
    print("=" * 60)
    print(f"  Total equipment : {len(equipment_list)}")
    print(f"  Total readings  : {len(readings_list)}")
    print(f"  Total zones     : {len(ZONES)}")
    print(f"  Total subs      : {len(substation_list)}")


if __name__ == "__main__":
    generate()
