import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, AlertTriangle, Activity, CheckCircle2,
  RefreshCw, ChevronRight, EyeOff, Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/formatters";
import type { Recommendation, RecommendationPriority } from "@/types/recommendation";
import type { PaginatedResponse } from "@/types/api";

// ─── Priority config ───────────────────────────────────────────────────────

const PRI_CONFIG: Record<RecommendationPriority, {
  icon: React.ElementType;
  badge: string;
  border: string;
  label: string;
}> = {
  urgent: {
    icon:   AlertTriangle,
    badge:  "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)] text-[var(--color-critical-tx)]",
    border: "border-l-[var(--color-critical)]",
    label:  "Urgent",
  },
  scheduled: {
    icon:   Activity,
    badge:  "bg-[var(--color-high-bg)] border-[var(--color-high-bd)] text-[var(--color-high-tx)]",
    border: "border-l-[var(--color-high)]",
    label:  "Scheduled",
  },
  monitor: {
    icon:   Shield,
    badge:  "bg-[var(--color-base-3)] border-[var(--color-base-5)] text-[var(--color-text-2)]",
    border: "border-l-[var(--color-base-5)]",
    label:  "Monitor",
  },
};

// ─── Filter pill ───────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

// ─── Recommendation card ───────────────────────────────────────────────────

function RecCard({
  rec,
  onDismiss,
  isDismissing,
}: {
  rec: Recommendation;
  onDismiss: (id: string, dismissed: boolean) => void;
  isDismissing: boolean;
}) {
  const navigate = useNavigate();
  const cfg = PRI_CONFIG[rec.priority] ?? PRI_CONFIG.monitor;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-lg border border-[var(--color-base-4)] bg-[var(--color-base-3)] border-l-2 transition-opacity",
        cfg.border,
        rec.dismissed && "opacity-50"
      )}
    >
      {/* Priority icon */}
      <div className="shrink-0 mt-0.5">
        <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded border", cfg.badge)}>
          <Icon size={13} aria-hidden="true" />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5", cfg.badge)}>
            {cfg.label}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/equipment/${rec.equipment_id}`)}
            className="font-mono text-xs text-[var(--color-brand)] hover:underline"
            title="View equipment detail"
          >
            {rec.equipment_id}
          </button>
          {rec.equipment_name && (
            <span className="text-[11px] text-[var(--color-text-3)] truncate max-w-[160px]">
              {rec.equipment_name}
            </span>
          )}
          {rec.zone_id && (
            <span className="text-[10px] text-[var(--color-text-3)] ml-auto hidden sm:inline">
              Zone {rec.zone_id}
            </span>
          )}
        </div>

        <p className="text-[13px] font-medium text-[var(--color-text-0)] leading-snug">
          {rec.action}
        </p>

        {rec.rationale && (
          <p className="text-[11px] text-[var(--color-text-3)] italic leading-snug">
            {rec.rationale}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] text-[var(--color-text-3)]">
            Generated {formatRelativeTime(rec.generated_at)}
          </span>
          <button
            type="button"
            disabled={isDismissing}
            onClick={() => onDismiss(rec.id, !rec.dismissed)}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors",
              rec.dismissed
                ? "border-[var(--color-low-bd)] text-[var(--color-low-tx)] hover:bg-[var(--color-low-bg)]"
                : "border-[var(--color-base-5)] text-[var(--color-text-3)] hover:border-[var(--color-base-5)] hover:text-[var(--color-text-1)]",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {rec.dismissed ? (
              <><CheckCircle2 size={11} aria-hidden="true" /> Restore</>
            ) : (
              <><EyeOff size={11} aria-hidden="true" /> Dismiss</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary tile ──────────────────────────────────────────────────────────

function SummaryTile({ label, count, priority, active, onClick }: {
  label: string; count: number; priority: RecommendationPriority;
  active: boolean; onClick: () => void;
}) {
  const cfg = PRI_CONFIG[priority];
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
      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", cfg.badge.includes("critical") ? "text-[var(--color-critical-tx)]" : cfg.badge.includes("high") ? "text-[var(--color-high-tx)]" : "text-[var(--color-text-3)]")}>
        {label}
      </span>
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [page, setPage] = useState(1);

  const params = {
    page, page_size: PAGE_SIZE,
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    dismissed: showDismissed,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["recommendations", "list", params],
    queryFn: () => apiClient.get("/recommendations", { params }) as Promise<PaginatedResponse<Recommendation>>,
    staleTime: 60_000,
  });

  const { mutate: dismiss, isPending: isDismissing } = useMutation({
    mutationFn: ({ id, dismissed }: { id: string; dismissed: boolean }) =>
      apiClient.patch(`/recommendations/${id}/dismiss`, { dismissed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations"] }),
  });

  // Counts for summary tiles (no filter, no dismissed)
  const { data: allData } = useQuery({
    queryKey: ["recommendations", "all-counts"],
    queryFn: () => apiClient.get("/recommendations", { params: { page: 1, page_size: 200, dismissed: false } }) as Promise<PaginatedResponse<Recommendation>>,
    staleTime: 60_000,
  });
  const allRecs = allData?.data ?? [];
  const counts = { urgent: 0, scheduled: 0, monitor: 0 } as Record<string, number>;
  allRecs.forEach((r) => { counts[r.priority] = (counts[r.priority] ?? 0) + 1; });

  const recs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.total_pages ?? 1;

  const refreshAction = (
    <button type="button" onClick={() => refetch()}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:text-[var(--color-text-0)] transition-colors px-3 py-1.5 rounded border border-[var(--color-base-4)] hover:border-[var(--color-base-5)]">
      <RefreshCw size={13} aria-hidden="true" />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  return (
    <PageWrapper title="Recommendations" subtitle="AI-assisted preventive action recommendations" action={refreshAction}>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {(["urgent", "scheduled", "monitor"] as RecommendationPriority[]).map((p) => (
          <SummaryTile key={p} label={p} count={counts[p] ?? 0} priority={p}
            active={priorityFilter === p}
            onClick={() => { setPriorityFilter((prev) => prev === p ? null : p); setPage(1); }} />
        ))}
      </div>

      {/* Filter toolbar */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Priority</span>
          {(["urgent", "scheduled", "monitor"] as const).map((p) => (
            <FilterPill key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}
              active={priorityFilter === p}
              onClick={() => { setPriorityFilter((prev) => prev === p ? null : p); setPage(1); }} />
          ))}
          <div className="w-px h-4 bg-[var(--color-base-5)] mx-1" aria-hidden="true" />
          <FilterPill label={showDismissed ? "Showing dismissed" : "Show dismissed"}
            active={showDismissed}
            onClick={() => { setShowDismissed((v) => !v); setPage(1); }} />
          {(priorityFilter || showDismissed) && (
            <button type="button" onClick={() => { setPriorityFilter(null); setShowDismissed(false); setPage(1); }}
              className="ml-auto text-[11px] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] underline">
              Reset filters
            </button>
          )}
        </div>
      </Card>

      {isError && <ErrorBanner message="Failed to load recommendations." onRetry={refetch} />}

      {/* AI badge + count */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[var(--color-ai-purple)]" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-[var(--color-text-0)]">
            {total} recommendation{total !== 1 ? "s" : ""}
            {priorityFilter ? ` · ${priorityFilter}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ai-purple)] font-semibold border border-[rgba(139,92,246,.3)] rounded-full px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-purple)]" />
            Engine output
          </span>
        </div>
        <button type="button" onClick={() => navigate("/equipment")}
          className="text-[11px] text-[var(--color-brand)] hover:underline flex items-center gap-0.5">
          View equipment <ChevronRight size={11} />
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[0,1,2,3].map((i) => <Card key={i}><LoadingSkeleton variant="text" rows={3} /></Card>)}</div>
      ) : recs.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No recommendations match the current filters"
          message="Try adjusting the priority filter or show dismissed items."
          action={{ label: "Reset filters", onClick: () => { setPriorityFilter(null); setShowDismissed(false); setPage(1); } }} />
      ) : (
        <div className="space-y-2">
          {recs.map((rec) => (
            <RecCard key={rec.id} rec={rec}
              onDismiss={(id, dismissed) => dismiss({ id, dismissed })}
              isDismissing={isDismissing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-[var(--color-text-3)]">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-[var(--color-base-4)] text-xs text-[var(--color-text-2)] hover:border-[var(--color-base-5)] disabled:opacity-40 disabled:cursor-not-allowed">
              Prev
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-[var(--color-base-4)] text-xs text-[var(--color-text-2)] hover:border-[var(--color-base-5)] disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        Recommendations are generated by the GridWise heuristic risk engine ·{" "}
        <strong>Not certified engineering advice</strong> — always follow approved maintenance procedures
      </p>
    </PageWrapper>
  );
}
