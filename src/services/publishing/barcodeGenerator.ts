// Vektor-ISBN- & Barcode-Generator-Service (WP 53.1): EAN-13-Validierung,
// EAN-13-Barcode-SVG (Bookland/ISBN) und QR-Code-SVG.
//
// Rein deterministisch, reine Mathematik, keine LLM-/Netz-Abhängigkeit,
// keine externen Bibliotheken. Defensive Fallbacks: ungültige Eingaben
// werden auf sichere Defaults abgebildet, statt zu werfen.
//
// Druck-Anforderung: der Barcode ist 100 % K-Only (reines Schwarz #000000),
// keine Farbmischung, keine Graustufen — so bleibt er beim Druckverfahren
// (Offset/Digital) maschinell zuverlässig lesbar.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

export interface BarcodeOptions {
  /** Balkenhöhe in SVG-Einheiten. Default: 60. Wird auf [10, 200] geklemmt. */
  height?: number;
  /** Preiszeile unter dem Barcode anzeigen. Default: false. */
  showPrice?: boolean;
  /** Preis-Text (z. B. "9,99 EUR"). Wird defensiv bereinigt. */
  price?: string;
}

export interface QrOptions {
  /** Kantenlänge des SVG in SVG-Einheiten. Default: 25 Module × 8 = 200. */
  size?: number;
  /** Fehlerkorrektur-Level. Default: "M". */
  errorCorrection?: "L" | "M" | "Q" | "H";
}

// ---------------------------------------------------------------------------
// EAN-13 — Prüfziffer & Validierung
// ---------------------------------------------------------------------------

/**
 * Berechnet die EAN-13-Prüfziffer (Modulo 10, Gewichtung 1,3,1,3,…).
 * `digits12` muss genau 12 Ziffern enthalten.
 * Rückgabe: eine Ziffer 0–9, oder -1 bei ungültiger Eingabe.
 */
function ean13CheckDigit(digits12: string): number {
  if (typeof digits12 !== "string" || digits12.length !== 12) return -1;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits12.charCodeAt(i) - 48; // "0" === 48
    if (d < 0 || d > 9) return -1;
    // Position 1 (i=0) hat Gewicht 1, Position 2 (i=1) Gewicht 3, usw.
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validiert eine EAN-13 (bzw. ISBN-13) vollständig: genau 13 Ziffern und
 * korrekte Modulo-10-Prüfziffer mit Gewichtung 1,3,1,3,…
 * Leerzeichen/Bindestriche werden toleriert und entfernt.
 */
export function validateEan13(ean: string): boolean {
  if (typeof ean !== "string") return false;
  const clean = ean.replace(/[\s-]/g, "");
  if (clean.length !== 13) return false;
  for (let i = 0; i < 13; i++) {
    const c = clean.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const expected = ean13CheckDigit(clean.slice(0, 12));
  return expected === clean.charCodeAt(12) - 48;
}

// ---------------------------------------------------------------------------
// EAN-13 — Kodierungstabellen (L/G/R nach ISO/IEC 15420)
// ---------------------------------------------------------------------------
//
// Jede 7-Bit-Folge wird als String aus "0"/"1" dargestellt.
//   L-Code (links, gerade Parität), G-Code (links, ungerade Parität),
//   R-Code (rechts; = bitweise Komplement des L-Codes).

const EAN_L = [
  "0001101", // 0
  "0011001", // 1
  "0010011", // 2
  "0111101", // 3
  "0100011", // 4
  "0110001", // 5
  "0101111", // 6
  "0111011", // 7
  "0110111", // 8
  "0001011", // 9
];

const EAN_G = [
  "0100111", // 0
  "0110011", // 1
  "0011011", // 2
  "0100001", // 3
  "0011101", // 4
  "0111001", // 5
  "0000101", // 6
  "0010001", // 7
  "0001001", // 8
  "0010111", // 9
];

const EAN_R = [
  "1110010", // 0
  "1100110", // 1
  "1101100", // 2
  "1000010", // 3
  "1011100", // 4
  "1001110", // 5
  "1010000", // 6
  "1000100", // 7
  "1001000", // 8
  "1110100", // 9
];

// Paritätsmuster der ersten Ziffer (Ziffer 0 bestimmt L/G-Mix der Positionen 2–7).
// "L" = L-Code, "G" = G-Code.
const EAN_FIRST_DIGIT_PARITY = [
  "LLLLLL", // 0
  "LLGLGG", // 1
  "LLGGLG", // 2
  "LLGGGL", // 3
  "LGLLGG", // 4
  "LGGLLG", // 5
  "LGGGLL", // 6
  "LGLGLG", // 7
  "LGLGGL", // 8
  "LGGLGL", // 9
];

const EAN_GUARD = "101"; // Normal-Guard (Start, Mitte, Ende)
const EAN_MODULES = 95; // Gesamtmodulzahl einer EAN-13

/**
 * Erzeugt die 95-Bit-Modulfolge einer gültigen EAN-13.
 * Rückgabe: String aus "0"/"1" (Länge 95), oder "" bei ungültiger EAN.
 */
function ean13Modules(ean: string): string {
  if (!validateEan13(ean)) return "";
  const clean = ean.replace(/[\s-]/g, "");
  const digits = clean.split("").map((c) => c.charCodeAt(0) - 48);

  const parity = EAN_FIRST_DIGIT_PARITY[digits[0]];
  let bits = EAN_GUARD; // Start-Guard 101

  // Positionen 2–7 (Index 1–6): Paritätsmuster wählt L- oder G-Code.
  for (let i = 1; i <= 6; i++) {
    bits += parity[i - 1] === "L" ? EAN_L[digits[i]] : EAN_G[digits[i]];
  }

  bits += "01010"; // Center-Guard

  // Positionen 8–13 (Index 7–12): immer R-Code.
  for (let i = 7; i <= 12; i++) {
    bits += EAN_R[digits[i]];
  }

  bits += EAN_GUARD; // End-Guard 101
  return bits; // Länge 95
}

// ---------------------------------------------------------------------------
// SVG-Helfer
// ---------------------------------------------------------------------------

/** Wandelt eine Zahl in einen kompakten SVG-Koordinaten-String. */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

/**
 * XML-Text-Escaping für in SVG eingebettete Nutzer-Texte.
 * Verhindert, dass ein Preis-String das SVG-Markup bricht.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Entfernt Steuerzeichen (0x00–0x1F, 0x7F), die XML invalid machen würden. */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

// ---------------------------------------------------------------------------
// EAN-13 — Vektor-SVG
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein 100 % K-Only Vektor-SVG eines EAN-13-Barcodes (Bookland/ISBN).
 *
 * - Reines Schwarz (`#000000`), keine Farbmischung, kein Graustufen.
 * - `shape-rendering="crispEdges"` für scharfe Kanten ohne Anti-Aliasing-Farbe.
 * - Deterministisch: gleiche EAN ⇒ byte-identisches SVG.
 * - Defensiver Fallback: bei ungültiger EAN wird ein SVG mit Fehlerhinweis
 *   statt eines geworfenen Fehlers zurückgegeben.
 */
export function generateBarcodeSvg(ean: string, options: BarcodeOptions = {}): string {
  const opts = options && typeof options === "object" ? options : {};

  // Höhe defensiv klemmen.
  const rawHeight = Number(opts.height);
  const height = Number.isFinite(rawHeight)
    ? Math.min(200, Math.max(10, Math.round(rawHeight)))
    : 60;

  if (!validateEan13(ean)) {
    return renderInvalidBarcode(height);
  }

  const clean = ean.replace(/[\s-]/g, "");
  const bits = ean13Modules(clean); // Länge 95, bereits validiert

  const moduleWidth = 2; // Modulbreite in SVG-Einheiten (Breite: 95 × 2 = 190)
  const leftMargin = 10;
  const quietZone = 10;
  const width = leftMargin * 2 + EAN_MODULES * moduleWidth; // 210

  const bars: string[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let run = 0;
      while (i + run < bits.length && bits[i + run] === "1") run++;
      const x = leftMargin + i * moduleWidth;
      const w = run * moduleWidth;
      bars.push(`<rect x="${num(x)}" y="0" width="${num(w)}" height="${num(height)}"/>`);
      i += run;
    } else {
      i++;
    }
  }

  const showPrice = opts.showPrice === true;
  const priceText =
    typeof opts.price === "string"
      ? stripControlChars(opts.price).trim().slice(0, 40)
      : "";
  const hasPrice = showPrice && priceText.length > 0;

  const totalHeight = height + quietZone + 22 + (hasPrice ? 16 : 0);
  const baselineY = height + quietZone + 14;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" ` +
      `width="${width}" height="${totalHeight}" role="img" ` +
      `aria-label="${escapeXml(`EAN-13 Barcode ${clean}`)}">`,
  );
  parts.push(
    `<title>EAN-13 ${escapeXml(clean)}</title>`,
  );
  // Weißer Grund nur für Anzeige/Druck; alle Markierungen sind reines Schwarz.
  parts.push(`<rect x="0" y="0" width="${width}" height="${totalHeight}" fill="#FFFFFF"/>`);
  parts.push(
    `<g fill="#000000" shape-rendering="crispEdges">${bars.join("")}</g>`,
  );
  // Menschenlesbare Ziffernfolge (ebenfalls K-Only).
  parts.push(
    `<text x="${num(width / 2)}" y="${num(baselineY)}" fill="#000000" ` +
      `font-family="monospace" font-size="12" text-anchor="middle" ` +
      `letter-spacing="1">${escapeXml(clean)}</text>`,
  );
  if (hasPrice) {
    parts.push(
      `<text x="${num(width / 2)}" y="${num(baselineY + 16)}" fill="#000000" ` +
        `font-family="monospace" font-size="12" text-anchor="middle">` +
        `${escapeXml(priceText)}</text>`,
    );
  }
  parts.push(`</svg>`);

  return parts.join("");
}

/** Fehler-SVG: kein Wurf, sondern ein klar erkennbares Platzhalter-SVG. */
function renderInvalidBarcode(height: number): string {
  const width = 210;
  const totalHeight = height + 32;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" ` +
    `width="${width}" height="${totalHeight}" role="img" aria-label="Ungültige EAN-13">` +
    `<rect x="0" y="0" width="${width}" height="${totalHeight}" fill="#FFFFFF"/>` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="none" ` +
    `stroke="#000000" stroke-width="2" stroke-dasharray="4 4"/>` +
    `<text x="${width / 2}" y="${height + 20}" fill="#000000" ` +
    `font-family="monospace" font-size="12" text-anchor="middle">` +
    `Ung&uuml;ltige EAN-13</text>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// QR-Code — Byte-Modus, Versionen 1–10, ECC L/M/Q/H
// ---------------------------------------------------------------------------
//
// Eigene, deterministische Implementierung nach ISO/IEC 18004.
// Daten- und Fehlerkorrektur-Codewörter, Reed-Solomon über GF(256),
// Blockaufteilung, Modulplatzierung, 8 Masken mit Penalty-Auswahl.

type EccLevel = "L" | "M" | "Q" | "H";

interface EccInfo {
  /** Fehlerkorrektur-Codewörter pro Block. */
  ecPerBlock: number;
  /** Blockaufteilung: [Anzahl Blöcke Gruppe 1, Daten-CW Gruppe 1, Anzahl Gruppe 2, Daten-CW Gruppe 2]. */
  blocks: [number, number, number, number];
}

// Tabellen je Version (Index 0 = Version 1) für L, M, Q, H.
const ECC_TABLE: Record<EccLevel, EccInfo[]> = {
  L: [
    { ecPerBlock: 7, blocks: [1, 19, 0, 0] },
    { ecPerBlock: 10, blocks: [1, 34, 0, 0] },
    { ecPerBlock: 15, blocks: [1, 55, 0, 0] },
    { ecPerBlock: 20, blocks: [1, 80, 0, 0] },
    { ecPerBlock: 26, blocks: [1, 108, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 68, 0, 0] },
    { ecPerBlock: 20, blocks: [2, 78, 0, 0] },
    { ecPerBlock: 24, blocks: [2, 97, 0, 0] },
    { ecPerBlock: 30, blocks: [2, 116, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 68, 2, 69] },
  ],
  M: [
    { ecPerBlock: 10, blocks: [1, 16, 0, 0] },
    { ecPerBlock: 16, blocks: [1, 28, 0, 0] },
    { ecPerBlock: 26, blocks: [1, 44, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 32, 0, 0] },
    { ecPerBlock: 24, blocks: [2, 43, 0, 0] },
    { ecPerBlock: 16, blocks: [4, 27, 0, 0] },
    { ecPerBlock: 18, blocks: [4, 31, 0, 0] },
    { ecPerBlock: 22, blocks: [2, 38, 2, 39] },
    { ecPerBlock: 22, blocks: [3, 36, 2, 37] },
    { ecPerBlock: 26, blocks: [4, 43, 1, 44] },
  ],
  Q: [
    { ecPerBlock: 13, blocks: [1, 13, 0, 0] },
    { ecPerBlock: 22, blocks: [1, 22, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 17, 0, 0] },
    { ecPerBlock: 26, blocks: [2, 24, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 15, 2, 16] },
    { ecPerBlock: 24, blocks: [4, 19, 0, 0] },
    { ecPerBlock: 18, blocks: [2, 14, 4, 15] },
    { ecPerBlock: 22, blocks: [4, 18, 2, 19] },
    { ecPerBlock: 20, blocks: [4, 16, 4, 17] },
    { ecPerBlock: 24, blocks: [6, 19, 2, 20] },
  ],
  H: [
    { ecPerBlock: 17, blocks: [1, 9, 0, 0] },
    { ecPerBlock: 28, blocks: [1, 16, 0, 0] },
    { ecPerBlock: 22, blocks: [2, 13, 0, 0] },
    { ecPerBlock: 16, blocks: [4, 9, 0, 0] },
    { ecPerBlock: 22, blocks: [2, 11, 2, 12] },
    { ecPerBlock: 28, blocks: [4, 15, 0, 0] },
    { ecPerBlock: 26, blocks: [4, 13, 1, 14] },
    { ecPerBlock: 26, blocks: [4, 14, 2, 15] },
    { ecPerBlock: 24, blocks: [4, 12, 4, 13] },
    { ecPerBlock: 28, blocks: [6, 15, 2, 16] },
  ],
};

/** Ausrichtungsmuster-Zentren je Version. */
const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// --- Galois-Feld GF(256), primitives Polynom 0x11D -------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Reed-Solomon-Generatorpolynom vom Grad `degree`. */
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1); // × α^0
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]); // × α^i
    }
    poly = next;
  }
  return poly;
}

/** Berechnet die Reed-Solomon-Fehlerkorrektur-Codewörter eines Blocks. */
function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Array<number>(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < ecCount; i++) {
      result[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return result;
}

// --- Bitstrom ---------------------------------------------------------------

class BitBuffer {
  private bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  get length(): number {
    return this.bits.length;
  }
  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] ?? 0);
      bytes.push(b);
    }
    return bytes;
  }
}

// --- Datenkodierung (Byte-Modus) -------------------------------------------

/** UTF-8-Bytes eines Strings (ohne Node-Abhängigkeit). */
function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // Surrogatpaare zu einer Codepoint kombinieren.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

/** Anzahl Daten-Codewörter für Version + ECC-Level. */
function dataCodewordCount(version: number, level: EccLevel): number {
  const [b1, d1, b2, d2] = ECC_TABLE[level][version - 1].blocks;
  return b1 * d1 + b2 * d2;
}

/** Wählt die kleinste Version, in die `byteLen` Bytes im Byte-Modus passen. */
function chooseVersion(byteLen: number, level: EccLevel): number {
  for (let version = 1; version <= 10; version++) {
    const capacityBits = dataCodewordCount(version, level) * 8;
    const lengthBits = version <= 9 ? 8 : 16;
    const needed = 4 + lengthBits + byteLen * 8;
    if (needed <= capacityBits) return version;
  }
  return 0; // passt nicht in Version 1–10
}

/** Baut die vollständige Codewort-Folge (Daten + ECC, verschachtelt). */
function buildCodewords(version: number, level: EccLevel, bytes: number[]): number[] {
  const info = ECC_TABLE[level][version - 1];
  const [b1, d1, b2, d2] = info.blocks;
  const totalData = b1 * d1 + b2 * d2;

  // 1) Bitstrom: Modus + Länge + Daten.
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // Byte-Modus
  buffer.put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) buffer.put(b, 8);

  // 2) Terminator (max. 4 Nullbits), Byte-Ausrichtung.
  const capacityBits = totalData * 8;
  const terminator = Math.min(4, capacityBits - buffer.length);
  if (terminator > 0) buffer.put(0, terminator);
  while (buffer.length % 8 !== 0) buffer.put(0, 1);

  // 3) Daten-Codewörter + Pad-Bytes (0xEC, 0x11 abwechselnd).
  const dataBytes = buffer.toBytes();
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(pads[padIndex % 2]);
    padIndex++;
  }

  // 4) In Blöcke aufteilen, je Block ECC berechnen.
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < b1; b++) {
    const block = dataBytes.slice(offset, offset + d1);
    offset += d1;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, info.ecPerBlock));
  }
  for (let b = 0; b < b2; b++) {
    const block = dataBytes.slice(offset, offset + d2);
    offset += d2;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, info.ecPerBlock));
  }

  // 5) Interleaving: Daten spaltenweise, dann ECC spaltenweise.
  const result: number[] = [];
  const maxDataLen = Math.max(d1, d2, 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }
  return result;
}

// --- Modulmatrix ------------------------------------------------------------

function createMatrix(size: number): { modules: boolean[][]; reserved: boolean[][] } {
  const modules: boolean[][] = [];
  const reserved: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    modules.push(new Array<boolean>(size).fill(false));
    reserved.push(new Array<boolean>(size).fill(false));
  }
  return { modules, reserved };
}

/** Setzt ein Modul und markiert es als belegt (nicht daten-modulierbar). */
function setFunction(
  m: { modules: boolean[][]; reserved: boolean[][] },
  row: number,
  col: number,
  dark: boolean,
): void {
  if (row < 0 || col < 0 || row >= m.modules.length || col >= m.modules.length) return;
  m.modules[row][col] = dark;
  m.reserved[row][col] = true;
}

/** Finder-Muster (7×7) inkl. Trennstreifen, an Ecke (row, col) der oberen linken Ecke. */
function placeFinder(
  m: { modules: boolean[][]; reserved: boolean[][] },
  row: number,
  col: number,
): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= m.modules.length || cc >= m.modules.length) continue;
      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const isBorder = inFinder && (r === 0 || r === 6 || c === 0 || c === 6);
      const isCore = inFinder && r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setFunction(m, rr, cc, isBorder || isCore);
    }
  }
}

/** Ausrichtungsmuster (5×5) mit Mittelpunkt (row, col). */
function placeAlignment(
  m: { modules: boolean[][]; reserved: boolean[][] },
  row: number,
  col: number,
): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCore = r === 0 && c === 0;
      setFunction(m, row + r, col + c, isBorder || isCore);
    }
  }
}

/** Timing-Muster (Zeile/Spalte 6). */
function placeTiming(m: { modules: boolean[][]; reserved: boolean[][] }, size: number): void {
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunction(m, 6, i, dark);
    setFunction(m, i, 6, dark);
  }
}

/** BCH-Kodierung (18,6) der Versionsinformation mit Generator 0x1F25. */
function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

/**
 * Setzt die Versionsinformation (18 Bit) ab Version 7 in die beiden 3×6-Blöcke
 * (unten links und oben rechts). Bit 0 = LSB.
 */
function placeVersionInfo(
  m: { modules: boolean[][]; reserved: boolean[][] },
  version: number,
  size: number,
): void {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = i % 3;
    // Block 1: unten links (Zeilen size-11..size-9, Spalten 0..5).
    setFunction(m, size - 11 + b, a, bit);
    // Block 2: oben rechts (Zeilen 0..5, Spalten size-11..size-9).
    setFunction(m, a, size - 11 + b, bit);
  }
}

/** Baut die Funktionsmuster-Matrix (ohne Format-/Versionsinfo). */
function buildBaseMatrix(version: number): {
  modules: boolean[][];
  reserved: boolean[][];
  size: number;
} {
  const size = version * 4 + 17;
  const m = createMatrix(size);

  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);

  // Ausrichtungsmuster (Überschneidungen mit Findern überspringen).
  const positions = ALIGNMENT_POSITIONS[version - 1];
  for (const row of positions) {
    for (const col of positions) {
      const nearTop = row <= 7;
      const nearBottom = row >= size - 8;
      const nearLeft = col <= 7;
      const nearRight = col >= size - 8;
      if ((nearTop && nearLeft) || (nearTop && nearRight) || (nearBottom && nearLeft)) {
        continue;
      }
      placeAlignment(m, row, col);
    }
  }

  placeTiming(m, size);

  // Versionsinformation (ab Version 7, 18 Bit) — zwei 3×6-Blöcke.
  placeVersionInfo(m, version, size);

  // Dark-Modul (immer gesetzt).
  setFunction(m, size - 8, 8, true);

  // Format-Informationsbereiche reservieren (Werte später gesetzt).
  for (let i = 0; i <= 8; i++) {
    if (!m.reserved[8][i]) setFunction(m, 8, i, false);
    if (!m.reserved[i][8]) setFunction(m, i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!m.reserved[8][size - 1 - i]) setFunction(m, 8, size - 1 - i, false);
    if (!m.reserved[size - 1 - i][8]) setFunction(m, size - 1 - i, 8, false);
  }

  return { modules: m.modules, reserved: m.reserved, size };
}

/** Platziert die Datenbits im Zickzack-Muster (rechts nach links, 2 Spalten). */
function placeData(
  m: { modules: boolean[][]; reserved: boolean[][] },
  size: number,
  codewords: number[],
): void {
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Timing-Spalte überspringen
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (m.reserved[row][c]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >> 3];
          dark = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        }
        m.modules[row][c] = dark;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

/** BCH-Kodierung des 5-Bit-Formatinfos mit Generator 0x537. */
function formatBits(data5: number): number {
  let value = data5 << 10;
  for (let i = 14; i >= 10; i--) {
    if ((value >> i) & 1) value ^= 0x537 << (i - 10);
  }
  return ((data5 << 10) | value) ^ 0x5412;
}

const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/** Setzt die Format-Information (15 Bit) in die reservierten Bereiche. */
function placeFormatInfo(
  m: { modules: boolean[][]; reserved: boolean[][] },
  size: number,
  level: EccLevel,
  mask: number,
): void {
  const data5 = (ECC_FORMAT_BITS[level] << 3) | mask;
  const bits = formatBits(data5);

  // Bit i (LSB = Bit 0) → ISO/IEC 18004-Positionen (Zeile, Spalte).
  const getBit = (i: number): boolean => ((bits >> i) & 1) === 1;

  // Kopie 1 (rund um den oberen linken Finder).
  for (let i = 0; i <= 5; i++) m.modules[i][8] = getBit(i);
  m.modules[7][8] = getBit(6);
  m.modules[8][8] = getBit(7);
  m.modules[8][7] = getBit(8);
  for (let i = 9; i <= 14; i++) m.modules[8][14 - i] = getBit(i);

  // Kopie 2 (oben rechts: Bit 0–7; unten links: Bit 8–14).
  for (let i = 0; i <= 7; i++) m.modules[8][size - 1 - i] = getBit(i);
  for (let i = 8; i <= 14; i++) m.modules[size - 15 + i][8] = getBit(i);
}

/** Wendet eine der 8 Masken auf alle Datenmodule an. */
function applyMask(
  m: { modules: boolean[][]; reserved: boolean[][] },
  size: number,
  mask: number,
): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (m.reserved[r][c]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      }
      if (invert) m.modules[r][c] = !m.modules[r][c];
    }
  }
}

// --- Maskenbewertung (ISO/IEC 18004, Penalty-Regeln 1–4) -------------------
//
// Portierung der Referenzlogik (Run-History-basierte Finder-Muster-Erkennung),
// damit die Maskenwahl exakt dem Standard entspricht (kein Doppelzählen bei
// überlappenden Mustern).

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

function scoreMatrix(matrix: boolean[][]): number {
  const size = matrix.length;
  let result = 0;

  const addHistory = (runLength: number, runHistory: number[]): void => {
    let len = runLength;
    if (runHistory[0] === 0) len += size; // Helles Randmodul am Anfang.
    for (let i = runHistory.length - 1; i > 0; i--) runHistory[i] = runHistory[i - 1];
    runHistory[0] = len;
  };

  const countPatterns = (runHistory: number[]): number => {
    const n = runHistory[1];
    const core =
      n > 0 &&
      runHistory[2] === n &&
      runHistory[3] === n * 3 &&
      runHistory[4] === n &&
      runHistory[5] === n;
    return (
      (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
      (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
    );
  };

  const terminateAndCount = (
    currentRunColor: boolean,
    currentRunLength: number,
    runHistory: number[],
  ): number => {
    let len = currentRunLength;
    if (currentRunColor) {
      addHistory(len, runHistory);
      len = 0;
    }
    len += size; // Helles Randmodul am Ende.
    addHistory(len, runHistory);
    return countPatterns(runHistory);
  };

  // Regel 1 & 3: Reihen.
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runX = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (matrix[y][x] === runColor) {
        runX++;
        if (runX === 5) result += PENALTY_N1;
        else if (runX > 5) result++;
      } else {
        addHistory(runX, runHistory);
        if (!runColor) result += countPatterns(runHistory) * PENALTY_N3;
        runColor = matrix[y][x];
        runX = 1;
      }
    }
    result += terminateAndCount(runColor, runX, runHistory) * PENALTY_N3;
  }

  // Regel 1 & 3: Spalten.
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runY = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (matrix[y][x] === runColor) {
        runY++;
        if (runY === 5) result += PENALTY_N1;
        else if (runY > 5) result++;
      } else {
        addHistory(runY, runHistory);
        if (!runColor) result += countPatterns(runHistory) * PENALTY_N3;
        runColor = matrix[y][x];
        runY = 1;
      }
    }
    result += terminateAndCount(runColor, runY, runHistory) * PENALTY_N3;
  }

  // Regel 2: 2×2-Blöcke gleicher Farbe.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = matrix[y][x];
      if (c === matrix[y][x + 1] && c === matrix[y + 1][x] && c === matrix[y + 1][x + 1]) {
        result += PENALTY_N2;
      }
    }
  }

  // Regel 4: Abweichung des Dunkelanteils von 50 %.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (matrix[y][x]) dark++;
  }
  const total = size * size;
  const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
  result += k * PENALTY_N4;

  return result;
}

// --- Öffentliche QR-API -----------------------------------------------------

/**
 * Erzeugt ein deterministisches Vektor-SVG eines QR-Codes (Byte-Modus, UTF-8).
 *
 * - Reine Mathematik (ISO/IEC 18004), keine externe Bibliothek.
 * - Deterministisch: gleiche Daten + Optionen ⇒ byte-identisches SVG.
 * - Reines Schwarz (#000000) für Druck/K-Only.
 * - Defensiver Fallback: nicht kodierbare Daten (zu lang für Version 1–10)
 *   ergeben ein Platzhalter-SVG statt eines geworfenen Fehlers.
 */
export function generateQrSvg(data: string, options: QrOptions = {}): string {
  const opts = options && typeof options === "object" ? options : {};
  const level: EccLevel =
    opts.errorCorrection === "L" ||
    opts.errorCorrection === "M" ||
    opts.errorCorrection === "Q" ||
    opts.errorCorrection === "H"
      ? opts.errorCorrection
      : "M";

  const text = typeof data === "string" ? data : String(data ?? "");

  const matrix = encodeQrMatrix(text, level);
  if (matrix === null) {
    return renderInvalidQr(text);
  }

  const moduleCount = matrix.length;
  const defaultSize = moduleCount * 8;
  const rawSize = Number(opts.size);
  const size = Number.isFinite(rawSize)
    ? Math.min(4096, Math.max(moduleCount, Math.round(rawSize)))
    : defaultSize;
  const scale = size / moduleCount;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
      `width="${size}" height="${size}" role="img" aria-label="QR-Code">`,
  );
  parts.push(`<title>QR-Code</title>`);
  parts.push(`<rect x="0" y="0" width="${size}" height="${size}" fill="#FFFFFF"/>`);
  const paths: string[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (!matrix[r][c]) continue;
      const x = num(c * scale);
      const y = num(r * scale);
      const w = num(scale);
      paths.push(`M${x} ${y}h${w}v${w}h-${w}z`);
    }
  }
  parts.push(`<path d="${paths.join("")}" fill="#000000" shape-rendering="crispEdges"/>`);
  parts.push(`</svg>`);
  return parts.join("");
}

/** Fehler-SVG für nicht kodierbare QR-Daten. */
function renderInvalidQr(data: string): string {
  const size = 200;
  const label = escapeXml(
    `QR nicht kodierbar (${utf8Bytes(typeof data === "string" ? data : "").length} Bytes)`,
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `width="${size}" height="${size}" role="img" aria-label="QR-Code nicht kodierbar">` +
    `<rect x="0" y="0" width="${size}" height="${size}" fill="#FFFFFF"/>` +
    `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" fill="none" ` +
    `stroke="#000000" stroke-width="2" stroke-dasharray="4 4"/>` +
    `<text x="${size / 2}" y="${size / 2}" fill="#000000" font-family="monospace" ` +
    `font-size="11" text-anchor="middle">${label}</text>` +
    `</svg>`
  );
}

/**
 * Kernkodierung: liefert die boolesche Modulmatrix (true = dunkel) oder null,
 * wenn die Daten nicht in Version 1–10 passen.
 */
function encodeQrMatrix(text: string, level: EccLevel): boolean[][] | null {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length, level);
  if (version === 0) return null;

  const codewords = buildCodewords(version, level, bytes);
  const size = version * 4 + 17;

  // Beste Maske per Penalty wählen (deterministisch, kleinste Punktzahl gewinnt).
  let best: boolean[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const base = buildBaseMatrix(version);
    placeData(base, size, codewords);
    applyMask(base, size, mask);
    placeFormatInfo(base, size, level, mask);
    const score = scoreMatrix(base.modules);
    if (score < bestScore) {
      bestScore = score;
      best = base.modules.map((row) => row.slice());
    }
  }
  return best;
}
