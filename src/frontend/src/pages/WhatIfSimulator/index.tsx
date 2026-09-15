import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FlaskConical, Sliders, ArrowRight, TrendingUp, TrendingDown,
  Minus, RefreshCw, ChevronDown, Info, AlertTriangle, ShieldCheck,
  Thermometer, Activity, Zap, Wind, Wrench, Clock, BarChart2,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import { useEquipmentList } from "@/hooks";
import { simulatorApi } from "@/api/simulator";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/common/Card";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ProgressRing } from "@/components/common/ProgressRing";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/formatters";
import type { SimulatorInput, SimulatorResult, WeatherCondition } from "@/types/simulator";
import type { EquipmentSummary } from "@/types/equipment";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: React.ElementType }[] = [
  { value: "normal",       label: "Normal",       icon: Wind },
  { value: "high_wind",    label: "High Wind",    icon: Wind },
  { value: "extreme_heat", label: "Extreme Heat", icon: Thermometer },
  { value: "storm",        label: "Storm",        icon: AlertTriangle },
];

const FACTOR_ICONS: Record<string, React.ElementType> = {
  temperature:       Thermometer,
  load:              Activity,
  vibration:         Zap,
  age:               Clock,
  maintenance:       Wrench,
  previous_failures: AlertCircle,
  weather:           Wind,
};

const LEVEL_COLORS = {
  critical: { tx: "var(--color-critical-tx)", bg: "var(--color-critical-bg)", bd: "var(--color-critical-bd)", dot: "var(--color-critical)" },
  high:     { tx: "var(--color-high-tx)",     bg: "var(--color-high-bg)",     bd: "var(--color-high-bd)",     dot: "var(--color-high)" },
  medium:   { tx: "var(--color-medium-tx)",   bg: "var(--color-medium-bg)",   bd: "var(--color-medium-bd)",   dot: "var(--color-medium)" },
  low:      { tx: "var(--color-low-tx)",      bg: "var(--color-low-bg)",      bd: "var(--color-low-bd)",      dot: "var(--color-low)" },
  unknown:  { tx: "var(--color-text-3)",      bg: "var(--color-base-3)",      bd: "var(--color-base-5)",      dot: "var(--color-text-3)" },
} as const;

function lv(level: string) {
  return LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] ?? LEVEL_COLORS.unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a SimulatorInput from an EquipmentSummary (current / baseline state)
// ─────────────────────────────────────────────────────────────────────────────

function buildInputFromSummary(eq: EquipmentSummary): SimulatorInput {
  return {
    equipment_id:           eq.id,
    temperature_c:          eq.temperature_c    ?? 45,
    load_pct:               eq.load_pct         ?? 60,
    vibration_mms:          eq.vibration_mms    ?? 1.5,
    age_years:              eq.age_years,
    days_since_maintenance: eq.days_since_maintenance ?? 90,
    previous_failures:      eq.previous_failures_2yr ?? 0,
    weather_condition:      "normal",
    customers_affected:     eq.customers_affected,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slider control
// ─────────────────────────────────────────────────────────────────────────────

interface SliderProps {
  label:    string;
  icon:     React.ElementType;
  value:    number;
  baseline: number;
  min:      number;
  max:      number;
  step:     number;
  unit:     string;
  decimals?: number;
  warnAbove?: number;
  critAbove?: number;
  onChange: (v: number) => void;
}

function SliderControl({
  label, icon: Icon, value, baseline,
  min, max, step, unit, decimals = 0,
  warnAbove, critAbove, onChange,
}: SliderProps) {
  const isCrit = critAbove != null && value >= critAbove;
  const isWarn = warnAbove != null && value >= warnAbove && !isCrit;
  const changed = Math.abs(value - baseline) > step * 0.1;
  const increased = value > baseline;
  const pct = ((value - min) / (max - min)) * 100;

  const trackColor = isCrit ? "var(--color-critical)" : isWarn ? "var(--color-high)" : "var(--color-brand)";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={12} style={{ color: isCrit ? "var(--color-critical-tx)" : isWarn ? "var(--color-high-tx)" : "var(--color-text-3)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {changed && (
            <span className="text-[10px] text-[var(--color-text-3)] font-mono line-through opacity-60">
              {baseline.toFixed(decimals)}{unit}
            </span>
          )}
          <span
            className="font-mono text-[14px] font-bold"
            style={{ color: isCrit ? "var(--color-critical-tx)" : isWarn ? "var(--color-high-tx)" : "var(--color-text-0)" }}
          >
            {value.toFixed(decimals)}{unit}
          </span>
          {changed && (
            <span className="text-[10px] font-semibold" style={{ color: increased ? "var(--color-critical-tx)" : "var(--color-low-tx)" }}>
              {increased ? "▲" : "▼"}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-1.5 rounded-full bg-[var(--color-base-4)]">
        {/* Baseline marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-full bg-[var(--color-base-5)] z-10"
          style={{ left: `${((baseline - min) / (max - min)) * 100}%` }}
          title={`Baseline: ${baseline.toFixed(decimals)}${unit}`}
        />
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, background: trackColor }}
        />
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 opacity-0 absolute"
        style={{ marginTop: "-22px", cursor: "pointer", position: "relative", zIndex: 20 }}
        aria-label={label}
      />
      <div className="flex justify-between text-[9px] text-[var(--color-text-3)]">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather picker
// ─────────────────────────────────────────────────────────────────────────────

function WeatherPicker({
  value,
  baseline,
  onChange,
}: {
  value: WeatherCondition;
  baseline: WeatherCondition;
  onChange: (v: WeatherCondition) => void;
}) {
  const changed = value !== baseline;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wind size={12} className="text-[var(--color-text-3)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
            Weather Condition
          </span>
        </div>
        {changed && (
          <span className="text-[10px] text-[var(--color-high-tx)] font-semibold">Changed</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {WEATHER_OPTIONS.map(({ value: v, label, icon: Icon }) => {
          const isSelected = value === v;
          const isBaseline = baseline === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded border text-[11px] font-medium transition-colors text-left",
                isSelected
                  ? v === "storm" || v === "extreme_heat"
                    ? "bg-[var(--color-high-bg)] border-[var(--color-high-bd)] text-[var(--color-high-tx)]"
                    : "bg-[var(--color-brand)] bg-opacity-10 border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "bg-[var(--color-base-3)] border-[var(--color-base-4)] text-[var(--color-text-2)] hover:border-[var(--color-base-5)]"
              )}
            >
              <Icon size={11} />
              {label}
              {isBaseline && !isSelected && (
                <span className="ml-auto text-[9px] text-[var(--color-text-3)]">base</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk score ring with animated transition hint
// ─────────────────────────────────────────────────────────────────────────────

function ScoreDisplay({
  score,
  level,
  label,
  size = 96,
}: {
  score: number;
  level: string;
  label: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ProgressRing score={score} size={size} strokeWidth={8} />
      <div className="text-center">
        <RiskBadge level={level} size="sm" />
        <p className="text-[10px] text-[var(--color-text-3)] mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor diff row
// ─────────────────────────────────────────────────────────────────────────────

function FactorDiffRow({
  currentScore,
  whatifScore,
  factorKey,
  label,
}: {
  currentScore: number;
  whatifScore:  number;
  factorKey:    string;
  label:        string;
}) {
  const delta = whatifScore - currentScore;
  const absDelta = Math.abs(delta);
  const Icon = FACTOR_ICONS[factorKey] ?? BarChart2;
  const maxBar = 25; // max score_contribution is weight*100 = 25 at most

  const currentPct = Math.min((currentScore / maxBar) * 100, 100);
  const whatifPct  = Math.min((whatifScore  / maxBar) * 100, 100);

  const wColor = whatifScore >= 15 ? "var(--color-critical)" : whatifScore >= 10 ? "var(--color-high)" : whatifScore >= 5 ? "var(--color-medium)" : "var(--color-low)";
  const cColor = currentScore >= 15 ? "var(--color-critical)" : currentScore >= 10 ? "var(--color-high)" : currentScore >= 5 ? "var(--color-medium)" : "var(--color-low)";

  return (
    <div className={cn(
      "grid grid-cols-[1fr_2fr_1fr_2fr_auto] items-center gap-2 py-2 border-b border-[var(--color-base-4)] last:border-0 text-[11px]",
      absDelta > 1 && "bg-[rgba(59,130,246,0.03)] rounded"
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={11} className="text-[var(--color-text-3)] shrink-0" />
        <span className="text-[var(--color-text-2)] truncate">{label}</span>
      </div>
      {/* Current bar */}
      <div className="h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${currentPct}%`, background: cColor }} />
      </div>
      {/* What-if bar */}
      <div className="h-1.5 rounded-full bg-[var(--color-base-4)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${whatifPct}%`, background: wColor }} />
      </div>
      {/* Delta */}
      <div className="text-right font-mono font-semibold whitespace-nowrap" style={{
        color: delta > 0.5 ? "var(--color-critical-tx)" : delta < -0.5 ? "var(--color-low-tx)" : "var(--color-text-3)"
      }}>
        {delta > 0.5 ? "+" : ""}{delta.toFixed(1)}
      </div>
      {absDelta > 0.5 && (
        <span style={{ color: delta > 0 ? "var(--color-critical-tx)" : "var(--color-low-tx)", fontSize: "10px" }}>
          {delta > 0 ? "▲" : "▼"}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar tooltip
// ─────────────────────────────────────────────────────────────────────────────

const RadarTip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { factor: string } }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-medium text-[var(--color-text-0)]">{payload[0].payload.factor}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono text-[var(--color-text-2)]">
          {p.name}: <span className="font-bold text-[var(--color-text-0)]">{(p.value * 100).toFixed(0)}%</span>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Equipment picker dropdown
// ─────────────────────────────────────────────────────────────────────────────

function EquipmentPicker({
  selected,
  onSelect,
}: {
  selected: EquipmentSummary | null;
  onSelect: (eq: EquipmentSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useEquipmentList({
    sort_by: "risk_score", sort_dir: "desc", page_size: 100,
    search: search || undefined,
  });

  const items = data?.data ?? [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded border text-sm transition-colors text-left",
          "bg-[var(--color-base-3)] border-[var(--color-base-4)] text-[var(--color-text-1)]",
          "hover:border-[var(--color-base-5)] focus:outline-none focus:border-[var(--color-brand)]"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span className="text-sm font-medium truncate">{selected.name}</span>
              <span className="font-mono text-[10px] text-[var(--color-brand)] shrink-0">{selected.id}</span>
              <RiskBadge level={selected.risk_level ?? "unknown"} size="sm" />
            </>
          ) : (
            <span className="text-[var(--color-text-3)]">Select equipment to simulate…</span>
          )}
        </div>
        <ChevronDown size={14} className={cn("text-[var(--color-text-3)] transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-[var(--color-base-4)] bg-[var(--color-base-1)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-base-4)]">
            <input
              autoFocus
              type="search"
              placeholder="Search by name, ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 rounded text-sm bg-[var(--color-base-3)] border border-[var(--color-base-4)] text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <div className="p-3"><LoadingSkeleton variant="text" rows={3} /></div>
            ) : items.length === 0 ? (
              <p className="p-3 text-sm text-[var(--color-text-3)] text-center">No equipment found</p>
            ) : (
              items.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => { onSelect(eq); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-base-3)] transition-colors text-sm border-b border-[var(--color-base-4)] last:border-0",
                    selected?.id === eq.id && "bg-[var(--color-base-3)]"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-text-0)] truncate">{eq.name}</p>
                    <p className="font-mono text-[10px] text-[var(--color-brand)]">{eq.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RiskBadge level={eq.risk_level ?? "unknown"} size="sm" />
                    {eq.risk_score != null && (
                      <span className="font-mono text-[11px] text-[var(--color-text-2)]">
                        {eq.risk_score.toFixed(0)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const navigate = useNavigate();

  // Selected equipment baseline
  const [selectedEq, setSelectedEq] = useState<EquipmentSummary | null>(null);

  // Baseline (frozen when equipment selected)
  const [baseline, setBaseline] = useState<SimulatorInput | null>(null);

  // Live what-if state (mutated by sliders)
  const [whatif, setWhatif] = useState<SimulatorInput | null>(null);

  // Calculation results
  const [currentResult, setCurrentResult] = useState<SimulatorResult | null>(null);
  const [whatifResult,  setWhatifResult]  = useState<SimulatorResult | null>(null);

  // Loading / error states
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Select equipment ────────────────────────────────────────────────────
  const handleSelectEquipment = useCallback(async (eq: EquipmentSummary) => {
    setSelectedEq(eq);
    setCalcError(null);
    const inp = buildInputFromSummary(eq);
    setBaseline(inp);
    setWhatif({ ...inp });

    // Calculate baseline score immediately
    try {
      setCalculating(true);
      const res = await simulatorApi.score(inp);
      setCurrentResult(res);
      setWhatifResult(res);
    } catch {
      setCalcError("Could not calculate risk score. Is the backend running?");
    } finally {
      setCalculating(false);
    }
  }, []);

  // ── Recalculate what-if (debounced) ────────────────────────────────────
  const recalculate = useCallback((inp: SimulatorInput) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setCalculating(true);
        setCalcError(null);
        const res = await simulatorApi.score(inp);
        setWhatifResult(res);
      } catch {
        setCalcError("Recalculation failed. Check your inputs.");
      } finally {
        setCalculating(false);
      }
    }, 350);
  }, []);

  // ── Slider helpers ──────────────────────────────────────────────────────
  function update<K extends keyof SimulatorInput>(key: K, value: SimulatorInput[K]) {
    if (!whatif) return;
    const next = { ...whatif, [key]: value };
    setWhatif(next);
    recalculate(next);
  }

  // ── Reset to baseline ──────────────────────────────────────────────────
  const resetToBaseline = useCallback(() => {
    if (!baseline) return;
    setWhatif({ ...baseline });
    recalculate(baseline);
  }, [baseline, recalculate]);

  // ── Derived diff values ────────────────────────────────────────────────
  const scoreDelta   = whatifResult && currentResult ? whatifResult.risk_score - currentResult.risk_score : 0;
  const levelChanged = whatifResult && currentResult && whatifResult.risk_level !== currentResult.risk_level;
  const hasChanges   = whatif && baseline && JSON.stringify(whatif) !== JSON.stringify(baseline);

  // Factor score map for diff table
  const currentFactorMap = Object.fromEntries(
    (currentResult?.factor_scores ?? []).map((f) => [f.factor, f.score_contribution])
  );

  // Radar data for overlay chart
  const radarData = (whatifResult?.factor_scores ?? []).map((f) => {
    const cF = currentResult?.factor_scores.find((x) => x.factor === f.factor);
    return {
      factor:  f.label,
      key:     f.factor,
      current: cF?.normalized_value ?? 0,
      whatif:  f.normalized_value,
    };
  });

  return (
    <PageWrapper
      title="What-If Simulator"
      subtitle="Modify operational conditions and instantly see the risk impact"
      action={
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              onClick={resetToBaseline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-base-4)] text-[11px] text-[var(--color-text-2)] hover:text-[var(--color-text-0)] transition-colors"
            >
              <RefreshCw size={12} /> Reset
            </button>
          )}
        </div>
      }
    >
      {/* ── Prototype banner ── */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[rgba(139,92,246,.3)] bg-[rgba(139,92,246,.05)] text-[11px] text-[var(--color-text-2)]">
        <FlaskConical size={13} className="text-[var(--color-ai-purple)] shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-[var(--color-ai-purple)]">Heuristic simulation —</span>{" "}
          Results are calculated in real-time by the GridWise Risk Engine using a
          weighted-factor model. This is a prototype estimate, not a certified engineering model.
        </p>
      </div>

      {/* ── Equipment picker ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Sliders size={14} className="text-[var(--color-text-3)]" />
          <h2 className="text-[14px] font-semibold text-[var(--color-text-0)]">Select Equipment</h2>
          <span className="text-[11px] text-[var(--color-text-3)] italic">
            — loads real current sensor readings as the baseline
          </span>
        </div>
        <EquipmentPicker selected={selectedEq} onSelect={handleSelectEquipment} />
        {selectedEq && (
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--color-text-3)]">
            <span>Type: <span className="text-[var(--color-text-2)] capitalize">{selectedEq.type}</span></span>
            <span>Zone: <span className="text-[var(--color-text-2)]">{selectedEq.zone_name ?? selectedEq.zone_id}</span></span>
            <span>Customers: <span className="text-[var(--color-text-2)]">{formatNumber(selectedEq.customers_affected)}</span></span>
            <button
              type="button"
              onClick={() => navigate(`/equipment/${selectedEq.id}`)}
              className="text-[var(--color-brand)] hover:underline"
            >
              View detail →
            </button>
          </div>
        )}
      </Card>

      {calcError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--color-critical-bd)] bg-[var(--color-critical-bg)] text-[12px] text-[var(--color-critical-tx)]">
          <AlertCircle size={13} /> {calcError}
        </div>
      )}

      {!selectedEq ? (
        /* ── Empty state ── */
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-base-3)] border border-[var(--color-base-4)] flex items-center justify-center">
              <FlaskConical size={28} className="text-[var(--color-text-3)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[var(--color-text-0)]">No equipment selected</p>
              <p className="text-sm text-[var(--color-text-3)] mt-1 max-w-sm">
                Pick any equipment from the dropdown above.
                The simulator will load its real current readings as the baseline,
                then let you adjust conditions to see how risk changes.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">

          {/* ════════════════════════════════════════════════════════════
              LEFT — Controls panel
          ════════════════════════════════════════════════════════════ */}
          <Card className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-base-4)]">
              <Sliders size={13} className="text-[var(--color-text-3)]" />
              <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">Adjust Conditions</h3>
              {hasChanges && (
                <span className="ml-auto text-[10px] text-[var(--color-brand)] font-semibold border border-[rgba(59,130,246,.3)] rounded-full px-1.5 py-0.5">
                  Modified
                </span>
              )}
            </div>

            {whatif && baseline && (
              <>
                <SliderControl
                  label="Load"
                  icon={Activity}
                  value={whatif.load_pct ?? 0}
                  baseline={baseline.load_pct ?? 0}
                  min={0} max={100} step={1} unit="%" decimals={0}
                  warnAbove={80} critAbove={90}
                  onChange={(v) => update("load_pct", v)}
                />
                <SliderControl
                  label="Temperature"
                  icon={Thermometer}
                  value={whatif.temperature_c ?? 0}
                  baseline={baseline.temperature_c ?? 0}
                  min={-10} max={120} step={1} unit="°C" decimals={0}
                  warnAbove={75} critAbove={90}
                  onChange={(v) => update("temperature_c", v)}
                />
                <SliderControl
                  label="Vibration"
                  icon={Zap}
                  value={whatif.vibration_mms ?? 0}
                  baseline={baseline.vibration_mms ?? 0}
                  min={0} max={15} step={0.1} unit=" mm/s" decimals={1}
                  warnAbove={4} critAbove={7}
                  onChange={(v) => update("vibration_mms", v)}
                />
                <SliderControl
                  label="Days Since Maintenance"
                  icon={Wrench}
                  value={whatif.days_since_maintenance ?? 0}
                  baseline={baseline.days_since_maintenance ?? 0}
                  min={0} max={730} step={5} unit="d" decimals={0}
                  warnAbove={180} critAbove={365}
                  onChange={(v) => update("days_since_maintenance", v)}
                />
                <SliderControl
                  label="Previous Failures (2yr)"
                  icon={AlertCircle}
                  value={whatif.previous_failures ?? 0}
                  baseline={baseline.previous_failures ?? 0}
                  min={0} max={10} step={1} unit="" decimals={0}
                  warnAbove={2} critAbove={4}
                  onChange={(v) => update("previous_failures", v)}
                />
                <WeatherPicker
                  value={whatif.weather_condition ?? "normal"}
                  baseline={baseline.weather_condition ?? "normal"}
                  onChange={(v) => update("weather_condition", v)}
                />

                {/* Reset */}
                {hasChanges && (
                  <button
                    type="button"
                    onClick={resetToBaseline}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-[var(--color-base-4)] text-[11px] text-[var(--color-text-2)] hover:bg-[var(--color-base-3)] transition-colors"
                  >
                    <RefreshCw size={11} /> Reset to current readings
                  </button>
                )}

                {/* Fixed factor note */}
                <p className="text-[10px] text-[var(--color-text-3)] italic">
                  Age ({baseline.age_years}yr) is a fixed asset attribute and cannot be simulated.
                </p>
              </>
            )}
          </Card>

          {/* ════════════════════════════════════════════════════════════
              RIGHT — Results panel
          ════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Score comparison hero ── */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={13} className="text-[var(--color-text-3)]" />
                <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">Risk Score Comparison</h3>
                {calculating && (
                  <span className="ml-auto text-[10px] text-[var(--color-brand)] animate-pulse">Calculating…</span>
                )}
              </div>

              <div className="flex items-center justify-center gap-6 py-4">
                {/* Current */}
                {currentResult ? (
                  <ScoreDisplay
                    score={currentResult.risk_score}
                    level={currentResult.risk_level}
                    label="Current"
                    size={100}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[var(--color-base-3)] border border-[var(--color-base-4)] flex items-center justify-center">
                    <LoadingSkeleton variant="card" />
                  </div>
                )}

                {/* Arrow + delta */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-[13px] font-bold font-mono"
                    style={scoreDelta > 0
                      ? { background: "var(--color-critical-bg)", borderColor: "var(--color-critical-bd)", color: "var(--color-critical-tx)" }
                      : scoreDelta < 0
                      ? { background: "var(--color-low-bg)", borderColor: "var(--color-low-bd)", color: "var(--color-low-tx)" }
                      : { background: "var(--color-base-3)", borderColor: "var(--color-base-4)", color: "var(--color-text-3)" }
                    }
                  >
                    {scoreDelta > 0 ? <TrendingUp size={13} /> : scoreDelta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                    {scoreDelta > 0 ? "+" : ""}{scoreDelta.toFixed(1)}
                  </div>
                  <ArrowRight size={20} className="text-[var(--color-text-3)]" />
                  {levelChanged && (
                    <span className="text-[10px] font-semibold" style={{ color: "var(--color-high-tx)" }}>
                      Level changed!
                    </span>
                  )}
                </div>

                {/* What-if */}
                {whatifResult ? (
                  <ScoreDisplay
                    score={whatifResult.risk_score}
                    level={whatifResult.risk_level}
                    label="What-If"
                    size={100}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[var(--color-base-3)] border border-[var(--color-base-4)] flex items-center justify-center">
                    <LoadingSkeleton variant="card" />
                  </div>
                )}
              </div>

              {/* Score bar comparison */}
              {currentResult && whatifResult && (
                <div className="mt-2 space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[var(--color-text-3)]">
                      <span>Current: {currentResult.risk_score.toFixed(1)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-base-4)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${currentResult.risk_score}%`,
                          background: lv(currentResult.risk_level).dot,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[var(--color-text-3)]">
                      <span>What-If: {whatifResult.risk_score.toFixed(1)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-base-4)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${whatifResult.risk_score}%`,
                          background: lv(whatifResult.risk_level).dot,
                        }}
                      />
                    </div>
                  </div>
                  {/* Threshold markers */}
                  <div className="relative h-3 text-[9px] text-[var(--color-text-3)]">
                    <span className="absolute" style={{ left: "25%", transform: "translateX(-50%)" }}>25 Med</span>
                    <span className="absolute" style={{ left: "50%", transform: "translateX(-50%)" }}>50 High</span>
                    <span className="absolute" style={{ left: "75%", transform: "translateX(-50%)" }}>75 Crit</span>
                  </div>
                </div>
              )}
            </Card>

            {/* ── Factor diff table ── */}
            {currentResult && whatifResult && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={13} className="text-[var(--color-text-3)]" />
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">
                    Which Factors Changed?
                  </h3>
                  <span className="text-[10px] text-[var(--color-text-3)] italic">score contribution pts</span>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_2fr_1fr_2fr_auto] gap-2 text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-3)] pb-2 border-b border-[var(--color-base-4)]">
                  <span>Factor</span>
                  <span>Current</span>
                  <span>What-If</span>
                  <span className="text-right">Δ pts</span>
                  <span />
                </div>
                {whatifResult.factor_scores.map((wf) => (
                  <FactorDiffRow
                    key={wf.factor}
                    factorKey={wf.factor}
                    label={wf.label}
                    currentScore={currentFactorMap[wf.factor] ?? 0}
                    whatifScore={wf.score_contribution}
                  />
                ))}
              </Card>
            )}

            {/* ── Radar overlay ── */}
            {radarData.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={13} className="text-[var(--color-text-3)]" />
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">Factor Profile Overlay</h3>
                  <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--color-text-3)]">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[var(--color-text-3)] inline-block opacity-60" /> Current</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[var(--color-brand)] inline-block" /> What-If</span>
                  </div>
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--color-base-4)" />
                      <PolarAngleAxis
                        dataKey="factor"
                        tick={{ fontSize: 9, fill: "var(--color-text-3)" }}
                      />
                      <Radar
                        name="Current"
                        dataKey="current"
                        stroke="var(--color-text-3)"
                        fill="var(--color-text-3)"
                        fillOpacity={0.08}
                        strokeWidth={1}
                        strokeDasharray="4 2"
                      />
                      <Radar
                        name="What-If"
                        dataKey="whatif"
                        stroke="var(--color-brand)"
                        fill="var(--color-brand)"
                        fillOpacity={0.18}
                        strokeWidth={1.5}
                      />
                      <ReTooltip content={<RadarTip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* ── Why did the score change? ── */}
            {whatifResult && whatifResult.contributing_factors.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={13} className="text-[var(--color-text-3)]" />
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">
                    Why Is the Score {whatifResult.risk_score.toFixed(0)}?
                  </h3>
                </div>
                <div className="space-y-2">
                  {whatifResult.contributing_factors.map((sentence, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-2.5 p-3 rounded-lg border",
                        i === 0
                          ? "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)]"
                          : "bg-[var(--color-base-3)] border-[var(--color-base-4)]"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5",
                        i === 0 ? "bg-[var(--color-critical)] text-white" : "bg-[var(--color-base-5)] text-[var(--color-text-2)]"
                      )}>
                        {i + 1}
                      </span>
                      <p className={cn(
                        "text-[12px] leading-snug",
                        i === 0 ? "text-[var(--color-critical-tx)]" : "text-[var(--color-text-1)]"
                      )}>
                        {sentence}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Potential outage impact ── */}
            {whatifResult && currentResult && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={13} className="text-[var(--color-text-3)]" />
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">Potential Outage Impact</h3>
                  <span className="text-[10px] text-[var(--color-text-3)] italic">prototype estimate</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Customers Served</p>
                    <p className="font-mono text-[18px] font-bold text-[var(--color-text-0)] mt-0.5">
                      {formatNumber(selectedEq.customers_affected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">Current Risk</p>
                    <p className="font-mono text-[18px] font-bold mt-0.5" style={{ color: lv(currentResult.risk_level).tx }}>
                      {currentResult.risk_score.toFixed(0)}/100
                    </p>
                    <RiskBadge level={currentResult.risk_level} size="sm" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">What-If Risk</p>
                    <p className="font-mono text-[18px] font-bold mt-0.5" style={{ color: lv(whatifResult.risk_level).tx }}>
                      {whatifResult.risk_score.toFixed(0)}/100
                    </p>
                    <RiskBadge level={whatifResult.risk_level} size="sm" />
                  </div>
                </div>
                {scoreDelta !== 0 && (
                  <div
                    className="mt-4 p-3 rounded-lg border"
                    style={scoreDelta > 0
                      ? { background: "var(--color-critical-bg)", borderColor: "var(--color-critical-bd)" }
                      : { background: "var(--color-low-bg)", borderColor: "var(--color-low-bd)" }
                    }
                  >
                    <p className="text-[12px] leading-snug font-medium" style={{ color: scoreDelta > 0 ? "var(--color-critical-tx)" : "var(--color-low-tx)" }}>
                      {scoreDelta > 0
                        ? `⚠ Risk increased by ${scoreDelta.toFixed(1)} points under these conditions — equipment failure probability is elevated.`
                        : `✓ Risk decreased by ${Math.abs(scoreDelta).toFixed(1)} points — these changes would reduce the failure probability.`
                      }
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* ── Recommended actions ── */}
            {whatifResult && whatifResult.recommended_actions.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={13} className="text-[var(--color-text-3)]" />
                  <h3 className="text-[13px] font-semibold text-[var(--color-text-0)]">Recommended Preventive Actions</h3>
                  <span
                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold border border-[rgba(139,92,246,.3)] rounded-full px-1.5 py-0.5"
                    style={{ color: "var(--color-ai-purple)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-purple)]" />
                    Engine
                  </span>
                </div>
                <div className="space-y-2">
                  {whatifResult.recommended_actions.map((action, i) => {
                    const isUrgent = i === 0 && (whatifResult.risk_level === "critical" || whatifResult.risk_level === "high");
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-3 p-3 rounded-lg border-l-2",
                          isUrgent
                            ? "bg-[var(--color-high-bg)] border-[var(--color-high)]"
                            : "bg-[var(--color-base-3)] border-[var(--color-base-5)]"
                        )}
                        style={{ borderTopColor: "var(--color-base-4)", borderRightColor: "var(--color-base-4)", borderBottomColor: "var(--color-base-4)" }}
                      >
                        <span
                          className="shrink-0 font-mono text-[14px] font-bold"
                          style={{ color: isUrgent ? "var(--color-high-tx)" : "var(--color-text-3)" }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p className="text-[12px] leading-snug text-[var(--color-text-1)]">{action}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* All clear */}
            {whatifResult && whatifResult.recommended_actions.length === 0 && (
              <Card>
                <div className="flex items-center gap-3 py-4">
                  <CheckCircle2 size={20} className="text-[var(--color-low)]" />
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--color-text-0)]">No actions required</p>
                    <p className="text-[11px] text-[var(--color-text-3)]">
                      Under these conditions, equipment risk is within acceptable parameters.
                    </p>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </div>
      )}

      {/* ── Footer disclaimer ── */}
      <div className="pt-2 border-t border-[var(--color-base-4)]">
        <p className="text-[10px] text-[var(--color-text-3)] italic flex items-start gap-1.5">
          <Info size={11} className="shrink-0 mt-0.5" />
          The simulator uses the GridWise Risk Engine (weighted-factor heuristic). Results are
          real-time calculations, not cached scores. This is a prototype — not a substitute for
          certified engineering analysis.
        </p>
      </div>

    </PageWrapper>
  );
}
