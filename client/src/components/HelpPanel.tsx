import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { HelpEntry } from "@/lib/helpContent";

type HelpPanelProps = {
  open: boolean;
  onClose: () => void;
  entry: HelpEntry;
  /** Element to return focus to when the panel closes. */
  returnFocusTo?: HTMLElement | null;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea';

export default function HelpPanel({ open, onClose, entry, returnFocusTo }: HelpPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc to close + focus trap.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Move focus into the panel on open; restore on close.
  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    return () => {
      returnFocusTo?.focus?.();
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  return (
    <div className="help-panel-root" role="dialog" aria-modal="true" aria-labelledby="help-panel-title">
      <div className="help-panel-backdrop" onClick={onClose} aria-hidden />
      <aside ref={panelRef} className="help-panel" tabIndex={-1}>
        <header className="help-panel-header">
          <h2 id="help-panel-title" className="help-panel-title">
            {entry.title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="help-panel-close"
            onClick={onClose}
            aria-label="Close help"
          >
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="help-panel-body">{entry.body}</div>
      </aside>
    </div>
  );
}
