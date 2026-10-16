// Central API Service Client for Aircon Maintenance System

const API_BASE_URL = '/api';

/**
 * Check if the backend API is alive and reachable
 */
export async function checkApiHealth() {
  try {
    let response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok && response.status === 404) {
      try {
        response = await fetch('/health', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        });
      } catch {
        // fallback failed, continue with original response
      }
    }

    if (!response.ok) return false;
    const data = await response.json();
    return data && (data.status === 'healthy' || data.status === 'ok');
  } catch {
    return false;
  }
}

/**
 * Helper to retrieve stored auth token
 */
export function getAuthToken() {
  return localStorage.getItem('aircon_auth_token');
}

/**
 * Helper to set auth token
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('aircon_auth_token', token);
  } else {
    localStorage.removeItem('aircon_auth_token');
  }
}

/**
 * Helper to fetch stored user details
 */
export function getStoredUser() {
  const user = localStorage.getItem('aircon_user');
  return user ? JSON.parse(user) : null;
}

/**
 * Helper to set stored user details
 */
export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('aircon_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('aircon_user');
  }
}

/**
 * Core HTTP client with JWT header injection.
 * Throws explicit offline errors if the backend server is unreachable.
 */
async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch (err) {
    // Network failure (server down, port closed, Vite proxy failed)
    throw new Error('Backend API server is offline or unreachable (http://localhost:5222). Please ensure the backend is running with "dotnet run".');
  }

  if (response.status === 401) {
    // Token expired or invalid — clear session and force re-login
    localStorage.removeItem('aircon_auth_token');
    localStorage.removeItem('aircon_user');
    window.location.reload();
    return;
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error('Backend API server is offline or unreachable (http://localhost:5222). Please ensure the backend is running with "dotnet run".');
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = (data && data.message) || data || `Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
}

/**
 * Format currency value cleanly with dollar sign and 2 decimal points
 */
export function formatCurrency(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format standard ISO or date string to readable format e.g. "Aug 15, 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format time string e.g. "09:30" or "14:00" to readable 12-hour format
 */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

/**
 * Normalizes customer objects from the API to guarantee both camelCase and snake_case properties
 */
export function normalizeCustomer(c) {
  if (!c || typeof c !== 'object') return c;
  const customerId = c.customerId ?? c.customer_id ?? c.id;
  const firstName = c.firstName ?? c.first_name ?? '';
  const lastName = c.lastName ?? c.last_name ?? '';
  const phone = c.phone ?? '';
  const email = c.email ?? '';
  const address = c.address ?? '';
  const createdAt = c.createdAt ?? c.created_at ?? '';

  const regionCode = c.regionCode ?? c.region_code ?? '';
  const regionName = c.regionName ?? c.region_name ?? '';
  const provinceCode = c.provinceCode ?? c.province_code ?? '';
  const provinceName = c.provinceName ?? c.province_name ?? '';
  const cityCode = c.cityCode ?? c.city_code ?? '';
  const cityName = c.cityName ?? c.city_name ?? '';
  const barangayCode = c.barangayCode ?? c.barangay_code ?? '';
  const barangayName = c.barangayName ?? c.barangay_name ?? '';
  const streetAddress = c.streetAddress ?? c.street_address ?? '';
  const latitude = c.latitude !== undefined && c.latitude !== null ? Number(c.latitude) : null;
  const longitude = c.longitude !== undefined && c.longitude !== null ? Number(c.longitude) : null;

  return {
    ...c,
    customerId,
    customer_id: customerId,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    phone,
    email,
    address,
    regionCode,
    region_code: regionCode,
    regionName,
    region_name: regionName,
    provinceCode,
    province_code: provinceCode,
    provinceName,
    province_name: provinceName,
    cityCode,
    city_code: cityCode,
    cityName,
    city_name: cityName,
    barangayCode,
    barangay_code: barangayCode,
    barangayName,
    barangay_name: barangayName,
    streetAddress,
    street_address: streetAddress,
    latitude,
    longitude,
    createdAt,
    created_at: createdAt,
  };
}

/**
 * Normalizes aircon unit objects from the API
 */
export function normalizeAircon(u) {
  if (!u || typeof u !== 'object') return u;
  const unitId = u.unitId ?? u.unit_id ?? u.id;
  const customerId = u.customerId ?? u.customer_id;
  const brand = u.brand ?? '';
  const model = u.model ?? '';
  const horsepower = u.horsepower ?? 1.5;
  const serialNumber = u.serialNumber ?? u.serial_number ?? '';
  const installationDate = u.installationDate ?? u.installation_date ?? '';
  const warrantyExpiry = u.warrantyExpiry ?? u.warranty_expiry ?? '';
  const location = u.location ?? '';
  const status = u.status ?? 'Active';

  return {
    ...u,
    unitId,
    unit_id: unitId,
    customerId,
    customer_id: customerId,
    brand,
    model,
    horsepower,
    serialNumber,
    serial_number: serialNumber,
    installationDate,
    installation_date: installationDate,
    warrantyExpiry,
    warranty_expiry: warrantyExpiry,
    location,
    status,
  };
}

/**
 * Normalizes maintenance schedule objects from the API
 */
export function normalizeSchedule(s) {
  if (!s || typeof s !== 'object') return s;
  const scheduleId = s.scheduleId ?? s.schedule_id ?? s.id;
  const customerId = s.customerId ?? s.customer_id;
  const unitId = s.unitId ?? s.unit_id;
  const technicianId = s.technicianId ?? s.technician_id;
  const scheduleDate = s.scheduleDate ?? s.schedule_date ?? '';
  const scheduleTime = s.scheduleTime ?? s.schedule_time ?? '';
  const status = s.status ?? 'Scheduled';
  const remarks = s.remarks ?? '';

  return {
    ...s,
    scheduleId,
    schedule_id: scheduleId,
    customerId,
    customer_id: customerId,
    unitId,
    unit_id: unitId,
    technicianId,
    technician_id: technicianId,
    scheduleDate,
    schedule_date: scheduleDate,
    scheduleTime,
    schedule_time: scheduleTime,
    status,
    remarks,
  };
}

/**
 * Normalizes customer map item objects from the API
 */
export function normalizeCustomerMapItem(item) {
  if (!item || typeof item !== 'object') return item;
  const customerId = item.customerId ?? item.customer_id ?? item.id;
  const firstName = item.firstName ?? item.first_name ?? '';
  const lastName = item.lastName ?? item.last_name ?? '';
  const phone = item.phone ?? '';
  const email = item.email ?? '';
  const address = item.address ?? '';
  const regionCode = item.regionCode ?? item.region_code ?? '';
  const regionName = item.regionName ?? item.region_name ?? '';
  const provinceCode = item.provinceCode ?? item.province_code ?? '';
  const provinceName = item.provinceName ?? item.province_name ?? '';
  const cityCode = item.cityCode ?? item.city_code ?? '';
  const cityName = item.cityName ?? item.city_name ?? '';
  const barangayCode = item.barangayCode ?? item.barangay_code ?? '';
  const barangayName = item.barangayName ?? item.barangay_name ?? '';
  const streetAddress = item.streetAddress ?? item.street_address ?? '';
  const latitude = item.latitude !== null && item.latitude !== undefined && !isNaN(Number(item.latitude)) ? Number(item.latitude) : null;
  const longitude = item.longitude !== null && item.longitude !== undefined && !isNaN(Number(item.longitude)) ? Number(item.longitude) : null;

  const rawUnits = item.airconUnits ?? item.aircon_units ?? [];
  const airconUnits = Array.isArray(rawUnits) ? rawUnits.map(normalizeAircon) : [];
  const airconCount = typeof item.airconCount === 'number'
    ? item.airconCount
    : (typeof item.aircon_count === 'number' ? item.aircon_count : airconUnits.length);

  const rawMaint = item.upcomingMaintenance ?? item.upcoming_maintenance;
  const upcomingMaintenance = rawMaint ? normalizeSchedule(rawMaint) : null;

  return {
    ...item,
    customerId,
    customer_id: customerId,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    phone,
    email,
    address,
    regionCode,
    region_code: regionCode,
    regionName,
    region_name: regionName,
    provinceCode,
    province_code: provinceCode,
    provinceName,
    province_name: provinceName,
    cityCode,
    city_code: cityCode,
    cityName,
    city_name: cityName,
    barangayCode,
    barangay_code: barangayCode,
    barangayName,
    barangay_name: barangayName,
    streetAddress,
    street_address: streetAddress,
    latitude,
    longitude,
    airconCount,
    aircon_count: airconCount,
    airconUnits,
    aircon_units: airconUnits,
    upcomingMaintenance,
    upcoming_maintenance: upcomingMaintenance,
  };
}

/**
 * Normalizes maintenance records from the API
 */
export function normalizeRecord(r) {
  if (!r || typeof r !== 'object') return r;
  const recordId = r.recordId ?? r.record_id ?? r.id;
  const scheduleId = r.scheduleId ?? r.schedule_id;
  const workPerformed = r.workPerformed ?? r.work_performed ?? '';
  const partsReplaced = r.partsReplaced ?? r.parts_replaced ?? '';
  const refrigerantAdded = r.refrigerantAdded ?? r.refrigerant_added ?? '';
  const technicianNotes = r.technicianNotes ?? r.technician_notes ?? '';
  const nextServiceDate = r.nextServiceDate ?? r.next_service_date ?? '';
  const completedDate = r.completedDate ?? r.completed_date ?? '';

  return {
    ...r,
    recordId,
    record_id: recordId,
    scheduleId,
    schedule_id: scheduleId,
    workPerformed,
    work_performed: workPerformed,
    partsReplaced,
    parts_replaced: partsReplaced,
    refrigerantAdded,
    refrigerant_added: refrigerantAdded,
    technicianNotes,
    technician_notes: technicianNotes,
    nextServiceDate,
    next_service_date: nextServiceDate,
    completedDate,
    completed_date: completedDate,
  };
}

/**
 * Normalizes spare parts from the API
 */
export function normalizeSparePart(p) {
  if (!p || typeof p !== 'object') return p;
  const partId = p.partId ?? p.part_id ?? p.id;
  const partName = p.partName ?? p.part_name ?? '';
  const category = p.category ?? 'General';
  const quantity = typeof p.quantity === 'number' ? p.quantity : parseInt(p.quantity, 10) || 0;
  const unitPrice = typeof p.unitPrice === 'number' ? p.unitPrice : (p.unit_price != null ? parseFloat(p.unit_price) : 0);
  const stockStatus = p.stockStatus ?? p.stock_status ?? (quantity === 0 ? 'Out of Stock' : quantity < 5 ? 'Low Stock' : 'In Stock');

  return {
    ...p,
    partId,
    part_id: partId,
    partName,
    part_name: partName,
    category,
    quantity,
    unitPrice,
    unit_price: unitPrice,
    stockStatus,
    stock_status: stockStatus,
  };
}

/**
 * Normalizes service requests from the API
 */
export function normalizeServiceRequest(req) {
  if (!req || typeof req !== 'object') return req;
  const requestId = req.requestId ?? req.request_id ?? req.id;
  const customerId = req.customerId ?? req.customer_id;
  const unitId = req.unitId ?? req.unit_id;
  const issueDescription = req.issueDescription ?? req.issue_description ?? '';
  const priority = req.priority ?? 'Medium';
  const status = req.status ?? 'Open';
  const assignedTechnician = req.assignedTechnician ?? req.assigned_technician;
  const requestDate = req.requestDate ?? req.request_date ?? '';

  return {
    ...req,
    requestId,
    request_id: requestId,
    customerId,
    customer_id: customerId,
    unitId,
    unit_id: unitId,
    issueDescription,
    issue_description: issueDescription,
    priority,
    status,
    assignedTechnician,
    assigned_technician: assignedTechnician,
    requestDate,
    request_date: requestDate,
  };
}

/**
 * Normalizes system users from the API
 */
export function normalizeUser(u) {
  if (!u || typeof u !== 'object') return u;
  const userId = u.userId ?? u.user_id ?? u.id;
  const fullName = u.fullName ?? u.full_name ?? u.username ?? '';
  const username = u.username ?? '';
  const role = u.role ?? 'Staff';
  const phone = u.phone ?? '';
  const email = u.email ?? '';
  const status = u.status ?? 'Active';
  const createdAt = u.createdAt ?? u.created_at ?? '';

  return {
    ...u,
    userId,
    user_id: userId,
    fullName,
    full_name: fullName,
    username,
    role,
    phone,
    email,
    status,
    createdAt,
    created_at: createdAt,
  };
}

// ----------------------------------------------------
// Authentication API (Real backend only — no fake demo login)
// ----------------------------------------------------
export const authApi = {
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      setAuthToken(data.token);
      setStoredUser({ userId: data.userId, username: data.username, role: data.role });
    }
    return data;
  },

  register: async (userData) => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  registerUser: async (userData) => {
    return request('/auth/register-user', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  forgotPassword: async (username) => {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  resetPassword: async (token, newPassword) => {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  logout: () => {
    setAuthToken(null);
    setStoredUser(null);
  }
};

// ----------------------------------------------------
// Users API (Real backend only)
// ----------------------------------------------------
export const usersApi = {
  getAll: async () => {
    const data = await request('/users');
    return Array.isArray(data) ? data.map(normalizeUser) : [];
  },
  getById: async (id) => {
    const data = await request(`/users/${id}`);
    return normalizeUser(data);
  },
  search: async (query) => {
    const data = await request(`/users/search?query=${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data.map(normalizeUser) : [];
  },
  getPaginated: async (page = 1, size = 25) => {
    const data = await request(`/users/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeUser) };
    }
    return data;
  },
  create: (data) => request('/users', {
    method: 'POST',
    body: JSON.stringify({
      FullName: data.fullName || data.full_name || '',
      Username: data.username || '',
      Password: data.password || '',
      Role: data.role || 'Staff',
      Phone: data.phone || null,
      Email: data.email || null,
      Status: data.status || 'Active',
    }),
  }),
  update: (id, data) => request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      FullName: data.fullName || data.full_name || '',
      Username: data.username || '',
      Role: data.role || 'Staff',
      Phone: data.phone || null,
      Email: data.email || null,
      Status: data.status || 'Active',
      NewPassword: data.newPassword || data.password || undefined,
    }),
  }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Customers API (Real backend only)
// ----------------------------------------------------
export const customersApi = {
  getAll: async () => {
    const data = await request('/customers');
    return Array.isArray(data) ? data.map(normalizeCustomer) : [];
  },
  getById: async (id) => {
    const data = await request(`/customers/${id}`);
    return normalizeCustomer(data);
  },
  search: async (query) => {
    const data = await request(`/customers/search?query=${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data.map(normalizeCustomer) : [];
  },
  getPaginated: async (page = 1, size = 25) => {
    const data = await request(`/customers/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeCustomer) };
    }
    return data;
  },
  create: async (data) => {
    const payload = {
      firstName: data.firstName || data.first_name || '',
      first_name: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      last_name: data.lastName || data.last_name || '',
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      regionCode: data.regionCode || data.region_code || null,
      regionName: data.regionName || data.region_name || null,
      provinceCode: data.provinceCode || data.province_code || null,
      provinceName: data.provinceName || data.province_name || null,
      cityCode: data.cityCode || data.city_code || null,
      cityName: data.cityName || data.city_name || null,
      barangayCode: data.barangayCode || data.barangay_code || null,
      barangayName: data.barangayName || data.barangay_name || null,
      streetAddress: data.streetAddress || data.street_address || null,
      latitude: data.latitude !== undefined && data.latitude !== null && data.latitude !== '' ? Number(data.latitude) : null,
      longitude: data.longitude !== undefined && data.longitude !== null && data.longitude !== '' ? Number(data.longitude) : null,
    };
    return request('/customers', { method: 'POST', body: JSON.stringify(payload) });
  },
  update: async (id, data) => {
    const payload = {
      firstName: data.firstName || data.first_name || '',
      first_name: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      last_name: data.lastName || data.last_name || '',
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      regionCode: data.regionCode || data.region_code || null,
      regionName: data.regionName || data.region_name || null,
      provinceCode: data.provinceCode || data.province_code || null,
      provinceName: data.provinceName || data.province_name || null,
      cityCode: data.cityCode || data.city_code || null,
      cityName: data.cityName || data.city_name || null,
      barangayCode: data.barangayCode || data.barangay_code || null,
      barangayName: data.barangayName || data.barangay_name || null,
      streetAddress: data.streetAddress || data.street_address || null,
      latitude: data.latitude !== undefined && data.latitude !== null && data.latitude !== '' ? Number(data.latitude) : null,
      longitude: data.longitude !== undefined && data.longitude !== null && data.longitude !== '' ? Number(data.longitude) : null,
    };
    return request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  /** Get customers for Customer Map Locator (>= 1 aircon unit & valid coordinates) */
  getMapLocations: async () => {
    const data = await request('/customers/map-locations');
    return Array.isArray(data) ? data.map(normalizeCustomerMapItem) : [];
  },

  /** Update customer coordinates (Admin or Staff) */
  updateCoordinates: (customerId, latitude, longitude) =>
    request(`/customers/${customerId}/coordinates`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude }),
    }),

  /** Get Google Maps API configuration */
  getMapsConfig: () => request('/customers/maps-config'),
};

// ----------------------------------------------------
// Aircon Units API (Real backend only)
// ----------------------------------------------------
export const airconApi = {
  getAll: async () => {
    const data = await request('/aircon-units');
    return Array.isArray(data) ? data.map(normalizeAircon) : [];
  },
  getById: async (id) => {
    const data = await request(`/aircon-units/${id}`);
    return normalizeAircon(data);
  },
  getByCustomer: async (customerId) => {
    const data = await request(`/aircon-units/by-customer/${customerId}`);
    return Array.isArray(data) ? data.map(normalizeAircon) : [];
  },
  search: async (query) => {
    const data = await request(`/aircon-units/search?query=${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data.map(normalizeAircon) : [];
  },
  getPaginated: async (page = 1, size = 25) => {
    const data = await request(`/aircon-units/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeAircon) };
    }
    return data;
  },
  create: (data) => request('/aircon-units', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: data.customerId || data.customer_id,
      brand: data.brand || null,
      model: data.model || null,
      horsepower: data.horsepower || null,
      serial_number: data.serialNumber || data.serial_number || null,
      installation_date: data.installationDate || data.installation_date || null,
      warranty_expiry: data.warrantyExpiry || data.warranty_expiry || null,
      location: data.location || null,
      status: data.status || 'Active',
    }),
  }),
  update: (id, data) => request(`/aircon-units/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      unit_id: id,
      customer_id: data.customerId || data.customer_id,
      brand: data.brand || null,
      model: data.model || null,
      horsepower: data.horsepower || null,
      serial_number: data.serialNumber || data.serial_number || null,
      installation_date: data.installationDate || data.installation_date || null,
      warranty_expiry: data.warrantyExpiry || data.warranty_expiry || null,
      location: data.location || null,
      status: data.status || 'Active',
    }),
  }),
  delete: (id) => request(`/aircon-units/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Maintenance API (Real backend only)
// ----------------------------------------------------
export const maintenanceApi = {
  getSchedules: async () => {
    const data = await request('/maintenance/schedules');
    return Array.isArray(data) ? data.map(normalizeSchedule) : [];
  },
  getScheduleById: async (id) => {
    const data = await request(`/maintenance/schedules/${id}`);
    return normalizeSchedule(data);
  },
  getSchedulesByCustomer: async (customerId) => {
    const data = await request(`/maintenance/schedules/by-customer/${customerId}`);
    return Array.isArray(data) ? data.map(normalizeSchedule) : [];
  },
  getSchedulesByTechnician: async (technicianId) => {
    const data = await request(`/maintenance/schedules/by-technician/${technicianId}`);
    return Array.isArray(data) ? data.map(normalizeSchedule) : [];
  },
  getSchedulesPaginated: async (page = 1, size = 25) => {
    const data = await request(`/maintenance/schedules/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeSchedule) };
    }
    return data;
  },
  createSchedule: (data) => request('/maintenance/schedules', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: data.customerId || data.customer_id,
      unit_id: data.unitId || data.unit_id,
      technician_id: data.technicianId || data.technician_id,
      schedule_date: data.scheduleDate || data.schedule_date || '',
      schedule_time: data.scheduleTime || data.schedule_time || '',
      status: data.status || 'Scheduled',
      remarks: data.remarks || null,
    }),
  }),
  updateSchedule: (id, data) => request(`/maintenance/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      schedule_id: id,
      customer_id: data.customerId || data.customer_id,
      unit_id: data.unitId || data.unit_id,
      technician_id: data.technicianId || data.technician_id,
      schedule_date: data.scheduleDate || data.schedule_date || '',
      schedule_time: data.scheduleTime || data.schedule_time || '',
      status: data.status || 'Scheduled',
      remarks: data.remarks || null,
    }),
  }),
  deleteSchedule: (id) => request(`/maintenance/schedules/${id}`, { method: 'DELETE' }),

  getRecords: async () => {
    const data = await request('/maintenance/records');
    return Array.isArray(data) ? data.map(normalizeRecord) : [];
  },
  getRecordById: async (id) => {
    const data = await request(`/maintenance/records/${id}`);
    return normalizeRecord(data);
  },
  getRecordBySchedule: async (scheduleId) => {
    const data = await request(`/maintenance/records/by-schedule/${scheduleId}`);
    return normalizeRecord(data);
  },
  getRecordsPaginated: async (page = 1, size = 25) => {
    const data = await request(`/maintenance/records/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeRecord) };
    }
    return data;
  },
  createRecord: (data) => request('/maintenance/records', {
    method: 'POST',
    body: JSON.stringify({
      schedule_id: data.scheduleId || data.schedule_id,
      work_performed: data.workPerformed || data.work_performed || null,
      parts_replaced: data.partsReplaced || data.parts_replaced || null,
      refrigerant_added: data.refrigerantAdded || data.refrigerant_added || null,
      technician_notes: data.technicianNotes || data.technician_notes || null,
      next_service_date: data.nextServiceDate || data.next_service_date || null,
      completed_date: data.completedDate || data.completed_date || null,
    }),
  }),
  updateRecord: (id, data) => request(`/maintenance/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      record_id: id,
      schedule_id: data.scheduleId || data.schedule_id,
      work_performed: data.workPerformed || data.work_performed || null,
      parts_replaced: data.partsReplaced || data.parts_replaced || null,
      refrigerant_added: data.refrigerantAdded || data.refrigerant_added || null,
      technician_notes: data.technicianNotes || data.technician_notes || null,
      next_service_date: data.nextServiceDate || data.next_service_date || null,
      completed_date: data.completedDate || data.completed_date || null,
    }),
  }),
  deleteRecord: (id) => request(`/maintenance/records/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Spare Parts API (Real backend only)
// ----------------------------------------------------
export const sparePartsApi = {
  getAll: async () => {
    const data = await request('/spare-parts');
    return Array.isArray(data) ? data.map(normalizeSparePart) : [];
  },
  getById: async (id) => {
    const data = await request(`/spare-parts/${id}`);
    return normalizeSparePart(data);
  },
  search: async (query) => {
    const data = await request(`/spare-parts/search?query=${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data.map(normalizeSparePart) : [];
  },
  getPaginated: async (page = 1, size = 25) => {
    const data = await request(`/spare-parts/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeSparePart) };
    }
    return data;
  },
  create: (data) => request('/spare-parts', {
    method: 'POST',
    body: JSON.stringify({
      part_name: data.partName || data.part_name || '',
      category: data.category || null,
      quantity: typeof data.quantity === 'number' ? data.quantity : parseInt(data.quantity, 10) || 0,
      unit_price: typeof data.unitPrice === 'number' ? data.unitPrice : (data.unit_price != null ? parseFloat(data.unit_price) : 0),
      stock_status: data.stockStatus || data.stock_status || 'In Stock',
    }),
  }),
  update: (id, data) => request(`/spare-parts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      part_id: id,
      part_name: data.partName || data.part_name || '',
      category: data.category || null,
      quantity: typeof data.quantity === 'number' ? data.quantity : parseInt(data.quantity, 10) || 0,
      unit_price: typeof data.unitPrice === 'number' ? data.unitPrice : (data.unit_price != null ? parseFloat(data.unit_price) : 0),
      stock_status: data.stockStatus || data.stock_status || 'In Stock',
    }),
  }),
  delete: (id) => request(`/spare-parts/${id}`, { method: 'DELETE' }),

  getUsageByRecord: (recordId) => request(`/parts-usage/by-record/${recordId}`),
  addUsage: (data) => request('/parts-usage', {
    method: 'POST',
    body: JSON.stringify({
      record_id: data.recordId || data.record_id,
      part_id: data.partId || data.part_id,
      quantity_used: data.quantityUsed || data.quantity_used || 1,
    }),
  }),
  deleteUsage: (id) => request(`/parts-usage/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Service Requests API (Real backend only)
// ----------------------------------------------------
export const serviceRequestsApi = {
  getAll: async () => {
    const data = await request('/service-requests');
    return Array.isArray(data) ? data.map(normalizeServiceRequest) : [];
  },
  getById: async (id) => {
    const data = await request(`/service-requests/${id}`);
    return normalizeServiceRequest(data);
  },
  getByCustomer: async (customerId) => {
    const data = await request(`/service-requests/by-customer/${customerId}`);
    return Array.isArray(data) ? data.map(normalizeServiceRequest) : [];
  },
  getByTechnician: async (technicianId) => {
    const data = await request(`/service-requests/by-technician/${technicianId}`);
    return Array.isArray(data) ? data.map(normalizeServiceRequest) : [];
  },
  getByStatus: async (status) => {
    const data = await request(`/service-requests/by-status?status=${encodeURIComponent(status)}`);
    return Array.isArray(data) ? data.map(normalizeServiceRequest) : [];
  },
  getPaginated: async (page = 1, size = 25) => {
    const data = await request(`/service-requests/paginated?pageNumber=${page}&pageSize=${size}`);
    if (data && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalizeServiceRequest) };
    }
    return data;
  },
  create: (data) => request('/service-requests', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: data.customerId || data.customer_id,
      unit_id: data.unitId || data.unit_id,
      issue_description: data.issueDescription || data.issue_description || '',
      priority: data.priority || 'Medium',
      status: data.status || 'Open',
      assigned_technician: data.assignedTechnician || data.assigned_technician || null,
    }),
  }),
  update: (id, data) => request(`/service-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      request_id: id,
      customer_id: data.customerId || data.customer_id,
      unit_id: data.unitId || data.unit_id,
      issue_description: data.issueDescription || data.issue_description || '',
      priority: data.priority || 'Medium',
      status: data.status || 'Open',
      assigned_technician: data.assignedTechnician || data.assigned_technician || null,
    }),
  }),
  assignTechnician: (id, technicianId) => request(`/service-requests/${id}/assign?technicianId=${technicianId}`, { method: 'PATCH' }),
  updateStatus: (id, status) => request(`/service-requests/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }),
  delete: (id) => request(`/service-requests/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Notifications API (Real backend only)
// ----------------------------------------------------
export const notificationsApi = {
  getByUser: (userId) => request(`/notifications/user/${userId}`),
  getUnreadByUser: (userId) => request(`/notifications/user/${userId}/unread`),
  getUnreadCount: (userId) => request(`/notifications/user/${userId}/unread-count`),
  getById: (id) => request(`/notifications/${id}`),
  create: (data) => request('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  markAsRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: (userId) => request(`/notifications/user/${userId}/read-all`, { method: 'PATCH' }),
  delete: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
};

// ----------------------------------------------------
// Stores / Branches API (Real backend only)
// ----------------------------------------------------
export function normalizeStore(s) {
  if (!s) return null;
  return {
    storeId: s.store_id ?? s.storeId,
    name: s.name ?? '',
    code: s.code ?? '',
    status: s.status ?? 'Open',
    isMainBranch: Boolean(s.is_main_branch ?? s.isMainBranch),
    street: s.street ?? '',
    barangay: s.barangay ?? '',
    cityMunicipality: s.city_municipality ?? s.cityMunicipality ?? '',
    province: s.province ?? '',
    region: s.region ?? '',
    postalCode: s.postal_code ?? s.postalCode ?? '',
    latitude: Number(s.latitude ?? 0),
    longitude: Number(s.longitude ?? 0),
    landmarkNotes: s.landmark_notes ?? s.landmarkNotes ?? '',
    locationSource: s.location_source ?? s.locationSource ?? 'Pin dropped',
    isVerified: Boolean(s.is_verified ?? s.isVerified),
    phone: s.phone ?? '',
    mobile: s.mobile ?? '',
    email: s.email ?? '',
    websiteUrl: s.website_url ?? s.websiteUrl ?? '',
    openingHours: s.opening_hours ?? s.openingHours ?? null,
    serviceRadiusKm: Number(s.service_radius_km ?? s.serviceRadiusKm ?? 15),
    servicesOffered: s.services_offered ?? s.servicesOffered ?? null,
    acceptsWalkIns: Boolean(s.accepts_walk_ins ?? s.acceptsWalkIns ?? true),
    parkingNotes: s.parking_notes ?? s.parkingNotes ?? '',
    managerId: s.manager_id ?? s.managerId ?? null,
    managerName: s.manager_name ?? s.managerName ?? null,
    assignedTechnicians: s.assigned_technicians ?? s.assignedTechnicians ?? null,
    businessName: s.business_name ?? s.businessName ?? '',
    registrationNumber: s.registration_number ?? s.registrationNumber ?? '',
    logoUrl: s.logo_url ?? s.logoUrl ?? null,
    createdAt: s.created_at ?? s.createdAt ?? null,
    updatedAt: s.updated_at ?? s.updatedAt ?? null,
    assignedTechnicianCount: Number(s.assigned_technician_count ?? s.assignedTechnicianCount ?? 0),
    assignedCustomerCount: Number(s.assigned_customer_count ?? s.assignedCustomerCount ?? 0),
    activeRequestCount: Number(s.active_request_count ?? s.activeRequestCount ?? 0),
  };
}

export const storesApi = {
  getAll: async () => {
    const data = await request('/stores');
    return Array.isArray(data) ? data.map(normalizeStore) : [];
  },
  getById: async (id) => {
    const data = await request(`/stores/${id}`);
    return normalizeStore(data);
  },
  create: (data) => request('/stores', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => request(`/stores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  checkDelete: (id) => request(`/stores/${id}/check-delete`),
  delete: (id) => request(`/stores/${id}`, { method: 'DELETE' }),
  reassignAndDelete: (id, targetStoreId) => request(`/stores/${id}/reassign-and-delete`, {
    method: 'POST',
    body: JSON.stringify({ targetStoreId }),
  }),
  setMain: (id) => request(`/stores/${id}/set-main`, { method: 'POST' }),
};
