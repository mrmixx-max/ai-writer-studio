// Export-Gate (C3): Export nur bei draft/completed-Kapiteln.
// needs_revision ist erlaubt, aber mit Warnung; planned/generating blockieren.

import type { BookChapterInput } from "./types";

export interface ExportGateResult {
  /** true, wenn exportiert werden darf. */
  allowed: boolean;
  /** Kapitelnummern + Titel der Kapitel mit needs_revision. */
  needsRevision: { number: number; title: string }[];
  /** Kapitel, die den Export blockieren (planned/generating). */
  blocking: { number: number; title: string; status: string }[];
}

/**
 * Prüft, ob ein Buch exportiert werden darf.
 * - planned/generating → Export blockiert.
 * - needs_revision → Export erlaubt, Kapitel werden in `needsRevision`
 *   geliefert (UI zeigt Warnung mit Kapitelliste).
 * - draft/completed → unproblematisch.
 */
export function checkExportGate(
  chapters: Array<BookChapterInput & { status?: string }>,
): ExportGateResult {
  const needsRevision: ExportGateResult["needsRevision"] = [];
  const blocking: ExportGateResult["blocking"] = [];

  chapters.forEach((c, i) => {
    const num = c.number ?? i + 1;
    if (c.status === "needs_revision") {
      needsRevision.push({ number: num, title: c.title });
    } else if (c.status === "planned" || c.status === "generating") {
      blocking.push({ number: num, title: c.title, status: c.status });
    }
  });

  return { allowed: blocking.length === 0, needsRevision, blocking };
}

/** Formatiert die needs_revision-Warnung (Kapitelliste). */
export function formatNeedsRevisionWarning(
  needsRevision: ExportGateResult["needsRevision"],
): string {
  const list = needsRevision.map((c) => `Kapitel ${c.number}: ${c.title}`).join(", ");
  return `Achtung: ${needsRevision.length} Kapitel brauchen Überarbeitung — ${list}. Export wird fortgesetzt.`;
}