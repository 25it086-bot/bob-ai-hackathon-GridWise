import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: "up" | "down" | "neutral";
  accentColor?: string;
  subLabel?: string;
  isGlowing?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label, value, delta, deltaDir = "neutral",
  accentColor, subLabel, isGlowing, onClick, className,
}: Props) {
  // Adapt font size: large numbers need a smaller display size to avoid overflow
  const valStr = String(value);
  const valueFontSize =
    valStr.length <= 3 ? "text-[32px]" :
    valStr.length <= 6 ? "text-[26px]" :
    "text-[20px]";

  const inner = (
    <>
      {/* Left accent bar */}
      {accentColor && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div className={cn("flex flex-col gap-1", accentColor && "pl-2")}>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
          {label}
        </span>
        <span className={cn("font-bold leading-none font-mono text-[var(--color-text-0)]", valueFontSize)}>
          {value}
        </span>
        <div className="flex items-center gap-2 mt-1 min-h-[18px]">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                deltaDir === "up"      && "text-[var(--color-critical-tx)]",
                deltaDir === "down"    && "text-[var(--color-teal)]",
                deltaDir === "neutral" && "text-[var(--color-text-3)]"
              )}
            >
              {deltaDir === "up"   && <TrendingUp  size={12} aria-hidden />}
              {deltaDir === "down" && <TrendingDown size={12} aria-hidden />}
              {delta}
            </span>
          )}
          {subLabel && (
            <span className="text-xs text-[var(--color-text-3)]">{subLabel}</span>
          )}
        </div>
      </div>
    </>
  );

  const baseClasses = cn(
    "relative bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg p-5 overflow-hidden",
    "shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
    isGlowing && "shadow-[0_0_0_1px_rgba(239,68,68,.2),0_4px_16px_rgba(239,68,68,.1)]",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(baseClasses, "w-full text-left cursor-pointer hover:bg-[var(--color-base-3)] transition-colors")}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return <div className={baseClasses}>{inner}</div>;
}
