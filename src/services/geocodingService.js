/**
 * Geocoding Service powered by OpenStreetMap Nominatim
 * Provides forward geocoding, reverse geocoding, and coordinate resolution
 */
import { osmService } from './osmService';

const geocodeCache = new Map();

export const geocodingService = {
  /**
   * Geocode a Philippine address to latitude/longitude using OpenStreetMap Nominatim
   * @param {Object} addr - Address components { streetAddress, barangayName, cityName, provinceName }
   */
  async geocodeAddress(addr) {
    const { streetAddress, barangayName, cityName, provinceName } = addr;
    if (!cityName && !provinceName) return null;

    const queryKey = [streetAddress, barangayName, cityName, provinceName]
      .filter(Boolean)
      .join(', ')
      .toLowerCase();

    if (geocodeCache.has(queryKey)) {
      return geocodeCache.get(queryKey);
    }

    // Progressive search queries: from most specific to broader city/province level
    const queries = [
      [streetAddress, barangayName, cityName, provinceName, 'Philippines'].filter(Boolean).join(', '),
      [barangayName, cityName, provinceName, 'Philippines'].filter(Boolean).join(', '),
      [cityName, provinceName, 'Philippines'].filter(Boolean).join(', '),
    ];

    for (const q of queries) {
      try {
        const results = await osmService.searchAddress(q, { limit: 1 });
        if (results && results.length > 0) {
          const match = {
            latitude: results[0].latitude,
            longitude: results[0].longitude,
            displayName: results[0].displayName,
            source: 'OpenStreetMap Nominatim',
          };
          geocodeCache.set(queryKey, match);
          return match;
        }
      } catch (err) {
        console.warn('Geocoding query error on query:', q, err);
      }
    }

    return null;
  },

  /**
   * Reverse geocode coordinates to Philippine address hierarchy using OpenStreetMap
   * @param {number} latitude
   * @param {number} longitude
   */
  async reverseGeocode(latitude, longitude) {
    return await osmService.reverseGeocode(latitude, longitude);
  }
};
