import React, { useState, useEffect } from "react";
import {
  Wind, CalendarCheck, Wrench, Package, Clock, PlusCircle,
  AlertTriangle, CheckCircle2, ArrowUpRight, Sparkles,
  Store, Radio, Users, Star
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { StatCard } from "../components/common/StatCard";
import { StatCardSkeleton } from "../components/common/Skeleton";
import { Badge } from "../components/common/Badge";
import { PrimaryButton } from "../components/common/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { airconApi, maintenanceApi, serviceRequestsApi, sparePartsApi, customersApi, storesApi, formatDate, formatTime } from "../services/api";
import { getStoreLiveStatus } from "./StoresPage";

const CHART_COLORS = {
  Open:        "#a78bfa",
  Assigned:    "#38bdf8",
  "In Progress":"#f59e0b",
  Completed:   "#10b981",
  Cancelled:   "#f43f5e",
};
const BRAND_COLORS = ["#22d3ee","#38bdf8","#818cf8","#f59e0b","#10b981","#f43f5e","#a78bfa","#fb7185"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }

function EmptyChart({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 py-8 opacity-50">
      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div 
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
      className="border rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md"
    >
      {label && <p style={{ color: "var(--text-muted)" }} className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export const DashboardPage = React.memo(function DashboardPage({ setActiveTab, onOpenModal, theme: propTheme }) {
  const currentTheme = propTheme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : 'dark') || 'dark';
  const isLight = currentTheme === 'light';
  const gridColor = isLight ? '#D3E4FA' : '#1e293b';
  const axisTextColor = isLight ? '#4A5A8C' : '#94a3b8';
  const { isTechnician, isAdmin } = useAuth();
  const [airconUnits, setAirconUnits] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [requests, setRequests] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [a, s, r, p, c, st] = await Promise.all([
          airconApi.getAll(),
          maintenanceApi.getSchedules(),
          serviceRequestsApi.getAll(),
          sparePartsApi.getAll(),
          customersApi.getAll(),
          storesApi.getAll().catch(() => []),
        ]);
        setAirconUnits(Array.isArray(a) ? a : []);
        setSchedules(Array.isArray(s) ? s : []);
        setRequests(Array.isArray(r) ? r : []);
        setSpareParts(Array.isArray(p) ? p : []);
        setCustomers(Array.isArray(c) ? c : []);
        setStores(Array.isArray(st) ? st : []);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // ── Main branch & live operational status ──────────────────────────────────
  const mainBranch = stores.find((s) => s.isMainBranch) || stores[0] || null;
  const mainBranchLiveStatus = mainBranch ? getStoreLiveStatus(mainBranch.openingHours) : null;

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalUnits = airconUnits.length;
  const activeUnitsCount = airconUnits.filter(u => u.status === "Active").length;
  const pendingSchedulesCount = schedules.filter(s => s.status === "Scheduled").length;
  const completedSchedulesCount = schedules.filter(s => s.status === "Completed").length;
  const openRequestsCount = requests.filter(r => r.status === "Open" || r.status === "In Progress").length;
  const highPriorityCount = requests.filter(r => r.priority === "High").length;
  const lowStockPartsCount = spareParts.filter(p => p.stockStatus === "Low Stock" || p.stockStatus === "Out of Stock").length;
  const outOfStockCount = spareParts.filter(p => p.stockStatus === "Out of Stock").length;

  // ── Chart: Requests by status (donut) ───────────────────────────────────────
  const statusGroups = requests.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const requestPieData = Object.entries(statusGroups).map(([name, value]) => ({ name, value }));

  // ── Chart: Schedules per month (bar) ────────────────────────────────────────
  const schedulesByMonth = schedules.reduce((acc, s) => {
    if (!s.scheduleDate) return acc;
    const month = new Date(s.scheduleDate).getMonth();
    if (!isNaN(month)) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const appointmentBarData = MONTH_NAMES.map((name, i) => ({ name, Appointments: schedulesByMonth[i] || 0 })).filter(d => d.Appointments > 0);

  // ── Chart: Units by brand (bar) ─────────────────────────────────────────────
  const brandGroups = airconUnits.reduce((acc, u) => { if (u.brand) acc[u.brand] = (acc[u.brand] || 0) + 1; return acc; }, {});
  const brandBarData = Object.entries(brandGroups).map(([name, Units]) => ({ name, Units })).sort((a,b) => b.Units - a.Units);

  return (
    <div 
      style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      className="flex-1 min-h-0 overflow-y-auto w-full"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-700 text-white shadow-2xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-md mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span>Real-Time Maintenance Monitoring</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">HVAC Fleet Operations Control</h1>
            <p className="text-sky-100 text-sm mt-1 max-w-xl">
              Track aircon units, schedule maintenance routines, dispatch service requests, and monitor spare parts inventory seamlessly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PrimaryButton onClick={() => onOpenModal("createRequest")}>
              <PlusCircle className="w-4 h-4" /><span>Log Service Request</span>
            </PrimaryButton>
            <button onClick={() => onOpenModal("createSchedule")} className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/30 transition-colors flex items-center space-x-1.5 backdrop-blur-sm">
              <CalendarCheck className="w-4 h-4" /><span>Schedule Servicing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Branch Status Card */}
      {mainBranch && mainBranchLiveStatus && (
        <div 
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow)",
          }}
          className="glass-panel p-4 sm:p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-sky-500/25 shrink-0">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  style={{
                    backgroundColor: "var(--chip-bg)",
                    color: "var(--accent-text)",
                  }}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[var(--border)]"
                >
                  {mainBranch.code}
                </span>
                <span 
                  style={{ color: "var(--text-primary)" }}
                  className="text-sm sm:text-base font-bold"
                >
                  {mainBranch.name}
                </span>
                <span 
                  style={{
                    backgroundColor: "var(--status-warning-bg)",
                    color: "var(--status-warning-text)",
                    borderColor: "var(--status-warning-border)",
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border"
                >
                  <Star className="w-3 h-3 fill-current" />
                  MAIN HQ
                </span>
              </div>
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                {[mainBranch.street, mainBranch.barangay, mainBranch.cityMunicipality].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Hours Badge */}
            <div 
              style={{
                backgroundColor: "var(--chip-bg)",
                borderColor: "var(--chip-border)",
                color: "var(--chip-text)",
              }}
              className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
            >
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              <div>
                <div style={{ color: "var(--text-muted)" }} className="text-[9px] font-semibold uppercase tracking-wider">Today's Hours</div>
                <div style={{ color: "var(--text-primary)" }} className="font-bold flex items-center gap-1.5">
                  <span>{mainBranchLiveStatus.text}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      mainBranchLiveStatus.badgeColor === 'green' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Technicians Stationed */}
            <div 
              style={{
                backgroundColor: "var(--chip-bg)",
                borderColor: "var(--chip-border)",
                color: "var(--chip-text)",
              }}
              className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
            >
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <div>
                <div style={{ color: "var(--text-muted)" }} className="text-[9px] font-semibold uppercase tracking-wider">Technicians</div>
                <div style={{ color: "var(--text-primary)" }} className="font-bold">
                  {mainBranch.assignedTechnicianCount} Stationed
                </div>
              </div>
            </div>

            {/* Coverage Radius */}
            <div 
              style={{
                backgroundColor: "var(--chip-bg)",
                borderColor: "var(--chip-border)",
                color: "var(--chip-text)",
              }}
              className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
            >
              <Radio className="w-3.5 h-3.5 text-sky-500" />
              <div>
                <div style={{ color: "var(--text-muted)" }} className="text-[9px] font-semibold uppercase tracking-wider">Coverage</div>
                <div style={{ color: "var(--text-primary)" }} className="font-bold">
                  {mainBranch.serviceRadiusKm} km radius
                </div>
              </div>
            </div>

            {/* Manage Stores Link */}
            <button
              onClick={() => setActiveTab && setActiveTab('stores')}
              style={{
                backgroundColor: "var(--chip-bg)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl border hover:opacity-80 transition-colors flex items-center gap-1 shrink-0"
              title="View all physical workshop branches"
            >
              <span>Branches</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Aircon Fleet"
              value={totalUnits}
              icon={Wind}
              color="sky"
              subtitle={plural(activeUnitsCount, "Active Unit") + " Operational"}
              trendLabel={activeUnitsCount === totalUnits ? "All Active" : `${totalUnits - activeUnitsCount} Offline`}
              trendVariant={activeUnitsCount === totalUnits ? "success" : "warning"}
            />
            <StatCard
              title="Upcoming Schedules"
              value={pendingSchedulesCount}
              icon={CalendarCheck}
              color="amber"
              subtitle="Pending Technician Visits"
              trendLabel={plural(completedSchedulesCount, "Completed")}
              trendVariant="success"
            />
            <StatCard
              title="Active Requests"
              value={openRequestsCount}
              icon={Wrench}
              color={openRequestsCount === 0 ? "emerald" : highPriorityCount > 0 ? "rose" : "amber"}
              subtitle={highPriorityCount > 0 ? plural(highPriorityCount, "High Priority") : "No urgent issues"}
              trendLabel={openRequestsCount === 0 ? "Queue Clear" : "Requires Dispatch"}
              trendVariant={openRequestsCount === 0 ? "success" : highPriorityCount > 0 ? "danger" : "warning"}
            />
            <StatCard
              title="Stock Alerts"
              value={lowStockPartsCount}
              icon={Package}
              color={lowStockPartsCount === 0 ? "emerald" : outOfStockCount > 0 ? "rose" : "amber"}
              subtitle={lowStockPartsCount === 0 ? "All parts well stocked" : plural(outOfStockCount, "Out of Stock Item")}
              trendLabel={lowStockPartsCount === 0 ? "Inventory Healthy" : "Action Needed"}
              trendVariant={lowStockPartsCount === 0 ? "success" : outOfStockCount > 0 ? "danger" : "warning"}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut: Requests by Status */}
        <div 
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
          className="glass-panel p-6 rounded-3xl border"
        >
          <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-1">Requests by Status</h3>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Distribution across workflow stages</p>
          <div className="h-52">
            {requestPieData.length === 0 ? (
              <EmptyChart label="No service requests yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                <PieChart key={currentTheme}>
                  <Pie data={requestPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {requestPieData.map((entry, index) => (
                      <Cell key={index} fill={CHART_COLORS[entry.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {requestPieData.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
              {requestPieData.map((d, i) => (
                <div key={i} style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[d.name] || "#94a3b8" }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bar: Appointments per Month */}
        <div 
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
          className="glass-panel p-6 rounded-3xl border"
        >
          <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-1">Appointments per Month</h3>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Scheduled servicing visits over time</p>
          <div className="h-52">
            {appointmentBarData.length === 0 ? (
              <EmptyChart label="No appointments logged yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                <BarChart key={currentTheme} data={appointmentBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.6} />
                  <XAxis dataKey="name" tick={{ fill: axisTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: axisTextColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Appointments" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar: Units by Brand */}
        <div 
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
          className="glass-panel p-6 rounded-3xl border"
        >
          <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold mb-1">Fleet by Brand</h3>
          <p style={{ color: "var(--text-muted)" }} className="text-xs mb-4">Aircon units distribution per brand</p>
          <div className="h-52">
            {brandBarData.length === 0 ? (
              <EmptyChart label="No units in fleet yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                <BarChart key={currentTheme} data={brandBarData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.6} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axisTextColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axisTextColor, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Units" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {brandBarData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Schedules & Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Schedules */}
          <div 
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
            className="glass-panel p-6 rounded-3xl border"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "var(--text-primary)" }} className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-500" />Upcoming Servicing Schedules
                </h3>
                <p style={{ color: "var(--text-muted)" }} className="text-xs">Scheduled maintenance appointments across all clients</p>
              </div>
              <button onClick={() => setActiveTab("maintenance")} className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1 transition-colors">
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ backgroundColor: "var(--card-inner)" }} className="p-4 rounded-2xl animate-pulse h-16" />
                ))
              ) : schedules.length === 0 ? (
                <div style={{ color: "var(--text-muted)" }} className="text-center py-8 text-xs">No scheduled servicing records found.</div>
              ) : (
                schedules.slice(0, 4).map((s) => {
                  const cust = customers.find(c => (c.customerId || c.customer_id) === s.customerId);
                  const custName = cust ? `${cust.firstName || cust.first_name || ""} ${cust.lastName || cust.last_name || ""}`.trim() : null;
                  const unit = airconUnits.find(u => u.unitId === s.unitId);
                  return (
                    <div 
                      key={s.scheduleId} 
                      style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                      className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:opacity-90"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 font-bold flex items-center justify-center shrink-0">
                          <Wind className="w-5 h-5" />
                        </div>
                        <div>
                          <p style={{ color: "var(--text-primary)" }} className="font-semibold text-sm">{unit ? `${unit.brand} ${unit.model}` : `Unit #${s.unitId}`}</p>
                          <p style={{ color: "var(--text-muted)" }} className="text-xs">Client: {custName || `Customer #${s.customerId}`}</p>
                          {s.remarks && <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-1 italic">"{s.remarks}"</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                        <div>
                          <div style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">{formatDate(s.scheduleDate)} {s.scheduleTime ? `at ${formatTime(s.scheduleTime)}` : ""}</div>
                          <span style={{ color: "var(--text-muted)" }} className="text-[10px]">Technician ID #{s.technicianId}</span>
                        </div>
                        <Badge variant={s.status}>{s.status}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Requests */}
          <div 
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
            className="glass-panel p-6 rounded-3xl border"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "var(--text-primary)" }} className="text-base font-bold flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-500" />Service Requests Queue
                </h3>
                <p style={{ color: "var(--text-muted)" }} className="text-xs">Customer issue reports awaiting resolution or dispatch</p>
              </div>
              <button onClick={() => setActiveTab("requests")} className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1 transition-colors">
                Manage <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ backgroundColor: "var(--card-inner)" }} className="p-4 rounded-2xl animate-pulse h-16" />)
              ) : requests.length === 0 ? (
                <div style={{ color: "var(--text-muted)" }} className="text-center py-8 text-xs">No open service requests.</div>
              ) : (
                requests.slice(0, 3).map((r) => (
                  <div 
                    key={r.requestId} 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:opacity-90 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text-primary)" }} className="text-xs font-bold">Request #{r.requestId}</span>
                        <Badge variant={r.priority}>{r.priority} Priority</Badge>
                      </div>
                      <p style={{ color: "var(--text-primary)" }} className="text-xs font-medium">{r.issueDescription}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px]">Date Logged: {formatDate(r.requestDate)}</p>
                    </div>
                    <div className="flex items-center gap-2"><Badge variant={r.status}>{r.status}</Badge></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Inventory Alert */}
          <div 
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
            className="glass-panel p-6 rounded-3xl border"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: "var(--text-primary)" }} className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />Inventory Stock Alert
              </h3>
              <button onClick={() => setActiveTab("inventory")} className="text-xs text-sky-500 hover:text-sky-600 font-semibold transition-colors">Inventory</button>
            </div>
            <div className="space-y-3">
              {spareParts.filter(p => p.stockStatus !== "In Stock").length === 0 ? (
                <div 
                  style={{
                    backgroundColor: "var(--status-success-bg)",
                    borderColor: "var(--status-success-border)",
                    color: "var(--status-success-text)",
                  }}
                  className="p-4 rounded-2xl border text-center text-xs font-medium"
                >
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                  All spare parts are currently well stocked!
                </div>
              ) : (
                spareParts.filter(p => p.stockStatus !== "In Stock").map((p) => (
                  <div 
                    key={p.partId} 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-3.5 rounded-2xl border flex items-center justify-between"
                  >
                    <div>
                      <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold">{p.partName}</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px]">Qty remaining: <strong className="text-rose-500">{p.quantity}</strong></p>
                    </div>
                    <Badge variant={p.stockStatus}>{p.stockStatus}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Fleet Status Breakdown */}
          <div 
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
            className="glass-panel p-6 rounded-3xl border"
          >
            <h3 style={{ color: "var(--text-primary)" }} className="text-base font-bold mb-4">Fleet Status Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: "Operational Active", status: "Active", color: "bg-emerald-500" },
                { label: "Under Repair", status: "Under Repair", color: "bg-amber-500" },
                { label: "Inactive / Standby", status: "Inactive", color: "bg-slate-400" },
              ].map(({ label, status, color }) => {
                const count = airconUnits.filter(u => u.status === status).length;
                const pct = totalUnits ? (count / totalUnits) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}
                      </span>
                      <span style={{ color: "var(--text-primary)" }} className="font-bold">{count}</span>
                    </div>
                    <div 
                      style={{ backgroundColor: "var(--border)" }}
                      className="w-full h-2 rounded-full overflow-hidden"
                    >
                      <div className={`${color} h-full rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
});
