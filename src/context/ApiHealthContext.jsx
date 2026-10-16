import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkApiHealth } from '../services/api';
import { ServerOff, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

const ApiHealthContext = createContext({
  isOnline: true,
  isChecking: false,
  checkHealth: async () => {},
});

export function ApiHealthProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const healthy = await checkApiHealth();
      setIsOnline(healthy);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
      setHasCheckedOnce(true);
    }
  }, []);

  // Poll health every 3 seconds
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <ApiHealthContext.Provider value={{ isOnline, isChecking, checkHealth }}>
      {children}

      {/* Full-screen Blocker Overlay when API is Offline */}
      {hasCheckedOnce && !isOnline && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 text-center relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
              <ServerOff className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              Backend API Is Not Running
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              The frontend is locked because the <span className="text-white font-semibold">.NET Core API</span> (http://localhost:5222) is currently offline. All data and database operations require a live backend.
            </p>

            {/* Command Box */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-2 uppercase tracking-wider font-semibold">
                <Terminal className="w-3.5 h-3.5 text-sky-400" /> Start API in your terminal:
              </div>
              <div className="text-emerald-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 select-all font-medium">
                dotnet run
              </div>
              <div className="text-slate-500 text-[11px] mt-2">
                Run this inside <span className="text-slate-300">c:\sircon\api</span>
              </div>
            </div>

            {/* Status & Retry Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span>Auto-checking connection every 3s...</span>
              </div>

              <button
                onClick={checkHealth}
                disabled={isChecking}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Checking...' : 'Retry Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiHealthContext.Provider>
  );
}

export function useApiHealth() {
  return useContext(ApiHealthContext);
}
