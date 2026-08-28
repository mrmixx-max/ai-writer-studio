// Screen-Reader- & Fokus-Unterstützung.
//
// - AriaLiveRegion: polite Announcements (z.B. "Manuskript gespeichert")
//   weltweit via announce() aufrufbar.
// - SkipLink: Landmark-Sprung für Tastatur-/Screen-Reader-Nutzer.
// - useModalA11y: Fokus-Falle + Escape + Fokuswiederherstellung für Dialoge.

import { useEffect, useRef, useState } from "react";

/** Globale Announce-Funktion — wird von <AriaLiveRegion> registriert. */
let announceFn: ((message: string) => void) | null = null;

export function announce(message: string): void {
  if (announceFn) announceFn(message);
}

export function AriaLiveRegion() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    announceFn = (msg: string) => {
      // Leerer Zwischenschritt, damit identische Nachrichten erneut
      // vorgelesen werden (Textwechsel ist das Trigger-Kriterium).
      setMessage("");
      window.setTimeout(() => setMessage(msg), 30);
    };
    return () => {
      announceFn = null;
    };
  }, []);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/** Sprunglink: erster fokussierbarer Knoten der Seite. */
export function SkipLink({ targetId, label }: { targetId: string; label: string }) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {label}
    </a>
  );
}

/**
 * Fokus-Verwaltung für modale Dialoge:
 * - Fokus beim Öffnen auf das erste fokussierbare Element
 * - Tab innerhalb des Dialogs halten (Fokus-Falle)
 * - Escape ruft onClose auf
 * - Fokus beim Schließen auf das ursprüngliche Element zurücksetzen
 */
export function useModalA11y(
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (container) {
      const focusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const items = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
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
  }, [containerRef, onClose]);
}
