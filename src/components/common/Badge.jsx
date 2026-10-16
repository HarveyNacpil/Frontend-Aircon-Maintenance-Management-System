import React from 'react';

const STATUS_STYLES = {
  Active: {
    backgroundColor: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
    borderColor: 'var(--status-success-border)',
  },
  'In Stock': {
    backgroundColor: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
    borderColor: 'var(--status-success-border)',
  },
  Completed: {
    backgroundColor: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
    borderColor: 'var(--status-success-border)',
  },
  'Under Repair': {
    backgroundColor: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
    borderColor: 'var(--status-warning-border)',
  },
  'In Progress': {
    backgroundColor: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
    borderColor: 'var(--status-warning-border)',
  },
  'Low Stock': {
    backgroundColor: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
    borderColor: 'var(--status-warning-border)',
  },
  Medium: {
    backgroundColor: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
    borderColor: 'var(--status-warning-border)',
  },
  Cancelled: {
    backgroundColor: 'var(--status-danger-bg)',
    color: 'var(--status-danger-text)',
    borderColor: 'var(--status-danger-border)',
  },
  'Out of Stock': {
    backgroundColor: 'var(--status-danger-bg)',
    color: 'var(--status-danger-text)',
    borderColor: 'var(--status-danger-border)',
  },
  High: {
    backgroundColor: 'var(--status-danger-bg)',
    color: 'var(--status-danger-text)',
    borderColor: 'var(--status-danger-border)',
    fontWeight: '700',
  },
  Scheduled: {
    backgroundColor: 'var(--status-info-bg)',
    color: 'var(--status-info-text)',
    borderColor: 'var(--status-info-border)',
  },
  Assigned: {
    backgroundColor: 'var(--status-info-bg)',
    color: 'var(--status-info-text)',
    borderColor: 'var(--status-info-border)',
  },
  Technician: {
    backgroundColor: 'var(--status-info-bg)',
    color: 'var(--status-info-text)',
    borderColor: 'var(--status-info-border)',
    fontWeight: '600',
  },
  Open: {
    backgroundColor: 'var(--status-purple-bg)',
    color: 'var(--status-purple-text)',
    borderColor: 'var(--status-purple-border)',
  },
  Admin: {
    backgroundColor: 'var(--status-purple-bg)',
    color: 'var(--status-purple-text)',
    borderColor: 'var(--status-purple-border)',
    fontWeight: '700',
  },
  Inactive: {
    backgroundColor: 'var(--status-neutral-bg)',
    color: 'var(--status-neutral-text)',
    borderColor: 'var(--status-neutral-border)',
  },
  Low: {
    backgroundColor: 'var(--status-neutral-bg)',
    color: 'var(--status-neutral-text)',
    borderColor: 'var(--status-neutral-border)',
  },
  Staff: {
    backgroundColor: 'var(--status-neutral-bg)',
    color: 'var(--status-neutral-text)',
    borderColor: 'var(--status-neutral-border)',
  },
};

const DEFAULT_STYLE = {
  backgroundColor: 'var(--status-neutral-bg)',
  color: 'var(--status-neutral-text)',
  borderColor: 'var(--status-neutral-border)',
};

const PULSING_STATUSES = new Set(['Active', 'In Progress', 'Scheduled', 'High']);

export function Badge({ children, variant, className = '' }) {
  const style = STATUS_STYLES[variant] || DEFAULT_STYLE;
  const isPulsing = PULSING_STATUSES.has(variant);

  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border shadow-xs tracking-tight ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {isPulsing && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
      </span>
      <span>{children || variant}</span>
    </span>
  );
}

