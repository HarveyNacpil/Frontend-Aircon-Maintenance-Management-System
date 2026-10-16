import React, { useState, useEffect } from 'react';
import { CalendarCheck, Calendar, FileText, Plus, Search, Edit3, Trash2, CheckCircle2, Clock, ShieldCheck, User, Wrench } from 'lucide-react';
import { maintenanceApi, customersApi, airconApi, usersApi, formatDate, formatTime } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { PageHeader } from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';

export function MaintenancePage({ openScheduleModalTrigger, globalSearch, targetScheduleId }) {
  const { isAdmin, isTechnician } = useAuth();
  const [tab, setTab] = useState('schedules'); // 'schedules' | 'records'
  const [schedules, setSchedules] = useState([]);
  const [records, setRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [airconUnits, setAirconUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Forms
  const [scheduleForm, setScheduleForm] = useState({
    customerId: '',
    unitId: '',
    technicianId: '',
    scheduleDate: new Date().toISOString().slice(0, 10),
    scheduleTime: '09:00',
    status: 'Scheduled',
    remarks: '',
  });

  const [recordForm, setRecordForm] = useState({
    workPerformed: '',
    partsReplaced: '',
    refrigerantAdded: '',
    technicianNotes: '',
    nextServiceDate: '',
    completedDate: new Date().toISOString().slice(0, 10),
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, rRes, cRes, aRes, uRes] = await Promise.all([
        maintenanceApi.getSchedules(),
        maintenanceApi.getRecords(),
        customersApi.getAll(),
        airconApi.getAll(),
        usersApi.getAll(),
      ]);
      setSchedules(Array.isArray(sRes) ? sRes : []);
      setRecords(Array.isArray(rRes) ? rRes : []);
      setCustomers(Array.isArray(cRes) ? cRes : []);
      setAirconUnits(Array.isArray(aRes) ? aRes : []);
      setUsers(Array.isArray(uRes) ? uRes : []);
    } catch (err) {
      console.error('Failed to load maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openScheduleModalTrigger) {
      setIsScheduleOpen(true);
    }
  }, [openScheduleModalTrigger]);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      await maintenanceApi.createSchedule({
        ...scheduleForm,
        customerId: parseInt(scheduleForm.customerId, 10),
        unitId: parseInt(scheduleForm.unitId, 10),
        technicianId: parseInt(scheduleForm.technicianId, 10),
      });
      setIsScheduleOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteRecord = async (e) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    try {
      // 1. Create Maintenance Record
      await maintenanceApi.createRecord({
        scheduleId: selectedSchedule.scheduleId,
        ...recordForm,
      });

      // 2. Update Schedule Status to Completed
      await maintenanceApi.updateSchedule(selectedSchedule.scheduleId, {
        ...selectedSchedule,
        status: 'Completed',
      });

      setIsRecordOpen(false);
      setSelectedSchedule(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this maintenance schedule? This cannot be undone.')) return;
    try {
      await maintenanceApi.deleteSchedule(scheduleId);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const technicians = users.filter(u => u.role === 'Technician' || u.role === 'Admin');

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Static Header with Appointment/Record Tabs */}
      <PageHeader
        icon={CalendarCheck}
        iconColor="text-sky-500"
        title="Maintenance & Service Logs"
        subtitle="Manage preventive maintenance schedules and detailed technician work reports"
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search schedule, client, aircon unit..."
        actions={
          (isAdmin || isTechnician) && (
            <PrimaryButton
              onClick={() => {
                setScheduleForm({
                  customerId: customers[0]?.customerId || '',
                  unitId: airconUnits[0]?.unitId || '',
                  technicianId: technicians[0]?.userId || '',
                  scheduleDate: new Date().toISOString().slice(0, 10),
                  scheduleTime: '09:00',
                  status: 'Scheduled',
                  remarks: '',
                });
                setIsScheduleOpen(true);
              }}
              className="shrink-0 text-xs py-1.5 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Create Schedule</span>
              <span className="xs:hidden">Schedule</span>
            </PrimaryButton>
          )
        }
        tabs={
          <>
            <button
              type="button"
              onClick={() => setTab('schedules')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-all shrink-0 ${
                tab === 'schedules'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Servicing Appointments ({schedules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('records')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 whitespace-nowrap transition-all shrink-0 ${
                tab === 'records'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Work Completion Records ({records.length})</span>
            </button>
          </>
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Schedules Tab View */}
          {tab === 'schedules' && (() => {
            const activeSearch = searchQuery || globalSearch || (targetScheduleId ? String(targetScheduleId) : '');
            const filteredSchedules = schedules.filter((s) => {
              if (!activeSearch) return true;
              const q = activeSearch.toLowerCase().trim();
              const cust = customers.find((c) => (c.customerId || c.customer_id) === s.customerId);
              const custName = cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.toLowerCase() : '';
              const unit = airconUnits.find((u) => (u.unitId || u.unit_id) === s.unitId);
              const unitStr = unit ? `${unit.brand || ''} ${unit.model || ''} ${unit.serialNumber || ''}`.toLowerCase() : '';
              const remarks = (s.remarks || '').toLowerCase();
              const schedId = String(s.scheduleId || s.schedule_id || '');
              return schedId === q || custName.includes(q) || unitStr.includes(q) || remarks.includes(q);
            });

            return (
              <div 
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
                className="glass-panel rounded-3xl overflow-hidden shadow-xl border"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead 
                      style={{
                        backgroundColor: "var(--card-inner)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                      className="sticky top-0 z-10 backdrop-blur-md uppercase text-[10px] font-bold tracking-wider border-b shadow-sm"
                    >
                  <tr>
                    <th className="px-6 py-4">Aircon Unit</th>
                    <th className="px-6 py-4">Client Customer</th>
                    <th className="px-6 py-4">Assigned Tech</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody 
                  style={{ borderColor: "var(--border)" }}
                  className="divide-y font-medium"
                >
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">Loading schedules...</td>
                    </tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">No servicing schedules logged.</td>
                    </tr>
                  ) : (
                    filteredSchedules.map((s) => {
                      const cust = customers.find(c => (c.customerId || c.customer_id) === s.customerId);
                      const custName = cust ? `${cust.firstName || cust.first_name || ''} ${cust.lastName || cust.last_name || ''}`.trim() : null;
                      const unit = airconUnits.find(u => u.unitId === s.unitId);
                      const tech = users.find(u => u.userId === s.technicianId);
                      const isTarget = targetScheduleId && (s.scheduleId || s.schedule_id) === targetScheduleId;
                      return (
                        <tr 
                          key={s.scheduleId} 
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: isTarget ? "var(--accent-light)" : "transparent",
                          }}
                          className={`hover:opacity-90 transition-colors ${isTarget ? 'font-bold' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div style={{ color: "var(--text-primary)" }} className="font-bold text-sm">
                              {unit ? `${unit.brand} ${unit.model}` : `Unit #${s.unitId}`}
                            </div>
                          <div style={{ color: "var(--text-muted)" }} className="text-[11px]">
                            Serial: {unit?.serialNumber || 'N/A'} | Location: {unit?.location || 'N/A'}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div style={{ color: "var(--text-primary)" }} className="font-semibold">
                            {custName || `Customer #${s.customerId}`}
                          </div>
                          <div style={{ color: "var(--text-muted)" }} className="text-[10px]">{cust?.phone || ''}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div style={{ color: "var(--text-primary)" }} className="flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-cyan-500" />
                            <span>{tech ? tech.fullName : `Tech #${s.technicianId}`}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div style={{ color: "var(--text-primary)" }} className="font-semibold">{formatDate(s.scheduleDate)}</div>
                          <div style={{ color: "var(--text-muted)" }} className="text-[11px] font-medium">{formatTime(s.scheduleTime)}</div>
                        </td>

                        <td className="px-6 py-4">
                          <Badge variant={s.status}>{s.status}</Badge>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center space-x-2">
                            {s.status === 'Scheduled' && (isAdmin || isTechnician) && (
                              <button
                                onClick={() => {
                                  setSelectedSchedule(s);
                                  setRecordForm({
                                    workPerformed: '',
                                    partsReplaced: '',
                                    refrigerantAdded: '',
                                    technicianNotes: '',
                                    nextServiceDate: '',
                                    completedDate: new Date().toISOString().slice(0, 10),
                                  });
                                  setIsRecordOpen(true);
                                }}
                                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-md transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Log Completion</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteSchedule(s.scheduleId)}
                                style={{ color: "var(--text-muted)" }}
                                className="p-2 rounded-xl hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )})()}

      {/* Records Tab View */}
      {tab === 'records' && (
        <div className="space-y-4">
          {records.length === 0 ? (
            <div 
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
              className="glass-panel p-12 text-center text-xs rounded-3xl border"
            >
              No maintenance completion records found. Log a completion on a schedule to record details.
            </div>
          ) : (
            records.map((r) => (
              <div 
                key={r.recordId} 
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow)",
                }}
                className="glass-panel p-6 rounded-3xl border space-y-4"
              >
                <div 
                  style={{ borderColor: "var(--border)" }}
                  className="flex items-center justify-between pb-3 border-b"
                >
                  <div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                      Work Record #{r.recordId} (Schedule #{r.scheduleId})
                    </span>
                    <h3 style={{ color: "var(--text-primary)" }} className="text-sm font-bold">
                      Completed Date: {formatDate(r.completedDate)}
                    </h3>
                  </div>
                  <Badge variant="Completed">Completed</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-3 rounded-2xl border"
                  >
                    <span style={{ color: "var(--text-muted)" }} className="font-semibold block mb-1">Work Performed:</span>
                    <p style={{ color: "var(--text-primary)" }} className="font-medium">{r.workPerformed || 'N/A'}</p>
                  </div>

                  <div 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-3 rounded-2xl border"
                  >
                    <span style={{ color: "var(--text-muted)" }} className="font-semibold block mb-1">Parts Replaced:</span>
                    <p style={{ color: "var(--text-primary)" }} className="font-medium">{r.partsReplaced || 'None'}</p>
                  </div>

                  <div 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-3 rounded-2xl border"
                  >
                    <span style={{ color: "var(--text-muted)" }} className="font-semibold block mb-1">Refrigerant Added:</span>
                    <p style={{ color: "var(--text-primary)" }} className="font-medium">{r.refrigerantAdded || 'None'}</p>
                  </div>

                  <div 
                    style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                    className="p-3 rounded-2xl border"
                  >
                    <span style={{ color: "var(--text-muted)" }} className="font-semibold block mb-1">Next Service Date:</span>
                    <p className="text-sky-500 font-bold">{formatDate(r.nextServiceDate)}</p>
                  </div>
                </div>

                {r.technicianNotes && (
                  <div 
                    style={{
                      backgroundColor: "var(--status-info-bg)",
                      borderColor: "var(--status-info-border)",
                      color: "var(--status-info-text)",
                    }}
                    className="p-3 rounded-2xl border text-xs"
                  >
                    <span className="font-semibold block mb-0.5">Technician Notes:</span>
                    <p className="italic">{r.technicianNotes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
        </div>
      </div>

      {/* Modal: Create Schedule */}
      <Modal 
        isOpen={isScheduleOpen} 
        onClose={() => setIsScheduleOpen(false)} 
        title="Book Maintenance Appointment"
        subtitle="Schedule a preventive or corrective servicing appointment"
        onSubmit={handleCreateSchedule}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsScheduleOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Save Schedule
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Client Customer *</label>
            <select
              required
              value={scheduleForm.customerId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, customerId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select Customer...</option>
              {customers.map(c => {
                const id = c.customerId || c.customer_id;
                const name = `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim() || `Customer #${id}`;
                return (
                  <option key={id} value={id}>
                    {name} (ID #{id})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Aircon Unit *</label>
            <select
              required
              value={scheduleForm.unitId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, unitId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select Aircon Unit...</option>
              {airconUnits
                .filter(u => !scheduleForm.customerId || u.customerId === parseInt(scheduleForm.customerId, 10))
                .map(u => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.brand} {u.model} (SN: {u.serialNumber}) - {u.location}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Technician *</label>
          <select
            required
            value={scheduleForm.technicianId}
            onChange={(e) => setScheduleForm({ ...scheduleForm, technicianId: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Select Technician...</option>
            {technicians.map(t => (
              <option key={t.userId} value={t.userId}>
                {t.fullName} ({t.role})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
            <input
              type="date"
              required
              value={scheduleForm.scheduleDate}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleDate: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Time *</label>
            <input
              type="time"
              required
              value={scheduleForm.scheduleTime}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Service Remarks</label>
          <textarea
            rows={2}
            value={scheduleForm.remarks}
            onChange={(e) => setScheduleForm({ ...scheduleForm, remarks: e.target.value })}
            placeholder="e.g. Chemical cleaning & pressure check"
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </Modal>

      {/* Modal: Log Completion Record */}
      <Modal 
        isOpen={isRecordOpen} 
        onClose={() => setIsRecordOpen(false)} 
        title="Log Servicing Completion Report"
        subtitle="Document technical findings, parts used, and next servicing recommendation"
        onSubmit={handleCompleteRecord}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsRecordOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Submit Work Record
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Work Performed Description *</label>
          <textarea
            rows={3}
            required
            value={recordForm.workPerformed}
            onChange={(e) => setRecordForm({ ...recordForm, workPerformed: e.target.value })}
            placeholder="Detail all servicing steps performed (e.g. Coil washing, filter replacement)..."
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Parts Replaced</label>
            <input
              type="text"
              placeholder="e.g. Air Filter PN-FLT01"
              value={recordForm.partsReplaced}
              onChange={(e) => setRecordForm({ ...recordForm, partsReplaced: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Refrigerant Added</label>
            <input
              type="text"
              placeholder="e.g. 0.45 kg R32"
              value={recordForm.refrigerantAdded}
              onChange={(e) => setRecordForm({ ...recordForm, refrigerantAdded: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Technician Notes</label>
          <textarea
            rows={2}
            value={recordForm.technicianNotes}
            onChange={(e) => setRecordForm({ ...recordForm, technicianNotes: e.target.value })}
            placeholder="Additional observations, pressure readings, or client recommendations..."
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Next Service Date</label>
            <input
              type="date"
              value={recordForm.nextServiceDate}
              onChange={(e) => setRecordForm({ ...recordForm, nextServiceDate: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Completion Date</label>
            <input
              type="date"
              value={recordForm.completedDate}
              onChange={(e) => setRecordForm({ ...recordForm, completedDate: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
