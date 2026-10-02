// Subplot-Weaver & Dramaturgie-Symphonie (WP 24.2).
//
// Werkzeuge, um mehrere Handlungsstränge (A/B/C/D) über die Kapitel eines
// Buchs zu verweben:
//
//   1. assignSceneToPlot      — ordnet eine Szene einem Handlungsstrang zu
//                               (lokale, deterministische Registry).
//   2. detectNeglectedSubplots— meldet Nebenplots, die über mehr als
//                               NEGLECT_THRESHOLD aufeinanderfolgende Kapitel
//                               nicht mehr erwähnt wurden.
//   3. checkKlimaxSync        — prüft, ob A- und B-Plot im Showdown harmonisch
//                               zusammenlaufen.
//
// Design-Regeln (analog zu plotForensics / beatSheet):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Arrays
//     bzw. ein definiertes Ergebnis statt zu werfen.
//
// Kapitelnummern sind 1-basiert. Zuordnungen, deren `chapterNumber` fehlt oder
// < 1 ist, werden defensiv verworfen.

/** Gültige Handlungsstrang-IDs. */
export const PLOT_IDS = ["A", "B", "C", "D"] as const;

/** Typ einer gültigen Handlungsstrang-ID. */
export type PlotId = (typeof PLOT_IDS)[number];

/** Menschenlesbare Namen der Handlungsstränge. */
export const PLOT_LABELS: Record<PlotId, string> = {
  A: "Hauptplot",
  B: "Liebesgeschichte",
  C: "Mysterium",
  D: "Sub-Quest",
};

/** Schwelle: mehr als so viele aufeinanderfolgende Kapitel ohne Erwähnung. */
export const NEGLECT_THRESHOLD = 4;

/** Toleranz (in Kapiteln) zwischen A- und B-Plot-Höhepunkt für „synchron". */
export const SYNC_TOLERANCE_CHAPTERS = 1;

/** Minimaler Kapitel-Input des Subplot-Webers. */
export interface ChapterInput {
  /** Stabile Kapitel-ID. */
  id: string;
  /** Kapiteltitel. */
  title: string;
  /** Kapiteltext (wird hier nicht interpretiert). */
  content: string;
  /** Kapitelnummer (1-basiert). */
  chapterNumber: number;
}

/** Zuordnung einer Szene zu einem Handlungsstrang in einem Kapitel. */
export interface PlotAssignment {
  /** Stabile Szenen-ID. */
  sceneId: string;
  /** Handlungsstrang-ID (A/B/C/D). */
  plotId: string;
  /** Kapitelnummer der Szene (1-basiert). */
  chapterNumber: number;
}

/** Ein vernachlässigter Nebenplot. */
export interface NeglectedSubplot {
  /** Betroffener Handlungsstrang. */
  plotId: string;
  /** Letztes Kapitel, in dem der Strang auftrat (1-basiert). */
  lastSeenChapter: number;
  /** Anzahl der Kapitel seither ohne Erwähnung. */
  chaptersSinceLastSeen: number;
  /** Menschenlesbare Meldung. */
  message: string;
}

/** Ergebnis der Klimax-Synchronisationsprüfung. */
export interface KlimaxSyncResult {
  /** Laufen A- und B-Plot harmonisch zusammen? */
  synced: boolean;
  /** Gefundene Probleme (leer, wenn alles stimmig ist). */
  issues: string[];
  /** Höhepunkt-Kapitel des A-Plots (1-basiert), falls erkennbar. */
  aPlotClimaxChapter?: number;
  /** Höhepunkt-Kapitel des B-Plots (1-basiert), falls erkennbar. */
  bPlotClimaxChapter?: number;
}

/** Eine Szenen-Zuordnung aus der lokalen Registry (ohne Kapitelbezug). */
export interface SceneAssignment {
  sceneId: string;
  plotId: PlotId;
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Locale-unabhängiger String-Vergleich (deterministisch). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ist `value` eine gültige Handlungsstrang-ID? */
function isPlotId(value: string): value is PlotId {
  return (PLOT_IDS as readonly string[]).includes(value);
}

/** Menschenlesbarer Name für eine beliebige (ggf. ungültige) Plot-ID. */
function plotLabel(plotId: string): string {
  return isPlotId(plotId) ? PLOT_LABELS[plotId] : plotId;
}

/** Zahl defensiv nach endlicher Ganzzahl ≥ 1 normalisieren (sonst null). */
function toChapterNumber(raw: unknown): number | null {
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.trunc(num);
}

/** Kapitelnummern defensiv extrahieren (dedupliziert, aufsteigend). */
function normalizeChapterNumbers(chapters: unknown): number[] {
  if (!Array.isArray(chapters)) return [];
  const set = new Set<number>();
  for (const chapter of chapters) {
    if (!chapter || typeof chapter !== "object") continue;
    const num = toChapterNumber((chapter as { chapterNumber?: unknown }).chapterNumber);
    if (num !== null) set.add(num);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Zuordnungen defensiv normalisieren (unbekannte Plot-IDs werden verworfen). */
function normalizeAssignments(assignments: unknown): PlotAssignment[] {
  if (!Array.isArray(assignments)) return [];
  const out: PlotAssignment[] = [];
  for (const entry of assignments) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const sceneId = typeof raw.sceneId === "string" ? raw.sceneId.trim() : "";
    const plotId = typeof raw.plotId === "string" ? raw.plotId.trim().toUpperCase() : "";
    const chapterNumber = toChapterNumber(raw.chapterNumber);
    if (!sceneId || !isPlotId(plotId) || chapterNumber === null) continue;
    out.push({ sceneId, plotId, chapterNumber });
  }
  return out;
}

/** Höhepunkt-Kapitel eines Strangs: Kapitel mit den meisten Szenen. */
function climaxChapterForPlot(plotId: string, assignments: PlotAssignment[]): number | undefined {
  const counts = new Map<number, number>();
  for (const assignment of assignments) {
    if (assignment.plotId !== plotId) continue;
    counts.set(assignment.chapterNumber, (counts.get(assignment.chapterNumber) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = -1;
  for (const [chapter, count] of counts) {
    if (count > bestCount || (count === bestCount && chapter > (best ?? -1))) {
      best = chapter;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 1) Szenen-Registry
// ---------------------------------------------------------------------------

/** Lokale Registry: Szenen-ID → Handlungsstrang (letzte Zuordnung gewinnt). */
const scenePlotRegistry = new Map<string, PlotId>();

/**
 * Ordnet eine Szene einem Handlungsstrang zu.
 *
 * Defensiv: leerer/ungültiger `sceneId` oder unbekannte `plotId` werden
 * ignoriert (kein Throw). Eine erneute Zuordnung derselben Szene überschreibt
 * die vorherige.
 */
export function assignSceneToPlot(sceneId: string, plotId: string): void {
  if (typeof sceneId !== "string" || typeof plotId !== "string") return;
  const scene = sceneId.trim();
  const plot = plotId.trim().toUpperCase();
  if (!scene || !isPlotId(plot)) return;
  scenePlotRegistry.set(scene, plot);
}

/** Liefert den Handlungsstrang einer Szene (oder `undefined`). */
export function getScenePlot(sceneId: string): PlotId | undefined {
  if (typeof sceneId !== "string") return undefined;
  return scenePlotRegistry.get(sceneId.trim());
}

/** Liefert alle Szenen-Zuordnungen (deterministisch sortiert). */
export function getSceneAssignments(): SceneAssignment[] {
  return Array.from(scenePlotRegistry.entries())
    .map(([sceneId, plotId]) => ({ sceneId, plotId }))
    .sort((a, b) => cmpStr(a.sceneId, b.sceneId) || cmpStr(a.plotId, b.plotId));
}

/** Leert die Szenen-Registry (v. a. für Tests). */
export function clearSceneAssignments(): void {
  scenePlotRegistry.clear();
}

// ---------------------------------------------------------------------------
// 2) Vernachlässigte Nebenplots
// ---------------------------------------------------------------------------

/**
 * Erkennt vernachlässigte Handlungsstränge.
 *
 * Für jeden in `assignments` vorkommenden Strang wird das letzte Kapitel mit
 * Auftritt bestimmt. Liegen seither mehr als `NEGLECT_THRESHOLD` Kapitel (der
 * übergebenen Kapitelliste) ohne Erwähnung, gilt der Strang als
 * vernachlässigt. Ergebnis ist nach Dauer (absteigend) und dann nach Plot-ID
 * sortiert — deterministisch.
 */
export function detectNeglectedSubplots(
  chapters: ChapterInput[],
  assignments: PlotAssignment[],
): NeglectedSubplot[] {
  const chapterNumbers = normalizeChapterNumbers(chapters);
  if (chapterNumbers.length === 0) return [];

  const valid = normalizeAssignments(assignments);

  // Strang → Menge der Kapitel mit Auftritt.
  const byPlot = new Map<string, Set<number>>();
  for (const assignment of valid) {
    let seen = byPlot.get(assignment.plotId);
    if (!seen) {
      seen = new Set<number>();
      byPlot.set(assignment.plotId, seen);
    }
    seen.add(assignment.chapterNumber);
  }

  const result: NeglectedSubplot[] = [];
  for (const [plotId, seenChapters] of byPlot) {
    let lastSeenChapter = 0;
    for (const chapter of seenChapters) {
      if (chapter > lastSeenChapter) lastSeenChapter = chapter;
    }
    const chaptersSinceLastSeen = chapterNumbers.filter((c) => c > lastSeenChapter).length;
    if (chaptersSinceLastSeen > NEGLECT_THRESHOLD) {
      result.push({
        plotId,
        lastSeenChapter,
        chaptersSinceLastSeen,
        message:
          `Nebenplot „${plotId}" (${plotLabel(plotId)}) wurde seit Kapitel ${lastSeenChapter} ` +
          `nicht mehr erwähnt: ${chaptersSinceLastSeen} Kapitel ohne Auftritt ` +
          `(Schwelle: ${NEGLECT_THRESHOLD}).`,
      });
    }
  }

  return result.sort(
    (a, b) =>
      b.chaptersSinceLastSeen - a.chaptersSinceLastSeen || cmpStr(a.plotId, b.plotId),
  );
}

// ---------------------------------------------------------------------------
// 3) Klimax-Synchronisation (A-/B-Plot im Showdown)
// ---------------------------------------------------------------------------

/**
 * Prüft, ob A- und B-Plot im Showdown harmonisch zusammenlaufen.
 *
 * Der Höhepunkt eines Strangs ist das Kapitel mit den meisten Szenen des
 * Strangs (Gleichstand → späteres Kapitel). `synced` ist nur dann `true`, wenn
 * beide Stränge einen Höhepunkt besitzen, dieser höchstens
 * `SYNC_TOLERANCE_CHAPTERS` Kapitel auseinanderliegt und im Showdown-Bereich
 * (letztes Drittel des Buchs) liegt. Jedes Problem wird in `issues` erklärt.
 */
export function checkKlimaxSync(
  chapters: ChapterInput[],
  assignments: PlotAssignment[],
): KlimaxSyncResult {
  const chapterNumbers = normalizeChapterNumbers(chapters);
  if (chapterNumbers.length === 0) {
    return {
      synced: false,
      issues: ["Keine Kapitel vorhanden — Klimax-Synchronisation nicht prüfbar."],
    };
  }

  const valid = normalizeAssignments(assignments);
  const aPlotClimaxChapter = climaxChapterForPlot("A", valid);
  const bPlotClimaxChapter = climaxChapterForPlot("B", valid);

  const issues: string[] = [];

  if (aPlotClimaxChapter === undefined) {
    issues.push(
      `A-Plot (${PLOT_LABELS.A}) hat keinen erkennbaren Höhepunkt — keine Szene zugeordnet.`,
    );
  }
  if (bPlotClimaxChapter === undefined) {
    issues.push(
      `B-Plot (${PLOT_LABELS.B}) hat keinen erkennbaren Höhepunkt — keine Szene zugeordnet.`,
    );
  }

  if (aPlotClimaxChapter !== undefined && bPlotClimaxChapter !== undefined) {
    const gap = Math.abs(aPlotClimaxChapter - bPlotClimaxChapter);
    if (gap > SYNC_TOLERANCE_CHAPTERS) {
      issues.push(
        `A-Plot-Höhepunkt (Kap. ${aPlotClimaxChapter}) und B-Plot-Höhepunkt ` +
          `(Kap. ${bPlotClimaxChapter}) laufen nicht zusammen — ${gap} Kapitel Abstand ` +
          `(Toleranz: ${SYNC_TOLERANCE_CHAPTERS}).`,
      );
    }

    const maxChapter = chapterNumbers[chapterNumbers.length - 1];
    const showdownStart = Math.max(1, maxChapter - Math.ceil(maxChapter / 3) + 1);
    if (maxChapter >= 4) {
      if (aPlotClimaxChapter < showdownStart) {
        issues.push(
          `A-Plot-Höhepunkt liegt zu früh (Kap. ${aPlotClimaxChapter}); der Showdown ` +
            `beginnt etwa in Kap. ${showdownStart}.`,
        );
      }
      if (bPlotClimaxChapter < showdownStart) {
        issues.push(
          `B-Plot-Höhepunkt liegt zu früh (Kap. ${bPlotClimaxChapter}); der Showdown ` +
            `beginnt etwa in Kap. ${showdownStart}.`,
        );
      }
    }
  }

  const result: KlimaxSyncResult = {
    synced:
      issues.length === 0 &&
      aPlotClimaxChapter !== undefined &&
      bPlotClimaxChapter !== undefined,
    issues,
  };
  if (aPlotClimaxChapter !== undefined) result.aPlotClimaxChapter = aPlotClimaxChapter;
  if (bPlotClimaxChapter !== undefined) result.bPlotClimaxChapter = bPlotClimaxChapter;
  return result;
}
