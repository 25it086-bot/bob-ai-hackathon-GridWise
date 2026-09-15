import type { RiskTrendPoint } from "./risk";
import type { ZoneSummary } from "./zone";
import type { Alert } from "./alert";
import type { Recommendation } from "./recommendation";

export interface DashboardSummary {
  grid_health_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_equipment: number;
  outage_risk_zones: number;
  estimated_customers_at_risk: number;
  risk_trend_7d: RiskTrendPoint[];
  zone_summaries: ZoneSummary[];
  recent_alerts: Alert[];
  top_recommendations: Recommendation[];
  last_scored_at?: string;
}
