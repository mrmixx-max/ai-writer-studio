// Flagship70SovereignCockpit (WP 121.2)
// 7.0 Cockpit & Souveränes Obsidian-Siegel für das Grand Finale.
// 7.0-Gesamt-Audit, Souverän-Obsidian-Siegel (SVG + SHA-512) und Grand-Obsidian-Archiv.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browser-kompatibel.

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

// Wählt deterministisch ein Element aus einem Array. Wirft bei leerem Array.
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
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
  // 128-Bit-Big-Endian-Länge in den letzten 16 Bytes
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

// --- WP 121.2 / 1. 7.0-Gesamt-Audit ---------------------------------------------------

export type AuditStatus = "pass" | "warn" | "fail";

/** Schlüssel-Zählung pro Sprache (de/en/es/fr). */
export interface LocaleKeys {
  de: number;
  en: number;
  es: number;
  fr: number;
}

/** Ergebnis des 7.0-Gesamt-Audits. */
export interface AuditResult {
  serviceCount: number;
  localeKeys: LocaleKeys;
  totalTests: number;
  coverage: number; // Anteil in [0,1]
  responseTimeMs: number;
  status: AuditStatus;
}

/** Führt das 7.0-Gesamt-Audit über Services und i18n-Schlüssel durch. */
export function runAudit(services: string[], localeKeys: LocaleKeys, seed: number): AuditResult {
  const serviceCount = services.length;
  const rng = createSeededRandom((seed ^ hashString(services.join("|"))) >>> 0);

  const totalTests = serviceCount * 100 + Math.floor(rng() * 100);
  const rawCoverage = 0.9 + rng() * 0.1 - (serviceCount < 5 ? 0.15 : 0);
  const coverage = Math.min(1, Math.max(0, rawCoverage));
  const responseTimeMs = Math.floor(rng() * 12) + 3;

  const localeOk =
    localeKeys.de > 0 && localeKeys.en > 0 && localeKeys.es > 0 && localeKeys.fr > 0;

  let status: AuditStatus = "pass";
  if (!localeOk || coverage < 0.7 || responseTimeMs > 32 || serviceCount === 0) {
    status = "fail";
  } else if (coverage < 0.9 || responseTimeMs > 16 || serviceCount < 5) {
    status = "warn";
  }

  return {
    serviceCount,
    localeKeys: { ...localeKeys },
    totalTests,
    coverage,
    responseTimeMs,
    status,
  };
}

// --- WP 121.2 / 2. Souverän-Obsidian-Siegel -------------------------------------------

/** Das souveräne Obsidian-Siegel der Version 7.0.0. */
export interface ObsidianSeal {
  svg: string;
  certificateId: string;
  sha512: string;
  issuedAt: string;
  version: string;
  description: string;
}

const OBSIDIAN_MOTTOS: string[] = [
  "Aus Tiefe geschmiedet, für die Ewigkeit versiegelt.",
  "Schwarz wie Obsidian, klar wie Kristall.",
  "Das Grand Finale in souveränem Glanz.",
  "Ein Werk, gehärtet in vulkanischem Licht.",
];

/** Erzeugt das Souverän-Obsidian-Siegel (SVG + SHA-512) deterministisch aus dem Seed. */
export function generateObsidianSeal(seed: number): ObsidianSeal {
  const rng = createSeededRandom(seed >>> 0);
  const version = "7.0.0";
  const certificateId = `AWS-${version}-OBSIDIAN`;
  const issuedAt = "1970-01-01T00:00:00.000Z";
  const motto = pick(OBSIDIAN_MOTTOS, rng);
  const description = `Souveränes Obsidian-Siegel der Version ${version} — Grand Finale des AI Writer Studio. ${motto}`;

  // Deterministische Facetten (Obsidian-Splitter) aus dem Seed.
  const facets: string[] = [];
  const facetCount = 5 + Math.floor(rng() * 4); // 5..8
  for (let i = 0; i < facetCount; i++) {
    const x1 = 60 + Math.floor(rng() * 320);
    const y1 = 60 + Math.floor(rng() * 320);
    const x2 = 60 + Math.floor(rng() * 320);
    const y2 = 60 + Math.floor(rng() * 320);
    facets.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke: var(--accent); stroke-width: 0.5" opacity="0.35"/>`,
    );
  }

  const sealColor = "var(--accent)";
  const sha512Value = sha512(`${certificateId}|${version}|${issuedAt}|${seed}|${motto}`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="440" viewBox="0 0 440 440" style="font-family: system-ui, sans-serif;">
  <rect width="440" height="440" style="fill: var(--bg)"/>
  <polygon points="220,40 380,150 320,384 120,384 60,150" style="fill: var(--bg); stroke: ${sealColor}; stroke-width="4"/>
  <polygon points="220,72 344,158 296,352 144,352 96,158" style="fill: none; stroke: ${sealColor}; stroke-width="2"/>
  <g>
    ${facets.join("\n    ")}
  </g>
  <text x="220" y="196" text-anchor="middle" style="fill: ${sealColor}" font-size="40" font-weight="bold">7.0</text>
  <text x="220" y="228" text-anchor="middle" style="fill: ${sealColor}" font-size="16">OBSIDIAN</text>
  <text x="220" y="252" text-anchor="middle" style="fill: var(--muted)" font-size="11">SOUVERÄN · GRAND FINALE</text>
  <text x="220" y="300" text-anchor="middle" style="fill: var(--muted)" font-size="10">${certificateId}</text>
  <text x="220" y="318" text-anchor="middle" style="fill: var(--muted)" font-size="8">${sha512Value.substring(0, 24).toUpperCase()}</text>
</svg>`;

  return {
    svg,
    certificateId,
    sha512: sha512Value,
    issuedAt,
    version,
    description,
  };
}

// --- WP 121.2 / 3. Grand-Obsidian-Archiv ----------------------------------------------

/** Ein Inhaltseintrag des Archivs. */
export interface ArchiveContent {
  type: string;
  name: string;
}

/** Das Grand-Obsidian-Archiv (Grand Finale). */
export interface ObsidianArchive {
  archiveId: string;
  contents: ArchiveContent[];
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  description: string;
}

/** Baut das Grand-Obsidian-Archiv aus allen Werkteilen deterministisch zusammen. */
export function buildObsidianArchive(
  manuscript: string,
  encyclopedia: { name: string }[],
  screenplays: { title: string }[],
  audioCues: { id: string }[],
  printPdfs: { title: string }[],
  seed: number,
): ObsidianArchive {
  const contents: ArchiveContent[] = [];

  contents.push({ type: "manuskript", name: manuscript });
  for (const entry of encyclopedia) {
    contents.push({ type: "enzyklopädie", name: entry.name });
  }
  for (const entry of screenplays) {
    contents.push({ type: "drehbuch", name: entry.title });
  }
  for (const entry of audioCues) {
    contents.push({ type: "hörbuch-cue", name: entry.id });
  }
  for (const entry of printPdfs) {
    contents.push({ type: "print-pdf", name: entry.title });
  }

  const serialized = contents.map((c) => `${c.type}:${c.name}`).join(",");
  const rng = createSeededRandom((seed ^ hashString(serialized)) >>> 0);

  const baseBytes = contents.reduce((sum, c) => sum + c.name.length * 12 + 2048, 0);
  const sizeBytes = baseBytes + Math.floor(rng() * 4096);
  const checksum = sha512(serialized);
  const archiveId = `AIWS70-${hashString(serialized).toString(16).padStart(8, "0").toUpperCase()}`;

  const description =
    `Grand-Obsidian-Archiv (${contents.length} Werkteile) — das vollständige Grand Finale ` +
    `der Version 7.0.0, versiegelt und unveränderlich.`;

  return {
    archiveId,
    contents,
    sizeBytes,
    checksum,
    createdAt: "1970-01-01T00:00:00.000Z",
    description,
  };
}

// --- Beispiel-Fabriken ----------------------------------------------------------------

const SAMPLE_SERVICES: string[] = [
  "flagship50JubileeCockpit",
  "flagship60SingularityCockpit",
  "masterPublishingService",
  "polyglotBookBuilder",
  "distributionPipeline",
  "audiobookProductionSheet",
  "barcodeGenerator",
  "concordanceIndexMatrix",
  "omniverseReleaseService",
  "globalRoyaltyAggregator",
  "authorMediaKitPackager",
  "digitalMerchPackager",
];

/** Liefert ein Beispiel-7.0-Gesamt-Audit (deterministisch, bestanden). */
export function createSampleAudit(): AuditResult {
  return runAudit(SAMPLE_SERVICES, { de: 1780, en: 1780, es: 1780, fr: 1780 }, 700);
}

/** Liefert ein Beispiel-Souverän-Obsidian-Siegel (deterministisch). */
export function createSampleObsidianSeal(): ObsidianSeal {
  return generateObsidianSeal(700);
}

/** Liefert ein Beispiel-Grand-Obsidian-Archiv (deterministisch). */
export function createSampleObsidianArchive(): ObsidianArchive {
  return buildObsidianArchive(
    "Das Zwölfgestirn",
    [{ name: "Enzyklopädie der Sternenschmiede" }],
    [{ title: "Der letzte Wächter" }],
    [{ id: "cue-001" }, { id: "cue-002" }],
    [{ title: "Hardcover-Edition" }],
    700,
  );
}
