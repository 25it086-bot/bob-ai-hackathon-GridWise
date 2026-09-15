import { apiClient } from "./client";
import type { DashboardSummary } from "@/types/dashboard";

export const dashboardApi = {
  getSummary: (): Promise<DashboardSummary> =>
    apiClient.get("/dashboard/summary"),
};
