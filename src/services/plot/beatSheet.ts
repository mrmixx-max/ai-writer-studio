// Beat-Sheet-Vorlagen (WP 5.1).
//
// Stellt vordefinierte Story-Strukturen bereit und wendet sie auf die
// Kapitel eines Buchs an:
//   - Save the Cat (15 Beats)
//   - Heldenreise / Hero's Journey (12 Stationen)
//   - Drei-Akt-Struktur (3 Akte mit je 3 Unterbeats)
//
// Der Service ist vollständig lokal, deterministisch und benötigt kein LLM.
// Alle Funktionen sind defensiv: fehlende Kapitel, leere Bücher, unbekannte
// Vorlagen und fehlende Beat-Felder führen zu definierten Fallbacks statt zu
// Exceptions. Eingaben werden nie mutiert.

import type { BookChapterInput } from "@/services/bookwriter/export/types";

/** Bearbeitungsstand eines Beats. */
export type BeatStatus = "pending" | "draft" | "completed";

/** Verfügbare Beat-Sheet-Vorlagen. */
export type BeatTemplateType = "save-the-cat" | "hero-journey" | "three-act";

/** Ein einzelner Beat (Erzählschritt) einer Vorlage. */
export interface Beat {
  /** Stabiler, maschinenlesbarer Schlüssel (z. B. "midpoint"). */
  id: string;
  /** Anzeigename des Beats. */
  name: string;
  /** Kurzbeschreibung / Regieanweisung. */
  description: string;
  /**
   * Kapitelnummer, der dieser Beat zugeordnet ist (1-basiert).
   * `undefined`, solange die Vorlage noch nicht auf Kapitel angewendet wurde.
   */
  targetChapter?: number;
  /** Bearbeitungsstand. Vorlagen starten immer mit "pending". */
  status: BeatStatus;
}

/** Eine vollständige Beat-Sheet-Vorlage. */
export interface BeatTemplate {
  type: BeatTemplateType;
  /** Anzeigename der Vorlage. */
  name: string;
  /** Kurzbeschreibung der Struktur. */
  description: string;
  /** Geordnete Beats der Vorlage. */
  beats: Beat[];
}

/** Ergebnis der Beat-Abdeckungsprüfung. */
export interface BeatCoverageResult {
  /** Gesamtzahl der Beats in der Vorlage. */
  total: number;
  /** Anzahl der Beats, die durch ein Kapitel mit Inhalt abgedeckt sind. */
  covered: number;
  /** Abdeckungsquote (0-1, auf 2 Nachkommastellen gerundet). */
  coverage: number;
  /** IDs der nicht abgedeckten Beats (Reihenfolge der Vorlage). */
  missing: string[];
  /** Verteilung der Beats auf ihre Bearbeitungsstände. */
  byStatus: Record<BeatStatus, number>;
  /** `true`, wenn die Vorlage Beats enthält und alle abgedeckt sind. */
  complete: boolean;
}

/**
 * Ein Kapitel, dem nach `applyBeatTemplate` die zugeordneten Beats
 * beigelegt sind. Strukturell ein `BookChapterInput` (Subtyp), daher
 * überall dort verwendbar, wo `BookChapterInput` erwartet wird.
 */
export interface ChapterBeatAssignment extends BookChapterInput {
  /** Beats, die auf dieses Kapitel zielen (inkl. aufgelöstem targetChapter). */
  beats: Beat[];
}

// ---------------------------------------------------------------------------
// Vorlagen-Definitionen
// ---------------------------------------------------------------------------

/** Save the Cat! — 15 Beats nach Blake Snyder. */
const SAVE_THE_CAT_BEATS: Beat[] = [
  { id: "opening-image", name: "Opening Image", description: "Erstes Bild: Ton, Welt und Ausgangszustand des Helden.", status: "pending" },
  { id: "theme-stated", name: "Theme Stated", description: "Das Thema der Geschichte wird (oft beiläufig) benannt.", status: "pending" },
  { id: "set-up", name: "Set-Up", description: "Vorstellung von Figuren, Welt und Konfliktanlage.", status: "pending" },
  { id: "catalyst", name: "Catalyst", description: "Auslösendes Ereignis, das das Leben des Helden verändert.", status: "pending" },
  { id: "debate", name: "Debate", description: "Zögern und Abwägen des Helden vor dem Aufbruch.", status: "pending" },
  { id: "break-into-two", name: "Break into Two", description: "Der Held tritt in die neue Welt ein (Beginn Akt II).", status: "pending" },
  { id: "b-story", name: "B Story", description: "Nebenhandlung, oft die emotionale oder romantische Linie.", status: "pending" },
  { id: "fun-and-games", name: "Fun and Games", description: "Das Versprechen der Prämisse wird eingelöst.", status: "pending" },
  { id: "midpoint", name: "Midpoint", description: "Scheinsieg oder Scheinniederlage; der Einsatz steigt.", status: "pending" },
  { id: "bad-guys-close-in", name: "Bad Guys Close In", description: "Gegner und äußerer Druck nehmen zu.", status: "pending" },
  { id: "all-is-lost", name: "All Is Lost", description: "Tiefpunkt: der Held verliert scheinbar alles.", status: "pending" },
  { id: "dark-night-of-the-soul", name: "Dark Night of the Soul", description: "Innere Krise und Selbsterkenntnis.", status: "pending" },
  { id: "break-into-three", name: "Break into Three", description: "Eine Erkenntnis ermöglicht den Weg in Akt III.", status: "pending" },
  { id: "finale", name: "Finale", description: "Höhepunkt und Auflösung des zentralen Konflikts.", status: "pending" },
  { id: "final-image", name: "Final Image", description: "Schlussbild, das den vollzogenen Wandel spiegelt.", status: "pending" },
];

/** Heldenreise — 12 Stationen nach Campbell/Vogler. */
const HERO_JOURNEY_BEATS: Beat[] = [
  { id: "ordinary-world", name: "Ordinary World", description: "Der Held in seinem Alltag und gewohnten Umfeld.", status: "pending" },
  { id: "call-to-adventure", name: "Call to Adventure", description: "Der Ruf bricht in die gewohnte Welt ein.", status: "pending" },
  { id: "refusal-of-the-call", name: "Refusal of the Call", description: "Zögern, Angst und Widerstand gegen den Ruf.", status: "pending" },
  { id: "meeting-the-mentor", name: "Meeting the Mentor", description: "Begegnung mit Weisheit, Werkzeug oder Ratgeber.", status: "pending" },
  { id: "crossing-the-first-threshold", name: "Crossing the First Threshold", description: "Der Held verlässt die gewohnte Welt endgültig.", status: "pending" },
  { id: "tests-allies-enemies", name: "Tests, Allies, Enemies", description: "Bewährungsproben, Verbündete und Gegner.", status: "pending" },
  { id: "approach-to-the-innermost-cave", name: "Approach to the Inmost Cave", description: "Größte Nähe zum Ziel, größte Gefahr.", status: "pending" },
  { id: "ordeal", name: "Ordeal", description: "Schwarzer Moment: Tod und Wiedergeburt.", status: "pending" },
  { id: "reward", name: "Reward", description: "Belohnung: Schwert, Erkenntnis, Versöhnung.", status: "pending" },
  { id: "the-road-back", name: "The Road Back", description: "Verfolgung, Konsequenzen, Rückweg.", status: "pending" },
  { id: "resurrection", name: "Resurrection", description: "Letzte Prüfung und finale Verwandlung.", status: "pending" },
  { id: "return-with-the-elixir", name: "Return with the Elixir", description: "Heimkehr mit dem gewonnenen Elixier.", status: "pending" },
];

/** Drei-Akt-Struktur — 3 Akte mit je 3 Unterbeats (9 Beats). */
const THREE_ACT_BEATS: Beat[] = [
  { id: "act1-setup", name: "Akt I – Ausgangslage", description: "Einführung von Held, Welt und Alltag (Exposition).", status: "pending" },
  { id: "act1-inciting-incident", name: "Akt I – Auslösendes Ereignis", description: "Die Störung, die die Handlung in Gang setzt.", status: "pending" },
  { id: "act1-first-plot-point", name: "Akt I – Erster Wendepunkt", description: "Der Held überschreitet die Schwelle; Akt II beginnt.", status: "pending" },
  { id: "act2-rising-action", name: "Akt II – Steigende Handlung", description: "Hürden, Komplikationen, neue Verbündete und Feinde.", status: "pending" },
  { id: "act2-midpoint", name: "Akt II – Midpoint", description: "Wendepunkt in der Mitte: neue Einsicht oder Eskalation.", status: "pending" },
  { id: "act2-second-plot-point", name: "Akt II – Zweiter Wendepunkt", description: "Die Lage spitzt sich zu; Akt III kündigt sich an.", status: "pending" },
  { id: "act3-climax", name: "Akt III – Klimax", description: "Höhepunkt: die entscheidende Konfrontation (Resolution).", status: "pending" },
  { id: "act3-falling-action", name: "Akt III – Fallende Handlung", description: "Konsequenzen des Höhepunkts.", status: "pending" },
  { id: "act3-resolution", name: "Akt III – Auflösung", description: "Neues Gleichgewicht und Ausklang.", status: "pending" },
];

const TEMPLATES: Record<BeatTemplateType, BeatTemplate> = {
  "save-the-cat": {
    type: "save-the-cat",
    name: "Save the Cat",
    description: "15 Beats nach Blake Snyder – klassische Hollywood-Dramaturgie.",
    beats: SAVE_THE_CAT_BEATS,
  },
  "hero-journey": {
    type: "hero-journey",
    name: "Heldenreise",
    description: "12 Stationen nach Campbell/Vogler – die monomythologische Struktur.",
    beats: HERO_JOURNEY_BEATS,
  },
  "three-act": {
    type: "three-act",
    name: "Drei-Akt-Struktur",
    description: "Drei Akte (Exposition, Konfrontation, Resolution) mit je drei Unterbeats.",
    beats: THREE_ACT_BEATS,
  },
};

/** Fallback, falls ein unbekannter Vorlagentyp übergeben wird. */
const FALLBACK_TEMPLATE_TYPE: BeatTemplateType = "three-act";

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Tiefe Kopie eines Beats – verhindert geteilten, mutierbaren Zustand. */
function cloneBeat(beat: Beat): Beat {
  return {
    id: beat.id,
    name: beat.name,
    description: beat.description,
    status: beat.status,
    ...(typeof beat.targetChapter === "number" ? { targetChapter: beat.targetChapter } : {}),
  };
}

/** Tiefe Kopie einer Vorlage inklusive aller Beats. */
function cloneTemplate(template: BeatTemplate): BeatTemplate {
  return {
    type: template.type,
    name: template.name,
    description: template.description,
    beats: template.beats.map(cloneBeat),
  };
}

/**
 * Verteilt `beatCount` Beats gleichmäßig über `chapterCount` Kapitel.
 * Ergebnis ist immer im Bereich 1..chapterCount (bzw. 1, wenn keine Kapitel).
 */
function distributeTargetChapter(beatIndex: number, beatCount: number, chapterCount: number): number {
  if (chapterCount <= 1) return 1;
  if (beatCount <= 1) return 1;
  const ratio = beatIndex / (beatCount - 1);
  return Math.min(chapterCount, Math.max(1, Math.round(1 + ratio * (chapterCount - 1))));
}

/**
 * Löst für jeden Beat der Vorlage ein `targetChapter` auf: ein bereits
 * gesetztes, gültiges Ziel bleibt erhalten, sonst wird gleichmäßig verteilt.
 */
function resolveBeats(template: BeatTemplate, chapterCount: number): Beat[] {
  const beats = Array.isArray(template?.beats) ? template.beats : [];
  return beats.map((beat, i) => {
    const cloned = cloneBeat(beat);
    const explicit = beat?.targetChapter;
    const isValid =
      typeof explicit === "number" &&
      Number.isFinite(explicit) &&
      explicit >= 1 &&
      explicit <= Math.max(chapterCount, 1);
    cloned.targetChapter = isValid
      ? (explicit as number)
      : distributeTargetChapter(i, beats.length, chapterCount);
    return cloned;
  });
}

/** Status, die ein Kapitel als abgeschlossen markieren. */
const COMPLETED_CHAPTER_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "final",
  "published",
  "finished",
  "fertig",
  "abgeschlossen",
  "finalisiert",
]);

/**
 * Leitet den Beat-Status aus dem zugeordneten Kapitel ab.
 * Kein Kapitel → Fallback auf den Vorlagen-Status (Default "pending").
 */
function deriveBeatStatus(chapter: BookChapterInput | undefined, fallback: BeatStatus): BeatStatus {
  if (!chapter) return fallback;
  const status = typeof chapter.status === "string" ? chapter.status.toLowerCase().trim() : "";
  if (COMPLETED_CHAPTER_STATUSES.has(status)) return "completed";
  const content = typeof chapter.content === "string" ? chapter.content : "";
  return content.trim().length > 0 ? "draft" : "pending";
}

/** Findet das Kapitel zu einer Zielnummer (per `number` oder Positionsindex). */
function findChapterAt(
  chapters: BookChapterInput[],
  targetChapter: number,
): BookChapterInput | undefined {
  for (let i = 0; i < chapters.length; i++) {
    const num = typeof chapters[i]?.number === "number" ? (chapters[i].number as number) : i + 1;
    if (num === targetChapter) return chapters[i];
  }
  return undefined;
}

/** Kapitelanzahl defensiv bestimmen (ungültige Eingabe → 0). */
function chapterCountOf(chapters: BookChapterInput[]): number {
  return Array.isArray(chapters) ? chapters.length : 0;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Gibt die Beat-Struktur einer Vorlage zurück.
 * Liefert bei unbekanntem `type` defensiv die Drei-Akt-Vorlage.
 * Jeder Aufruf gibt eine frische, tiefe Kopie zurück (kein geteilter Zustand).
 */
export function getBeatTemplate(type: BeatTemplateType): BeatTemplate {
  const resolved = TEMPLATES[type] ?? TEMPLATES[FALLBACK_TEMPLATE_TYPE];
  return cloneTemplate(resolved);
}

/** Listet alle verfügbaren Vorlagen als frische Kopien auf. */
export function listBeatTemplates(): BeatTemplate[] {
  return (Object.keys(TEMPLATES) as BeatTemplateType[]).map((t) => getBeatTemplate(t));
}

/**
 * Wendet eine Beat-Vorlage auf die Kapitel an.
 *
 * - Verteilt die Beats gleichmäßig über die vorhandenen Kapitel (oder
 *   respektiert ein bereits gesetztes `targetChapter`).
 * - Leitet den Beat-Status aus Inhalt/Kapitelstatus ab.
 * - Gibt die Kapitel unverändert zurück, ergänzt um `beats`.
 *
 * Die Eingabe wird nicht mutiert; leere Bücher ergeben ein leeres Array.
 */
export function applyBeatTemplate(
  chapters: BookChapterInput[],
  template: BeatTemplate,
): ChapterBeatAssignment[] {
  if (!Array.isArray(chapters) || chapters.length === 0) return [];

  const beats = resolveBeats(template, chapters.length);

  return chapters.map((chapter, index) => {
    const chapterNumber =
      typeof chapter?.number === "number" ? (chapter.number as number) : index + 1;
    const assigned = beats
      .filter((b) => b.targetChapter === chapterNumber)
      .map((b) => ({ ...cloneBeat(b), status: deriveBeatStatus(chapter, b.status) }));
    return { ...chapter, beats: assigned };
  });
}

/**
 * Prüft, ob alle Beats einer Vorlage durch Kapitel abgedeckt sind.
 *
 * Ein Beat gilt als abgedeckt, wenn ihm ein Kapitel mit nicht-leerem Inhalt
 * zugeordnet ist (Status "draft" oder "completed"). Die Eingabe wird nicht
 * mutiert; fehlende Daten führen zu definierten Nullwerten.
 */
export function validateBeatCoverage(
  chapters: BookChapterInput[],
  template: BeatTemplate,
): BeatCoverageResult {
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const beats = resolveBeats(template, chapterCountOf(safeChapters));

  const byStatus: Record<BeatStatus, number> = { pending: 0, draft: 0, completed: 0 };
  const missing: string[] = [];

  for (const beat of beats) {
    const chapter = findChapterAt(safeChapters, beat.targetChapter ?? 1);
    const status = deriveBeatStatus(chapter, beat.status);
    byStatus[status] += 1;
    if (status === "pending") missing.push(beat.id);
  }

  const total = beats.length;
  const covered = total - missing.length;
  const coverage = total > 0 ? Math.round((covered / total) * 100) / 100 : 0;

  return {
    total,
    covered,
    coverage,
    missing,
    byStatus,
    complete: total > 0 && covered === total,
  };
}
