import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Wind,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Wrench,
  Sparkles,
  Store,
} from 'lucide-react';
import {
  customersApi,
  airconApi,
  serviceRequestsApi,
  maintenanceApi,
  usersApi,
  storesApi,
  formatDate,
  formatTime,
} from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ExpandableRow } from '../components/common/ExpandableRow';
import { Skeleton } from '../components/common/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PhilippineAddressSelector } from '../components/address/PhilippineAddressSelector';

const initialFormData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  regionCode: '',
  regionName: '',
  provinceCode: '',
  provinceName: '',
  cityCode: '',
  cityName: '',
  barangayCode: '',
  barangayName: '',
  streetAddress: '',
  latitude: null,
  longitude: null,
  storeId: '',
};

const initialUnitFormData = {
  customerId: '',
  brand: 'Daikin',
  model: '',
  horsepower: 1.5,
  serialNumber: '',
  installationDate: new Date().toISOString().split('T')[0],
  warrantyExpiry: '',
  location: '',
  status: 'Active',
};

const initialRequestFormData = {
  customerId: '',
  unitId: '',
  issueDescription: '',
  priority: 'Medium',
};

const HVAC_BRANDS = [
  'Daikin',
  'Mitsubishi Electric',
  'Carrier',
  'Panasonic',
  'LG',
  'Samsung',
  'Gree',
  'York',
  'Midea',
  'Koppel',
  'Other',
];

// Correct pluralization helpers adhering to AGENTS.md rules
const pluralizeUnits = (count) => `${count} ${count === 1 ? 'Unit' : 'Units'}`;
const pluralizeRequests = (count) => `${count} ${count === 1 ? 'Request' : 'Requests'}`;
const pluralizeSchedules = (count) => `${count} ${count === 1 ? 'Schedule' : 'Schedules'}`;

export function CustomersPage({ globalSearch, targetCustomerId }) {
  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  // Primary data states
  const [customers, setCustomers] = useState([]);
  const [airconUnits, setAirconUnits] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [deleteId, setDeleteId] = useState(null);

  // Accordion state: only one row can be open at a time
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (targetCustomerId) {
      setExpandedCustomerId(targetCustomerId);
    }
  }, [targetCustomerId]);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsCustomer, setDetailsCustomer] = useState(null);

  // Quick Action Modals
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [targetCustomerForUnit, setTargetCustomerForUnit] = useState(null);
  const [unitFormData, setUnitFormData] = useState(initialUnitFormData);

  const [isAddRequestOpen, setIsAddRequestOpen] = useState(false);
  const [targetCustomerForRequest, setTargetCustomerForRequest] = useState(null);
  const [requestFormData, setRequestFormData] = useState(initialRequestFormData);

  // Form State
  const [formData, setFormData] = useState(initialFormData);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cRes, aRes, rRes, mRes, uRes, sRes] = await Promise.all([
        customersApi.getAll(),
        airconApi.getAll(),
        serviceRequestsApi.getAll(),
        maintenanceApi.getSchedules(),
        usersApi.getAll(),
        storesApi.getAll().catch(() => []),
      ]);
      setCustomers(Array.isArray(cRes) ? cRes : []);
      setAirconUnits(Array.isArray(aRes) ? aRes : []);
      setServiceRequests(Array.isArray(rRes) ? rRes : []);
      setMaintenanceSchedules(Array.isArray(mRes) ? mRes : []);
      setUsers(Array.isArray(uRes) ? uRes : []);
      setStores(Array.isArray(sRes) ? sRes : []);
    } catch (err) {
      console.error('Failed to load customer directory data:', err);
      error('Failed to load data. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRowToggle = (custId) => {
    setExpandedCustomerId((prev) => (prev === custId ? null : custId));
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await customersApi.create(formData);
      setIsAddOpen(false);
      setFormData(initialFormData);
      await loadData();
      success('Customer record created successfully.');
    } catch (err) {
      error(err.message || 'Failed to create customer.');
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const custId = selectedCustomer.customerId || selectedCustomer.customer_id;
      await customersApi.update(custId, formData);
      setIsEditOpen(false);
      setSelectedCustomer(null);
      await loadData();
      success('Customer record updated.');
    } catch (err) {
      error(err.message || 'Failed to update customer.');
    }
  };

  const handleDeleteCustomer = async (id) => {
    try {
      await customersApi.delete(id);
      if (expandedCustomerId === id) {
        setExpandedCustomerId(null);
      }
      await loadData();
      success('Customer deleted.');
    } catch (err) {
      error(err.message || 'Failed to delete customer.');
    }
  };

  const openEditModal = (c) => {
    setSelectedCustomer(c);
    setFormData({
      firstName: c.firstName || c.first_name || '',
      lastName: c.lastName || c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      regionCode: c.regionCode || c.region_code || '',
      regionName: c.regionName || c.region_name || '',
      provinceCode: c.provinceCode || c.province_code || '',
      provinceName: c.provinceName || c.province_name || '',
      cityCode: c.cityCode || c.city_code || '',
      cityName: c.cityName || c.city_name || '',
      barangayCode: c.barangayCode || c.barangay_code || '',
      barangayName: c.barangayName || c.barangay_name || '',
      streetAddress: c.streetAddress || c.street_address || '',
      latitude: c.latitude,
      longitude: c.longitude,
      storeId: c.storeId || c.store_id || '',
    });
    setIsEditOpen(true);
  };

  // Quick action: Add Unit for customer
  const handleOpenAddUnit = (customer) => {
    const custId = customer.customerId || customer.customer_id;
    setTargetCustomerForUnit(customer);
    setUnitFormData({
      ...initialUnitFormData,
      customerId: custId,
      location: customer.cityName ? `Main Unit - ${customer.cityName}` : '',
    });
    setIsAddUnitOpen(true);
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!unitFormData.horsepower || Number(unitFormData.horsepower) <= 0) {
      error('HP capacity must be a positive number greater than 0.');
      return;
    }
    try {
      await airconApi.create(unitFormData);
      setIsAddUnitOpen(false);
      await loadData();
      success('Aircon unit registered for customer.');
    } catch (err) {
      error(err.message || 'Failed to register aircon unit.');
    }
  };

  // Quick action: New Service Request for customer
  const handleOpenNewRequest = (customer) => {
    const custId = customer.customerId || customer.customer_id;
    const customerUnits = airconUnits.filter(
      (u) => (u.customerId || u.customer_id) === custId
    );
    setTargetCustomerForRequest(customer);
    setRequestFormData({
      customerId: custId,
      unitId: customerUnits.length > 0 ? (customerUnits[0].unitId || customerUnits[0].unit_id) : '',
      issueDescription: '',
      priority: 'Medium',
    });
    setIsAddRequestOpen(true);
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      await serviceRequestsApi.create(requestFormData);
      setIsAddRequestOpen(false);
      await loadData();
      success('Service request submitted successfully.');
    } catch (err) {
      error(err.message || 'Failed to submit service request.');
    }
  };

  // Filter logic
  const activeSearch = searchQuery || globalSearch;
  const filteredCustomers = customers.filter((c) => {
    if (storeFilter !== 'ALL') {
      const cStore = c.storeId ?? c.store_id;
      if (String(cStore) !== String(storeFilter)) return false;
    }
    const firstName = c.firstName || c.first_name || '';
    const lastName = c.lastName || c.last_name || '';
    const full = `${firstName} ${lastName}`.trim().toLowerCase();
    const query = (activeSearch || '').toLowerCase();
    return (
      full.includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query)) ||
      (c.cityName && c.cityName.toLowerCase().includes(query)) ||
      (c.barangayName && c.barangayName.toLowerCase().includes(query)) ||
      (c.provinceName && c.provinceName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Standard Shared Static PageHeader */}
      <PageHeader
        icon={Users}
        title="Customer Directory"
        subtitle="Manage client contact records, Philippine administrative address, and expand rows to view related fleet & servicing."
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search customers by name, phone, address..."
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Store Hub Filter */}
            <div 
              style={{
                backgroundColor: "var(--card-inner)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border"
            >
              <Store className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                style={{ color: "var(--text-primary)" }}
                className="bg-transparent text-xs focus:outline-none cursor-pointer py-1"
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
                setFormData(initialFormData);
                setIsAddOpen(true);
              }}
              className="shrink-0 text-xs py-1.5 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Add Customer</span>
              <span className="xs:hidden">Add</span>
            </PrimaryButton>
          </div>
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Main Directory Table Container */}
          <div 
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
            className="glass-panel rounded-3xl overflow-hidden shadow-xl border p-3 sm:p-5"
          >
            {/* Table Column Headers (Desktop/Tablet) - Sticky below PageHeader */}
            <div 
              style={{
                backgroundColor: "var(--card-inner)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
              className="hidden md:flex items-center justify-between px-6 py-3.5 uppercase text-[10px] font-bold tracking-wider border-b backdrop-blur-md rounded-2xl mb-3 sticky top-0 z-10 shadow-sm"
            >
          <div className="grid grid-cols-12 gap-4 flex-1 items-center">
            <div className="col-span-3">Customer Name</div>
            <div className="col-span-3">Contact Info</div>
            <div className="col-span-4">Address Location</div>
            <div className="col-span-2">Aircon Fleet</div>
          </div>
          <div className="w-32 text-right pr-6">Actions & Details</div>
        </div>

        {/* Rows State: Loading, Empty, or List of ExpandableRows */}
        {loading ? (
          <div className="space-y-3 p-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-[#0a1226]/50 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="w-36 h-4" />
                      <Skeleton className="w-20 h-2.5" />
                    </div>
                  </div>
                  <Skeleton className="w-24 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-14 text-center px-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            {customers.length === 0 ? (
              <div className="space-y-3">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  No customers registered in database yet.
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click &ldquo;Add Customer&rdquo; above to register your first client and begin tracking HVAC units.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setFormData(initialFormData);
                      setIsAddOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-white shadow-md hover:bg-sky-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register First Customer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  No matching customers found.
                </p>
                <p className="text-xs text-slate-400">
                  Try adjusting your search query or clear the filter.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredCustomers.map((c) => {
              const custId = c.customerId || c.customer_id;
              const firstName = c.firstName || c.first_name || '';
              const lastName = c.lastName || c.last_name || '';
              const firstInitial = (firstName[0] || 'C').toUpperCase();
              const lastInitial = (lastName[0] || '').toUpperCase();

              // Filter customer-specific linked records
              const customerUnits = airconUnits.filter(
                (u) => (u.customerId || u.customer_id) === custId
              );
              const customerRequests = serviceRequests.filter(
                (r) => (r.customerId || r.customer_id) === custId
              );
              const customerSchedules = maintenanceSchedules.filter(
                (s) => (s.customerId || s.customer_id) === custId
              );

              const hasCoordinates =
                c.latitude !== null &&
                c.latitude !== undefined &&
                c.longitude !== null &&
                c.longitude !== undefined;
              const isExpanded = expandedCustomerId === custId;

              return (
                <ExpandableRow
                  key={custId || `${firstName}-${lastName}`}
                  id={custId}
                  isExpanded={isExpanded}
                  onToggle={() => handleRowToggle(custId)}
                  chevronLabel={`Toggle ${firstName} ${lastName} details`}
                  actions={
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsCustomer(c);
                        }}
                        title="View Full Customer Details"
                        aria-label={`View full details for ${firstName} ${lastName}`}
                        className="p-1.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-500 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(c);
                        }}
                        title="Edit Customer"
                        aria-label={`Edit ${firstName} ${lastName}`}
                        className="p-1.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(custId);
                          }}
                          title="Delete Customer"
                          aria-label={`Delete ${firstName} ${lastName}`}
                          className="p-1.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  }
                  expandedContent={
                    <div className="space-y-5">
                      {/* 3 Information Sections Grid (Stacks vertically on mobile, 3-cols on desktop) */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Section 1: Aircon Units */}
                        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#0a1226]/70 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                                <Wind className="w-3.5 h-3.5 text-sky-500" />
                                Aircon Units ({pluralizeUnits(customerUnits.length)})
                              </h4>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddUnit(c);
                                }}
                                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add Unit
                              </button>
                            </div>

                            {customerUnits.length === 0 ? (
                              <div className="py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                                <p className="text-xs text-slate-400">No units yet</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddUnit(c);
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Register Unit
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {customerUnits.map((u) => (
                                  <div
                                    key={u.unitId || u.unit_id}
                                    className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-[#0f1a33]/60 text-xs space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {u.brand} {u.model}{' '}
                                        <span className="font-normal text-slate-500 text-[11px]">
                                          ({u.horsepower} HP)
                                        </span>
                                      </span>
                                      <Badge variant={u.status}>{u.status}</Badge>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                                      <div>
                                        SN:{' '}
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                          {u.serialNumber || 'N/A'}
                                        </span>
                                      </div>
                                      <div>
                                        Location:{' '}
                                        <span className="text-slate-700 dark:text-slate-300">
                                          {u.location || 'N/A'}
                                        </span>
                                      </div>
                                      <div>
                                        Warranty:{' '}
                                        <span className="text-slate-700 dark:text-slate-300">
                                          {formatDate(u.warrantyExpiry)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section 2: Service Requests */}
                        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#0a1226]/70 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                                <Wrench className="w-3.5 h-3.5 text-purple-500" />
                                Service Requests ({pluralizeRequests(customerRequests.length)})
                              </h4>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenNewRequest(c);
                                }}
                                className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-1 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> New Request
                              </button>
                            </div>

                            {customerRequests.length === 0 ? (
                              <div className="py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                                <p className="text-xs text-slate-400">No service requests yet</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenNewRequest(c);
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Submit Request
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {customerRequests.map((r) => (
                                  <div
                                    key={r.requestId || r.request_id}
                                    className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-[#0f1a33]/60 text-xs space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[10px] font-semibold text-slate-500">
                                        #REQ-{r.requestId || r.request_id}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <Badge variant={r.priority}>{r.priority}</Badge>
                                        <Badge variant={r.status}>{r.status}</Badge>
                                      </div>
                                    </div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 text-xs">
                                      {r.issueDescription || r.issue_description || 'General Service Request'}
                                    </div>
                                    {r.requestDate && (
                                      <div className="text-[10px] text-slate-400">
                                        Date: {formatDate(r.requestDate)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section 3: Maintenance */}
                        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#0a1226]/70 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                Maintenance Servicing ({pluralizeSchedules(customerSchedules.length)})
                              </h4>
                            </div>

                            {customerSchedules.length === 0 ? (
                              <div className="py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
                                <p className="text-xs text-slate-400">No maintenance servicing yet</p>
                                <p className="text-[11px] text-slate-500">
                                  Scheduled servicing will appear here automatically.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {customerSchedules.map((s) => {
                                  const tech = users.find(
                                    (u) =>
                                      (u.userId || u.user_id) ===
                                      (s.technicianId || s.technician_id)
                                  );
                                  const techName = tech
                                    ? tech.fullName || tech.full_name || tech.username
                                    : s.technicianId
                                    ? `Tech #${s.technicianId}`
                                    : 'Unassigned';

                                  return (
                                    <div
                                      key={s.scheduleId || s.schedule_id}
                                      className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-[#0f1a33]/60 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {formatDate(s.scheduleDate)}{' '}
                                          {s.scheduleTime ? `(${formatTime(s.scheduleTime)})` : ''}
                                        </span>
                                        <Badge variant={s.status}>{s.status}</Badge>
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Technician:{' '}
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                          {techName}
                                        </span>
                                      </div>
                                      {s.remarks && (
                                        <div className="text-[11px] text-slate-400 italic">
                                          &ldquo;{s.remarks}&rdquo;
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Buttons in the Panel */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Quick Actions for {firstName} {lastName}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddUnit(c);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                          >
                            <Wind className="w-3.5 h-3.5" />
                            <span>Add Unit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenNewRequest(c);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>New Service Request</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(c);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Customer</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* Summary Grid Columns (Main Row Content) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center text-xs">
                    {/* Customer Name & Avatar */}
                    <div className="md:col-span-3 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md shrink-0">
                        {firstInitial}{lastInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {firstName} {lastName}
                        </div>
                        <div className="text-[10px] text-slate-400">ID #{custId}</div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="md:col-span-3 space-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="truncate">{c.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Mail className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="truncate">{c.email || 'No email'}</span>
                      </div>
                    </div>

                    {/* Address & Mapped Location */}
                    <div className="md:col-span-4">
                      <div className="flex items-start space-x-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="line-clamp-1">{c.address || 'No address provided'}</span>
                          <div className="mt-0.5">
                            {hasCoordinates ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Mapped ({Number(c.latitude).toFixed(2)}, {Number(c.longitude).toFixed(2)})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Location not mapped
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Aircon Units Count Pill */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowToggle(custId);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 font-semibold text-xs transition-colors"
                      >
                        <Wind className="w-3.5 h-3.5" />
                        <span>{pluralizeUnits(customerUnits.length)}</span>
                      </button>
                    </div>
                  </div>
                </ExpandableRow>
              );
            })}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Modal: Add Customer */}
      <Modal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        title="Register New Customer" 
        subtitle="Create a new client profile with address and contact information"
        onSubmit={handleCreateCustomer}
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
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Save Customer
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="First name"
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Last name"
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0917-000-0000"
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@domain.com"
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Assigned Service Branch / Hub
          </label>
          <select
            value={formData.storeId || ''}
            onChange={(e) => setFormData({ ...formData, storeId: e.target.value ? Number(e.target.value) : '' })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">No specific branch assigned</option>
            {stores.map((s) => (
              <option key={s.storeId} value={s.storeId}>
                {s.name} ({s.code}) {s.isMainBranch ? '— Main Branch' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Philippine Cascading Address Selector */}
        <PhilippineAddressSelector
          value={formData}
          onChange={(newAddress) => setFormData(newAddress)}
        />
      </Modal>

      {/* Modal: Edit Customer */}
      <Modal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title="Edit Customer Details" 
        subtitle="Update client contact details and geographical address"
        onSubmit={handleUpdateCustomer}
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
              Update Customer
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Assigned Service Branch / Hub
          </label>
          <select
            value={formData.storeId || ''}
            onChange={(e) => setFormData({ ...formData, storeId: e.target.value ? Number(e.target.value) : '' })}
            className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">No specific branch assigned</option>
            {stores.map((s) => (
              <option key={s.storeId} value={s.storeId}>
                {s.name} ({s.code}) {s.isMainBranch ? '— Main Branch' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Philippine Cascading Address Selector */}
        <PhilippineAddressSelector
          value={formData}
          onChange={(newAddress) => setFormData(newAddress)}
        />
      </Modal>

      {/* Modal: Customer Details & Linked Units */}
      {detailsCustomer && (
        <Modal
          isOpen={!!detailsCustomer}
          onClose={() => setDetailsCustomer(null)}
          title={`Customer Details: ${(detailsCustomer.firstName || detailsCustomer.first_name || '')} ${(detailsCustomer.lastName || detailsCustomer.last_name || '')}`.trim() || `Customer #${detailsCustomer.customerId || detailsCustomer.customer_id}`}
          subtitle="Client profile, registered contact information, and mapped HVAC fleet"
          footer={
            <button
              type="button"
              onClick={() => setDetailsCustomer(null)}
              className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          }
        >
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Contact Phone</span>
                <span className="font-medium text-slate-900 dark:text-white">{detailsCustomer.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Email Address</span>
                <span className="font-medium text-slate-900 dark:text-white">{detailsCustomer.email || 'N/A'}</span>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <span className="text-slate-400 block font-semibold uppercase text-[10px]">Complete Formatted Address</span>
                <span className="font-medium text-slate-900 dark:text-white">{detailsCustomer.address || 'N/A'}</span>
              </div>
              {detailsCustomer.cityName && (
                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[9px]">Region</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{detailsCustomer.regionName || detailsCustomer.region_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[9px]">Province</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{detailsCustomer.provinceName || detailsCustomer.province_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[9px]">City / Municipality</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{detailsCustomer.cityName || detailsCustomer.city_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[9px]">Barangay</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{detailsCustomer.barangayName || detailsCustomer.barangay_name || 'N/A'}</span>
                  </div>
                </div>
              )}
              <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Map Location Status</span>
                  {detailsCustomer.latitude && detailsCustomer.longitude ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Coordinates: {Number(detailsCustomer.latitude).toFixed(5)}, {Number(detailsCustomer.longitude).toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium text-xs flex items-center gap-1.5 mt-0.5">
                      Location not mapped
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-500" />
                Linked Aircon Fleet Units
              </h4>

              {airconUnits.filter(u => (u.customerId || u.customer_id) === (detailsCustomer.customerId || detailsCustomer.customer_id)).length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-800/30 p-4 rounded-xl text-center">
                  No aircon units registered to this customer yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {airconUnits.filter(u => (u.customerId || u.customer_id) === (detailsCustomer.customerId || detailsCustomer.customer_id)).map((u) => (
                    <div key={u.unitId || u.unit_id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {u.brand} {u.model} ({u.horsepower} HP)
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Serial: {u.serialNumber || 'N/A'} | Location: {u.location || 'N/A'}
                        </div>
                      </div>
                      <Badge variant={u.status}>{u.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Action Modal: Add Unit */}
      {isAddUnitOpen && (
        <Modal
          isOpen={isAddUnitOpen}
          onClose={() => setIsAddUnitOpen(false)}
          title={`Register Aircon Unit for ${targetCustomerForUnit?.firstName || ''} ${targetCustomerForUnit?.lastName || ''}`}
          subtitle="Add an HVAC unit directly associated with this customer profile"
          onSubmit={handleCreateUnit}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsAddUnitOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-colors"
              >
                Save Aircon Unit
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Brand *
              </label>
              <select
                required
                value={unitFormData.brand}
                onChange={(e) => setUnitFormData({ ...unitFormData, brand: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {HVAC_BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Model *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FTKM35UVM"
                value={unitFormData.model}
                onChange={(e) => setUnitFormData({ ...unitFormData, model: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                HP Capacity (Horsepower) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={unitFormData.horsepower}
                onChange={(e) => setUnitFormData({ ...unitFormData, horsepower: parseFloat(e.target.value) || 1.0 })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Serial Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DK-2026-991"
                value={unitFormData.serialNumber}
                onChange={(e) => setUnitFormData({ ...unitFormData, serialNumber: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Installation Date
              </label>
              <input
                type="date"
                value={unitFormData.installationDate}
                onChange={(e) => setUnitFormData({ ...unitFormData, installationDate: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Warranty Expiry
              </label>
              <input
                type="date"
                value={unitFormData.warrantyExpiry}
                onChange={(e) => setUnitFormData({ ...unitFormData, warrantyExpiry: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Room / Placement Location
            </label>
            <input
              type="text"
              placeholder="e.g. Master Bedroom, 2nd Floor"
              value={unitFormData.location}
              onChange={(e) => setUnitFormData({ ...unitFormData, location: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </Modal>
      )}

      {/* Quick Action Modal: New Service Request */}
      {isAddRequestOpen && (
        <Modal
          isOpen={isAddRequestOpen}
          onClose={() => setIsAddRequestOpen(false)}
          title={`Log Service Request for ${targetCustomerForRequest?.firstName || ''} ${targetCustomerForRequest?.lastName || ''}`}
          subtitle="Submit a servicing or diagnostic maintenance ticket"
          onSubmit={handleCreateRequest}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsAddRequestOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-colors"
              >
                Submit Service Request
              </button>
            </>
          }
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Affected Aircon Unit *
            </label>
            <select
              required
              value={requestFormData.unitId}
              onChange={(e) => setRequestFormData({ ...requestFormData, unitId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select an aircon unit...</option>
              {airconUnits
                .filter(
                  (u) =>
                    (u.customerId || u.customer_id) ===
                    (targetCustomerForRequest?.customerId || targetCustomerForRequest?.customer_id)
                )
                .map((u) => (
                  <option key={u.unitId || u.unit_id} value={u.unitId || u.unit_id}>
                    {u.brand} {u.model} - {u.location || 'Unit'} (SN: {u.serialNumber || 'N/A'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Issue Description / Request Title *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe the HVAC issue (e.g. Unit not cooling, water leak from indoor unit, strange sound)..."
              value={requestFormData.issueDescription}
              onChange={(e) => setRequestFormData({ ...requestFormData, issueDescription: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Priority Level
            </label>
            <select
              value={requestFormData.priority}
              onChange={(e) => setRequestFormData({ ...requestFormData, priority: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDeleteCustomer(deleteId)}
        title="Delete Customer"
        message="Are you sure you want to delete this customer record? This action cannot be undone."
        confirmLabel="Delete Customer"
      />
    </div>
  );
}
export default CustomersPage;
