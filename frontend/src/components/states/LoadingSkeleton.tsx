import { cn } from "@/lib/cn";

interface Props {
  className?: string;
  rows?: number;
  variant?: "card" | "table" | "text";
}

export function LoadingSkeleton({ className, rows = 3, variant = "card" }: Props) {
  if (variant === "table") {
    return (
      <div
        role="status"
        aria-label="Loading data"
        aria-busy="true"
        className={cn("space-y-2", className)}
      >
        <div className="skeleton h-10 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-2.5">
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 w-16" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  if (variant === "text") {
    return (
      <div
        role="status"
        aria-label="Loading data"
        aria-busy="true"
        className={cn("space-y-2", className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("skeleton h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label="Loading data"
      aria-busy="true"
      className={cn("space-y-3", className)}
    >
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-12 w-24" />
      <div className="skeleton h-4 w-32" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
