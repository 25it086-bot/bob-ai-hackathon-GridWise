import { apiClient } from "./client";
import type { EquipmentSummary, EquipmentDetail } from "@/types/equipment";
import type { PaginatedResponse } from "@/types/api";
import type { RiskScore } from "@/types/risk";
import type { Recommendation } from "@/types/recommendation";

export interface EquipmentFilters {
  zone_id?: string;
  risk_level?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
}

export const equipmentApi = {
  list: (filters: EquipmentFilters = {}): Promise<PaginatedResponse<EquipmentSummary>> =>
    apiClient.get("/equipment", { params: filters }),

  ranking: (limit = 10): Promise<{ data: EquipmentSummary[] }> =>
    apiClient.get("/equipment/ranking", { params: { limit } }),

  getById: (id: string): Promise<EquipmentDetail> =>
    apiClient.get(`/equipment/${id}`),

  getRisk: (id: string): Promise<RiskScore> =>
    apiClient.get(`/equipment/${id}/risk`),

  getRecommendations: (id: string): Promise<{ data: Recommendation[] }> =>
    apiClient.get(`/equipment/${id}/recommendations`),
};
