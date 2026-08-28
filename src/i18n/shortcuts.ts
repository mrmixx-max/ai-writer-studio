// Globale Tastaturkürzel.
//
// Konvention:
//   Strg/Cmd+S    Manuskript speichern (Editor-Store persistiert via onChange)
//   Alt+1/2/3     Fokus auf Projektliste / Editor / KI-Assistent
//   Strg/Cmd+,    Einstellungen öffnen
//   Strg/Cmd+Shift+F  Fokusmodus umschalten
//   F1            Über-Dialog
//   Shift+F1/?    Kürzel-Übersicht
//   Escape        Dialoge schließen (in useModalA11y behandelt)

import { useEffect } from "react";

export interface ShortcutMap {
  save?: () => void;
  focusSidebar?: () => void;
  focusEditor?: () => void;
  focusAI?: () => void;
  openSettings?: () => void;
  toggleFocusMode?: () => void;
  openAbout?: () => void;
  showHelp?: () => void;
}

/** Fokussiert das erste Element innerhalb eines Containers (oder selbst). */
export function focusLandmark(selector: string): void {
  const el =
    document.querySelector<HTMLElement>(selector) ??
    document.querySelector<HTMLElement>(selector.split(" ")[0]);
  el?.focus();
  el?.scrollIntoView({ block: "nearest" });
}

export function useGlobalShortcuts(map: ShortcutMap): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "F1") {
        e.preventDefault();
        if (e.shiftKey) map.showHelp?.();
        else map.openAbout?.();
        return;
      }
      if (!mod && e.altKey) {
        if (e.code === "Digit1") {
          e.preventDefault();
          map.focusSidebar?.();
        } else if (e.code === "Digit2") {
          e.preventDefault();
          map.focusEditor?.();
        } else if (e.code === "Digit3") {
          e.preventDefault();
          map.focusAI?.();
        }
        return;
      }
      if (mod && !e.altKey) {
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          map.save?.();
        } else if (e.key === ",") {
          e.preventDefault();
          map.openSettings?.();
        } else if (e.shiftKey && e.key.toLowerCase() === "f") {
          e.preventDefault();
          map.toggleFocusMode?.();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
