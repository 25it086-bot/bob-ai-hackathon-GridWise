import { apiClient } from "./client";
import type { Alert } from "@/types/alert";
import type { PaginatedResponse } from "@/types/api";

export const alertsApi = {
  list: (params = {}): Promise<PaginatedResponse<Alert>> =>
    apiClient.get("/alerts", { params }),
  unreadCount: (): Promise<{ count: number }> =>
    apiClient.get("/alerts/unread-count"),
  acknowledge: (id: string): Promise<Alert> =>
    apiClient.patch(`/alerts/${id}/acknowledge`, { acknowledged: true }),
};
