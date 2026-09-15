export type EquipmentType = "transformer" | "substation" | "feeder" | "switchgear";
export type EquipmentStatus = "operational" | "degraded" | "critical" | "offline" | "maintenance";

export interface EquipmentSummary {
  id: string;
  name: string;
  type: EquipmentType;
  zone_id: string;
  zone_name?: string;
  substation_name?: string;
  age_years: number;
  status: EquipmentStatus;
  customers_affected: number;
  risk_score?: number;
  risk_level?: string;
  load_pct?: number;
  temperature_c?: number;
  vibration_mms?: number;
  days_since_maintenance?: number;
  previous_failures_2yr?: number;
}

export interface EquipmentReading {
  id: string;
  equipment_id: string;
  recorded_at: string;
  temperature_c: number;
  load_pct: number;
  voltage_kv: number;
  voltage_deviation_pct: number;
  vibration_mms: number;
  humidity_pct: number;
  weather_condition: string;
}

export interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  maintenance_date: string;
  maintenance_type: string;
  technician: string;
  notes: string;
  issue_found: boolean;
  duration_hours?: number;
}

export interface FailureEvent {
  id: string;
  equipment_id: string;
  occurred_at: string;
  severity: string;
  cause: string;
  downtime_hours: number;
  customers_affected: number;
  resolved_at?: string;
}

export interface EquipmentDetail {
  id: string;
  name: string;
  type: EquipmentType;
  zone_id: string;
  zone_name?: string;
  substation_id?: string;
  substation_name?: string;
  age_years: number;
  status: EquipmentStatus;
  customers_affected: number;
  manufacturer?: string;
  model?: string;
  nominal_voltage_kv?: number;
  latitude?: number;
  longitude?: number;
  installed_at?: string;
  last_inspected_at?: string;
  maintenance_days_ago: number;
  previous_failures_2yr: number;
  current_reading?: EquipmentReading;
  maintenance_records: MaintenanceRecord[];
  failure_events: FailureEvent[];
}
