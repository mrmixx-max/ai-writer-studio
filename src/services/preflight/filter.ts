// Filter- und Aggregationslogik für Preflight-Befunde.
//
// Bewusst als eigenes Modul, nicht in der View: Die Filterlogik entscheidet,
// welche Befunde ein Autor überhaupt sieht. Ein Fehler hier lässt Befunde
// lautlos verschwinden, und niemand merkt es. Deshalb testbar und an genau
// einer Stelle.

import type {
  ExportFormat,
  PreflightCategory,
  PreflightFinding,
  PreflightFilter,
  PreflightStats,
} from "@/types/preflight";

/**
 * Wendet einen Filter auf eine Befundliste an.
 *
 * Reihenfolge der Prüfungen ist bedeutungslos, alle müssen zutreffen.
 */
export function applyFilter(
  findings: PreflightFinding[],
  filter: PreflightFilter,
): PreflightFinding[] {
  return findings.filter((f) => {
    if (filter.category && f.category !== filter.category) return false;

    if (filter.onlyBlockers && f.severity !== "blocker") return false;

    // chapterId === null bedeutet ausdrücklich "nur projektweite Befunde".
    // undefined bedeutet "kein Kapitelfilter".
    if (filter.chapterId !== undefined) {
      if (filter.chapterId === null) {
        if (f.chapterId !== null) return false;
      } else if (f.chapterId !== filter.chapterId) {
        return false;
      }
    }

    // Leere affectedFormats bedeutet "gilt für alle Formate" — solche Befunde
    // bleiben bei jedem Formatfilter sichtbar. Sonst würde ein Filter auf
    // DOCX die Strukturbefunde ausblenden, die für alle Formate gelten.
    if (filter.format && f.affectedFormats.length > 0) {
      if (!f.affectedFormats.includes(filter.format)) return false;
    }

    if (!filter.includeResolved && f.status !== "open") return false;

    return true;
  });
}

/** Zählt Befunde nach Schweregrad, Kategorie und Format. */
export function computeStats(
  findings: PreflightFinding[],
  lastRun: number | null = null,
): PreflightStats {
  const stats: PreflightStats = {
    total: 0,
    blocker: 0,
    warning: 0,
    hint: 0,
    byCategory: {},
    byFormat: {},
    lastRun,
  };

  for (const f of findings) {
    // Nur offene Befunde zählen — erledigte sollen die Übersicht nicht
    // aufblähen, sonst wirkt das Manuskript schlechter als es ist.
    if (f.status !== "open") continue;

    stats.total++;
    if (f.severity === "blocker") stats.blocker++;
    else if (f.severity === "warning") stats.warning++;
    else stats.hint++;

    stats.byCategory[f.category] = (stats.byCategory[f.category] ?? 0) + 1;

    // Befunde ohne Formatbindung gelten für alle — auf jedes Format zählen,
    // damit die Formatübersicht nicht lügt.
    const formats: ExportFormat[] =
      f.affectedFormats.length > 0
        ? f.affectedFormats
        : (["docx", "pdf", "epub", "md", "txt"] as ExportFormat[]);
    for (const fmt of formats) {
      stats.byFormat[fmt] = (stats.byFormat[fmt] ?? 0) + 1;
    }
  }

  return stats;
}

/** Zählt offene Befunde einer Kategorie — für die Sektionsbeschriftung. */
export function countByCategory(
  findings: PreflightFinding[],
  category: PreflightCategory,
): number {
  return findings.filter((f) => f.category === category && f.status === "open").length;
}

/**
 * Sortiert Befunde für die Anzeige.
 *
 * Blocker zuerst, dann Warnungen, dann Hinweise. Innerhalb gleicher Stufe
 * nach Kategorie und Titel, damit die Reihenfolge zwischen Läufen stabil
 * bleibt — sonst springt die Liste bei jedem Prüflauf durcheinander.
 */
export function sortFindings(findings: PreflightFinding[]): PreflightFinding[] {
  const rank = { blocker: 0, warning: 1, hint: 2 };
  return [...findings].sort((a, b) => {
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    const c = a.category.localeCompare(b.category);
    if (c !== 0) return c;
    return a.title.localeCompare(b.title, "de");
  });
}

/**
 * Entscheidet, ob ein Export ohne Rückfrage laufen darf.
 *
 * Blocker verlangen eine Bestätigung, Warnungen und Hinweise nicht.
 * Als bewusst markierte oder ignorierte Befunde zählen nicht mehr — der
 * Autor hat entschieden.
 */
export function exportGate(
  findings: PreflightFinding[],
  format: ExportFormat,
): { allowed: boolean; needsConfirm: boolean; blockers: PreflightFinding[]; warnings: number } {
  const relevant = applyFilter(findings, { format, includeResolved: false });
  const blockers = relevant.filter((f) => f.severity === "blocker");
  const warnings = relevant.filter((f) => f.severity === "warning").length;

  return {
    // Der Export wird NIE verhindert. Deine Anforderung: trotzdem erlauben,
    // aber mit Bestätigung. Ein Werkzeug, das den Nutzer aussperrt, wird
    // umgangen statt benutzt.
    allowed: true,
    needsConfirm: blockers.length > 0,
    blockers,
    warnings,
  };
}
