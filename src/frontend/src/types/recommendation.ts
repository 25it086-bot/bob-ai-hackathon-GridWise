export type RecommendationPriority = "urgent" | "scheduled" | "monitor";

export interface Recommendation {
  id: string;
  equipment_id: string;
  equipment_name?: string;
  zone_id?: string;
  priority: RecommendationPriority;
  action: string;
  rationale: string;
  generated_at: string;
  dismissed: boolean;
}
