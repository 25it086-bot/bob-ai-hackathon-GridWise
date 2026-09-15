import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/Dashboard";
import EquipmentRiskPage from "@/pages/EquipmentRisk";
import EquipmentDetailPage from "@/pages/EquipmentDetail";
import GridZonesPage from "@/pages/GridZones";
import OutageRiskPage from "@/pages/OutageRisk";
import RecommendationsPage from "@/pages/Recommendations";
import AlertsPage from "@/pages/Alerts";
import SimulatorPage from "@/pages/WhatIfSimulator";
import DataUploadPage from "@/pages/DataUpload";
import SettingsPage from "@/pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true,              element: <DashboardPage /> },
      { path: "equipment",        element: <EquipmentRiskPage /> },
      { path: "equipment/:id",    element: <EquipmentDetailPage /> },
      { path: "zones",            element: <GridZonesPage /> },
      { path: "outage",           element: <OutageRiskPage /> },
      { path: "recommendations",  element: <RecommendationsPage /> },
      { path: "alerts",           element: <AlertsPage /> },
      { path: "simulator",        element: <SimulatorPage /> },
      { path: "data",             element: <DataUploadPage /> },
      { path: "settings",         element: <SettingsPage /> },
    ],
  },
]);
