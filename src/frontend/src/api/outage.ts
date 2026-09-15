import { apiClient } from "./client";
import type {
  OutageScenario,
  OutageSummary,
  OutageFleetSummary,
  CustomerImpactRow,
} from "@/types/outage";

export interface OutagePredictionsParams {
  min_score?: number;
  risk_level?: string;
  sort_by?: "outage_risk_score" | "outage_probability" | "potentially_affected_customers";
  sort_dir?: "asc" | "desc";
}

export const outageApi = {
  /** All zone outage summaries (list view) */
  getPredictions: (params: OutagePredictionsParams = {}): Promise<OutageSummary[]> =>
    apiClient.get("/outage/predictions", { params }),

  /** Fleet-wide aggregated outage summary */
  getFleetSummary: (): Promise<OutageFleetSummary> =>
    apiClient.get("/outage/fleet"),

  /** Full scenario for a single zone */
  getZoneScenario: (zoneId: string): Promise<OutageScenario> =>
    apiClient.get(`/outage/zones/${zoneId}`),

  /** Customer impact rows for bar chart */
  getCustomerImpact: (): Promise<CustomerImpactRow[]> =>
    apiClient.get("/outage/impact"),
};
