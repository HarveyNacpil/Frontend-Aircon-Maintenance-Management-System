import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Search, 
  Calendar, 
  Phone, 
  Mail, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  Route, 
  X, 
  Crosshair, 
  Car,
  AlertCircle,
  Store,
  Building2,
  Star,
  Clock,
  Radio,
  Eye,
  CheckSquare,
  Square,
  Navigation,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Users,
  Shield,
  Info
} from 'lucide-react';
import { customersApi, airconApi, storesApi, usersApi, formatDate, normalizeCustomerMapItem } from '../services/api';
import { osmService, osmTileLayers } from '../services/osmService';
import { geocodingService } from '../services/geocodingService';
import { getStoreLiveStatus } from './StoresPage';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

// Helper to compute straight-line distance in kilometers
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function CustomerMapPage({ setActiveTab: _setActiveTab }) {
  const { success, error: toastError, warning } = useToast();

  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unitCountFilter, setUnitCountFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  // Selected Route Origin Store (persisted in localStorage)
  const [selectedOriginStoreId, setSelectedOriginStoreId] = useState(() => {
    return localStorage.getItem('aeroflow_selected_origin_store') || '';
  });

  // Service Area Circles Visibility
  const [showServiceAreas, setShowServiceAreas] = useState(true);

  // Selections
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedStoreModal, setSelectedStoreModal] = useState(null);
  const [geocodingId, setGeocodingId] = useState(null);

  // Multi-Stop Selection
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [multiStopRoute, setMultiStopRoute] = useState(null);

  // OpenStreetMap Layer state
  const [currentLayerKey, setCurrentLayerKey] = useState('standard');
  const [showLayerPicker, setShowLayerPicker] = useState(false);

  // User GPS and Route state
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [showRouteSteps, setShowRouteSteps] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);

  // Map references
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const customerMarkersRef = useRef(new Map());
  const storeMarkersRef = useRef(new Map());
  const radiusCirclesRef = useRef(new Map());
  const routeLayerRef = useRef(null);
  const multiStopMarkerLayersRef = useRef([]);
  const userMarkerRef = useRef(null);

  // Expose callbacks to global window for Leaflet popup buttons
  useEffect(() => {
    window.aeroflowMapActions = {
      selectStoreOrigin: (id) => {
        handleSetOriginStore(id);
      },
      viewStoreDetails: (id) => {
        const found = stores.find((s) => String(s.storeId) === String(id));
        if (found) setSelectedStoreModal(found);
      },
      routeToCustomer: (custId) => {
        const found = customers.find((c) => String(c.customerId) === String(custId));
        if (found) handleCalculateRoute(found);
      },
    };
    return () => {
      delete window.aeroflowMapActions;
    };
  });

  // Load customer map locations, customers, stores, and users
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [allCustRes, mapLocRes, airconRes, storesRes, usersRes] = await Promise.all([
        customersApi.getAll(),
        customersApi.getMapLocations().catch((err) => {
          console.warn('Could not query map-locations endpoint:', err);
          return [];
        }),
        airconApi.getAll().catch(() => []),
        storesApi.getAll().catch(() => []),
        usersApi.getAll().catch(() => []),
      ]);

      const mapLocMap = new Map();
      if (Array.isArray(mapLocRes)) {
        mapLocRes.forEach((m) => {
          const norm = normalizeCustomerMapItem(m);
          mapLocMap.set(norm.customerId, norm);
        });
      }

      const allCustomers = (Array.isArray(allCustRes) ? allCustRes : []).map((c) => {
        const custId = c.customerId ?? c.customer_id;
        const fromMap = mapLocMap.get(custId);
        const unitsForCust = (Array.isArray(airconRes) ? airconRes : []).filter(
          (u) => (u.customerId || u.customer_id) === custId
        );

        const airconUnits = fromMap?.airconUnits?.length ? fromMap.airconUnits : unitsForCust;
        const airconCount = airconUnits.length;

        const latitude = (fromMap?.latitude != null && !isNaN(fromMap.latitude))
          ? fromMap.latitude
          : ((c.latitude != null && !isNaN(Number(c.latitude))) ? Number(c.latitude) : null);

        const longitude = (fromMap?.longitude != null && !isNaN(fromMap.longitude))
          ? fromMap.longitude
          : ((c.longitude != null && !isNaN(Number(c.longitude))) ? Number(c.longitude) : null);

        return normalizeCustomerMapItem({
          ...c,
          ...(fromMap || {}),
          customerId: custId,
          latitude,
          longitude,
          airconUnits,
          airconCount,
          upcomingMaintenance: fromMap?.upcomingMaintenance || null,
        });
      });

      const storesList = Array.isArray(storesRes) ? storesRes : [];
      setCustomers(allCustomers);
      setStores(storesList);
      setUsers(Array.isArray(usersRes) ? usersRes : []);

      // If no origin store selected or stored one is invalid, default to Main Branch
      if (storesList.length > 0) {
        const existingStored = localStorage.getItem('aeroflow_selected_origin_store');
        const match = storesList.find((s) => String(s.storeId) === existingStored);
        if (match) {
          setSelectedOriginStoreId(String(match.storeId));
        } else {
          const mainBranch = storesList.find((s) => s.isMainBranch) || storesList[0];
          setSelectedOriginStoreId(String(mainBranch.storeId));
          localStorage.setItem('aeroflow_selected_origin_store', String(mainBranch.storeId));
        }
      }

      // Check if user came from StoresPage wanting to focus on a particular store
      const focusStoreId = sessionStorage.getItem('aeroflow_map_focus_store');
      if (focusStoreId) {
        sessionStorage.removeItem('aeroflow_map_focus_store');
        setSelectedOriginStoreId(focusStoreId);
        localStorage.setItem('aeroflow_selected_origin_store', focusStoreId);
        setTimeout(() => {
          const targetStore = storesList.find((s) => String(s.storeId) === focusStoreId);
          if (targetStore && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([targetStore.latitude, targetStore.longitude], 15, { duration: 1.2 });
            const m = storeMarkersRef.current.get(targetStore.storeId);
            if (m) setTimeout(() => m.openPopup(), 1200);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Failed to load customer map data:', err);
      setError(err.message || 'Failed to load customer map data. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetOriginStore = (storeId) => {
    setSelectedOriginStoreId(String(storeId));
    localStorage.setItem('aeroflow_selected_origin_store', String(storeId));
    const targetStore = stores.find((s) => String(s.storeId) === String(storeId));
    if (targetStore) {
      success(`Route origin set to "${targetStore.name}".`);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([targetStore.latitude, targetStore.longitude]);
      }
    }
  };

  // Find currently selected origin store object
  const currentOriginStore = useMemo(() => {
    if (!selectedOriginStoreId) return stores.find((s) => s.isMainBranch) || stores[0] || null;
    return stores.find((s) => String(s.storeId) === String(selectedOriginStoreId)) || stores[0] || null;
  }, [stores, selectedOriginStoreId]);

  // Compute nearest store and coverage details for each customer
  const customersWithProximity = useMemo(() => {
    return customers.map((c) => {
      if (c.latitude == null || c.longitude == null || stores.length === 0) {
        return {
          ...c,
          nearestStore: null,
          distanceToNearestKm: null,
          isInsideServiceArea: null,
        };
      }

      let closest = null;
      let minDistance = Infinity;

      stores.forEach((store) => {
        if (!store.latitude || !store.longitude) return;
        const d = getHaversineDistanceKm(c.latitude, c.longitude, store.latitude, store.longitude);
        if (d !== null && d < minDistance) {
          minDistance = d;
          closest = store;
        }
      });

      const radius = closest?.serviceRadiusKm || 15;
      const isInside = minDistance <= radius;

      return {
        ...c,
        nearestStore: closest,
        distanceToNearestKm: minDistance === Infinity ? null : minDistance,
        isInsideServiceArea: isInside,
        excessDistanceKm: isInside ? 0 : Number((minDistance - radius).toFixed(1)),
      };
    });
  }, [customers, stores]);

  // Extract unique cities
  const availableCities = useMemo(() => {
    return Array.from(new Set(customers.map((c) => c.cityName).filter(Boolean))).sort();
  }, [customers]);

  // Filter customers based on filters
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customersWithProximity.filter((c) => {
      const fullName = `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.toLowerCase();
      const addr = (c.address || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const hasAirconMatch = c.airconUnits?.some((u) =>
        u.brand.toLowerCase().includes(q) ||
        u.model.toLowerCase().includes(q) ||
        (u.serialNumber && u.serialNumber.toLowerCase().includes(q))
      );

      const matchesSearch = !q || fullName.includes(q) || addr.includes(q) || phone.includes(q) || hasAirconMatch;
      const matchesStatus = statusFilter === 'ALL' || c.airconUnits?.some((u) => (u.status || '').toLowerCase() === statusFilter.toLowerCase());
      const matchesUnitCount =
        unitCountFilter === 'ALL' ? true :
        unitCountFilter === '0' ? c.airconCount === 0 :
        unitCountFilter === '1' ? c.airconCount === 1 :
        unitCountFilter === '2' ? c.airconCount === 2 :
        c.airconCount >= 3;

      const matchesCity = cityFilter === 'ALL' || (c.cityName && c.cityName.toLowerCase() === cityFilter.toLowerCase());
      const matchesStore = storeFilter === 'ALL' || (c.nearestStore && String(c.nearestStore.storeId) === String(storeFilter));

      return matchesSearch && matchesStatus && matchesUnitCount && matchesCity && matchesStore;
    });
  }, [customersWithProximity, searchQuery, statusFilter, unitCountFilter, cityFilter, storeFilter]);

  // Customers with valid coordinates
  const mappedCustomers = useMemo(() => {
    return filteredCustomers.filter(
      (c) => c.latitude !== null && c.longitude !== null && !isNaN(c.latitude) && !isNaN(c.longitude)
    );
  }, [filteredCustomers]);

  // Fleet units counter
  const totalFleetOnMap = useMemo(() => {
    return mappedCustomers.reduce((sum, c) => sum + (c.airconCount || 0), 0);
  }, [mappedCustomers]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      customerMarkersRef.current.clear();
      storeMarkersRef.current.clear();
      radiusCirclesRef.current.clear();
      routeLayerRef.current = null;
      userMarkerRef.current = null;
    }

    const defaultCenter = currentOriginStore
      ? [currentOriginStore.latitude, currentOriginStore.longitude]
      : [14.8344, 120.2828];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const layerConfig = osmTileLayers[currentLayerKey] || osmTileLayers.standard;
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom || 19,
      subdomains: layerConfig.subdomains || 'abc',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    renderStoresAndCircles(map, stores, showServiceAreas);
    renderCustomerMarkers(map, mappedCustomers);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Leaflet: invalidate map size cleanly once on transitionend, never per frame
  useEffect(() => {
    const handleTransitionEnd = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
      }
    };
    window.addEventListener("sidebarTransitionEnd", handleTransitionEnd);
    return () => window.removeEventListener("sidebarTransitionEnd", handleTransitionEnd);
  }, []);

  // Switch Tile Layer
  const switchTileLayer = (layerKey) => {
    if (!mapInstanceRef.current || !osmTileLayers[layerKey]) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const layerConfig = osmTileLayers[layerKey];
    const newLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom || 19,
      subdomains: layerConfig.subdomains || 'abc',
    }).addTo(map);

    tileLayerRef.current = newLayer;
    setCurrentLayerKey(layerKey);
    setShowLayerPicker(false);
  };

  // Re-render markers when customer or store lists change
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderStoresAndCircles(mapInstanceRef.current, stores, showServiceAreas);
      renderCustomerMarkers(mapInstanceRef.current, mappedCustomers);
    }
  }, [mappedCustomers, stores, showServiceAreas]);

  // Render Stores and Service Area Radius Circles
  function renderStoresAndCircles(map, storeList, displayCircles) {
    if (!map) return;

    // Clean up existing store markers & circles
    storeMarkersRef.current.forEach((m) => m.remove());
    storeMarkersRef.current.clear();
    radiusCirclesRef.current.forEach((c) => c.remove());
    radiusCirclesRef.current.clear();

    storeList.forEach((st) => {
      if (!st.latitude || !st.longitude) return;

      const isMain = Boolean(st.isMainBranch);
      const isClosed = st.status === 'Closed permanently' || st.status === 'Temporarily closed';
      const liveStatus = getStoreLiveStatus(st.openingHours);

      // Distinct Store Pin Icon
      const storeDivIcon = L.divIcon({
        className: 'osm-store-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isMain ? 42 : 36}px;
            height: ${isMain ? 42 : 36}px;
            border-radius: 12px;
            background: ${
              isClosed
                ? '#475569'
                : isMain
                ? 'linear-gradient(135deg, #0284c7, #4f46e5)'
                : 'linear-gradient(135deg, #0284c7, #0369a1)'
            };
            border: 2.5px solid white;
            box-shadow: 0 4px 16px rgba(0,0,0,0.45);
            cursor: pointer;
            z-index: 1000;
          ">
            ${
              isMain && !isClosed
                ? '<div style="position: absolute; inset: -5px; border-radius: 17px; border: 2px solid #38bdf8; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.65;"></div>'
                : ''
            }
            <div style="font-size: ${isMain ? 20 : 17}px;">🏢</div>
          </div>
        `,
        iconSize: [isMain ? 42 : 36, isMain ? 42 : 36],
        iconAnchor: [isMain ? 21 : 18, isMain ? 21 : 18],
        popupAnchor: [0, isMain ? -24 : -20],
      });

      const marker = L.marker([st.latitude, st.longitude], {
        icon: storeDivIcon,
        zIndexOffset: 1000, // Always above customer markers
      }).addTo(map);

      // Store Popup Content
      const popupHtml = createStorePopupHtml(st, liveStatus);
      marker.bindPopup(popupHtml, { maxWidth: 320, className: 'aeroflow-popup' });

      storeMarkersRef.current.set(st.storeId, marker);

      // Service Area Radius Circle
      if (displayCircles) {
        const radiusMeters = (Number(st.serviceRadiusKm) || 15) * 1000;
        const circle = L.circle([st.latitude, st.longitude], {
          radius: radiusMeters,
          color: isMain ? '#0284c7' : '#6366f1',
          fillColor: isMain ? '#38bdf8' : '#818cf8',
          fillOpacity: 0.08,
          weight: 2,
          dashArray: isMain ? undefined : '5, 6',
        }).addTo(map);

        radiusCirclesRef.current.set(st.storeId, circle);
      }
    });
  }

  function createStorePopupHtml(st, liveStatus) {
    const isMain = Boolean(st.isMainBranch);
    const services = (
      Array.isArray(st.servicesOffered)
        ? st.servicesOffered
        : (() => {
            try {
              return JSON.parse(st.servicesOffered || '[]');
            } catch {
              return [];
            }
          })()
    ).slice(0, 3);

    return `
      <div style="font-family: inherit; padding: 4px; min-width: 260px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div style="font-weight:800; font-size:14px; color:#0f172a; display:flex; align-items:center; gap:4px;">
            <span>${st.name}</span>
          </div>
          ${
            isMain
              ? '<span style="font-size:9px; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:800;">HQ MAIN</span>'
              : `<span style="font-size:9px; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:700;">${st.code}</span>`
          }
        </div>

        <div style="font-size:11px; color:#64748b; margin-bottom:4px;">
          ${[st.street, st.barangay, st.cityMunicipality].filter(Boolean).join(', ') || 'Address on file'}
        </div>

        <div style="margin-bottom:8px; font-size:11px; padding:4px 8px; border-radius:6px; background:${liveStatus.badgeColor === 'green' ? '#ecfdf5' : '#fffbeb'}; color:${liveStatus.badgeColor === 'green' ? '#047857' : '#b45309'}; font-weight:600; display:flex; align-items:center; gap:6px;">
          <span style="width:7px; height:7px; border-radius:50%; background:${liveStatus.badgeColor === 'green' ? '#10b981' : '#f59e0b'};"></span>
          <span>${liveStatus.text}</span>
        </div>

        ${
          st.phone || st.mobile
            ? `<div style="font-size:11px; color:#334155; margin-bottom:6px;">
                <strong>📞</strong> <a href="tel:${st.phone || st.mobile}" style="color:#0284c7; text-decoration:none; font-weight:600;">${st.phone || st.mobile}</a>
              </div>`
            : ''
        }

        <div style="font-size:10px; color:#0284c7; font-weight:700; margin-bottom:6px;">
          Coverage: ${st.serviceRadiusKm} km radius • ${st.assignedTechnicianCount || 0} Technicians
        </div>

        ${
          services.length > 0
            ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">
                ${services.map((s) => `<span style="font-size:9px; background:#f0f9ff; color:#0369a1; padding:2px 6px; border-radius:4px;">${s}</span>`).join('')}
              </div>`
            : ''
        }

        <div style="display:flex; gap:6px; pt:4px;">
          <button
            onclick="window.aeroflowMapActions.selectStoreOrigin(${st.storeId})"
            style="flex:1; background:#0284c7; color:white; border:none; padding:6px 8px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;"
          >
            Route From Here
          </button>
          <button
            onclick="window.aeroflowMapActions.viewStoreDetails(${st.storeId})"
            style="background:#f1f5f9; color:#334155; border:none; padding:6px 8px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"
          >
            Details
          </button>
        </div>
      </div>
    `;
  }

  // Render Customer Markers
  function renderCustomerMarkers(map, custList) {
    if (!map) return;

    customerMarkersRef.current.forEach((m) => m.remove());
    customerMarkersRef.current.clear();

    if (custList.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Also include stores in initial bounds
    stores.forEach((s) => {
      if (s.latitude && s.longitude) bounds.extend([s.latitude, s.longitude]);
    });

    custList.forEach((cust) => {
      const lat = cust.latitude;
      const lng = cust.longitude;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      bounds.extend([lat, lng]);

      const hasUnderRepair = cust.airconUnits?.some((u) => u.status === 'Under Repair');
      const isOutsideRadius = cust.isInsideServiceArea === false;
      const markerColor = hasUnderRepair ? '#f59e0b' : isOutsideRadius ? '#dc2626' : '#0284c7';

      const customIcon = L.divIcon({
        className: 'osm-customer-marker',
        html: `
          <div style="
            background: ${markerColor};
            color: white;
            font-weight: 800;
            font-size: 11px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            cursor: pointer;
            transition: transform 0.2s;
          " class="hover:scale-110">
            ${cust.airconCount}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      const popupContent = createCustomerPopupHtml(cust);
      marker.bindPopup(popupContent, { maxWidth: 320, className: 'aeroflow-popup' });

      marker.on('click', () => {
        setSelectedCustomerId(cust.customerId);
      });

      customerMarkersRef.current.set(cust.customerId, marker);
    });

    if (custList.length === 1 && custList[0].latitude && custList[0].longitude) {
      map.setView([custList[0].latitude, custList[0].longitude], 14);
    } else if (custList.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  function createCustomerPopupHtml(cust) {
    const fullName = `${cust.firstName} ${cust.lastName}`.trim();
    const unitsList = (cust.airconUnits || []).map((u) => `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:4px 0; border-bottom:1px solid #f1f5f9;">
        <div>
          <strong>${u.brand} ${u.model}</strong> (${u.horsepower} HP)
          <div style="color:#64748b; font-size:10px;">SN: ${u.serialNumber || 'N/A'}</div>
        </div>
        <span style="font-weight:700; color:${u.status === 'Active' ? '#10b981' : u.status === 'Under Repair' ? '#f59e0b' : '#94a3b8'};">
          ${u.status}
        </span>
      </div>
    `).join('');

    const originStore = currentOriginStore;
    const distanceToOrigin = originStore && cust.latitude && cust.longitude
      ? getHaversineDistanceKm(originStore.latitude, originStore.longitude, cust.latitude, cust.longitude)
      : null;

    const nearestInfo = cust.nearestStore ? `
      <div style="margin-top:6px; padding:4px 8px; border-radius:6px; background:#f8fafc; font-size:10px; color:#475569; display:flex; justify-content:space-between;">
        <span>Nearest Base: <strong>${cust.nearestStore.name}</strong></span>
        <span><strong>${cust.distanceToNearestKm} km</strong></span>
      </div>
    ` : '';

    const warningOutside = cust.isInsideServiceArea === false ? `
      <div style="margin-top:4px; padding:4px 8px; border-radius:6px; background:#fef2f2; font-size:10px; color:#b91c1c; font-weight:600;">
        ⚠️ Outside standard coverage (+${cust.excessDistanceKm} km beyond ${cust.nearestStore?.serviceRadiusKm} km radius)
      </div>
    ` : '';

    return `
      <div style="font-family: inherit; padding: 4px; min-width: 260px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div style="font-weight:800; font-size:14px; color:#0f172a;">${fullName}</div>
          <span style="font-size:9px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700;">Client</span>
        </div>
        <div style="font-size:11px; color:#64748b; margin-bottom:4px;">${cust.address || 'Address not specified'}</div>
        <div style="font-size:11px; color:#334155; margin-bottom:6px;">
          <strong>📞</strong> <a href="tel:${cust.phone || ''}" style="color:#0284c7; text-decoration:none;">${cust.phone || 'No phone'}</a>
        </div>
        ${nearestInfo}
        ${warningOutside}
        <div style="font-size:11px; font-weight:700; color:#0284c7; margin-top:6px; margin-bottom:4px;">
          ${cust.airconCount} Aircon ${cust.airconCount === 1 ? 'Unit' : 'Units'} Linked:
        </div>
        <div style="max-height:100px; overflow-y:auto; margin-bottom:8px;">
          ${unitsList.length > 0 ? unitsList : '<div style="font-size:10px; color:#94a3b8; font-style:italic;">No units registered</div>'}
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button
            onclick="window.aeroflowMapActions.routeToCustomer(${cust.customerId})"
            style="flex:1; background:#0284c7; color:white; border:none; padding:6px 8px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;"
          >
            Route From ${originStore ? originStore.name.slice(0, 16) + '...' : 'Store'}
          </button>
        </div>
      </div>
    `;
  }

  // Geocode an unmapped customer address via Nominatim
  const handleGeocodeCustomer = async (cust) => {
    try {
      setGeocodingId(cust.customerId);
      const res = await geocodingService.geocodeAddress({
        streetAddress: cust.streetAddress || cust.address,
        barangayName: cust.barangayName,
        cityName: cust.cityName,
        provinceName: cust.provinceName,
      });

      if (res && res.latitude && res.longitude) {
        await customersApi.updateCoordinates(cust.customerId, res.latitude, res.longitude);
        success(`Mapped ${cust.firstName} ${cust.lastName} (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)})`);
        await loadData();
      } else {
        warning(`Could not automatically find GPS coordinates for ${cust.firstName} ${cust.lastName}. Please update their address on the Customers page.`);
      }
    } catch (err) {
      console.error('Geocode error:', err);
      toastError(err.message || 'Geocoding request failed. Please check internet connection.');
    } finally {
      setGeocodingId(null);
    }
  };

  // Get current device GPS location
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      warning('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { latitude, longitude };
        setUserLocation(coords);
        setLocatingUser(false);

        const map = mapInstanceRef.current;
        if (map) {
          if (userMarkerRef.current) userMarkerRef.current.remove();

          const userIcon = L.divIcon({
            className: 'osm-user-location-marker',
            html: `
              <div style="position: relative; width: 24px; height: 24px;">
                <div style="position: absolute; inset: 0; border-radius: 50%; background: #0284c7; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                <div style="position: relative; width: 20px; height: 20px; margin: 2px; background: #0284c7; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const uMarker = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(map)
            .bindPopup('<strong>📍 Your Location (Device GPS)</strong>');
          userMarkerRef.current = uMarker;

          map.flyTo([latitude, longitude], 15, { duration: 1.2 });
        }
      },
      (err) => {
        setLocatingUser(false);
        toastError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Compute Single Driving Route from Selected Store Origin to Customer
  const handleCalculateRoute = async (cust) => {
    if (!cust.latitude || !cust.longitude) return;

    const originStore = currentOriginStore;
    if (!originStore?.latitude || !originStore?.longitude) {
      toastError('Please select a valid origin store branch first.');
      return;
    }

    const origin = { latitude: originStore.latitude, longitude: originStore.longitude };
    const destination = { latitude: cust.latitude, longitude: cust.longitude };
    const straightLineKm = getHaversineDistanceKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

    try {
      setRoutingLoading(true);
      const routeData = await osmService.getRoute(origin, destination);

      const map = mapInstanceRef.current;
      if (map) {
        if (routeLayerRef.current) routeLayerRef.current.remove();

        if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
          const polyline = L.polyline(routeData.coordinates, {
            color: '#0284c7',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
          }).addTo(map);

          routeLayerRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

          setActiveRoute({
            originName: originStore.name,
            customerName: `${cust.firstName} ${cust.lastName}`,
            distanceKm: routeData.distanceKm,
            durationMinutes: routeData.durationMinutes,
            straightLineKm,
            steps: routeData.steps || [],
            destination: cust,
            isFallback: false,
          });
        } else {
          // Graceful fallback to dashed straight line if OSRM unavailable
          const straightCoords = [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ];
          const fallbackPolyline = L.polyline(straightCoords, {
            color: '#0284c7',
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.8,
          }).addTo(map);

          routeLayerRef.current = fallbackPolyline;
          map.fitBounds(fallbackPolyline.getBounds(), { padding: [60, 60] });

          setActiveRoute({
            originName: originStore.name,
            customerName: `${cust.firstName} ${cust.lastName}`,
            distanceKm: straightLineKm,
            durationMinutes: Math.round(straightLineKm * 2), // approx 30km/h
            straightLineKm,
            steps: [],
            destination: cust,
            isFallback: true,
          });
          warning('Routing service unavailable. Displaying direct vector route.');
        }
      }
    } catch (err) {
      console.warn('OSRM routing failed:', err);
      toastError('Routing service error.');
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleClearRoute = () => {
    if (routeLayerRef.current && mapInstanceRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    multiStopMarkerLayersRef.current.forEach((m) => m.remove());
    multiStopMarkerLayersRef.current = [];
    setActiveRoute(null);
    setMultiStopRoute(null);
  };

  // Multi-Stop Route Optimization & Generation
  const handleToggleCustomerSelect = (custId) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(custId)) next.delete(custId);
      else next.add(custId);
      return next;
    });
  };

  const handleSelectAllMapped = () => {
    if (selectedCustomerIds.size === mappedCustomers.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(mappedCustomers.map((c) => c.customerId)));
    }
  };

  const handleGenerateMultiStopRoute = async () => {
    if (selectedCustomerIds.size === 0) {
      warning('Please select at least 1 mapped customer for dispatch.');
      return;
    }

    const originStore = currentOriginStore;
    if (!originStore) {
      toastError('No origin store branch selected.');
      return;
    }

    const selectedCusts = mappedCustomers.filter((c) => selectedCustomerIds.has(c.customerId));
    if (selectedCusts.length === 0) return;

    try {
      setRoutingLoading(true);

      // Order customers using Greedy Nearest-Neighbor from store
      let currentPoint = { latitude: originStore.latitude, longitude: originStore.longitude };
      const unvisited = [...selectedCusts];
      const orderedCusts = [];

      while (unvisited.length > 0) {
        let bestIdx = 0;
        let minD = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
          const d = getHaversineDistanceKm(
            currentPoint.latitude,
            currentPoint.longitude,
            unvisited[i].latitude,
            unvisited[i].longitude
          );
          if (d < minD) {
            minD = d;
            bestIdx = i;
          }
        }
        const [nextCust] = unvisited.splice(bestIdx, 1);
        orderedCusts.push(nextCust);
        currentPoint = { latitude: nextCust.latitude, longitude: nextCust.longitude };
      }

      // Prepare waypoints array starting at Store
      const waypoints = [
        { latitude: originStore.latitude, longitude: originStore.longitude, name: originStore.name },
        ...orderedCusts.map((c) => ({
          latitude: c.latitude,
          longitude: c.longitude,
          name: `${c.firstName} ${c.lastName}`,
          customer: c,
        })),
      ];

      const multiRouteData = await osmService.getMultiStopRoute(waypoints);

      const map = mapInstanceRef.current;
      if (map) {
        handleClearRoute();

        // Render stop number badges on map
        const newStopMarkers = [];
        orderedCusts.forEach((c, idx) => {
          const stopNumber = idx + 1;
          const stopIcon = L.divIcon({
            className: 'osm-stop-number-marker',
            html: `
              <div style="
                background: #4f46e5;
                color: white;
                font-weight: 800;
                font-size: 11px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 4px 10px rgba(79, 70, 229, 0.5);
              ">
                #${stopNumber}
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const sm = L.marker([c.latitude, c.longitude], { icon: stopIcon, zIndexOffset: 800 }).addTo(map);
          newStopMarkers.push(sm);
        });
        multiStopMarkerLayersRef.current = newStopMarkers;

        if (multiRouteData && multiRouteData.coordinates) {
          const polyline = L.polyline(multiRouteData.coordinates, {
            color: '#4f46e5',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
          }).addTo(map);

          routeLayerRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

          setMultiStopRoute({
            originName: originStore.name,
            totalDistanceKm: multiRouteData.totalDistanceKm,
            totalDurationMinutes: multiRouteData.totalDurationMinutes,
            orderedCustomers: orderedCusts,
            legs: multiRouteData.legs || [],
            isFallback: false,
          });
        } else {
          // Fallback straight lines connecting sequential points
          const straightCoords = waypoints.map((w) => [w.latitude, w.longitude]);
          const polyline = L.polyline(straightCoords, {
            color: '#4f46e5',
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.85,
          }).addTo(map);

          routeLayerRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

          let sumKm = 0;
          for (let i = 0; i < waypoints.length - 1; i++) {
            sumKm += (getHaversineDistanceKm(waypoints[i].latitude, waypoints[i].longitude, waypoints[i + 1].latitude, waypoints[i + 1].longitude) || 0);
          }

          setMultiStopRoute({
            originName: originStore.name,
            totalDistanceKm: sumKm.toFixed(1),
            totalDurationMinutes: Math.round(sumKm * 2),
            orderedCustomers: orderedCusts,
            legs: [],
            isFallback: true,
          });
          warning('Routing service busy. Multi-stop direct sequence rendered.');
        }
      }
    } catch (err) {
      console.warn('Multi-stop route failed:', err);
      toastError('Could not compute multi-stop route.');
    } finally {
      setRoutingLoading(false);
    }
  };

  // Center customer on map and open popup
  const focusCustomerOnMap = (cust) => {
    setSelectedCustomerId(cust.customerId);
    const map = mapInstanceRef.current;
    if (map && cust.latitude && cust.longitude) {
      map.flyTo([cust.latitude, cust.longitude], 15, { duration: 1.0 });
      const marker = customerMarkersRef.current.get(cust.customerId);
      if (marker) setTimeout(() => marker.openPopup(), 1000);
    }
  };

  const selectedCustomer = customersWithProximity.find((c) => c.customerId === selectedCustomerId);

  return (
    <div 
      className="flex-1 min-h-0 overflow-y-auto w-full" 
      style={{ backgroundColor: "var(--page-bg)", scrollbarGutter: 'stable' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 animate-fade-in">
      {/* Top Header Card */}
      <div 
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--border)",
        }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-5 rounded-3xl border"
      >
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>OpenStreetMap Fleet Geolocation & Hub Dispatch</span>
          </div>
          <h1 style={{ color: "var(--text-primary)" }} className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-sky-500" />
            Customer Map Locator
          </h1>
          <p style={{ color: "var(--text-muted)" }} className="text-xs">
            Track customer HVAC units, view workshop service zones, and calculate OSRM driving routes from physical store branches.
          </p>
        </div>

        {/* Origin Store Selector & Counters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Origin Branch Selector */}
          <div 
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: "var(--border)",
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs"
          >
            <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
            <div className="flex flex-col">
              <span style={{ color: "var(--text-muted)" }} className="text-[10px] font-bold uppercase tracking-wider">
                Route Origin Hub:
              </span>
              <select
                value={selectedOriginStoreId}
                onChange={(e) => handleSetOriginStore(e.target.value)}
                style={{ color: "var(--text-primary)" }}
                className="bg-transparent font-bold focus:outline-none cursor-pointer"
              >
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.name} {s.isMainBranch ? '★ (HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stores Counter */}
          <div className="px-3 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-right">
            <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
              Stores on Map
            </div>
            <div className="text-base font-extrabold text-indigo-500">
              {stores.length} {stores.length === 1 ? 'Store' : 'Stores'}
            </div>
          </div>

          {/* Clients on Map Counter */}
          <div 
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: "var(--border)",
            }}
            className="px-3 py-2 rounded-2xl border text-right"
          >
            <div style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold uppercase tracking-wider">
              Clients on Map
            </div>
            <div style={{ color: "var(--text-primary)" }} className="text-base font-extrabold">
              {mappedCustomers.length} <span style={{ color: "var(--text-muted)" }} className="text-xs font-normal">/ {filteredCustomers.length}</span>
            </div>
          </div>

          {/* Fleet Units Counter */}
          <div className="px-3 py-2 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-right">
            <div className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Fleet Units
            </div>
            <div className="text-base font-extrabold text-sky-600 dark:text-sky-400">
              {totalFleetOnMap} {totalFleetOnMap === 1 ? 'Unit' : 'Units'}
            </div>
          </div>

          <button
            onClick={loadData}
            title="Refresh map and store data"
            style={{
              backgroundColor: "var(--card-inner)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
            className="p-2.5 rounded-2xl border hover:opacity-80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div 
          style={{
            backgroundColor: "var(--status-danger-bg)",
            borderColor: "var(--status-danger-border)",
            color: "var(--status-danger-text)",
          }}
          className="p-4 rounded-2xl border text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-xl bg-rose-500 text-white font-semibold text-xs hover:bg-rose-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Multi-Stop Toolbar (Active when multi-select mode is enabled) */}
      {multiSelectMode && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-fade-in text-white text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Multi-Stop Dispatch Mode:</span>{' '}
              <span className="text-indigo-200">
                {selectedCustomerIds.size} client(s) selected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllMapped}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-semibold"
            >
              {selectedCustomerIds.size === mappedCustomers.length ? 'Deselect All' : 'Select All Mapped'}
            </button>
            <button
              onClick={handleGenerateMultiStopRoute}
              disabled={routingLoading || selectedCustomerIds.size === 0}
              className="px-4 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold shadow-md shadow-indigo-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Route className={`w-3.5 h-3.5 ${routingLoading ? 'animate-spin' : ''}`} />
              <span>{routingLoading ? 'Optimizing...' : 'Generate Optimized Route'}</span>
            </button>
            <button
              onClick={() => {
                setMultiSelectMode(false);
                setSelectedCustomerIds(new Set());
                handleClearRoute();
              }}
              className="px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-indigo-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Split-Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-230px)] min-h-[580px]">
        {/* Left Side: Filter & Customer Cards List (5 cols) */}
        <div 
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border)",
          }}
          className="lg:col-span-5 flex flex-col glass-panel rounded-3xl overflow-hidden shadow-xl border"
        >
          {/* Search & Filters Header */}
          <div 
            style={{ borderColor: "var(--border)" }}
            className="p-4 border-b space-y-3 shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search client, address, or aircon brand..."
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

              <button
                type="button"
                onClick={() => setMultiSelectMode((p) => !p)}
                style={
                  multiSelectMode
                    ? { backgroundColor: '#6366f1', color: '#ffffff', borderColor: '#6366f1' }
                    : { backgroundColor: 'var(--chip-bg)', color: 'var(--text-primary)', borderColor: 'var(--border)' }
                }
                className="px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 shrink-0"
                title="Select multiple clients for optimized multi-stop dispatch route"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Multi-Stop</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full px-2 py-1.5 border rounded-lg focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <select
                  value={unitCountFilter}
                  onChange={(e) => setUnitCountFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full px-2 py-1.5 border rounded-lg focus:outline-none"
                >
                  <option value="ALL">Any Units</option>
                  <option value="0">0 Units</option>
                  <option value="1">1 Unit</option>
                  <option value="2">2 Units</option>
                  <option value="3+">3+ Units</option>
                </select>
              </div>

              <div>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full px-2 py-1.5 border rounded-lg focus:outline-none"
                >
                  <option value="ALL">All Cities</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: "var(--input-border)",
                    color: "var(--input-text)",
                  }}
                  className="w-full px-2 py-1.5 border rounded-lg focus:outline-none"
                >
                  <option value="ALL">All Hubs</option>
                  {stores.map((s) => (
                    <option key={s.storeId} value={s.storeId}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scrollable Customer Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-500" />
                No eligible customers match the filter criteria.
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = cust.customerId === selectedCustomerId;
                const isCheckedInMulti = selectedCustomerIds.has(cust.customerId);
                const hasCoordinates =
                  cust.latitude !== null && cust.longitude !== null && !isNaN(cust.latitude) && !isNaN(cust.longitude);
                const hasUnderRepair = cust.airconUnits?.some((u) => u.status === 'Under Repair');
                const isOutside = cust.isInsideServiceArea === false;

                return (
                  <div
                    key={cust.customerId}
                    onClick={() => {
                      if (multiSelectMode && hasCoordinates) {
                        handleToggleCustomerSelect(cust.customerId);
                      } else {
                        focusCustomerOnMap(cust);
                      }
                    }}
                    style={{
                      backgroundColor: isCheckedInMulti
                        ? 'rgba(99, 102, 241, 0.15)'
                        : isSelected
                        ? 'var(--accent-light)'
                        : 'var(--card-inner)',
                      borderColor: isCheckedInMulti
                        ? '#6366f1'
                        : isSelected
                        ? 'var(--accent)'
                        : 'var(--border)',
                    }}
                    className="p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border hover:opacity-90 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {multiSelectMode && hasCoordinates && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCustomerSelect(cust.customerId);
                            }}
                            className="mt-0.5 text-indigo-400 hover:text-indigo-300"
                          >
                            {isCheckedInMulti ? (
                              <CheckSquare className="w-4 h-4 fill-indigo-500 text-white" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0">
                          <h4 style={{ color: "var(--text-primary)" }} className="font-bold text-xs flex items-center gap-1.5 truncate">
                            <span>
                              {cust.firstName} {cust.lastName}
                            </span>
                            {hasUnderRepair && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                                title="Has unit under repair"
                              />
                            )}
                          </h4>
                          <p style={{ color: "var(--text-muted)" }} className="text-[11px] line-clamp-1 mt-0.5">
                            {cust.address || `${cust.cityName || ''}, ${cust.provinceName || ''}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasCoordinates ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                            {cust.airconCount} AC
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              Not mapped
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeocodeCustomer(cust);
                              }}
                              disabled={geocodingId === cust.customerId}
                              className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors inline-flex items-center gap-1"
                              title="Search address coordinates via OpenStreetMap"
                            >
                              <RefreshCw
                                className={`w-2.5 h-2.5 ${geocodingId === cust.customerId ? 'animate-spin' : ''}`}
                              />
                              <span>{geocodingId === cust.customerId ? 'Locating...' : 'Geocode'}</span>
                            </button>
                          </div>
                        )}
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>

                    {/* Nearest Store and Service Area Status Badge */}
                    {cust.nearestStore && hasCoordinates && (
                      <div style={{ color: "var(--text-muted)" }} className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-sky-500 shrink-0" />
                          <span className="truncate">
                            Nearest Hub: <strong style={{ color: "var(--text-primary)" }}>{cust.nearestStore.name}</strong> ({cust.distanceToNearestKm} km)
                          </span>
                        </span>
                        {isOutside ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 shrink-0">
                            Outside Area (+{cust.excessDistanceKm} km)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 shrink-0">
                            In Coverage
                          </span>
                        )}
                      </div>
                    )}

                    {/* Aircon Units Snapshot */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cust.airconUnits?.slice(0, 3).map((u) => (
                        <span
                          key={u.unitId || u.unit_id}
                          style={{
                            backgroundColor: "var(--chip-bg)",
                            color: "var(--chip-text)",
                            borderColor: "var(--chip-border)",
                          }}
                          className="px-2 py-0.5 rounded-md border text-[10px] font-medium"
                        >
                          {u.brand} ({u.horsepower}HP)
                        </span>
                      ))}
                      {cust.airconUnits?.length > 3 && (
                        <span style={{ color: "var(--text-muted)" }} className="text-[10px] font-semibold px-1 self-center">
                          +{cust.airconUnits.length - 3} more
                        </span>
                      )}
                      {cust.airconUnits?.length === 0 && (
                        <span style={{ color: "var(--text-muted)" }} className="text-[10px] italic">No units registered</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: OpenStreetMap Canvas & Interactive Controls (7 cols) */}
        <div 
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border)",
          }}
          className="lg:col-span-7 flex flex-col glass-panel rounded-3xl overflow-hidden shadow-xl border relative"
        >
          {/* Map Canvas */}
          <div ref={mapContainerRef} className="w-full flex-1 z-0" />

          {/* Map Controls Floating Overlay (Top-Right) */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            {/* Toggle Service Area Circles */}
            <button
              type="button"
              onClick={() => setShowServiceAreas((p) => !p)}
              style={
                showServiceAreas
                  ? { backgroundColor: 'var(--accent)', color: '#ffffff', borderColor: 'var(--accent)' }
                  : { backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', borderColor: 'var(--border)' }
              }
              className="p-2.5 rounded-xl backdrop-blur-md border shadow-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Show or hide store coverage area radius circles"
            >
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Coverage Areas</span>
            </button>

            {/* OpenStreetMap Layer Switcher Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLayerPicker(!showLayerPicker)}
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="p-2.5 rounded-xl backdrop-blur-md border shadow-lg hover:opacity-80 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Switch OpenStreetMap Tile Layer"
              >
                <Layers className="w-4 h-4 text-sky-500" />
                <span className="hidden sm:inline">{osmTileLayers[currentLayerKey]?.name || 'Layer'}</span>
              </button>

              {showLayerPicker && (
                <div 
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  className="absolute right-0 top-11 w-52 p-2 rounded-2xl backdrop-blur-md border shadow-2xl space-y-1 text-xs animate-fade-in"
                >
                  <div style={{ color: "var(--text-muted)" }} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                    OpenStreetMap Tiles
                  </div>
                  {Object.entries(osmTileLayers).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => switchTileLayer(key)}
                      style={
                        currentLayerKey === key
                          ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 'bold' }
                          : { color: 'var(--text-primary)' }
                      }
                      className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors hover:opacity-80"
                    >
                      <span>{config.name}</span>
                      {currentLayerKey === key && <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Locate Me GPS Button */}
            <button
              type="button"
              onClick={handleLocateUser}
              disabled={locatingUser}
              className="p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:text-sky-500 transition-colors flex items-center justify-center text-xs font-semibold"
              title="Locate my position via device GPS"
            >
              <Crosshair className={`w-4 h-4 text-sky-500 ${locatingUser ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Active Single OSRM Route Badge */}
          {activeRoute && (
            <div className="absolute top-4 left-14 z-10 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-500/40 shadow-xl max-w-sm flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>Route to {activeRoute.customerName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        {activeRoute.distanceKm} km
                      </span>{' '}
                      • ~{activeRoute.durationMinutes} mins driving
                      {activeRoute.straightLineKm && (
                        <span className="text-[10px] text-slate-400 block">
                          (Direct: {activeRoute.straightLineKm} km)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {activeRoute.steps?.length > 0 && (
                    <button
                      onClick={() => setShowRouteSteps((p) => !p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500"
                      title="Toggle turn-by-turn steps"
                    >
                      {showRouteSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={handleClearRoute}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Clear Route"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collapsible Turn-by-turn maneuvers */}
              {showRouteSteps && activeRoute.steps?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto space-y-1.5 text-[11px]">
                  <div className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[9px] tracking-wider">
                    Turn-by-turn Navigation Steps:
                  </div>
                  {activeRoute.steps.map((st) => (
                    <div key={st.stepIndex} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                      <span className="font-mono text-sky-500 font-bold">{st.stepIndex}.</span>
                      <div className="flex-1">
                        <span>{st.instruction}</span>
                        {st.distanceMeters > 0 && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({st.distanceMeters >= 1000 ? `${(st.distanceMeters / 1000).toFixed(1)} km` : `${st.distanceMeters} m`})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Multi-Stop Route Summary Card */}
          {multiStopRoute && (
            <div className="absolute top-4 left-14 z-10 p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 shadow-xl max-w-sm flex flex-col gap-2 animate-fade-in text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      Optimized Multi-Stop Route
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-indigo-400">
                        {multiStopRoute.totalDistanceKm} km
                      </span>{' '}
                      • ~{multiStopRoute.totalDurationMinutes} mins total
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClearRoute}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                  title="Clear Multi-Stop Route"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stops sequence */}
              <div className="mt-1 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Dispatch Sequence:</div>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-bold">
                  <span>🏢 {multiStopRoute.originName}</span>
                  <span className="text-slate-400">➔</span>
                </div>
                {multiStopRoute.orderedCustomers.map((c, i) => (
                  <div key={c.customerId} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 pl-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    <span className="font-medium truncate">
                      {c.firstName} {c.lastName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Customer Floating Details Card */}
          {selectedCustomer && (
            <div className="absolute bottom-4 left-4 right-4 z-10 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                      {selectedCustomer.airconCount} {selectedCustomer.airconCount === 1 ? 'Unit' : 'Units'}
                    </span>
                    {selectedCustomer.nearestStore && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                        Nearest: {selectedCustomer.nearestStore.name} ({selectedCustomer.distanceToNearestKm} km)
                      </span>
                    )}
                    {selectedCustomer.isInsideServiceArea === false && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-500 shrink-0">
                        Outside Standard Area (+{selectedCustomer.excessDistanceKm} km)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {selectedCustomer.address}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedCustomer.latitude && selectedCustomer.longitude ? (
                    <>
                      {/* OSRM Route Button from Selected Store */}
                      <button
                        type="button"
                        onClick={() => handleCalculateRoute(selectedCustomer)}
                        disabled={routingLoading}
                        className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
                        title="Compute road route from selected store hub"
                      >
                        <Route className={`w-3.5 h-3.5 ${routingLoading ? 'animate-spin' : ''}`} />
                        <span>{routingLoading ? 'Routing...' : 'Route from Hub'}</span>
                      </button>

                      {/* OpenStreetMap External Directions */}
                      <a
                        href={osmService.getOpenStreetMapDirectionsUrl(
                          { latitude: selectedCustomer.latitude, longitude: selectedCustomer.longitude },
                          currentOriginStore ? { latitude: currentOriginStore.latitude, longitude: currentOriginStore.longitude } : userLocation
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1"
                        title="Open full directions on openstreetmap.org"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>OSM</span>
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGeocodeCustomer(selectedCustomer)}
                      disabled={geocodingId === selectedCustomer.customerId}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${geocodingId === selectedCustomer.customerId ? 'animate-spin' : ''}`}
                      />
                      <span>{geocodingId === selectedCustomer.customerId ? 'Locating...' : 'Geocode Address'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Units details drawer */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectedCustomer.airconUnits?.map((u) => (
                  <div
                    key={u.unitId || u.unit_id}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-[11px]"
                  >
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {u.brand} {u.model}
                    </div>
                    <div className="text-slate-400 text-[10px] flex items-center justify-between mt-0.5">
                      <span>{u.horsepower} HP</span>
                      <span className={`font-semibold ${u.status === 'Active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {u.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STORE DETAILS MODAL (OPENED FROM POPUP) */}
      {/* ========================================================================= */}
      {selectedStoreModal && (
        <Modal
          isOpen={Boolean(selectedStoreModal)}
          onClose={() => setSelectedStoreModal(null)}
          title={selectedStoreModal.name}
          subtitle={`Branch Code: ${selectedStoreModal.code} • ${selectedStoreModal.isMainBranch ? 'Main Headquarters Hub' : 'Service Base'}`}
          maxWidth="sm:max-w-[620px]"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  handleSetOriginStore(selectedStoreModal.storeId);
                  setSelectedStoreModal(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-sky-500 text-white rounded-xl shadow-md hover:bg-sky-400 transition-colors"
              >
                Set as Route Origin Hub
              </button>
              <button
                type="button"
                onClick={() => setSelectedStoreModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            {/* Live Status and Operations */}
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {getStoreLiveStatus(selectedStoreModal.openingHours).text}
                </span>
              </div>
              <Badge variant={selectedStoreModal.status === 'Open' ? 'success' : 'warning'}>
                {selectedStoreModal.status}
              </Badge>
            </div>

            {/* Address & Landmark */}
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-1">Workshop Address:</span>
              <p>
                {[selectedStoreModal.street, selectedStoreModal.barangay, selectedStoreModal.cityMunicipality, selectedStoreModal.province]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {selectedStoreModal.landmarkNotes && (
                <p className="text-[11px] text-slate-400 italic mt-0.5">
                  📍 Landmark: {selectedStoreModal.landmarkNotes}
                </p>
              )}
            </div>

            {/* Contact & Radius */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Contact Information:</span>
                <p>{selectedStoreModal.phone || selectedStoreModal.mobile || 'No phone recorded'}</p>
                <p className="text-slate-400">{selectedStoreModal.email || ''}</p>
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Service Coverage:</span>
                <p className="text-sky-500 font-bold">{selectedStoreModal.serviceRadiusKm} km radius</p>
                <p className="text-slate-400">
                  {selectedStoreModal.acceptsWalkIns ? 'Accepts walk-in clients' : 'By appointment only'}
                </p>
              </div>
            </div>

            {/* Personnel */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">Assigned Personnel:</span>
              <p>
                {selectedStoreModal.assignedTechnicianCount || 0} field technicians stationed at this branch.
              </p>
              {selectedStoreModal.parkingNotes && (
                <p className="text-slate-400 text-[11px] mt-1">
                  🅿️ Parking: {selectedStoreModal.parkingNotes}
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}

export default CustomerMapPage;
