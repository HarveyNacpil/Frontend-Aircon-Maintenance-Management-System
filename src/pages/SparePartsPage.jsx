import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit3, Trash2, AlertTriangle, CheckCircle2, DollarSign, Layers } from 'lucide-react';
import { sparePartsApi, formatCurrency } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { PageHeader } from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';

export function SparePartsPage({ globalSearch }) {
  const { isAdmin, isTechnician } = useAuth();
  const [spareParts, setSpareParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    partName: '',
    category: '',
    quantity: 0,
    unitPrice: 0.0,
    stockStatus: 'In Stock',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await sparePartsApi.getAll();
      setSpareParts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load spare parts:', err);
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
      await sparePartsApi.create({
        ...formData,
        quantity: parseInt(formData.quantity, 10),
        unitPrice: parseFloat(formData.unitPrice),
      });
      setIsAddOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedPart) return;
    try {
      await sparePartsApi.update(selectedPart.partId, {
        ...formData,
        partId: selectedPart.partId,
        quantity: parseInt(formData.quantity, 10),
        unitPrice: parseFloat(formData.unitPrice),
      });
      setIsEditOpen(false);
      setSelectedPart(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this spare part item from inventory?')) return;
    try {
      await sparePartsApi.delete(id);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      partName: '',
      category: 'Refrigerants',
      quantity: 10,
      unitPrice: 25.00,
      stockStatus: 'In Stock',
    });
  };

  const openEditModal = (p) => {
    setSelectedPart(p);
    setFormData({
      partName: p.partName || '',
      category: p.category || '',
      quantity: p.quantity ?? 0,
      unitPrice: p.unitPrice ?? 0,
      stockStatus: p.stockStatus || 'In Stock',
    });
    setIsEditOpen(true);
  };

  const categories = ['All', ...Array.from(new Set(spareParts.map(p => p.category).filter(Boolean)))];

  const activeSearch = searchQuery || globalSearch;
  const filteredParts = spareParts.filter((p) => {
    const name = p.partName.toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const query = activeSearch.toLowerCase();

    const matchesQuery = name.includes(query) || cat.includes(query);
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;

    return matchesQuery && matchesCat;
  });

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Static Header & Category Tabs */}
      <PageHeader
        icon={Package}
        iconColor="text-emerald-500"
        title="Spare Parts Inventory"
        subtitle="Monitor component stock levels, unit pricing, and restock alerts"
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search parts inventory..."
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
              <span className="hidden xs:inline">Add Spare Part</span>
              <span className="xs:hidden">Add</span>
            </PrimaryButton>
          )
        }
        tabs={
          categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === cat
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
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
          {/* Inventory Table Container */}
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
                <th className="px-6 py-4">Part Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Quantity In Stock</th>
                <th className="px-6 py-4">Unit Price ($)</th>
                <th className="px-6 py-4">Stock Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody 
              style={{ borderColor: "var(--border)" }}
              className="divide-y font-medium"
            >
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">Loading inventory data...</td>
                </tr>
              ) : filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-muted)" }} className="px-6 py-8 text-center">No spare parts found.</td>
                </tr>
              ) : (
                filteredParts.map((p) => (
                  <tr 
                    key={p.partId} 
                    style={{ borderColor: "var(--border)" }}
                    className="hover:opacity-90 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div style={{ color: "var(--text-primary)" }} className="font-bold">
                        {p.partName}
                      </div>
                      <span style={{ color: "var(--text-muted)" }} className="block text-[10px] font-normal">Part ID #{p.partId}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span 
                        style={{
                          backgroundColor: "var(--chip-bg)",
                          borderColor: "var(--chip-border)",
                          color: "var(--chip-text)",
                        }}
                        className="px-2.5 py-1 rounded-lg border font-semibold text-[11px]"
                      >
                        {p.category || 'General'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span 
                        style={p.quantity >= 5 ? { color: "var(--text-primary)" } : {}}
                        className={`font-extrabold text-sm ${p.quantity === 0 ? 'text-rose-500' : p.quantity < 5 ? 'text-amber-500' : ''}`}
                      >
                        {p.quantity} units
                      </span>
                    </td>

                    <td style={{ color: "var(--text-primary)" }} className="px-6 py-4 font-bold">
                      {formatCurrency(p.unitPrice ?? p.unit_price)}
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={p.stockStatus}>{p.stockStatus}</Badge>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {(isAdmin || isTechnician) && (
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => openEditModal(p)}
                            style={{ color: "var(--text-muted)" }}
                            className="p-2 rounded-xl hover:text-amber-500 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(p.partId)}
                              style={{ color: "var(--text-muted)" }}
                              className="p-2 rounded-xl hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>

      {/* Modal: Add Spare Part */}
      <Modal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        title="Add New Spare Part"
        subtitle="Register a new component or consumable in the spare parts inventory"
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
              Save Spare Part
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Part Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. 1.5HP AC Run Capacitor 35uF"
            value={formData.partName}
            onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
            <input
              type="text"
              placeholder="Refrigerants, Filters, Electrical"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity In Stock</label>
            <input
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Status</label>
            <select
              value={formData.stockStatus}
              onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Spare Part */}
      <Modal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title="Edit Spare Part"
        subtitle="Update inventory balance, unit cost, or category classification"
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
              Update Part
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Part Name</label>
          <input
            type="text"
            required
            value={formData.partName}
            onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
            <input
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Status</label>
            <select
              value={formData.stockStatus}
              onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
