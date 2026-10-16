import React, { useState, useEffect } from 'react';
import { Wrench, Plus, UserCheck, AlertCircle, LayoutGrid, List, CheckCircle2, Clock, ShieldAlert, Trash2, Store } from 'lucide-react';
import { serviceRequestsApi, customersApi, airconApi, usersApi, storesApi, formatDate } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { PageHeader } from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';

export function ServiceRequestsPage({ openRequestModalTrigger, globalSearch, targetRequestId }) {
  const { isAdmin, isTechnician } = useAuth();
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [airconUnits, setAirconUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [techStoreFilter, setTechStoreFilter] = useState('ALL');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [assignModalReq, setAssignModalReq] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    unitId: '',
    issueDescription: '',
    priority: 'Medium',
    storeId: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [rRes, cRes, aRes, uRes, sRes] = await Promise.all([
        serviceRequestsApi.getAll(),
        customersApi.getAll(),
        airconApi.getAll(),
        usersApi.getAll(),
        storesApi.getAll().catch(() => []),
      ]);
      setRequests(Array.isArray(rRes) ? rRes : []);
      setCustomers(Array.isArray(cRes) ? cRes : []);
      setAirconUnits(Array.isArray(aRes) ? aRes : []);
      setUsers(Array.isArray(uRes) ? uRes : []);
      setStores(Array.isArray(sRes) ? sRes : []);
    } catch (err) {
      console.error('Failed to load service requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openRequestModalTrigger) {
      setIsAddOpen(true);
    }
  }, [openRequestModalTrigger]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await serviceRequestsApi.create({
        ...formData,
        customerId: parseInt(formData.customerId, 10),
        unitId: parseInt(formData.unitId, 10),
      });
      setIsAddOpen(false);
      setFormData({ customerId: '', unitId: '', issueDescription: '', priority: 'Medium' });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await serviceRequestsApi.updateStatus(requestId, newStatus);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignTechnician = async (e) => {
    e.preventDefault();
    if (!assignModalReq || !selectedTechId) return;
    try {
      await serviceRequestsApi.assignTechnician(assignModalReq.requestId, parseInt(selectedTechId, 10));
      setAssignModalReq(null);
      setSelectedTechId('');
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Delete this service request? This action cannot be undone.')) return;
    try {
      await serviceRequestsApi.delete(requestId);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const KANBAN_STAGES = ['Open', 'Assigned', 'In Progress', 'Completed'];
  const technicians = users.filter(u => u.role === 'Technician' || u.role === 'Admin');

  // Filter requests by store and search query
  const activeSearch = searchQuery || globalSearch || (targetRequestId ? `req-${targetRequestId}` : '');
  const filteredRequests = requests.filter((r) => {
    if (storeFilter !== 'ALL') {
      const cust = customers.find((c) => (c.customerId || c.customer_id) === r.customerId);
      const rStore = r.storeId ?? r.store_id ?? cust?.storeId ?? cust?.store_id;
      if (String(rStore) !== String(storeFilter)) return false;
    }
    if (activeSearch) {
      const q = activeSearch.toLowerCase().trim();
      const cust = customers.find((c) => (c.customerId || c.customer_id) === r.customerId);
      const custName = cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.toLowerCase() : '';
      const reqId = String(r.requestId || r.request_id || '');
      const reqTag = `req-${reqId}`.toLowerCase();
      const issue = (r.issueDescription || r.issue_description || '').toLowerCase();
      const priority = (r.priority || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      return (
        reqId === q ||
        reqTag.includes(q) ||
        `#${reqTag}`.includes(q) ||
        issue.includes(q) ||
        custName.includes(q) ||
        priority.includes(q) ||
        status.includes(q)
      );
    }
    return true;
  });

  // Filter technicians for assignment by store
  const filteredTechnicians = technicians.filter((t) => {
    if (techStoreFilter === 'ALL') return true;
    return String(t.storeId || t.store_id) === String(techStoreFilter);
  });

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Static Header with View Mode Tabs & Store Filter */}
      <PageHeader
        icon={Wrench}
        iconColor="text-amber-500"
        title="Service Requests Workflow"
        subtitle="Track reported breakdown issues, assign technicians, and monitor completion progress"
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search request #, issue, client..."
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Store Branch Filter */}
            <div 
              style={{
                backgroundColor: "var(--card-inner)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              className="flex items-center gap-1.5 p-1.5 rounded-xl border text-xs"
            >
              <Store className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                style={{ color: "var(--text-primary)" }}
                className="bg-transparent text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Branches</option>
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <PrimaryButton
              onClick={() => {
                setFormData({
                  customerId: customers[0]?.customerId || '',
                  unitId: airconUnits[0]?.unitId || '',
                  issueDescription: '',
                  priority: 'Medium',
                  storeId: '',
                });
                setIsAddOpen(true);
              }}
              className="shrink-0 text-xs py-1.5 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">New Service Request</span>
              <span className="xs:hidden">New Request</span>
            </PrimaryButton>
          </div>
        }
        tabs={
          <div 
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: "var(--border)",
            }}
            className="flex p-1 rounded-xl border"
          >
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={
                viewMode === 'kanban'
                  ? { backgroundColor: "var(--card-bg)", color: "var(--accent)", boxShadow: "var(--shadow)" }
                  : { color: "var(--text-muted)" }
              }
              className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={
                viewMode === 'table'
                  ? { backgroundColor: "var(--card-bg)", color: "var(--accent)", boxShadow: "var(--shadow)" }
                  : { color: "var(--text-muted)" }
              }
              className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Kanban Board View */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {KANBAN_STAGES.map((stage) => {
                const stageRequests = filteredRequests.filter(r => r.status === stage);
                return (
                  <div 
                    key={stage} 
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--border)",
                    }}
                    className="glass-panel p-4 rounded-3xl border flex flex-col min-h-[520px]"
                  >
                    {/* Sticky Kanban Column Header inside scroll area */}
                    <div 
                      style={{
                        backgroundColor: "var(--card-inner)",
                        borderColor: "var(--border)",
                      }}
                      className="sticky top-0 z-10 -mt-4 -mx-4 px-4 pt-4 pb-3 rounded-t-3xl backdrop-blur-md border-b flex items-center justify-between mb-3 shadow-sm"
                    >
                      <span 
                        style={{ color: "var(--text-primary)" }}
                        className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        {stage}
                      </span>
                      <span 
                        style={{
                          backgroundColor: "var(--chip-bg)",
                          borderColor: "var(--chip-border)",
                          color: "var(--chip-text)",
                        }}
                        className="px-2 py-0.5 rounded-full border text-xs font-bold"
                      >
                        {stageRequests.length}
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 gap-3 mt-3">
                      {stageRequests.length === 0 ? (
                        <div 
                          style={{ borderColor: "var(--border)" }}
                          className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center py-10 px-4 gap-2 opacity-60"
                        >
                          <svg className="w-7 h-7" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold">No requests</p>
                          <p style={{ color: "var(--text-muted)" }} className="text-[10px]">Nothing in this stage yet</p>
                        </div>
                      ) : (
                        stageRequests.map((r) => {
                          const cust = customers.find(c => (c.customerId || c.customer_id) === r.customerId);
                          const custName = cust ? `${cust.firstName || cust.first_name || ''} ${cust.lastName || cust.last_name || ''}`.trim() : null;
                          const unit = airconUnits.find(u => u.unitId === r.unitId);
                          const tech = users.find(u => u.userId === r.assignedTechnician);

                          const isTarget = targetRequestId && (r.requestId || r.request_id) === targetRequestId;
                          return (
                            <div
                              key={r.requestId}
                              style={{
                                backgroundColor: "var(--card-inner)",
                                borderColor: isTarget ? "var(--accent)" : "var(--border)",
                                boxShadow: "var(--shadow)",
                              }}
                              className={`p-4 rounded-2xl border shadow-sm space-y-2 hover:shadow-md transition-all ${
                                isTarget ? 'ring-2 ring-[var(--accent)] shadow-md' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span style={{ color: "var(--text-muted)" }} className="text-[11px] font-bold">#REQ-{r.requestId}</span>
                                <Badge variant={r.priority}>{r.priority}</Badge>
                              </div>

                              <p style={{ color: "var(--text-primary)" }} className="text-xs font-semibold leading-snug">
                                {r.issueDescription}
                              </p>

                              <div 
                                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                                className="pt-2 border-t text-[11px] space-y-1"
                              >
                                <div>Client: <strong style={{ color: "var(--text-primary)" }}>{custName || `Customer #${r.customerId}`}</strong></div>
                                <div>Unit: <strong style={{ color: "var(--text-primary)" }}>{unit ? `${unit.brand} ${unit.model}` : `Unit #${r.unitId}`}</strong></div>
                                <div>Assigned: <strong className="text-sky-500">{tech ? tech.fullName : 'Unassigned'}</strong></div>
                              </div>

                              {/* Status & Actions */}
                              <div className="pt-2 flex flex-col gap-1.5">
                                <select
                                  value={r.status}
                                  onChange={(e) => handleStatusChange(r.requestId, e.target.value)}
                                  style={{
                                    backgroundColor: "var(--input-bg)",
                                    borderColor: "var(--input-border)",
                                    color: "var(--input-text)",
                                  }}
                                  className="w-full px-2 py-1 border rounded-lg text-[11px] font-medium focus:outline-none"
                                >
                                  {KANBAN_STAGES.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>

                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setAssignModalReq(r);
                                      setSelectedTechId(r.assignedTechnician || technicians[0]?.userId || '');
                                    }}
                                    style={{
                                      backgroundColor: "var(--chip-bg)",
                                      borderColor: "var(--chip-border)",
                                      color: "var(--accent)",
                                    }}
                                    className="w-full py-1.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center space-x-1 hover:opacity-80 transition-colors"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>Assign Technician</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
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
                      <th className="px-6 py-4">Request ID</th>
                      <th className="px-6 py-4">Customer & Unit</th>
                      <th className="px-6 py-4">Issue Description</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Assigned Tech</th>
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
                        <td colSpan={7} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">Loading service requests...</td>
                      </tr>
                    ) : filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">No service requests match the filter criteria.</td>
                      </tr>
                    ) : (
                      filteredRequests.map((r) => {
                        const cust = customers.find(c => (c.customerId || c.customer_id) === r.customerId);
                        const custName = cust ? `${cust.firstName || cust.first_name || ''} ${cust.lastName || cust.last_name || ''}`.trim() : null;
                        const unit = airconUnits.find(u => u.unitId === r.unitId);
                        const tech = users.find(u => u.userId === r.assignedTechnician);

                        return (
                          <tr 
                            key={r.requestId} 
                            style={{ borderColor: "var(--border)" }}
                            className="hover:opacity-90 transition-colors"
                          >
                            <td style={{ color: "var(--text-primary)" }} className="px-6 py-4 font-bold">
                              #REQ-{r.requestId}
                            </td>

                            <td className="px-6 py-4">
                              <div style={{ color: "var(--text-primary)" }} className="font-semibold">
                                {custName || `Customer #${r.customerId}`}
                              </div>
                              <div style={{ color: "var(--text-muted)" }} className="text-[11px]">
                                {unit ? `${unit.brand} ${unit.model}` : `Unit #${r.unitId}`}
                              </div>
                            </td>

                            <td className="px-6 py-4 max-w-xs">
                              <p style={{ color: "var(--text-primary)" }} className="line-clamp-2">{r.issueDescription}</p>
                              <span style={{ color: "var(--text-muted)" }} className="text-[10px]">Logged: {formatDate(r.requestDate)}</span>
                            </td>

                        <td className="px-6 py-4">
                          <Badge variant={r.priority}>{r.priority}</Badge>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {tech ? tech.fullName : 'Unassigned'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <Badge variant={r.status}>{r.status}</Badge>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center space-x-2">
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setAssignModalReq(r);
                                  setSelectedTechId(r.assignedTechnician || technicians[0]?.userId || '');
                                }}
                                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(r.requestId)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
      )}
        </div>
      </div>

      {/* Modal: Create Service Request */}
      <Modal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        title="Submit New Service Request"
        subtitle="Create a new maintenance or emergency repair ticket"
        onSubmit={handleCreate}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Submit Service Request
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Customer / Owner *</label>
            <select
              required
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
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
              value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select Aircon Unit...</option>
              {airconUnits
                .filter(u => !formData.customerId || u.customerId === parseInt(formData.customerId, 10))
                .map(u => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.brand} {u.model} ({u.location})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Priority Severity</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="High">High (Urgent Water Leak / Server Cooling)</option>
            <option value="Medium">Medium (Standard Maintenance Issue)</option>
            <option value="Low">Low (Routine Checkup)</option>
          </select>
        </div>

        {stores.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Service Branch Hub (Optional)
            </label>
            <select
              value={formData.storeId || ''}
              onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Auto-assign / Nearest Branch</option>
              {stores.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.name} ({s.code}) {s.isMainBranch ? '— Main Branch' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Issue Description *</label>
          <textarea
            rows={3}
            required
            value={formData.issueDescription}
            onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
            placeholder="Describe the issue reported by the customer..."
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </Modal>

      {/* Modal: Assign Technician */}
      {assignModalReq && (
        <Modal 
          isOpen={!!assignModalReq} 
          onClose={() => setAssignModalReq(null)} 
          title={`Assign Technician to Request #${assignModalReq.requestId}`}
          subtitle={`Assign a qualified technician to take ownership of this ticket`}
          onSubmit={handleAssignTechnician}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAssignModalReq(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors"
              >
                Assign & Set Active
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {stores.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Filter Technicians by Branch Hub
                </label>
                <select
                  value={techStoreFilter}
                  onChange={(e) => setTechStoreFilter(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ALL">All Branches</option>
                  {stores.map((s) => (
                    <option key={s.storeId} value={s.storeId}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Select Technician</label>
              <select
                required
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select Technician...</option>
                {filteredTechnicians.map(t => (
                  <option key={t.userId} value={t.userId}>
                    {t.fullName} ({t.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
