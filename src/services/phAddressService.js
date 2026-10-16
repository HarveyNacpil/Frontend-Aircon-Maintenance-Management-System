/**
 * Philippine Address Data Service
 * Loads PSGC data from public/ph-address JSON datasets with caching
 */

let regionsCache = null;
let provincesCache = null;
let citiesCache = null;
let barangaysCache = null;

export const phAddressService = {
  /**
   * Load all regions
   */
  async getRegions() {
    if (regionsCache) return regionsCache;
    try {
      const res = await fetch('/ph-address/region.json');
      if (!res.ok) throw new Error('Failed to load regions dataset');
      const data = await res.json();
      regionsCache = Array.isArray(data) ? data : [];
      return regionsCache;
    } catch (err) {
      console.error('Error loading regions:', err);
      return [];
    }
  },

  /**
   * Load provinces filtered by region code
   */
  async getProvincesByRegion(regionCode) {
    if (!provincesCache) {
      try {
        const res = await fetch('/ph-address/province.json');
        if (!res.ok) throw new Error('Failed to load provinces dataset');
        const data = await res.json();
        provincesCache = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('Error loading provinces:', err);
        return [];
      }
    }

    if (!regionCode) return provincesCache;

    // Filter provinces matching region code
    const filtered = provincesCache.filter(
      p => p.region_code === regionCode || String(p.region_code) === String(regionCode)
    );

    // If no province found (e.g., NCR), return synthetic district entries or empty list
    return filtered.sort((a, b) => a.province_name.localeCompare(b.province_name));
  },

  /**
   * Load cities and municipalities filtered by province code (or region code if no province, e.g. Metro Manila)
   */
  async getCitiesByProvince(provinceCode, regionCode) {
    if (!citiesCache) {
      try {
        const res = await fetch('/ph-address/city.json');
        if (!res.ok) throw new Error('Failed to load cities dataset');
        const data = await res.json();
        citiesCache = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('Error loading cities:', err);
        return [];
      }
    }

    let filtered = [];
    if (provinceCode) {
      filtered = citiesCache.filter(
        c => c.province_code === provinceCode || String(c.province_code) === String(provinceCode)
      );
    } else if (regionCode) {
      filtered = citiesCache.filter(
        c => c.region_desc === regionCode || String(c.region_code) === String(regionCode)
      );
    } else {
      filtered = citiesCache;
    }

    return filtered.sort((a, b) => a.city_name.localeCompare(b.city_name));
  },

  /**
   * Load barangays filtered by city/municipality code
   */
  async getBarangaysByCity(cityCode) {
    if (!barangaysCache) {
      try {
        const res = await fetch('/ph-address/barangay.json');
        if (!res.ok) throw new Error('Failed to load barangays dataset');
        const data = await res.json();
        barangaysCache = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('Error loading barangays:', err);
        return [];
      }
    }

    if (!cityCode) return [];

    const filtered = barangaysCache.filter(
      b => b.city_code === cityCode || String(b.city_code) === String(cityCode)
    );

    return filtered.sort((a, b) => a.brgy_name.localeCompare(b.brgy_name));
  },

  /**
   * Construct full Philippine address string
   */
  formatAddress({ streetAddress, barangayName, cityName, provinceName, regionName }) {
    const parts = [
      streetAddress?.trim(),
      barangayName?.trim() ? `Brgy. ${barangayName.trim()}` : null,
      cityName?.trim(),
      provinceName?.trim(),
      regionName?.trim()
    ].filter(Boolean);

    return parts.join(', ');
  }
};
