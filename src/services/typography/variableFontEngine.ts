/**
 * Variable-Font-Engine-Service — WP 34.1 (Variable Fonts & Pracht-Initialen-Designer)
 *
 * Lokaler, deterministischer Service zur Berechnung von optischen Achsen,
 * Drop-Caps und Zeilenabstand-Harmonisierung.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpticalSizing {
  opsz: number;
  wght: number;
  wdth: number;
}

export type DropCapStyle = 'gothic' | 'renaissance' | 'jugendstil' | 'modern';

export interface DropCapResult {
  letter: string;
  lines: number;
  runaroundMargin: number;
  style: DropCapStyle;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Berechnet optimale opsz/wght/wdth je nach Schriftgröße.
 */
export function calculateOpticalSizing(fontSize: number): OpticalSizing {
  const safeSize = Math.max(6, fontSize || 12);

  // Optische Größe: kleine Schriften brauchen mehr Gewicht
  const opsz = safeSize;
  const wght = safeSize < 10 ? 500 : safeSize < 20 ? 400 : 300;
  const wdth = safeSize < 10 ? 110 : safeSize < 20 ? 100 : 90;

  return { opsz, wght, wdth };
}

/**
 * Generiert 2-4 zeilige Schmuckbuchstaben mit Textumfluss.
 */
export function generateDropCap(text: string, style: DropCapStyle): DropCapResult {
  if (!text || typeof text !== 'string') {
    return { letter: '', lines: 0, runaroundMargin: 0, style: style || 'modern' };
  }

  const safeStyle: DropCapStyle = style || 'modern';
  const letter = text.charAt(0).toUpperCase();
  const lines = safeStyle === 'gothic' ? 4 : safeStyle === 'renaissance' ? 3 : safeStyle === 'jugendstil' ? 3 : 2;
  const runaroundMargin = lines * 1.5;

  return { letter, lines, runaroundMargin, style: safeStyle };
}

/**
 * Harmonisiert Zeilenabstand.
 */
export function harmonizeLineHeight(fontSize: number, lineHeight: number): number {
  const safeSize = Math.max(6, fontSize || 12);
  const safeLineHeight = Math.max(1, lineHeight || 1.2);

  // Kleine Schriften brauchen mehr Zeilenabstand
  if (safeSize < 10) return Math.max(safeLineHeight, 1.5);
  if (safeSize < 20) return Math.max(safeLineHeight, 1.4);
  return Math.max(safeLineHeight, 1.2);
}
