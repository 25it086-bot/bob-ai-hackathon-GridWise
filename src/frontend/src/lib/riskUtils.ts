import type { RiskLevel } from "@/types/risk";
import { RISK_COLORS } from "@/config/constants";

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function riskColor(level: RiskLevel) {
  return RISK_COLORS[level] ?? RISK_COLORS.low;
}

export function riskRowClass(level: string | undefined): string {
  if (level === "critical") return "row-critical";
  if (level === "high") return "row-high";
  return "";
}

export function scoreColor(score: number): string {
  const level = riskLevelFromScore(score);
  return RISK_COLORS[level].dot;
}
