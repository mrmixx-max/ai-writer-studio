// Hochkontrast-Modus.
//
// Anwendung über <html data-contrast="high"> — siehe accessibility.css.
// Persistiert in localStorage("app-contrast"); Standard: Systempräferenz
// (prefers-contrast: more), falls vorhanden.

const STORAGE_KEY = "app-contrast";

export type ContrastMode = "normal" | "high";

export function getHighContrastPreference(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "high") return true;
    if (saved === "normal") return false;
  } catch {
    /* ignore */
  }
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-contrast: more)").matches === true
  );
}

export function applyHighContrast(on: boolean): void {
  if (on) {
    document.documentElement.setAttribute("data-contrast", "high");
  } else {
    document.documentElement.removeAttribute("data-contrast");
  }
}

export function setHighContrast(on: boolean, persist = true): void {
  applyHighContrast(on);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "high" : "normal");
    } catch {
      /* ignore */
    }
  }
}
