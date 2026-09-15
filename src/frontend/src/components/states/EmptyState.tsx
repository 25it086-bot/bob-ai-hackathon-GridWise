import { cn } from "@/lib/cn";
import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      <Icon size={40} aria-hidden="true" className="text-[var(--color-text-3)] mb-4" strokeWidth={1.5} />
      <p className="text-base font-semibold text-[var(--color-text-1)] mb-1">{title}</p>
      {message && <p className="text-sm text-[var(--color-text-3)] max-w-xs">{message}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 text-sm text-[var(--color-brand)] hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
