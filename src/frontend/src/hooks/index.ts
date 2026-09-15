import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard";
import { equipmentApi, type EquipmentFilters } from "@/api/equipment";
import { alertsApi } from "@/api/alerts";
import { zonesApi } from "@/api/zones";
import { outageApi, type OutagePredictionsParams } from "@/api/outage";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export function useEquipmentList(filters: EquipmentFilters = {}) {
  return useQuery({
    queryKey: ["equipment", "list", filters],
    queryFn: () => equipmentApi.list(filters),
    staleTime: 120_000,
  });
}

export function useEquipmentRanking(limit = 10) {
  return useQuery({
    queryKey: ["equipment", "ranking", limit],
    queryFn: () => equipmentApi.ranking(limit),
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
}

export function useEquipmentDetail(id: string) {
  return useQuery({
    queryKey: ["equipment", "detail", id],
    queryFn: () => equipmentApi.getById(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

export function useEquipmentRisk(id: string) {
  return useQuery({
    queryKey: ["equipment", "risk", id],
    queryFn: () => equipmentApi.getRisk(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

export function useAlerts(params = {}) {
  return useQuery({
    queryKey: ["alerts", "list", params],
    queryFn: () => alertsApi.list(params),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useZoneList() {
  return useQuery({
    queryKey: ["zones", "list"],
    queryFn: zonesApi.list,
    staleTime: 300_000,
  });
}

export function useEquipmentRecommendations(id: string) {
  return useQuery({
    queryKey: ["equipment", "recommendations", id],
    queryFn: () => equipmentApi.getRecommendations(id),
    staleTime: 60_000,
    enabled: Boolean(id),
  });
}

export function useOutagePredictions(params: OutagePredictionsParams = {}) {
  return useQuery({
    queryKey: ["outage", "predictions", params],
    queryFn: () => outageApi.getPredictions(params),
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

export function useOutageFleetSummary() {
  return useQuery({
    queryKey: ["outage", "fleet"],
    queryFn: outageApi.getFleetSummary,
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

export function useOutageZoneScenario(zoneId: string) {
  return useQuery({
    queryKey: ["outage", "zone", zoneId],
    queryFn: () => outageApi.getZoneScenario(zoneId),
    staleTime: 60_000,
    enabled: Boolean(zoneId),
  });
}

export function useOutageCustomerImpact() {
  return useQuery({
    queryKey: ["outage", "impact"],
    queryFn: outageApi.getCustomerImpact,
    staleTime: 120_000,
  });
}
