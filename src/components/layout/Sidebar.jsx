import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Users,
  Wind,
  CalendarCheck,
  Wrench,
  Package,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Store,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApiHealth } from "../../context/ApiHealthContext";
import { useSidebar } from "../../context/SidebarContext";

function TooltipPortal({ text, anchorRect, visible }) {
  if (!visible || !anchorRect || !text) return null;

  const top = anchorRect.top + anchorRect.height / 2;
  const left = anchorRect.right + 10;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        transform: "translateY(-50%)",
      }}
      className="z-[9999] pointer-events-none flex items-center animate-fade-in"
    >
      <div className="relative flex items-center">
        {/* Small arrow pointing left towards the icon */}
        <span
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
          className="w-2 h-2 rotate-45 border-l border-b -mr-1 z-10 shrink-0"
        />
        {/* Tooltip bubble */}
        <span
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xl border whitespace-nowrap"
        >
          {text}
        </span>
      </div>
    </div>,
    document.body
  );
}

export function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
}) {
  const { isAdmin } = useAuth();
  const { isOnline } = useApiHealth();
  const { collapsed, toggleSidebar, isAnimating } = useSidebar();

  const timerRef = useRef(null);
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: "",
    rect: null,
  });

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "customers", label: "Customers", icon: Users },
    { id: "customermap", label: "Customer Map Locator", icon: MapPin },
    { id: "stores", label: "Stores", icon: Store },
    { id: "aircon", label: "Aircon Fleet", icon: Wind },
    { id: "maintenance", label: "Maintenance & Logs", icon: CalendarCheck },
    { id: "requests", label: "Service Requests", icon: Wrench },
    { id: "inventory", label: "Spare Parts", icon: Package },
    ...(isAdmin ? [{ id: "users", label: "User Admin", icon: UserCheck }] : []),
  ];

  const handleShowTooltip = (el, text) => {
    // Only show tooltips when collapsed AND not currently running an animation
    if (!collapsed || isAnimating) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (el) {
        const rect = el.getBoundingClientRect();
        setTooltipState({ visible: true, text, rect });
      }
    }, 150);
  };

  const handleHideTooltip = () => {
    clearTimeout(timerRef.current);
    setTooltipState({ visible: false, text: "", rect: null });
  };

  // Hide tooltips whenever sidebar expands or an animation starts
  useEffect(() => {
    if (!collapsed || isAnimating) {
      clearTimeout(timerRef.current);
      setTooltipState({ visible: false, text: "", rect: null });
    }
  }, [collapsed, isAnimating]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      clearTimeout(timerRef.current);
      setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  return (
    <>
      {/* ── Desktop Sidebar (>= 768px) ─────────────────────────────── */}
      {/* Sidebar fills 100% of its grid cell width in the CSS grid shell */}
      <aside
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)" }}
        className="h-screen border-r z-40 flex flex-col shrink-0 hidden md:flex relative w-full overflow-visible select-none"
      >
        {/* Expand / Collapse Toggle Button on the sidebar's right edge */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-muted)" }}
          className="sidebar-toggle-btn absolute -right-3.5 top-5 z-50 w-7 h-7 rounded-full border shadow-md flex items-center justify-center hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Top Logo / Brand Header (Fixed height h-16 = 64px) */}
        <div style={{ borderColor: "var(--border)" }} className="h-16 flex items-center border-b shrink-0 px-4 overflow-hidden">
          <div className="flex items-center space-x-3 w-full">
            {/* Logo icon: always at x = 16px from sidebar left, centered in 72px collapsed width */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-500/25 shrink-0">
              <Wind className="w-5 h-5 text-white" />
            </div>
            {/* Logo text: always mounted, opacity-only transition */}
            <div className="sidebar-label leading-tight">
              <span style={{ color: "var(--text-primary)" }} className="font-extrabold text-sm tracking-tight block">
                AERO<span style={{ color: "var(--accent)" }}>FLOW</span>
              </span>
              <span style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold tracking-wider uppercase block">
                HVAC Fleet Ops
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-3.5 py-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                onMouseEnter={(e) => handleShowTooltip(e.currentTarget, item.label)}
                onMouseLeave={handleHideTooltip}
                onFocus={(e) => handleShowTooltip(e.currentTarget, item.label)}
                onBlur={handleHideTooltip}
                style={{
                  backgroundColor: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "var(--text-on-accent)" : "var(--text-primary)",
                }}
                className={`sidebar-nav-item w-full transition-all ${
                  isActive
                    ? "shadow-md shadow-sky-500/25 font-bold"
                    : "hover:bg-[var(--card-inner)] font-semibold"
                }`}
              >
                {/* Fixed Icon Slot (44x44px): center is always at x = 36px from sidebar left */}
                <div className="sidebar-icon-slot">
                  <Icon
                    className="w-5 h-5 shrink-0"
                    style={{
                      color: isActive ? "var(--text-on-accent)" : "var(--text-muted)",
                    }}
                  />
                </div>

                {/* Mounted Label: opacity-only transition, zero layout thrash */}
                <span className="sidebar-label pr-2">
                  {item.label}
                </span>

                {/* Mounted Active Dot */}
                {isActive && (
                  <span
                    style={{ backgroundColor: "var(--text-on-accent)" }}
                    className="sidebar-active-dot ml-auto mr-3 w-1.5 h-1.5 rounded-full shrink-0"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Footer API Status (Fixed height container) */}
        <div style={{ borderColor: "var(--border)" }} className="h-20 flex items-center justify-center shrink-0 border-t px-3.5 overflow-hidden">
          {/* Collapsed view: small status dot */}
          <div
            className={`w-full flex items-center justify-center ${
              collapsed ? "block" : "hidden"
            }`}
          >
            <button
              type="button"
              onMouseEnter={(e) =>
                handleShowTooltip(
                  e.currentTarget,
                  isOnline
                    ? "API Operational - Connected to .NET Core Backend"
                    : "API Offline - Port 5222 not reachable"
                )
              }
              onMouseLeave={handleHideTooltip}
              onFocus={(e) =>
                handleShowTooltip(
                  e.currentTarget,
                  isOnline
                    ? "API Operational - Connected to .NET Core Backend"
                    : "API Offline - Port 5222 not reachable"
                )
              }
              onBlur={handleHideTooltip}
              aria-label={
                isOnline
                  ? "API Operational - Connected to .NET Core Backend"
                  : "API Offline - Port 5222 not reachable"
              }
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--card-inner)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            >
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnline ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isOnline ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Expanded view: full status card */}
          <div
            className={`w-full sidebar-label ${
              collapsed ? "hidden opacity-0" : "block opacity-100"
            }`}
          >
            <div
              style={{
                backgroundColor: "var(--card-inner)",
                borderColor: isOnline ? "var(--border)" : "var(--status-danger-border)",
              }}
              className="p-2.5 rounded-xl border text-xs"
            >
              <div className="flex items-center space-x-2 font-bold mb-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"
                  }`}
                />
                <span
                  style={{
                    color: isOnline ? "var(--status-success-text)" : "var(--status-danger-text)",
                  }}
                  className="text-[10px] uppercase tracking-wider font-bold"
                >
                  {isOnline ? "API Operational" : "API Offline"}
                </span>
              </div>
              <p style={{ color: "var(--text-muted)" }} className="text-[10px] leading-tight truncate">
                {isOnline
                  ? "Connected to .NET Core Backend"
                  : "Port 5222 not reachable"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Overlay Drawer (< 768px) ───────────────────────── */}
      <aside
        style={{ backgroundColor: "var(--sidebar-bg)", borderColor: "var(--border)" }}
        className={`fixed top-0 left-0 h-full w-72 border-r z-50 flex flex-col transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div style={{ borderColor: "var(--border)" }} className="h-16 px-4 flex items-center justify-between border-b shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-500/25 shrink-0">
              <Wind className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span style={{ color: "var(--text-primary)" }} className="font-extrabold text-sm tracking-tight block">
                AERO<span style={{ color: "var(--accent)" }}>FLOW</span>
              </span>
              <span style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold tracking-wider uppercase block">
                HVAC Fleet Ops
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            style={{ color: "var(--text-muted)" }}
            className="p-2 rounded-xl hover:bg-[var(--card-inner)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                style={{
                  backgroundColor: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "var(--text-on-accent)" : "var(--text-primary)",
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 group relative ${
                  isActive
                    ? "shadow-md shadow-sky-500/25 font-bold"
                    : "hover:bg-[var(--card-inner)]"
                }`}
              >
                <Icon
                  className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    color: isActive ? "var(--text-on-accent)" : "var(--text-muted)",
                  }}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span
                    style={{ backgroundColor: "var(--text-on-accent)" }}
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ borderColor: "var(--border)" }} className="p-3 shrink-0 border-t">
          <div
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: isOnline ? "var(--border)" : "var(--status-danger-border)",
            }}
            className="p-3.5 rounded-2xl border text-xs transition-colors"
          >
            <div className="flex items-center space-x-2 font-bold mb-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"
                }`}
              />
              <span
                style={{
                  color: isOnline ? "var(--status-success-text)" : "var(--status-danger-text)",
                }}
                className="text-[11px] uppercase tracking-wider font-bold"
              >
                {isOnline ? "API Operational" : "API Offline"}
              </span>
            </div>
            <p style={{ color: "var(--text-muted)" }} className="text-[11px] leading-snug">
              {isOnline
                ? "Connected to .NET Core Backend"
                : "Port 5222 not reachable"}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Tooltip Portal for Collapsed Nav Items and Status ──────── */}
      <TooltipPortal
        text={tooltipState.text}
        anchorRect={tooltipState.rect}
        visible={tooltipState.visible && collapsed && !isAnimating}
      />
    </>
  );
}
