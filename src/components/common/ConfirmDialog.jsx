import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export function ConfirmDialog({ isOpen, onClose, onConfirm, title = "Confirm Action", message, confirmLabel = "Delete", variant = "danger" }) {
  const btnClass = variant === "danger"
    ? "bg-rose-500 hover:bg-rose-600 text-white"
    : "bg-sky-500 hover:bg-sky-600 text-white";

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      maxWidth="sm:max-w-[480px]"
      confirmOnDirty={false}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-muted)" }}
            className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-xl font-semibold text-xs shadow-md transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div 
        style={{
          backgroundColor: "var(--status-danger-bg)",
          borderColor: "var(--status-danger-border)",
        }}
        className="flex items-start gap-3 p-4 rounded-2xl border"
      >
        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <p style={{ color: "var(--text-primary)" }} className="text-sm leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}
