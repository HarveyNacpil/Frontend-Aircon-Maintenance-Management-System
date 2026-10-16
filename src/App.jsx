import React, { useState, useEffect, useCallback, memo } from "react";
import { ApiHealthProvider } from "./context/ApiHealthContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Navbar } from "./components/layout/Navbar";

import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomersPage } from "./pages/CustomersPage";
import { AirconUnitsPage } from "./pages/AirconUnitsPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { ServiceRequestsPage } from "./pages/ServiceRequestsPage";
import { SparePartsPage } from "./pages/SparePartsPage";
import { UsersPage } from "./pages/UsersPage";
import { CustomerMapPage } from "./pages/CustomerMapPage";
import { StoresPage } from "./pages/StoresPage";

// Memoized Page wrappers to prevent re-rendering when sidebar toggles
const MemoizedDashboard = memo(DashboardPage);
const MemoizedCustomers = memo(CustomersPage);
const MemoizedCustomerMap = memo(CustomerMapPage);
const MemoizedStores = memo(StoresPage);
const MemoizedAircon = memo(AirconUnitsPage);
const MemoizedMaintenance = memo(MaintenancePage);
const MemoizedRequests = memo(ServiceRequestsPage);
const MemoizedSpareParts = memo(SparePartsPage);
const MemoizedUsers = memo(UsersPage);

const ActivePageContent = memo(function ActivePageContent({
  activeTab,
  setActiveTab,
  handleOpenModal,
  globalSearch,
  targetRecord,
  openRequestModalTrigger,
  openScheduleModalTrigger,
  theme,
}) {
  switch (activeTab) {
    case "dashboard":
      return <MemoizedDashboard setActiveTab={setActiveTab} onOpenModal={handleOpenModal} theme={theme} />;
    case "customers":
      return (
        <MemoizedCustomers
          globalSearch={globalSearch}
          targetCustomerId={targetRecord?.type === "customer" ? targetRecord.id : null}
        />
      );
    case "customermap":
      return <MemoizedCustomerMap setActiveTab={setActiveTab} theme={theme} />;
    case "stores":
      return <MemoizedStores globalSearch={globalSearch} setActiveTab={setActiveTab} theme={theme} />;
    case "aircon":
      return (
        <MemoizedAircon
          globalSearch={globalSearch}
          targetUnitId={targetRecord?.type === "unit" ? targetRecord.id : null}
        />
      );
    case "maintenance":
      return (
        <MemoizedMaintenance
          openScheduleModalTrigger={openScheduleModalTrigger}
          globalSearch={globalSearch}
          targetScheduleId={targetRecord?.type === "maintenance" ? targetRecord.id : null}
        />
      );
    case "requests":
      return (
        <MemoizedRequests
          openRequestModalTrigger={openRequestModalTrigger}
          globalSearch={globalSearch}
          targetRequestId={targetRecord?.type === "request" ? targetRecord.id : null}
        />
      );
    case "inventory":
      return <MemoizedSpareParts globalSearch={globalSearch} />;
    case "users":
      return <MemoizedUsers globalSearch={globalSearch} />;
    default:
      return null;
  }
});

function MainApp() {
  const { user } = useAuth();
  const { collapsed, isAnimating, onTransitionEnd } = useSidebar();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [targetRecord, setTargetRecord] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [openRequestModalTrigger, setOpenRequestModalTrigger] = useState(0);
  const [openScheduleModalTrigger, setOpenScheduleModalTrigger] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  const handleOpenModal = useCallback((modalType) => {
    if (modalType === "createRequest") {
      setActiveTab("requests");
      setOpenRequestModalTrigger(p => p + 1);
    } else if (modalType === "createSchedule") {
      setActiveTab("maintenance");
      setOpenScheduleModalTrigger(p => p + 1);
    }
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  }, []);

  const handleGlobalNavigate = useCallback(({ tab, searchQuery, targetRecord: record }) => {
    setActiveTab(tab);
    if (searchQuery !== undefined) {
      setGlobalSearch(searchQuery);
    }
    setTargetRecord(record || null);
    setMobileOpen(false);
  }, []);

  if (!user) return <AuthPage theme={theme} toggleTheme={toggleTheme} />;

  return (
    <div
      onTransitionEnd={onTransitionEnd}
      className={`app-shell h-[100dvh] max-h-[100dvh] w-full overflow-hidden ${
        isAnimating ? "is-sidebar-animating" : ""
      } ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
      style={{
        backgroundColor: "var(--page-bg)",
        color: "var(--text-primary)",
        "--sidebar-w": collapsed ? "72px" : "256px",
      }}
    >
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Grid Column 1 on Desktop) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area (Grid Column 2 on Desktop with layout paint containment) */}
      <div 
        className="main-content-area flex flex-col min-w-0 h-full overflow-hidden"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        <div className="shrink-0">
          <Navbar
            theme={theme}
            toggleTheme={toggleTheme}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            onMenuToggle={() => setMobileOpen(p => !p)}
            onNavigate={handleGlobalNavigate}
          />
        </div>
        <main 
          className="flex-1 min-h-0 flex flex-col overflow-hidden w-full relative"
          style={{ backgroundColor: "var(--page-bg)" }}
        >
          <ActivePageContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleOpenModal={handleOpenModal}
            globalSearch={globalSearch}
            targetRecord={targetRecord}
            openRequestModalTrigger={openRequestModalTrigger}
            openScheduleModalTrigger={openScheduleModalTrigger}
            theme={theme}
          />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ApiHealthProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <SidebarProvider>
              <MainApp />
            </SidebarProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ApiHealthProvider>
  );
}
