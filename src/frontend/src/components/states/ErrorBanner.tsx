import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, className }: Props) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-center gap-3 rounded-md border px-4 py-3",
        "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)]",
        className
      )}
    >
      <AlertCircle size={16} aria-hidden="true" className="text-[var(--color-critical)] shrink-0" />
      <span className="text-sm text-[var(--color-text-1)] flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 text-xs text-[var(--color-brand)] hover:underline shrink-0"
        >
          <RefreshCw size={12} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}
