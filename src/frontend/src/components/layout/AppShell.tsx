import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard";

export function AppShell() {
  const { data } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  return (
    <div className="min-h-screen bg-[var(--color-base-0)]">
      {/* Skip-to-content for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:bg-[var(--color-brand)] focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      <TopBar criticalCount={data?.critical_count ?? 0} />
      <Sidebar />
      <main
        className="lg:ml-[228px] pt-14 min-h-screen"
        id="main-content"
        tabIndex={-1}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
