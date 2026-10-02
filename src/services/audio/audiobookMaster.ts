// Hörbuch-Master-Service (WP 18.1) — M4B & MP3-Kapitelmarken.
//
// Baut aus den Kapiteln eines Projekts einen hörbuchfähigen Master:
//   • generateChapterMarkers()  → Timecodes aus Textlänge + Sprechgeschwindigkeit
//   • buildM4bMetadata()        → MP4/iTunes-Container-Tags (©nam, ©ART, ©alb,
//                                 covr, chpl) inkl. fertiger Atom-Bytes
//   • cutSampleSnippet()        → 3–5-minütige Hörprobe
//
// Rein lokal & deterministisch: KEIN LLM-Call, keine Netzwerk-/API-Abhängigkeit,
// keine Zeit-/Zufallsquellen. Gleiche Eingabe ⇒ gleiche Ausgabe.
// Defensive Fallbacks: fehlende/ungültige Daten (leerer Text, wpm ≤ 0, kaputte
// Cover-URLs) führen zu definierten Defaults statt zu Exceptions.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface ChapterInput {
  id: string;
  title: string;
  content: string;
}

export interface ChapterMarker {
  title: string;
  startTimeMs: number;
  durationMs: number;
  wordCount: number;
}

/** Ein iTunes/MP4-Tag: FourCC + Well-Known-Datentyp + Rohwert. */
export interface Mp4TagAtom {
  /** FourCC, z. B. "©nam", "©ART", "©alb", "covr" oder "chpl". */
  type: string;
  /** iTunes-Datentyp: 1 = UTF-8, 13 = JPEG, 14 = PNG, 0 = binär (chpl). */
  dataType: number;
  value: string | Uint8Array;
  /** Ablageort: "ilst" (moov.udta.meta.ilst) oder "udta" (moov.udta.chpl). */
  scope: "ilst" | "udta";
}

export interface M4bMetadata {
  title: string;
  author: string;
  series?: string;
  coverImage?: string;
  chapterMarkers: ChapterMarker[];
  /** Fertige Container-Tags inkl. chpl-Atom (abgeleitet aus den Feldern oben). */
  atoms: Mp4TagAtom[];
  /** Gesamtdauer des Hörbuchs in ms (Summe der Kapiteldauern). */
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Standard-Sprechgeschwindigkeit in Wörtern pro Minute. */
export const DEFAULT_WPM = 150;

/** Hörprobe: erlaubter Minutenbereich (Task-Vorgabe 3–5 min). */
export const MIN_SAMPLE_MINUTES = 3;
export const MAX_SAMPLE_MINUTES = 5;

/** iTunes-Datentypen (Well-Known Types). */
export const DATA_TYPE_BINARY = 0;
export const DATA_TYPE_UTF8 = 1;
export const DATA_TYPE_JPEG = 13;
export const DATA_TYPE_PNG = 14;

/** Nero-`chpl`-Timebase: 10.000.000 Einheiten = 1 Sekunde = 100-ns-Ticks. */
export const NERO_TIME_SCALE = 10_000_000;

/** Max. Länge eines Kapiteltitels im chpl-Atom (Längenfeld ist ein Byte). */
export const MAX_CHAPTER_TITLE_BYTES = 255;

// ---------------------------------------------------------------------------
// Interne Helfer: Text
// ---------------------------------------------------------------------------

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/** Sammelt Text aus ProseMirror/TipTap-Knoten (rekursiv). */
function collectNodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectNodeText).join(" ");
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.content)) return obj.content.map(collectNodeText).join(" ");
  }
  return "";
}

/**
 * Normalisiert beliebigen Kapitel-Inhalt zu Klartext:
 *   • ProseMirror/TipTap-JSON (String oder Objekt) → reine Textknoten
 *   • HTML → Tags entfernt
 *   • Klartext → unverändert
 */
export function normalizeContent(content: unknown): string {
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = collectNodeText(parsed).replace(/\s+/g, " ").trim();
        if (extracted) return extracted;
      } catch {
        // Kein gültiges JSON — als Klartext behandeln.
      }
    }
    return trimmed.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (content && typeof content === "object") {
    return collectNodeText(content).replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Zählt Wörter (Unicode-Buchstaben/-Ziffern, inkl. Umlaute). */
export function countWords(content: unknown): number {
  const text = normalizeContent(content);
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

/** Schneidet Text wortgenau nach den ersten `n` Wörtern ab. */
function takeWords(text: string, n: number): string {
  if (n <= 0 || !text) return "";
  const re = /[\p{L}\p{N}]+/gu;
  let match: RegExpExecArray | null;
  let count = 0;
  let endIndex = 0;
  while ((match = re.exec(text)) !== null) {
    count += 1;
    if (count === n) {
      endIndex = match.index + match[0].length;
      break;
    }
  }
  return endIndex > 0 ? text.slice(0, endIndex).trim() : text.trim();
}

// ---------------------------------------------------------------------------
// Interne Helfer: Bytes
// ---------------------------------------------------------------------------

function utf8(value: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value);
  const g = globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } };
  if (g.Buffer) return new Uint8Array(g.Buffer.from(value, "utf8"));
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

/** FourCC → exakt 4 Bytes (Latin-1; "©" = 0xA9, NICHT UTF-8 0xC2 0xA9). */
function fourCCBytes(code: string): Uint8Array {
  const padded = (code || "????").padEnd(4, " ").slice(0, 4);
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) out[i] = padded.charCodeAt(i) & 0xff;
  return out;
}

/** UTF-8-kodiert und auf `maxBytes` gekürzt, ohne Multibyte-Zeichen zu zerreißen. */
function truncateUtf8(value: string, maxBytes: number): Uint8Array {
  const full = utf8(value);
  if (full.length <= maxBytes) return full;
  let end = maxBytes;
  while (end > 0 && (full[end] & 0xc0) === 0x80) end -= 1;
  return full.subarray(0, end);
}

function writeFourCC(target: Uint8Array, offset: number, code: string): void {
  target.set(fourCCBytes(code), offset);
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function decodeBase64(input: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(input);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  const g = globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } };
  if (g.Buffer) return new Uint8Array(g.Buffer.from(input, "base64"));
  throw new Error("Kein Base64-Decoder verfügbar");
}

function parseCoverImage(coverImage: unknown): { dataType: number; bytes: Uint8Array } | null {
  if (typeof coverImage !== "string") return null;
  const raw = coverImage.trim();
  if (!raw) return null;

  let mime = "";
  let base64 = raw;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(raw);
  if (match) {
    mime = (match[1] || "").toLowerCase();
    base64 = match[3] || "";
  }
  const compact = base64.replace(/\s+/g, "");
  if (!compact) return null;

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(compact);
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;

  let dataType = DATA_TYPE_JPEG;
  if (mime.includes("png") || isPng(bytes)) dataType = DATA_TYPE_PNG;
  else if (mime.includes("jpeg") || mime.includes("jpg") || isJpeg(bytes)) dataType = DATA_TYPE_JPEG;
  return { dataType, bytes };
}

// ---------------------------------------------------------------------------
// Öffentliche API: Kapitelmarken
// ---------------------------------------------------------------------------

/**
 * Berechnet für jedes Kapitel Start- und Dauer-Timecode aus Textlänge und
 * Sprechgeschwindigkeit. Die Startzeiten sind kumulativ (lückenlos).
 *
 * @param chapters Kapitel in Lesereihenfolge.
 * @param wpm      Wörter pro Minute; ungültige/fehlende Werte → DEFAULT_WPM (150).
 */
export function generateChapterMarkers(
  chapters: ChapterInput[],
  wpm: number = DEFAULT_WPM,
): ChapterMarker[] {
  const safeWpm = typeof wpm === "number" && Number.isFinite(wpm) && wpm > 0 ? wpm : DEFAULT_WPM;
  if (!Array.isArray(chapters) || chapters.length === 0) return [];

  const markers: ChapterMarker[] = [];
  let cursorMs = 0;
  for (const chapter of chapters) {
    if (!chapter || typeof chapter !== "object") continue;
    const wordCount = countWords((chapter as ChapterInput).content);
    const durationMs = Math.round((wordCount / safeWpm) * 60000);
    markers.push({
      title: cleanText((chapter as ChapterInput).title) || "Kapitel",
      startTimeMs: cursorMs,
      durationMs,
      wordCount,
    });
    cursorMs += durationMs;
  }
  return markers;
}

/** Summe der Kapiteldauern in ms. */
export function totalDurationMs(markers: ChapterMarker[]): number {
  if (!Array.isArray(markers)) return 0;
  return markers.reduce((sum, m) => sum + toNonNegativeInt(m?.durationMs), 0);
}

// ---------------------------------------------------------------------------
// Öffentliche API: MP4-/M4B-Container-Tags
// ---------------------------------------------------------------------------

function sanitizeMarker(input: unknown): ChapterMarker {
  const m = (input ?? {}) as Partial<ChapterMarker>;
  return {
    title: cleanText(m.title) || "Kapitel",
    startTimeMs: toNonNegativeInt(m.startTimeMs),
    durationMs: toNonNegativeInt(m.durationMs),
    wordCount: toNonNegativeInt(m.wordCount),
  };
}

/**
 * Serialisiert den Rumpf des Nero-`chpl`-Atoms:
 *   version(1) | reserved(3) | count(1) | count × [ start(8, BE, 100ns) | len(1) | title ]
 */
export function encodeChplBody(chapterMarkers: ChapterMarker[]): Uint8Array {
  const markers = Array.isArray(chapterMarkers) ? chapterMarkers.map(sanitizeMarker) : [];

  const entries: Uint8Array[] = [];
  for (const marker of markers) {
    const titleBytes = truncateUtf8(marker.title, MAX_CHAPTER_TITLE_BYTES);
    const startUnits = Math.round((marker.startTimeMs / 1000) * NERO_TIME_SCALE);
    const entry = new Uint8Array(9 + titleBytes.length);
    const dv = new DataView(entry.buffer);
    dv.setBigUint64(0, BigInt(Math.max(0, startUnits)), false);
    entry[8] = titleBytes.length;
    entry.set(titleBytes, 9);
    entries.push(entry);
  }

  const total = 5 + entries.reduce((sum, e) => sum + e.length, 0);
  const body = new Uint8Array(total);
  body[0] = 1; // version
  body[1] = 0; // reserved (24-bit)
  body[2] = 0;
  body[3] = 0;
  body[4] = Math.min(255, entries.length); // chapter count
  let offset = 5;
  for (const entry of entries) {
    body.set(entry, offset);
    offset += entry.length;
  }
  return body;
}

/** Vollständiges `chpl`-Atom (size + type + body). */
export function encodeChplAtom(chapterMarkers: ChapterMarker[]): Uint8Array {
  const body = encodeChplBody(chapterMarkers);
  const atom = new Uint8Array(8 + body.length);
  new DataView(atom.buffer).setUint32(0, atom.length, false);
  writeFourCC(atom, 4, "chpl");
  atom.set(body, 8);
  return atom;
}

/** Ein `data`-Atom (Typ-Indikator + Locale + Nutzlast). */
export function encodeDataAtom(value: string | Uint8Array, dataType: number): Uint8Array {
  const payload = typeof value === "string" ? utf8(value) : value;
  const atom = new Uint8Array(8 + 8 + payload.length);
  const dv = new DataView(atom.buffer);
  dv.setUint32(0, atom.length, false);
  writeFourCC(atom, 4, "data");
  dv.setUint32(8, dataType, false);
  dv.setUint32(12, 0, false); // locale/reserved
  atom.set(payload, 16);
  return atom;
}

/** Ein iTunes-Tag-Atom (FourCC umschließt genau ein `data`-Atom). */
export function encodeTagAtom(type: string, value: string | Uint8Array, dataType: number): Uint8Array {
  const data = encodeDataAtom(value, dataType);
  const atom = new Uint8Array(8 + data.length);
  new DataView(atom.buffer).setUint32(0, atom.length, false);
  writeFourCC(atom, 4, type);
  atom.set(data, 8);
  return atom;
}

/** `ilst`-Box mit allen ilst-Tags (©nam, ©ART, ©alb, covr). */
export function encodeIlstAtom(meta: M4bMetadata): Uint8Array {
  const parts = (Array.isArray(meta?.atoms) ? meta.atoms : [])
    .filter((a) => a.scope !== "udta")
    .map((a) => encodeTagAtom(a.type, a.value, a.dataType));
  const total = 8 + parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, total, false);
  writeFourCC(out, 4, "ilst");
  let offset = 8;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Byte-Bündel aus `ilst` + `chpl` — bereit zum Schreiben nach moov.udta. */
export function serializeM4bAtoms(meta: M4bMetadata): Uint8Array {
  const ilst = encodeIlstAtom(meta);
  const chpl = encodeChplAtom(meta?.chapterMarkers ?? []);
  const out = new Uint8Array(ilst.length + chpl.length);
  out.set(ilst, 0);
  out.set(chpl, ilst.length);
  return out;
}

/**
 * Erzeugt die MP4-Container-Tags eines M4B-Hörbuchs.
 *
 *   ©nam → Titel        ©ART → Autor        ©alb → Serie (Fallback: Titel)
 *   covr → Cover-Bild (JPEG/PNG)            chpl → Kapitelmarken (Nero)
 *
 * @param title         Buchtitel; leer → "Unbenanntes Hörbuch".
 * @param author        Autor; leer → "Unbekannter Autor".
 * @param series        Reihenname (optional).
 * @param coverImage    Data-URL oder Base64 (optional).
 * @param chapterMarkers Fertige Marker für das chpl-Atom (optional).
 */
export function buildM4bMetadata(
  title: string,
  author: string,
  series?: string,
  coverImage?: string,
  chapterMarkers: ChapterMarker[] = [],
): M4bMetadata {
  const safeTitle = cleanText(title) || "Unbenanntes Hörbuch";
  const safeAuthor = cleanText(author) || "Unbekannter Autor";
  const safeSeries = cleanText(series);
  const safeCover = cleanText(coverImage);

  const markers = Array.isArray(chapterMarkers) ? chapterMarkers.map(sanitizeMarker) : [];

  const atoms: Mp4TagAtom[] = [
    { type: "©nam", dataType: DATA_TYPE_UTF8, value: safeTitle, scope: "ilst" },
    { type: "©ART", dataType: DATA_TYPE_UTF8, value: safeAuthor, scope: "ilst" },
    { type: "©alb", dataType: DATA_TYPE_UTF8, value: safeSeries || safeTitle, scope: "ilst" },
  ];

  const cover = parseCoverImage(safeCover);
  if (cover) {
    atoms.push({ type: "covr", dataType: cover.dataType, value: cover.bytes, scope: "ilst" });
  }

  atoms.push({
    type: "chpl",
    dataType: DATA_TYPE_BINARY,
    value: encodeChplAtom(markers),
    scope: "udta",
  });

  const metadata: M4bMetadata = {
    title: safeTitle,
    author: safeAuthor,
    chapterMarkers: markers,
    atoms,
    totalDurationMs: totalDurationMs(markers),
  };
  if (safeSeries) metadata.series = safeSeries;
  if (safeCover) metadata.coverImage = safeCover;
  return metadata;
}

// ---------------------------------------------------------------------------
// Öffentliche API: Hörprobe
// ---------------------------------------------------------------------------

/** Begrenzt die Probenlänge auf [3, 5] Minuten; ungültige Werte → 5 Minuten. */
export function clampSampleMinutes(durationMinutes?: number): number {
  const raw =
    typeof durationMinutes === "number" && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : MAX_SAMPLE_MINUTES;
  return Math.min(MAX_SAMPLE_MINUTES, Math.max(MIN_SAMPLE_MINUTES, raw));
}

/**
 * Exportiert eine 3–5-minütige Hörprobe aus den führenden Kapiteln.
 *
 * Es wird vom ersten Kapitel an gesammelt, bis die Zielwortzahl
 * (Minuten × DEFAULT_WPM) erreicht ist. Ein zu langes Kapitel wird wortgenau
 * abgeschnitten; der Rückgabewert enthält nur Klartext.
 */
export function cutSampleSnippet(
  chapters: ChapterInput[],
  durationMinutes: number = MAX_SAMPLE_MINUTES,
): ChapterInput[] {
  if (!Array.isArray(chapters) || chapters.length === 0) return [];

  const targetWords = Math.round(clampSampleMinutes(durationMinutes) * DEFAULT_WPM);
  if (targetWords <= 0) return [];

  const snippet: ChapterInput[] = [];
  let collected = 0;

  for (let index = 0; index < chapters.length; index += 1) {
    if (collected >= targetWords) break;
    const chapter = chapters[index];
    if (!chapter || typeof chapter !== "object") continue;

    const text = normalizeContent((chapter as ChapterInput).content);
    const words = countWords(text);
    const remaining = targetWords - collected;
    const id = cleanText((chapter as ChapterInput).id) || `chapter-${index}`;
    const title = cleanText((chapter as ChapterInput).title) || "Kapitel";

    if (words <= remaining) {
      snippet.push({ id, title, content: text });
      collected += words;
    } else {
      snippet.push({ id, title, content: takeWords(text, remaining) });
      collected = targetWords;
      break;
    }
  }

  return snippet;
}
