import {
  Shield, Activity, AlertTriangle,
  Zap, Info, CheckCircle2,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { cn } from "@/lib/cn";

// ─── Setting row ───────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  value,
  valueColor,
}: {
  label: string;
  description: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--color-base-4)] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--color-text-1)]">{label}</p>
        <p className="text-[11px] text-[var(--color-text-3)] mt-0.5 leading-snug">{description}</p>
      </div>
      <span
        className="font-mono text-[13px] font-bold shrink-0"
        style={{ color: valueColor ?? "var(--color-text-0)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-[var(--color-text-3)] shrink-0" aria-hidden="true" />
      <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">{title}</h2>
    </div>
  );
}

// ─── Info tile ─────────────────────────────────────────────────────────────

function InfoTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-[var(--color-text-3)] uppercase tracking-widest mb-0.5">{label}</p>
      <p className={cn("text-[13px] text-[var(--color-text-0)]", mono && "font-mono")}>{value}</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <PageWrapper title="Settings" subtitle="Platform configuration — read-only view for this prototype">

      {/* Read-only notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[rgba(59,130,246,.25)] bg-[rgba(59,130,246,.06)]">
        <Info size={14} className="text-[var(--color-brand)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[12px] text-[var(--color-text-2)] leading-snug">
          Settings are configured via environment variables in the backend (<span className="font-mono text-[var(--color-brand)]">.env</span> or{" "}
          <span className="font-mono text-[var(--color-brand)]">backend/app/config.py</span>).
          This page shows the current active configuration. Live editing is available in a future phase.
        </p>
      </div>

      {/* ── Risk Engine Thresholds ─────────────────────────────────── */}
      <Card>
        <SectionHeading icon={Shield} title="Risk Engine Thresholds" />
        <SettingRow
          label="CRITICAL threshold"
          description="Equipment with a risk score at or above this value is marked CRITICAL."
          value="≥ 75 / 100"
          valueColor="var(--color-critical-tx)"
        />
        <SettingRow
          label="HIGH threshold"
          description="Equipment with a risk score at or above this value is marked HIGH."
          value="≥ 50 / 100"
          valueColor="var(--color-high-tx)"
        />
        <SettingRow
          label="MEDIUM threshold"
          description="Equipment with a risk score at or above this value is marked MEDIUM."
          value="≥ 25 / 100"
          valueColor="var(--color-medium-tx)"
        />
        <SettingRow
          label="LOW threshold"
          description="Equipment below MEDIUM threshold. Continue standard monitoring."
          value="0 – 24"
          valueColor="var(--color-low-tx)"
        />
      </Card>

      {/* ── Alert Thresholds ──────────────────────────────────────── */}
      <Card>
        <SectionHeading icon={AlertTriangle} title="Alert Thresholds" />
        <SettingRow
          label="Outage high-probability threshold"
          description="Zones with an outage probability at or above this value are flagged in the dashboard."
          value="60%"
          valueColor="var(--color-high-tx)"
        />
        <SettingRow
          label="Maintenance gap alert"
          description="Equipment without maintenance for longer than this period triggers a recommendation."
          value="180 days"
        />
        <SettingRow
          label="Load alert threshold"
          description="Load percentage above which an alert is generated."
          value="85%"
          valueColor="var(--color-high-tx)"
        />
        <SettingRow
          label="Temperature alert threshold"
          description="Temperature above which a thermal stress alert is generated."
          value="75 °C"
          valueColor="var(--color-high-tx)"
        />
      </Card>

      {/* ── Risk Factor Weights ───────────────────────────────────── */}
      <Card>
        <SectionHeading icon={Activity} title="Risk Factor Weights (Scoring Model)" />
        <p className="text-[11px] text-[var(--color-text-3)] mb-3 italic">
          Weights sum to 1.0. Each factor contributes its normalised value × weight to the final 0–100 score.
        </p>
        {[
          { factor: "Load Stress",           weight: "0.25", pct: "25%" },
          { factor: "Thermal Stress",        weight: "0.20", pct: "20%" },
          { factor: "Equipment Age",         weight: "0.18", pct: "18%" },
          { factor: "Maintenance Gap",       weight: "0.15", pct: "15%" },
          { factor: "Failure History",       weight: "0.12", pct: "12%" },
          { factor: "Weather / Environment", weight: "0.06", pct: "6%"  },
          { factor: "Vibration Level",       weight: "0.04", pct: "4%"  },
        ].map(({ factor, pct }) => (
          <div key={factor} className="flex items-center gap-3 py-2 border-b border-[var(--color-base-4)] last:border-0">
            <span className="text-[13px] text-[var(--color-text-1)] flex-1">{factor}</span>
            <div className="w-24 h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-brand)]"
                style={{ width: pct }} />
            </div>
            <span className="font-mono text-[12px] text-[var(--color-brand)] w-8 text-right">{pct}</span>
          </div>
        ))}
        <div className="mt-3 pt-3 border-t border-[var(--color-base-4)]">
          <p className="text-[11px] text-[var(--color-text-3)] flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-[var(--color-low-tx)]" aria-hidden="true" />
            Weights sum to 1.00 — fully explainable, no black-box scoring
          </p>
        </div>
      </Card>

      {/* ── System info ───────────────────────────────────────────── */}
      <Card>
        <SectionHeading icon={Zap} title="System Information" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoTile label="Version"      value="1.0.0"            mono />
          <InfoTile label="Environment"  value="Development"      />
          <InfoTile label="API prefix"   value="/api/v1"          mono />
          <InfoTile label="Backend"      value="FastAPI + Python" />
          <InfoTile label="Frontend"     value="React + Vite"     />
          <InfoTile label="Data source"  value="Simulated JSON"   />
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--color-base-4)]">
          <p className="text-[11px] text-[var(--color-text-3)] flex items-start gap-1.5">
            <Info size={11} className="text-[var(--color-brand)] shrink-0 mt-0.5" aria-hidden="true" />
            To change thresholds, edit <span className="font-mono text-[var(--color-brand)]">backend/app/config.py</span> or
            set environment variables, then restart the backend server.
          </p>
        </div>
      </Card>

      <p className="text-[10px] text-[var(--color-text-3)] text-center border-t border-[var(--color-base-4)] pt-4">
        GridWise v1.0.0 · IBM Bob AI Innovation Hackathon ·{" "}
        <strong>Prototype — not a production system</strong>
      </p>
    </PageWrapper>
  );
}
