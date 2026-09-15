import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/types/risk";

interface Props {
  level: RiskLevel | string;
  size?: "sm" | "md";
  className?: string;
}

const styles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "bg-[var(--color-critical-bg)]", border: "border-[var(--color-critical-bd)]", text: "text-[var(--color-critical-tx)]", dot: "bg-[var(--color-critical)]" },
  high:     { bg: "bg-[var(--color-high-bg)]",     border: "border-[var(--color-high-bd)]",     text: "text-[var(--color-high-tx)]",     dot: "bg-[var(--color-high)]" },
  medium:   { bg: "bg-[var(--color-medium-bg)]",   border: "border-[var(--color-medium-bd)]",   text: "text-[var(--color-medium-tx)]",   dot: "bg-[var(--color-medium)]" },
  low:      { bg: "bg-[var(--color-low-bg)]",      border: "border-[var(--color-low-bd)]",      text: "text-[var(--color-low-tx)]",      dot: "bg-[var(--color-low)]" },
  unknown:  { bg: "bg-[var(--color-unknown-bg)]",  border: "border-[var(--color-unknown-bd)]",  text: "text-[var(--color-unknown-tx)]",  dot: "bg-[var(--color-unknown)]" },
};

export function RiskBadge({ level, size = "md", className }: Props) {
  const s = styles[level] ?? styles.unknown;
  const label = level.toUpperCase();
  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-widest uppercase",
        s.bg, s.border, s.text,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className
      )}
    >
      <span className={cn("rounded-full shrink-0", s.dot, size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")} />
      {label}
    </span>
  );
}
