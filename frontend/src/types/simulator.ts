/**
 * Simulator types — mirror backend/app/schemas/risk.py RiskInput / RiskOutput / FactorScore
 */

export type WeatherCondition = "normal" | "extreme_heat" | "storm" | "high_wind";

/** Matches backend RiskInput */
export interface SimulatorInput {
  equipment_id:            string;
  temperature_c:           number | null;
  load_pct:                number | null;
  vibration_mms:           number | null;
  age_years:               number | null;
  days_since_maintenance:  number | null;
  previous_failures:       number | null;
  weather_condition:       WeatherCondition | null;
  customers_affected:      number;
}

/** Matches backend FactorScore */
export interface SimFactorScore {
  factor:             string;
  label:              string;
  raw_value:          number | null;
  normalized_value:   number;
  weight:             number;
  score_contribution: number;
  pct_of_total:       number;
  is_primary_driver:  boolean;
}

/** Matches backend RiskOutput */
export interface SimulatorResult {
  equipment_id:          string;
  risk_score:            number;
  risk_level:            "critical" | "high" | "medium" | "low";
  contributing_factors:  string[];
  factor_scores:         SimFactorScore[];
  recommended_actions:   string[];
  scored_at:             string;
}
