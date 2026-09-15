export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Alert {
  id: string;
  equipment_id: string;
  zone_id?: string;
  equipment_name?: string;
  created_at: string;
  severity: AlertSeverity;
  alert_type: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at?: string;
}
