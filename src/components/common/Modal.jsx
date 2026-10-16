import React, { useEffect, useRef, useId, useCallback } from 'react';
import { X } from 'lucide-react';

// Track global open modal count for nested modals and background scroll lock
// Track global open modal count for nested modals and background scroll lock
let openModalCount = 0;
let savedScrollY = 0;
let savedMainScrollTop = 0;

/**
 * Enhanced Accessible Modal Component
 * 
 * Complies with AeroFlow Modal & Scrolling Guidelines:
 * 1. Fixed header & fixed footer with scrolling form body (overflow-y: auto, min-height: 0, overscroll-behavior: contain)
 * 2. Mobile full-screen (< 640px), centered dialog with margins on desktop (max-height: calc(100dvh - 32px), width: min(720px, 100% - 32px))
 * 3. Background scroll lock without layout shift (scrollbar-gutter: stable) and scroll position restoration
 * 4. Close on Escape and backdrop click (with confirmation if unsaved changes exist)
 * 5. Focus trap, role="dialog", aria-modal="true", aria-labelledby, and focus return
 * 6. Auto-scroll to first invalid form input on validation failure
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  onSubmit,
  maxWidth = 'sm:max-w-[720px]',
  confirmOnDirty = true,
  initialFocusRef,
}) {
  const titleId = useId();
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Keep references to latest callbacks and flags so effects don't depend on them
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const confirmOnDirtyRef = useRef(confirmOnDirty);
  confirmOnDirtyRef.current = confirmOnDirty;

  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  // Request close with unsaved changes verification - stable callback identity
  const requestClose = useCallback(() => {
    if (confirmOnDirtyRef.current && isDirtyRef.current) {
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them and close?');
      if (!confirmDiscard) return;
    }
    onCloseRef.current?.();
  }, []);

  // Modal open lifecycle: Scroll lock, Keydown handlers, Initial focus & Focus restoration
  // Runs ONLY when isOpen transitions, never on re-render or form input updates
  useEffect(() => {
    if (!isOpen) return;

    // 1. Capture previously focused element before modal takes focus
    if (!modalRef.current || !modalRef.current.contains(document.activeElement)) {
      previouslyFocusedRef.current = document.activeElement;
    }
    isDirtyRef.current = false;

    // 2. Background scroll lock with scroll position restoration
    if (openModalCount === 0) {
      savedScrollY = window.scrollY || document.documentElement.scrollTop;
      const mainEl = document.querySelector('main');
      if (mainEl) {
        savedMainScrollTop = mainEl.scrollTop;
        mainEl.classList.add('modal-scroll-lock');
      }
      document.documentElement.classList.add('modal-scroll-lock');
      document.body.classList.add('modal-scroll-lock');
    }
    openModalCount += 1;

    // 3. Keyboard navigation: Escape key & Focus Trap
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }

      if (e.key === 'Tab') {
        const dialog = modalRef.current;
        if (!dialog) return;

        const focusables = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === dialog || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 4. Initial focus placement: ONLY runs once when modal opens
    const timer = setTimeout(() => {
      if (initialFocusRefRef.current?.current) {
        initialFocusRefRef.current.current.focus();
      } else if (modalRef.current) {
        const firstInput = modalRef.current.querySelector(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button.btn-autofocus'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);

      // Unlock background scroll
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.classList.remove('modal-scroll-lock');
          mainEl.scrollTop = savedMainScrollTop;
        }
        document.documentElement.classList.remove('modal-scroll-lock');
        document.body.classList.remove('modal-scroll-lock');
        window.scrollTo({ top: savedScrollY, behavior: 'instant' });
      }

      // Restore focus to button that opened the modal
      const elementToRestore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (elementToRestore && typeof elementToRestore.focus === 'function') {
        setTimeout(() => {
          elementToRestore.focus();
        }, 10);
      }
    };
  }, [isOpen, requestClose]);

  // Track user input to detect dirty/unsaved state
  const handleInputChange = () => {
    isDirtyRef.current = true;
  };

  // Scroll to first invalid field on form submission failure
  const handleInvalidCapture = (e) => {
    const dialog = modalRef.current;
    if (!dialog) return;

    // Small delay so native validation markers settle
    setTimeout(() => {
      const firstInvalid = dialog.querySelector(':invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus?.({ preventScroll: true });
      }
    }, 10);
  };

  const handleFormSubmit = (e) => {
    isDirtyRef.current = false;
    onSubmit?.(e);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow)",
        }}
        className={`relative z-10 w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[calc(100dvh-32px)] sm:w-[min(720px,calc(100%-32px))] ${maxWidth} border-0 sm:border rounded-none sm:rounded-3xl flex flex-col overflow-hidden outline-none animate-scale-up`}
        onInput={handleInputChange}
        onInvalidCapture={handleInvalidCapture}
      >
        {/* Fixed Header */}
        <div 
          style={{
            backgroundColor: "var(--card-inner)",
            borderBottomColor: "var(--border)",
          }}
          className="px-5 sm:px-6 py-4 border-b flex items-center justify-between shrink-0"
        >
          <div className="min-w-0 pr-3">
            <h3 
              id={titleId} 
              style={{ color: "var(--text-primary)" }}
              className="text-base sm:text-lg font-bold tracking-tight truncate"
            >
              {title}
            </h3>
            {subtitle && (
              <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close dialog"
            style={{ color: "var(--text-muted)" }}
            className="p-2 rounded-xl hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Footer with Support for Optional onSubmit Wrapper */}
        {onSubmit ? (
          <form
            onSubmit={handleFormSubmit}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* Scrollable Form Body */}
            <div 
              style={{ color: "var(--text-primary)" }}
              className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4"
            >
              {children}
            </div>

            {/* Fixed Footer */}
            {footer && (
              <div 
                style={{
                  backgroundColor: "var(--card-inner)",
                  borderTopColor: "var(--border)",
                }}
                className="px-5 sm:px-6 py-3.5 border-t shrink-0 flex items-center justify-end gap-3"
              >
                {footer}
              </div>
            )}
          </form>
        ) : (
          <>
            {/* Scrollable Body */}
            <div 
              style={{ color: "var(--text-primary)" }}
              className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0"
            >
              {children}
            </div>

            {/* Fixed Footer (if provided) */}
            {footer && (
              <div 
                style={{
                  backgroundColor: "var(--card-inner)",
                  borderTopColor: "var(--border)",
                }}
                className="px-5 sm:px-6 py-3.5 border-t shrink-0 flex items-center justify-end gap-3"
              >
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Modal;
