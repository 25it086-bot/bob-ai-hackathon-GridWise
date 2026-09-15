import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCircle2, Filter,
  RefreshCw, ChevronLeft, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useAlerts, useAcknowledgeAlert } from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { cn } from "@/lib/cn";
import { formatRelativeTime, formatDateTime } from "@/lib/formatters";
import type { Alert } from "@/types/alert";

// ─── Severity config ───────────────────────────────────────────────────────

const SEV_CONFIG: Record<string, {
  dot: string; badge: string; rowAccent: string; label: string;
}> = {
  critical: {
    dot:       "bg-[var(--color-critical)]",
    badge:     "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)] text-[var(--color-critical-tx)]",
    rowAccent: "border-l-[var(--color-critical)]",
    label:     "Critical",
  },
  high: {
    dot:       "bg-[var(--color-high)]",
    badge:     "bg-[var(--color-high-bg)] border-[var(--color-high-bd)] text-[var(--color-high-tx)]",
    rowAccent: "border-l-[var(--color-high)]",
    label:     "High",
  },
  medium: {
    dot:       "bg-[var(--color-medium)]",
    badge:     "bg-[var(--color-medium-bg)] border-[var(--color-medium-bd)] text-[var(--color-medium-tx)]",
    rowAccent: "border-l-[var(--color-medium)]",
    label:     "Medium",
  },
  low: {
    dot:       "bg-[var(--color-low)]",
    badge:     "bg-[var(--color-low-bg)] border-[var(--color-low-bd)] text-[var(--color-low-tx)]",
    rowAccent: "border-l-[var(--color-low)]",
    label:     "Low",
  },
  info: {
    dot:       "bg-[var(--color-brand)]",
    badge:     "bg-[var(--color-base-3)] border-[var(--color-base-5)] text-[var(--color-text-2)]",
    rowAccent: "border-l-[var(--color-brand)]",
    label:     "Info",
  },
};

function sevCfg(sev: string) {
  return SEV_CONFIG[sev] ?? SEV_CONFIG.info;
}

// ─── Filter pill ───────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
        active
          ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
          : "bg-[var(--color-base-3)] border-[var(--color-base-5)] text-[var(--color-text-2)] hover:border-[var(--color-brand)] hover:text-[var(--color-text-0)]"
      )}
    >
      {label}
    </button>
  );
}

// ─── Alert row ─────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onAcknowledge,
  isAcknowledging,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
}) {
  const cfg = sevCfg(alert.severity);
  const navigate = useNavigate();

  return (
    <tr
      className={cn(
        "border-b border-[var(--color-base-4)] last:border-0 transition-colors",
        "border-l-2",
        cfg.rowAccent,
        alert.acknowledged
          ? "opacity-60 hover:opacity-80"
          : "hover:bg-[var(--color-base-3)]"
      )}
    >
      {/* Severity */}
      <td className="px-4 py-3 w-24">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider",
            cfg.badge
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
          {cfg.label}
        </span>
      </td>

      {/* Message */}
      <td className="px-4 py-3">
        <p
          className={cn(
            "text-[13px] leading-snug",
            alert.acknowledged
              ? "text-[var(--color-text-2)]"
              : "font-medium text-[var(--color-text-0)]"
          )}
        >
          {alert.message}
        </p>
        {alert.alert_type && (
          <span className="text-[10px] font-mono text-[var(--color-text-3)] uppercase tracking-wider mt-0.5 block">
            {alert.alert_type.replace(/_/g, " ")}
          </span>
        )}
      </td>

      {/* Equipment */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <button
          type="button"
          onClick={() => navigate(`/equipment/${alert.equipment_id}`)}
          className="font-mono text-xs text-[var(--color-brand)] hover:underline"
          title="View equipment detail"
        >
          {alert.equipment_id}
        </button>
        {alert.equipment_name && (
          <p className="text-[11px] text-[var(--color-text-3)] mt-0.5 truncate max-w-[120px]">
            {alert.equipment_name}
          </p>
        )}
      </td>

      {/* Zone */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-[var(--color-text-2)]">
          {alert.zone_id ?? "—"}
        </span>
      </td>

      {/* Time */}
      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
        <span
          className="text-xs text-[var(--color-text-3)]"
          title={formatDateTime(alert.created_at)}
        >
          {formatRelativeTime(alert.created_at)}
        </span>
      </td>

      {/* Acknowledge */}
      <td className="px-4 py-3 text-right">
        {alert.acknowledged ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-low-tx)]">
            <CheckCircle2 size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Acknowledged</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={isAcknowledging}
            onClick={() => onAcknowledge(alert.id)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded border font-medium transition-colors",
              "border-[var(--color-base-5)] text-[var(--color-text-2)]",
              "hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            Acknowledge
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Summary stat ──────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  severity,
  active,
  onClick,
}: {
  label: string;
  count: number;
  severity: string;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = sevCfg(severity);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors",
        active
          ? "border-[var(--color-brand)] bg-[rgba(59,130,246,.08)]"
          : "border-[var(--color-base-4)] bg-[var(--color-base-3)] hover:border-[var(--color-base-5)]"
      )}
    >
      <span className={cn("text-[22px] font-bold font-mono leading-none", active ? "text-[var(--color-brand)]" : "text-[var(--color-text-0)]")}>
        {count}
      </span>
      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", cfg.badge.includes("critical") ? "text-[var(--color-critical-tx)]" : cfg.badge.includes("high") ? "text-[var(--color-high-tx)]" : cfg.badge.includes("medium") ? "text-[var(--color-medium-tx)]" : cfg.badge.includes("low") ? "text-[var(--color-low-tx)]" : "text-[var(--color-text-3)]")}>
        {label}
      </span>
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

const SEVERITY_FILTERS = ["critical", "high", "medium", "low"] as const;
const PAGE_SIZE = 15;

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState<boolean | null>(false);
  const [page, setPage] = useState(1);

  const params: Record<string, unknown> = {
    page,
    page_size: PAGE_SIZE,
    ...(severityFilter ? { severity: severityFilter } : {}),
    ...(showAcknowledged !== null ? { acknowledged: showAcknowledged } : {}),
  };

  const { data, isLoading, isError, refetch } = useAlerts(params);
  const { mutate: acknowledge, isPending: isAcknowledging } = useAcknowledgeAlert();

  const alerts = data?.data ?? [];
  const meta   = data?.meta;
  const total  = meta?.total ?? 0;
  const totalPages = meta?.total_pages ?? 1;

  // Count unacknowledged per severity for summary (from current full result before filter)
  const allParams = { page: 1, page_size: 200 };
  const { data: allData } = useAlerts(allParams);
  const allAlerts = allData?.data ?? [];
  const counts = SEVERITY_FILTERS.reduce((acc, sev) => {
    acc[sev] = allAlerts.filter((a) => a.severity === sev && !a.acknowledged).length;
    return acc;
  }, {} as Record<string, number>);

  const unreadTotal = allAlerts.filter((a) => !a.acknowledged).length;

  const handleSeverityToggle = (sev: string) => {
    setSeverityFilter((prev) => (prev === sev ? null : sev));
    setPage(1);
  };

  const handleAcknowledge = (id: string) => {
    acknowledge(id);
  };

  const refreshAction = (
    <button
      type="button"
      onClick={() => refetch()}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:text-[var(--color-text-0)] transition-colors px-3 py-1.5 rounded border border-[var(--color-base-4)] hover:border-[var(--color-base-5)]"
    >
      <RefreshCw size={13} aria-hidden="true" />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  return (
    <PageWrapper
      title="Alerts"
      subtitle="Active system alerts and notification history"
      action={refreshAction}
    >
      {/* ── Summary stat row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SEVERITY_FILTERS.map((sev) => (
          <StatPill
            key={sev}
            label={sev}
            count={counts[sev] ?? 0}
            severity={sev}
            active={severityFilter === sev}
            onClick={() => handleSeverityToggle(sev)}
          />
        ))}
      </div>

      {/* ── Filter toolbar ────────────────────────────────────────────── */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-[var(--color-text-3)] shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] mr-1">
            Status
          </span>
          <FilterPill
            label="Unacknowledged"
            active={showAcknowledged === false}
            onClick={() => {
              setShowAcknowledged((prev) => (prev === false ? null : false));
              setPage(1);
            }}
          />
          <FilterPill
            label="Acknowledged"
            active={showAcknowledged === true}
            onClick={() => {
              setShowAcknowledged((prev) => (prev === true ? null : true));
              setPage(1);
            }}
          />
          <FilterPill
            label="All"
            active={showAcknowledged === null}
            onClick={() => { setShowAcknowledged(null); setPage(1); }}
          />

          <div className="w-px h-4 bg-[var(--color-base-5)] mx-1" aria-hidden="true" />

          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] mr-1">
            Severity
          </span>
          {SEVERITY_FILTERS.map((sev) => (
            <FilterPill
              key={sev}
              label={sev.charAt(0).toUpperCase() + sev.slice(1)}
              active={severityFilter === sev}
              onClick={() => handleSeverityToggle(sev)}
            />
          ))}
          {(severityFilter || showAcknowledged !== false) && (
            <button
              type="button"
              onClick={() => {
                setSeverityFilter(null);
                setShowAcknowledged(false);
                setPage(1);
              }}
              className="ml-auto text-[11px] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </Card>

      {/* ── Error state ───────────────────────────────────────────────── */}
      {isError && (
        <ErrorBanner
          message="Failed to load alerts. Check the backend connection."
          onRetry={refetch}
        />
      )}

      {/* ── Alert table ───────────────────────────────────────────────── */}
      <Card padding="none">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-[var(--color-base-4)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-[var(--color-text-3)]" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">
              Alert Log
            </h2>
            {unreadTotal > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-critical)] text-white text-[10px] font-bold">
                {unreadTotal}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--color-text-3)]">
            {total} alert{total !== 1 ? "s" : ""}
            {severityFilter ? ` · ${severityFilter} only` : ""}
          </span>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton variant="table" rows={6} />
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No alerts match the current filters"
            message="Try adjusting the severity or status filters above."
            action={{
              label: "Reset filters",
              onClick: () => {
                setSeverityFilter(null);
                setShowAcknowledged(false);
                setPage(1);
              },
            }}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Alert log">
              <thead>
                <tr className="bg-[var(--color-base-1)] border-b border-[var(--color-base-4)]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] w-24">
                    Severity
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                    Message
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden sm:table-cell">
                    Equipment
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden md:table-cell">
                    Zone
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden lg:table-cell">
                    Time
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={handleAcknowledge}
                    isAcknowledging={isAcknowledging}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[var(--color-base-4)] flex items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--color-text-3)]">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded border border-[var(--color-base-4)] text-[var(--color-text-2)] hover:text-[var(--color-text-0)] hover:border-[var(--color-base-5)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-7 h-7 rounded border text-[12px] font-medium transition-colors",
                    page === p
                      ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
                      : "border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-base-5)] hover:text-[var(--color-text-0)]"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded border border-[var(--color-base-4)] text-[var(--color-text-2)] hover:text-[var(--color-text-0)] hover:border-[var(--color-base-5)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Disclaimer */}
      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        Alerts are auto-generated when equipment risk scores exceed configured thresholds ·{" "}
        <strong>Prototype data only</strong> — not a real operational system
      </p>
    </PageWrapper>
  );
}
