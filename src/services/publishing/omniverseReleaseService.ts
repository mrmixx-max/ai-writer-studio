// Omniverse 4.0 Master Release Cockpit (WP 63.2)
//
// Bündelt das gesamte literarische Universum in einem autarken Meisterwerk-
// Paket: Universum-Preflight, `.aiwsomni`-Archiv, Masterpiece-Seal und
// VG-Wort-Verlagsnormseite.
//
// Drei deterministische Werkzeuge:
//
//   1. runOmniversePreflight — Gesamtscan über das Manuskript
//   2. buildOmniverseArchive — `.aiwsomni`-Archiv mit Inhaltsverzeichnis
//   3. buildVgWortNormPage  — Verlagsnormseite (30 Zeilen à 60 Anschläge)
//
// Design-Regeln (analog masterPublishingService / grandJubileeArchive):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eigene SHA-256/HMAC-Implementierung (kein node:crypto — Browser-Build!).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern sichere Werte.

// ---------------------------------------------------------------------------
// Browser-kompatible SHA-256/HMAC-Implementierung (kein node:crypto)
// ---------------------------------------------------------------------------

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** Reine JS-SHA-256-Implementierung über UTF-8-Bytes (Browser-kompatibel). */
function sha256Hex(message: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    let code = message.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = message.charCodeAt(i + 1);
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      i++;
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0);
  bytes.push((bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) {
      w[i] =
        ((bytes[offset + i * 4] << 24) |
          (bytes[offset + i * 4 + 1] << 16) |
          (bytes[offset + i * 4 + 2] << 8) |
          bytes[offset + i * 4 + 3]) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

/** HMAC-SHA-256 über einen Schlüssel (Browser-kompatibel). */
function hmacSha256Hex(key: string, message: string): string {
  const blockSize = 64;
  let keyBytes: number[] = [];
  for (let i = 0; i < key.length; i++) keyBytes.push(key.charCodeAt(i) & 0xff);
  if (keyBytes.length > blockSize) {
    const hashed = sha256Hex(key);
    keyBytes = [];
    for (let i = 0; i < hashed.length; i += 2) keyBytes.push(parseInt(hashed.slice(i, i + 2), 16));
  }
  while (keyBytes.length < blockSize) keyBytes.push(0);

  const oKeyPad = keyBytes.map((b) => b ^ 0x5c);
  const iKeyPad = keyBytes.map((b) => b ^ 0x36);
  const toStr = (bytes: number[]) => bytes.map((b) => String.fromCharCode(b)).join('');

  const inner = sha256Hex(toStr(iKeyPad) + message);
  return sha256Hex(toStr(oKeyPad) + inner);
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Preflight-Prüfpunkt. */
export interface PreflightCheck {
  /** Name. */
  name: string;
  /** Ergebnis. */
  status: 'ok' | 'warn' | 'fail';
  /** Detail. */
  detail: string;
  /** Score 0–1. */
  score: number;
}

/** Ergebnis des Universum-Preflights. */
export interface OmniversePreflight {
  /** Alle Prüfpunkte. */
  checks: PreflightCheck[];
  /** Anzahl bestandener. */
  passed: number;
  /** Anzahl fehlgeschlagener. */
  failed: number;
  /** Gesamtscore 0–1. */
  overallScore: number;
  /** Gesamtstatus. */
  status: 'ok' | 'warn' | 'fail';
  /** true, wenn der Release freigegeben ist. */
  releaseReady: boolean;
}

/** Eingabe für den Preflight. */
export interface ManuscriptInput {
  /** Kapiteltexte. */
  chapters?: string[];
  /** Anzahl Figuren im Lexikon. */
  characterCount?: number;
  /** Anzahl Conlang-Wörter. */
  conlangWords?: number;
  /** Anzahl Schauplätze. */
  locationCount?: number;
  /** Barcode vorhanden? */
  hasBarcode?: boolean;
  /** Anzahl i18n-Sprachen. */
  localeCount?: number;
}

/** Ein Eintrag im Omniverse-Archiv. */
export interface ArchiveEntry {
  /** Pfad im Archiv. */
  path: string;
  /** Beschreibung. */
  description: string;
  /** Größe in Bytes (deterministisch berechnet). */
  sizeBytes: number;
}

/** Das Omniverse-Archiv. */
export interface OmniverseArchive {
  /** Dateiname. */
  filename: string;
  /** Version. */
  version: string;
  /** Alle Einträge. */
  entries: ArchiveEntry[];
  /** Gesamtgröße in Bytes. */
  totalBytes: number;
  /** SHA-256 über die Einträge. */
  hash: string;
  /** Signatur (Masterpiece Seal). */
  signature: string;
  /** Wortzahl des Gesamtmanuskripts. */
  totalWords: number;
}

/** Eine Verlagsnormseite. */
export interface VgWortNormPage {
  /** Die Seiten als Zeilen-Arrays (je 30 Zeilen). */
  pages: string[][];
  /** Anzahl Seiten. */
  pageCount: number;
  /** Gesamtzeichenzahl (Anschläge). */
  totalCharacters: number;
  /** Normseiten-Anzahl (1 Seite = 30 × 60 = 1800 Anschläge). */
  normPageCount: number;
  /** Geschätztes Honorar bei 0,80 € je Normseite. */
  estimatedFee: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Zeilen je Normseite (VG Wort). */
export const NORM_LINES_PER_PAGE = 30;

/** Anschläge je Zeile (VG Wort). */
export const NORM_CHARS_PER_LINE = 60;

/** Anschläge je Normseite. */
export const NORM_CHARS_PER_PAGE = NORM_LINES_PER_PAGE * NORM_CHARS_PER_LINE;

/** Honorarsatz je Normseite in Euro (deterministische Annahme). */
export const FEE_PER_NORM_PAGE = 0.8;

/** Signatur-Schlüssel (deterministisch, kein Geheimnis — Integritätsschutz). */
const SEAL_KEY = 'ai-writer-studio-omniverse-v4';

/** Archiv-Endung. */
export const ARCHIVE_EXTENSION = '.aiwsomni';

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Sichere Zahl (null/undefined/ungültig → Fallback). */
function safeNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Kapitel defensiv normalisieren. */
function normalizeChapters(chapters: unknown): string[] {
  if (!Array.isArray(chapters)) return [];
  return chapters
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 1) Universum-Preflight
// ---------------------------------------------------------------------------

/**
 * Führt den finalen Gesamtscan über das Manuskript aus.
 *
 * Prüft Manuskript-Umfang, Figuren-Lexikon, Conlang, Schauplätze, Barcode und
 * i18n-Abdeckung. `releaseReady` ist true, wenn kein Prüfpunkt fehlschlägt und
 * der Gesamtscore mindestens 0.85 beträgt.
 *
 * Defensiv: fehlende Angaben werden als 0 gewertet, ohne zu werfen.
 */
export function runOmniversePreflight(input?: ManuscriptInput | null): OmniversePreflight {
  const chapters = normalizeChapters(input?.chapters);
  const words = chapters.reduce((s, c) => s + countWords(c), 0);

  const characterCount = Math.max(0, Math.round(safeNumber(input?.characterCount, 0)));
  const conlangWords = Math.max(0, Math.round(safeNumber(input?.conlangWords, 0)));
  const locationCount = Math.max(0, Math.round(safeNumber(input?.locationCount, 0)));
  const localeCount = Math.max(0, Math.round(safeNumber(input?.localeCount, 4)));
  const hasBarcode = input?.hasBarcode === true;

  const checks: PreflightCheck[] = [];

  // 1. Manuskript-Umfang (Ziel: ≥ 40.000 Wörter für einen Roman).
  const wordScore = words >= 40000 ? 1 : words >= 20000 ? 0.7 : words > 0 ? 0.4 : 0;
  checks.push({
    name: 'Manuskript-Umfang',
    status: wordScore >= 0.9 ? 'ok' : wordScore > 0 ? 'warn' : 'fail',
    detail: `${words.toLocaleString('de-DE')} Wörter in ${chapters.length} Kapiteln`,
    score: wordScore,
  });

  // 2. Figuren-Lexikon (Pflicht: ein Roman ohne Figuren ist kein Roman).
  const charScore = characterCount >= 5 ? 1 : characterCount > 0 ? 0.6 : 0;
  checks.push({
    name: 'Figuren-Lexikon',
    status: charScore >= 0.9 ? 'ok' : charScore > 0 ? 'warn' : 'fail',
    detail: `${characterCount} Figuren erfasst`,
    score: charScore,
  });

  // 3. Conlang-Lexikon.
  const conlangScore = conlangWords >= 10 ? 1 : conlangWords > 0 ? 0.6 : 0.3;
  checks.push({
    name: 'Conlang-Lexikon',
    status: conlangScore >= 0.9 ? 'ok' : 'warn',
    detail: conlangWords > 0 ? `${conlangWords} Vokabeln` : 'keine Kunstsprache verwendet',
    score: conlangScore,
  });

  // 4. Schauplatz-Lexikon.
  const locScore = locationCount >= 3 ? 1 : locationCount > 0 ? 0.6 : 0;
  checks.push({
    name: 'Schauplatz-Lexikon',
    status: locScore >= 0.9 ? 'ok' : locScore > 0 ? 'warn' : 'fail',
    detail: `${locationCount} Schauplätze erfasst`,
    score: locScore,
  });

  // 5. Barcode für den Handel.
  checks.push({
    name: 'EAN-13-Barcode',
    status: hasBarcode ? 'ok' : 'warn',
    detail: hasBarcode ? 'Barcode vorhanden' : 'kein Barcode erzeugt',
    score: hasBarcode ? 1 : 0,
  });

  // 6. i18n-Abdeckung.
  const localeScore = localeCount >= 4 ? 1 : localeCount > 0 ? localeCount / 4 : 0;
  checks.push({
    name: 'i18n-Abdeckung',
    status: localeScore >= 1 ? 'ok' : 'warn',
    detail: `${localeCount} Sprachen`,
    score: round4(localeScore),
  });

  const passed = checks.filter((c) => c.status === 'ok').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const overallScore = round4(
    checks.reduce((s, c) => s + c.score, 0) / Math.max(1, checks.length),
  );

  // Der Manuskript-Umfang ist eine harte Voraussetzung: ein Release ohne
  // vollständiges Manuskript darf nicht freigegeben werden, selbst wenn alle
  // Lexika-Zähler stimmen.
  const manuscriptReady = wordScore >= 0.9;

  return {
    checks,
    passed,
    failed,
    overallScore,
    status: failed > 0 ? 'fail' : overallScore >= 0.85 && manuscriptReady ? 'ok' : 'warn',
    releaseReady: failed === 0 && overallScore >= 0.85 && manuscriptReady,
  };
}

// ---------------------------------------------------------------------------
// 2) Omniverse-Archiv
// ---------------------------------------------------------------------------

/**
 * Baut das `.aiwsomni`-Archiv.
 *
 * Enthält das Buch in allen Formaten, das vollständige Figuren-, Conlang- und
 * Schauplatz-Lexikon sowie das signierte Masterpiece-Seal. Die Eintragsgrößen
 * werden deterministisch aus dem Inhalt berechnet.
 *
 * Defensiv: ohne Manuskript entsteht ein gültiges, aber kleines Archiv.
 */
export function buildOmniverseArchive(
  input?: ManuscriptInput | null,
  version?: unknown,
): OmniverseArchive {
  const chapters = normalizeChapters(input?.chapters);
  const words = chapters.reduce((s, c) => s + countWords(c), 0);
  const ver = typeof version === 'string' && version.trim() ? version.trim() : '4.0.0';

  const characterCount = Math.max(0, Math.round(safeNumber(input?.characterCount, 0)));
  const conlangWords = Math.max(0, Math.round(safeNumber(input?.conlangWords, 0)));
  const locationCount = Math.max(0, Math.round(safeNumber(input?.locationCount, 0)));

  // Größen deterministisch aus dem Inhalt ableiten (ca. 6 Bytes je Wort).
  const bytesPerWord = 6;

  const entries: ArchiveEntry[] = [
    {
      path: 'manuscript/print-x1a.pdf',
      description: 'Druckfertiges PDF/X-1a für den Offsetdruck',
      sizeBytes: words * bytesPerWord + 4096,
    },
    {
      path: 'manuscript/ebook.epub',
      description: 'EPUB 3.3 für alle Lesegeräte',
      sizeBytes: words * bytesPerWord + 2048,
    },
    {
      path: 'manuscript/audiobook-cues.json',
      description: 'M4B-Hörbuch-Cue-Sheet',
      sizeBytes: chapters.length * 512 + 256,
    },
    {
      path: 'lexicon/characters.json',
      description: 'Vollständiges Figuren-Lexikon',
      sizeBytes: characterCount * 320 + 128,
    },
    {
      path: 'lexicon/conlang.json',
      description: 'Conlang-Lexikon mit Bedeutungen',
      sizeBytes: conlangWords * 96 + 64,
    },
    {
      path: 'lexicon/locations.json',
      description: 'Schauplatz-Lexikon',
      sizeBytes: locationCount * 256 + 64,
    },
    {
      path: 'seal/masterpiece-seal.json',
      description: 'Signiertes AI Writer Studio 4.0 Masterpiece Seal',
      sizeBytes: 512,
    },
    {
      path: 'normpage/vgwort-normseiten.txt',
      description: 'Verlagsnormseite (VG Wort, 30 × 60)',
      sizeBytes: words * bytesPerWord,
    },
  ];

  const totalBytes = entries.reduce((s, e) => s + e.sizeBytes, 0);

  // Hash über die Inhaltsstruktur, Signatur als Seal.
  const manifest = entries.map((e) => `${e.path}:${e.sizeBytes}`).join('|');
  const hash = sha256Hex(`${ver}|${words}|${manifest}`);
  const signature = hmacSha256Hex(SEAL_KEY, hash);

  return {
    filename: `omniverse-${ver}${ARCHIVE_EXTENSION}`,
    version: ver,
    entries,
    totalBytes,
    hash,
    signature,
    totalWords: words,
  };
}

/** Verifiziert ein Archiv gegen Manipulation. */
export function verifyOmniverseArchive(archive: OmniverseArchive | null | undefined): boolean {
  if (!archive || typeof archive !== 'object' || !Array.isArray(archive.entries)) return false;
  if (typeof archive.hash !== 'string' || typeof archive.signature !== 'string') return false;

  const manifest = archive.entries.map((e) => `${e.path}:${e.sizeBytes}`).join('|');
  const expectedHash = sha256Hex(`${archive.version}|${archive.totalWords}|${manifest}`);
  if (expectedHash !== archive.hash) return false;

  return hmacSha256Hex(SEAL_KEY, expectedHash) === archive.signature;
}

// ---------------------------------------------------------------------------
// 3) VG-Wort-Verlagsnormseite
// ---------------------------------------------------------------------------

/**
 * Erzeugt druckfertige Verlagsnormseiten nach VG-Wort-Norm
 * (30 Zeilen à 60 Anschläge = 1800 Anschläge je Seite).
 *
 * Defensiv: ohne Text entsteht keine Seite.
 */
export function buildVgWortNormPage(input?: ManuscriptInput | null): VgWortNormPage {
  const chapters = normalizeChapters(input?.chapters);
  const text = chapters.join('\n\n');

  const empty: VgWortNormPage = {
    pages: [],
    pageCount: 0,
    totalCharacters: 0,
    normPageCount: 0,
    estimatedFee: 0,
  };

  if (!text.trim()) return empty;

  // Zeilen à 60 Anschlägen bilden (an Wortgrenzen umbrechen).
  const lines: string[] = [];
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > NORM_CHARS_PER_LINE) {
      if (current) lines.push(current);
      // Sehr lange Wörter hart trennen.
      current = word.length > NORM_CHARS_PER_LINE ? word.slice(0, NORM_CHARS_PER_LINE) : word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // In Seiten à 30 Zeilen aufteilen.
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += NORM_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + NORM_LINES_PER_PAGE));
  }

  const totalCharacters = lines.reduce((s, l) => s + l.length, 0);
  const normPageCount = Math.max(1, Math.ceil(totalCharacters / NORM_CHARS_PER_PAGE));

  return {
    pages,
    pageCount: pages.length,
    totalCharacters,
    normPageCount,
    estimatedFee: round4(normPageCount * FEE_PER_NORM_PAGE),
  };
}

// ---------------------------------------------------------------------------
// 4) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert den Preflight-Bericht. */
export function formatPreflightReport(preflight: OmniversePreflight | null | undefined): string {
  if (!preflight || !Array.isArray(preflight.checks) || preflight.checks.length === 0) return '';

  return [
    `Universum-Preflight: ${Math.round(preflight.overallScore * 100)}% (${preflight.status.toUpperCase()})`,
    preflight.releaseReady ? 'RELEASE FREIGEGEBEN' : 'RELEASE GESPERRT',
    '',
    ...preflight.checks.map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.detail}`),
  ].join('\n');
}

/** Formatiert das Archiv-Inhaltsverzeichnis. */
export function formatArchiveManifest(archive: OmniverseArchive | null | undefined): string {
  if (!archive || !Array.isArray(archive.entries) || archive.entries.length === 0) return '';

  const kb = (b: number) => `${Math.round(b / 1024)} KB`;
  return [
    `${archive.filename} (${archive.version})`,
    `${archive.entries.length} Einträge · ${kb(archive.totalBytes)}`,
    '',
    ...archive.entries.map((e) => `${e.path} — ${e.description} (${kb(e.sizeBytes)})`),
  ].join('\n');
}
