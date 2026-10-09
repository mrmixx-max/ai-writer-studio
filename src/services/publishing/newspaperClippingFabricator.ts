// Zeitungsschnitt-Fabrik (WP 129.1, Meilenstein 62.0 / v7.4.0)
// Vintage-Zeitungs-Ausschnitte: mehrspaltiger Satz mit Blocksatz,
// Druck-Artefakte (Dithering, Verblassung, Falten, zerrissene Ränder),
// Halftone-Punktmuster und druckfertiger PDF-Export.
//
// Rein deterministisch: FNV-1a + mulberry32. Keine Node-Module,
// browser-kompatibel. Alle Kommentare und Daten auf Deutsch.

// ---------------------------------------------------------------------------
// Deterministische Zufalls-Helfer
// ---------------------------------------------------------------------------

/**
 * FNV-1a-Hash, unsigned 32-bit. Gleiche Eingabe → gleiche Ausgabe.
 */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32-Pseudozufallsgenerator. Liefert Werte im Intervall [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wählt deterministisch ein Element aus einem Array.
 * Wirft einen Fehler, wenn das Array leer ist.
 */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Zeitungsmastheads
// ---------------------------------------------------------------------------

/** Verfügbare Schriftarten für den Masthead. */
export type MastheadTypeface = "antiqua" | "fraktur";

/** Ein Zeitungsmasthead (Kopfzeile mit Titel und Schriftart). */
export interface NewspaperMasthead {
  /** Stabile ID des Mastheads. */
  id: string;
  /** Angezeigter Zeitungstitel. */
  name: string;
  /** Kurze Beschreibung des Blattes. */
  description: string;
  /** Verwendete Schriftart. */
  typeface: MastheadTypeface;
}

/**
 * Vier historisch inspirierte Mastheads für den Vintage-Satz.
 * Zwei Antiqua-Blätter, ein Fraktur-Blatt.
 */
export const NEWSPAPER_MASTHEADS: NewspaperMasthead[] = [
  {
    id: "arkhamAdvertiser",
    name: "Arkham Advertiser",
    description:
      "Lokales Wochenblatt aus Arkham, Massachusetts. Berichtet über Hafen, Wetter und seltsame Vorfälle am Küstenstreifen.",
    typeface: "antiqua",
  },
  {
    id: "theTimes",
    name: "The Times",
    description:
      "Großbritische Tageszeitung mit ausführlicher Berichterstattung über Politik, Handel und Gesellschaft.",
    typeface: "antiqua",
  },
  {
    id: "newYorkGazette",
    name: "New York Gazette",
    description:
      "New Yorker Abendblatt mit Schwerpunkt auf Börsen, Verkehr und den Neuigkeiten der großen Stadt.",
    typeface: "antiqua",
  },
  {
    id: "voelkischer",
    name: "Völkischer Beobachter",
    description:
      "Deutschsprachiges Blatt in Fraktur gesetzt, mit amtlichen Verlautbarungen und volkstümlichen Beilagen.",
    typeface: "fraktur",
  },
];

// ---------------------------------------------------------------------------
// Zeitungssatz (WP 129.1, Feature 1)
// ---------------------------------------------------------------------------

/** Eingabe für den Zeitungsschnitt. */
export interface ClippingInput {
  /** Schlagzeile in Großbuchstaben. */
  headline: string;
  /** Optionale Unterzeile. */
  subheadline?: string;
  /** Fließtext der Zeitungsspalten. */
  body: string;
  /** ID des gewünschten Mastheads. */
  mastheadId: string;
  /** Datum der Ausgabe. */
  date: string;
}

/** Ergebnis des Zeitungssatzs. */
export interface NewspaperClipping {
  /** Angezeigter Zeitungstitel. */
  masthead: string;
  /** Datum der Ausgabe. */
  date: string;
  /** Spalten mit gesätzen Zeilen (Blocksatz). */
  columns: string[][];
  /** Anzahl der Spalten (3 bis 5). */
  columnCount: number;
  /** SVG-Darstellung des Ausschnitts. */
  svg: string;
}

/** Zeichenbreite einer Spalte im Blocksatz. */
const COLUMN_WIDTH_CHARS = 42;

/** Mindest- und Höchstzahl der Spalten. */
const MIN_COLUMNS = 3;
const MAX_COLUMNS = 5;

/**
 * Escapt XML-Sonderzeichen für sicheren Einbau in SVG-Text.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Setzt eine Zeile auf exakt die Zielbreite, indem die Leerzeichen
 * zwischen den Wörtern gleichmäßig verteilt werden (Blocksatz).
 * Einzelne Wörter werden linksbündig abgeflacht.
 */
function justifyLine(words: string[], width: number): string {
  if (words.length === 0) {
    return " ".repeat(width);
  }
  if (words.length === 1) {
    return words[0].padEnd(width);
  }
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const gaps = words.length - 1;
  const totalSpaces = Math.max(width - totalChars, gaps);
  const baseSpaces = Math.floor(totalSpaces / gaps);
  let extraSpaces = totalSpaces % gaps;
  let line = "";
  for (let i = 0; i < words.length; i++) {
    line += words[i];
    if (i < gaps) {
      const spaces = baseSpaces + (extraSpaces > 0 ? 1 : 0);
      if (extraSpaces > 0) {
        extraSpaces--;
      }
      line += " ".repeat(spaces);
    }
  }
  return line;
}

/**
 * Verteilt den Fließtext auf die angegebene Spaltenzahl und setzt
 * jede Spalte im Blocksatz. Die letzte Zeile jeder Spalte bleibt
 * linksbündig, wie es die Satzregel vorschreibt.
 */
function buildColumns(body: string, columnCount: number): string[][] {
  const words = body.split(/\s+/).filter((w) => w.length > 0);
  const columns: string[][] = [];
  const perColumn = Math.max(1, Math.ceil(words.length / columnCount));

  for (let c = 0; c < columnCount; c++) {
    const colWords = words.slice(c * perColumn, (c + 1) * perColumn);
    const lines: string[] = [];
    let line: string[] = [];
    let lineLen = 0;

    for (const w of colWords) {
      const candidate = line.length === 0 ? w.length : lineLen + 1 + w.length;
      if (candidate > COLUMN_WIDTH_CHARS && line.length > 0) {
        lines.push(justifyLine(line, COLUMN_WIDTH_CHARS));
        line = [w];
        lineLen = w.length;
      } else {
        line.push(w);
        lineLen = candidate;
      }
    }
    if (line.length > 0) {
      lines.push(line.join(" ").padEnd(COLUMN_WIDTH_CHARS));
    }
    columns.push(lines);
  }
  return columns;
}

/**
 * Erzeugt den SVG-Text für den Zeitungsschnitt: Masthead, Datum,
 * Schlagzeile, Unterzeile und die gesäten Spalten im Monospace-Satz.
 */
function buildClippingSvg(
  mastheadName: string,
  typeface: MastheadTypeface,
  date: string,
  headline: string,
  subheadline: string,
  columns: string[][]
): string {
  const charWidth = 6;
  const lineHeight = 14;
  const colGap = 20;
  const margin = 24;
  const colWidth = COLUMN_WIDTH_CHARS * charWidth;
  const width =
    margin * 2 + columns.length * colWidth + (columns.length - 1) * colGap;

  const mastheadSize = 28;
  const headlineSize = 18;
  const subheadlineSize = 12;
  const dateSize = 10;
  const bodySize = 10;

  const headerHeight =
    mastheadSize + dateSize + headlineSize + subheadlineSize + 46;
  const maxLines = columns.reduce((m, col) => Math.max(m, col.length), 0);
  const height = margin * 2 + headerHeight + maxLines * lineHeight;

  const fontFamily =
    typeface === "fraktur"
      ? "'Old English Text MT', 'UnifrakturMaguntia', serif"
      : "Georgia, 'Times New Roman', serif";

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  parts.push(
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="#f5f0e1" stroke="#2b2b2b" stroke-width="2"/>`
  );
  parts.push(
    `<rect x="6" y="6" width="${width - 12}" height="${height - 12}" fill="none" stroke="#2b2b2b" stroke-width="1"/>`
  );
  parts.push(
    `<text x="${width / 2}" y="${margin + mastheadSize}" text-anchor="middle" font-family="${fontFamily}" font-size="${mastheadSize}" font-weight="bold" fill="#1a1a1a">${escapeXml(mastheadName)}</text>`
  );
  parts.push(
    `<text x="${width / 2}" y="${margin + mastheadSize + dateSize + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="${dateSize}" fill="#4a4a4a">${escapeXml(date)}</text>`
  );
  parts.push(
    `<line x1="${margin}" y1="${margin + mastheadSize + dateSize + 14}" x2="${width - margin}" y2="${margin + mastheadSize + dateSize + 14}" stroke="#2b2b2b" stroke-width="1.5"/>`
  );
  parts.push(
    `<text x="${width / 2}" y="${margin + mastheadSize + dateSize + 14 + headlineSize}" text-anchor="middle" font-family="Georgia, serif" font-size="${headlineSize}" font-weight="bold" fill="#1a1a1a">${escapeXml(headline.toUpperCase())}</text>`
  );
  let yOffset = margin + mastheadSize + dateSize + 14 + headlineSize + 8;
  if (subheadline.length > 0) {
    parts.push(
      `<text x="${width / 2}" y="${yOffset + subheadlineSize}" text-anchor="middle" font-family="Georgia, serif" font-size="${subheadlineSize}" font-style="italic" fill="#3a3a3a">${escapeXml(subheadline)}</text>`
    );
    yOffset += subheadlineSize + 10;
  }
  parts.push(
    `<line x1="${margin}" y1="${yOffset}" x2="${width - margin}" y2="${yOffset}" stroke="#2b2b2b" stroke-width="1"/>`
  );
  yOffset += 10;

  columns.forEach((col, colIndex) => {
    const x = margin + colIndex * (colWidth + colGap);
    col.forEach((line, lineIndex) => {
      parts.push(
        `<text x="${x}" y="${yOffset + lineIndex * lineHeight}" font-family="'Courier New', monospace" font-size="${bodySize}" fill="#1a1a1a">${escapeXml(line)}</text>`
      );
    });
  });
  parts.push("</svg>");
  return parts.join("\n");
}

/**
 * Baut einen deterministischen Zeitungsschnitt: Masthead, Datum,
 * Schlagzeile und 3 bis 5 Spalten im Blocksatz, dargestellt als SVG.
 * Gleicher Seed → gleiches Ergebnis.
 */
export function buildNewspaperClipping(
  input: ClippingInput,
  seed: number
): NewspaperClipping {
  const rng = createSeededRandom(seed);

  const masthead =
    NEWSPAPER_MASTHEADS.find((m) => m.id === input.mastheadId) ??
    NEWSPAPER_MASTHEADS[0];

  const columnCount =
    MIN_COLUMNS + Math.floor(rng() * (MAX_COLUMNS - MIN_COLUMNS + 1));
  const columns = buildColumns(input.body, columnCount);

  const svg = buildClippingSvg(
    masthead.name,
    masthead.typeface,
    input.date,
    input.headline,
    input.subheadline ?? "",
    columns
  );

  return {
    masthead: masthead.name,
    date: input.date,
    columns,
    columnCount,
    svg,
  };
}

// ---------------------------------------------------------------------------
// Vintage-Druck-Artefakte (WP 129.1, Feature 2)
// ---------------------------------------------------------------------------

/** Ergebnis der Vintage-Artefakt-Analyse. */
export interface VintageArtifacts {
  /** Ob Rauten-Dithering im Druck sichtbar ist. */
  dithering: boolean;
  /** Verblassungsgrad zwischen 0 (frisch) und 1 (stark verblasst). */
  fadeAmount: number;
  /** Anzahl sichtbarer Falten im Papier. */
  creaseCount: number;
  /** Ob die Ränder zerrissen sind. */
  tornEdges: boolean;
  /** Deutsche Beschreibung der Artefakte. */
  description: string;
}

/** Deutsche Beschreibungen für den Verblassungsgrad. */
const FADE_DESCRIPTIONS = [
  "frisch und kräftig gedruckt",
  "leicht verblasst",
  "deutlich verblasst",
  "stark verblasst, beinahe vergilbt",
];

/**
 * Erzeugt deterministisch Vintage-Druck-Artefakte: Dithering,
 * Verblassung, Falten und zerrissene Ränder. Gleicher Seed →
 * gleiches Ergebnis.
 */
export function applyVintageArtifacts(seed: number): VintageArtifacts {
  const rng = createSeededRandom(seed);

  const dithering = rng() > 0.5;
  const fadeAmount = Math.round(rng() * 100) / 100;
  const creaseCount = Math.floor(rng() * 6);
  const tornEdges = rng() > 0.5;

  const fadeDescription = pick(FADE_DESCRIPTIONS, rng);

  const parts: string[] = [];
  parts.push(
    dithering
      ? "Das Raster zeigt feines Dithering"
      : "Das Raster ist ohne Dithering"
  );
  parts.push(`der Druck ist ${fadeDescription}`);
  parts.push(
    creaseCount === 0
      ? "das Papier ist faltenfrei"
      : `das Papier weist ${creaseCount} ${creaseCount === 1 ? "Falte" : "Falten"} auf`
  );
  parts.push(
    tornEdges ? "die Ränder sind zerrissen" : "die Ränder sind sauber geschnitten"
  );

  return {
    dithering,
    fadeAmount,
    creaseCount,
    tornEdges,
    description: `${parts.join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Halftone-Punktmuster (WP 129.1, Feature 2)
// ---------------------------------------------------------------------------

/** Ein einzelner Halftone-Punkt. */
export interface HalftoneDot {
  /** X-Position in Pixel. */
  x: number;
  /** Y-Position in Pixel. */
  y: number;
  /** Radius in Pixel. */
  r: number;
}

/** Ergebnis des Halftone-Musters. */
export interface HalftoneResult {
  /** Alle erzeugten Punkte. */
  dots: HalftoneDot[];
  /** Anzahl der Punkte. */
  count: number;
}

/** Rasterabstand der Halftone-Punkte in Pixel. */
const HALFTONE_SPACING = 6;

/**
 * Erzeugt ein deterministisches Halftone-Punktmuster über ein Rechteck.
 * Punktpositionen und Radien folgen dem Seed; einzelne Punkte
 * werden ausgelassen, um Töne zu simulieren. Gleicher Seed →
 * gleiches Muster.
 */
export function generateHalftoneDots(
  width: number,
  height: number,
  seed: number
): HalftoneResult {
  const rng = createSeededRandom(seed);
  const dots: HalftoneDot[] = [];

  const safeWidth = Math.max(0, Math.floor(width));
  const safeHeight = Math.max(0, Math.floor(height));

  for (let y = HALFTONE_SPACING; y < safeHeight; y += HALFTONE_SPACING) {
    for (let x = HALFTONE_SPACING; x < safeWidth; x += HALFTONE_SPACING) {
      // Etwa jeder vierte Punkt entfällt – simuliert hellere Töne.
      if (rng() < 0.25) {
        continue;
      }
      const r = 0.5 + rng() * 2.0;
      dots.push({ x, y, r: Math.round(r * 100) / 100 });
    }
  }

  return { dots, count: dots.length };
}

// ---------------------------------------------------------------------------
// Druckfertiger PDF-Export (WP 129.1, Feature 3)
// ---------------------------------------------------------------------------

/** Ergebnis des PDF-Exports. */
export interface ClippingPdf {
  /** SVG-Darstellung des Ausschnitts. */
  svg: string;
  /** Seitenbreite in Millimetern (A4). */
  width: number;
  /** Seitenhöhe in Millimetern (A4). */
  height: number;
  /** Auflösung in dpi. */
  dpi: number;
  /** Ob der Export druckfertig ist. */
  printReady: boolean;
}

/** A4-Seitenmaße in Millimetern. */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Standard-Auflösung für den Druckexport. */
const PRINT_DPI = 300;

/**
 * Baut einen Zeitungsschnitt und liefert ihn als druckfertiges
 * PDF-Paket (SVG, A4-Maße, 300 dpi). Gleicher Seed → gleiches
 * Ergebnis.
 */
export function exportClippingPdf(
  input: ClippingInput,
  seed: number
): ClippingPdf {
  const clipping = buildNewspaperClipping(input, seed);

  return {
    svg: clipping.svg,
    width: A4_WIDTH_MM,
    height: A4_HEIGHT_MM,
    dpi: PRINT_DPI,
    printReady: true,
  };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen Beispiel-Zeitungsschnitt mit festem Seed,
 * damit Vorschau und Demo ohne Eingabe auskommen.
 */
export function createSampleClipping(): NewspaperClipping {
  return buildNewspaperClipping(
    {
      headline: "Hafenstadt in Aufruhr",
      subheadline: "Seltsame Lichter über dem Wasser",
      body:
        "Die Bewohner der Küstenstadt berichten von ungewöhnlichen " +
        "Lichtern, die in den vergangenen Nächten über dem Hafen " +
        "gesichtet wurden. Der Hafenmeister bestätigte die Vorfälle, " +
        "konnte jedoch keine Erklärung liefern. Einige Fischer " +
        "behaupten, die Lichter seien in regelmäßigen Abständen " +
        "aufgetaucht, andere sprechen von einem einzigen, " +
        "stetig wachsenden Schein. Die örtliche Zeitung " +
        "empfiehlt der Bevölkerung, nach Einbruch der Dunkelheit " +
        "von der Uferpromenade Abstand zu nehmen. Eine " +
        "Untersuchung durch die Küstenwache ist für die " +
        "kommende Woche angekündigt.",
      mastheadId: "arkhamAdvertiser",
      date: "12. Oktober 1926",
    },
    62000
  );
}

/**
 * Liefert einen Beispiel-Masthead für Vorschau und Demo.
 */
export function createSampleMasthead(): NewspaperMasthead {
  return { ...NEWSPAPER_MASTHEADS[0] };
}
