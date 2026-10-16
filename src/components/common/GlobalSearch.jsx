import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Search,
  X,
  Users,
  Wind,
  Wrench,
  Package,
  Store,
  UserCheck,
  CalendarCheck,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import {
  customersApi,
  airconApi,
  serviceRequestsApi,
  sparePartsApi,
  storesApi,
  usersApi,
  maintenanceApi,
  formatCurrency,
  formatDate,
  formatTime,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const RECENT_SEARCHES_KEY = 'aeroflow_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// In-memory module cache for fast subsequent searches
let memoryCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds TTL

export function invalidateGlobalSearchCache() {
  memoryCache = null;
  cacheTimestamp = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aeroflow-search-cache-invalidate'));
  }
}

/**
 * Text highlighter component for search matches
 */
function HighlightedText({ text, query }) {
  if (!text) return null;
  if (!query || !query.trim()) return <span>{text}</span>;

  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return <span>{text}</span>;

  const escaped = rawTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = String(text).split(regex);

  return (
    <span>
      {parts.map((part, idx) => {
        const isMatch = regex.test(part);
        return isMatch ? (
          <mark
            key={idx}
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--text-primary)',
            }}
            className="font-bold underline decoration-sky-400 rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </span>
  );
}

export function GlobalSearch({ onNavigate, globalSearch = '', setGlobalSearch }) {
  const { isAdmin } = useAuth();
  const [inputValue, setInputValue] = useState(globalSearch || '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Position coordinates for the dropdown portal
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const inputContainerRef = useRef(null);
  const inputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Detect platform for shortcut label (⌘K on Mac, Ctrl+K on other platforms)
  const isMac = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  }, []);
  const shortcutBadgeText = isMac ? '⌘K' : 'Ctrl+K';

  // Load recent searches from localStorage
  const loadRecentSearches = useCallback(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const saveRecentSearch = useCallback((term) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    try {
      const existing = localStorage.getItem(RECENT_SEARCHES_KEY);
      let list = existing ? JSON.parse(existing) : [];
      if (!Array.isArray(list)) list = [];
      list = [cleanTerm, ...list.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
      setRecentSearches(list);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const removeRecentSearch = useCallback((termToRemove) => {
    try {
      const existing = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!existing) return;
      const list = JSON.parse(existing);
      if (Array.isArray(list)) {
        const updated = list.filter((item) => item !== termToRemove);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        setRecentSearches(updated);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const clearAllRecentSearches = useCallback(() => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Synchronize incoming globalSearch prop
  useEffect(() => {
    if (globalSearch !== undefined && globalSearch !== inputValue) {
      setInputValue(globalSearch);
    }
  }, [globalSearch]);

  // Debounce user input by 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Listen for cache invalidation events (e.g. after create/update/delete)
  useEffect(() => {
    const handleInvalidate = () => {
      memoryCache = null;
      cacheTimestamp = 0;
    };
    window.addEventListener('aeroflow-search-cache-invalidate', handleInvalidate);
    return () => window.removeEventListener('aeroflow-search-cache-invalidate', handleInvalidate);
  }, []);

  // Recalculate dropdown position relative to the input container
  const updateDropdownPosition = useCallback(() => {
    if (!inputContainerRef.current) return;
    const rect = inputContainerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const maxDropdownWidth = 600;
    const padding = 16;

    let width = Math.min(Math.max(rect.width, 420), maxDropdownWidth);
    if (viewportWidth < 480) {
      width = viewportWidth - padding * 2;
    }

    let left = rect.left;
    if (left + width > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - width - padding);
    }

    setDropdownPosition({
      top: rect.bottom + 8,
      left: Math.max(padding, left),
      width,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
      return () => {
        window.removeEventListener('resize', updateDropdownPosition);
        window.removeEventListener('scroll', updateDropdownPosition, true);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Fetch cache lazily on first search focus
  const ensureDataLoaded = useCallback(async () => {
    const now = Date.now();
    if (memoryCache && now - cacheTimestamp < CACHE_TTL) {
      return memoryCache;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [cRes, aRes, rRes, pRes, sRes, uRes, mRes] = await Promise.allSettled([
        customersApi.getAll(),
        airconApi.getAll(),
        serviceRequestsApi.getAll(),
        sparePartsApi.getAll(),
        storesApi.getAll(),
        isAdmin ? usersApi.getAll() : Promise.resolve([]),
        maintenanceApi.getSchedules(),
      ]);

      const customers = cRes.status === 'fulfilled' && Array.isArray(cRes.value) ? cRes.value : [];
      const airconUnits = aRes.status === 'fulfilled' && Array.isArray(aRes.value) ? aRes.value : [];
      const serviceRequests = rRes.status === 'fulfilled' && Array.isArray(rRes.value) ? rRes.value : [];
      const spareParts = pRes.status === 'fulfilled' && Array.isArray(pRes.value) ? pRes.value : [];
      const stores = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      const users = uRes.status === 'fulfilled' && Array.isArray(uRes.value) ? uRes.value : [];
      const schedules = mRes.status === 'fulfilled' && Array.isArray(mRes.value) ? mRes.value : [];

      memoryCache = {
        customers,
        airconUnits,
        serviceRequests,
        spareParts,
        stores,
        users,
        schedules,
      };
      cacheTimestamp = Date.now();
      setCacheVersion((v) => v + 1);
      return memoryCache;
    } catch (err) {
      console.error('Failed to preload search index data:', err);
      setLoadError('Failed to load records index for search. Click retry.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setIsOpen(true);
    updateDropdownPosition();
    ensureDataLoaded();
  }, [ensureDataLoaded, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputContainerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcut: Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setMobileExpanded(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
          inputRef.current?.select();
        }
        setIsOpen(true);
        updateDropdownPosition();
        ensureDataLoaded();
        return;
      }

      if (e.key === 'Escape' && (isOpen || mobileExpanded)) {
        e.preventDefault();
        setIsOpen(false);
        setMobileExpanded(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isMac, isOpen, mobileExpanded, ensureDataLoaded, updateDropdownPosition]);

  // ========================================================
  // Search Index Query Matching & Ranking Algorithm
  // ========================================================
  const searchResults = useMemo(() => {
    if (!memoryCache || debouncedQuery.length < 2) {
      return { groups: [], totalCount: 0, flatList: [] };
    }

    const q = debouncedQuery.toLowerCase().replace(/\s+/g, ' ');
    const tokens = q.split(' ').filter(Boolean);

    // Scoring function:
    // 1000 = exact serial / ID match
    // 500  = starts-with
    // 100  = contains
    const computeScore = (primaryId, mainText, secondaryText) => {
      const idStr = String(primaryId || '').toLowerCase().trim();
      const mainStr = String(mainText || '').toLowerCase().trim();
      const secStr = String(secondaryText || '').toLowerCase().trim();

      // 1. Exact ID or Serial match
      if (idStr === q || idStr === `req-${q}` || idStr === `#req-${q}` || idStr === `part-${q}`) {
        return 1000;
      }

      // 2. Starts with query
      if (idStr.startsWith(q) || mainStr.startsWith(q)) {
        return 500;
      }

      // 3. Contains all query tokens
      const matchesMain = tokens.every((t) => mainStr.includes(t));
      const matchesSec = tokens.every((t) => secStr.includes(t));
      const matchesId = tokens.every((t) => idStr.includes(t));

      if (matchesId || matchesMain) {
        return 100;
      }
      if (matchesSec) {
        return 50;
      }

      return 0;
    };

    const {
      customers = [],
      airconUnits = [],
      serviceRequests = [],
      spareParts = [],
      stores = [],
      users = [],
      schedules = [],
    } = memoryCache;

    // Fast lookup maps for associated customer & unit names
    const customerMap = new Map();
    customers.forEach((c) => {
      const id = c.customerId ?? c.customer_id;
      if (id) {
        customerMap.set(id, `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Client');
      }
    });

    const unitMap = new Map();
    airconUnits.forEach((u) => {
      const id = u.unitId ?? u.unit_id;
      if (id) {
        unitMap.set(id, `${u.brand || ''} ${u.model || ''}`.trim());
      }
    });

    const groups = [];
    let flatIndex = 0;
    const flatList = [];

    // Helper to evaluate and group results
    const processGroup = (groupId, label, icon, tab, rawItems, mapper) => {
      const scored = [];
      for (const item of rawItems) {
        const mapped = mapper(item);
        if (!mapped) continue;
        const score = computeScore(mapped.primaryId, mapped.mainText, mapped.secondaryText);
        if (score > 0) {
          scored.push({ ...mapped, score });
        }
      }

      if (scored.length === 0) return;

      // Sort by score descending, then mainText
      scored.sort((a, b) => b.score - a.score || a.mainText.localeCompare(b.mainText));

      const totalGroupMatches = scored.length;
      const topItems = scored.slice(0, 5).map((item) => {
        const itemWithIndex = {
          ...item,
          tab,
          flatIndex: flatIndex++,
        };
        flatList.push(itemWithIndex);
        return itemWithIndex;
      });

      groups.push({
        id: groupId,
        label,
        icon,
        tab,
        items: topItems,
        totalCount: totalGroupMatches,
      });
    };

    // 1. Customers
    processGroup('customers', 'Customers', Users, 'customers', customers, (c) => {
      const custId = c.customerId ?? c.customer_id;
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Customer';
      const address = [c.streetAddress, c.barangayName, c.cityName, c.provinceName]
        .filter(Boolean)
        .join(', ') || c.address || 'Address on file';
      const secondary = [c.phone, c.email, address].filter(Boolean).join(' · ');

      return {
        id: `customer-${custId}`,
        primaryId: String(custId),
        mainText: fullName,
        secondaryText: secondary,
        itemData: c,
        targetRecord: { type: 'customer', id: custId },
        searchQuery: fullName,
      };
    });

    // 2. Aircon Units
    processGroup('aircon', 'Aircon Units', Wind, 'aircon', airconUnits, (u) => {
      const unitId = u.unitId ?? u.unit_id;
      const custId = u.customerId ?? u.customer_id;
      const ownerName = customerMap.get(custId) || 'Customer Unit';
      const main = `${u.brand || ''} ${u.model || ''}`.trim() || 'HVAC Unit';
      const secondary = `Serial: ${u.serialNumber || 'N/A'} · ${ownerName}${
        u.location ? ` (${u.location})` : ''
      }`;

      return {
        id: `unit-${unitId}`,
        primaryId: u.serialNumber || String(unitId),
        mainText: main,
        secondaryText: secondary,
        itemData: u,
        targetRecord: { type: 'unit', id: unitId },
        searchQuery: u.serialNumber || main,
      };
    });

    // 3. Service Requests
    processGroup('requests', 'Service Requests', Wrench, 'requests', serviceRequests, (r) => {
      const reqId = r.requestId ?? r.request_id;
      const custId = r.customerId ?? r.customer_id;
      const clientName = customerMap.get(custId) || 'Client';
      const reqTag = `#REQ-${reqId}`;
      const main = `${reqTag}: ${r.issueDescription || r.issue_description || 'Maintenance Issue'}`;
      const secondary = `Priority: ${r.priority || 'Medium'} · Status: ${r.status || 'Open'} · ${clientName}`;

      return {
        id: `req-${reqId}`,
        primaryId: reqTag,
        mainText: main,
        secondaryText: secondary,
        itemData: r,
        targetRecord: { type: 'request', id: reqId },
        searchQuery: reqTag,
      };
    });

    // 4. Spare Parts
    processGroup('inventory', 'Spare Parts', Package, 'inventory', spareParts, (p) => {
      const partId = p.partId ?? p.part_id;
      const partTag = `#${partId}`;
      const main = p.partName || p.part_name || 'Spare Part';
      const priceStr = formatCurrency(p.unitPrice ?? p.unit_price ?? 0);
      const secondary = `Category: ${p.category || 'General'} · Qty: ${p.quantity ?? 0} · ${priceStr} · ${
        p.stockStatus || p.stock_status || 'In Stock'
      }`;

      return {
        id: `part-${partId}`,
        primaryId: partTag,
        mainText: main,
        secondaryText: secondary,
        itemData: p,
        targetRecord: { type: 'part', id: partId },
        searchQuery: main,
      };
    });

    // 5. Stores
    processGroup('stores', 'Stores', Store, 'stores', stores, (s) => {
      const storeId = s.storeId ?? s.store_id;
      const code = s.code ? ` (${s.code})` : '';
      const main = `${s.name || 'Store Branch'}${code}${s.isMainBranch ? ' ★ MAIN' : ''}`;
      const address = [s.street, s.barangay, s.cityMunicipality || s.city].filter(Boolean).join(', ');
      const secondary = address || s.phone || 'Service Hub';

      return {
        id: `store-${storeId}`,
        primaryId: s.code || String(storeId),
        mainText: main,
        secondaryText: secondary,
        itemData: s,
        targetRecord: { type: 'store', id: storeId },
        searchQuery: s.name || s.code,
      };
    });

    // 6. Users (Admin only)
    if (isAdmin) {
      processGroup('users', 'Users', UserCheck, 'users', users, (u) => {
        const userId = u.userId ?? u.user_id;
        const main = `${u.fullName || u.username || 'System User'} (@${u.username})`;
        const secondary = `Role: ${u.role || 'Staff'} · Status: ${u.status || 'Active'}${
          u.email ? ` · ${u.email}` : ''
        }`;

        return {
          id: `user-${userId}`,
          primaryId: u.username || String(userId),
          mainText: main,
          secondaryText: secondary,
          itemData: u,
          targetRecord: { type: 'user', id: userId },
          searchQuery: u.username || u.fullName,
        };
      });
    }

    // 7. Maintenance
    processGroup('maintenance', 'Maintenance', CalendarCheck, 'maintenance', schedules, (m) => {
      const schedId = m.scheduleId ?? m.schedule_id;
      const custId = m.customerId ?? m.customer_id;
      const unitId = m.unitId ?? m.unit_id;
      const custName = customerMap.get(custId) || 'Client';
      const unitName = unitMap.get(unitId) || 'Aircon Unit';
      const dateStr = m.scheduleDate ? formatDate(m.scheduleDate) : 'Upcoming';
      const timeStr = m.scheduleTime ? ` at ${formatTime(m.scheduleTime)}` : '';
      const main = `Maintenance: ${unitName} · ${custName}`;
      const secondary = `Date: ${dateStr}${timeStr} · Status: ${m.status || 'Scheduled'}${
        m.remarks ? ` (${m.remarks})` : ''
      }`;

      return {
        id: `sched-${schedId}`,
        primaryId: String(schedId),
        mainText: main,
        secondaryText: secondary,
        itemData: m,
        targetRecord: { type: 'maintenance', id: schedId },
        searchQuery: custName || unitName,
      };
    });

    return {
      groups,
      totalCount: flatList.length,
      flatList,
    };
  }, [cacheVersion, debouncedQuery, isAdmin]);

  // Reset highlighted item when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  // Navigate to selected search result
  const handleSelectResult = useCallback(
    (item) => {
      saveRecentSearch(debouncedQuery || item.mainText);
      setIsOpen(false);
      setMobileExpanded(false);

      if (onNavigate) {
        onNavigate({
          tab: item.tab,
          searchQuery: item.searchQuery,
          targetRecord: item.targetRecord,
        });
      }

      if (setGlobalSearch) {
        setGlobalSearch(item.searchQuery || '');
      }
    },
    [debouncedQuery, onNavigate, saveRecentSearch, setGlobalSearch]
  );

  // Navigate to group "See all"
  const handleSeeAll = useCallback(
    (group) => {
      saveRecentSearch(debouncedQuery);
      setIsOpen(false);
      setMobileExpanded(false);

      if (onNavigate) {
        onNavigate({
          tab: group.tab,
          searchQuery: debouncedQuery,
          targetRecord: null,
        });
      }

      if (setGlobalSearch) {
        setGlobalSearch(debouncedQuery);
      }
    },
    [debouncedQuery, onNavigate, saveRecentSearch, setGlobalSearch]
  );

  // Keyboard navigation within the dropdown
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      const totalItems = searchResults.flatList.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (totalItems === 0) return;
        setHighlightedIndex((prev) => (prev + 1 >= totalItems ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (totalItems === 0) return;
        setHighlightedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && searchResults.flatList[highlightedIndex]) {
          handleSelectResult(searchResults.flatList[highlightedIndex]);
        } else if (searchResults.groups.length > 0 && searchResults.groups[0].items[0]) {
          handleSelectResult(searchResults.groups[0].items[0]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setMobileExpanded(false);
        inputRef.current?.blur();
      }
    },
    [isOpen, searchResults, highlightedIndex, handleSelectResult]
  );

  // Clear search input
  const handleClear = useCallback(() => {
    setInputValue('');
    setDebouncedQuery('');
    setHighlightedIndex(-1);
    if (setGlobalSearch) setGlobalSearch('');
    inputRef.current?.focus();
  }, [setGlobalSearch]);

  const activeDescendantId =
    highlightedIndex >= 0 && searchResults.flatList[highlightedIndex]
      ? `search-item-${searchResults.flatList[highlightedIndex].id}`
      : undefined;

  // Render the Results Dropdown in a Portal
  const renderDropdownPortal = () => {
    if (!isOpen && !mobileExpanded) return null;
    if (typeof document === 'undefined') return null;

    const isQueryEmpty = inputValue.trim().length === 0;
    const isQueryTooShort = inputValue.trim().length > 0 && inputValue.trim().length < 2;

    const content = (
      <div
        ref={dropdownRef}
        id="global-search-menu"
        role="listbox"
        style={{
          position: mobileExpanded ? 'fixed' : 'fixed',
          top: mobileExpanded ? '64px' : `${dropdownPosition.top}px`,
          left: mobileExpanded ? '16px' : `${dropdownPosition.left}px`,
          width: mobileExpanded ? 'calc(100vw - 32px)' : `${dropdownPosition.width}px`,
          maxHeight: mobileExpanded ? 'calc(100vh - 80px)' : 'min(75vh, 560px)',
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
        className="z-[9999] rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Dropdown Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4 no-scrollbar">
          {/* Loading State: Skeleton Placeholders */}
          {isLoading && (
            <div className="p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                <span>Indexing system records across modules...</span>
              </div>
              <div className="space-y-2 pt-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{ backgroundColor: 'var(--card-inner)', borderColor: 'var(--border)' }}
                    className="p-3 rounded-xl border animate-pulse flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-300 dark:bg-slate-700 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-3/5 h-3 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="w-4/5 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load Error State */}
          {!isLoading && loadError && (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={ensureDataLoaded}
                style={{ backgroundColor: 'var(--card-inner)', borderColor: 'var(--border)' }}
                className="mt-2 px-3 py-1.5 rounded-xl border text-xs font-medium hover:opacity-80 transition-opacity"
              >
                Retry Indexing
              </button>
            </div>
          )}

          {/* Recent Searches State (When query is empty) */}
          {!isLoading && !loadError && isQueryEmpty && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span style={{ color: 'var(--text-muted)' }} className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recent Searches</span>
                </span>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllRecentSearches}
                    style={{ color: 'var(--text-muted)' }}
                    className="text-[10px] font-semibold hover:text-rose-500 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {recentSearches.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }} className="px-3 py-6 text-center text-xs space-y-1">
                  <p className="font-medium">No recent searches yet</p>
                  <p className="text-[11px]">Type at least 2 characters to search across all HVAC fleet records.</p>
                </div>
              ) : (
                <div className="space-y-1 mt-1">
                  {recentSearches.map((term, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setInputValue(term);
                        setDebouncedQuery(term);
                        inputRef.current?.focus();
                      }}
                      style={{ color: 'var(--text-primary)' }}
                      className="group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer hover:bg-[var(--card-inner)] transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                        <span className="font-medium truncate">{term}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        style={{ color: 'var(--text-muted)' }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 rounded-md transition-all"
                        title="Remove from history"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Under 2 Characters Hint State */}
          {!isLoading && !loadError && isQueryTooShort && (
            <div style={{ color: 'var(--text-muted)' }} className="p-6 text-center text-xs space-y-1">
              <Search className="w-5 h-5 mx-auto opacity-50 mb-1" />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Keep typing...
              </p>
              <p className="text-[11px]">Search starts at 2 characters.</p>
            </div>
          )}

          {/* Empty Search Results State */}
          {!isLoading && !loadError && !isQueryEmpty && !isQueryTooShort && searchResults.groups.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                No results for &ldquo;{debouncedQuery}&rdquo;
              </h5>
              <p className="text-xs max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Try searching by client name, aircon serial number (e.g. &ldquo;DK-2024&rdquo;), ticket ID (e.g. &ldquo;REQ-4&rdquo;), or spare part name.
              </p>
            </div>
          )}

          {/* Grouped Search Results */}
          {!isLoading &&
            !loadError &&
            searchResults.groups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.id} className="space-y-1">
                  {/* Category Header */}
                  <div className="flex items-center justify-between px-3 py-1">
                    <span
                      style={{ color: 'var(--text-muted)' }}
                      className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <GroupIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>{group.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--card-inner)] border border-[var(--border)]">
                        {group.totalCount}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSeeAll(group)}
                      className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 transition-all"
                    >
                      <span>See all</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Group Items List */}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isHighlighted = highlightedIndex === item.flatIndex;
                      return (
                        <div
                          key={item.id}
                          id={`search-item-${item.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => handleSelectResult(item)}
                          onMouseEnter={() => setHighlightedIndex(item.flatIndex)}
                          style={{
                            backgroundColor: isHighlighted ? 'var(--card-inner)' : 'transparent',
                            borderColor: isHighlighted ? 'var(--border)' : 'transparent',
                          }}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                            isHighlighted ? 'ring-1 ring-[var(--accent)]/30' : ''
                          }`}
                        >
                          {/* Item Icon */}
                          <div
                            style={{
                              backgroundColor: 'var(--card-inner)',
                              borderColor: 'var(--border)',
                            }}
                            className="w-8 h-8 rounded-xl border shrink-0 flex items-center justify-center mt-0.5 shadow-xs"
                          >
                            <GroupIcon className="w-4 h-4 text-[var(--accent)]" />
                          </div>

                          {/* Item Text Details */}
                          <div className="flex-1 min-w-0">
                            <div
                              style={{ color: 'var(--text-primary)' }}
                              className="font-semibold text-xs truncate leading-snug"
                            >
                              <HighlightedText text={item.mainText} query={debouncedQuery} />
                            </div>
                            <div
                              style={{ color: 'var(--text-muted)' }}
                              className="text-[11px] truncate leading-tight mt-0.5"
                            >
                              <HighlightedText text={item.secondaryText} query={debouncedQuery} />
                            </div>
                          </div>

                          {/* Enter Indicator on Highlight */}
                          {isHighlighted && (
                            <div
                              style={{ color: 'var(--text-muted)' }}
                              className="shrink-0 flex items-center gap-1 text-[10px] font-mono mt-1 hidden sm:flex"
                            >
                              <span>Open</span>
                              <CornerDownLeft className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Dropdown Footer Status */}
        <div
          style={{
            backgroundColor: 'var(--card-inner)',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
          className="border-t px-3.5 py-2 text-[11px] flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border)] font-mono text-[9px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border)] font-mono text-[9px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border)] font-mono text-[9px]">↵</kbd>
              <span>to open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border)] font-mono text-[9px]">esc</kbd>
              <span>to close</span>
            </span>
          </div>

          {searchResults.totalCount > 0 && (
            <span className="font-semibold text-[10px] text-[var(--accent)]">
              {searchResults.totalCount} matches found
            </span>
          )}
        </div>
      </div>
    );

    return ReactDOM.createPortal(content, document.body);
  };

  return (
    <>
      {/* Desktop & Tablet Search Bar Container */}
      <div ref={inputContainerRef} className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--input-placeholder)] pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          placeholder="Quick search records, units, serials..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-search-menu"
          aria-activedescendant={activeDescendantId}
          aria-autocomplete="list"
          aria-label="Quick search records, units, serials"
          style={{
            backgroundColor: 'var(--input-bg)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          className="w-full pl-10 pr-16 py-2 text-xs sm:text-sm border rounded-xl placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all shadow-xs"
        />

        {/* Clear Button (When input has text) */}
        {inputValue.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            style={{ color: 'var(--text-muted)' }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:text-[var(--text-primary)] rounded-md transition-colors"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Shortcut Badge (Shown only when input is empty and not focused) */}
        {!inputValue && !isFocused && (
          <kbd
            style={{
              backgroundColor: 'var(--card-inner)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
            className="hidden sm:inline-flex items-center absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold rounded border pointer-events-none select-none"
          >
            {shortcutBadgeText}
          </kbd>
        )}
      </div>

      {/* Render Portal Dropdown */}
      {renderDropdownPortal()}
    </>
  );
}
