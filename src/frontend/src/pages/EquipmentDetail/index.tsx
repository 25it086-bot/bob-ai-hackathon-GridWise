import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Thermometer, Activity, Zap, Wind, Calendar,
  Cpu, Wrench, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, RefreshCw, BrainCircuit,
} from "lucide-react";
import { useEquipmentDetail, useEquipmentRisk, useEquipmentRecommendations } from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ProgressRing } from "@/components/common/ProgressRing";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { AiRiskInsight } from "@/components/common/AiRiskInsight";
import { cn } from "@/lib/cn";
import {
  formatNumber, formatDate, formatDateTime, formatRelativeTime,
} from "@/lib/formatters";
import type { MaintenanceRecord, FailureEvent } from "@/types/equipment";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns CSS var name string for a risk level */
function riskVar(level: string, suffix: "tx" | "bg" | "bd" | ""): string {
  const valid = ["critical", "high", "medium", "low"].includes(level) ? level : "unknown";
  return suffix ? `var(--color-${valid}-${suffix})` : `var(--color-${valid})`;
}

const WEATHER_LABELS: Record<string, string> = {
  normal:       "Normal",
  extreme_heat: "Extreme Heat",
  storm:        "Storm",
  high_wind:    "High Wind",
};

const WEATHER_ICONS: Record<string, React.ElementType> = {
  normal:       Wind,
  extreme_heat: Thermometer,
  storm:        AlertTriangle,
  high_wind:    Wind,
};

const WEATHER_COLOR: Record<string, string> = {
  normal:       "text-[var(--color-low-tx)]",
  extreme_heat: "text-[var(--color-critical-tx)]",
  storm:        "text-[var(--color-high-tx)]",
  high_wind:    "text-[var(--color-medium-tx)]",
};

// ─────────────────────────────────────────────────────────────────────────────
// MetricTile — one sensor / attribute reading
// ─────────────────────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  unit = "",
  decimals = 1,
  icon: Icon,
  warnAbove,
  critAbove,
  subtitle,
}: {
  label: string;
  value?: number | string | null;
  unit?: string;
  decimals?: number;
  icon: React.ElementType;
  warnAbove?: number;
  critAbove?: number;
  subtitle?: string;
}) {
  const num   = typeof value === "number" ? value : null;
  const isCrit = num != null && critAbove != null && num >= critAbove;
  const isWarn = num != null && warnAbove != null && num >= warnAbove && !isCrit;
  const state  = isCrit ? "critical" : isWarn ? "high" : null;

  const borderStyle = state
    ? { borderColor: riskVar(state, "bd") }
    : {};
  const bgStyle = state
    ? { background: riskVar(state, "bg") }
    : {};

  return (
    <div
      className="p-4 rounded-lg border border-[var(--color-base-4)] bg-[var(--color-base-2)] flex flex-col gap-3"
      style={{ ...borderStyle, ...bgStyle }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            size={14}
            style={{ color: state ? riskVar(state, "tx") : "var(--color-text-3)" }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
            {label}
          </span>
        </div>
        {state && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border"
            style={{
              color:            riskVar(state, "tx"),
              background:       riskVar(state, "bg"),
              borderColor:      riskVar(state, "bd"),
            }}
          >
            {state.toUpperCase()}
          </span>
        )}
      </div>

      <div
        className="font-mono text-[26px] font-bold leading-none"
        style={{ color: state ? riskVar(state, "tx") : "var(--color-text-0)" }}
      >
        {value == null
          ? <span className="text-[var(--color-text-3)] text-base">—</span>
          : typeof value === "string"
            ? value
            : `${num!.toFixed(decimals)}${unit}`}
      </div>

      {subtitle && (
        <p className="text-[10px] text-[var(--color-text-3)] leading-snug">{subtitle}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WeatherTile — dedicated weather display
// ─────────────────────────────────────────────────────────────────────────────

function WeatherTile({ condition }: { condition?: string | null }) {
  const key = condition ?? "normal";
  const Icon = WEATHER_ICONS[key] ?? Wind;
  const label = WEATHER_LABELS[key] ?? (condition ?? "Unknown");
  const colorClass = WEATHER_COLOR[key] ?? "text-[var(--color-text-2)]";
  const isAdverse = key !== "normal";

  return (
    <div
      className={cn(
        "p-4 rounded-lg border flex flex-col gap-3",
        isAdverse
          ? "bg-[var(--color-high-bg)] border-[var(--color-high-bd)]"
          : "bg-[var(--color-base-2)] border-[var(--color-base-4)]"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={isAdverse ? "text-[var(--color-high-tx)]" : "text-[var(--color-text-3)]"}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
          Weather
        </span>
      </div>
      <span className={cn("text-base font-semibold leading-none", colorClass)}>
        {label}
      </span>
      {isAdverse && (
        <p className="text-[10px] text-[var(--color-high-tx)] leading-snug">
          Adverse conditions — risk contribution elevated
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MaintenanceRow
// ─────────────────────────────────────────────────────────────────────────────

function MaintenanceRow({ record }: { record: MaintenanceRecord }) {
  return (
    <tr className="border-b border-[var(--color-base-4)] last:border-0 hover:bg-[var(--color-base-3)] transition-colors">
      <td className="px-4 py-3 text-sm text-[var(--color-text-1)] whitespace-nowrap">
        {formatDate(record.maintenance_date)}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs capitalize rounded px-1.5 py-0.5 bg-[var(--color-base-4)] text-[var(--color-text-2)]">
          {record.maintenance_type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-text-2)] hidden sm:table-cell">
        {record.technician}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {record.issue_found ? (
          <span className="text-[11px] font-semibold text-[var(--color-high-tx)]">Issue found</span>
        ) : (
          <span className="text-[11px] text-[var(--color-low-tx)]">Clear</span>
        )}
      </td>
      {record.duration_hours != null && (
        <td className="px-4 py-3 font-mono text-sm text-[var(--color-text-2)] hidden lg:table-cell">
          {record.duration_hours.toFixed(1)}h
        </td>
      )}
      <td className="px-4 py-3 text-xs text-[var(--color-text-3)] hidden xl:table-cell max-w-[200px] truncate">
        {record.notes}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FailureRow
// ─────────────────────────────────────────────────────────────────────────────

function FailureRow({ event }: { event: FailureEvent }) {
  const sevStyle: Record<string, string> = {
    critical: "text-[var(--color-critical-tx)]",
    high:     "text-[var(--color-high-tx)]",
    medium:   "text-[var(--color-medium-tx)]",
    low:      "text-[var(--color-low-tx)]",
  };
  return (
    <tr className="border-b border-[var(--color-base-4)] last:border-0 hover:bg-[var(--color-base-3)] transition-colors">
      <td className="px-4 py-3 text-sm text-[var(--color-text-1)] whitespace-nowrap">
        {formatDate(event.occurred_at)}
      </td>
      <td className="px-4 py-3">
        <span className={cn("text-xs font-bold uppercase tracking-wide", sevStyle[event.severity])}>
          {event.severity}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-text-2)] max-w-[200px] truncate">
        {event.cause}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-[var(--color-text-1)]">
        {event.downtime_hours.toFixed(1)}h
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-text-2)] hidden sm:table-cell">
        {formatNumber(event.customers_affected)}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
  badge,
  aside,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon size={15} className="text-[var(--color-text-3)] shrink-0" />
      <h2 className="text-[15px] font-semibold text-[var(--color-text-0)]">{title}</h2>
      {badge}
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table wrapper
// ─────────────────────────────────────────────────────────────────────────────

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--color-base-1)] border-b border-[var(--color-base-4)]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full page skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center justify-center py-8">
          <LoadingSkeleton variant="card" />
        </Card>
        <Card className="md:col-span-2">
          <LoadingSkeleton variant="text" rows={5} />
        </Card>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}><LoadingSkeleton variant="card" /></Card>
        ))}
      </div>
      {/* Factors */}
      <Card><LoadingSkeleton variant="text" rows={6} /></Card>
      {/* Actions */}
      <Card><LoadingSkeleton variant="text" rows={4} /></Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
    refetch,
  } = useEquipmentDetail(id ?? "");

  const {
    data: riskData,
    isLoading: riskLoading,
    isError: riskError,
  } = useEquipmentRisk(id ?? "");

  const {
    data: recsPayload,
    isLoading: recsLoading,
  } = useEquipmentRecommendations(id ?? "");

  // ── Loading ──────────────────────────────────────────────────────────────
  if (detailLoading || riskLoading) {
    return (
      <PageWrapper title="Equipment Detail" subtitle="Loading asset data…">
        <PageSkeleton />
      </PageWrapper>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (detailError || !detail) {
    return (
      <PageWrapper title="Equipment Detail" subtitle="">
        <ErrorBanner
          message={(detailErr as { message?: string })?.message ?? `Equipment "${id}" not found.`}
          onRetry={refetch}
        />
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:underline"
        >
          <ArrowLeft size={14} /> Back to Equipment Risk
        </button>
      </PageWrapper>
    );
  }

  if (riskError) {
    return (
      <PageWrapper title={detail.name} subtitle={`${detail.type} · ${detail.zone_id}`}>
        <ErrorBanner message="Risk score data is unavailable for this equipment." onRetry={refetch} />
      </PageWrapper>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const score    = riskData?.score    ?? 0;
  const level    = riskData?.level    ?? "unknown";
  const recs     = recsPayload?.data  ?? [];
  const reading  = detail.current_reading;

  // contributing_factors from risk engine — sentences explaining why score is what it is
  const contributingFactors = (riskData as (typeof riskData & { contributing_factors?: string[] }) | undefined)
    ?.contributing_factors ?? [];

  const backButton = (
    <button
      type="button"
      onClick={() => navigate("/equipment")}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-base-4)] text-sm text-[var(--color-text-2)] hover:text-[var(--color-text-0)] hover:border-[var(--color-base-5)] transition-colors"
    >
      <ArrowLeft size={13} /> Equipment Risk
    </button>
  );

  return (
    <PageWrapper
      title={detail.name}
      subtitle={`${detail.type} · Zone ${detail.zone_id}${detail.zone_name ? ` — ${detail.zone_name}` : ""}`}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded border border-[var(--color-base-4)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          {backButton}
        </div>
      }
    >

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Risk Score + Asset Identity
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Risk score column */}
        <Card className="flex flex-col items-center justify-center gap-5 py-8 md:col-span-1">
          <ProgressRing score={score} size={112} strokeWidth={9} />
          <div className="text-center space-y-2">
            <RiskBadge level={level} size="md" />
            <p className="text-[11px] text-[var(--color-text-3)]">
              Equipment failure risk score
            </p>
            {riskData?.outage_probability != null && (
              <p className="text-[11px] text-[var(--color-text-2)]">
                Outage contribution:{" "}
                <span className="font-mono font-semibold text-[var(--color-text-0)]">
                  {(riskData.outage_probability * 100).toFixed(1)}%
                </span>
              </p>
            )}
          </div>
          {riskData?.scored_at && (
            <p className="text-[10px] text-[var(--color-text-3)] flex items-center gap-1">
              <Clock size={10} />
              Scored {formatRelativeTime(String(riskData.scored_at))}
            </p>
          )}
        </Card>

        {/* Asset identity grid */}
        <Card className="md:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <Cpu size={14} className="text-[var(--color-text-3)]" />
            <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Asset Identity</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--color-brand)] bg-[var(--color-base-3)] px-2 py-0.5 rounded">
              {detail.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {[
              { label: "Type",         value: detail.type },
              { label: "Status",       value: detail.status },
              { label: "Age",          value: `${detail.age_years} years` },
              { label: "Zone",         value: detail.zone_name ?? detail.zone_id },
              { label: "Customers",    value: formatNumber(detail.customers_affected) },
              { label: "Substation",   value: detail.substation_name ?? "—" },
              ...(detail.manufacturer ? [{ label: "Manufacturer", value: detail.manufacturer }] : []),
              ...(detail.model        ? [{ label: "Model",        value: detail.model }] : []),
              ...(detail.nominal_voltage_kv != null
                ? [{ label: "Rated Voltage", value: `${detail.nominal_voltage_kv} kV` }]
                : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                  {label}
                </p>
                <p className="text-sm font-medium text-[var(--color-text-1)] mt-0.5 capitalize">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {(detail.installed_at || detail.last_inspected_at) && (
            <div className="mt-4 pt-4 border-t border-[var(--color-base-4)] grid grid-cols-2 gap-4">
              {detail.installed_at && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                    Installed
                  </p>
                  <p className="text-sm text-[var(--color-text-1)] mt-0.5 flex items-center gap-1.5">
                    <Calendar size={11} className="text-[var(--color-text-3)]" />
                    {formatDate(String(detail.installed_at))}
                  </p>
                </div>
              )}
              {detail.last_inspected_at && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                    Last Inspected
                  </p>
                  <p className="text-sm text-[var(--color-text-1)] mt-0.5 flex items-center gap-1.5">
                    <Calendar size={11} className="text-[var(--color-text-3)]" />
                    {formatDate(String(detail.last_inspected_at))}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          KEY METRICS — 8 sensor / attribute tiles
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeading
          icon={Activity}
          title="Key Metrics"
          aside={
            reading ? (
              <span className="text-[10px] text-[var(--color-text-3)]">
                Reading recorded {formatDateTime(String(reading.recorded_at))}
              </span>
            ) : undefined
          }
        />
        {reading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            <MetricTile
              label="Temperature"
              value={reading.temperature_c}
              unit="°C"
              decimals={1}
              icon={Thermometer}
              warnAbove={75}
              critAbove={90}
              subtitle="Warn >75°C · Crit >90°C"
            />
            <MetricTile
              label="Load"
              value={reading.load_pct}
              unit="%"
              decimals={1}
              icon={Activity}
              warnAbove={80}
              critAbove={90}
              subtitle="Warn >80% · Crit >90%"
            />
            <MetricTile
              label="Voltage"
              value={reading.voltage_kv}
              unit=" kV"
              decimals={1}
              icon={Zap}
              subtitle="Nominal operating voltage"
            />
            <MetricTile
              label="Volt. Deviation"
              value={reading.voltage_deviation_pct}
              unit="%"
              decimals={2}
              icon={Zap}
              warnAbove={10}
              critAbove={20}
              subtitle="Warn >10% · Crit >20%"
            />
            <MetricTile
              label="Vibration"
              value={reading.vibration_mms}
              unit=" mm/s"
              decimals={2}
              icon={Activity}
              warnAbove={4}
              critAbove={7}
              subtitle="Warn >4 · Crit >7 mm/s"
            />
            <MetricTile
              label="Humidity"
              value={reading.humidity_pct}
              unit="%"
              decimals={0}
              icon={Wind}
              subtitle="Ambient relative humidity"
            />
            <MetricTile
              label="Asset Age"
              value={detail.age_years}
              unit=" yrs"
              decimals={0}
              icon={Clock}
              warnAbove={20}
              critAbove={30}
              subtitle="Warn >20 · Crit >30 yrs"
            />
            <WeatherTile condition={reading.weather_condition} />
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Activity}
              title="No sensor reading available"
              message="No sensor snapshot has been recorded for this equipment."
              className="py-8"
            />
          </Card>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          AI RISK INSIGHT — explainability panel
      ══════════════════════════════════════════════════════════════════ */}
      {riskData && (
        <section>
          <SectionHeading
            icon={BrainCircuit}
            title="AI Risk Insight"
            badge={
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ai-purple)] font-semibold border border-[rgba(139,92,246,.3)] rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-purple)]" />
                Engine output
              </span>
            }
          />
          {recsLoading ? (
            <Card><LoadingSkeleton variant="text" rows={6} /></Card>
          ) : (
            <AiRiskInsight
              detail={detail}
              riskScore={riskData}
              recommendations={recs}
              contributingFactors={contributingFactors}
            />
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MAINTENANCE HISTORY
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeading
          icon={Wrench}
          title="Maintenance History"
          aside={
            <span className="text-[11px] text-[var(--color-text-3)]">
              {detail.maintenance_records.length} record{detail.maintenance_records.length !== 1 ? "s" : ""}
              {detail.maintenance_days_ago != null && ` · last ${detail.maintenance_days_ago}d ago`}
            </span>
          }
        />
        {detail.maintenance_records.length > 0 ? (
          <DataTable headers={["Date", "Type", "Technician", "Outcome", "Duration", "Notes"]}>
            {[...detail.maintenance_records]
              .sort((a, b) => new Date(b.maintenance_date).getTime() - new Date(a.maintenance_date).getTime())
              .slice(0, 10)
              .map((r) => <MaintenanceRow key={r.id} record={r} />)}
          </DataTable>
        ) : (
          <Card>
            <EmptyState
              icon={Wrench}
              title="No maintenance records"
              message="No maintenance has been logged for this equipment."
              className="py-6"
            />
          </Card>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FAILURE HISTORY
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeading
          icon={AlertTriangle}
          title="Previous Failures"
          aside={
            <span className="text-[11px] text-[var(--color-text-3)]">
              {detail.failure_events.length} event{detail.failure_events.length !== 1 ? "s" : ""}
              {detail.previous_failures_2yr != null && ` · ${detail.previous_failures_2yr} in last 2 yrs`}
            </span>
          }
        />
        {detail.failure_events.length > 0 ? (
          <DataTable headers={["Date", "Severity", "Cause", "Downtime", "Customers"]}>
            {[...detail.failure_events]
              .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
              .slice(0, 10)
              .map((ev) => <FailureRow key={ev.id} event={ev} />)}
          </DataTable>
        ) : (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title="No failure events"
              message="No failures have been recorded for this equipment."
              className="py-6"
            />
          </Card>
        )}
      </section>

      {/* ── Bottom nav ── */}
      <div className="flex justify-between items-center pt-2 border-t border-[var(--color-base-4)]">
        <p className="text-[10px] text-[var(--color-text-3)] italic">
          Risk scores are heuristic estimates only — not a validated real-world prediction model.
        </p>
        <button
          type="button"
          onClick={() => navigate("/equipment")}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:underline"
        >
          Equipment list <ChevronRight size={14} />
        </button>
      </div>

    </PageWrapper>
  );
}
