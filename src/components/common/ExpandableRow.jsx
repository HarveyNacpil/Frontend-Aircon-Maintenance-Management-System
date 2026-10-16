import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ExpandableRow Component
 * 
 * Reusable accessible expandable row/card component for data tables and directories.
 * Designed for AeroFlow's Customers, Aircon Fleet, and Service Requests pages.
 * 
 * Features:
 * - WAI-ARIA compliant: role="button", tabIndex=0, aria-expanded, aria-controls, keyboard (Enter/Space)
 * - Micro-interactions: subtle hover scale (1.015), soft shadow, accent cyan border, 200ms transition
 * - Mobile responsive: skips hover scale on touch devices, stacks content cleanly
 * - Accessibility: respects prefers-reduced-motion (no hover scale, instant expand)
 * - Smooth inline expand with CSS grid height transition and 180° rotating chevron
 * - Action buttons isolation via stopPropagation
 */
export function ExpandableRow({
  id,
  isExpanded = false,
  onToggle,
  children,
  actions,
  expandedContent,
  chevronLabel = 'Toggle details',
  className = '',
  summaryClassName = '',
  expandedClassName = '',
}) {
  const panelId = `expandable-panel-${id}`;
  const triggerId = `expandable-trigger-${id}`;

  const handleKeyDown = (e) => {
    // Do not toggle if key event originated from an interactive element (button, link, input)
    const target = e.target;
    const tagName = target?.tagName?.toLowerCase();
    if (target !== e.currentTarget && (tagName === 'button' || tagName === 'a' || tagName === 'input' || tagName === 'select' || tagName === 'textarea')) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle?.();
    }
  };

  const handleRowClick = () => {
    onToggle?.();
  };

  return (
    <div
      style={{
        backgroundColor: isExpanded ? 'var(--card-inner)' : 'var(--card-bg)',
        borderColor: isExpanded ? 'var(--accent)' : 'var(--border)',
        boxShadow: isExpanded ? 'var(--shadow)' : 'none',
      }}
      className={`group relative rounded-2xl border transition-all duration-200 ease-out md:hover:scale-[1.015] md:hover:z-10 motion-reduce:transform-none motion-reduce:hover:scale-100 motion-reduce:transition-none ${className}`}
    >
      {/* Clickable Header / Summary Row */}
      <div
        role="button"
        tabIndex={0}
        id={triggerId}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={chevronLabel}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        style={{ color: 'var(--text-primary)' }}
        className={`w-full text-left cursor-pointer select-none rounded-2xl p-4 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${summaryClassName}`}
      >
        {/* Main Content Columns */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* Action Buttons & Expand Chevron */}
        <div className="flex items-center justify-end gap-2.5 shrink-0 self-end md:self-center">
          {actions && (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}

          {/* Accessible Chevron Indicator */}
          <div
            style={{
              backgroundColor: isExpanded ? 'var(--accent-light)' : 'transparent',
              color: isExpanded ? 'var(--accent)' : 'var(--text-muted)',
            }}
            className="p-1.5 rounded-xl transition-colors duration-150"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Expanded Accordion Panel with Smooth Grid-Row Transition */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div 
            style={{
              backgroundColor: 'var(--card-inner)',
              borderTopColor: 'var(--border)',
            }}
            className={`p-4 sm:p-6 border-t rounded-b-2xl ${expandedClassName}`}
          >
            {expandedContent}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpandableRow;
