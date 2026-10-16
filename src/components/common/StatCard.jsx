import React from "react";

export function StatCard({ title, value, icon: Icon, color = "sky", trendLabel, trendVariant = "neutral", subtitle }) {
  const COLOR_CLASSES = {
    sky:     "bg-sky-500/10 text-sky-500 border-sky-500/25",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
    amber:   "bg-amber-500/10 text-amber-500 border-amber-500/25",
    rose:    "bg-rose-500/10 text-rose-500 border-rose-500/25",
    purple:  "bg-purple-500/10 text-purple-500 border-purple-500/25",
  };

  const TREND_STYLES = {
    success: {
      backgroundColor: "var(--status-success-bg)",
      color: "var(--status-success-text)",
      border: "1px solid var(--status-success-border)",
    },
    warning: {
      backgroundColor: "var(--status-warning-bg)",
      color: "var(--status-warning-text)",
      border: "1px solid var(--status-warning-border)",
    },
    danger: {
      backgroundColor: "var(--status-danger-bg)",
      color: "var(--status-danger-text)",
      border: "1px solid var(--status-danger-border)",
    },
    neutral: {
      backgroundColor: "var(--status-neutral-bg)",
      color: "var(--status-neutral-text)",
      border: "1px solid var(--status-neutral-border)",
    },
  };

  const badgeStyle = COLOR_CLASSES[color] || COLOR_CLASSES.sky;
  const trendStyle = TREND_STYLES[trendVariant] || TREND_STYLES.neutral;

  return (
    <div 
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
      className="glass-panel glass-card-interactive p-5 rounded-2xl relative overflow-hidden group border"
    >
      <div className="flex items-center justify-between">
        <div>
          <p style={{ color: "var(--text-muted)" }} className="text-[11px] font-semibold uppercase tracking-wider">{title}</p>
          <p style={{ color: "var(--text-primary)" }} className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl border shadow-xs transition-transform duration-300 group-hover:scale-110 ${badgeStyle}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
      {(trendLabel || subtitle) && (
        <div style={{ borderColor: "var(--border)" }} className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
          <span style={{ color: "var(--text-muted)" }} className="font-medium text-[11px]">{subtitle}</span>
          {trendLabel && (
            <span style={trendStyle} className="font-bold text-[11px] px-2 py-0.5 rounded-md">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
