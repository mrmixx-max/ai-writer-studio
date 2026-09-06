// useFocusTrap: Fokus-Falle + Escape + Fokuswiederherstellung für Overlays.
//
// Semantik wie useModalA11y (src/i18n/a11y.tsx), aber bewusst ohne
// `offsetParent`-Sichtbarkeitsfilter — der ist in jsdom immer null und
// macht die Falle untestbar. Gefiltert wird nur nach `disabled`.
// Overlays mit eigenem ESC-Handler (z. B. AboutDialog) können ihren
// Handler ersatzlos streichen: `onClose` übernimmt das.
//
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(ref, onClose);                    // Dialog (aktiv)
//   useFocusTrap(ref, onClose, { enabled: false }); // No-op (eingebettet)

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  /** Bei false: kein Autofokus, keine Falle, kein ESC, kein Restore. Default true. */
  enabled?: boolean;
  /** Bei false: kein initialer Fokus-Sprung, Falle/ESC bleiben aktiv. Default true. */
  autoFocus?: boolean;
}

function focusablesOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onClose?: () => void,
  options?: UseFocusTrapOptions,
): void {
  const enabled = options?.enabled ?? true;
  const autoFocus = options?.autoFocus ?? true;
  const restoreRef = useRef<HTMLElement | null>(null);
  // onClose in Ref halten, damit der Effekt nicht bei jedem Render
  // neu registriert und der Fokus nicht zurückgesetzt wird.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (container && autoFocus) {
      focusablesOf(container)[0]?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (onCloseRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const items = focusablesOf(containerRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restoreRef.current?.focus();
    };
  }, [containerRef, enabled, autoFocus]);
}
