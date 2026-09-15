import type { RiskLevel } from "@/types/risk";

export const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium", "low", "unknown"];

export const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; dot: string }> = {
  critical: { text: "var(--color-critical-tx)", bg: "var(--color-critical-bg)", border: "var(--color-critical-bd)", dot: "var(--color-critical)" },
  high:     { text: "var(--color-high-tx)",     bg: "var(--color-high-bg)",     border: "var(--color-high-bd)",     dot: "var(--color-high)" },
  medium:   { text: "var(--color-medium-tx)",   bg: "var(--color-medium-bg)",   border: "var(--color-medium-bd)",   dot: "var(--color-medium)" },
  low:      { text: "var(--color-low-tx)",      bg: "var(--color-low-bg)",      border: "var(--color-low-bd)",      dot: "var(--color-low)" },
  unknown:  { text: "var(--color-unknown-tx)",  bg: "var(--color-unknown-bg)",  border: "var(--color-unknown-bd)",  dot: "var(--color-unknown)" },
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "CRITICAL",
  high:     "HIGH",
  medium:   "MEDIUM",
  low:      "LOW",
  unknown:  "UNKNOWN",
};

export const STATUS_COLORS: Record<string, string> = {
  operational: "var(--color-low)",
  degraded:    "var(--color-high)",
  critical:    "var(--color-critical)",
  offline:     "var(--color-unknown)",
  maintenance: "var(--color-brand)",
};

export const CHART_COLORS = {
  critical: "#EF4444",
  high:     "#F59E0B",
  medium:   "#EAB308",
  low:      "#10B981",
  brand:    "#3B82F6",
  grid:     "#1F2937",
  muted:    "#6B7280",
};

export const NAV_ITEMS = [
  {
    section: "OPERATIONS",
    items: [
      { label: "Dashboard",       path: "/",               icon: "LayoutDashboard" },
      { label: "Equipment Risk",  path: "/equipment",      icon: "Zap" },
      { label: "Grid Zones",      path: "/zones",          icon: "Map" },
      { label: "Outage Risk",     path: "/outage",         icon: "AlertTriangle" },
    ],
  },
  {
    section: "INTELLIGENCE",
    items: [
      { label: "What-If Simulator", path: "/simulator",      icon: "FlaskConical" },
      { label: "Recommendations",   path: "/recommendations", icon: "Shield" },
    ],
  },
  {
    section: "MONITORING",
    items: [
      { label: "Alerts",  path: "/alerts",  icon: "Bell" },
    ],
  },
  {
    section: "DATA",
    items: [
      { label: "Data Upload", path: "/data",     icon: "Upload" },
      { label: "Settings",    path: "/settings", icon: "Settings" },
    ],
  },
] as const;
