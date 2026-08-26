// Hilfsfunktionen für den Knowledge-Layer.

/**
 * Stabiler, schneller Hash (FNV-1a, 32 Bit, hex).
 * Zweck: Stale-Erkennung von Wissensquellen. Kein Krypto-Hash nötig —
 * es geht nur um "hat sich der Inhalt geändert?".
 */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Länge mit einmischen, um Kollisionen bei Permutationen zu reduzieren
  h ^= text.length;
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Erzeugt eine ID mit Präfix. */
export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Kürzt Text für Vorschauen, ohne Wörter zu zerschneiden. */
export function preview(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/** Zählt Wörter in einem Plaintext. */
export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
