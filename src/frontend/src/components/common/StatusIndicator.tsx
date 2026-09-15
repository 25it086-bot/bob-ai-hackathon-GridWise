import { cn } from "@/lib/cn";
import { STATUS_COLORS } from "@/config/constants";

interface Props {
  status: string;
  showLabel?: boolean;
  className?: string;
}

const labels: Record<string, string> = {
  operational: "Operational",
  degraded:    "Degraded",
  critical:    "Critical",
  offline:     "Offline",
  maintenance: "Maintenance",
};

export function StatusIndicator({ status, showLabel = true, className }: Props) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
  const isCritical = status === "critical";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("rounded-full w-2 h-2 shrink-0", isCritical && "pulse-critical")}
        style={{ backgroundColor: color }}
        aria-label={`Status: ${labels[status] ?? status}`}
      />
      {showLabel && (
        <span className="text-[var(--color-text-2)] text-xs">{labels[status] ?? status}</span>
      )}
    </span>
  );
}
