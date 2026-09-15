import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Zap, AlertTriangle, CheckCircle, Bell,
  Activity, Shield, TrendingUp, ChevronRight,
  ThermometerSun, Server,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardSummary, useEquipmentRanking } from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { MetricCard } from "@/components/common/MetricCard";
import { ProgressRing } from "@/components/common/ProgressRing";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Card } from "@/components/common/Card";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import { RiskDistributionChart } from "@/components/charts/RiskDistributionChart";
import { formatNumber, formatRelativeTime } from "@/lib/formatters";
import type { RiskLevel } from "@/types/risk";
import type { ZoneSummary } from "@/types/zone";
import type { Alert } from "@/types/alert";
import type { Recommendation } from "@/types/recommendation";

// ── Section header ────────────────────────────────────────────────────
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--color-text-0)] leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-[var(--color-text-3)] mt-0.5 italic">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Zone Tile ─────────────────────────────────────────────────────────
function ZoneTile({ zone, onClick }: { zone: ZoneSummary; onClick: () => void }) {
  const level = zone.zone_risk_level as RiskLevel;

  const borderAccent: Record<string, string> = {
    critical: "border-l-[var(--color-critical)]",
    high:     "border-l-[var(--color-high)]",
    medium:   "border-l-[var(--color-medium)]",
    low:      "border-l-[var(--color-low)]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View zone ${zone.name}`}
      className={[
        "w-full text-left p-3 rounded border border-l-2 border-[var(--color-base-4)]",
        "cursor-pointer hover:bg-[var(--color-base-4)] transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]",
        borderAccent[level] ?? "border-l-[var(--color-base-5)]",
      ].join(" ")}
      style={{ background: "var(--color-base-3)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[13px] font-semibold text-[var(--color-text-0)] leading-tight truncate">{zone.name}</span>
        <RiskBadge level={level} size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-x-2 text-[11px] text-[var(--color-text-3)]">
        <span title="Equipment count">
          <span className="text-[var(--color-text-2)]">{zone.total_equipment}</span> units
        </span>
        <span title="Customers in zone">
          <span className="text-[var(--color-text-2)]">{formatNumber(zone.total_customers)}</span> cust.
        </span>
        {zone.critical_count > 0 && (
          <span className="col-span-2 text-[var(--color-critical-tx)]">
            {zone.critical_count} critical unit{zone.critical_count !== 1 ? "s" : ""}
          </span>
        )}
        {zone.outage_probability != null && (
          <span className="col-span-2" title="Estimated outage probability for this zone">
            Outage P: <span className="text-[var(--color-text-1)]">{(zone.outage_probability * 100).toFixed(0)}%</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ── Alert Feed Item ───────────────────────────────────────────────────
function AlertFeedItem({ alert }: { alert: Alert }) {
  const isCritical = alert.severity === "critical";
  const isHigh = alert.severity === "high";

  return (
    <div
      className={[
        "px-4 py-3 border-b border-[var(--color-base-4)] last:border-0",
        "hover:bg-[var(--color-base-3)] transition-colors",
        isCritical ? "border-l-2 border-l-[var(--color-critical)]" : "",
        isHigh     ? "border-l-2 border-l-[var(--color-high)]"     : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={14}
          className={[
            "mt-0.5 shrink-0",
            isCritical ? "text-[var(--color-critical)]" : "text-[var(--color-high)]",
          ].join(" ")}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p
            className={[
              "text-sm leading-snug line-clamp-2",
              !alert.acknowledged
                ? "font-semibold text-[var(--color-text-0)]"
                : "text-[var(--color-text-2)]",
            ].join(" ")}
          >
            {alert.message}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="font-mono text-[10px] text-[var(--color-brand)] bg-[var(--color-base-3)] px-1.5 py-0.5 rounded"
              title="Equipment ID"
            >
              {alert.equipment_id}
            </span>
            {alert.equipment_name && (
              <span className="text-[10px] text-[var(--color-text-2)] truncate max-w-[120px]">
                {alert.equipment_name}
              </span>
            )}
            <span className="text-[10px] text-[var(--color-text-3)] ml-auto">
              {formatRelativeTime(alert.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recommendation Item ───────────────────────────────────────────────
function RecommendationItem({ rec }: { rec: Recommendation }) {
  const priorityConfig: Record<
    string,
    { pill: string; icon: React.ReactNode }
  > = {
    urgent: {
      pill: "text-[var(--color-critical-tx)] bg-[var(--color-critical-bg)] border border-[var(--color-critical-bd)]",
      icon: <AlertTriangle size={11} className="text-[var(--color-critical)]" aria-hidden />,
    },
    scheduled: {
      pill: "text-[var(--color-high-tx)] bg-[var(--color-high-bg)] border border-[var(--color-high-bd)]",
      icon: <Activity size={11} className="text-[var(--color-high)]" aria-hidden />,
    },
    monitor: {
      pill: "text-[var(--color-text-2)] bg-[var(--color-base-3)] border border-[var(--color-base-5)]",
      icon: <Shield size={11} className="text-[var(--color-text-3)]" aria-hidden />,
    },
  };

  const cfg = priorityConfig[rec.priority] ?? priorityConfig.monitor;

  return (
    <div className="px-4 py-3 border-b border-[var(--color-base-4)] last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.pill}`}
        >
          {cfg.icon}
          {rec.priority}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-brand)]">{rec.equipment_id}</span>
        {rec.equipment_name && (
          <span className="text-[10px] text-[var(--color-text-3)] truncate">{rec.equipment_name}</span>
        )}
      </div>
      <p className="text-[13px] text-[var(--color-text-1)] leading-snug line-clamp-2">{rec.action}</p>
      {rec.rationale && (
        <p className="text-[11px] text-[var(--color-text-3)] mt-1 line-clamp-1 italic">{rec.rationale}</p>
      )}
    </div>
  );
}

// ── Risk Ranking Row ──────────────────────────────────────────────────
function RankRow({
  equip,
  rank,
  onClick,
}: {
  equip: any;
  rank: number;
  onClick: () => void;
}) {
  const level = (equip.risk_level ?? "low") as RiskLevel;

  const scoreColorMap: Record<string, string> = {
    critical: "text-[var(--color-critical-tx)]",
    high:     "text-[var(--color-high-tx)]",
    medium:   "text-[var(--color-medium-tx)]",
    low:      "text-[var(--color-low-tx)]",
    unknown:  "text-[var(--color-text-3)]",
  };

  const barColor: Record<string, string> = {
    critical: "bg-[var(--color-critical)]",
    high:     "bg-[var(--color-high)]",
    medium:   "bg-[var(--color-medium)]",
    low:      "bg-[var(--color-low)]",
    unknown:  "bg-[var(--color-base-5)]",
  };

  const rowAccent =
    level === "critical"
      ? "row-critical"
      : level === "high"
      ? "row-high"
      : "";

  return (
    <tr
      className={`border-b border-[var(--color-base-4)] cursor-pointer hover:bg-[var(--color-base-3)] transition-colors ${rowAccent}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`View equipment ${equip.name}`}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--color-text-3)] w-8">{rank}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-brand)] whitespace-nowrap">
        {equip.id}
      </td>
      <td className="px-3 py-2.5 text-[13px] text-[var(--color-text-1)] max-w-[160px] truncate">
        {equip.name}
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell">
        <span className="text-xs text-[var(--color-text-2)] capitalize">{equip.type}</span>
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-[var(--color-text-2)] truncate max-w-[100px]">
        {equip.zone_name ?? equip.zone_id}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Mini score bar */}
          <div
            className="hidden sm:block h-1.5 w-12 rounded-full bg-[var(--color-base-4)] overflow-hidden"
            title={`Risk score: ${equip.risk_score?.toFixed(0)}`}
          >
            <div
              className={`h-full rounded-full ${barColor[level]}`}
              style={{ width: `${Math.min(100, equip.risk_score ?? 0)}%` }}
            />
          </div>
          <span className={`font-mono text-sm font-semibold ${scoreColorMap[level]}`}>
            {equip.risk_score?.toFixed(0) ?? "—"}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <RiskBadge level={level} size="sm" />
      </td>
    </tr>
  );
}

// ── Grid Health Card ──────────────────────────────────────────────────
function GridHealthCard({
  healthScore,
  totalEquipment,
  lastScoredAt,
  isLoading,
  criticalCount,
}: {
  healthScore: number;
  totalEquipment: number;
  lastScoredAt?: string;
  isLoading: boolean;
  criticalCount: number;
}) {
  const statusLabel =
    healthScore >= 80
      ? "HEALTHY"
      : healthScore >= 60
      ? "DEGRADED"
      : healthScore >= 40
      ? "AT RISK"
      : "CRITICAL";

  const statusColor =
    healthScore >= 80
      ? "text-[var(--color-low-tx)]"
      : healthScore >= 60
      ? "text-[var(--color-medium-tx)]"
      : healthScore >= 40
      ? "text-[var(--color-high-tx)]"
      : "text-[var(--color-critical-tx)]";

  return (
    <div
      className="bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      role="region"
      aria-label="Grid health score"
    >
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex items-center gap-4">
          <ProgressRing score={healthScore} size={80} strokeWidth={7} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
              Grid Health
            </p>
            <p className={`text-sm font-bold mt-0.5 ${statusColor}`}>{statusLabel}</p>
            <p className="text-xs text-[var(--color-text-2)] mt-1">
              {formatNumber(totalEquipment)} monitored units
            </p>
            {criticalCount > 0 && (
              <p className="text-[11px] text-[var(--color-critical-tx)] mt-0.5">
                {criticalCount} critical unit{criticalCount !== 1 ? "s" : ""}
              </p>
            )}
            <p className="text-[10px] text-[var(--color-text-3)] mt-1">
              {lastScoredAt ? `Scored ${formatRelativeTime(lastScoredAt)}` : "Awaiting score"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useDashboardSummary();
  const { data: rankingData, isLoading: rankLoading } = useEquipmentRanking(10);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["equipment"] });
    refetch();
  };

  const refreshAction = (
    <button
      type="button"
      onClick={handleRefresh}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:text-[var(--color-text-0)] transition-colors px-3 py-1.5 rounded border border-[var(--color-base-4)] hover:border-[var(--color-base-5)]"
      title="Refresh all dashboard data"
    >
      <RefreshCw size={13} />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  return (
    <PageWrapper
      title="Grid Operations Dashboard"
      subtitle="Real-time equipment risk intelligence · Prototype estimates only"
      action={refreshAction}
    >
      {/* ── Error banner ── */}
      {isError && (
        <ErrorBanner
          message={(error as any)?.message ?? "Failed to load dashboard data. Check the backend connection."}
          onRetry={refetch}
        />
      )}

      {/* ── ROW 1: KPI Strip ─────────────────────────────────────────── */}
      {/* 
        Layout:
          col 1 (span-2 on lg): Grid Health Score (ring + status)
          col 2: Critical Equipment
          col 3: High Risk Equipment
          col 4: Potential Outages
          col 5: Total Monitored
      */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
          {/* 1 — Grid Health Score */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <GridHealthCard
              healthScore={data?.grid_health_score ?? 0}
              totalEquipment={data?.total_equipment ?? 0}
              lastScoredAt={data?.last_scored_at}
              isLoading={isLoading}
              criticalCount={data?.critical_count ?? 0}
            />
          </div>

          {/* 2 — Critical Equipment */}
          {isLoading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg p-5"
                >
                  <LoadingSkeleton />
                </div>
              ))}
            </>
          ) : (
            <>
              <MetricCard
                label="Critical Equipment"
                value={data?.critical_count ?? 0}
                accentColor="var(--color-critical)"
                isGlowing={(data?.critical_count ?? 0) > 0}
                subLabel={(data?.critical_count ?? 0) > 0 ? "Immediate attention" : "None detected"}
                onClick={() => navigate("/equipment?risk_level=critical")}
              />
              <MetricCard
                label="High Risk Equipment"
                value={data?.high_count ?? 0}
                accentColor="var(--color-high)"
                subLabel={(data?.high_count ?? 0) > 0 ? "Schedule inspection" : "None detected"}
                onClick={() => navigate("/equipment?risk_level=high")}
              />
              <MetricCard
                label="Potential Outages"
                value={data?.outage_risk_zones ?? 0}
                accentColor="var(--color-ai-purple)"
                subLabel={
                  (data?.estimated_customers_at_risk ?? 0) > 0
                    ? `~${formatNumber(data?.estimated_customers_at_risk ?? 0)} cust. at risk`
                    : "No zones elevated"
                }
                onClick={() => navigate("/outage")}
              />
              <MetricCard
                label="Total Monitored"
                value={formatNumber(data?.total_equipment ?? 0)}
                accentColor="var(--color-brand)"
                subLabel={
                  data
                    ? `${data.medium_count} medium · ${data.low_count} low`
                    : undefined
                }
                onClick={() => navigate("/equipment")}
              />
            </>
          )}
        </div>
      </section>

      {/* ── ROW 2: Risk Trend + Risk Distribution + Zone Overview ─────── */}
      <section aria-label="Risk overview charts" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4">
        {/* Risk Trend — 5/12 */}
        <Card className="md:col-span-1 lg:col-span-5">
          <SectionHeader
            title="Equipment Risk Trend"
            subtitle="7-day rolling count by risk level"
          />
          {isLoading ? (
            <div className="skeleton h-[200px] w-full rounded" />
          ) : data?.risk_trend_7d?.length ? (
            <RiskTrendChart data={data.risk_trend_7d} />
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No trend data available"
              message="Risk trend will populate as scoring data accumulates."
              className="h-[200px]"
            />
          )}
        </Card>

        {/* Risk Distribution — 3/12 */}
        <Card className="md:col-span-1 lg:col-span-3">
          <SectionHeader
            title="Risk Distribution"
            subtitle="Equipment by risk level"
          />
          {isLoading ? (
            <div className="skeleton h-[180px] w-full rounded" />
          ) : (
            <RiskDistributionChart
              critical={data?.critical_count ?? 0}
              high={data?.high_count ?? 0}
              medium={data?.medium_count ?? 0}
              low={data?.low_count ?? 0}
            />
          )}
        </Card>

        {/* Zone Risk Overview — 4/12 */}
        <Card className="md:col-span-2 lg:col-span-4">
          <SectionHeader
            title="Zone Risk Overview"
            subtitle="Current risk level by grid zone"
            action={
              <button
                type="button"
                className="text-[11px] text-[var(--color-brand)] hover:underline shrink-0 flex items-center gap-0.5"
                onClick={() => navigate("/zones")}
              >
                All zones <ChevronRight size={11} />
              </button>
            }
          />
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[76px] rounded" />
              ))}
            </div>
          ) : data?.zone_summaries?.length ? (
            <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {data.zone_summaries.map((zone) => (
                <ZoneTile
                  key={zone.id}
                  zone={zone}
                  onClick={() => navigate("/zones")}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Server}
              title="No zones loaded"
              message="Zone data will appear once equipment is assigned to grid zones."
              className="h-[180px]"
            />
          )}
        </Card>
      </section>

      {/* ── ROW 3: Equipment Ranking + Alerts + Recommendations ─────── */}
      <section aria-label="Equipment ranking and alerts" className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Equipment Risk Ranking — 3/5 */}
        <Card padding="none" className="lg:col-span-3">
          <div className="px-5 py-4 border-b border-[var(--color-base-4)] flex items-start justify-between gap-3">
            <SectionHeader
              title="Equipment Risk Ranking"
              subtitle="Top 10 by current risk score — click to view details"
            />
            <button
              type="button"
              className="text-[11px] text-[var(--color-brand)] hover:underline shrink-0 flex items-center gap-0.5 mt-0.5"
              onClick={() => navigate("/equipment")}
            >
              View all <ChevronRight size={11} />
            </button>
          </div>

          {rankLoading ? (
            <div className="p-4">
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : rankingData?.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full" role="table" aria-label="Equipment risk ranking">
                <thead>
                  <tr className="bg-[var(--color-base-1)] border-b border-[var(--color-base-4)]">
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] w-8">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                      ID
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                      Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden md:table-cell">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden lg:table-cell">
                      Zone
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                      Score
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankingData.data.map((eq, idx) => (
                    <RankRow
                      key={eq.id}
                      equip={eq}
                      rank={idx + 1}
                      onClick={() => navigate(`/equipment/${eq.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title="No equipment data"
              message="Load equipment data to see risk rankings."
              action={{ label: "Go to Data Upload →", onClick: () => navigate("/data") }}
              className="py-12"
            />
          )}
        </Card>

        {/* Right column: Alerts + Recommendations */}
        <div className="lg:col-span-2 flex flex-col gap-3 lg:gap-4">
          {/* Recent Alerts */}
          <Card padding="none" className="flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-[var(--color-base-4)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[var(--color-text-3)]" aria-hidden />
                <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Recent Alerts</h2>
                {!isLoading && (data?.recent_alerts?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-critical)] text-white text-[10px] font-bold">
                    {Math.min((data?.recent_alerts?.length ?? 0), 99)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="text-[11px] text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
                onClick={() => navigate("/alerts")}
              >
                View all <ChevronRight size={11} />
              </button>
            </div>
            {isLoading ? (
              <div className="p-4">
                <LoadingSkeleton variant="text" rows={4} />
              </div>
            ) : data?.recent_alerts?.length ? (
              <div>
                {data.recent_alerts.slice(0, 5).map((alert) => (
                  <AlertFeedItem key={alert.id} alert={alert} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle}
                title="No active alerts"
                message="All equipment is within normal operating parameters."
                className="py-8"
              />
            )}
          </Card>

          {/* Recommended Actions — AI */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-[var(--color-base-4)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-[var(--color-ai-purple)]" aria-hidden />
                <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">
                  Recommended Actions
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ai-purple)] font-semibold border border-[rgba(139,92,246,.3)] rounded-full px-1.5 py-0.5"
                  title="AI-generated recommendations from the GridWise risk engine"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-purple)]" />
                  AI
                </span>
              </div>
              <button
                type="button"
                className="text-[11px] text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
                onClick={() => navigate("/recommendations")}
              >
                View all <ChevronRight size={11} />
              </button>
            </div>
            {isLoading ? (
              <div className="p-4">
                <LoadingSkeleton variant="text" rows={3} />
              </div>
            ) : data?.top_recommendations?.length ? (
              <div>
                {data.top_recommendations.slice(0, 4).map((rec) => (
                  <RecommendationItem key={rec.id} rec={rec} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ThermometerSun}
                title="No active recommendations"
                message="Recommendations will appear when equipment risk is elevated."
                className="py-6"
              />
            )}
          </Card>
        </div>
      </section>

      {/* ── Disclaimer footer ── */}
      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        GridWise Risk Intelligence · Prototype estimates based on simulated grid data ·{" "}
        <strong>Not a real-world operational guarantee</strong> · For demonstration purposes only
      </p>
    </PageWrapper>
  );
}
