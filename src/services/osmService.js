/**
 * OpenStreetMap (OSM) Ecosystem Service
 * Integrates OpenStreetMap tile layers, Nominatim geocoding & reverse geocoding,
 * and OSRM (Open Source Routing Machine) for routing and navigation.
 * Reference: https://github.com/openstreetmap
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

const cache = {
  forward: new Map(),
  reverse: new Map(),
  routes: new Map(),
};

export const osmTileLayers = {
  standard: {
    id: 'standard',
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  humanitarian: {
    id: 'humanitarian',
    name: 'OSM Humanitarian (HOT)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">Humanitarian OpenStreetMap Team</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  voyager: {
    id: 'voyager',
    name: 'OSM Voyager (Clean SaaS)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  },
  dark: {
    id: 'dark',
    name: 'OSM Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 20,
    subdomains: 'abcd',
  }
};

let lastNominatimRequestTime = 0;
async function throttleNominatim() {
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastNominatimRequestTime = Date.now();
}

export const osmService = {
  /**
   * Search address via OpenStreetMap Nominatim (Rate limited to max 1 req/sec)
   * @param {string} query - Full or partial address query
   * @param {Object} [options]
   */
  async searchAddress(query, options = {}) {
    if (!query || typeof query !== 'string') return [];
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return [];

    const cacheKey = cleanQuery.toLowerCase();
    if (cache.forward.has(cacheKey)) {
      return cache.forward.get(cacheKey);
    }

    try {
      await throttleNominatim();
      const url = new URL(`${NOMINATIM_BASE}/search`);
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', cleanQuery);
      url.searchParams.set('countrycodes', 'ph');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', String(options.limit || 5));

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AeroFlow-HVAC-Tracker/1.0 (AirconMaintenanceSystem)'
        }
      });

      if (!res.ok) throw new Error(`Nominatim query failed: ${res.statusText}`);
      const data = await res.json();

      const results = (Array.isArray(data) ? data : []).map(item => ({
        id: item.place_id,
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        importance: item.importance,
        address: item.address || {},
      }));

      cache.forward.set(cacheKey, results);
      return results;
    } catch (err) {
      console.warn('OpenStreetMap Nominatim search error:', err);
      return [];
    }
  },

  /**
   * Reverse geocode coordinates to Philippine address hierarchy via OpenStreetMap Nominatim
   * @param {number} latitude
   * @param {number} longitude
   */
  async reverseGeocode(latitude, longitude) {
    if (latitude == null || longitude == null) return null;
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    if (cache.reverse.has(cacheKey)) {
      return cache.reverse.get(cacheKey);
    }

    try {
      await throttleNominatim();
      const url = new URL(`${NOMINATIM_BASE}/reverse`);
      url.searchParams.set('format', 'json');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('zoom', '18');

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AeroFlow-HVAC-Tracker/1.0 (AirconMaintenanceSystem)'
        }
      });

      if (!res.ok) throw new Error(`Nominatim reverse query failed: ${res.statusText}`);
      const data = await res.json();
      if (!data || !data.address) return null;

      const addr = data.address;
      const street = [addr.house_number, addr.road || addr.street || addr.pedestrian || addr.path].filter(Boolean).join(' ');
      const barangay = addr.quarter || addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
      const city = addr.city || addr.town || addr.municipality || addr.city_district || '';
      const province = addr.province || addr.state || addr.county || '';
      const region = addr.region || '';

      const formatted = {
        displayName: data.display_name,
        streetAddress: street,
        barangayName: barangay.replace(/^(brgy\.?|barangay)\s*/i, ''),
        cityName: city,
        provinceName: province,
        regionName: region,
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        postcode: addr.postcode || '',
        osmType: data.osm_type,
        osmId: data.osm_id,
      };

      cache.reverse.set(cacheKey, formatted);
      return formatted;
    } catch (err) {
      console.warn('OpenStreetMap Nominatim reverse geocode error:', err);
      return null;
    }
  },

  /**
   * Calculate driving route geometry, distance, duration, and turn-by-turn steps between origin and destination using OSRM
   * @param {{latitude: number, longitude: number}} origin
   * @param {{latitude: number, longitude: number}} destination
   */
  async getRoute(origin, destination) {
    if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
      return null;
    }

    const key = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}->${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
    if (cache.routes.has(key)) {
      return cache.routes.get(key);
    }

    try {
      const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM route failed: ${res.statusText}`);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawSteps = route.legs?.[0]?.steps || [];
        const steps = rawSteps.map((s, idx) => {
          let text = s.name ? `Proceed onto ${s.name}` : 'Continue on roadway';
          if (s.maneuver?.type === 'depart') text = `Depart towards ${s.name || 'destination'}`;
          else if (s.maneuver?.type === 'arrive') text = 'Arrive at destination';
          else if (s.maneuver?.modifier) {
            text = `Turn ${s.maneuver.modifier} onto ${s.name || 'road'}`;
          }
          return {
            stepIndex: idx + 1,
            instruction: text,
            name: s.name || '',
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round(s.duration || 0),
            modifier: s.maneuver?.modifier || '',
            type: s.maneuver?.type || '',
          };
        });

        const result = {
          distanceKm: (route.distance / 1000).toFixed(1),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          steps,
        };
        cache.routes.set(key, result);
        return result;
      }
      return null;
    } catch (err) {
      console.warn('OSRM route calculation error:', err);
      return null;
    }
  },

  /**
   * Calculate multi-stop driving route through multiple ordered points starting from origin
   * @param {Array<{latitude: number, longitude: number, name?: string}>} waypoints
   */
  async getMultiStopRoute(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) return null;

    try {
      const coords = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
      const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM multi-stop route failed: ${res.statusText}`);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const legs = (route.legs || []).map((leg, i) => ({
          legIndex: i + 1,
          fromName: waypoints[i]?.name || `Stop ${i + 1}`,
          toName: waypoints[i + 1]?.name || `Stop ${i + 2}`,
          distanceKm: (leg.distance / 1000).toFixed(1),
          durationMinutes: Math.max(1, Math.round(leg.duration / 60)),
          steps: (leg.steps || []).map((s, idx) => ({
            stepIndex: idx + 1,
            instruction: s.maneuver?.type === 'depart' ? `Depart toward ${s.name || 'next stop'}` :
                         s.maneuver?.type === 'arrive' ? `Arrive at ${waypoints[i + 1]?.name || 'stop'}` :
                         s.maneuver?.modifier ? `Turn ${s.maneuver.modifier} onto ${s.name || 'road'}` :
                         s.name ? `Continue on ${s.name}` : 'Continue',
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round(s.duration || 0),
          }))
        }));

        return {
          totalDistanceKm: (route.distance / 1000).toFixed(1),
          totalDurationMinutes: Math.max(1, Math.round(route.duration / 60)),
          coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          legs,
          stopsCount: waypoints.length,
        };
      }
      return null;
    } catch (err) {
      console.warn('OSRM multi-stop calculation error:', err);
      return null;
    }
  },

  /**
   * Generate official OpenStreetMap web directions URL
   * @param {{latitude: number, longitude: number}} destination
   * @param {{latitude: number, longitude: number}} [origin]
   */
  getOpenStreetMapDirectionsUrl(destination, origin = null) {
    if (!destination?.latitude || !destination?.longitude) return '#';
    if (origin?.latitude && origin?.longitude) {
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`)}`;
    }
    return `https://www.openstreetmap.org/?mlat=${destination.latitude}&mlon=${destination.longitude}#map=16/${destination.latitude}/${destination.longitude}`;
  }
};
