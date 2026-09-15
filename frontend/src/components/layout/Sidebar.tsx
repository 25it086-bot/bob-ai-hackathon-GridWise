import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/config/constants";
import { useAlertStore } from "@/store/alertStore";
import { useUIStore } from "@/store/uiStore";
import {
  LayoutDashboard, Zap, Map, AlertTriangle, FlaskConical,
  Shield, Bell, Upload, Settings, X,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Zap, Map, AlertTriangle, FlaskConical,
  Shield, Bell, Upload, Settings,
};

export function Sidebar() {
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();

  return (
    <>
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-30 h-full flex flex-col",
          "bg-[var(--color-base-1)] border-r border-[var(--color-base-4)]",
          "transition-transform duration-200 ease-in-out",
          "w-[228px]",
          // Mobile: slide in/out
          sidebarCollapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-[var(--color-base-4)] shrink-0">
          <div className="flex items-center gap-2.5">
            <Zap size={20} className="text-[var(--color-brand)]" />
            <span className="text-base font-bold text-[var(--color-text-0)] tracking-tight">GridWise</span>
          </div>
          <button
            className="lg:hidden text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
          {NAV_ITEMS.map((section) => (
            <div key={section.section} className="mb-1">
              <p className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-3)]">
                {section.section}
              </p>
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const isAlerts = item.path === "/alerts";
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => setSidebarCollapsed(true)}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-2.5 mx-2 px-3 py-2 rounded text-sm font-medium",
                        "transition-colors duration-100",
                        isActive
                          ? "bg-[rgba(59,130,246,0.12)] text-[var(--color-brand)] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-[var(--color-brand)] before:rounded-full"
                          : "text-[var(--color-text-2)] hover:bg-[var(--color-base-3)] hover:text-[var(--color-text-1)]"
                      )
                    }
                  >
                    {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
                    <span className="flex-1">{item.label}</span>
                    {isAlerts && unreadCount > 0 && (
                      <span
                        aria-label={`${unreadCount} unread alerts`}
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--color-base-4)] px-4 py-3">
          <p className="text-[10px] text-[var(--color-text-3)] uppercase tracking-widest mb-0.5">GridWise</p>
          <p className="text-[11px] font-mono text-[var(--color-text-2)]">v1.0.0 · Hackathon MVP</p>
        </div>
      </aside>
    </>
  );
}
