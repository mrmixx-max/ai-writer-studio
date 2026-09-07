// ToastContainer: Windows-11-Style Toast-Benachrichtigungen (Sprint 18, Agent 6).
//
// Standalone-Komponente — verändert KEINE bestehenden Panels.
// Struktur angelehnt an HelpPanel (Sprint 10, Agent 4): Props-Interface,
// section/div mit aria-Label, onClose-Button mit ✕.
// State via zustand (im Projekt vorhanden, v5): `showToast(message, type?, duration?)`.
import { create } from "zustand";
import "./toast.css";

export type ToastType = "info" | "success" | "warn" | "error";

export interface ToastItem {
  /** Eindeutige ID (wird von showToast vergeben). */
  id: number;
  message: string;
  type: ToastType;
  /** Auto-Dismiss nach ms. Default 4000. */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: ToastItem) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) =>
    set((s) => ({ toasts: [...s.toasts.slice(-4), toast] })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

let nextToastId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleDismiss(id: number, duration: number): void {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        useToastStore.getState().dismiss(id);
      }, duration),
    );
  }
}

/**
 * Zeigt einen Toast an. Gibt die Toast-ID zurück (für manuellen dismiss).
 * @param message Anzuzeigender Text.
 * @param type Toast-Typ (Default "info").
 * @param duration Auto-Dismiss nach ms (Default 4000, 0 = kein Auto-Dismiss).
 */
export function showToast(
  message: string,
  type: ToastType = "info",
  duration = 4000,
): number {
  const id = nextToastId++;
  useToastStore.getState().push({ id, message, type, duration });
  scheduleDismiss(id, duration);
  return id;
}

/** Entfernt einen Toast manuell (storniert auch den Auto-Dismiss-Timer). */
export function dismissToast(id: number): void {
  const existing = timers.get(id);
  if (existing) {
    clearTimeout(existing);
    timers.delete(id);
  }
  useToastStore.getState().dismiss(id);
}

/** Setzt den ID-Zähler zurück — nur für Tests. */
export function resetToastStateForTests(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  nextToastId = 1;
  useToastStore.getState().clear();
}

const TYPE_ICON: Record<ToastType, string> = {
  info: "ⓘ",
  success: "✔",
  warn: "⚠",
  error: "✕",
};

const TYPE_LABEL: Record<ToastType, string> = {
  info: "Information",
  success: "Erfolg",
  warn: "Warnung",
  error: "Fehler",
};

export interface ToastContainerProps {
  /** aria-Label der Region. Default "Benachrichtigungen". */
  label?: string;
}

/** Rendert alle aktiven Toasts unten rechts (Windows-11-Style, amber-Akzent). */
export function ToastContainer({
  label = "Benachrichtigungen",
}: ToastContainerProps) {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="toast-container"
      role="region"
      aria-label={label}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          data-testid={`toast-${toast.id}`}
          data-type={toast.type}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span
            className="toast-icon"
            aria-hidden="true"
            title={TYPE_LABEL[toast.type]}
          >
            {TYPE_ICON[toast.type]}
          </span>
          <p className="toast-message">{toast.message}</p>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismissToast(toast.id)}
            title="Benachrichtigung schließen"
            aria-label={`Benachrichtigung schließen: ${toast.message}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
