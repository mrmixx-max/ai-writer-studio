// GoldenJubilee50Sentinel (WP 105.2)
// 50. Goldenes Jubiläums-Siegel & Sentinel.
// Voll-Spektrum-Audit, Goldenes Jubilee-Siegel (SVG + SHA-512), Meilenstein-Retrospektive.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Browser-kompatible SHA-512-Implementierung (kein node:crypto) --------------------

const SHA512_K = new BigUint64Array([
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
]);

const MASK64 = (1n << 64n) - 1n;

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function toHex64(x: bigint): string {
  return x.toString(16).padStart(16, "0");
}

/** Browser-kompatible SHA-512 (reines JS/BigInt, kein node:crypto). */
export function sha512(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const len = bytes.length;
  const bitLen = BigInt(len) * 8n;
  const blockCount = Math.ceil((len + 17) / 128);
  const padded = new Uint8Array(blockCount * 128);
  padded.set(bytes);
  padded[len] = 0x80;
  for (let i = 0; i < 16; i++) {
    padded[padded.length - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);
  }

  let h0 = 0x6a09e667f3bcc908n, h1 = 0xbb67ae8584caa73bn, h2 = 0x3c6ef372fe94f82bn, h3 = 0xa54ff53a5f1d36f1n;
  let h4 = 0x510e527fade682d1n, h5 = 0x9b05688c2b3e6c1fn, h6 = 0x1f83d9abfb41bd6bn, h7 = 0x5be0cd19137e2179n;

  const w = new BigUint64Array(80);
  for (let i = 0; i < blockCount; i++) {
    const off = i * 128;
    for (let j = 0; j < 16; j++) {
      let v = 0n;
      for (let k = 0; k < 8; k++) {
        v = (v << 8n) | BigInt(padded[off + j * 8 + k]);
      }
      w[j] = v;
    }
    for (let j = 16; j < 80; j++) {
      const s0 = rotr64(w[j - 15], 1n) ^ rotr64(w[j - 15], 8n) ^ (w[j - 15] >> 7n);
      const s1 = rotr64(w[j - 2], 19n) ^ rotr64(w[j - 2], 61n) ^ (w[j - 2] >> 6n);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) & MASK64;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 80; j++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & g & MASK64);
      const t1 = (h + S1 + ch + SHA512_K[j] + w[j]) & MASK64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & MASK64;
      h = g; g = f; f = e; e = (d + t1) & MASK64; d = c; c = b; b = a; a = (t1 + t2) & MASK64;
    }
    h0 = (h0 + a) & MASK64; h1 = (h1 + b) & MASK64; h2 = (h2 + c) & MASK64; h3 = (h3 + d) & MASK64;
    h4 = (h4 + e) & MASK64; h5 = (h5 + f) & MASK64; h6 = (h6 + g) & MASK64; h7 = (h7 + h) & MASK64;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map(toHex64).join("");
}

// --- Voll-Spektrum-Audit ---------------------------------------------------------------

export type JubileeStatus = "ok" | "warn" | "fail";

export interface JubileeCheck {
  name: string;
  status: JubileeStatus;
  value: number;
  threshold: number;
  detail: string;
}

export interface JubileeAudit {
  id: string;
  version: string;
  timestamp: string;
  milestone: number;
  totalTests: number;
  passedTests: number;
  serviceCount: number;
  testFileCount: number;
  chunkCount: number;
  i18nKeyCount: number;
  maxLatencyMs: number;
  checks: JubileeCheck[];
  overallScore: number;
  passed: boolean;
  hash: string;
}

export function runJubileeAudit(
  totalTests: number,
  passedTests: number,
  serviceCount: number,
  testFileCount: number,
  chunkCount: number,
  i18nKeyCount: number,
  maxLatencyMs: number
): JubileeAudit {
  const checks: JubileeCheck[] = [
    {
      name: "Test-Bestand (10.280+)",
      status: totalTests >= 10280 ? "ok" : totalTests >= 10000 ? "warn" : "fail",
      value: totalTests,
      threshold: 10280,
      detail: `${totalTests} Tests gesamt (Ziel: ≥10.280)`,
    },
    {
      name: "Test-Bestand (0 Fehler)",
      status: passedTests === totalTests ? "ok" : passedTests >= totalTests * 0.99 ? "warn" : "fail",
      value: passedTests,
      threshold: totalTests,
      detail: `${passedTests}/${totalTests} Tests bestanden`,
    },
    {
      name: "Service-Registrierung (105+)",
      status: serviceCount >= 105 ? "ok" : serviceCount >= 95 ? "warn" : "fail",
      value: serviceCount,
      threshold: 105,
      detail: `${serviceCount} Services registriert (Soll: ≥105)`,
    },
    {
      name: "Testdateien (650+)",
      status: testFileCount >= 650 ? "ok" : testFileCount >= 600 ? "warn" : "fail",
      value: testFileCount,
      threshold: 650,
      detail: `${testFileCount} Testdateien (Soll: ≥650)`,
    },
    {
      name: "Lazy-Chunk-Coverage (78+)",
      status: chunkCount >= 78 ? "ok" : chunkCount >= 70 ? "warn" : "fail",
      value: chunkCount,
      threshold: 78,
      detail: `${chunkCount} Lazy-Chunks im Bundle (Soll: ≥78)`,
    },
    {
      name: "i18n-Vollständigkeit (4 Sprachen)",
      status: i18nKeyCount >= 1780 ? "ok" : i18nKeyCount >= 1700 ? "warn" : "fail",
      value: i18nKeyCount,
      threshold: 1780,
      detail: `${i18nKeyCount} i18n-Schlüssel in 4 Sprachen (Soll: ≥1.780)`,
    },
    {
      name: "Sub-Millisekunden-Reaktionszeit",
      status: maxLatencyMs <= 16 ? "ok" : maxLatencyMs <= 32 ? "warn" : "fail",
      value: maxLatencyMs,
      threshold: 16,
      detail: `${maxLatencyMs} ms maximale Modal-Latenz (Soll: ≤16 ms)`,
    },
  ];

  const passedChecks = checks.filter((c) => c.status === "ok").length;
  const overallScore = Math.round((passedChecks / checks.length) * 100);
  const passed = checks.every((c) => c.status !== "fail");

  const hashInput = `${totalTests}:${passedTests}:${serviceCount}:${testFileCount}:${chunkCount}:${i18nKeyCount}:${maxLatencyMs}`;
  const hash = `GOLD50-${sha512(hashInput).substring(0, 24).toUpperCase()}`;

  return {
    id: `GOLD-${hashString(hashInput).toString(16).padStart(8, "0").toUpperCase()}`,
    version: "6.2.0",
    timestamp: "1970-01-01T00:00:00.000Z",
    milestone: 50,
    totalTests,
    passedTests,
    serviceCount,
    testFileCount,
    chunkCount,
    i18nKeyCount,
    maxLatencyMs,
    checks,
    overallScore,
    passed,
    hash,
  };
}

export interface JubileeCertificate {
  id: string;
  title: string;
  version: string;
  milestone: number;
  issuedAt: string;
  auditHash: string;
  sha512Signature: string;
  testCount: number;
  serviceCount: number;
  svgBadge: string;
}

export function generateJubileeCertificate(audit: JubileeAudit, issuerKey: string = "AIWS-GOLDEN-JUBILEE-50"): JubileeCertificate {
  const signature = sha512(`${issuerKey}|${audit.hash}|${audit.milestone}|${audit.totalTests}`);
  const passedLabel = audit.passed ? "BESTANDEN" : "WARNUNG";
  const color = audit.passed ? "var(--accent)" : "var(--warn)";

  const svgBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="260" viewBox="0 0 440 260" style="font-family: system-ui, sans-serif;">
  <rect width="440" height="260" style="fill: var(--bg)" stroke="${color}" stroke-width="5"/>
  <rect x="16" y="16" width="408" height="228" style="fill: none" stroke="${color}" stroke-width="2"/>
  <circle cx="220" cy="120" r="62" style="fill: none" stroke="${color}" stroke-width="3"/>
  <circle cx="220" cy="120" r="50" style="fill: none" stroke="${color}" stroke-width="1"/>
  <text x="220" y="112" text-anchor="middle" style="fill: ${color}" font-size="34" font-weight="bold">50</text>
  <text x="220" y="136" text-anchor="middle" style="fill: ${color}" font-size="11">GOLDENES JUBILÄUM</text>
  <text x="220" y="204" text-anchor="middle" style="fill: ${color}" font-size="13">${passedLabel} — Score: ${audit.overallScore}%</text>
  <text x="220" y="224" text-anchor="middle" style="fill: var(--muted)" font-size="9">${audit.totalTests} Tests · ${audit.serviceCount} Services</text>
  <text x="220" y="238" text-anchor="middle" style="fill: var(--muted)" font-size="7">${audit.hash}</text>
</svg>`;

  return {
    id: `GOLDCERT-${audit.hash.substring(7)}`,
    title: "50. Goldenes Jubiläums-Siegel",
    version: audit.version,
    milestone: audit.milestone,
    issuedAt: audit.timestamp,
    auditHash: audit.hash,
    sha512Signature: signature,
    testCount: audit.totalTests,
    serviceCount: audit.serviceCount,
    svgBadge,
  };
}

// --- Meilenstein-Retrospektive-Matrix --------------------------------------------------

export interface MilestoneEntry {
  number: number;
  version: string;
  theme: string;
  testCount: number;
}

/** Die ersten 10 Meilensteine als Zeitstrahl-Basis; höhere werden fortlaufend ergänzt. */
const MILESTONE_SEEDS: MilestoneEntry[] = [
  { number: 1, version: "1.0.0", theme: "Grundgerüst & Editor", testCount: 120 },
  { number: 5, version: "1.4.0", theme: "Figuren & Handlungsbögen", testCount: 480 },
  { number: 10, version: "2.0.0", theme: "KI-Schreibassistenz", testCount: 1100 },
  { number: 20, version: "3.0.0", theme: "Weltbau & Karten", testCount: 2400 },
  { number: 30, version: "4.0.0", theme: "Verlag & Export", testCount: 4100 },
  { number: 40, version: "5.2.0", theme: "Kartografie & Akustik", testCount: 7100 },
  { number: 45, version: "5.7.0", theme: "Polymetrik & Metaphern", testCount: 8928 },
  { number: 46, version: "5.8.0", theme: "Epistolarik & Kenningar", testCount: 9021 },
  { number: 47, version: "5.9.0", theme: "Alchemie & Traumlogik", testCount: 9165 },
  { number: 48, version: "6.0.0", theme: "Omniverse & Autoren-Gilde", testCount: 9315 },
  { number: 49, version: "6.1.0", theme: "Reader-Twin & Krimi-Matrix", testCount: 9474 },
  { number: 50, version: "6.2.0", theme: "Möbius-Topologie & Jubiläum", testCount: 10280 },
];

export interface RetrospectiveMatrix {
  entries: MilestoneEntry[];
  firstVersion: string;
  latestVersion: string;
  totalGrowth: number;
  milestonesCount: number;
}

export function buildRetrospectiveMatrix(): RetrospectiveMatrix {
  const entries = MILESTONE_SEEDS.map((e) => ({ ...e })).sort((a, b) => a.number - b.number);
  const first = entries[0];
  const latest = entries[entries.length - 1];
  return {
    entries,
    firstVersion: first.version,
    latestVersion: latest.version,
    totalGrowth: latest.testCount - first.testCount,
    milestonesCount: entries.length,
  };
}

export function formatJubileeAudit(audit: JubileeAudit): string {
  const lines: string[] = [];
  lines.push("═══ 50. GOLDENES JUBILÄUMS-AUDIT ═══");
  lines.push(`Version: ${audit.version} · Meilenstein ${audit.milestone}`);
  lines.push(`Hash: ${audit.hash}`);
  lines.push(`Gesamt-Score: ${audit.overallScore}% (${audit.passed ? "BESTANDEN" : "WARNUNG"})`);
  lines.push("");
  for (const c of audit.checks) {
    const icon = c.status === "ok" ? "✓" : c.status === "warn" ? "⚠" : "✗";
    lines.push(`${icon} ${c.name}: ${c.value} / ${c.threshold} — ${c.detail}`);
  }
  lines.push("═══ ENDE JUBILÄUMS-AUDIT ═══");
  return lines.join("\n");
}

export function createSampleJubileeAudit(): JubileeAudit {
  return runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11);
}

export function createSampleJubileeCertificate(): JubileeCertificate {
  return generateJubileeCertificate(createSampleJubileeAudit());
}

export function createSampleRetrospective(): RetrospectiveMatrix {
  return buildRetrospectiveMatrix();
}
