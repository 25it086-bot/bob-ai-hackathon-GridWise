import { useNavigate } from "react-router-dom";
import {
  Map, AlertTriangle, Activity,
  Users, Zap, RefreshCw, ChevronRight,
} from "lucide-react";
import { useZoneList } from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { RiskBadge } from "@/components/common/RiskBadge";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { ZoneSummary } from "@/types/zone";

// ─── Outage probability bar ────────────────────────────────────────────────

function OutageBar({ probability }: { probability: number }) {
  const pct = probability * 100;
  const color =
    pct >= 60 ? "var(--color-critical)" :
    pct >= 35 ? "var(--color-high)" :
    pct >= 15 ? "var(--color-medium)" :
    "var(--color-low)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-text-3)]">Outage probability</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Risk mini-bar (equipment breakdown) ──────────────────────────────────

function RiskBreakdown({ zone }: { zone: ZoneSummary }) {
  const items = [
    { key: "critical", count: zone.critical_count, color: "var(--color-critical)" },
    { key: "high",     count: zone.high_count,     color: "var(--color-high)" },
    { key: "medium",   count: zone.medium_count,   color: "var(--color-medium)" },
    { key: "low",      count: zone.low_count,      color: "var(--color-low)" },
  ];
  const total = zone.total_equipment;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[var(--color-text-3)]">Equipment risk breakdown</p>
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-[var(--color-base-4)]">
        {items.map(({ key, count, color }) =>
          count > 0 ? (
            <div
              key={key}
              title={`${key}: ${count}`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(count / total) * 100}%`, background: color }}
            />
          ) : null
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {items.map(({ key, count, color }) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-[var(--color-text-3)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            {count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Zone card ─────────────────────────────────────────────────────────────

function ZoneCard({ zone, onClick }: { zone: ZoneSummary; onClick: () => void }) {
  const level = zone.zone_risk_level;
  const isAlert = level === "critical" || level === "high";

  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--color-base-2)] p-5 space-y-4 transition-colors hover:bg-[var(--color-base-3)] cursor-pointer",
        level === "critical" ? "border-[var(--color-critical-bd)]" :
        level === "high"     ? "border-[var(--color-high-bd)]" :
        "border-[var(--color-base-4)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View zone ${zone.name}`}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {isAlert && <AlertTriangle size={12} className="text-[var(--color-critical-tx)] shrink-0" aria-hidden="true" />}
            <h3 className="text-[14px] font-semibold text-[var(--color-text-0)] truncate">{zone.name}</h3>
          </div>
          <p className="text-[11px] text-[var(--color-text-3)]">{zone.region}</p>
        </div>
        <RiskBadge level={level} size="sm" />
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[18px] font-bold font-mono text-[var(--color-text-0)] leading-none">{zone.total_equipment}</p>
          <p className="text-[10px] text-[var(--color-text-3)] mt-0.5 uppercase tracking-wider">Units</p>
        </div>
        <div>
          <p className="text-[18px] font-bold font-mono text-[var(--color-text-0)] leading-none">
            {zone.zone_risk_score.toFixed(0)}
          </p>
          <p className="text-[10px] text-[var(--color-text-3)] mt-0.5 uppercase tracking-wider">Risk Score</p>
        </div>
        <div>
          <p className="text-[14px] font-bold font-mono text-[var(--color-text-0)] leading-none truncate">
            {formatNumber(zone.total_customers)}
          </p>
          <p className="text-[10px] text-[var(--color-text-3)] mt-0.5 uppercase tracking-wider">Customers</p>
        </div>
      </div>

      {/* Risk breakdown bar */}
      <RiskBreakdown zone={zone} />

      {/* Outage probability */}
      {zone.outage_probability != null && (
        <OutageBar probability={zone.outage_probability} />
      )}

      {/* Drill-through hint */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-base-4)]">
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-3)]">
          {zone.critical_count > 0 && (
            <span className="text-[var(--color-critical-tx)] font-semibold">
              {zone.critical_count} critical
            </span>
          )}
          {zone.high_count > 0 && (
            <span className="text-[var(--color-high-tx)] font-semibold">
              {zone.high_count} high
            </span>
          )}
        </div>
        <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-brand)]">
          Equipment <ChevronRight size={11} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

// ─── Fleet summary bar ─────────────────────────────────────────────────────

function FleetSummary({ zones }: { zones: ZoneSummary[] }) {
  const totals = zones.reduce(
    (acc, z) => ({
      equipment: acc.equipment + z.total_equipment,
      customers: acc.customers + z.total_customers,
      critical:  acc.critical  + z.critical_count,
      high:      acc.high      + z.high_count,
    }),
    { equipment: 0, customers: 0, critical: 0, high: 0 }
  );

  const items = [
    { label: "Total Zones",      value: zones.length,                    icon: Map,          color: "var(--color-brand)" },
    { label: "Total Equipment",  value: totals.equipment,                icon: Zap,          color: "var(--color-brand)" },
    { label: "Total Customers",  value: formatNumber(totals.customers),  icon: Users,        color: "var(--color-brand)" },
    { label: "Critical Units",   value: totals.critical,                 icon: AlertTriangle, color: "var(--color-critical)" },
    { label: "High Risk Units",  value: totals.high,                     icon: Activity,     color: "var(--color-high)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg px-4 py-3 flex items-center gap-3">
          <Icon size={16} aria-hidden="true" style={{ color }} className="shrink-0" />
          <div>
            <p className="text-[18px] font-bold font-mono text-[var(--color-text-0)] leading-none">{value}</p>
            <p className="text-[10px] text-[var(--color-text-3)] mt-0.5 uppercase tracking-wider">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function GridZonesPage() {
  const navigate = useNavigate();
  const { data: zones, isLoading, isError, refetch } = useZoneList();

  const sorted = [...(zones ?? [])].sort((a, b) => b.zone_risk_score - a.zone_risk_score);

  const refreshAction = (
    <button type="button" onClick={() => refetch()}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:text-[var(--color-text-0)] transition-colors px-3 py-1.5 rounded border border-[var(--color-base-4)] hover:border-[var(--color-base-5)]">
      <RefreshCw size={13} aria-hidden="true" />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  return (
    <PageWrapper title="Grid Zones" subtitle="Zone-level risk overview — sorted by risk score" action={refreshAction}>

      {isError && <ErrorBanner message="Failed to load zone data." onRetry={refetch} />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map((i) => (
            <Card key={i}><LoadingSkeleton rows={4} /></Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Map} title="No zones loaded" message="Zone data will appear once equipment is assigned to grid zones." />
      ) : (
        <>
          <FleetSummary zones={sorted} />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onClick={() => navigate(`/equipment?zone_id=${zone.id}`)}
              />
            ))}
          </div>
        </>
      )}

      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        Zone risk scores are aggregated from individual equipment assessments ·{" "}
        <strong>Prototype estimates only</strong>
      </p>
    </PageWrapper>
  );
}
