import React, { useState } from "react";
import { Bell, Sun, Moon, Search, LogOut, CheckCheck, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { Badge } from "../common/Badge";

import { GlobalSearch } from "../common/GlobalSearch";

export function Navbar({ theme, toggleTheme, globalSearch, setGlobalSearch, onMenuToggle, onNavigate }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header 
      style={{ backgroundColor: "var(--topbar-bg)", borderColor: "var(--border)" }}
      className="sticky top-0 z-30 h-16 glass-nav px-4 sm:px-6 flex items-center justify-between transition-colors gap-3"
    >
      {/* Hamburger (mobile only) */}
      <button
        onClick={onMenuToggle}
        style={{ color: "var(--text-muted)" }}
        className="p-2.5 rounded-xl hover:bg-[var(--card-inner)] transition-colors md:hidden shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global Search Bar */}
      <div className="flex items-center flex-1 max-w-md">
        <GlobalSearch
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          onNavigate={onNavigate}
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Dark/Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
          style={{ color: "var(--text-muted)" }}
          className="p-2.5 rounded-xl hover:bg-[var(--card-inner)] transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[var(--accent)]" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            style={{ color: "var(--text-muted)" }}
            className="relative p-2.5 rounded-xl hover:bg-[var(--card-inner)] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div 
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
              className="absolute right-0 mt-2 w-80 sm:w-96 border rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in"
            >
              <div 
                style={{ backgroundColor: "var(--card-inner)", borderColor: "var(--border)" }}
                className="p-4 border-b flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <h4 style={{ color: "var(--text-primary)" }} className="font-bold text-xs sm:text-sm">Notifications</h4>
                  {unreadCount > 0 && <span className="px-2 py-0.5 text-[10px] bg-sky-500/15 text-sky-500 font-semibold rounded-full">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1 transition-colors">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
              <div 
                style={{ borderColor: "var(--border)" }}
                className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]"
              >
                {notifications.length === 0 ? (
                  <div style={{ color: "var(--text-muted)" }} className="p-6 text-center text-xs">No active notifications</div>
                ) : (
                  notifications.map((n) => {
                    const isRead = n.isRead || n.is_read;
                    return (
                      <div
                        key={n.notificationId || n.notification_id}
                        onClick={() => markAsRead(n.notificationId || n.notification_id)}
                        className={`p-3.5 text-xs cursor-pointer transition-colors ${isRead ? "opacity-60 bg-transparent hover:bg-[var(--card-inner)]" : "bg-sky-500/5 hover:bg-sky-500/10"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p style={{ color: "var(--text-primary)" }} className="font-semibold">{n.title}</p>
                          <span style={{ color: "var(--text-muted)" }} className="text-[10px] shrink-0">{n.createdAt?.slice(0, 10) || "Recent"}</span>
                        </div>
                        <p style={{ color: "var(--text-muted)" }} className="mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-[var(--card-inner)] transition-colors"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white font-extrabold flex items-center justify-center text-xs sm:text-sm shadow-sm">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden sm:block text-left">
              <div style={{ color: "var(--text-primary)" }} className="text-xs font-bold leading-tight">{user?.fullName || user?.username}</div>
              <div style={{ color: "var(--text-muted)" }} className="text-[10px] font-medium capitalize">{user?.role}</div>
            </div>
          </button>

          {showUserMenu && (
            <div 
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)" }}
              className="absolute right-0 mt-2 w-56 border rounded-2xl shadow-2xl p-2 z-50 animate-fade-in"
            >
              <div style={{ borderColor: "var(--border)" }} className="px-3 py-2 border-b mb-1">
                <p style={{ color: "var(--text-primary)" }} className="text-xs font-bold">{user?.username}</p>
                <div className="mt-1"><Badge variant={user?.role}>{user?.role}</Badge></div>
              </div>
              <button
                onClick={logout}
                className="w-full text-left flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
