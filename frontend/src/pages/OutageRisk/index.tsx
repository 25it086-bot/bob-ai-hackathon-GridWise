import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Zap, Users, RefreshCw, ChevronDown,
  ChevronUp, BarChart2, Shield, Activity, Info, MapPin,
  AlertCircle, CheckCircle2, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOutagePredictions,
  useOutageFleetSummary,
  useOutageZoneScenario,
} from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { RiskBadge } from "@/components/common/RiskBadge";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { cn } from "@/lib/cn";
import { formatNumber, formatRelativeTime } from "@/lib/formatters";
import { CHART_COLORS } from "@/config/constants";
import type { OutageSummary, OutageScenario, OutageRiskLevel } from "@/types/outage";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const OUTAGE_LEVELS: OutageRiskLevel[] = ["critical", "high", "medium", "low", "minimal"];

/** Map outage level → CSS variable tokens */
function levelVars(level: string) {
  if (level === "critical") return { tx: "var(--color-critical-tx)", bg: "var(--color-critical-bg)", bd: "var(--color-critical-bd)", dot: "var(--color-critical)" };
  if (level === "high")     return { tx: "var(--color-high-tx)",     bg: "var(--color-high-bg)",     bd: "var(--color-high-bd)",     dot: "var(--color-high)" };
  if (level === "medium")   return { tx: "var(--color-medium-tx)",   bg: "var(--color-medium-bg)",   bd: "var(--color-medium-bd)",   dot: "var(--color-medium)" };
  if (level === "low")      return { tx: "var(--color-low-tx)",       bg: "var(--color-low-bg)",      bd: "var(--color-low-bd)",      dot: "var(--color-low)" };
  return                           { tx: "var(--color-text-3)",       bg: "var(--color-base-3)",      bd: "var(--color-base-5)",      dot: "var(--color-text-3)" };
}

function levelChartColor(level: string): string {
  const map: Record<string, string> = {
    critical: CHART_COLORS.critical,
    high:     CHART_COLORS.high,
    medium:   CHART_COLORS.medium,
    low:      CHART_COLORS.low,
  };
  return map[level] ?? CHART_COLORS.muted;
}

const COMPLEXITY_LABELS: Record<string, string> = {
  complex:        "Complex",
  moderate:       "Moderate",
  straightforward:"Straightforward",
};
const COMPLEXITY_COLOR: Record<string, string> = {
  complex:        "text-[var(--color-critical-tx)]",
  moderate:       "text-[var(--color-high-tx)]",
  straightforward:"text-[var(--color-low-tx)]",
};
const IMPACT_TIER_COLOR: Record<string, string> = {
  high:   "text-[var(--color-critical-tx)]",
  medium: "text-[var(--color-high-tx)]",
  low:    "text-[var(--color-low-tx)]",
};

const RESPONSE_PLAYBOOK: Record<string, string> = {
  critical: "Immediate dispatch required. Activate emergency response protocol. Notify affected customers and coordinate with grid operations centre.",
  high:     "Schedule urgent inspection within 24 hours. Prepare maintenance crew and spare parts. Monitor continuously until resolved.",
  medium:   "Plan scheduled maintenance within 7 days. Increase monitoring frequency. Review load balancing options.",
  low:      "Add to next routine maintenance cycle. Document and continue standard monitoring.",
  minimal:  "No immediate action required. Continue standard monitoring schedule.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Prototype disclaimer banner
// ─────────────────────────────────────────────────────────────────────────────

function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[var(--color-brand)] bg-[rgba(59,130,246,0.06)] text-[11px] text-[var(--color-text-2)]">
      <Info size={13} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold text-[var(--color-brand)]">Prototype estimate —</span>{" "}
        All outage risk scores, probabilities and customer impact figures are derived from
        simulated grid data using heuristic models. They do not represent real-world
        operational guarantees or certified risk assessments.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fleet KPI bar
// ─────────────────────────────────────────────────────────────────────────────

function FleetKpi({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">{label}</p>
      <p className="font-mono text-[22px] font-bold leading-none truncate" style={{ color: accent ?? "var(--color-text-0)" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--color-text-3)]">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk score gauge — horizontal bar with level shading
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBar({ score, level }: { score: number; level: string }) {
  const vars = levelVars(level);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-text-3)]">Outage risk</span>
        <span className="font-mono font-bold" style={{ color: vars.tx }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-base-4)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, score)}%`, background: vars.dot }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[var(--color-text-3)]">
        <span>0 Minimal</span>
        <span>75 Critical</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity pill for key risk factors
// ─────────────────────────────────────────────────────────────────────────────

function SevPill({ severity }: { severity: string }) {
  const vars = levelVars(severity);
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 border"
      style={{ color: vars.tx, background: vars.bg, borderColor: vars.bd }}
    >
      {severity}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone scenario detail panel (fetched on expand)
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioDetail({ zoneId }: { zoneId: string }) {
  const { data, isLoading, isError } = useOutageZoneScenario(zoneId);

  if (isLoading) {
    return (
      <div className="px-5 pb-5 pt-3 space-y-3">
        <LoadingSkeleton variant="text" rows={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="px-5 pb-5 pt-3">
        <ErrorBanner message="Could not load scenario detail." />
      </div>
    );
  }

  return <ScenarioDetailContent scenario={data} />;
}

function ScenarioDetailContent({ scenario: s }: { scenario: OutageScenario }) {
  const navigate = useNavigate();
  const vars = levelVars(s.risk_level);

  return (
    <div className="border-t border-[var(--color-base-4)] divide-y divide-[var(--color-base-4)]">

      {/* ── Impact estimates ── */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Expected Customers</p>
          <p className="font-mono text-[18px] font-bold text-[var(--color-text-0)] mt-0.5">
            {formatNumber(s.estimated_impact.expected_customers_affected)}
          </p>
          <p className="text-[10px] text-[var(--color-text-3)]">expected-value estimate</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Worst Case</p>
          <p className="font-mono text-[18px] font-bold text-[var(--color-critical-tx)] mt-0.5">
            {formatNumber(s.estimated_impact.worst_case_customers)}
          </p>
          <p className="text-[10px] text-[var(--color-text-3)]">full zone outage</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Est. Downtime</p>
          <p className="font-mono text-[18px] font-bold text-[var(--color-text-0)] mt-0.5">
            {s.estimated_impact.expected_downtime_hours.toFixed(1)}h
          </p>
          <p className="text-[10px] text-[var(--color-text-3)]">historical baseline</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Restoration</p>
          <p className={cn("text-[15px] font-semibold mt-0.5", COMPLEXITY_COLOR[s.estimated_impact.restoration_complexity])}>
            {COMPLEXITY_LABELS[s.estimated_impact.restoration_complexity] ?? s.estimated_impact.restoration_complexity}
          </p>
          <p className={cn("text-[10px] font-semibold mt-0.5", IMPACT_TIER_COLOR[s.estimated_impact.economic_impact_tier])}>
            {s.estimated_impact.economic_impact_tier.toUpperCase()} economic impact
          </p>
        </div>
      </div>

      {/* ── Key risk factors ── */}
      {s.key_risk_factors.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-[var(--color-text-1)] mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-[var(--color-text-3)]" />
            Key Risk Factors
          </p>
          <div className="space-y-2">
            {s.key_risk_factors.map((f) => (
              <div
                key={f.factor_name}
                className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-base-4)] bg-[var(--color-base-3)]"
              >
                <SevPill severity={f.severity} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[12px] font-semibold text-[var(--color-text-1)]">{f.factor_label}</p>
                  <p className="text-[11px] text-[var(--color-text-3)] leading-snug">{f.description}</p>
                  <p className="text-[10px] text-[var(--color-text-3)]">
                    Primary driver in <span className="font-semibold text-[var(--color-text-2)]">{f.affected_units}</span> unit{f.affected_units !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contributing equipment ── */}
      {s.contributing_equipment.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-[var(--color-text-1)] mb-3 flex items-center gap-1.5">
            <Zap size={12} className="text-[var(--color-text-3)]" />
            Contributing Equipment
            <span className="text-[10px] font-normal text-[var(--color-text-3)]">
              — units with outage contribution ≥ 8%
            </span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--color-base-4)]">
                  {["Equipment", "Type", "Substation", "Risk Score", "Outage Contrib.", "Customers", "Primary Factor"].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-base-4)]">
                {s.contributing_equipment.map((eq) => {
                  const eqVars = levelVars(eq.equipment_risk_level);
                  return (
                    <tr
                      key={eq.equipment_id}
                      className="hover:bg-[var(--color-base-3)] cursor-pointer transition-colors"
                      onClick={() => navigate(`/equipment/${eq.equipment_id}`)}
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-[var(--color-text-0)] hover:text-[var(--color-brand)] transition-colors">
                          {eq.equipment_name}
                        </p>
                        <p className="font-mono text-[10px] text-[var(--color-brand)]">{eq.equipment_id}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-[11px] capitalize rounded px-1.5 py-0.5 bg-[var(--color-base-4)] text-[var(--color-text-2)]">
                          {eq.equipment_type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-text-2)] truncate max-w-[120px]">
                        {eq.substation_name || "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-mono font-bold text-[13px]" style={{ color: eqVars.tx }}>
                          {eq.equipment_risk_score.toFixed(0)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(eq.outage_contribution * 100)}%`,
                                background: eqVars.dot,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-[var(--color-text-2)] whitespace-nowrap">
                            {(eq.outage_contribution * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[var(--color-text-2)]">
                        {formatNumber(eq.customers_at_risk)}
                      </td>
                      <td className="py-2.5 text-[var(--color-text-3)] truncate max-w-[140px]">
                        {eq.primary_risk_factor}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recommended response ── */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold text-[var(--color-text-1)] mb-2 flex items-center gap-1.5">
          <Shield size={12} className="text-[var(--color-text-3)]" />
          Recommended Response
        </p>
        <div
          className="flex items-start gap-3 p-3 rounded-lg border-l-2"
          style={{
            borderColor:  vars.dot,
            background:   vars.bg,
            borderTopColor:    "var(--color-base-4)",
            borderRightColor:  "var(--color-base-4)",
            borderBottomColor: "var(--color-base-4)",
          }}
        >
          <div
            className="shrink-0 w-2 h-2 rounded-full mt-1"
            style={{ background: vars.dot }}
          />
          <p className="text-[12px] leading-snug" style={{ color: vars.tx }}>
            {RESPONSE_PLAYBOOK[s.risk_level]}
          </p>
        </div>
        <p className="mt-2 text-[10px] text-[var(--color-text-3)] italic">{s.disclaimer}</p>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone scenario card (collapsed + expandable)
// ─────────────────────────────────────────────────────────────────────────────

function ZoneScenarioCard({
  summary,
  rank,
  defaultOpen,
}: {
  summary: OutageSummary;
  rank: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const vars = levelVars(summary.risk_level);

  const coveragePct =
    summary.total_zone_customers > 0
      ? Math.round((summary.potentially_affected_customers / summary.total_zone_customers) * 100)
      : 0;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: open ? vars.bd : "var(--color-base-4)",
        background:  "var(--color-base-2)",
      }}
    >
      {/* ── Card header (always visible) ── */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-stretch">
          {/* Rank + level stripe */}
          <div
            className="flex flex-col items-center justify-center w-14 shrink-0 gap-1 py-4"
            style={{ background: vars.bg, borderRight: `1px solid ${vars.bd}` }}
          >
            <span className="font-mono text-[11px] font-bold" style={{ color: vars.tx }}>
              #{rank}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: vars.dot }}
            />
          </div>

          {/* Main header content */}
          <div className="flex-1 px-4 py-3.5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text-0)]">
                    {summary.zone_name}
                  </h3>
                  <RiskBadge level={summary.risk_level} size="sm" />
                </div>
                <p className="text-[11px] text-[var(--color-text-3)] mt-0.5 flex items-center gap-1">
                  <MapPin size={10} />
                  {summary.zone_id}
                  {summary.primary_risk_driver !== "No significant risk factors" && (
                    <> · Primary driver: <span className="text-[var(--color-text-2)]">{summary.primary_risk_driver}</span></>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {open ? (
                  <ChevronUp size={16} className="text-[var(--color-text-3)]" />
                ) : (
                  <ChevronDown size={16} className="text-[var(--color-text-3)]" />
                )}
              </div>
            </div>

            {/* KPI row */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Outage risk score */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                  Outage Risk Score
                </p>
                <p className="font-mono text-[20px] font-bold leading-none" style={{ color: vars.tx }}>
                  {summary.outage_risk_score.toFixed(0)}
                  <span className="text-[11px] text-[var(--color-text-3)]"> / 100</span>
                </p>
              </div>

              {/* Probability */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                  Outage Probability
                </p>
                <p className="font-mono text-[20px] font-bold leading-none text-[var(--color-text-0)]">
                  {(summary.outage_probability * 100).toFixed(1)}
                  <span className="text-[11px] text-[var(--color-text-3)]">%</span>
                </p>
              </div>

              {/* Affected customers */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                  Customers at Risk
                </p>
                <p className="font-mono text-[20px] font-bold leading-none text-[var(--color-text-0)]">
                  {formatNumber(summary.potentially_affected_customers)}
                </p>
                <p className="text-[9px] text-[var(--color-text-3)]">
                  {coveragePct}% of zone ({formatNumber(summary.total_zone_customers)} total)
                </p>
              </div>

              {/* Critical / High counts */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                  At-Risk Equipment
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-critical-tx)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-critical)]" />
                    {summary.critical_equipment} critical
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-high-tx)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-high)]" />
                    {summary.high_risk_equipment} high
                  </span>
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-3">
              <ScoreBar score={summary.outage_risk_score} level={summary.risk_level} />
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded detail (fetched lazily) ── */}
      {open && <ScenarioDetail zoneId={summary.zone_id} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk-by-zone bar chart (outage_risk_score)
// ─────────────────────────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { zone_name: string; risk_level: string; outage_probability: number } }>;
  label?: string;
}

function ZoneRiskTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const vars = levelVars(d.risk_level);
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded-lg px-3 py-2.5 text-xs shadow-lg space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-[var(--color-text-0)]">{d.zone_name}</p>
      <p className="font-mono" style={{ color: vars.tx }}>
        Risk score: <span className="font-bold">{payload[0].value.toFixed(1)}</span>
      </p>
      <p className="text-[var(--color-text-2)]">
        Outage prob: {(d.outage_probability * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function ZoneRiskChart({ summaries }: { summaries: OutageSummary[] }) {
  const data = [...summaries]
    .sort((a, b) => b.outage_risk_score - a.outage_risk_score)
    .slice(0, 12)
    .map((s) => ({
      zone_name:          s.zone_name.length > 10 ? s.zone_name.slice(0, 10) + "…" : s.zone_name,
      zone_name_full:     s.zone_name,
      risk_level:         s.risk_level,
      outage_risk_score:  s.outage_risk_score,
      outage_probability: s.outage_probability,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="zone_name"
          tick={{ fontSize: 10, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ZoneRiskTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="outage_risk_score" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={levelChartColor(d.risk_level)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer impact bar chart
// ─────────────────────────────────────────────────────────────────────────────

interface ImpactTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill?: string }>;
  label?: string;
}

function ImpactTooltip({ active, payload, label }: ImpactTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded-lg px-3 py-2.5 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-[var(--color-text-0)]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono text-[var(--color-text-2)]">
          {p.name}: <span className="font-bold text-[var(--color-text-0)]">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CustomerImpactChart({ summaries }: { summaries: OutageSummary[] }) {
  const data = [...summaries]
    .sort((a, b) => b.potentially_affected_customers - a.potentially_affected_customers)
    .slice(0, 10)
    .map((s) => ({
      name:       s.zone_name.length > 10 ? s.zone_name.slice(0, 10) + "…" : s.zone_name,
      level:      s.risk_level,
      expected:   s.potentially_affected_customers,
      worst_case: s.total_zone_customers,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ImpactTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="worst_case" name="Worst case" fill={CHART_COLORS.grid} radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Bar dataKey="expected" name="Expected" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={levelChartColor(d.level)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Level filter pills
// ─────────────────────────────────────────────────────────────────────────────

function LevelPills({
  active,
  counts,
  onChange,
}: {
  active: string;
  counts: Record<string, number>;
  onChange: (l: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by outage risk level">
      <button
        type="button"
        onClick={() => onChange("")}
        aria-pressed={active === ""}
        className={cn(
          "px-3 py-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-widest transition-colors",
          active === ""
            ? "bg-[var(--color-base-4)] border-[var(--color-base-5)] text-[var(--color-text-0)]"
            : "border-[var(--color-base-4)] text-[var(--color-text-3)] hover:border-[var(--color-base-5)]"
        )}
      >
        All · {Object.values(counts).reduce((a, b) => a + b, 0)}
      </button>
      {OUTAGE_LEVELS.map((level) => {
        const vars = levelVars(level);
        const isActive = active === level;
        const count = counts[level] ?? 0;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(isActive ? "" : level)}
            aria-pressed={isActive}
            className="px-3 py-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-widest transition-colors"
            style={isActive
              ? { background: vars.bg, borderColor: vars.bd, color: vars.tx }
              : { borderColor: "var(--color-base-4)", color: "var(--color-text-3)" }
            }
          >
            {level} · {count}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fleet summary skeleton
// ─────────────────────────────────────────────────────────────────────────────

function FleetSkeleton() {
  return (
    <div className="space-y-6">
      <Card><LoadingSkeleton variant="text" rows={3} /></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><LoadingSkeleton variant="card" /></Card>
        <Card><LoadingSkeleton variant="card" /></Card>
      </div>
      {[0, 1, 2].map((i) => (
        <Card key={i}><LoadingSkeleton variant="text" rows={4} /></Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function OutageRiskPage() {
  const qc = useQueryClient();
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"outage_risk_score" | "outage_probability" | "potentially_affected_customers">("outage_risk_score");

  const { data: fleet, isLoading: fleetLoading, isError: fleetError, refetch: refetchFleet } = useOutageFleetSummary();
  const { data: predictions, isLoading: predLoading, isError: predError, refetch: refetchPred } = useOutagePredictions({ sort_by: sortBy });

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["outage"] });
    refetchFleet();
    refetchPred();
  }, [qc, refetchFleet, refetchPred]);

  const isLoading = fleetLoading || predLoading;

  if (isLoading) {
    return (
      <PageWrapper title="Outage Risk" subtitle="Loading scenario analysis…">
        <FleetSkeleton />
      </PageWrapper>
    );
  }

  if (fleetError || predError) {
    return (
      <PageWrapper title="Outage Risk" subtitle="">
        <ErrorBanner
          message="Could not load outage risk data. Ensure the backend is running."
          onRetry={handleRefresh}
        />
      </PageWrapper>
    );
  }

  // Derived
  const summaries = predictions ?? [];
  const levelCounts = summaries.reduce<Record<string, number>>((acc, s) => {
    acc[s.risk_level] = (acc[s.risk_level] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = levelFilter
    ? summaries.filter((s) => s.risk_level === levelFilter)
    : summaries;

  // Expand top-2 by default
  const topIds = new Set(summaries.slice(0, 2).map((s) => s.zone_id));

  return (
    <PageWrapper
      title="Outage Risk"
      subtitle="Zone-level outage scenario analysis · Independent failure probability model"
      action={
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-base-4)] text-sm text-[var(--color-brand)] hover:border-[var(--color-base-5)] transition-colors"
          title="Refresh scenarios"
        >
          <RefreshCw size={13} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      <DisclaimerBanner />

      {/* ══════════════════════════════════════════════════════════════════
          FLEET-WIDE SUMMARY BAR
      ══════════════════════════════════════════════════════════════════ */}
      {fleet && (
        <Card>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-[var(--color-text-3)]" />
              <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Fleet Overview</h2>
              <span className="text-[10px] text-[var(--color-text-3)]">
                · assessed {formatRelativeTime(fleet.assessed_at)}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-text-3)] italic hidden md:block">
              {fleet.disclaimer}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 divide-y sm:divide-y-0 divide-[var(--color-base-4)]">
            <FleetKpi
              label="Zones Assessed"
              value={fleet.total_zones_assessed}
            />
            <FleetKpi
              label="Critical Zones"
              value={fleet.critical_outage_zones}
              accent={fleet.critical_outage_zones > 0 ? "var(--color-critical-tx)" : undefined}
            />
            <FleetKpi
              label="High-Risk Zones"
              value={fleet.high_outage_zones}
              accent={fleet.high_outage_zones > 0 ? "var(--color-high-tx)" : undefined}
            />
            <FleetKpi
              label="Customers at Risk"
              value={formatNumber(fleet.total_customers_at_risk)}
              sub={`of ${formatNumber(fleet.total_fleet_customers)} total`}
            />
            <FleetKpi
              label="Fleet Outage Prob."
              value={`${(fleet.fleet_outage_probability * 100).toFixed(1)}%`}
              sub="P(≥1 zone outage)"
              accent="var(--color-text-0)"
            />
            <FleetKpi
              label="Highest Risk Zone"
              value={fleet.highest_risk_zone}
              sub={`Score: ${fleet.highest_risk_score.toFixed(1)}`}
              accent="var(--color-high-tx)"
            />
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CHARTS
      ══════════════════════════════════════════════════════════════════ */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Outage risk by zone */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} className="text-[var(--color-text-3)]" />
              <h2 className="text-[13px] font-semibold text-[var(--color-text-0)]">Outage Risk Score by Zone</h2>
            </div>
            <ZoneRiskChart summaries={summaries} />
            <p className="text-[10px] text-[var(--color-text-3)] mt-2 italic">
              Top 12 zones · colour = risk level · scale 0–100
            </p>
          </Card>

          {/* Customer impact */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-[var(--color-text-3)]" />
              <h2 className="text-[13px] font-semibold text-[var(--color-text-0)]">Potentially Affected Customers</h2>
            </div>
            <CustomerImpactChart summaries={summaries} />
            <p className="text-[10px] text-[var(--color-text-3)] mt-2 italic">
              Top 10 zones · grey = worst case, coloured = expected value
            </p>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ZONE SCENARIO CARDS
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        {/* Header + controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--color-text-3)]" />
            <h2 className="text-[15px] font-semibold text-[var(--color-text-0)]">
              Zone Outage Scenarios
            </h2>
            <span className="text-[11px] text-[var(--color-text-3)]">
              ({filtered.length} zone{filtered.length !== 1 ? "s" : ""})
            </span>
          </div>
          {/* Sort control */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-3)]">
            <Activity size={12} />
            Sort:
            {(["outage_risk_score", "outage_probability", "potentially_affected_customers"] as const).map((key) => {
              const labels = { outage_risk_score: "Risk Score", outage_probability: "Probability", potentially_affected_customers: "Customers" };
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortBy(key)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px]",
                    sortBy === key
                      ? "bg-[var(--color-brand)] text-white"
                      : "hover:bg-[var(--color-base-4)] text-[var(--color-text-2)]"
                  )}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level filter pills */}
        <div className="mb-4">
          <LevelPills active={levelFilter} counts={levelCounts} onChange={setLevelFilter} />
        </div>

        {/* Level hierarchy legend */}
        <div className="flex flex-wrap gap-4 mb-5 px-1">
          {([
            { level: "minimal", label: "0–14 · Minimal",  desc: "Normal operations" },
            { level: "low",     label: "15–34 · Low",      desc: "Monitor closely" },
            { level: "medium",  label: "35–54 · Medium",   desc: "Plan maintenance" },
            { level: "high",    label: "55–74 · High",     desc: "Urgent inspection" },
            { level: "critical",label: "75–100 · Critical", desc: "Immediate action" },
          ] as const).map(({ level, label, desc }) => {
            const vars = levelVars(level);
            return (
              <div key={level} className="flex items-center gap-2 text-[10px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: vars.dot }} />
                <span style={{ color: vars.tx }} className="font-semibold">{label}</span>
                <span className="text-[var(--color-text-3)]">— {desc}</span>
              </div>
            );
          })}
        </div>

        {/* Scenario list */}
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title="No scenarios match filter"
              message="Try selecting a different risk level or clearing the filter."
              action={{ label: "Clear filter", onClick: () => setLevelFilter("") }}
              className="py-12"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <ZoneScenarioCard
                key={s.zone_id}
                summary={s}
                rank={summaries.indexOf(s) + 1}
                defaultOpen={topIds.has(s.zone_id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Bottom disclaimer ── */}
      <div className="pt-2 border-t border-[var(--color-base-4)]">
        <p className="text-[10px] text-[var(--color-text-3)] italic flex items-start gap-1.5">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          All outage risk scores, probabilities and customer impact figures are heuristic
          prototype estimates derived from simulated grid data. They are not a substitute
          for certified engineering assessments or real-time SCADA data.
        </p>
      </div>

    </PageWrapper>
  );
}
