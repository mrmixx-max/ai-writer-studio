// Textformatierungs-Engine (Sprint 14, Agent 1) — reine Funktionen, keine Seiteneffekte.
//
// Editor-Speichermodell (recherche, read-only):
// - src/components/Editor/Editor.tsx: TipTap 2 (`@tiptap/react`, StarterKit, Heading Level 1-3).
// - Inhalt = TipTap-JSON-Dokument (`editor.getJSON()`), persistiert als JSON-String
//   via `onChange(JSON.stringify(editor.getJSON()))`, geladen via `setContent(parsed)`.
// - Text-Hilfen: `src/services/editor/count.ts` (tiptapToText, countWords Unicode-aware),
//   `src/services/import/tiptap.ts` (blocksToTipTap), `src/services/editor/markdown.ts`.
// Diese Engine arbeitet bewusst auf zwei Ebenen:
//   1. Plaintext (Absätze/Zeichen) — editor-unabhängig, testbar.
//   2. TipTap-JSON (Doc-Transformation) — direkt auf den gespeicherten Inhalt anwendbar.

export type QuoteLocale = "de" | "en";

export interface FormatOptions {
  /** "de" (Standard): „…" / ‚…'; "en": "…" / '…' */
  locale?: QuoteLocale;
  /** Gedankenstriche umwandeln (Standard: true) */
  convertDashes?: boolean;
  /** Typografische Anführungszeichen (Standard: true) */
  smartQuotes?: boolean;
  /** Deutsche Abstandsregeln anwenden — nur bei locale "de" (Standard: true) */
  germanSpacing?: boolean;
}

/** Ergebnis der Kapitelüberschrift-Erkennung. */
export interface ChapterHeadingMatch {
  /** Kapitelnummer als arabische Zahl (römische werden umgerechnet). */
  number: number;
  /** Rohe Nummer wie geschrieben ("3", "XII"). */
  rawNumber: string;
  /** Optionale Titelzeile nach Doppelpunkt/Punkt/Strich. */
  title: string;
  /** Erkanntes Schlüsselwort ("Kapitel" | "Chapter", Original-Schreibweise). */
  keyword: string;
  /** Vorgeschlagener Heading-Level für TipTap (Kapitel = 1). */
  level: 1 | 2 | 3;
}

export interface ChapterWordCount {
  /** 0 = Text vor der ersten Kapitelüberschrift (Frontmatter/Prolog ohne Heading). */
  chapter: number;
  /** Überschriftszeile wie gefunden ("" bei chapter 0 ohne Heading). */
  heading: string;
  words: number;
  chars: number;
}

/** Injizierbare LLM-Completion-Funktion (in Tests gemockt). */
export type CompleteFn = (prompt: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Wortzählung (Unicode-aware, konsistent mit src/services/editor/count.ts)
// ---------------------------------------------------------------------------

/** Zählt Wörter (Unicode-Buchstaben/Zahlen, deutsche Umlaute/ß korrekt). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[\p{L}\p{N}'’]+/gu);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Auto-Paragraph (Doppel-Enter)
// ---------------------------------------------------------------------------

/** Teilt Rohtext an Doppel-Enter (2+ Zeilenumbrüchen) in Absätze. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+\n/g, "\n").trim())
    .filter((p) => p.length > 0);
}

/**
 * Normalisiert Doppel-Enter: 3+ Umbrüche → genau 2, trimmmt Ränder,
 * entfernt Leerzeichen am Zeilenende. Idempotent.
 */
export function normalizeDoubleEnter(text: string): string {
  return splitParagraphs(text).join("\n\n");
}

// ---------------------------------------------------------------------------
// Gedankenstriche
// ---------------------------------------------------------------------------

/**
 * Wandelt ASCII-Striche um: `---` und `--` → — (Em-dash).
 * Reihenfolge wichtig: erst triple, dann double. Idempotent.
 */
export function convertDashes(text: string): string {
  return text.replace(/---/g, "—").replace(/--/g, "—");
}

// ---------------------------------------------------------------------------
// Typografische Anführungszeichen
// ---------------------------------------------------------------------------

const DE_OPEN_DQ = "„";
const DE_CLOSE_DQ = "“";
const DE_OPEN_SQ = "‚";
const DE_CLOSE_SQ = "‘";
const EN_OPEN_DQ = "“";
const EN_CLOSE_DQ = "”";
const EN_OPEN_SQ = "‘";
const EN_CLOSE_SQ = "’";

/**
 * Wandelt gerade Anführungszeichen in typografische um.
 * Öffnend/schließend-Heuristik: nach Leerzeichen/Satzanfang/Zeilenstart → öffnend,
 * sonst schließend. Bereits typografische Zeichen bleiben unverändert.
 */
export function applySmartQuotes(text: string, locale: QuoteLocale = "de"): string {
  const openDQ = locale === "de" ? DE_OPEN_DQ : EN_OPEN_DQ;
  const closeDQ = locale === "de" ? DE_CLOSE_DQ : EN_CLOSE_DQ;
  const openSQ = locale === "de" ? DE_OPEN_SQ : EN_OPEN_SQ;
  const closeSQ = locale === "de" ? DE_CLOSE_SQ : EN_CLOSE_SQ;

  let out = "";
  let prev = "\n"; // Satzanfang → öffnend
  const isOpener = (ch: string): boolean =>
    ch === "" || ch === "\n" || ch === "(" || ch === "[" || ch === "{" || /\s/.test(ch);

  for (const ch of text) {
    if (ch === '"') {
      out += isOpener(prev) ? openDQ : closeDQ;
      prev = ch;
    } else if (ch === "'") {
      // Apostroph in Wortmitte (don't, l'amour, O'Brien) bleibt gerade.
      const next = ""; // positionsunabhängig: Buchstabe davor → Apostroph
      void next;
      if (/[\p{L}\p{N}]/u.test(prev)) {
        out += locale === "de" ? "’" : "’";
      } else {
        out += isOpener(prev) ? openSQ : closeSQ;
      }
      prev = ch;
    } else {
      out += ch;
      prev = ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deutsche Typografie: Auslassungspunkte, Abstände
// ---------------------------------------------------------------------------

/** `...` → `…` (außer bereits vorhandene Ellipsen). */
export function convertEllipsis(text: string): string {
  return text.replace(/\.{3,}/g, "…");
}

/**
 * Deutsche Abstandsregeln (reine Funktion):
 * - Mehrfach-Leerzeichen → eines (keine Tab-/Newline-Veränderung außer Spaces).
 * - Geschütztes Leerzeichen (nbsp) vor `! ? : ;` und nach `«`, vor `»` keins extra.
 * - `...` → `…`; Striche/Quotes bleiben Aufgabe von convertDashes/applySmartQuotes.
 */
export function applyGermanSpacing(text: string): string {
  let out = text
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+([!?;:])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/ »/g, " »");
  out = convertEllipsis(out);
  return out;
}

// ---------------------------------------------------------------------------
// Kapitelüberschrift-Erkennung
// ---------------------------------------------------------------------------

/**
 * Erkennt Kapitelüberschriften wie:
 *   "Kapitel 1", "KAPITEL 3: Der Anfang", "Kapitel XII – Ankunft",
 *   "Chapter 2", "Chapter IV. The Return", "Kapitel 7 - Prolog"
 * Case-insensitiv, römische Ziffern werden in `number` arabisch.
 * Gibt null zurück, wenn die Zeile keine Kapitelüberschrift ist.
 */
export function detectChapterHeading(line: string): ChapterHeadingMatch | null {
  const m = line.match(
    /^\s*(Kapitel|Chapter)\s+(\d+|[IVXLCDMivxlcdm]+)\s*(?:[:.\-–—]\s*(.+?))?\s*$/i,
  );
  if (!m) return null;
  const keyword = m[1];
  const rawNumber = m[2];
  const title = (m[3] ?? "").trim();
  const number = /^\d+$/.test(rawNumber) ? parseInt(rawNumber, 10) : romanToInt(rawNumber);
  if (!Number.isFinite(number) || number < 1) return null;
  return { number, rawNumber, title, keyword, level: 1 };
}

function romanToInt(roman: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let prev = 0;
  for (const ch of roman.toUpperCase().split("").reverse()) {
    const v = map[ch] ?? NaN;
    if (Number.isNaN(v)) return NaN;
    if (v < prev) total -= v;
    else {
      total += v;
      prev = v;
    }
  }
  return total;
}

/**
 * Wendet Kapitel-Erkennung auf ein Dokument an: Zeilen, die Kapitelüberschriften
 * sind, werden als solche markiert zurückgegeben.
 */
export interface HeadingAnnotation {
  lineIndex: number;
  line: string;
  heading: ChapterHeadingMatch;
}

export function findChapterHeadings(text: string): HeadingAnnotation[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const found: HeadingAnnotation[] = [];
  lines.forEach((line, lineIndex) => {
    const heading = detectChapterHeading(line);
    if (heading) found.push({ lineIndex, line, heading });
  });
  return found;
}

// ---------------------------------------------------------------------------
// Pipelines (Plaintext)
// ---------------------------------------------------------------------------

const DEFAULTS: Required<FormatOptions> = {
  locale: "de",
  convertDashes: true,
  smartQuotes: true,
  germanSpacing: true,
};

/** Formatiert einen einzelnen Absatz (Striche → Quotes → deutsche Abstände). */
export function formatParagraph(text: string, options: FormatOptions = {}): string {
  const o = { ...DEFAULTS, ...options };
  let out = text;
  if (o.convertDashes) out = convertDashes(out);
  if (o.smartQuotes) out = applySmartQuotes(out, o.locale);
  if (o.germanSpacing && o.locale === "de") out = applyGermanSpacing(out);
  if (o.locale === "en") out = convertEllipsis(out);
  return out;
}

/**
 * Formatiert ein Volltext-Dokument absatzweise (Doppel-Enter bleibt erhalten).
 * Kapitelüberschriften-Zeilen werden nicht typografisch verändert (nur getrimmt).
 */
export function formatDocument(text: string, options: FormatOptions = {}): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/(\n{2,})/);
  return blocks
    .map((block) => {
      if (/^\n{2,}$/.test(block)) return "\n\n";
      if (block.trim() === "") return "";
      const lines = block.split("\n").map((line) => {
        if (detectChapterHeading(line)) return line.trim();
        return formatParagraph(line, options);
      });
      return lines.join("\n").trim();
    })
    .join("")
    .trim();
}

// ---------------------------------------------------------------------------
// Wortzählung pro Kapitel
// ---------------------------------------------------------------------------

/**
 * Teilt Text an Kapitelüberschriften und zählt Wörter/Zeichen je Abschnitt.
 * Text vor der ersten Überschrift landet in chapter 0 (heading "").
 * Kapitel ohne eigenes Heading gibt es nicht — jede Section nach einem Heading
 * trägt dessen Nummer.
 */
export function countWordsPerChapter(text: string): ChapterWordCount[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sections: { chapter: number; heading: string; body: string[] }[] = [
    { chapter: 0, heading: "", body: [] },
  ];
  for (const line of lines) {
    const hit = detectChapterHeading(line);
    if (hit) {
      sections.push({ chapter: hit.number, heading: line.trim(), body: [] });
    } else {
      sections[sections.length - 1].body.push(line);
    }
  }
  const result = sections
    .filter((s, i) => i > 0 || s.body.join("\n").trim().length > 0)
    .map((s) => {
      const body = s.body.join("\n");
      return { chapter: s.chapter, heading: s.heading, words: countWords(body), chars: body.length };
    });
  return result;
}

/**
 * LLM-gestützte Zusammenfassung der Kapitel-Längen. `complete` ist injizierbar
 * (in Tests gemockt): erhält einen Prompt mit den Zählwerten, gibt Fließtext zurück.
 */
export async function summarizeChapterLengths(
  chapters: ChapterWordCount[],
  complete: CompleteFn,
): Promise<string> {
  const lines = chapters
    .map((c) => `Kapitel ${c.chapter}: ${c.words} Wörter${c.heading ? ` (${c.heading})` : ""}`)
    .join("\n");
  const total = chapters.reduce((sum, c) => sum + c.words, 0);
  const prompt =
    `Fasse die Längenverteilung dieser ${chapters.length} Kapitel (gesamt ${total} Wörter) ` +
    `in 2-3 Sätzen auf Deutsch zusammen und benenne das längste/kürzeste Kapitel:\n${lines}`;
  return complete(prompt);
}

// ---------------------------------------------------------------------------
// TipTap-JSON-Transformation (direkt auf Editor-Speicher anwendbar)
// ---------------------------------------------------------------------------

/** Minimaler TipTap-Knoten (nur was wir lesen/schreiben). */
export interface TipTapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  [key: string]: unknown;
}

function mapTextNode(node: TipTapNode, options: FormatOptions): TipTapNode {
  if (node.type === "text" && typeof node.text === "string") {
    return { ...node, text: formatParagraph(node.text, options) };
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((c) => mapTextNode(c, options)) };
  }
  return node;
}

/**
 * Wendet Strich-/Quote-/Abstandsregeln auf alle Textknoten eines TipTap-Docs an.
 * Gibt ein neues Doc zurück (keine Mutation).
 */
export function formatTiptapDoc(doc: TipTapNode, options: FormatOptions = {}): TipTapNode {
  return mapTextNode(doc, options);
}

/**
 * Wandelt Absätze, deren Gesamttext einer Kapitelüberschrift entspricht,
 * in `{ type: "heading", attrs: { level: 1 } }` um. Gibt ein neues Doc zurück.
 */
export function applyChapterHeadingStyle(doc: TipTapNode): TipTapNode {
  if (!Array.isArray(doc.content)) return doc;
  const content = doc.content.map((block) => {
    if (block.type !== "paragraph" || !Array.isArray(block.content)) return block;
    const plain = block.content.map((n) => (n.type === "text" ? (n.text ?? "") : "")).join("");
    const hit = detectChapterHeading(plain.trim());
    if (!hit) return block;
    return { ...block, type: "heading", attrs: { ...(block.attrs ?? {}), level: hit.level } };
  });
  return { ...doc, content };
}
