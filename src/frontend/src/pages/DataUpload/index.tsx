import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, Database, RefreshCw, CheckCircle2,
  AlertTriangle, Activity, Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorBanner } from "@/components/states/ErrorBanner";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/formatters";

// ─── Types ─────────────────────────────────────────────────────────────────

// Shape returned by GET /api/v1/data/status → { data: DatasetStatus }
interface DatasetStatus {
  loaded:               boolean;
  equipment_count:      number;
  reading_count:        number;
  maintenance_count:    number;
  failure_count:        number;
  zone_count:           number;
  alert_count:          number;
  scored_count:         number;
  recommendation_count: number;
}

interface ScoringResult {
  scored: number;
  errors: number;
  new_alerts: number;
}

// ─── Status row ────────────────────────────────────────────────────────────

function DatasetRow({ label, total, valid }: { label: string; total: number; valid?: number }) {
  const hasValid = valid !== undefined;
  const isOk = !hasValid || valid === total;
  const pct = hasValid && total > 0 ? Math.round((valid / total) * 100) : 100;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--color-base-4)] last:border-0">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: isOk ? "var(--color-low)" : "var(--color-high)" }} aria-hidden="true" />
      <span className="text-[13px] text-[var(--color-text-1)] w-28 shrink-0 capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isOk ? "var(--color-low)" : "var(--color-high)" }} />
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-right">
        {hasValid ? (
          <>
            <span className="font-mono text-[12px] text-[var(--color-text-0)] font-semibold">{formatNumber(valid!)}</span>
            <span className="text-[11px] text-[var(--color-text-3)]">/ {formatNumber(total)} valid</span>
          </>
        ) : (
          <span className="font-mono text-[12px] text-[var(--color-text-0)] font-semibold">{formatNumber(total)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Result banner ─────────────────────────────────────────────────────────

function ScoringBanner({ result }: { result: ScoringResult }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--color-low-bd)] bg-[var(--color-low-bg)]">
      <CheckCircle2 size={16} className="text-[var(--color-low-tx)] shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-[var(--color-low-tx)]">
          Scoring complete — {result.scored} equipment scored
        </p>
        <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">
          {result.errors > 0 ? `${result.errors} error(s)` : "No errors"} ·{" "}
          {result.new_alerts} new alert{result.new_alerts !== 1 ? "s" : ""} generated
        </p>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DataUploadPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);

  const { data: statusResp, isLoading, isError, refetch } = useQuery({
    queryKey: ["data", "status"],
    queryFn: () => apiClient.get("/data/status") as Promise<{ data: DatasetStatus }>,
    staleTime: 30_000,
  });

  const { mutate: triggerRescore, isPending: isRescoring } = useMutation({
    mutationFn: () => apiClient.post("/data/refresh") as Promise<{ data: ScoringResult }>,
    onSuccess: (res) => {
      setScoringResult(res.data);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      refetch();
    },
  });

  const status = statusResp?.data;

  const refreshAction = (
    <button type="button" onClick={() => refetch()}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-brand)] hover:text-[var(--color-text-0)] transition-colors px-3 py-1.5 rounded border border-[var(--color-base-4)] hover:border-[var(--color-base-5)]">
      <RefreshCw size={13} aria-hidden="true" />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  return (
    <PageWrapper title="Data Upload" subtitle="Dataset status and risk rescoring" action={refreshAction}>

      {isError && <ErrorBanner message="Failed to load data status." onRetry={refetch} />}
      {scoringResult && <ScoringBanner result={scoringResult} />}

      {/* ── Dataset status card ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Database size={14} className="text-[var(--color-text-3)]" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Dataset Status</h2>
          {!isLoading && status && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-low-tx)] bg-[var(--color-low-bg)] border border-[var(--color-low-bd)] rounded-full px-2 py-0.5">
              <CheckCircle2 size={10} aria-hidden="true" /> Loaded
            </span>
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton variant="text" rows={6} />
        ) : status ? (
          <div>
            <DatasetRow label="Equipment"   total={status.equipment_count}   />
            <DatasetRow label="Readings"    total={status.reading_count}     />
            <DatasetRow label="Maintenance" total={status.maintenance_count} />
            <DatasetRow label="Failures"    total={status.failure_count}     />
            <DatasetRow label="Zones"       total={status.zone_count}        />
            <DatasetRow label="Scored"      total={status.scored_count}      />
            <DatasetRow label="Alerts"      total={status.alert_count}       />
            <DatasetRow label="Recommendations" total={status.recommendation_count} />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--color-text-3)]">No status data available.</p>
        )}
      </Card>

      {/* ── Re-score action ─────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--color-brand)] bg-opacity-10 border border-[rgba(59,130,246,.2)] flex items-center justify-center">
            <Activity size={16} className="text-[var(--color-brand)]" aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-0)]">Re-score All Equipment</h3>
            <p className="text-[12px] text-[var(--color-text-3)] leading-snug">
              Recalculates risk scores for all 87 equipment units using the latest sensor readings.
              New alerts are generated for any units that cross critical thresholds.
              This takes less than 1 second.
            </p>
          </div>
          <button
            type="button"
            disabled={isRescoring}
            onClick={() => { setScoringResult(null); triggerRescore(); }}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded border font-semibold text-sm transition-colors",
              "bg-[var(--color-brand)] border-[var(--color-brand)] text-white",
              "hover:bg-[var(--color-brand-dim)] hover:border-[var(--color-brand-dim)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isRescoring ? (
              <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Scoring…</>
            ) : (
              <><RefreshCw size={13} aria-hidden="true" /> Run Scoring</>
            )}
          </button>
        </div>
      </Card>

      {/* ── Data source info ────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Upload size={14} className="text-[var(--color-text-3)]" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Data Source</h2>
        </div>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-base-3)] border border-[var(--color-base-4)]">
            <AlertTriangle size={14} className="text-[var(--color-high-tx)] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[var(--color-text-2)] leading-snug">
              GridWise currently runs on <strong className="text-[var(--color-text-0)]">simulated JSON data</strong> generated
              at startup. Real data ingestion via CSV/API upload will be available in a future phase.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            {[
              { label: "Data location", value: "data/" },
              { label: "Format", value: "JSON" },
              { label: "Generated by", value: "generate_data.py" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--color-base-1)] rounded border border-[var(--color-base-4)] px-3 py-2">
                <p className="text-[10px] text-[var(--color-text-3)] uppercase tracking-widest mb-0.5">{label}</p>
                <p className="font-mono text-[12px] text-[var(--color-brand)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-3)]">
            <Clock size={11} aria-hidden="true" />
            Data is loaded once at server startup and re-scored automatically.
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="text-[var(--color-brand)] hover:underline ml-1"
            >
              View equipment →
            </button>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        All data is simulated for demonstration purposes · <strong>Not real grid data</strong>
      </p>
    </PageWrapper>
  );
}
