import React, { useState } from "react";
import { Search, X } from "lucide-react";

export function PageHeader({
  icon: Icon,
  iconColor = "text-sky-500",
  title,
  subtitle,
  actions,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  tabs,
  children,
  className = "",
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div
      style={{ backgroundColor: "var(--page-bg)", borderBottomColor: "var(--border)" }}
      className={`w-full shrink-0 flex-none border-b z-10 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-2.5">
        {/* Expanded Mobile Search Input */}
        {mobileSearchOpen && onSearchChange ? (
          <div className="flex items-center gap-2 py-1 animate-fade-in">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--input-placeholder)] pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder={searchPlaceholder}
                value={searchQuery || ""}
                onChange={onSearchChange}
                style={{
                  backgroundColor: "var(--input-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full pl-9 pr-4 py-1.5 text-xs border rounded-xl placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              style={{
                backgroundColor: "var(--card-inner)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
              className="p-1.5 rounded-xl border transition-colors hover:opacity-80"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {/* Title & Subtitle block */}
            <div className="min-w-0">
              <h1 
                style={{ color: "var(--text-primary)" }}
                className="text-xl sm:text-2xl font-bold flex items-center gap-2.5"
              >
                {Icon && (
                  <Icon
                    className={`${iconColor} w-6 h-6 sm:w-7 sm:h-7 shrink-0`}
                  />
                )}
                <span className="truncate">{title}</span>
              </h1>
              {subtitle && (
                <p 
                  style={{ color: "var(--text-muted)" }}
                  className="text-xs truncate mt-0.5"
                >
                  {subtitle}
                </p>
              )}
            </div>

            {/* Actions & Search area */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Desktop Search Input with fixed width */}
              {onSearchChange && (
                <>
                  <div className="hidden sm:block relative w-52 sm:w-64 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--input-placeholder)] pointer-events-none" />
                    <input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchQuery || ""}
                      onChange={onSearchChange}
                      style={{
                        backgroundColor: "var(--input-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      className="w-full pl-9 pr-4 py-1.5 text-xs border rounded-xl placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                    />
                  </div>
                  {/* Compact Mobile Search Button */}
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen(true)}
                    aria-label="Open search"
                    style={{
                      backgroundColor: "var(--card-inner)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                    className="sm:hidden p-2 rounded-xl border transition-colors hover:opacity-80"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </>
              )}

              {actions}
            </div>
          </div>
        )}

        {/* Filter Tabs / Content below header row */}
        {(tabs || children) && (
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1">
            {tabs}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
