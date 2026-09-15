import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, SlidersHorizontal, X, ChevronUp, ChevronDown,
  ChevronsUpDown, Zap, AlertTriangle, ChevronLeft,
  ChevronRight, Users, RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEquipmentList, useZoneList } from "@/hooks";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { RiskBadge } from "@/components/common/RiskBadge";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { formatNumber } from "@/lib/formatters";
import { riskRowClass } from "@/lib/riskUtils";
import { cn } from "@/lib/cn";
import type { EquipmentSummary } from "@/types/equipment";
import type { EquipmentFilters } from "@/api/equipment";

// ── Types ─────────────────────────────────────────────────────────────
type SortKey =
  | "risk_score"
  | "name"
  | "temperature"
  | "load_percentage"
  | "maintenance_days_ago"
  | "age_years"
  | "customer_count";

type SortDir = "asc" | "desc";

const RISK_LEVELS = ["critical", "high", "medium", "low"] as const;
const EQUIP_TYPES = ["transformer", "substation", "feeder", "switchgear"] as const;
const PAGE_SIZES = [25, 50, 100] as const;

// ── Tiny helpers ──────────────────────────────────────────────────────
function ThresholdCell({
  value,
  unit = "",
  decimals = 0,
  warnAbove,
  critAbove,
}: {
  value?: number | null;
  unit?: string;
  decimals?: number;
  warnAbove?: number;
  critAbove?: number;
}) {
  if (value == null) return <span className="text-[var(--color-text-3)]">—</span>;
  const text = `${value.toFixed(decimals)}${unit}`;
  let color = "text-[var(--color-text-1)]";
  if (critAbove != null && value >= critAbove) color = "text-[var(--color-critical-tx)]";
  else if (warnAbove != null && value >= warnAbove) color = "text-[var(--color-high-tx)]";
  return <span className={`font-mono text-sm ${color}`}>{text}</span>;
}

function MaintenanceCell({ days }: { days?: number | null }) {
  if (days == null) return <span className="text-[var(--color-text-3)]">—</span>;
  const color =
    days > 365
      ? "text-[var(--color-critical-tx)]"
      : days > 180
      ? "text-[var(--color-high-tx)]"
      : "text-[var(--color-text-1)]";
  const label =
    days > 365
      ? `${days}d ⚠`
      : `${days}d`;
  return <span className={`font-mono text-sm ${color}`} title={`${days} days since last maintenance`}>{label}</span>;
}

// ── Sort header cell ──────────────────────────────────────────────────
function SortTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest",
        "text-[var(--color-text-3)] cursor-pointer select-none whitespace-nowrap",
        "hover:text-[var(--color-text-1)] transition-colors",
        active && "text-[var(--color-text-1)]",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "desc" ? <ChevronDown size={11} /> : <ChevronUp size={11} />
        ) : (
          <ChevronsUpDown size={11} className="opacity-40" />
        )}
      </span>
    </th>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────
function FilterBar({
  search,
  onSearch,
  riskFilter,
  onRiskFilter,
  typeFilter,
  onTypeFilter,
  zoneFilter,
  onZoneFilter,
  zones,
  onClear,
  totalShown,
  totalAll,
  pageSize,
  onPageSize,
}: {
  search: string;
  onSearch: (v: string) => void;
  riskFilter: string;
  onRiskFilter: (v: string) => void;
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  zoneFilter: string;
  onZoneFilter: (v: string) => void;
  zones: Array<{ id: string; name: string }>;
  onClear: () => void;
  totalShown: number;
  totalAll: number;
  pageSize: number;
  onPageSize: (n: number) => void;
}) {
  const hasActive = !!(search || riskFilter || typeFilter || zoneFilter);

  return (
    <div className="space-y-3">
      {/* Search + clear */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-3)] pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search by ID, name or substation…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded border text-sm",
              "bg-[var(--color-base-3)] border-[var(--color-base-4)]",
              "text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)]",
              "focus:outline-none focus:border-[var(--color-brand)]",
            )}
          />
        </div>

        {/* Risk Level */}
        <select
          value={riskFilter}
          onChange={(e) => onRiskFilter(e.target.value)}
          aria-label="Filter by risk level"
          className={cn(
            "px-3 py-2 rounded border text-sm min-w-[140px]",
            "bg-[var(--color-base-3)] border-[var(--color-base-4)]",
            "text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-brand)]",
            riskFilter && "border-[var(--color-brand)]"
          )}
        >
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          aria-label="Filter by equipment type"
          className={cn(
            "px-3 py-2 rounded border text-sm min-w-[140px]",
            "bg-[var(--color-base-3)] border-[var(--color-base-4)]",
            "text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-brand)]",
            typeFilter && "border-[var(--color-brand)]"
          )}
        >
          <option value="">All types</option>
          {EQUIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Zone */}
        <select
          value={zoneFilter}
          onChange={(e) => onZoneFilter(e.target.value)}
          aria-label="Filter by zone"
          className={cn(
            "px-3 py-2 rounded border text-sm min-w-[140px]",
            "bg-[var(--color-base-3)] border-[var(--color-base-4)]",
            "text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-brand)]",
            zoneFilter && "border-[var(--color-brand)]"
          )}
        >
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>

        {hasActive && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[var(--color-base-4)] text-sm text-[var(--color-text-2)] hover:text-[var(--color-text-0)] hover:border-[var(--color-base-5)] transition-colors"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Row count + page size */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] text-[var(--color-text-3)]">
          {hasActive ? (
            <>
              Showing{" "}
              <span className="text-[var(--color-text-1)] font-semibold">{totalShown}</span>{" "}
              of{" "}
              <span className="text-[var(--color-text-1)] font-semibold">{totalAll}</span>{" "}
              equipment
            </>
          ) : (
            <>
              <span className="text-[var(--color-text-1)] font-semibold">
                {formatNumber(totalAll)}
              </span>{" "}
              equipment monitored
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-3)]">
          <SlidersHorizontal size={12} />
          Rows:
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageSize(n)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px]",
                pageSize === n
                  ? "bg-[var(--color-brand)] text-white"
                  : "hover:bg-[var(--color-base-4)] text-[var(--color-text-2)]"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pagination bar ────────────────────────────────────────────────────
function PaginationBar({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-base-4)]">
      <p className="text-[11px] text-[var(--color-text-3)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded text-[var(--color-text-2)] hover:bg-[var(--color-base-4)] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-[var(--color-text-3)] text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p as number)}
              className={cn(
                "min-w-[28px] h-7 px-1.5 rounded text-xs font-medium",
                p === page
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-2)] hover:bg-[var(--color-base-4)]"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded text-[var(--color-text-2)] hover:bg-[var(--color-base-4)] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Selection toolbar ─────────────────────────────────────────────────
function SelectionToolbar({
  selected,
  total,
  onClear,
  onSelectAll,
}: {
  selected: Set<string>;
  total: number;
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const count = selected.size;
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[rgba(59,130,246,0.08)] border-b border-[var(--color-brand)] rounded-t-lg">
      <span className="text-sm font-semibold text-[var(--color-brand)]">
        {count} selected
      </span>
      <button
        type="button"
        onClick={count === total ? onClear : onSelectAll}
        className="text-xs text-[var(--color-text-2)] hover:text-[var(--color-text-0)]"
      >
        {count === total ? "Deselect all" : `Select all ${total}`}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-xs text-[var(--color-text-2)] hover:text-[var(--color-text-0)] flex items-center gap-1"
      >
        <X size={12} /> Clear
      </button>
    </div>
  );
}

// ── Equipment row ─────────────────────────────────────────────────────
function EquipmentRow({
  equip,
  selected,
  onSelect,
  onClick,
}: {
  equip: EquipmentSummary;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: () => void;
}) {
  const level = equip.risk_level ?? "unknown";
  const scoreBar =
    equip.risk_score != null ? Math.min(100, equip.risk_score) : 0;

  const scoreBarColor: Record<string, string> = {
    critical: "bg-[var(--color-critical)]",
    high:     "bg-[var(--color-high)]",
    medium:   "bg-[var(--color-medium)]",
    low:      "bg-[var(--color-low)]",
    unknown:  "bg-[var(--color-base-5)]",
  };

  const scoreTextColor: Record<string, string> = {
    critical: "text-[var(--color-critical-tx)]",
    high:     "text-[var(--color-high-tx)]",
    medium:   "text-[var(--color-medium-tx)]",
    low:      "text-[var(--color-low-tx)]",
    unknown:  "text-[var(--color-text-3)]",
  };

  // Top recommendation: first non-dismissed action from recommendations if available
  // We show it from the summary level as "—" since we don't have recs in list view
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-base-4)] transition-colors group",
        riskRowClass(level),
        selected ? "bg-[rgba(59,130,246,0.06)]" : "hover:bg-[var(--color-base-3)]",
      )}
    >
      {/* Checkbox */}
      <td className="pl-3 pr-2 py-2.5 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(equip.id, e.target.checked);
          }}
          className="w-3.5 h-3.5 rounded border-[var(--color-base-5)] accent-[var(--color-brand)] cursor-pointer"
          aria-label={`Select ${equip.name}`}
        />
      </td>

      {/* Equipment (name + id) */}
      <td
        className="px-3 py-2.5 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-[var(--color-text-0)] group-hover:text-[var(--color-brand)] transition-colors leading-snug">
            {equip.name}
          </span>
          <span className="font-mono text-[10px] text-[var(--color-brand)]">{equip.id}</span>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className="text-xs text-[var(--color-text-2)] capitalize px-1.5 py-0.5 rounded bg-[var(--color-base-3)] border border-[var(--color-base-4)]">
          {equip.type}
        </span>
      </td>

      {/* Substation */}
      <td className="px-3 py-2.5 hidden md:table-cell">
        <span className="text-xs text-[var(--color-text-2)] truncate max-w-[120px] block">
          {equip.substation_name ?? "—"}
        </span>
      </td>

      {/* Zone */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <span className="text-xs text-[var(--color-text-2)] truncate max-w-[100px] block">
          {equip.zone_name ?? equip.zone_id}
        </span>
      </td>

      {/* Risk Score */}
      <td className="px-3 py-2.5 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2">
          <div
            className="hidden sm:block w-12 h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden shrink-0"
            title={`Risk score: ${equip.risk_score?.toFixed(1)}`}
          >
            <div
              className={cn("h-full rounded-full", scoreBarColor[level])}
              style={{ width: `${scoreBar}%` }}
            />
          </div>
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              scoreTextColor[level]
            )}
          >
            {equip.risk_score != null ? equip.risk_score.toFixed(0) : "—"}
          </span>
        </div>
      </td>

      {/* Risk Level */}
      <td className="px-3 py-2.5">
        <RiskBadge level={level} size="sm" />
      </td>

      {/* Temperature */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <ThresholdCell
          value={equip.temperature_c}
          unit="°C"
          decimals={0}
          warnAbove={75}
          critAbove={90}
        />
      </td>

      {/* Load */}
      <td className="px-3 py-2.5 hidden md:table-cell">
        <ThresholdCell
          value={equip.load_pct}
          unit="%"
          decimals={0}
          warnAbove={80}
          critAbove={90}
        />
      </td>

      {/* Vibration */}
      <td className="px-3 py-2.5 hidden xl:table-cell">
        <ThresholdCell
          value={equip.vibration_mms}
          unit=" mm/s"
          decimals={1}
          warnAbove={4}
          critAbove={7}
        />
      </td>

      {/* Maintenance */}
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <MaintenanceCell days={equip.days_since_maintenance} />
      </td>

      {/* Action */}
      <td className="px-3 py-2.5 hidden xl:table-cell cursor-pointer" onClick={onClick}>
        <span className="text-xs text-[var(--color-brand)] hover:underline whitespace-nowrap">
          View details →
        </span>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function EquipmentRiskPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sync filter state with URL params (so links from Dashboard work)
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [riskFilter, setRiskFilter] = useState(searchParams.get("risk_level") ?? "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "");
  const [zoneFilter, setZoneFilter] = useState(searchParams.get("zone_id") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounced search: only send to API after 300 ms idle
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters: EquipmentFilters = {
    search: debouncedSearch || undefined,
    risk_level: riskFilter || undefined,
    type: typeFilter || undefined,
    zone_id: zoneFilter || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    page_size: pageSize,
  };

  const { data, isLoading, isError, error, refetch } = useEquipmentList(filters);
  const { data: zonesData } = useZoneList();
  const zones = zonesData ?? [];

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  }, [sortBy]);

  const handleRiskFilter = (v: string) => { setRiskFilter(v); setPage(1); };
  const handleTypeFilter = (v: string) => { setTypeFilter(v); setPage(1); };
  const handleZoneFilter = (v: string) => { setZoneFilter(v); setPage(1); };

  const handleClearFilters = () => {
    setSearch("");
    setRiskFilter("");
    setTypeFilter("");
    setZoneFilter("");
    setPage(1);
    setSearchParams({});
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const ids = data?.data.map((e) => e.id) ?? [];
    setSelected(new Set(ids));
  };

  const handlePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
    setSelected(new Set());
  };

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.total_pages ?? 1;
  const rows = data?.data ?? [];

  const sortProps = (key: SortKey) => ({
    sortKey: key,
    active: sortBy === key,
    dir: sortDir,
    onSort: handleSort,
  });

  // Risk level summary counts from current filtered result (use meta if available)
  const levelCounts = rows.reduce<Record<string, number>>(
    (acc, eq) => {
      const l = eq.risk_level ?? "unknown";
      acc[l] = (acc[l] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <PageWrapper
      title="Equipment Risk"
      subtitle="All monitored grid equipment · Risk scores updated at last scoring run"
      action={
        <button
          type="button"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["equipment"] });
            refetch();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-base-4)] text-sm text-[var(--color-brand)] hover:border-[var(--color-base-5)] transition-colors"
          title="Refresh equipment data"
        >
          <RefreshCw size={13} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      {isError && (
        <ErrorBanner
          message={(error as any)?.message ?? "Failed to load equipment data"}
          onRetry={refetch}
        />
      )}

      {/* ── Risk Level Quick-Filter Pills ── */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick risk level filters">
        {RISK_LEVELS.map((level) => {
          const isActive = riskFilter === level;
          const pillColor: Record<string, string> = {
            critical: isActive
              ? "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)] text-[var(--color-critical-tx)]"
              : "border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-critical-bd)]",
            high: isActive
              ? "bg-[var(--color-high-bg)] border-[var(--color-high-bd)] text-[var(--color-high-tx)]"
              : "border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-high-bd)]",
            medium: isActive
              ? "bg-[var(--color-medium-bg)] border-[var(--color-medium-bd)] text-[var(--color-medium-tx)]"
              : "border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-medium-bd)]",
            low: isActive
              ? "bg-[var(--color-low-bg)] border-[var(--color-low-bd)] text-[var(--color-low-tx)]"
              : "border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-low-bd)]",
          };
          return (
            <button
              key={level}
              type="button"
              onClick={() => handleRiskFilter(isActive ? "" : level)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-widest transition-colors",
                pillColor[level]
              )}
            >
              <RiskBadge level={level} size="sm" />
              {isLoading ? "—" : `${levelCounts[level] ?? 0}`}
            </button>
          );
        })}
      </div>

      {/* ── Main card ── */}
      <Card padding="none">
        {/* Filter bar */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--color-base-4)]">
          <FilterBar
            search={search}
            onSearch={setSearch}
            riskFilter={riskFilter}
            onRiskFilter={handleRiskFilter}
            typeFilter={typeFilter}
            onTypeFilter={handleTypeFilter}
            zoneFilter={zoneFilter}
            onZoneFilter={handleZoneFilter}
            zones={zones.map((z) => ({ id: z.id, name: z.name }))}
            onClear={handleClearFilters}
            totalShown={rows.length}
            totalAll={total}
            pageSize={pageSize}
            onPageSize={handlePageSize}
          />
        </div>

        {/* Selection toolbar */}
        <SelectionToolbar
          selected={selected}
          total={rows.length}
          onClear={() => setSelected(new Set())}
          onSelectAll={handleSelectAll}
        />

        {/* Table */}
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No equipment found"
            message={
              riskFilter || typeFilter || zoneFilter || debouncedSearch
                ? "No equipment matches the current filters. Try clearing some filters."
                : "No equipment data is loaded. Upload data to begin monitoring."
            }
            action={
              riskFilter || typeFilter || zoneFilter || debouncedSearch
                ? { label: "Clear all filters", onClick: handleClearFilters }
                : { label: "Go to Data Upload", onClick: () => navigate("/data") }
            }
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full"
              role="table"
              aria-label="Equipment risk table"
            >
              <thead>
                <tr className="bg-[var(--color-base-1)] border-b border-[var(--color-base-4)]">
                  {/* Select all */}
                  <th className="pl-3 pr-2 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === rows.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
                      }}
                      onChange={(e) => {
                        if (e.target.checked) handleSelectAll();
                        else setSelected(new Set());
                      }}
                      className="w-3.5 h-3.5 rounded border-[var(--color-base-5)] accent-[var(--color-brand)] cursor-pointer"
                      aria-label="Select all equipment on this page"
                    />
                  </th>
                  <SortTh label="Equipment" {...sortProps("name")} />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden sm:table-cell">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden md:table-cell">
                    Substation
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden lg:table-cell">
                    Zone
                  </th>
                  <SortTh label="Score" {...sortProps("risk_score")} className="text-right" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                    Level
                  </th>
                  <SortTh label="Temp" {...sortProps("temperature")} className="hidden lg:table-cell" />
                  <SortTh label="Load" {...sortProps("load_percentage")} className="hidden md:table-cell" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden xl:table-cell">
                    Vibration
                  </th>
                  <SortTh label="Maint." {...sortProps("maintenance_days_ago")} className="hidden lg:table-cell" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] hidden xl:table-cell">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((eq) => (
                  <EquipmentRow
                    key={eq.id}
                    equip={eq}
                    selected={selected.has(eq.id)}
                    onSelect={handleSelect}
                    onClick={() => navigate(`/equipment/${eq.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-[var(--color-text-3)] px-1">
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-[var(--color-critical)]" />
          Temperature ≥90°C critical · ≥75°C warning
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={11} className="text-[var(--color-text-3)]" />
          Load ≥90% critical · ≥80% warning
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-[var(--color-high)]" />
          Maintenance ≥365 days critical · ≥180 days warning
        </span>
      </div>
    </PageWrapper>
  );
}
