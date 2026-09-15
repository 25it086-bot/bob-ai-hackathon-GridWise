import { Bell, Menu, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useAlertStore } from "@/store/alertStore";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/cn";
import { useQuery } from "@tanstack/react-query";
import { alertsApi } from "@/api/alerts";
import { useEffect } from "react";

function SystemStatus({ criticalCount }: { criticalCount: number }) {
  const isCritical = criticalCount > 0;
  return (
    <div
      className={cn(
        "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        isCritical
          ? "bg-[var(--color-critical-bg)] border-[var(--color-critical-bd)] text-[var(--color-critical-tx)]"
          : "bg-[var(--color-low-bg)] border-[var(--color-low-bd)] text-[var(--color-low-tx)]"
      )}
    >
      <span
        className={cn("w-2 h-2 rounded-full shrink-0", isCritical ? "bg-[var(--color-critical)] pulse-critical" : "bg-[var(--color-low)]")}
      />
      {isCritical ? `${criticalCount} CRITICAL ALERT${criticalCount !== 1 ? "S" : ""}` : "GRID NOMINAL"}
    </div>
  );
}

export function TopBar({ criticalCount = 0 }: { criticalCount?: number }) {
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const setUnreadCount = useAlertStore((s) => s.setUnreadCount);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const { data } = useQuery({
    queryKey: ["alerts", "unread-count"],
    queryFn: () => alertsApi.unreadCount(),
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (data?.count !== undefined) setUnreadCount(data.count);
  }, [data, setUnreadCount]);

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 flex items-center px-4 sm:px-6 gap-4 bg-[var(--color-base-1)] border-b border-[var(--color-base-4)]">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden text-[var(--color-text-2)] hover:text-[var(--color-text-1)] p-1 rounded"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Logo (mobile) */}
      <div className="flex items-center gap-2 lg:hidden">
        <Activity size={18} className="text-[var(--color-brand)]" />
        <span className="text-sm font-bold text-[var(--color-text-0)]">GridWise</span>
      </div>

      {/* Spacer */}
      <div className="flex-1 flex items-center justify-center">
        <SystemStatus criticalCount={criticalCount} />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <Link
          to="/alerts"
          className="relative p-1.5 rounded text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-base-3)]"
          aria-label={`Alerts — ${unreadCount} unread`}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--color-critical)] text-white text-[9px] font-bold px-1"
              aria-live="polite"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--color-base-3)] border border-[var(--color-base-5)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-1)]">
            OP
          </div>
          <span className="hidden xl:block text-sm text-[var(--color-text-1)]">Operator</span>
        </div>
      </div>
    </header>
  );
}
