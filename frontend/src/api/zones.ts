import { apiClient } from "./client";
import type { ZoneSummary } from "@/types/zone";

export const zonesApi = {
  list: (): Promise<ZoneSummary[]> => apiClient.get("/zones"),
  getById: (id: string): Promise<ZoneSummary & { equipment_ids: string[] }> =>
    apiClient.get(`/zones/${id}`),
};
