import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';
import { phAddressService } from '../../services/phAddressService';
import { geocodingService } from '../../services/geocodingService';
import { OsmMapPickerModal } from './OsmMapPickerModal';

export function PhilippineAddressSelector({ value, onChange }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [manualCoords, setManualCoords] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Load regions on mount
  useEffect(() => {
    async function init() {
      const r = await phAddressService.getRegions();
      setRegions(r);
    }
    init();
  }, []);

  // When region changes, load provinces
  useEffect(() => {
    async function loadProvinces() {
      if (value.regionCode) {
        const p = await phAddressService.getProvincesByRegion(value.regionCode);
        setProvinces(p);
      } else {
        setProvinces([]);
      }
    }
    loadProvinces();
  }, [value.regionCode]);

  // When province or region changes, load cities
  useEffect(() => {
    async function loadCities() {
      if (value.provinceCode || value.regionCode) {
        const c = await phAddressService.getCitiesByProvince(value.provinceCode, value.regionCode);
        setCities(c);
      } else {
        setCities([]);
      }
    }
    loadCities();
  }, [value.provinceCode, value.regionCode]);

  // When city changes, load barangays
  useEffect(() => {
    async function loadBarangays() {
      if (value.cityCode) {
        const b = await phAddressService.getBarangaysByCity(value.cityCode);
        setBarangays(b);
      } else {
        setBarangays([]);
      }
    }
    loadBarangays();
  }, [value.cityCode]);

  const handleRegionChange = (e) => {
    const code = e.target.value;
    const selected = regions.find(r => r.region_code === code);
    const updated = {
      ...value,
      regionCode: code,
      regionName: selected ? selected.region_name : '',
      provinceCode: '',
      provinceName: '',
      cityCode: '',
      cityName: '',
      barangayCode: '',
      barangayName: '',
    };
    updated.address = phAddressService.formatAddress(updated);
    onChange(updated);
  };

  const handleProvinceChange = (e) => {
    const code = e.target.value;
    const selected = provinces.find(p => p.province_code === code);
    const updated = {
      ...value,
      provinceCode: code,
      provinceName: selected ? selected.province_name : '',
      cityCode: '',
      cityName: '',
      barangayCode: '',
      barangayName: '',
    };
    updated.address = phAddressService.formatAddress(updated);
    onChange(updated);
  };

  const handleCityChange = async (e) => {
    const code = e.target.value;
    const selected = cities.find(c => c.city_code === code);
    const updated = {
      ...value,
      cityCode: code,
      cityName: selected ? selected.city_name : '',
      barangayCode: '',
      barangayName: '',
    };
    updated.address = phAddressService.formatAddress(updated);
    onChange(updated);
    triggerAutoGeocode(updated);
  };

  const handleBarangayChange = async (e) => {
    const code = e.target.value;
    const selected = barangays.find(b => b.brgy_code === code);
    const updated = {
      ...value,
      barangayCode: code,
      barangayName: selected ? selected.brgy_name : '',
    };
    updated.address = phAddressService.formatAddress(updated);
    onChange(updated);
    triggerAutoGeocode(updated);
  };

  const handleStreetChange = (e) => {
    const street = e.target.value;
    const updated = {
      ...value,
      streetAddress: street,
    };
    updated.address = phAddressService.formatAddress(updated);
    onChange(updated);
  };

  const triggerAutoGeocode = async (addrObj) => {
    if (!addrObj.cityName) return;
    try {
      setGeocoding(true);
      const coords = await geocodingService.geocodeAddress(addrObj);
      if (coords) {
        onChange({
          ...addrObj,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleLocationPicked = (result) => {
    const updated = {
      ...value,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    if (result.addressDetails) {
      if (!updated.streetAddress && result.addressDetails.streetAddress) {
        updated.streetAddress = result.addressDetails.streetAddress;
      }
      if (!updated.address && result.addressDetails.displayName) {
        updated.address = result.addressDetails.displayName;
      }
    }
    const formatted = phAddressService.formatAddress(updated);
    if (formatted) updated.address = formatted;
    onChange(updated);
  };

  const hasCoords = value.latitude !== null && value.latitude !== undefined && value.latitude !== '';

  return (
    <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-sky-500" />
          Philippine Administrative Address
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20"
            title="Pinpoint address on interactive OpenStreetMap"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-500" />
            Pick on OpenStreetMap
          </button>
          <button
            type="button"
            onClick={() => triggerAutoGeocode(value)}
            disabled={geocoding || !value.cityName}
            className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-sky-600 disabled:opacity-40 font-semibold flex items-center gap-1 transition-colors px-2 py-1"
            title="Auto-resolve coordinates from administrative address"
          >
            <Navigation className={`w-3 h-3 ${geocoding ? 'animate-spin text-sky-500' : ''}`} />
            {geocoding ? 'Resolving...' : 'Auto-Locate'}
          </button>
        </div>
      </div>

      {/* Grid of Region & Province */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Region *</label>
          <select
            value={value.regionCode || ''}
            onChange={handleRegionChange}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Select Region</option>
            {regions.map(r => (
              <option key={r.region_code} value={r.region_code}>
                {r.region_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Province</label>
          <select
            value={value.provinceCode || ''}
            onChange={handleProvinceChange}
            disabled={!value.regionCode || provinces.length === 0}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            <option value="">{provinces.length === 0 && value.regionCode ? 'N/A (Metropolitan/Special)' : 'Select Province'}</option>
            {provinces.map(p => (
              <option key={p.province_code} value={p.province_code}>
                {p.province_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of City & Barangay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">City / Municipality *</label>
          <select
            value={value.cityCode || ''}
            onChange={handleCityChange}
            disabled={!value.regionCode}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            <option value="">Select City / Municipality</option>
            {cities.map(c => (
              <option key={c.city_code} value={c.city_code}>
                {c.city_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Barangay</label>
          <select
            value={value.barangayCode || ''}
            onChange={handleBarangayChange}
            disabled={!value.cityCode}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            <option value="">Select Barangay</option>
            {barangays.map(b => (
              <option key={b.brgy_code} value={b.brgy_code}>
                {b.brgy_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Detailed Street / Unit / Building Address */}
      <div>
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Street / House No. / Building / Floor</label>
        <input
          type="text"
          value={value.streetAddress || ''}
          onChange={handleStreetChange}
          onBlur={() => triggerAutoGeocode(value)}
          placeholder="e.g. Unit 4B, Emerald Tower, 123 Rizal St."
          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Coordinates Status Bar & Toggle */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {hasCoords ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              GPS Coordinates: {Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              Map location not available
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setManualCoords(!manualCoords)}
          className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 font-medium"
        >
          <Edit2 className="w-3 h-3" />
          {manualCoords ? 'Hide Coordinate Fields' : 'Edit Coordinates Manually'}
        </button>
      </div>

      {/* Manual Coordinates Input */}
      {manualCoords && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={value.latitude ?? ''}
              onChange={(e) => onChange({ ...value, latitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
              placeholder="e.g. 14.5995"
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={value.longitude ?? ''}
              onChange={(e) => onChange({ ...value, longitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
              placeholder="e.g. 120.9842"
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>
        </div>
      )}

      {/* Complete Formatted Address Preview */}
      {value.address && (
        <div className="text-[11px] p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-200">
          <span className="font-semibold block text-[10px] uppercase tracking-wider text-sky-600 dark:text-sky-400">Complete Address:</span>
          {value.address}
        </div>
      )}

      {/* OpenStreetMap Interactive Pin-Picker Modal */}
      <OsmMapPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        initialCoords={{
          latitude: value.latitude || 14.5995,
          longitude: value.longitude || 120.9842,
        }}
        onSelectLocation={handleLocationPicked}
      />
    </div>
  );
}
