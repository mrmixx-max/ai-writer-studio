/**
 * Masterpiece-Seal-Service — WP 49.2 (6.000-Tests-Meisterwerk-Siegel)
 *
 * Lokaler, deterministischer Service zur Überwachung des Ökosystems
 * (SQLite-Tabellen, Caching, i18n, Bundle-Latenzen) und zum Erzeugen
 * eines kryptografischen Jubiläums-Zertifikats mit SVG-Siegel.
 * Keine LLM-Aufrufe.
 */

// Browser-kompatible SHA-256/HMAC-Implementierung (kein node:crypto nötig).

function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash = (sha256 as unknown as { h: number[] }).h || [];
  const k = (sha256 as unknown as { k: number[] }).k || [];
  let primeCounter = k.length;
  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function hmacSha256(key: string, message: string): string {
  const blockSize = 64;
  let keyBytes = Array.from(key).map((c) => c.charCodeAt(0));
  if (keyBytes.length > blockSize) {
    keyBytes = Array.from(sha256(key)).map((c) => parseInt(c, 16));
  }
  while (keyBytes.length < blockSize) keyBytes.push(0);
  const ipad = keyBytes.map((b) => b ^ 0x36);
  const opad = keyBytes.map((b) => b ^ 0x5c);
  const msgBytes = Array.from(message).map((c) => c.charCodeAt(0));
  const inner = sha256(
    String.fromCharCode(...ipad) + String.fromCharCode(...msgBytes),
  );
  return sha256(String.fromCharCode(...opad) + inner);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TableHealth {
  name: string;
  rowCount: number;
  sizeBytes: number;
  status: 'ok' | 'degraded' | 'critical';
}

export interface HealthScanResult {
  tables: TableHealth[];
  cacheStatus: 'ok' | 'degraded' | 'critical';
  i18nCompleteness: number;
  bundleLatencyMs: number;
  overallStatus: 'ok' | 'degraded' | 'critical';
  timestamp: number;
}

export interface SealCertificate {
  id: string;
  testCount: number;
  version: string;
  timestamp: number;
  hash: string;
  signature: string;
  issuer: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const CACHE_HIT_THRESHOLD = 0.85;
const CACHE_CRITICAL_THRESHOLD = 0.5;
const I18N_COMPLETENESS_THRESHOLD = 0.9;
const BUNDLE_LATENCY_BUDGET_MS = 20;
const BUNDLE_LATENCY_DEGRADED_MS = 50;

// ─── Interne Helfer ──────────────────────────────────────────────────────────

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function computeSha256(data: string): string {
  try {
    return sha256(data);
  } catch {
    // Fallback: einfacher deterministischer Hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

function computeHmac(data: string, key: string): string {
  try {
    return hmacSha256(key, data);
  } catch {
    // Fallback: einfacher deterministischer HMAC-artiger Hash
    let hash = 0;
    const combined = `${key}:${data}`;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Führt einen Audit über SQLite-Tabellen, Caching, i18n und Bundle-Latenzen durch.
 * Simuliert realistische Werte deterministisch.
 */
export function runEcosystemHealthScan(): HealthScanResult {
  const timestamp = Date.now();

  // Simuliere SQLite-Tabellen mit realistischen Größen
  const tables: TableHealth[] = [
    {
      name: 'chapters',
      rowCount: 128,
      sizeBytes: 2_457_600,
      status: 'ok',
    },
    {
      name: 'characters',
      rowCount: 64,
      sizeBytes: 1_048_576,
      status: 'ok',
    },
    {
      name: 'notes',
      rowCount: 256,
      sizeBytes: 4_194_304,
      status: 'ok',
    },
    {
      name: 'settings',
      rowCount: 12,
      sizeBytes: 8_192,
      status: 'ok',
    },
  ];

  // Simuliere Cache-Status
  const cacheHitRatio = 0.92;
  let cacheStatus: 'ok' | 'degraded' | 'critical' = 'ok';
  if (cacheHitRatio < CACHE_CRITICAL_THRESHOLD) {
    cacheStatus = 'critical';
  } else if (cacheHitRatio < CACHE_HIT_THRESHOLD) {
    cacheStatus = 'degraded';
  }

  // i18n-Vollständigkeit: 4 Sprachen (de, en, es, fr)
  const i18nCompleteness = 0.95;

  // Bundle-Latenz: simuliert < 20 ms
  const bundleLatencyMs = 12;

  // Gesamtstatus berechnen
  let overallStatus: 'ok' | 'degraded' | 'critical' = 'ok';
  if (
    cacheStatus === 'critical' ||
    i18nCompleteness < I18N_COMPLETENESS_THRESHOLD ||
    bundleLatencyMs > BUNDLE_LATENCY_DEGRADED_MS ||
    tables.some((t) => t.status === 'critical')
  ) {
    overallStatus = 'critical';
  } else if (
    cacheStatus === 'degraded' ||
    bundleLatencyMs > BUNDLE_LATENCY_BUDGET_MS ||
    tables.some((t) => t.status === 'degraded')
  ) {
    overallStatus = 'degraded';
  }

  return {
    tables,
    cacheStatus,
    i18nCompleteness,
    bundleLatencyMs,
    overallStatus,
    timestamp,
  };
}

/**
 * Erzeugt ein kryptografisches Jubiläums-Zertifikat.
 */
export function generateSealCertificate(testCount: number, version: string): SealCertificate {
  const safeTestCount = Math.max(0, Math.floor(safeNumber(testCount, 0)));
  const safeVersion = safeString(version, '0.0.0');
  const timestamp = Date.now();
  const issuer = 'ai-writer-studio';

  // SHA-256-Hash aus testCount + version + timestamp
  const hashInput = `${safeTestCount}:${safeVersion}:${timestamp}`;
  const hash = computeSha256(hashInput);

  // HMAC-artige Signatur aus hash + issuer
  const signature = computeHmac(hash, issuer);

  // Eindeutige ID
  const id = computeSha256(`${hashInput}:${signature}`).slice(0, 16);

  return {
    id,
    testCount: safeTestCount,
    version: safeVersion,
    timestamp,
    hash,
    signature,
    issuer,
  };
}

/**
 * Erzeugt ein SVG-Siegel für das Zertifikat.
 */
export function generateSealSvg(certificate: SealCertificate): string {
  const safeCert = certificate ?? ({} as SealCertificate);
  const testCount = Math.max(0, Math.floor(safeNumber(safeCert.testCount, 0)));
  const version = safeString(safeCert.version, '0.0.0');
  const hash = safeString(safeCert.hash, '');
  const issuer = safeString(safeCert.issuer, 'ai-writer-studio');

  const shortHash = hash.slice(0, 8);
  const verified = testCount >= 6000;
  const statusColor = verified ? '#10b981' : '#f59e0b';
  const statusText = verified ? 'VERIFIED' : 'PENDING';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="95" fill="url(#sealGrad)" stroke="${statusColor}" stroke-width="3"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="${statusColor}" stroke-width="1" stroke-dasharray="4 2"/>
  <text x="100" y="50" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="monospace">MASTERPIECE</text>
  <text x="100" y="70" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="monospace">SEAL</text>
  <text x="100" y="100" text-anchor="middle" fill="#ffffff" font-size="24" font-weight="bold" font-family="monospace">${testCount}</text>
  <text x="100" y="120" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="monospace">TESTS</text>
  <text x="100" y="140" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="monospace">v${version}</text>
  <text x="100" y="160" text-anchor="middle" fill="${statusColor}" font-size="8" font-family="monospace">${statusText}</text>
  <text x="100" y="175" text-anchor="middle" fill="#64748b" font-size="6" font-family="monospace">${shortHash}</text>
  <text x="100" y="188" text-anchor="middle" fill="#64748b" font-size="6" font-family="monospace">${issuer}</text>
</svg>`;
}

/**
 * Verifiziert das Zertifikat durch Neuberechnung von Hash und Signatur.
 */
export function verifySeal(certificate: SealCertificate): boolean {
  if (!certificate || typeof certificate !== 'object') {
    return false;
  }

  const testCount = Math.max(0, Math.floor(safeNumber(certificate.testCount, 0)));
  const version = safeString(certificate.version, '');
  const timestamp = Math.max(0, Math.floor(safeNumber(certificate.timestamp, 0)));
  const issuer = safeString(certificate.issuer, '');
  const hash = safeString(certificate.hash, '');
  const signature = safeString(certificate.signature, '');

  if (!hash || !signature || !issuer) {
    return false;
  }

  // Hash neu berechnen
  const hashInput = `${testCount}:${version}:${timestamp}`;
  const expectedHash = computeSha256(hashInput);

  if (hash !== expectedHash) {
    return false;
  }

  // Signatur neu berechnen
  const expectedSignature = computeHmac(hash, issuer);

  return signature === expectedSignature;
}
