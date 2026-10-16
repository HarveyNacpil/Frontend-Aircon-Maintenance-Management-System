import React, { useState, useEffect } from 'react';
import { Wind, Plus, Edit3, Trash2, ShieldAlert, Calendar, MapPin, Hash, User } from 'lucide-react';
import { airconApi, customersApi, formatDate } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { PageHeader } from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function AirconUnitsPage({ globalSearch, targetUnitId }) {
  const { isAdmin, isTechnician } = useAuth();
  const { success, error } = useToast();
  const [airconUnits, setAirconUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deleteId, setDeleteId] = useState(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    brand: '',
    model: '',
    horsepower: 1.5,
    serialNumber: '',
    installationDate: '',
    warrantyExpiry: '',
    location: '',
    status: 'Active',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, cRes] = await Promise.all([airconApi.getAll(), customersApi.getAll()]);
      setAirconUnits(Array.isArray(aRes) ? aRes : []);
      setCustomers(Array.isArray(cRes) ? cRes : []);
    } catch (err) {
      console.error('Failed to load aircon units:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await airconApi.create({
        ...formData,
        customerId: parseInt(formData.customerId, 10),
        horsepower: parseFloat(formData.horsepower),
      });
      setIsAddOpen(false);
      resetForm();
      await loadData();
      success('Aircon unit added to fleet registry.');
    } catch (err) {
      error(err.message || 'Failed to create aircon unit.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedUnit) return;
    try {
      await airconApi.update(selectedUnit.unitId, {
        ...formData,
        unitId: selectedUnit.unitId,
        customerId: parseInt(formData.customerId, 10),
        horsepower: parseFloat(formData.horsepower),
      });
      setIsEditOpen(false);
      setSelectedUnit(null);
      await loadData();
      success('Aircon unit updated.');
    } catch (err) {
      error(err.message || 'Failed to update unit.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await airconApi.delete(id);
      await loadData();
      success('Aircon unit removed from fleet.');
    } catch (err) {
      error(err.message || 'Failed to delete unit.');
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: customers[0]?.customerId || '',
      brand: '',
      model: '',
      horsepower: 1.5,
      serialNumber: '',
      installationDate: new Date().toISOString().slice(0, 10),
      warrantyExpiry: '',
      location: '',
      status: 'Active',
    });
  };

  const openEditModal = (u) => {
    setSelectedUnit(u);
    setFormData({
      customerId: u.customerId,
      brand: u.brand || '',
      model: u.model || '',
      horsepower: u.horsepower || 1.5,
      serialNumber: u.serialNumber || '',
      installationDate: u.installationDate ? u.installationDate.slice(0, 10) : '',
      warrantyExpiry: u.warrantyExpiry ? u.warrantyExpiry.slice(0, 10) : '',
      location: u.location || '',
      status: u.status || 'Active',
    });
    setIsEditOpen(true);
  };

  const activeSearch = searchQuery || globalSearch;
  const filteredUnits = airconUnits.filter((u) => {
    const brandModel = `${u.brand} ${u.model}`.toLowerCase();
    const serial = (u.serialNumber || '').toLowerCase();
    const loc = (u.location || '').toLowerCase();
    const query = activeSearch.toLowerCase();

    const matchesQuery = brandModel.includes(query) || serial.includes(query) || loc.includes(query);
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <PageHeader
        icon={Wind}
        iconColor="text-cyan-500"
        title="Aircon Fleet Registry"
        subtitle="Track air conditioner specifications, locations, and warranty expirations"
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search serial, brand, location..."
        actions={
          (isAdmin || isTechnician) && (
            <PrimaryButton
              onClick={() => {
                resetForm();
                setIsAddOpen(true);
              }}
              className="shrink-0 text-xs py-1.5 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Register Unit</span>
              <span className="xs:hidden">Register</span>
            </PrimaryButton>
          )
        }
        tabs={
          ['All', 'Active', 'Under Repair', 'Inactive'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Grid of Aircon Units */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div style={{ color: "var(--text-muted)" }} className="col-span-full py-12 text-center text-xs">Loading aircon fleet units...</div>
        ) : filteredUnits.length === 0 ? (
          <div style={{ color: "var(--text-muted)" }} className="col-span-full py-12 text-center text-xs">No aircon units match your filters.</div>
        ) : (
          filteredUnits.map((u) => {
            const unitCustId = u.customerId || u.customer_id;
            const owner = customers.find(c => (c.customerId || c.customer_id) === unitCustId);
            const ownerName = owner ? `${owner.firstName || owner.first_name || ''} ${owner.lastName || owner.last_name || ''}`.trim() : null;
            const isTarget = targetUnitId && (u.unitId || u.unit_id) === targetUnitId;
            return (
              <div
                key={u.unitId || u.unit_id}
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: isTarget ? "var(--accent)" : "var(--border)",
                  boxShadow: "var(--shadow)",
                }}
                className={`glass-panel p-5 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl ${
                  isTarget ? 'ring-2 ring-[var(--accent)] shadow-xl' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                        {u.brand || 'Air Conditioner'}
                      </span>
                      <h3 style={{ color: "var(--text-primary)" }} className="text-lg font-bold leading-tight">
                        {u.model || 'Model N/A'}
                      </h3>
                    </div>
                    <Badge variant={u.status}>{u.status}</Badge>
                  </div>

                  <div 
                    style={{ borderColor: "var(--border)" }}
                    className="space-y-2 py-3 border-y text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-400" /> Owner Client:
                      </span>
                      <span style={{ color: "var(--text-primary)" }} className="font-semibold">{ownerName || `ID #${unitCustId}`}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-cyan-400" /> Serial No:
                      </span>
                      <span style={{ color: "var(--text-primary)" }} className="font-mono text-[11px] font-semibold">{u.serialNumber || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> Location:
                      </span>
                      <span style={{ color: "var(--text-primary)" }} className="font-medium">{u.location || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Warranty:
                      </span>
                      <span style={{ color: "var(--text-primary)" }} className="font-medium text-[11px]">{u.warrantyExpiry ? formatDate(u.warrantyExpiry) : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 flex items-center justify-between text-xs">
                  <span 
                    style={{
                      backgroundColor: "var(--chip-bg)",
                      borderColor: "var(--chip-border)",
                      color: "var(--chip-text)",
                    }}
                    className="px-2.5 py-1 rounded-lg border font-semibold text-[11px]"
                  >
                    {u.horsepower} HP Capacity
                  </span>

                  {(isAdmin || isTechnician) && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(u)}
                        style={{ color: "var(--text-muted)" }}
                        className="p-2 rounded-xl hover:text-amber-500 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteId(u.unitId)}
                          style={{ color: "var(--text-muted)" }}
                          className="p-2 rounded-xl hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
          </div>
        </div>
      </div>

      {/* Modal: Add Unit */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register Aircon Unit"
        subtitle="Add a new HVAC fleet unit associated with a client profile"
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
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Save Unit
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Customer / Owner *</label>
          <select
            required
            value={formData.customerId}
            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Select Customer...</option>
            {customers.map((c) => {
              const id = c.customerId || c.customer_id;
              const name = `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim() || `Customer #${id}`;
              return (
                <option key={id} value={id}>
                  {name} ({c.email || c.phone || `ID #${id}`})
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Brand Name</label>
            <input
              type="text"
              placeholder="e.g. Daikin, Carrier, LG"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Model Number</label>
            <input
              type="text"
              placeholder="e.g. FTKM35U"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Horsepower (HP)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={formData.horsepower}
              onChange={(e) => setFormData({ ...formData, horsepower: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
            <input
              type="text"
              placeholder="e.g. DK-994821"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Installation Date</label>
            <input
              type="date"
              value={formData.installationDate}
              onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Warranty Expiry</label>
            <input
              type="date"
              value={formData.warrantyExpiry}
              onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Installation Location</label>
          <input
            type="text"
            placeholder="e.g. Master Bedroom, Server Room, Main Office"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Operational Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="Active">Active</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Modal>

      {/* Modal: Edit Unit */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Aircon Unit"
        subtitle={`Editing unit for ${selectedUnit?.brand || ''} ${selectedUnit?.model || ''}`}
        onSubmit={handleUpdate}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Update Unit
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Customer / Owner</label>
          <select
            required
            value={formData.customerId}
            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {customers.map((c) => {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Brand</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Horsepower (HP)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={formData.horsepower}
              onChange={(e) => setFormData({ ...formData, horsepower: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="Active">Active</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Remove Aircon Unit"
        message="Are you sure you want to remove this aircon unit from the fleet registry? This action cannot be undone."
        confirmLabel="Remove Unit"
      />
    </div>
  );
}
