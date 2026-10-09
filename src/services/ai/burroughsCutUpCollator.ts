// burroughsCutUpCollator.ts (WP 125.2, Meilenstein 60.0 / v7.2.0)
// Burroughs Cut-Up Montage- & Collage-Studio für experimentelle Prosa.
//
// Deterministisch: alle Zufallsentscheidungen laufen über mulberry32, gesät
// mit FNV-1a-Hashes. Gleicher Seed ⇒ gleiches Ergebnis. Keine IO, keine
// Zeitstempel, keine node:-Module (browser-kompatibel).
//
// Aufbau:
//   WP 125.2.1  Multi-Quellen-Zerschneider (CUT_PATTERNS, cutUpText)
//   WP 125.2.2  Grammatik-Politur             (polishCutUp)
//   WP 125.2.3  Kollagen-Export               (buildCollage, coverSvg)

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Schnittmuster für den Multi-Quellen-Zerschneider. */
export interface CutPattern {
  id: string;
  name: string;
  description: string;
  bandCount: number;
}

/** Ergebnis eines Cut-Up-Schnitts. */
export interface CutUpResult {
  segments: string[];
  pattern: string;
  sourceLength: number;
  foreignLength: number;
}

/** Ergebnis der Grammatik-Politur. */
export interface PolishResult {
  text: string;
  smoothness: number; // 0–100
  breathless: boolean;
}

/** Eine fertige Collage inklusive Umschlag-SVG. */
export interface Collage {
  title: string;
  segments: string[];
  polishedText: string;
  smoothness: number;
  coverSvg: string;
}

// ---------------------------------------------------------------------------
// WP 125.2.1 — Schnittmuster
// ---------------------------------------------------------------------------

/**
 * Die drei Schnittmuster des Zerschneiders.
 * - quadrant:  vier Bänder je Quelle, abwechselnd verschränkt (Schachbrett).
 * - diagonal:  die Fremdquelle läuft rückwärts gegen den Eigenfluss.
 * - threeWord: Dreiwort-Bänder; Fremdbänder werden deterministisch gewürfelt.
 */
export const CUT_PATTERNS = [
  {
    id: "quadrant",
    name: "4-Quadranten-Schnitt",
    description:
      "Zerteilt beide Quellen in vier Bänder und verschränkt sie abwechselnd zu einem Schachbrett-Montagefluss.",
    bandCount: 4,
  },
  {
    id: "diagonal",
    name: "Diagonalschnitt",
    description:
      "Zwei Dreieckshälften: die Fremdquelle läuft der eigenen rückwärts entgegen und kreuzt sie auf der Diagonale.",
    bandCount: 2,
  },
  {
    id: "threeWord",
    name: "3-Wort-Bänder",
    description:
      "Schneidet in Dreiwort-Bänder und würfelt die Fremdbänder deterministisch durch den Eigenfluss.",
    bandCount: 3,
  },
] as const;

export type CutPatternId = (typeof CUT_PATTERNS)[number]["id"];

// ---------------------------------------------------------------------------
// Deterministische Zufallsbasis (FNV-1a + mulberry32)
// ---------------------------------------------------------------------------

/** FNV-1a-Hash; gibt eine vorzeichenlose 32-Bit-Zahl zurück. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  const str = input ?? "";
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32-PRNG; gibt Werte in [0, 1) zurück. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
  };
}

/** Wählt ein Element deterministisch; wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) {
    throw new Error("pick: leeres Array kann kein Element liefern");
  }
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

/** Deterministisches Fisher-Yates-Mischen (arbeitet auf einer Kopie). */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// WP 125.2.1 — Multi-Quellen-Zerschneider
// ---------------------------------------------------------------------------

function resolvePattern(patternId: string): CutPattern {
  const found = CUT_PATTERNS.find((p) => p.id === patternId);
  return found ? { ...found } : { ...CUT_PATTERNS[0] };
}

/** Zerlegt einen Text gemäß Muster in Bänder (Dreiwort-Bänder bei threeWord). */
function splitIntoBands(text: string, pattern: CutPattern): string[] {
  const words = (text ?? "").split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  if (pattern.id === "threeWord") {
    const bands: string[] = [];
    for (let i = 0; i < words.length; i += 3) {
      bands.push(words.slice(i, i + 3).join(" "));
    }
    return bands;
  }

  const bandCount = Math.max(1, pattern.bandCount);
  const per = Math.max(1, Math.ceil(words.length / bandCount));
  const bands: string[] = [];
  for (let i = 0; i < words.length; i += per) {
    bands.push(words.slice(i, i + per).join(" "));
  }
  return bands;
}

/**
 * Zerschneidet Eigen- und Fremdquelle nach dem Muster und verschränkt die
 * Bänder zu einer Montage-Sequenz. Deterministisch bei gleichem Seed.
 */
export function cutUpText(
  sourceText: string,
  foreignText: string,
  patternId: string,
  seed: number
): CutUpResult {
  const pattern = resolvePattern(patternId);
  const rng = createSeededRandom(hashString(`${pattern.id}|${seed}`));

  const sourceBands = splitIntoBands(sourceText, pattern);
  let foreignBands = splitIntoBands(foreignText, pattern);

  if (pattern.id === "diagonal") {
    foreignBands = [...foreignBands].reverse();
  } else if (pattern.id === "threeWord") {
    foreignBands = shuffle(foreignBands, rng);
  }

  const segments: string[] = [];
  const maxLen = Math.max(sourceBands.length, foreignBands.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < sourceBands.length) segments.push(sourceBands[i]);
    if (i < foreignBands.length) segments.push(foreignBands[i]);
  }

  return {
    segments,
    pattern: pattern.id,
    sourceLength: (sourceText ?? "").length,
    foreignLength: (foreignText ?? "").length,
  };
}

// ---------------------------------------------------------------------------
// WP 125.2.2 — Grammatik-Politur
// ---------------------------------------------------------------------------

/** Verbinder, die die Bruchkanten zwischen den Bändern glätten. */
const CONNECTORS = [" — ", ", ", " und ", " dann ", " während ", " worauf ", " wie "];

/**
 * Glättet die Bruchkanten der Segmente zu rhythmischer, atemloser Prosa,
 * bewahrt dabei aber die surrealen Traumbilder.
 * Deterministisch bei gleichem Seed.
 */
export function polishCutUp(segments: string[], seed: number): PolishResult {
  const clean = (segments ?? []).map((s) => (s ?? "").trim()).filter((s) => s.length > 0);

  const rng = createSeededRandom(hashString(`polish|${seed}|${clean.length}`));

  if (clean.length === 0) {
    return { text: "", smoothness: 0, breathless: false };
  }

  const parts: string[] = [clean[0]];
  for (let i = 1; i < clean.length; i++) {
    const connector = pick(CONNECTORS, rng);
    // Kleinschreibung des Bandanfangs glättet den Schnitt zu einem Fluss.
    parts.push(connector + lowerFirst(clean[i]));
  }

  let text = parts.join("").replace(/\s+/g, " ").trim();
  if (!/[.!?…]$/.test(text)) text += ".";

  const totalWords = clean.reduce(
    (n, s) => n + s.split(/\s+/).filter((w) => w.length > 0).length,
    0
  );
  const avgWords = totalWords / clean.length;
  const flowBonus = Math.min(1, avgWords / 16); // 16+ Wörter/Band = voll fließend
  const jitter = rng(); // deterministisch
  const smoothness = Math.round(clamp(flowBonus * 85 + jitter * 15, 0, 100));

  // Kurze, abgehackte Bänder ⇒ atemlos; längere Bänder atmen.
  const breathless = smoothness < 55;

  return { text, smoothness, breathless };
}

// ---------------------------------------------------------------------------
// WP 125.2.3 — Kollagen-Export
// ---------------------------------------------------------------------------

function stripWord(word: string): string {
  return word.replace(/[^A-Za-zÄÖÜäöüß0-9-]/g, "");
}

/** Baut einen deterministischen Collage-Titel aus markanten Quellwörtern. */
function buildTitle(sourceText: string, foreignText: string, seed: number): string {
  const rng = createSeededRandom(hashString(`title|${seed}`));
  const words = `${sourceText ?? ""} ${foreignText ?? ""}`
    .split(/\s+/)
    .map(stripWord)
    .filter((w) => w.length > 4);

  if (words.length === 0) {
    return "Stille Collage";
  }

  const first = capitalize(pick(words, rng));
  let second = capitalize(pick(words, rng));
  let guard = 0;
  while (second === first && words.length > 1 && guard < 8) {
    second = capitalize(pick(words, rng));
    guard++;
  }

  return `${first} ${second} — eine Cut-Up-Collage`;
}

function escapeXml(text: string): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Erzeugt ein eigenständiges, deterministisches Collage-Umschlag-SVG. */
function buildCoverSvg(
  title: string,
  segments: string[],
  pattern: CutPattern,
  seed: number
): string {
  const rng = createSeededRandom(hashString(`cover|${pattern.id}|${seed}|${segments.length}`));

  const backgrounds = ["var(--bg)", "var(--panel)", "var(--bg)", "var(--panel)", "var(--bg)"];
  const accents = ["var(--accent)", "var(--muted)", "var(--accent)", "var(--muted)", "var(--accent)"];

  const bg = pick(backgrounds, rng);
  const accent = pick(accents, rng);
  const ink = "var(--fg)";

  const W = 600;
  const H = 800;

  // Bis zu sechs Bänder als Collage-Streifen.
  const bandCount = Math.min(6, Math.max(1, segments.length));
  const bandHeight = Math.round((H - 260) / bandCount);
  const bands: string[] = [];
  for (let i = 0; i < bandCount; i++) {
    const seg = segments[i] ?? "";
    const snippet = escapeXml(seg.length > 44 ? seg.slice(0, 41) + "…" : seg);
    const y = 240 + i * bandHeight + Math.round(bandHeight / 2) + 4;
    const rotate = Math.round((rng() * 2 - 1) * 6);
    bands.push(
      `  <text x="40" y="${y}" font-size="15" fill="${ink}" opacity="0.82" ` +
        `transform="rotate(${rotate} 40 ${y})">${snippet}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Georgia, serif;">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${accent}" stroke-width="2"/>
  <rect x="20" y="20" width="${W - 40}" height="180" fill="${accent}" opacity="0.12"/>
  <text x="40" y="70" font-size="13" fill="${accent}" letter-spacing="3">BURROUGHS CUT-UP</text>
  <text x="40" y="118" font-size="30" font-weight="bold" fill="${ink}">${escapeXml(title)}</text>
  <text x="40" y="150" font-size="13" fill="${accent}">${escapeXml(pattern.name)}</text>
  <text x="40" y="174" font-size="11" fill="${ink}" opacity="0.6">Seed ${seed} · ${segments.length} Segmente</text>
${bands.join("\n")}
  <line x1="40" y1="${H - 70}" x2="${W - 40}" y2="${H - 70}" stroke="${accent}" stroke-width="1" opacity="0.6"/>
  <text x="40" y="${H - 44}" font-size="11" fill="${ink}" opacity="0.7">Montage aus Eigen- und Fremdquelle</text>
</svg>`;
}

/**
 * Baut eine vollständige Collage: Schnitt → Politur → Titel → Umschlag.
 * Deterministisch bei gleichem Seed.
 */
export function buildCollage(
  sourceText: string,
  foreignText: string,
  patternId: string,
  seed: number
): Collage {
  const pattern = resolvePattern(patternId);
  const cut = cutUpText(sourceText, foreignText, pattern.id, seed);
  const polished = polishCutUp(cut.segments, seed);
  const title = buildTitle(sourceText, foreignText, seed);
  const coverSvg = buildCoverSvg(title, cut.segments, pattern, seed);

  return {
    title,
    segments: cut.segments,
    polishedText: polished.text,
    smoothness: polished.smoothness,
    coverSvg,
  };
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Liefert eine frische Kopie des Standard-Schnittmusters (4-Quadranten). */
export function createSampleCutPattern(): CutPattern {
  return { ...CUT_PATTERNS[0] };
}

/** Baut eine vollständige Beispiel-Collage aus deutschen Quelltexten. */
export function createSampleCollage(): Collage {
  const source =
    "Der Traum öffnet seine Augen über der Stadt und die Uhr im Nebel " +
    "schlägt dreizehnmal gegen das Fenster während die Vögel schweigen.";
  const foreign =
    "Ein Spiegel zerbricht in der Hand des Fremden und der Schatten " +
    "liest eine Nachricht die niemand geschrieben hat im Sturm.";
  return buildCollage(source, foreign, "quadrant", 1252);
}
