import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Store,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Shield,
  Users,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Plus,
  Search,
  LayoutGrid,
  List,
  Crosshair,
  ExternalLink,
  Star,
  Navigation,
  Radio,
  Wrench,
  Check,
  X,
  Compass,
  Car
} from 'lucide-react';
import { storesApi, usersApi } from '../services/api';
import { osmService, osmTileLayers } from '../services/osmService';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Skeleton } from '../components/common/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEFAULT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const STANDARD_SERVICES = [
  'Installation',
  'Cleaning',
  'Repair',
  'Maintenance contracts',
  'Parts sales',
];

const INITIAL_HOURS = {
  mon: { open: '08:00', close: '17:00', closed: false },
  tue: { open: '08:00', close: '17:00', closed: false },
  wed: { open: '08:00', close: '17:00', closed: false },
  thu: { open: '08:00', close: '17:00', closed: false },
  fri: { open: '08:00', close: '17:00', closed: false },
  sat: { open: '08:00', close: '17:00', closed: false },
  sun: { open: '08:00', close: '17:00', closed: true },
  holidayNote: 'Closed on national holidays',
};

const INITIAL_FORM = {
  name: '',
  code: '',
  status: 'Open',
  isMainBranch: false,
  street: '',
  barangay: '',
  cityMunicipality: '',
  province: '',
  region: '',
  postalCode: '',
  latitude: 14.8344,
  longitude: 120.2828,
  landmarkNotes: '',
  locationSource: 'Pin dropped',
  isVerified: true,
  phone: '',
  mobile: '',
  email: '',
  websiteUrl: '',
  openingHours: INITIAL_HOURS,
  serviceRadiusKm: 15,
  servicesOffered: [...STANDARD_SERVICES],
  acceptsWalkIns: true,
  parkingNotes: '',
  managerId: null,
  assignedTechnicians: [],
  businessName: '',
  registrationNumber: '',
  logoUrl: '',
};

/**
 * Calculates whether a branch is open now based on Asia/Manila time zone
 */
export function getStoreLiveStatus(openingHoursJson) {
  if (!openingHoursJson) return { isOpen: false, text: 'Hours not set', badgeColor: 'gray' };

  let hoursObj = openingHoursJson;
  if (typeof hoursObj === 'string') {
    try {
      hoursObj = JSON.parse(hoursObj);
    } catch {
      return { isOpen: false, text: String(openingHoursJson), badgeColor: 'gray' };
    }
  }

  try {
    const now = new Date();
    // Format to Asia/Manila day and time
    const manilaDayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
    }).format(now).toLowerCase(); // e.g. "mon"

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now); // e.g. "09:30"

    const dayKey = manilaDayStr.slice(0, 3);
    const dayConfig = hoursObj[dayKey];

    if (!dayConfig || dayConfig.closed) {
      return { isOpen: false, text: 'Closed today', badgeColor: 'amber' };
    }

    const currentMins = timeToMinutes(timeParts);
    const openMins = timeToMinutes(dayConfig.open || '08:00');
    const closeMins = timeToMinutes(dayConfig.close || '17:00');

    if (currentMins >= openMins && currentMins < closeMins) {
      return {
        isOpen: true,
        text: `Open now • Closes ${format12h(dayConfig.close)}`,
        badgeColor: 'green',
      };
    } else if (currentMins < openMins) {
      return {
        isOpen: false,
        text: `Closed • Opens at ${format12h(dayConfig.open)}`,
        badgeColor: 'amber',
      };
    } else {
      return {
        isOpen: false,
        text: 'Closed for the day',
        badgeColor: 'amber',
      };
    }
  } catch (err) {
    return { isOpen: false, text: 'Schedule active', badgeColor: 'gray' };
  }
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function format12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

export function StoresPage({ globalSearch, setActiveTab }) {
  const { isAdmin } = useAuth();
  const { success, error: toastError, warning } = useToast();

  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & display mode
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [activeFormTab, setActiveFormTab] = useState('basic'); // 'basic' | 'location' | 'operations' | 'hours'
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Embedded Location Picker state
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerSearching, setPickerSearching] = useState(false);
  const [pickerResolving, setPickerResolving] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const radiusCircleRef = useRef(null);

  // Delete & Reassignment state
  const [deletingStore, setDeletingStore] = useState(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Load stores & users
  const loadData = async () => {
    try {
      setLoading(true);
      const [storesRes, usersRes] = await Promise.all([
        storesApi.getAll(),
        usersApi.getAll().catch(() => []),
      ]);
      setStores(Array.isArray(storesRes) ? storesRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (err) {
      console.error('Failed to load stores:', err);
      toastError('Failed to load store branches. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const technicians = useMemo(() => {
    return users.filter((u) => u.role === 'Technician');
  }, [users]);

  // Unique cities for filter
  const uniqueCities = useMemo(() => {
    const set = new Set();
    stores.forEach((s) => {
      if (s.cityMunicipality?.trim()) set.add(s.cityMunicipality.trim());
    });
    return Array.from(set).sort();
  }, [stores]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    const q = (searchQuery || globalSearch || '').toLowerCase().trim();
    return stores.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (cityFilter !== 'ALL' && s.cityMunicipality !== cityFilter) return false;

      if (q) {
        const matchName = s.name?.toLowerCase().includes(q);
        const matchCode = s.code?.toLowerCase().includes(q);
        const matchCity = s.cityMunicipality?.toLowerCase().includes(q);
        const matchPhone = s.phone?.toLowerCase().includes(q) || s.mobile?.toLowerCase().includes(q);
        const matchStreet = s.street?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCity && !matchPhone && !matchStreet) return false;
      }
      return true;
    });
  }, [stores, searchQuery, globalSearch, statusFilter, cityFilter]);

  // Leaflet map initialization inside location tab
  useEffect(() => {
    if (!isModalOpen || activeFormTab !== 'location') return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const lat = Number(formData.latitude) || 14.8344;
      const lng = Number(formData.longitude) || 120.2828;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer(osmTileLayers.standard.url, {
        attribution: osmTileLayers.standard.attribution,
        maxZoom: 19,
      }).addTo(map);

      // Custom Store Marker Pin
      const storePinIcon = L.divIcon({
        className: 'store-pin-marker',
        html: `
          <div style="
            background: linear-gradient(135deg, #0ea5e9, #2563eb);
            color: white;
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 14px rgba(14, 165, 233, 0.45);
          ">
            <div style="transform: rotate(45deg); font-size: 18px;">🏢</div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const marker = L.marker([lat, lng], {
        icon: storePinIcon,
        draggable: true,
      }).addTo(map);

      // Radius circle
      const radiusMeters = (Number(formData.serviceRadiusKm) || 15) * 1000;
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#0ea5e9',
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 6',
      }).addTo(map);

      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.lat.toFixed(6)),
          longitude: Number(pos.lng.toFixed(6)),
          locationSource: 'Pin dropped',
        }));
        circle.setLatLng(pos);
        await autoReverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', async (e) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        setFormData((prev) => ({
          ...prev,
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
          locationSource: 'Pin dropped',
        }));
        await autoReverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      radiusCircleRef.current = circle;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isModalOpen, activeFormTab]);

  // Update radius circle if service radius changes
  useEffect(() => {
    if (radiusCircleRef.current) {
      const radiusMeters = (Number(formData.serviceRadiusKm) || 15) * 1000;
      radiusCircleRef.current.setRadius(radiusMeters);
    }
  }, [formData.serviceRadiusKm]);

  // Sync marker position if manual lat/lng changed
  const updateMapPosition = (lat, lng) => {
    if (markerRef.current && mapInstanceRef.current) {
      const newLatLng = [lat, lng];
      markerRef.current.setLatLng(newLatLng);
      if (radiusCircleRef.current) radiusCircleRef.current.setLatLng(newLatLng);
      mapInstanceRef.current.panTo(newLatLng);
    }
  };

  const autoReverseGeocode = async (lat, lng) => {
    try {
      setPickerResolving(true);
      const res = await osmService.reverseGeocode(lat, lng);
      if (res) {
        setFormData((prev) => ({
          ...prev,
          street: res.streetAddress || prev.street,
          barangay: res.barangayName || prev.barangay,
          cityMunicipality: res.cityName || prev.cityMunicipality,
          province: res.provinceName || prev.province,
          region: res.regionName || prev.region,
          postalCode: res.postcode || prev.postalCode,
        }));
      }
    } catch (err) {
      console.warn('Auto reverse geocode failed:', err);
    } finally {
      setPickerResolving(false);
    }
  };

  const handleNominatimSearch = async (e) => {
    e.preventDefault();
    if (!pickerSearchQuery?.trim()) return;
    try {
      setPickerSearching(true);
      const results = await osmService.searchAddress(pickerSearchQuery, { limit: 5 });
      setPickerResults(results || []);
    } catch (err) {
      toastError('Address search request failed.');
    } finally {
      setPickerSearching(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    const lat = Number(result.latitude);
    const lng = Number(result.longitude);
    setFormData((prev) => ({
      ...prev,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      locationSource: 'Geocoded',
    }));
    updateMapPosition(lat, lng);
    setPickerResults([]);
    autoReverseGeocode(lat, lng);
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      warning('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          locationSource: 'GPS',
        }));
        updateMapPosition(lat, lng);
        autoReverseGeocode(lat, lng);
        success('Detected GPS coordinates successfully.');
      },
      (err) => {
        toastError(`Unable to retrieve GPS location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Open Modal for Create
  const handleOpenAdd = () => {
    setEditingStoreId(null);
    setFormData(INITIAL_FORM);
    setActiveFormTab('basic');
    setPickerSearchQuery('');
    setPickerResults([]);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (store) => {
    setEditingStoreId(store.storeId);
    let parsedHours = INITIAL_HOURS;
    if (store.openingHours) {
      try {
        parsedHours = typeof store.openingHours === 'string'
          ? JSON.parse(store.openingHours)
          : store.openingHours;
      } catch {
        parsedHours = INITIAL_HOURS;
      }
    }

    let parsedServices = STANDARD_SERVICES;
    if (store.servicesOffered) {
      try {
        parsedServices = typeof store.servicesOffered === 'string'
          ? JSON.parse(store.servicesOffered)
          : store.servicesOffered;
      } catch {
        parsedServices = STANDARD_SERVICES;
      }
    }

    let parsedTechs = [];
    if (store.assignedTechnicians) {
      try {
        parsedTechs = typeof store.assignedTechnicians === 'string'
          ? JSON.parse(store.assignedTechnicians)
          : store.assignedTechnicians;
      } catch {
        parsedTechs = [];
      }
    }

    setFormData({
      name: store.name || '',
      code: store.code || '',
      status: store.status || 'Open',
      isMainBranch: Boolean(store.isMainBranch),
      street: store.street || '',
      barangay: store.barangay || '',
      cityMunicipality: store.cityMunicipality || '',
      province: store.province || '',
      region: store.region || '',
      postalCode: store.postalCode || '',
      latitude: store.latitude || 14.8344,
      longitude: store.longitude || 120.2828,
      landmarkNotes: store.landmarkNotes || '',
      locationSource: store.locationSource || 'Pin dropped',
      isVerified: Boolean(store.isVerified),
      phone: store.phone || '',
      mobile: store.mobile || '',
      email: store.email || '',
      websiteUrl: store.websiteUrl || '',
      openingHours: parsedHours,
      serviceRadiusKm: store.serviceRadiusKm || 15,
      servicesOffered: parsedServices,
      acceptsWalkIns: store.acceptsWalkIns !== false,
      parkingNotes: store.parkingNotes || '',
      managerId: store.managerId || null,
      assignedTechnicians: parsedTechs,
      businessName: store.businessName || '',
      registrationNumber: store.registrationNumber || '',
      logoUrl: store.logoUrl || '',
    });
    setActiveFormTab('basic');
    setPickerSearchQuery('');
    setPickerResults([]);
    setIsModalOpen(true);
  };

  // Save Store (Create or Update)
  const handleSubmitStore = async (e) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toastError('Branch Name is required.');
      return;
    }
    if (!formData.code?.trim()) {
      toastError('Branch Code is required (e.g. OLG-01).');
      return;
    }
    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);
    if (isNaN(lat) || isNaN(lng) || lat < 4.0 || lat > 22.0 || lng < 115.0 || lng > 128.0) {
      toastError('Coordinates must be valid numbers within the Philippines (Lat: 4.0 - 22.0, Lng: 115.0 - 128.0).');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      status: formData.status,
      isMainBranch: Boolean(formData.isMainBranch),
      street: formData.street?.trim() || null,
      barangay: formData.barangay?.trim() || null,
      cityMunicipality: formData.cityMunicipality?.trim() || null,
      province: formData.province?.trim() || null,
      region: formData.region?.trim() || null,
      postalCode: formData.postalCode?.trim() || null,
      latitude: lat,
      longitude: lng,
      landmarkNotes: formData.landmarkNotes?.trim() || null,
      locationSource: formData.locationSource || 'Pin dropped',
      isVerified: Boolean(formData.isVerified),
      phone: formData.phone?.trim() || null,
      mobile: formData.mobile?.trim() || null,
      email: formData.email?.trim() || null,
      websiteUrl: formData.websiteUrl?.trim() || null,
      openingHours: JSON.stringify(formData.openingHours),
      serviceRadiusKm: Number(formData.serviceRadiusKm) || 15,
      servicesOffered: JSON.stringify(formData.servicesOffered),
      acceptsWalkIns: Boolean(formData.acceptsWalkIns),
      parkingNotes: formData.parkingNotes?.trim() || null,
      managerId: formData.managerId ? Number(formData.managerId) : null,
      assignedTechnicians: JSON.stringify(formData.assignedTechnicians),
      businessName: formData.businessName?.trim() || null,
      registrationNumber: formData.registrationNumber?.trim() || null,
      logoUrl: formData.logoUrl?.trim() || null,
    };

    try {
      setFormSubmitting(true);
      if (editingStoreId) {
        await storesApi.update(editingStoreId, payload);
        success(`Branch "${payload.name}" updated successfully.`);
      } else {
        await storesApi.create(payload);
        success(`New branch "${payload.name}" registered successfully.`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Save store failed:', err);
      toastError(err.message || 'Failed to save store branch.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Set as Main Branch
  const handleSetMainBranch = async (store) => {
    try {
      await storesApi.setMain(store.storeId);
      success(`"${store.name}" is now the designated main headquarters branch.`);
      await loadData();
    } catch (err) {
      toastError(err.message || 'Failed to designate main branch.');
    }
  };

  // Delete Click -> Check Dependencies
  const handleDeleteClick = async (store) => {
    setDeletingStore(store);
    try {
      setDeleteCheckLoading(true);
      const checkRes = await storesApi.checkDelete(store.storeId);
      setDeleteCheckResult(checkRes);

      if (checkRes.canDelete) {
        setIsConfirmDeleteOpen(true);
      } else {
        // Find default target branch (first other branch)
        const otherStore = stores.find((s) => s.storeId !== store.storeId);
        setReassignTargetId(otherStore ? String(otherStore.storeId) : '');
        setIsReassignModalOpen(true);
      }
    } catch (err) {
      toastError(err.message || 'Failed to check store dependencies.');
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  // Direct Delete
  const handleConfirmDirectDelete = async () => {
    if (!deletingStore) return;
    try {
      await storesApi.delete(deletingStore.storeId);
      success(`Branch "${deletingStore.name}" deleted.`);
      setIsConfirmDeleteOpen(false);
      setDeletingStore(null);
      await loadData();
    } catch (err) {
      toastError(err.message || 'Failed to delete store branch.');
    }
  };

  // Reassign & Delete
  const handleConfirmReassignDelete = async (e) => {
    e.preventDefault();
    if (!deletingStore || !reassignTargetId) {
      toastError('Please select a target store branch for reassignment.');
      return;
    }
    try {
      setReassignSubmitting(true);
      await storesApi.reassignAndDelete(deletingStore.storeId, Number(reassignTargetId));
      const targetStore = stores.find((s) => String(s.storeId) === String(reassignTargetId));
      success(
        `Store deleted. Customers, requests, and technicians reassigned to "${targetStore?.name || 'target branch'}" successfully.`
      );
      setIsReassignModalOpen(false);
      setDeletingStore(null);
      await loadData();
    } catch (err) {
      toastError(err.message || 'Failed to reassign and delete store.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Navigate to map centered on store
  const handleViewOnMap = (store) => {
    if (typeof setActiveTab === 'function') {
      sessionStorage.setItem('aeroflow_map_focus_store', String(store.storeId));
      setActiveTab('customermap');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Open':
        return <Badge variant="success">Open</Badge>;
      case 'Temporarily closed':
        return <Badge variant="warning">Temporarily Closed</Badge>;
      case 'Closed permanently':
        return <Badge variant="danger">Closed Permanently</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Shared Static Page Header */}
      <PageHeader
        icon={Building2}
        title="Store Branches & Service Hubs"
        subtitle="Manage physical HVAC workshops, dispatch bases, coverage zones, and technician home hubs."
        actions={
          <div className="flex items-center gap-3">
            {isAdmin && (
              <PrimaryButton onClick={handleOpenAdd} className="shrink-0 text-xs py-1.5 px-3">
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Add Store Branch</span>
                <span className="xs:hidden">Add Branch</span>
              </PrimaryButton>
            )}
          </div>
        }
      />

      {/* Scrollable Content Container */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto w-full" 
        style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-6">
      {/* Filter and View Mode Bar */}
      <div 
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--border)",
        }}
        className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border"
      >
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search branch name, code, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--input-border)",
                color: "var(--input-text)",
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--input-border)",
              color: "var(--input-text)",
            }}
            className="px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Temporarily closed">Temporarily Closed</option>
            <option value="Closed permanently">Closed Permanently</option>
          </select>

          {/* City Filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--input-border)",
              color: "var(--input-text)",
            }}
            className="px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Cities</option>
            {uniqueCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle & total count */}
        <div className="flex items-center gap-3 shrink-0">
          <span style={{ color: "var(--text-muted)" }} className="text-xs font-semibold">
            {filteredStores.length} {filteredStores.length === 1 ? 'Branch' : 'Branches'}
          </span>
          <div 
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: "var(--border)",
            }}
            className="flex items-center p-1 rounded-xl border"
          >
            <button
              onClick={() => setViewMode('cards')}
              title="Card View"
              style={
                viewMode === 'cards'
                  ? { backgroundColor: "var(--card-bg)", color: "var(--accent)", boxShadow: "var(--shadow)" }
                  : { color: "var(--text-muted)" }
              }
              className="p-1.5 rounded-lg transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              style={
                viewMode === 'table'
                  ? { backgroundColor: "var(--card-bg)", color: "var(--accent)", boxShadow: "var(--shadow)" }
                  : { color: "var(--text-muted)" }
              }
              className="p-1.5 rounded-lg transition-colors"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
              className="glass-panel p-5 rounded-2xl border animate-pulse space-y-4"
            >
              <div className="flex justify-between items-start">
                <Skeleton className="w-40 h-6" />
                <Skeleton className="w-16 h-5" />
              </div>
              <Skeleton className="w-full h-12" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredStores.length === 0 ? (
        <div 
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
          className="glass-panel py-16 text-center px-4 rounded-3xl border"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <h3 style={{ color: "var(--text-primary)" }} className="text-base font-bold mb-1">
            No Store Branches Found
          </h3>
          <p style={{ color: "var(--text-muted)" }} className="text-xs max-w-md mx-auto mb-5">
            {stores.length === 0
              ? 'No physical branches or dispatch bases registered yet. Register your main headquarters to enable routing and service zones.'
              : 'No branches match the current search or filter criteria. Try adjusting your search query or filters.'}
          </p>
          {isAdmin && stores.length === 0 && (
            <PrimaryButton onClick={handleOpenAdd} className="mx-auto">
              <Plus className="w-4 h-4" />
              <span>Create Main Branch</span>
            </PrimaryButton>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStores.map((store) => {
            const liveStatus = getStoreLiveStatus(store.openingHours);
            const manager = users.find((u) => u.userId === store.managerId);

            return (
              <div
                key={store.storeId}
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: store.isMainBranch ? "var(--accent)" : "var(--border)",
                  boxShadow: "var(--shadow)",
                }}
                className="glass-panel p-5 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  {/* Top Bar: Code, Main Badge, Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        style={{
                          backgroundColor: "var(--chip-bg)",
                          borderColor: "var(--chip-border)",
                          color: "var(--accent)",
                        }}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border"
                      >
                        {store.code}
                      </span>
                      {store.isMainBranch && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-orange-500/20">
                          <Star className="w-3 h-3 fill-current" />
                          MAIN BRANCH
                        </span>
                      )}
                    </div>
                    <div>{getStatusBadge(store.status)}</div>
                  </div>

                  {/* Branch Title & Business Name */}
                  <div className="mb-3">
                    <h2 style={{ color: "var(--text-primary)" }} className="text-base font-bold group-hover:text-sky-500 transition-colors">
                      {store.name}
                    </h2>
                    {store.businessName && (
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px] mt-0.5">{store.businessName}</p>
                    )}
                  </div>

                  {/* Live Status Indicator */}
                  <div 
                    style={{
                      backgroundColor: "var(--card-inner)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-xl border text-xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="font-semibold">
                      {liveStatus.text}
                    </span>
                    <span
                      className={`ml-auto w-2 h-2 rounded-full shrink-0 ${
                        liveStatus.badgeColor === 'green'
                          ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                          : 'bg-amber-500 ring-4 ring-amber-500/20'
                      }`}
                    />
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2.5 text-xs mb-3">
                    <MapPin className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <p style={{ color: "var(--text-primary)" }} className="font-medium">
                        {[store.street, store.barangay].filter(Boolean).join(', ') || 'Address on file'}
                      </p>
                      <p style={{ color: "var(--text-muted)" }} className="text-[11px]">
                        {[store.cityMunicipality, store.province, store.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {store.landmarkNotes && (
                        <p style={{ color: "var(--text-muted)" }} className="text-[10px] italic mt-0.5">
                          📍 {store.landmarkNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div 
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mb-4 pt-2 border-t"
                  >
                    {(store.phone || store.mobile) && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <a
                          href={`tel:${store.phone || store.mobile}`}
                          className="hover:text-sky-500 transition-colors truncate"
                        >
                          {store.phone || store.mobile}
                        </a>
                      </div>
                    )}
                    {store.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <a
                          href={`mailto:${store.email}`}
                          className="hover:text-sky-500 transition-colors truncate"
                        >
                          {store.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Metrics & Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span 
                      style={{
                        backgroundColor: "var(--chip-bg)",
                        borderColor: "var(--chip-border)",
                        color: "var(--chip-text)",
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                    >
                      <Radio className="w-3 h-3 text-sky-500" />
                      {store.serviceRadiusKm} km coverage
                    </span>
                    <span 
                      style={{
                        backgroundColor: "var(--chip-bg)",
                        borderColor: "var(--chip-border)",
                        color: "var(--chip-text)",
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                    >
                      <Users className="w-3 h-3 text-indigo-500" />
                      {store.assignedTechnicianCount} Technicians
                    </span>
                    {manager && (
                      <span 
                        style={{
                          backgroundColor: "var(--status-success-bg)",
                          borderColor: "var(--status-success-border)",
                          color: "var(--status-success-text)",
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                      >
                        <Shield className="w-3 h-3" />
                        Mgr: {manager.fullName || manager.username}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div 
                  style={{ borderColor: "var(--border)" }}
                  className="pt-3 border-t flex items-center justify-between gap-2 mt-2"
                >
                  <button
                    onClick={() => handleViewOnMap(store)}
                    style={{
                      backgroundColor: "var(--chip-bg)",
                      borderColor: "var(--chip-border)",
                      color: "var(--accent)",
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-xl hover:opacity-80 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>View on Map</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isAdmin && !store.isMainBranch && (
                      <button
                        onClick={() => handleSetMainBranch(store)}
                        title="Set as Main Branch"
                        style={{ color: "var(--text-muted)" }}
                        className="p-1.5 hover:text-amber-500 rounded-lg transition-colors"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleOpenEdit(store)}
                        title="Edit Branch"
                        style={{ color: "var(--text-muted)" }}
                        className="p-1.5 hover:text-sky-500 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClick(store)}
                        title="Delete Branch"
                        style={{ color: "var(--text-muted)" }}
                        className="p-1.5 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div 
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border)",
          }}
          className="glass-panel rounded-2xl overflow-hidden border"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead 
                style={{
                  backgroundColor: "var(--card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
                className="text-[11px] font-bold uppercase tracking-wider border-b"
              >
                <tr>
                  <th className="py-3 px-4">Branch & Code</th>
                  <th className="py-3 px-4">Address Location</th>
                  <th className="py-3 px-4">Today's Schedule</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Coverage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody 
                style={{ borderColor: "var(--border)" }}
                className="divide-y"
              >
                {filteredStores.map((store) => {
                  const liveStatus = getStoreLiveStatus(store.openingHours);
                  return (
                    <tr
                      key={store.storeId}
                      style={{ borderColor: "var(--border)" }}
                      className="hover:opacity-90 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span 
                            style={{
                              backgroundColor: "var(--chip-bg)",
                              borderColor: "var(--chip-border)",
                              color: "var(--accent)",
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                          >
                            {store.code}
                          </span>
                          <div>
                            <div style={{ color: "var(--text-primary)" }} className="font-bold flex items-center gap-1.5">
                              {store.name}
                              {store.isMainBranch && (
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              )}
                            </div>
                            {store.businessName && (
                              <div style={{ color: "var(--text-muted)" }} className="text-[10px]">{store.businessName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate">
                        <div style={{ color: "var(--text-primary)" }} className="truncate font-medium">
                          {[store.street, store.barangay].filter(Boolean).join(', ') || '—'}
                        </div>
                        <div style={{ color: "var(--text-muted)" }} className="text-[10px] truncate">
                          {[store.cityMunicipality, store.province].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span style={{ color: "var(--text-primary)" }} className="font-semibold">
                          {liveStatus.text}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div style={{ color: "var(--text-primary)" }}>{store.phone || store.mobile || '—'}</div>
                        <div style={{ color: "var(--text-muted)" }} className="text-[10px]">{store.email || ''}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-sky-500">
                          {store.serviceRadiusKm} km
                        </span>
                        <div style={{ color: "var(--text-muted)" }} className="text-[10px]">
                          {store.assignedTechnicianCount} techs
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(store.status)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewOnMap(store)}
                            title="View on Map"
                            className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Compass className="w-4 h-4" />
                          </button>
                          {isAdmin && !store.isMainBranch && (
                            <button
                              onClick={() => handleSetMainBranch(store)}
                              title="Set as Main Branch"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEdit(store)}
                              title="Edit Branch"
                              className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteClick(store)}
                              title="Delete Branch"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </div>
      )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT STORE MODAL WITH EMBEDDED MAP PICKER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStoreId ? 'Edit Store Branch' : 'Register New Store Branch'}
        subtitle="Configure physical workshop location, service radius, operating hours, and dispatch personnel."
        maxWidth="sm:max-w-[780px]"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-400 hidden sm:block">
              {activeFormTab === 'location' && 'Drag the blue pin or search address to locate hub.'}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="storeForm"
                disabled={formSubmitting}
                className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {formSubmitting ? 'Saving...' : editingStoreId ? 'Update Branch' : 'Register Branch'}
              </button>
            </div>
          </div>
        }
      >
        {/* Modal Form Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-4 border border-slate-200 dark:border-slate-700/60 overflow-x-auto shrink-0">
          {[
            { id: 'basic', label: '1. Basic Info', icon: Store },
            { id: 'location', label: '2. Location & Map', icon: MapPin },
            { id: 'operations', label: '3. Contact & Staff', icon: Users },
            { id: 'hours', label: '4. Opening Hours', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFormTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFormTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-sky-500 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form id="storeForm" onSubmit={handleSubmitStore} className="space-y-4">
          {/* TAB 1: BASIC INFO */}
          {activeFormTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AeroFlow Olongapo Main Branch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Code (Unique) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OLG-01, MNL-01"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Open">Open</option>
                    <option value="Temporarily closed">Temporarily Closed</option>
                    <option value="Closed permanently">Closed Permanently</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registered Business Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AeroFlow HVAC Services Inc."
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Permit / Registration Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DTI-2024-00192 / SEC-CS2023"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, registrationNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isMainBranch}
                      onChange={(e) =>
                        setFormData({ ...formData, isMainBranch: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Designate as Main Branch (HQ)
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Only one branch can be the main branch. Setting this replaces previous HQ.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCATION & MAP PICKER */}
          {activeFormTab === 'location' && (
            <div className="space-y-4 animate-fade-in">
              {/* Search address bar and GPS locator */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Philippine address (e.g. Magsaysay Ave, Olongapo)..."
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNominatimSearch(e);
                      }
                    }}
                    className="w-full pl-9 pr-20 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleNominatimSearch}
                    disabled={pickerSearching}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
                  >
                    {pickerSearching ? '...' : 'Search'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleUseCurrentGps}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                >
                  <Crosshair className="w-3.5 h-3.5 text-sky-500" />
                  <span>My GPS</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              {pickerResults.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-0.5">
                    Search Results (Click to pin)
                  </div>
                  {pickerResults.map((r) => (
                    <button
                      key={r.id || r.displayName}
                      type="button"
                      onClick={() => handleSelectSearchResult(r)}
                      className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-sky-500/10 hover:text-sky-500 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                      <span className="truncate">{r.displayName}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Map Container */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 h-[260px] bg-slate-950">
                <div ref={mapContainerRef} className="w-full h-full" />
                {pickerResolving && (
                  <div className="absolute top-3 left-3 z-[1000] bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    <span>Resolving address from coordinates...</span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 z-[1000] bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-300">
                  {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </div>
              </div>

              {/* Coordinate & Address Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Latitude (PH Bounds: 4.0 - 22.0) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({ ...formData, latitude: val });
                      updateMapPosition(val, formData.longitude);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Longitude (PH Bounds: 115.0 - 128.0) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({ ...formData, longitude: val });
                      updateMapPosition(formData.latitude, val);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Street / Building / Unit No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Unit 4B, Rizal Avenue"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Barangay
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. West Bajac-Bajac"
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City / Municipality
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Olongapo City"
                    value={formData.cityMunicipality}
                    onChange={(e) =>
                      setFormData({ ...formData, cityMunicipality: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Province
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Zambales"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Landmark / Directions Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Beside Petron gas station, directly across from city mall"
                    value={formData.landmarkNotes}
                    onChange={(e) => setFormData({ ...formData, landmarkNotes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT & OPERATIONS */}
          {activeFormTab === 'operations' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Landline Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. (047) 222-1234"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0917 123 4567"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. branch.olongapo@aeroflow.ph"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Website or Facebook Page
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. https://facebook.com/aeroflow.hub"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service Area Radius (Kilometers)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.serviceRadiusKm}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceRadiusKm: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Manager
                  </label>
                  <select
                    value={formData.managerId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        managerId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">No Manager Assigned</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.fullName || u.username} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Services Offered at this Branch
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STANDARD_SERVICES.map((srv) => {
                      const isChecked = formData.servicesOffered.includes(srv);
                      return (
                        <label
                          key={srv}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...formData.servicesOffered, srv]
                                : formData.servicesOffered.filter((s) => s !== srv);
                              setFormData({ ...formData, servicesOffered: next });
                            }}
                            className="w-3.5 h-3.5 rounded text-sky-500 focus:ring-sky-400"
                          />
                          <span>{srv}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Assigned Technicians Multi-Select */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assigned Field Technicians ({formData.assignedTechnicians.length} selected)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {technicians.length === 0 ? (
                      <div className="text-[11px] text-slate-400 p-2 col-span-full">
                        No technician accounts found. Register technicians in User Admin.
                      </div>
                    ) : (
                      technicians.map((t) => {
                        const isAssigned = formData.assignedTechnicians.includes(t.userId);
                        return (
                          <label
                            key={t.userId}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              isAssigned
                                ? 'bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/40'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.assignedTechnicians, t.userId]
                                  : formData.assignedTechnicians.filter((id) => id !== t.userId);
                                setFormData({ ...formData, assignedTechnicians: next });
                              }}
                              className="w-3.5 h-3.5 rounded text-sky-500 focus:ring-sky-400"
                            />
                            <span className="truncate">{t.fullName || t.username}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.acceptsWalkIns}
                      onChange={(e) =>
                        setFormData({ ...formData, acceptsWalkIns: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                        Accepts Walk-in Customers
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Direct service booking & spare parts sales over the counter.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPENING HOURS */}
          {activeFormTab === 'hours' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Set standard operating schedule per day (Asia/Manila time):
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, openingHours: INITIAL_HOURS })}
                  className="text-xs font-semibold text-sky-500 hover:text-sky-400"
                >
                  Reset to Standard Preset
                </button>
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50 dark:bg-slate-900/60">
                {DEFAULT_DAYS.map((day) => {
                  const dayObj = formData.openingHours?.[day] || {
                    open: '08:00',
                    close: '17:00',
                    closed: false,
                  };
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <div className="w-28 font-bold text-slate-800 dark:text-slate-200">
                        {DAY_LABELS[day]}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!dayObj.closed}
                            onChange={(e) => {
                              const updated = {
                                ...formData.openingHours,
                                [day]: { ...dayObj, closed: !e.target.checked },
                              };
                              setFormData({ ...formData, openingHours: updated });
                            }}
                            className="w-3.5 h-3.5 rounded text-sky-500"
                          />
                          <span className="text-[11px] text-slate-600 dark:text-slate-300">
                            {dayObj.closed ? 'Closed' : 'Open'}
                          </span>
                        </label>

                        {!dayObj.closed && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={dayObj.open || '08:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...formData.openingHours,
                                  [day]: { ...dayObj, open: e.target.value },
                                };
                                setFormData({ ...formData, openingHours: updated });
                              }}
                              className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                              type="time"
                              value={dayObj.close || '17:00'}
                              onChange={(e) => {
                                const updated = {
                                  ...formData.openingHours,
                                  [day]: { ...dayObj, close: e.target.value },
                                };
                                setFormData({ ...formData, openingHours: updated });
                              }}
                              className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Holiday / Special Hours Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Closed on Christmas Day and Good Friday"
                  value={formData.openingHours?.holidayNote || ''}
                  onChange={(e) => {
                    const updated = {
                      ...formData.openingHours,
                      holidayNote: e.target.value,
                    };
                    setFormData({ ...formData, openingHours: updated });
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* DIRECT DELETE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDirectDelete}
        title="Delete Store Branch"
        message={`Are you sure you want to permanently delete "${deletingStore?.name}" (${deletingStore?.code})? This action cannot be reversed.`}
        confirmLabel="Delete Branch"
        danger
      />

      {/* ========================================================================= */}
      {/* REASSIGNMENT & DELETE DIALOG (WHEN BLOCKED BY LINKED ENTITIES) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title="Reassign Dependencies & Delete"
        subtitle="This store branch has active assignments that must be migrated before deletion."
        maxWidth="sm:max-w-[560px]"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsReassignModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reassignForm"
              disabled={reassignSubmitting || !reassignTargetId}
              className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-md shadow-red-500/20 transition-all disabled:opacity-50"
            >
              {reassignSubmitting ? 'Reassigning...' : 'Reassign & Delete'}
            </button>
          </div>
        }
      >
        <form id="reassignForm" onSubmit={handleConfirmReassignDelete} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block">
                Cannot delete &ldquo;{deletingStore?.name}&rdquo; directly:
              </span>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                <li>{deleteCheckResult?.assignedTechnicianCount || 0} assigned technician(s)</li>
                <li>{deleteCheckResult?.assignedCustomerCount || 0} customer(s) linked to this hub</li>
                <li>{deleteCheckResult?.activeRequestCount || 0} active service request(s)</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Destination Branch for Reassignment <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={reassignTargetId}
              onChange={(e) => setReassignTargetId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select Target Branch...</option>
              {stores
                .filter((s) => s.storeId !== deletingStore?.storeId)
                .map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.name} ({s.code}) {s.isMainBranch ? '— [Main Branch]' : ''}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">
              All linked customers, active jobs, and technicians will be safely reassigned to the selected branch before this store is removed.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
