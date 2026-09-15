// zone.ts
export interface ZoneSummary {
  id: string;
  name: string;
  region: string;
  total_equipment: number;
  total_customers: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  zone_risk_score: number;
  zone_risk_level: string;
  outage_probability?: number;
}
