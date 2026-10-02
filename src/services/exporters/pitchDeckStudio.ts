// Pitch-Deck-Studio-Service (WP 25.1): Exposé-Labor & Normseiten-Maschine.
//
// Lokal, deterministisch, defensiv — KEINE LLM-Aufrufe, keine Netzwerkzugriffe.
// Defensive Fallbacks bei fehlenden Daten (fehlender Pitch, leere Kapitel,
// unbekannte Figuren, TipTap-JSON- vs. Klartext-Inhalt).
//
// Normseiten-Regeln (VG Wort / Verlags-Norm):
//   - 30 Zeilen pro Seite
//   - 60 Anschläge pro Zeile
//   => 1.800 Anschläge inkl. Leerzeichen pro Normseite
//      (die verbreitete Angabe „~1.500 Zeichen" ist die Wort-Äquivalenz,
//       die Anschlag-Kapazität der Normseite selbst ist 30 × 60 = 1.800).
//   - Nichtproportionale Schrift (Courier Final Draft / Liberation Mono) —
//     reine Darstellungsvorgabe, hier nicht relevant.
//   - Wörter werden NIE zerschnitten: liegt ein Wort länger als 60 Anschläge,
//     steht es allein auf einer (dann überlangen) Zeile.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Kapitel-Eingabe für das Exposé (bewusst schlank, ohne DB-/Statusfelder). */
export interface ChapterInput {
  id: string;
  title: string;
  content: string;
}

/** Figur-Eingabe für das Exposé. */
export interface Character {
  name: string;
  role: string;
  description: string;
}

/** Manuskript-Projekt als Eingabe für das Exposé-Labor. */
export interface ManuscriptProject {
  title: string;
  author: string;
  chapters: ChapterInput[];
  premise?: string;
  logline?: string;
  characters: Character[];
}

/** Kurzbiografie einer Figur im Exposé. */
export interface CharacterSummary {
  name: string;
  role: string;
  /** Kurzer Entwicklungsbogen (aus der Figuren-Beschreibung abgeleitet). */
  arc: string;
}

/** Fertiges Exposé. */
export interface Exposé {
  logline: string;
  pitch: string;
  premise: string;
  synopsis: string;
  /** Kurzbiografien der Figuren. */
  characters: CharacterSummary[];
  /** Handlungsübersicht, ein Eintrag pro Kapitel. */
  actionOutline: string[];
}

/** Alias ohne Diakritikum für Umgebungen, die „Exposé" nicht mögen. */
export type Expose = Exposé;

/** Eine normgerechte Zeile (max. 60 Anschläge, außer bei überlangen Wörtern). */
export interface NormLine {
  text: string;
  /** Anzahl Anschläge (UTF-16-Codeeinheiten) inkl. Leerzeichen. */
  charCount: number;
}

/** Eine normgerechte Seite (max. 30 Zeilen). */
export interface NormPage {
  lines: NormLine[];
  pageNumber: number;
}

// ---------------------------------------------------------------------------
// Normseiten-Konstanten
// ---------------------------------------------------------------------------

/** Zeilen pro Normseite. */
export const NORM_LINES_PER_PAGE = 30;
/** Anschläge pro Normzeile. */
export const NORM_CHARS_PER_LINE = 60;
/** Anschläge pro Normseite (30 × 60). */
export const NORM_CHARS_PER_PAGE = NORM_LINES_PER_PAGE * NORM_CHARS_PER_LINE;

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Robustes String-Coercion mit Trim; `null`/`undefined` → "". */
function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

/** Erster Satz eines Textes (deterministisch); fällt auf den Ganztext zurück. */
function firstSentence(text: unknown): string {
  const t = safeString(text).replace(/\s+/g, " ").trim();
  if (!t) return "";
  const match = t.match(/^.*?[.!?…](?=\s|$)/);
  return (match ? match[0] : t).trim();
}

/** Sammelt `text`-Felder rekursiv aus einem (TipTap-)JSON-Knoten. */
function collectText(node: unknown, out: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.text === "string") out.push(obj.text);
    if (Array.isArray(obj.content)) collectText(obj.content, out);
  }
}

/**
 * Wandelt Kapitelinhalt defensiv in Klartext um. Versteht sowohl reines
 * TipTap-JSON (`{"type":"doc",...}`) als auch bereits vorliegenden Klartext.
 * Bei ungültigem JSON wird der Rohstring unverändert zurückgegeben.
 */
export function extractPlainText(content: unknown): string {
  if (typeof content !== "string") return "";
  const raw = content.trim();
  if (!raw) return "";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const collected: string[] = [];
      collectText(parsed, collected);
      const joined = collected
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (joined) return joined;
    } catch {
      // Kein gültiges JSON → Rohstring als Klartext behandeln.
    }
  }
  return raw;
}

/** Bricht einen Absatz greedy auf Zeilen à `maxChars` um — nie mitten im Wort. */
function wrapParagraph(paragraph: string, maxChars: number): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word; // Einzelwort darf 60 Anschläge überschreiten (nie zerschneiden).
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Bricht den Gesamttext in Normzeilen um (Absätze bleiben als Leerzeilen erhalten). */
function wrapText(text: unknown): NormLine[] {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return [];

  const normalized = raw.replace(/\r\n?/g, "\n");
  const paragraphs = normalized.split("\n");
  const lines: NormLine[] = [];
  for (const paragraph of paragraphs) {
    const wrapped = wrapParagraph(paragraph, NORM_CHARS_PER_LINE);
    for (const line of wrapped) {
      lines.push({ text: line, charCount: line.length });
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Normseiten-Maschine
// ---------------------------------------------------------------------------

/**
 * Erzeugt die ERSTE normgerechte Seite (Seite 1) aus einem Text.
 * Max. 30 Zeilen à 60 Anschläge; Wörter werden nie zerschnitten.
 * Bei leerem Text: leere Seite mit `pageNumber: 1` (defensiv).
 */
export function generateNormPage(text: string): NormPage {
  const lines = wrapText(text);
  return {
    lines: lines.slice(0, NORM_LINES_PER_PAGE),
    pageNumber: 1,
  };
}

/**
 * Paginiert einen Text vollständig in Normseiten (30 Zeilen pro Seite).
 * Leerer Text → leeres Array.
 */
export function generateNormPages(text: string): NormPage[] {
  const lines = wrapText(text);
  const pages: NormPage[] = [];
  for (let i = 0; i < lines.length; i += NORM_LINES_PER_PAGE) {
    pages.push({
      lines: lines.slice(i, i + NORM_LINES_PER_PAGE),
      pageNumber: pages.length + 1,
    });
  }
  return pages;
}

/**
 * Zählt die Anzahl der Normseiten eines Textes (30 Zeilen pro Seite).
 * Leerer/whitespace-only Text → 0.
 */
export function countNormPages(text: string): number {
  const lines = wrapText(text);
  return Math.ceil(lines.length / NORM_LINES_PER_PAGE);
}

// ---------------------------------------------------------------------------
// Exposé-Labor
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Exposé aus einem Manuskript-Projekt.
 *
 * Extrahiert/leitet deterministisch ab:
 *   - logline       ← project.logline → Prämisse → erster Kapitelsatz
 *   - pitch         ← Logline + Prämisse
 *   - premise       ← project.premise → abgeleitet aus den Kapiteln
 *   - synopsis      ← Kapitelüberschriften + jeweiliger erster Satz
 *   - characters    ← Kurzbiografien (Name, Rolle, Entwicklungsbogen)
 *   - actionOutline ← Handlungsübersicht, ein Eintrag pro Kapitel
 *
 * Defensiv: `null`/`undefined`-Projekt, fehlende Kapitel/Figuren und
 * TipTap-JSON-Inhalte werden abgefangen — es wird nie geworfen.
 */
export function generateExposé(project: ManuscriptProject | null | undefined): Exposé {
  const safeProject: Partial<ManuscriptProject> =
    project && typeof project === "object" ? project : {};

  const title = safeString(safeProject.title) || "Ohne Titel";
  const author = safeString(safeProject.author) || "Unbekannt";

  const chapters: ChapterInput[] = Array.isArray(safeProject.chapters)
    ? safeProject.chapters.filter((c): c is ChapterInput => c != null)
    : [];
  const characters: Character[] = Array.isArray(safeProject.characters)
    ? safeProject.characters.filter((c): c is Character => c != null)
    : [];

  const chapterTitle = (c: ChapterInput, index: number): string =>
    safeString(c?.title) || `Kapitel ${index + 1}`;
  const chapterText = (c: ChapterInput): string => extractPlainText(c?.content);

  // --- Logline -------------------------------------------------------------
  const explicitLogline = safeString(safeProject.logline);
  const explicitPremise = safeString(safeProject.premise);
  const firstChapterSentence = chapters.length ? firstSentence(chapterText(chapters[0])) : "";
  const logline =
    explicitLogline ||
    firstSentence(explicitPremise) ||
    firstChapterSentence ||
    `${title} — ein Werk von ${author}.`;

  // --- Prämisse ------------------------------------------------------------
  const derivedPremise = chapters.length
    ? chapters
        .slice(0, 3)
        .map((c, i) => {
          const s = firstSentence(chapterText(c));
          return s ? s : chapterTitle(c, i);
        })
        .join(" ")
        .trim()
    : "";
  const premise = explicitPremise || derivedPremise || `„${title}" von ${author}.`;

  // --- Pitch ---------------------------------------------------------------
  const pitch =
    premise && premise !== logline ? `${logline} ${premise}`.trim() : logline;

  // --- Synopse -------------------------------------------------------------
  const synopsis = chapters.length
    ? chapters
        .map((c, i) => {
          const s = firstSentence(chapterText(c));
          return s ? `${chapterTitle(c, i)}: ${s}` : chapterTitle(c, i);
        })
        .join(" ")
        .trim()
    : premise;

  // --- Figuren-Kurzbiografien ---------------------------------------------
  const characterSummaries: CharacterSummary[] = characters.map((c) => {
    const name = safeString(c?.name) || "Unbenannt";
    const role = safeString(c?.role) || "Nebenfigur";
    const arc =
      firstSentence(safeString(c?.description)) ||
      `${name} tritt als ${role} in Erscheinung.`;
    return { name, role, arc };
  });

  // --- Handlungsübersicht --------------------------------------------------
  const actionOutline: string[] = chapters.map((c, i) => {
    const s = firstSentence(chapterText(c));
    return s ? `${chapterTitle(c, i)} — ${s}` : chapterTitle(c, i);
  });

  return {
    logline,
    pitch,
    premise,
    synopsis,
    characters: characterSummaries,
    actionOutline,
  };
}

/** Alias-Export (Schreibweise ohne Diakritikum). */
export const generateExpose = generateExposé;
