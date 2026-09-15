import { cn } from "@/lib/cn";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ title, subtitle, action, children, className }: Props) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--color-base-4)]">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold text-[var(--color-text-0)] tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-[var(--color-text-3)] mt-1 leading-snug">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0 flex items-center">{action}</div>}
      </div>
      {children}
    </div>
  );
}
