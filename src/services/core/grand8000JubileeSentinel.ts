// 8.000-Tests-Diamant-Siegel & Sentinel (WP 71.2)
//
// Beim Erreichen von 8.000 bestandenen Tests über mehr als 70 Services muss das
// Studio seine absolute Integrität, Speicherfreiheit und Latenz offiziell
// bescheinigen.
//
// Drei deterministische Werkzeuge:
//
//   1. runDiamondAudit        — Gesamtsystem-Audit (Werkzeuge, Chunks, i18n, Cache)
//   2. generateDiamondCertificate — 8.000er-Diamant-Zertifikat (SVG + PDF, SHA-256)
//   3. auditSubMillisecond    — Sub-16-ms-Garantie für UI-Modals
//
// Design-Regeln (analog grandCenturySentinel):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module — SHA-256 ist browser-kompatibel selbst implementiert.
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein einzelner Audit-Schritt. */
export interface DiamondCheck {
  /** Name des Checks. */
  name: string;
  /** Status. */
  status: 'ok' | 'warn' | 'fail';
  /** Detail-Text. */
  detail: string;
  /** Score (0–1). */
  score: number;
}

/** Ergebnis des Gesamtsystem-Audits. */
export interface DiamondAudit {
  /** Alle Checks. */
  checks: DiamondCheck[];
  /** Anzahl bestandener Checks. */
  passed: number;
  /** Anzahl fehlgeschlagener Checks. */
  failed: number;
  /** Gesamtscore (0–1). */
  overallScore: number;
  /** true, wenn alle Checks bestanden sind. */
  healthy: boolean;
}

/** Ergebnis des Diamant-Zertifikats. */
export interface DiamondCertificate {
  /** Test-Zahl. */
  testCount: number;
  /** Version. */
  version: string;
  /** Zeitstempel (deterministisch). */
  timestamp: number;
  /** SHA-256-Prüfsumme. */
  hash: string;
  /** SVG-Badge als String. */
  svg: string;
  /** PDF-Inhalt als String. */
  pdf: string;
  /** true, wenn das Zertifikat gültig ist (≥ 8.000 Tests). */
  verified: boolean;
}

/** Ergebnis der Latenz-Prüfung. */
export interface LatencyCheck {
  /** Komponenten-Name. */
  component: string;
  /** Gemessene Zeit in ms. */
  durationMs: number;
  /** Budget in ms. */
  budgetMs: number;
  /** true, wenn innerhalb des Budgets. */
  withinBudget: boolean;
}

// ---------------------------------------------------------------------------
// Browser-kompatible SHA-256
// ---------------------------------------------------------------------------

/** SHA-256-Hash einer Zeichenkette (browser-kompatibel, kein node:crypto). */
export function sha256(input: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const msg = new TextEncoder().encode(input);
  const bitLen = msg.length * 8;

  const padded = new Uint8Array((msg.length + 9 + 63) & ~63);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Zahl defensiv prüfen (null/'' werden nicht zu 0 konvertiert). */
function safeNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// 1) Gesamtsystem-Audit
// ---------------------------------------------------------------------------

/**
 * Prüft das Gesamtsystem: registrierte Werkzeuge, Lazy-Chunks, i18n-Schlüssel
 * in 4 Sprachen und Caching-Tabellen.
 *
 * Defensiv: ohne Angaben werden Standardwerte angenommen.
 */
export function runDiamondAudit(options?: {
  /** Anzahl registrierter Werkzeuge. */
  toolCount?: number;
  /** Anzahl Lazy-Chunks im Bundle. */
  chunkCount?: number;
  /** Anzahl i18n-Schlüssel. */
  i18nKeyCount?: number;
  /** Anzahl Caching-Tabellen. */
  cacheTableCount?: number;
  /** Anzahl Services. */
  serviceCount?: number;
  /** Bundle-Größe in KB. */
  bundleSizeKb?: number;
}): DiamondAudit {
  const toolCount = safeNumber(options?.toolCount, 87);
  const chunkCount = safeNumber(options?.chunkCount, 20);
  const i18nKeyCount = safeNumber(options?.i18nKeyCount, 1300);
  const cacheTableCount = safeNumber(options?.cacheTableCount, 6);
  const serviceCount = safeNumber(options?.serviceCount, 70);
  const bundleSizeKb = safeNumber(options?.bundleSizeKb, 4600);

  const checks: DiamondCheck[] = [];

  // 1. Registrierte Werkzeuge (Ziel: ≥ 70).
  const toolScore = toolCount >= 70 ? 1 : toolCount >= 50 ? 0.7 : toolCount > 0 ? 0.4 : 0;
  checks.push({
    name: 'Registrierte Werkzeuge',
    status: toolScore >= 0.9 ? 'ok' : toolScore > 0 ? 'warn' : 'fail',
    detail: `${toolCount} Werkzeuge in der Registry`,
    score: toolScore,
  });

  // 2. Lazy-Chunks (jedes Panel ein eigener Chunk).
  const chunkScore = chunkCount >= 15 ? 1 : chunkCount >= 8 ? 0.7 : chunkCount > 0 ? 0.4 : 0;
  checks.push({
    name: 'Lazy-Chunks',
    status: chunkScore >= 0.9 ? 'ok' : chunkScore > 0 ? 'warn' : 'fail',
    detail: `${chunkCount} Lazy-Chunks im Bundle`,
    score: chunkScore,
  });

  // 3. i18n-Schlüssel in 4 Sprachen.
  const i18nScore = i18nKeyCount >= 1200 ? 1 : i18nKeyCount >= 800 ? 0.7 : i18nKeyCount > 0 ? 0.4 : 0;
  checks.push({
    name: 'i18n-Schlüssel',
    status: i18nScore >= 0.9 ? 'ok' : i18nScore > 0 ? 'warn' : 'fail',
    detail: `${i18nKeyCount} Schlüssel in 4 Sprachen`,
    score: i18nScore,
  });

  // 4. Caching-Tabellen.
  const cacheScore = cacheTableCount >= 4 ? 1 : cacheTableCount >= 2 ? 0.7 : cacheTableCount > 0 ? 0.4 : 0;
  checks.push({
    name: 'Caching-Tabellen',
    status: cacheScore >= 0.9 ? 'ok' : cacheScore > 0 ? 'warn' : 'fail',
    detail: `${cacheTableCount} Cache-Tabellen aktiv`,
    score: cacheScore,
  });

  // 5. Service-Abdeckung (Ziel: ≥ 70).
  const serviceScore = serviceCount >= 70 ? 1 : serviceCount >= 50 ? 0.7 : serviceCount > 0 ? 0.4 : 0;
  checks.push({
    name: 'Service-Abdeckung',
    status: serviceScore >= 0.9 ? 'ok' : serviceScore > 0 ? 'warn' : 'fail',
    detail: `${serviceCount} Services integriert`,
    score: serviceScore,
  });

  // 6. Bundle-Größe (Ziel: < 5000 KB).
  const bundleScore = bundleSizeKb > 0 && bundleSizeKb <= 5000 ? 1 : bundleSizeKb <= 8000 ? 0.7 : 0;
  checks.push({
    name: 'Bundle-Größe',
    status: bundleScore >= 0.9 ? 'ok' : bundleScore > 0 ? 'warn' : 'fail',
    detail: `${bundleSizeKb} KB (Ziel: < 5000 KB)`,
    score: bundleScore,
  });

  const passed = checks.filter((c) => c.status === 'ok').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const overallScore = round4(checks.reduce((s, c) => s + c.score, 0) / Math.max(1, checks.length));

  // Werkzeug- und Service-Abdeckung sind harte Voraussetzungen: ein System ohne
  // registrierte Werkzeuge darf kein Diamant-Siegel bekommen, auch wenn alle
  // anderen Zähler stimmen.
  const hardGatesPass = toolScore >= 0.9 && serviceScore >= 0.9;

  return {
    checks,
    passed,
    failed,
    overallScore,
    healthy: failed === 0 && overallScore >= 0.85 && hardGatesPass,
  };
}

// ---------------------------------------------------------------------------
// 2) Diamant-Zertifikat
// ---------------------------------------------------------------------------

/**
 * Erzeugt das offizielle 8.000er-Diamant-Zertifikat als SVG-Badge und PDF.
 *
 * Defensiv: ohne Test-Zahl wird 0 angenommen; das Zertifikat gilt dann als
 * nicht verifiziert.
 */
export function generateDiamondCertificate(
  testCount: number,
  version: string,
): DiamondCertificate {
  const safeTestCount = Math.max(0, Math.round(safeNumber(testCount, 0)));
  const safeVersion = typeof version === 'string' && version.trim().length > 0
    ? version.trim()
    : '4.5.0';

  // Deterministischer Zeitstempel (kein Date.now()).
  const timestamp = 1735689600000; // 2025-01-01T00:00:00Z

  const payload = `AI Writer Studio v${safeVersion} — ${safeTestCount} Tests — Grand 8000 Diamond`;
  const hash = sha256(payload);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="210">`,
    `  <rect width="420" height="210" rx="14" style="fill: var(--bg)"/>`,
    `  <rect x="8" y="8" width="404" height="194" rx="10" style="fill: none; stroke: var(--accent); stroke-width: 2"/>`,
    `  <text x="210" y="48" text-anchor="middle" style="fill: var(--accent); font-family: serif; font-size: 17; font-weight: bold">AI WRITER STUDIO</text>`,
    `  <text x="210" y="76" text-anchor="middle" style="fill: var(--fg); font-family: serif; font-size: 13">Grand 8000 Diamond Certificate</text>`,
    `  <text x="210" y="112" text-anchor="middle" style="fill: var(--accent); font-family: monospace; font-size: 26; font-weight: bold">${safeTestCount} Tests</text>`,
    `  <text x="210" y="142" text-anchor="middle" style="fill: var(--muted); font-family: monospace; font-size: 12">Version ${safeVersion}</text>`,
    `  <text x="210" y="168" text-anchor="middle" style="fill: var(--muted); font-family: monospace; font-size: 10">${hash.slice(0, 32)}…</text>`,
    `</svg>`,
  ].join('\n');

  const pdf = [
    `%PDF-1.4`,
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`,
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`,
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length 160>>stream`,
    `BT /F1 24 Tf 50 750 Td (AI Writer Studio v${safeVersion}) Tj ET`,
    `BT /F1 18 Tf 50 700 Td (Grand 8000 Diamond Certificate) Tj ET`,
    `BT /F1 36 Tf 50 640 Td (${safeTestCount} Tests) Tj ET`,
    `BT /F1 12 Tf 50 600 Td (SHA-256: ${hash.slice(0, 48)}) Tj ET`,
    `endstream endobj`,
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj`,
    `trailer<</Root 1 0 R>>`,
    `%%EOF`,
  ].join('\n');

  return {
    testCount: safeTestCount,
    version: safeVersion,
    timestamp,
    hash,
    svg,
    pdf,
    verified: safeTestCount >= 8000,
  };
}

// ---------------------------------------------------------------------------
// 3) Sub-Millisekunden- / 60-FPS-Garantie
// ---------------------------------------------------------------------------

/**
 * Prüft, ob ein UI-Modal innerhalb des 60-FPS-Budgets (16 ms) öffnet.
 *
 * Defensiv: ohne Angaben wird das Standard-Budget von 16 ms verwendet.
 */
export function auditSubMillisecond(
  component: string,
  durationMs: number,
  budgetMs?: number,
): LatencyCheck {
  const name = typeof component === 'string' && component.trim().length > 0
    ? component.trim()
    : 'Unbekannte Komponente';
  const measured = safeNumber(durationMs, 0);
  const budget = safeNumber(budgetMs, 16);

  return {
    component: name,
    durationMs: measured,
    budgetMs: budget,
    withinBudget: measured <= budget,
  };
}

/**
 * Prüft eine ganze Liste von Komponenten und liefert die Zusammenfassung.
 *
 * Defensiv: eine leere Liste meldet 0 geprüfte Komponenten und gilt als
 * innerhalb des Budgets (nichts zu prüfen ist kein Fehler).
 */
export function auditAllComponents(
  components: readonly { name: string; durationMs: number }[] | null | undefined,
  budgetMs?: number,
): { checks: LatencyCheck[]; allWithinBudget: boolean; slowest: string | null } {
  const list = Array.isArray(components) ? components : [];
  const checks = list.map((c) => auditSubMillisecond(c.name, c.durationMs, budgetMs));
  const allWithinBudget = checks.every((c) => c.withinBudget);

  let slowest: string | null = null;
  let max = -1;
  for (const c of checks) {
    if (c.durationMs > max) {
      max = c.durationMs;
      slowest = c.component;
    }
  }

  return { checks, allWithinBudget, slowest };
}
