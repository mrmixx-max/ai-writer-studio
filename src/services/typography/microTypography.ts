// Mikrotypografie-Service (WP 20.2: Satzspiegel-Politur).
//
// Lokale, deterministische, LLM-freie Texttransformationen für den Feinsatz:
// - Erkennung von Schusterjungen/Hurenkindern (widows/orphans)
// - Hängende Interpunktion (hanging punctuation)
// - Geschützte Leerzeichen (non-breaking spaces)
// - Vermeidung mehrfacher Trennstriche
//
// Entwurfsregeln:
// - Reine Funktionen, kein IO, kein Zufall, keine LLM-Aufrufe.
// - Defensiv: fehlende/falsche Eingaben liefern leere Ergebnisse bzw. einen
//   leeren String; die Funktionen werfen nie.
// - Alle Anpassungen sind idempotent: mehrfaches Anwenden ändert nichts.
//   Die Muster verlangen ausdrücklich ein normales Leerzeichen (U+0020) bzw.
//   einen Bindestrich-Lauf; nach der Ersetzung ist die Bedingung nicht mehr
//   erfüllt, sodass ein zweiter Durchlauf nichts mehr verändert.

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Geschütztes Leerzeichen (non-breaking space, U+00A0). */
export const NBSP = "\u00A0";

/** Schmales Leerzeichen (thin space, U+2009) für hängende Interpunktion. */
export const THIN_SPACE = "\u2009";

/**
 * Höchstzahl Wörter, bis zu der eine Zeile als allein stehend gilt.
 * Klassische Satzregel: eine Zeile mit nur einem Wort am Absatzanfang
 * (Hurenkind) bzw. -ende (Schusterjunge) wirkt im Blocksatz als „verloren“.
 */
const WIDOW_ORPHAN_MAX_WORDS = 1;

/** Höchstzahl erlaubter aufeinanderfolgender Trennstriche. */
const MAX_CONSECUTIVE_HYPHENS = 3;

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art eines Satzfehlers. */
export type WidowOrphanType = "widow" | "orphan";

/**
 * Ein möglicher Satzfehler.
 *
 * widow  = Schusterjunge: allein stehende letzte Zeile eines Absatzes.
 * orphan = Hurenkind: allein stehende erste Zeile eines Absatzes.
 */
export interface WidowOrphanIssue {
  /** Art des Fehlers. */
  type: WidowOrphanType;
  /** 1-basierte, globale Zeilennummer über alle Absätze hinweg. */
  lineNumber: number;
  /** Inhalt der betroffenen Zeile (getrimmt). */
  text: string;
}

// ---------------------------------------------------------------------------
// Interne Hilfen
// ---------------------------------------------------------------------------

/** Zählt Wörter einer Zeile (Leerraum-getrennt). */
function countWords(line: string): number {
  return line.split(/\s+/).filter(Boolean).length;
}

/** Erster Index eines Zeichens, das kein Leerzeichen/Tabulator ist. */
function firstNonSpaceIndex(line: string): number {
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c !== " " && c !== "\t") return i;
  }
  return -1;
}

/** Letzter Index eines Zeichens, das kein Leerzeichen/Tabulator ist. */
function lastNonSpaceIndex(line: string): number {
  for (let i = line.length - 1; i >= 0; i--) {
    const c = line.charAt(i);
    if (c !== " " && c !== "\t") return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 1) Schusterjungen & Hurenkinder
// ---------------------------------------------------------------------------

/**
 * Erkennt mögliche Schusterjungen (widows) und Hurenkinder (orphans).
 *
 * Jeder Eintrag in `paragraphs` ist ein Absatz. Enthält ein Absatz
 * Zeilenumbrüche (`\n`), wird er in Zeilen zerlegt. Für Absätze mit
 * mindestens zwei nicht-leeren Zeilen gilt:
 * - erste Zeile mit nur einem Wort  → Hurenkind (`orphan`)
 * - letzte Zeile mit nur einem Wort → Schusterjunge (`widow`)
 *
 * Einzeilige Absätze werden bewusst nicht gewertet: dort ist kein Umbruch
 * erkennbar, jede kurze Zeile würde sonst als Fehlalarm erscheinen.
 *
 * Die Zeilennummern sind global und 1-basiert über alle Absätze hinweg
 * (leere Zeilen zählen mit). Das Ergebnis ist deterministisch.
 */
export function detectWidowsAndOrphans(paragraphs: string[]): WidowOrphanIssue[] {
  const issues: WidowOrphanIssue[] = [];
  if (!Array.isArray(paragraphs)) return issues;

  let lineNumber = 0;

  for (const para of paragraphs) {
    if (typeof para !== "string") continue;

    const rawLines = para.replace(/\r\n?/g, "\n").split("\n");
    const startLine = lineNumber + 1;
    lineNumber += rawLines.length;

    const nonBlank: { line: number; text: string }[] = [];
    rawLines.forEach((raw, idx) => {
      const trimmed = raw.trim();
      if (trimmed.length > 0) nonBlank.push({ line: startLine + idx, text: trimmed });
    });

    if (nonBlank.length < 2) continue;

    const first = nonBlank[0];
    if (countWords(first.text) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "orphan", lineNumber: first.line, text: first.text });
    }

    const last = nonBlank[nonBlank.length - 1];
    if (countWords(last.text) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "widow", lineNumber: last.line, text: last.text });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 2) Hängende Interpunktion
// ---------------------------------------------------------------------------

/** Öffnende Interpunktion, die links in den Rand hängen darf. */
const OPENING_PUNCT = new Set<string>([
  '"', // gerades Anführungszeichen
  "\u201E", // „  deutsches öffnendes
  "\u201C", // "  englisches öffnendes
  "\u201A", // ‚  deutsches einfaches öffnendes
  "\u2018", // '  einfaches öffnendes
  "\u00AB", // «
  "\u2039", // ‹
  "(",
  "[",
  "{",
]);

/** Schließende/terminale Interpunktion, die rechts in den Rand hängen darf. */
const CLOSING_PUNCT = new Set<string>([
  '"', // gerades Anführungszeichen
  "\u201D", // "  englisches schließendes
  "\u201C", // "  deutsches schließendes
  "\u2019", // '  einfaches schließendes
  "\u00BB", // »
  "\u203A", // ›
  ")",
  "]",
  "}",
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "-", // Trennstrich
  "\u2013", // –  Halbgeviertstrich
  "\u2014", // —  Geviertstrich
]);

/**
 * Wendet hängende Interpunktion auf eine einzelne Zeile an.
 *
 * Ein öffnendes Satzzeichen am Zeilenanfang wird durch ein schmales
 * Leerzeichen vom nachfolgenden Text abgesetzt, ein schließendes/terminales
 * Satzzeichen am Zeilenende ebenso. Dadurch kann es optisch in den Satzspiegel
 * ragen, ohne den Textblock zu verschieben.
 */
function hangLine(line: string): string {
  let result = line;

  const openIdx = firstNonSpaceIndex(result);
  if (openIdx !== -1) {
    const ch = result.charAt(openIdx);
    const next = result.charAt(openIdx + 1);
    if (OPENING_PUNCT.has(ch) && next !== THIN_SPACE && next !== "") {
      result = result.slice(0, openIdx + 1) + THIN_SPACE + result.slice(openIdx + 1);
    }
  }

  const closeIdx = lastNonSpaceIndex(result);
  if (closeIdx !== -1) {
    const ch = result.charAt(closeIdx);
    const prev = result.charAt(closeIdx - 1);
    if (CLOSING_PUNCT.has(ch) && prev !== THIN_SPACE && prev !== "") {
      result = result.slice(0, closeIdx) + THIN_SPACE + result.slice(closeIdx);
    }
  }

  return result;
}

/**
 * Lässt Trennstriche, Anführungszeichen und Punkte optisch über den Rand ragen.
 *
 * Die Umsetzung erfolgt zeilenweise: öffnende Satzzeichen am Zeilenanfang und
 * schließende/terminale Satzzeichen am Zeilenende werden mit einem schmalen
 * Leerzeichen (U+2009) vom Text abgesetzt. Die Transformation ist idempotent.
 */
export function applyHangingPunctuation(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";
  return text.replace(/\r\n?/g, "\n").split("\n").map(hangLine).join("\n");
}

// ---------------------------------------------------------------------------
// 3) Geschützte Leerzeichen
// ---------------------------------------------------------------------------

/** Titel- und Abkürzungsformen, die mit NBSP an das Folgende gebunden werden. */
const ABBREVIATIONS: string[] = [
  "Prof",
  "Dipl",
  "theol",
  "phil",
  "rer",
  "nat",
  "jur",
  "oec",
  "med",
  "Med",
  "Dr",
  "Doz",
  "Ing",
  "Mag",
  "Abs",
  "Art",
  "Ziff",
  "Jhd",
  "Kap",
  "Mio",
  "Mrd",
  "Tsd",
  "Stk",
  "Hr",
  "Fr",
  "Jh",
  "Bd",
  "Nr",
  "Abb",
  "Tab",
  "Anm",
  "Bsp",
  "vgl",
  "bzw",
  "ggf",
  "evtl",
  "inkl",
  "exkl",
  "zzgl",
  "abzgl",
  "sog",
  "usw",
  "etc",
  "max",
  "min",
  "ca",
  "z",
  "d",
  "u",
  "o",
  "i",
].sort((a, b) => b.length - a.length);

/** Maßeinheiten, die mit NBSP an die vorangehende Zahl gebunden werden. */
const UNITS: string[] = [
  "km/h",
  "m/s",
  "kWh",
  "kbit",
  "Mbit",
  "Gbit",
  "MHz",
  "GHz",
  "kHz",
  "km",
  "cm",
  "mm",
  "kg",
  "mg",
  "ml",
  "cl",
  "kB",
  "KB",
  "MB",
  "GB",
  "TB",
  "min",
  "ms",
  "ns",
  "Hz",
  "Stk",
  "°C",
  "°F",
  "kW",
  "mA",
  "ha",
  "m²",
  "m³",
  "km²",
  "h",
  "s",
  "g",
  "l",
  "m",
  "t",
  "V",
  "W",
  "A",
  "%",
].sort((a, b) => b.length - a.length);

/** Abkürzung + Punkt + normales Leerzeichen. */
const ABBREVIATION_RE = new RegExp(`(\\b(?:${ABBREVIATIONS.join("|")})\\.) `, "g");

/** Zahl + normales Leerzeichen + Einheit (Wortgrenze nach der Einheit). */
const NUMBER_UNIT_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?) (${UNITS.join("|")})(?![\\w])`,
  "g",
);

/** Kette aus mindestens zwei Initialen, z. B. „J. R. R.". */
const INITIAL_CHAIN_RE = /\b([A-ZÄÖÜ])\.(?: +([A-ZÄÖÜ])\.)+/g;

/** Initiale direkt vor einem Namen, z. B. „R. Tolkien". */
const INITIAL_NAME_RE = /\b([A-ZÄÖÜ]\.) (?=[A-ZÄÖÜ][a-zäöüß])/g;

/**
 * Fügt geschützte Leerzeichen (NBSP) an Stellen ein, an denen ein Umbruch
 * typografisch unerwünscht ist:
 * - Titel/Abkürzungen: `Dr. Müller`, `Prof. Dr. Schmidt`, `z. B.`
 * - Paragraphenzeichen: `§ 5`
 * - Mengenangaben: `10 km`, `3,5 kg`, `50 %`
 * - Initialen: `J. R. R. Tolkien`, `A. Müller`
 *
 * Die Transformation ist idempotent: alle Muster verlangen ein normales
 * Leerzeichen, das nach der Ersetzung durch NBSP nicht erneut passt.
 */
export function insertNonBreakingSpaces(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  let result = text;

  // 1) Paragraphenzeichen: § + Zahl.
  result = result.replace(/(§+) ([0-9])/g, `$1${NBSP}$2`);

  // 2) Titel und Abkürzungen: „Dr." + Leerzeichen.
  result = result.replace(ABBREVIATION_RE, `$1${NBSP}`);

  // 3) Mengenangaben: Zahl + Leerzeichen + Einheit.
  result = result.replace(NUMBER_UNIT_RE, `$1${NBSP}$2`);

  // 4) Initialen: Leerzeichen innerhalb einer Initialenkette bzw. vor dem Namen.
  result = result.replace(INITIAL_CHAIN_RE, (match) => match.replace(/ +/g, NBSP));
  result = result.replace(INITIAL_NAME_RE, `$1${NBSP}`);

  return result;
}

// ---------------------------------------------------------------------------
// 4) Mehrfache Trennstriche
// ---------------------------------------------------------------------------

/**
 * Verhindert mehr als drei aufeinanderfolgende Trennstriche.
 *
 * Läufe von vier oder mehr Bindestrichen (`----`, `-----`, …) werden auf die
 * zulässige Höchstzahl von drei gekürzt. Läufe bis drei bleiben unverändert.
 * Die Transformation ist idempotent.
 */
export function preventConsecutiveHyphens(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";
  return text.replace(/-{4,}/g, "-".repeat(MAX_CONSECUTIVE_HYPHENS));
}
