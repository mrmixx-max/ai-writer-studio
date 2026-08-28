// Diff-Service: Wort- und Zeichen-Diff für den Versionsvergleich.
// Klassischer LCS-basierte Diff über Token-Sequenzen (Wort-Ebene).
import type { DiffSegment } from "@/types/collaboration";

function tokenize(text: string): string[] {
  // Wörter + Whitespace als eigene Tokens, damit Abstände erhalten bleiben.
  return text.match(/\S+|\s+/g) ?? [];
}

function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/** Wort-level Diff zweier Texte → Segmente equal/insert/delete. */
export function diffWords(oldText: string, newText: string): DiffSegment[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const table = lcsTable(a, b);
  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++; j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < a.length) push("delete", a[i++]);
  while (j < b.length) push("insert", b[j++]);
  return segments;
}

/** Zeilen-Diff (pro Absatz/Zeile) — grobe Übersicht für lange Dokumente. */
export function diffLines(oldText: string, newText: string): DiffSegment[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const table = lcsTable(a, b);
  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += "\n" + text;
    else segments.push({ type, text });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++; j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < a.length) push("delete", a[i++]);
  while (j < b.length) push("insert", b[j++]);
  return segments;
}

/** Diff-Statistik: geänderte Wörter, Einfügungen, Löschungen. */
export function diffStats(segments: DiffSegment[]): { inserted: number; deleted: number; unchanged: number } {
  const words = (t: string) => (t.match(/\S+/g) ?? []).length;
  let inserted = 0, deleted = 0, unchanged = 0;
  for (const s of segments) {
    if (s.type === "insert") inserted += words(s.text);
    else if (s.type === "delete") deleted += words(s.text);
    else unchanged += words(s.text);
  }
  return { inserted, deleted, unchanged };
}

/** Ähnlichkeit zweier Texte (0–1) — Anteil gemeinsamer Wörter. */
export function similarity(oldText: string, newText: string): number {
  const segments = diffWords(oldText, newText);
  const { inserted, deleted, unchanged } = diffStats(segments);
  const total = inserted + deleted + unchanged;
  if (!total) return 1;
  return unchanged / total;
}
