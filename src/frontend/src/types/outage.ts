/**
 * Outage risk types — mirrors backend/app/schemas/outage.py
 *
 * IMPORTANT: All values are prototype estimates based on simulated data.
 * Not real-world operational guarantees.
 */

export type OutageRiskLevel = "critical" | "high" | "medium" | "low" | "minimal";

export interface ContributingEquipment {
  equipment_id:         string;
  equipment_name:       string;
  equipment_type:       string;
  substation_name:      string;
  equipment_risk_score: number;
  equipment_risk_level: string;
  outage_contribution:  number;  // 0-1
  customers_at_risk:    number;
  primary_risk_factor:  string;
}

export interface KeyRiskFactor {
  factor_name:    string;
  factor_label:   string;
  severity:       string;   // critical | high | medium | low
  description:    string;
  affected_units: number;
}

export interface EstimatedImpact {
  expected_customers_affected: number;
  worst_case_customers:        number;
  expected_downtime_hours:     number;
  economic_impact_tier:        string;  // high | medium | low
  restoration_complexity:      string;  // complex | moderate | straightforward
}

export interface OutageScenario {
  zone_id:                        string;
  zone_name:                      string;
  outage_risk_score:              number;  // 0-100
  risk_level:                     OutageRiskLevel;
  outage_probability:             number;  // 0-1
  affected_zone:                  string;
  potentially_affected_customers: number;
  total_zone_customers:           number;
  estimated_impact:               EstimatedImpact;
  contributing_equipment:         ContributingEquipment[];
  key_risk_factors:               KeyRiskFactor[];
  total_equipment_in_zone:        number;
  critical_equipment_count:       number;
  high_risk_equipment_count:      number;
  avg_equipment_risk_score:       number;
  assessed_at:                    string;
  disclaimer:                     string;
}

export interface OutageSummary {
  zone_id:                        string;
  zone_name:                      string;
  outage_risk_score:              number;
  risk_level:                     OutageRiskLevel;
  outage_probability:             number;
  potentially_affected_customers: number;
  total_zone_customers:           number;
  critical_equipment:             number;
  high_risk_equipment:            number;
  primary_risk_driver:            string;
}

export interface OutageFleetSummary {
  total_zones_assessed:       number;
  critical_outage_zones:      number;
  high_outage_zones:          number;
  total_customers_at_risk:    number;
  total_fleet_customers:      number;
  highest_risk_zone:          string;
  highest_risk_score:         number;
  fleet_outage_probability:   number;
  assessed_at:                string;
  disclaimer:                 string;
}

export interface CustomerImpactRow {
  zone_id:                     string;
  zone_name:                   string;
  risk_level:                  OutageRiskLevel;
  outage_risk_score:           number;
  expected_customers_affected: number;
  worst_case_customers:        number;
  critical_equipment:          number;
  high_risk_equipment:         number;
}
