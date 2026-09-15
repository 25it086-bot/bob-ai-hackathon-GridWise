export type RiskLevel = "critical" | "high" | "medium" | "low" | "unknown";

export interface RiskFactor {
  name: string;
  label: string;
  normalized_value: number;
  weighted_contribution: number;
  weight: number;
  is_primary_driver: boolean;
}

export interface RiskScore {
  equipment_id: string;
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  outage_probability: number;
  estimated_customers_affected: number;
  scored_at: string;
}

export interface RiskTrendPoint {
  date: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}
