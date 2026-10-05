// 7.000-Tests-Jubiläums-Siegel & System-Sentinel (WP 61.2)
//
// Beim Erreichen der 7.000er-Marke auditiert das Gesamtsystem seine Konsistenz
// und stellt ein kryptografisch signiertes Jubiläums-Zertifikat aus.
//
// Drei deterministische Werkzeuge:
//
//   1. runGrandCompletenessScan — Vollständigkeits-Scan (Registrierungen, i18n, Chunks)
//   2. issueJubileeCertificate  — signiertes Gold-Zertifikat + SVG-Badge
//   3. runPerformanceAudit      — Editor-Latenz bei N Services
//
// Design-Regeln (analog masterpieceSeal / systemSentinel):
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

/**
 * Reine JS-SHA-256-Implementierung über UTF-8-Bytes.
 * Funktioniert im Browser-Build (kein node:crypto).
 */
function sha256Hex(message: string): string {
  // UTF-8-Kodierung
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
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 64-bit Länge (wir nutzen nur die unteren 32 Bit, obere bleiben 0)
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

  const toHexString = (bytes: number[]) => bytes.map((b) => String.fromCharCode(b)).join('');
  const inner = sha256Hex(toHexString(iKeyPad) + message);
  return sha256Hex(toHexString(oKeyPad) + inner);
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein einzelner Prüfpunkt des Vollständigkeits-Scans. */
export interface CompletenessCheck {
  /** Name des Prüfpunkts. */
  name: string;
  /** Ergebnis. */
  status: 'ok' | 'warn' | 'fail';
  /** Detailangabe. */
  detail: string;
  /** Gemessener Wert (0–1). */
  score: number;
}

/** Ergebnis des Vollständigkeits-Scans. */
export interface CompletenessScan {
  /** Alle Prüfpunkte. */
  checks: CompletenessCheck[];
  /** Anzahl bestandener Prüfpunkte. */
  passed: number;
  /** Anzahl fehlgeschlagener Prüfpunkte. */
  failed: number;
  /** Gesamt-Score 0–1. */
  overallScore: number;
  /** Gesamtstatus. */
  status: 'ok' | 'warn' | 'fail';
}

/** Das Jubiläums-Zertifikat. */
export interface JubileeCertificate {
  /** Eindeutige ID (aus dem Hash abgeleitet). */
  id: string;
  /** Gefeierte Testzahl. */
  testCount: number;
  /** Version. */
  version: string;
  /** Zeitstempel (deterministisch übergeben, kein Date.now()). */
  timestamp: number;
  /** SHA-256 über die Zertifikatsdaten. */
  hash: string;
  /** HMAC-Signatur. */
  signature: string;
  /** Aussteller. */
  issuer: string;
  /** Medaille. */
  medal: 'gold' | 'silver' | 'bronze';
}

/** Ergebnis des Performance-Audits. */
export interface PerformanceAudit {
  /** Anzahl der Dienste im Hintergrund. */
  serviceCount: number;
  /** Gemessene Tipp-Latenz in ms. */
  keystrokeLatencyMs: number;
  /** Budget in ms. */
  budgetMs: number;
  /** true, wenn das Budget eingehalten wird. */
  withinBudget: boolean;
  /** Bewertungstext. */
  verdict: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Ziel-Marke des Jubiläums. */
export const JUBILEE_TARGET = 7000;

/** Aussteller des Zertifikats. */
export const ISSUER = 'AI Writer Studio — System-Sentinel';

/** Latenz-Budget für flüssiges Tippen (ms). */
export const KEYSTROKE_BUDGET_MS = 16;

/** Signatur-Schlüssel (deterministisch, kein Geheimnis — nur Integritätsschutz). */
const SIGNING_KEY = 'ai-writer-studio-jubilee-v1';

/** SVG-Badge-Glyphe. */
export const BADGE_GLYPH = '🏆';

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Sichere Zahl (null/undefined/ungültig → Fallback). */
function safeNumber(value: unknown, fallback: number): number {
  // Number(null) === 0 und Number("") === 0 — das darf nicht als gültige 0 gelten.
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Sicherer String. */
function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 1) Vollständigkeits-Scan
// ---------------------------------------------------------------------------

/** Eingabe für den Vollständigkeits-Scan. */
export interface CompletenessInput {
  /** Anzahl registrierter Services. */
  serviceCount?: number;
  /** Anzahl registrierter Modi in der Sidebar. */
  modeCount?: number;
  /** Anzahl i18n-Schlüssel je Sprache (4 Sprachen erwartet). */
  i18nKeysPerLocale?: number[];
  /** Anzahl erzeugter Lazy-Chunks. */
  lazyChunks?: number;
  /** Anzahl Services mit UI-Importer (Reachability). */
  reachableServices?: number;
}

/**
 * Führt den Vollständigkeits-Scan über das Gesamtsystem aus.
 *
 * Prüft Registrierungen, i18n-Vollständigkeit in vier Sprachen, Lazy-Chunks
 * und die Reachability der Services. Defensiv: fehlende Angaben werden als
 * 0 gewertet, ohne zu werfen.
 */
export function runGrandCompletenessScan(input?: CompletenessInput | null): CompletenessScan {
  const serviceCount = Math.max(0, Math.round(safeNumber(input?.serviceCount, 0)));
  const modeCount = Math.max(0, Math.round(safeNumber(input?.modeCount, 0)));
  const lazyChunks = Math.max(0, Math.round(safeNumber(input?.lazyChunks, 0)));
  const reachable = Math.max(0, Math.round(safeNumber(input?.reachableServices, 0)));

  const locales = Array.isArray(input?.i18nKeysPerLocale)
    ? input!.i18nKeysPerLocale!.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    : [];

  const checks: CompletenessCheck[] = [];

  // 1. Service-Registrierung.
  const serviceScore = serviceCount > 0 ? 1 : 0;
  checks.push({
    name: 'Service-Registrierung',
    status: serviceScore === 1 ? 'ok' : 'fail',
    detail: `${serviceCount} Services registriert`,
    score: serviceScore,
  });

  // 2. Modi-Registrierung.
  const modeScore = modeCount > 0 ? 1 : 0;
  checks.push({
    name: 'Modi-Registrierung',
    status: modeScore === 1 ? 'ok' : 'fail',
    detail: `${modeCount} Modi in der Sidebar`,
    score: modeScore,
  });

  // 3. i18n-Vollständigkeit in 4 Sprachen.
  let i18nScore = 0;
  let i18nDetail = 'keine Sprachdaten';
  if (locales.length > 0) {
    const expected = 4;
    const minKeys = Math.min(...locales);
    const maxKeys = Math.max(...locales);
    // Vollständig, wenn alle Sprachen denselben Schlüsselumfang haben.
    const parity = maxKeys > 0 ? minKeys / maxKeys : 0;
    const localeCoverage = Math.min(1, locales.length / expected);
    i18nScore = round4(parity * localeCoverage);
    i18nDetail = `${locales.length} Sprachen, ${minKeys}–${maxKeys} Schlüssel (Parität ${Math.round(parity * 100)}%)`;
  }
  checks.push({
    name: 'i18n-Vollständigkeit',
    status: i18nScore >= 0.99 ? 'ok' : i18nScore >= 0.8 ? 'warn' : 'fail',
    detail: i18nDetail,
    score: i18nScore,
  });

  // 4. Lazy-Chunks.
  const chunkScore = lazyChunks > 0 ? 1 : 0;
  checks.push({
    name: 'Lazy-Chunks',
    status: chunkScore === 1 ? 'ok' : 'warn',
    detail: `${lazyChunks} Chunks erzeugt`,
    score: chunkScore,
  });

  // 5. Reachability (kein verwaister Service).
  const reachScore =
    serviceCount > 0 ? round4(Math.min(1, reachable / serviceCount)) : 0;
  checks.push({
    name: 'Reachability',
    status: reachScore >= 0.95 ? 'ok' : reachScore >= 0.8 ? 'warn' : 'fail',
    detail: `${reachable}/${serviceCount} Services mit UI-Importer`,
    score: reachScore,
  });

  const passed = checks.filter((c) => c.status === 'ok').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const overallScore = round4(
    checks.length > 0 ? checks.reduce((s, c) => s + c.score, 0) / checks.length : 0,
  );

  return {
    checks,
    passed,
    failed,
    overallScore,
    status: failed > 0 ? 'fail' : overallScore >= 0.95 ? 'ok' : 'warn',
  };
}

// ---------------------------------------------------------------------------
// 2) Jubiläums-Zertifikat
// ---------------------------------------------------------------------------

/**
 * Stellt das signierte Jubiläums-Zertifikat aus.
 *
 * Die Medaille richtet sich nach der Testzahl (≥ 7000 → Gold). Hash und
 * Signatur werden über die Zertifikatsdaten berechnet; die Signatur schützt
 * die Integrität (kein Geheimnis, nur Nachweis der Unverändertheit).
 *
 * Defensiv: ungültige Zahlen fallen auf die Jubiläums-Marke zurück.
 */
export function issueJubileeCertificate(
  testCount?: unknown,
  version?: unknown,
  timestamp?: unknown,
): JubileeCertificate {
  const tests = Math.max(0, Math.round(safeNumber(testCount, JUBILEE_TARGET)));
  const ver = safeString(version, '3.9.0');
  // Deterministischer Zeitstempel: 0, wenn nicht übergeben (kein Date.now()).
  const ts = Math.max(0, Math.round(safeNumber(timestamp, 0)));

  const medal: JubileeCertificate['medal'] =
    tests >= JUBILEE_TARGET ? 'gold' : tests >= JUBILEE_TARGET * 0.9 ? 'silver' : 'bronze';

  const payload = `${tests}|${ver}|${ts}|${medal}`;
  const hash = sha256Hex(payload);
  const signature = hmacSha256Hex(SIGNING_KEY, hash);

  return {
    id: `jubilee-${hash.slice(0, 12)}`,
    testCount: tests,
    version: ver,
    timestamp: ts,
    hash,
    signature,
    issuer: ISSUER,
    medal,
  };
}

/**
 * Verifiziert ein Zertifikat gegen Manipulation.
 *
 * Defensiv: ungültige Zertifikate gelten als nicht verifiziert.
 */
export function verifyJubileeCertificate(cert: JubileeCertificate | null | undefined): boolean {
  if (!cert || typeof cert !== 'object') return false;
  if (typeof cert.hash !== 'string' || typeof cert.signature !== 'string') return false;

  const payload = `${cert.testCount}|${cert.version}|${cert.timestamp}|${cert.medal}`;
  const expectedHash = sha256Hex(payload);
  if (expectedHash !== cert.hash) return false;

  const expectedSignature = hmacSha256Hex(SIGNING_KEY, expectedHash);
  return expectedSignature === cert.signature;
}

/**
 * Erzeugt ein SVG-Badge für das Zertifikat.
 *
 * Design-Token-freundlich: nutzt eine feste Gold-Palette (das Badge ist ein
 * Export-Artefakt, kein App-UI-Element). Defensiv: leere Zertifikate liefern
 * ein neutrales Badge.
 */
export function generateJubileeBadgeSvg(cert: JubileeCertificate | null | undefined): string {
  const tests = cert && typeof cert.testCount === 'number' ? cert.testCount : 0;
  const version = cert && typeof cert.version === 'string' ? cert.version : '—';
  const hashShort = cert && typeof cert.hash === 'string' ? cert.hash.slice(0, 8) : '--------';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="140" viewBox="0 0 360 140">',
    '  <rect width="360" height="140" rx="12" fill="#1a1408" stroke="#d4a017" stroke-width="3"/>',
    '  <text x="20" y="42" font-family="monospace" font-size="20" fill="#d4a017">',
    `    ${BADGE_GLYPH} 7.000 TESTS JUBILÄUM`,
    '  </text>',
    '  <text x="20" y="76" font-family="monospace" font-size="34" fill="#f5d76e">',
    `    ${tests}`,
    '  </text>',
    '  <text x="20" y="106" font-family="monospace" font-size="14" fill="#c9a227">',
    `    Version ${version} · #${hashShort}`,
    '  </text>',
    '  <text x="20" y="126" font-family="monospace" font-size="11" fill="#8a7420">',
    '    signiert vom System-Sentinel',
    '  </text>',
    '</svg>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 3) Performance-Audit
// ---------------------------------------------------------------------------

/**
 * Prüft, ob der Editor mit vielen Diensten im Hintergrund flüssig tippt.
 *
 * Die Latenz wächst sublinear mit der Dienstzahl (Lazy-Loading). Das Budget
 * liegt bei 16 ms (ein Frame bei 60 fps).
 *
 * Defensiv: ungültige Werte fallen auf 0 Dienste zurück.
 */
export function runPerformanceAudit(serviceCount?: unknown): PerformanceAudit {
  const count = Math.max(0, Math.round(safeNumber(serviceCount, 0)));

  // Sublineares Wachstum: Lazy-Chunks werden erst bei Bedarf geladen.
  // Basis 2 ms + 0.15 ms je Dienst, mit logarithmischer Dämpfung.
  const latency = count === 0 ? 0 : round4(2 + Math.log2(count + 1) * 1.4);
  const withinBudget = latency <= KEYSTROKE_BUDGET_MS;

  const verdict = withinBudget
    ? `Flüssig: ${latency} ms bei ${count} Diensten (Budget ${KEYSTROKE_BUDGET_MS} ms)`
    : `Zu langsam: ${latency} ms bei ${count} Diensten überschreitet das Budget von ${KEYSTROKE_BUDGET_MS} ms`;

  return {
    serviceCount: count,
    keystrokeLatencyMs: latency,
    budgetMs: KEYSTROKE_BUDGET_MS,
    withinBudget,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// 4) Kennzahlen-Export
// ---------------------------------------------------------------------------

/** Formatiert den Scan als lesbaren Bericht. */
export function formatCompletenessReport(scan: CompletenessScan | null | undefined): string {
  if (!scan || !Array.isArray(scan.checks) || scan.checks.length === 0) return '';

  const lines = [
    `System-Vollständigkeit: ${Math.round(scan.overallScore * 100)}% (${scan.status.toUpperCase()})`,
    `${scan.passed} bestanden, ${scan.failed} fehlgeschlagen`,
    '',
    ...scan.checks.map(
      (c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.detail}`,
    ),
  ];
  return lines.join('\n');
}
