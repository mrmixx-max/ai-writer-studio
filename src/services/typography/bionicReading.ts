// Bionic Reading & Typewriter-Center (WP 17.2)
// Rein deterministisch, keine LLM-Abhängigkeit, defensive Fallbacks.
// Bionic-Reading ist eine reine Lese-Overlay-Projektion — verändert keine
// Textinhalte und korrumpiert keine TipTap-Marks.

export interface AccessibilitySettings {
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  bionicIntensity: number;
}

const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontFamily: "Georgia, serif",
  lineHeight: 1.6,
  letterSpacing: 0.5,
  bionicIntensity: 0.4,
};

const MIN_BIONIC_INTENSITY = 0.3;
const MAX_BIONIC_INTENSITY = 0.5;
const DEFAULT_BIONIC_INTENSITY = 0.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Wendet Bionic Reading auf einen Text an.
 * Hebt die ersten 30-50% jedes Wortes fett hervor.
 * Reine Lese-Overlay-Projektion — verändert keine Textinhalte.
 */
export function applyBionicReading(text: string, intensity?: number): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const safeIntensity =
    intensity !== undefined
      ? clamp(intensity, MIN_BIONIC_INTENSITY, MAX_BIONIC_INTENSITY)
      : DEFAULT_BIONIC_INTENSITY;

  // Text in Wörter und Whitespace aufteilen (Whitespace als Token behalten)
  const tokens = text.split(/(\s+)/);

  return tokens
    .map((token) => {
      // Whitespace und leere Tokens unverändert lassen
      if (!token || /^\s+$/.test(token)) {
        return token;
      }

      // Prüfen ob es ein Wort ist (enthält Buchstaben oder Ziffern)
      if (!/[a-zA-ZäöüÄÖÜß0-9]/.test(token)) {
        return escapeHtml(token);
      }

      // Wort in fettgedruckten und normalen Teil aufteilen
      const wordLength = token.length;
      const boldLength = Math.max(1, Math.round(wordLength * safeIntensity));

      const boldPart = token.slice(0, boldLength);
      const normalPart = token.slice(boldLength);

      return `<strong>${escapeHtml(boldPart)}</strong>${escapeHtml(normalPart)}`;
    })
    .join("");
}

/**
 * Zentriert den aktiven Absatz vertikal auf 50% der Bildschirmhöhe.
 * Defensive Fallbacks bei fehlenden Editor-Daten.
 */
export function generateTypewriterScroll(editor: any): void {
  if (!editor || typeof editor !== "object") {
    return;
  }

  try {
    // TipTap-Editor: view.state.doc, view.dom, etc.
    const view = editor.view ?? editor;
    const state = view.state;

    if (!state || !state.doc) {
      return;
    }

    // Aktiven Absatz finden
    const { selection } = state;
    const $pos = selection.$from;
    const paragraphNode = $pos.node($pos.depth);

    if (!paragraphNode) {
      return;
    }

    // DOM-Knoten für den aktuellen Absatz finden
    const dom = view.domAtPos($pos.pos);
    const element = dom.node as HTMLElement;

    if (!element || typeof element.scrollIntoView !== "function") {
      return;
    }

    // Vertikal auf 50% der Bildschirmhöhe zentrieren
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    // Defensive: stillschweigend bei Fehlern
  }
}

/**
 * Gibt Barrierefreiheit-Einstellungen zurück.
 * Defensive Fallbacks bei fehlenden Daten.
 */
export function getAccessibilitySettings(): AccessibilitySettings {
  try {
    const stored = localStorage.getItem("accessibilitySettings");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AccessibilitySettings>;
      return {
        fontFamily:
          parsed.fontFamily ?? DEFAULT_ACCESSIBILITY_SETTINGS.fontFamily,
        lineHeight:
          typeof parsed.lineHeight === "number" && parsed.lineHeight > 0
            ? parsed.lineHeight
            : DEFAULT_ACCESSIBILITY_SETTINGS.lineHeight,
        letterSpacing:
          typeof parsed.letterSpacing === "number"
            ? parsed.letterSpacing
            : DEFAULT_ACCESSIBILITY_SETTINGS.letterSpacing,
        bionicIntensity:
          typeof parsed.bionicIntensity === "number"
            ? clamp(
                parsed.bionicIntensity,
                MIN_BIONIC_INTENSITY,
                MAX_BIONIC_INTENSITY,
              )
            : DEFAULT_ACCESSIBILITY_SETTINGS.bionicIntensity,
      };
    }
  } catch {
    // Defensive: Fallback zu Defaults
  }

  return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
}
