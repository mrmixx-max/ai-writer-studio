// Korkwand-Service (WP 5.1): Drag-and-Drop-Reordering und Grid-Layout.
//
// Rein und defensiv: keine Mutation der Eingabe, Fallbacks bei ungültigen
// Indizen. Die Funktionen sind lokal, deterministisch, kein LLM nötig.

/** Ein Kapitel-Index-Eintrag für die Korkwand. */
export interface BookChapterIndex {
  /** Kapitel-ID. */
  id: string;
  /** Kapiteltitel. */
  title: string;
  /** Kurzzusammenfassung (Logline). */
  logline: string;
  /** POV-Charakter. */
  povCharacter: string;
  /** Ort der Szene. */
  location: string;
  /** Status: Entwurf, Überarbeitung, Fertig. */
  status: "draft" | "revision" | "completed";
  /** Sortierreihenfolge. */
  sortOrder: number;
}

/** Grid-Layout für die Korkwand. */
export interface CorkboardLayout {
  /** Anzahl Spalten. */
  columns: number;
  /** Anzahl Zeilen. */
  rows: number;
  /** Positionen der Karten. */
  positions: { id: string; row: number; col: number; x: number; y: number }[];
}

/**
 * Verschiebt ein Kapitel in der Liste (Drag-and-Drop).
 * Gibt eine neue Liste zurück, ohne die Eingabe zu mutieren.
 */
export function reorderChapters(
  chapters: BookChapterIndex[],
  fromIndex: number,
  toIndex: number,
): BookChapterIndex[] {
  if (chapters.length === 0) return [];
  if (fromIndex < 0 || fromIndex >= chapters.length) return [...chapters];
  if (toIndex < 0 || toIndex >= chapters.length) return [...chapters];
  if (fromIndex === toIndex) return [...chapters];

  const result = [...chapters];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);

  // sortOrder aktualisieren
  return result.map((ch, i) => ({ ...ch, sortOrder: i }));
}

/**
 * Berechnet das Grid-Layout für die Korkwand.
 * Verteilt die Karten gleichmäßig auf ein Raster.
 */
export function getCorkboardLayout(
  chapters: BookChapterIndex[],
  columns: number = 3,
): CorkboardLayout {
  if (chapters.length === 0) {
    return { columns, rows: 0, positions: [] };
  }

  const cols = Math.max(1, columns);
  const rows = Math.ceil(chapters.length / cols);

  const positions = chapters.map((ch, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      id: ch.id,
      row,
      col,
      x: col * 220 + 20,
      y: row * 160 + 20,
    };
  });

  return { columns: cols, rows, positions };
}

/**
 * Prüft, ob ein Drag-and-Drop-Zug gültig ist.
 */
export function validateCorkboardMove(
  chapters: BookChapterIndex[],
  fromIndex: number,
  toIndex: number,
): boolean {
  if (chapters.length === 0) return false;
  if (fromIndex < 0 || fromIndex >= chapters.length) return false;
  if (toIndex < 0 || toIndex >= chapters.length) return false;
  if (fromIndex === toIndex) return false;
  return true;
}
