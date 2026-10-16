import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Search, Check, X, Loader2, Navigation } from 'lucide-react';
import { osmService, osmTileLayers } from '../../services/osmService';
import { Modal } from '../common/Modal';

export function OsmMapPickerModal({ isOpen, onClose, initialCoords, onSelectLocation }) {
  const [coords, setCoords] = useState(initialCoords || { latitude: 14.5995, longitude: 120.9842 });
  const [addressDetails, setAddressDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize coordinates from props
  useEffect(() => {
    if (initialCoords?.latitude && initialCoords?.longitude) {
      setCoords(initialCoords);
    }
  }, [initialCoords]);

  // Initialize Leaflet Map with OpenStreetMap layers
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const initialLat = coords.latitude || 14.5995;
      const initialLng = coords.longitude || 120.9842;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: coords.latitude ? 15 : 12,
        zoomControl: true,
      });

      // Standard OpenStreetMap base layer
      L.tileLayer(osmTileLayers.standard.url, {
        attribution: osmTileLayers.standard.attribution,
        maxZoom: osmTileLayers.standard.maxZoom,
      }).addTo(map);

      // Custom OpenStreetMap marker pin
      const pinIcon = L.divIcon({
        className: 'osm-pin-marker',
        html: `
          <div style="
            background: #0284c7;
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 14px rgba(0,0,0,0.4);
          ">
            <div style="transform: rotate(45deg); font-size: 16px;">📍</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        setCoords({ latitude: position.lat, longitude: position.lng });
        resolveAddress(position.lat, position.lng);
      });

      // Click on map to reposition pin
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setCoords({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        resolveAddress(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Reverse geocode initial coords
      resolveAddress(initialLat, initialLng);
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  async function resolveAddress(lat, lng) {
    try {
      setResolving(true);
      const res = await osmService.reverseGeocode(lat, lng);
      setAddressDetails(res);
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    } finally {
      setResolving(false);
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const results = await osmService.searchAddress(searchQuery, { limit: 5 });
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (item) => {
    setCoords({ latitude: item.latitude, longitude: item.longitude });
    setSearchResults([]);
    setSearchQuery(item.displayName);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([item.latitude, item.longitude], 16);
      markerRef.current.setLatLng([item.latitude, item.longitude]);
      resolveAddress(item.latitude, item.longitude);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
          markerRef.current.setLatLng([latitude, longitude]);
          resolveAddress(latitude, longitude);
        }
      },
      (err) => alert(`Unable to retrieve location: ${err.message}`)
    );
  };

  const handleConfirm = () => {
    onSelectLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      addressDetails,
    });
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="OpenStreetMap Pinpoint Location" 
      subtitle="Click on map or search for Philippine landmarks to set precise coordinates"
      maxWidth="sm:max-w-3xl"
      confirmOnDirty={false}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Pinpoint</span>
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Search Bar powered by OpenStreetMap Nominatim */}
        <div className="relative">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search landmark, street, city in the Philippines (via OpenStreetMap)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              title="Use current GPS location"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-1 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">My GPS</span>
            </button>
          </form>

          {/* Autocomplete Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => selectSearchResult(r)}
                  className="p-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer text-slate-800 dark:text-slate-200 text-xs flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Canvas */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-80 z-0" />
          <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 pointer-events-none">
            Powered by OpenStreetMap
          </div>
        </div>

        {/* Selected Coordinates & Reverse Geocoded Address */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>
                Coordinates: {coords.latitude ? coords.latitude.toFixed(6) : '0.000000'}, {coords.longitude ? coords.longitude.toFixed(6) : '0.000000'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {resolving ? 'Resolving OpenStreetMap address...' : (addressDetails?.displayName || 'Click map or drag pin to position')}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
