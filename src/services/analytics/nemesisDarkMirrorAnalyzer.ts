/**
 * Nemesis Dark Mirror Resonanz-Analysator
 * Meilenstein 63.0 (v7.5.0)
 *
 * Analysiert die dunkelspiegelnde Resonanz zwischen Protagonist und Antagonist.
 * Vollständig deterministisch: derselbe Seed liefert stets dieselben Ergebnisse.
 * Browser-kompatibel, ohne node:-Module. Bezeichner auf Englisch,
 * Daten und Kommentare auf Deutsch.
 */

/* ================================================================== */
/* 1. Deterministische Basis: Hash und Zufall                          */
/* ================================================================== */

/**
 * FNV-1a-Hash über die UTF-16-Eingabe.
 * Liefert einen unsigned 32-bit-Wert.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32-Pseudozufallsgenerator.
 * Liefert Werte im Halbintervall [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wählt ein Element aus einem Array.
 * Wirft einen Fehler, sobald das Array leer ist.
 */
function pick<T>(items: T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('pick() erwartet ein nicht-leeres Array.');
  }
  return items[Math.floor(rng() * items.length)];
}

/* ------------------------------------------------------------------ */
/* Kleine Hilfsfunktionen                                              */
/* ------------------------------------------------------------------ */

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/u)
    .filter((token) => token.length > 0);
}

function countShared(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ================================================================== */
/* 2. WP 131.2.1 — Ursprungs-Trauma-Gegenüberstellung                  */
/* ================================================================== */

export interface OriginTraumaInput {
  heroName: string;
  heroWound: string;
  villainName: string;
  villainWound: string;
}

export interface OriginTraumaResult {
  heroName: string;
  villainName: string;
  sharedWound: string;
  divergencePoint: string;
  heroChoice: string;
  villainChoice: string;
  parallelStrength: number;
  svg: string;
}

const SHARED_WOUNDS: string[] = [
  'Verlust der eigenen Familie',
  'Verrat durch einen engen Vertrauten',
  'Machtlosigkeit in der eigenen Kindheit',
  'Verlassenheit nach einem politischen Fall',
  'Schuld über einen unbeteiligten Tod',
  'Ablehnung durch die eigene Gemeinschaft',
  'Erfahrung von Verrat und anschließendem Exil',
  'die Überzeugung, der Mensch sei von Natur aus allein',
];

const DIVERGENCE_POINTS: string[] = [
  'die Annahme einer zwingenden Pflicht',
  'der Verzicht auf jede Form von Mitleid',
  'die Entscheidung, Kontrolle als einzige Ordnung zu begreifen',
  'die Anerkennung, dass dasselbe Ereignis zwei Wege beschreibt',
  'der Moment, in dem die Wunde gedeutet wurde',
  'die Weigerung, Schuld jemals zu vergeben',
  'die Entscheidung, die eigene Last allein zu tragen',
];

const HERO_CHOICES: string[] = [
  'schützt das Leben anderer auf eigene Kosten',
  'verzeiht trotz offenem Verrat',
  'wählt Vertrauen statt Kontrolle',
  'trägt die Last weiter, statt sie weiterzugeben',
  'öffnet die Hand und riskiert den Verlust',
];

const VILLAIN_CHOICES: string[] = [
  'nimmt den Verlust anderer in Kauf',
  'erwiedert Verrat mit Verrat',
  'wählt Kontrolle statt Vertrauen',
  'teilt die Last weiter und vervielfacht sie',
  'schließt die Hand zur Faust und verweigert das Opfer',
];

function buildForkSvg(
  heroName: string,
  heroWound: string,
  villainName: string,
  villainWound: string,
  sharedWound: string,
  divergencePoint: string,
): string {
  return `<svg viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ursprungs-Trauma-Gabelung">
  <rect x="0" y="0" width="640" height="380" fill="white"/>
  <text x="320" y="30" text-anchor="middle" font-family="sans-serif" font-size="16" fill="darkslategray">Ursprungs-Trauma-Gabelung</text>

  <circle cx="130" cy="190" r="46" fill="gainsboro" stroke="darkslategray" stroke-width="2"/>
  <text x="130" y="186" text-anchor="middle" font-family="sans-serif" font-size="12" fill="darkslategray">Ursprung</text>
  <text x="130" y="204" text-anchor="middle" font-family="sans-serif" font-size="12" fill="dimgray">gemeinsam</text>

  <path d="M 130 160 C 260 70 360 56 500 76" stroke="seagreen" stroke-width="3" fill="none"/>
  <polygon points="500,76 482,68 482,84" fill="seagreen"/>
  <text x="512" y="70" font-family="sans-serif" font-size="15" font-weight="bold" fill="seagreen">${escapeXml(heroName)}</text>
  <text x="512" y="88" font-family="sans-serif" font-size="12" fill="dimgray">${escapeXml(heroWound)}</text>

  <path d="M 130 220 C 260 310 360 324 500 304" stroke="firebrick" stroke-width="3" fill="none"/>
  <polygon points="500,304 482,296 482,312" fill="firebrick"/>
  <text x="512" y="298" font-family="sans-serif" font-size="15" font-weight="bold" fill="firebrick">${escapeXml(villainName)}</text>
  <text x="512" y="316" font-family="sans-serif" font-size="12" fill="dimgray">${escapeXml(villainWound)}</text>

  <line x1="500" y1="80" x2="500" y2="300" stroke="gray" stroke-width="2" stroke-dasharray="5 5" opacity="0.6"/>
  <text x="300" y="196" text-anchor="middle" font-family="sans-serif" font-size="13" fill="darkslategray">Gabelung</text>

  <text x="320" y="338" text-anchor="middle" font-family="sans-serif" font-size="12" fill="darkslategray">Gemeinsame Wunde: ${escapeXml(sharedWound)}</text>
  <text x="320" y="356" text-anchor="middle" font-family="sans-serif" font-size="12" fill="darkslategray">Divergenz: ${escapeXml(divergencePoint)}</text>
</svg>`;
}

export function compareOriginTrauma(input: OriginTraumaInput, seed: number): OriginTraumaResult {
  const rng = createSeededRandom(seed ^ hashString(input.heroName + '|' + input.villainName));
  const sharedWound = pick(SHARED_WOUNDS, rng);
  const divergencePoint = pick(DIVERGENCE_POINTS, rng);
  const heroChoice = pick(HERO_CHOICES, rng);
  const villainChoice = pick(VILLAIN_CHOICES, rng);

  const heroTokens = tokenize(input.heroWound);
  const villainTokens = tokenize(input.villainWound);
  const overlap = countShared(heroTokens, villainTokens);
  const hashBoost = hashString(input.heroWound + '|' + input.villainWound + '|' + seed) % 41;
  const parallelStrength = Math.round(clamp100(overlap * 28 + 25 + hashBoost));

  const svg = buildForkSvg(
    input.heroName,
    input.heroWound,
    input.villainName,
    input.villainWound,
    sharedWound,
    divergencePoint,
  );

  return {
    heroName: input.heroName,
    villainName: input.villainName,
    sharedWound,
    divergencePoint,
    heroChoice,
    villainChoice,
    parallelStrength,
    svg,
  };
}

/* ================================================================== */
/* 3. WP 131.2.2 — Thematischer Resonanz-Score                         */
/* ================================================================== */

export interface ResonanceInput {
  heroWeakness: string;
  villainChallenge: string;
  thematicOverlap?: string[];
}

export interface ResonanceBreakdown {
  factor: string;
  weight: number;
  contribution: number;
}

export interface ResonanceResult {
  score: number;
  breakdown: ResonanceBreakdown[];
  interpretation: string;
  strongestFactor: string;
}

const RESONANCE_FACTORS: string[] = [
  'Wund-Semantik',
  'Thematische Überlappung',
  'Resonanz-Intensität',
  'Gewichtung der Gegenüberstellung',
];

const INTERPRETATIONS: string[] = [
  'Starke dunkelspiegelnde Resonanz, fast schon ein Doppelgänger-Verhältnis.',
  'Deutliche thematische Resonanz zwischen Held und Gegner.',
  'Moderate Resonanz, die noch gestaltbar erscheint.',
  'Schwache Resonanz, wenig spiegelnde Tiefe.',
  'Kaum messbare Resonanz, die Figuren wirken fremd zueinander.',
];

export function calculateResonanceScore(input: ResonanceInput, seed: number): ResonanceResult {
  const rng = createSeededRandom(seed ^ hashString(input.heroWeakness + '|' + input.villainChallenge));
  const heroTokens = tokenize(input.heroWeakness);
  const villainTokens = tokenize(input.villainChallenge);
  const maxTokens = Math.max(heroTokens.length, villainTokens.length, 1);
  const semanticOverlap = countShared(heroTokens, villainTokens) / maxTokens;
  const themeOverlap = input.thematicOverlap
    ? clamp01(input.thematicOverlap.length / 4)
    : 0;
  const intensity = clamp01((heroTokens.length + villainTokens.length) / 24);
  const subtle = rng();

  const weights: number[] = [0.35, 0.3, 0.2, 0.15];
  const values: number[] = [semanticOverlap, themeOverlap, intensity, subtle];

  const breakdown: ResonanceBreakdown[] = RESONANCE_FACTORS.map((factor, index) => ({
    factor,
    weight: weights[index],
    contribution: Math.round(clamp01(values[index]) * weights[index] * 1000) / 10,
  }));

  const raw = breakdown.reduce((sum, entry) => sum + entry.contribution, 0);
  const score = Math.round(clamp100(raw));
  const strongest = breakdown.reduce(
    (best, entry) => (entry.contribution > best.contribution ? entry : best),
    breakdown[0],
  );

  const interpretation = pick(INTERPRETATIONS, createSeededRandom(score + seed));

  return {
    score,
    breakdown,
    interpretation,
    strongestFactor: strongest.factor,
  };
}

/* ================================================================== */
/* 4. WP 131.2.3 — Ideologischer Showdown-Synthesizer                  */
/* ================================================================== */

export interface ShowdownInput {
  heroName: string;
  heroIdeology: string;
  villainName: string;
  villainIdeology: string;
}

export interface Exchange {
  speaker: string;
  line: string;
  worldView: string;
}

export interface ShowdownResult {
  exchanges: Exchange[];
  climaxLine: string;
  unresolvedTension: string;
  wordCount: number;
}

const WORLD_VIEWS: string[] = [
  'Ordnung',
  'Freiheit',
  'Opfer',
  'Wahrheit',
  'Macht',
  'Mitleid',
  'Vergeltung',
];

const HERO_LINES: string[] = [
  'Ich handle aus Pflicht, nicht aus Herrschsucht.',
  'Meine Ordnung entsteht aus dem Schutz der Schwachen.',
  'Deine Kontrolle ist nur eine andere Form der Angst.',
  'Ich trage die Last, weil ich sie freiwillig wähle.',
  'Vertrauen ist die einzige Währung, die nicht entwertet.',
];

const VILLAIN_LINES: string[] = [
  'Ich handle aus Einsicht, nicht aus Grausamkeit.',
  'Meine Ordnung entsteht aus der Wahrheit der Natur.',
  'Dein Mitleid ist nur eine andere Form der Schwäche.',
  'Ich teile die Last, weil niemand sie allein trägt.',
  'Kontrolle ist die einzige Währung, die hält.',
];

const CLIMAX_LINES: string[] = [
  'Dann trennt uns keine Handlung mehr, sondern ein Blick.',
  'Und genau daran erkennst du, dass wir niemals gleich sein werden.',
  'Hier endet der Dialog und beginnt der Spiegel.',
  'Das war die Grenze, und du hast sie gerade überschritten.',
];

const UNRESOLVED_TENSIONS: string[] = [
  'die offene Frage, ob Ordnung ohne Grausamkeit trägt',
  'die ungelöste Last, die keine der Figuren trägt',
  'die nicht beantwortete Frage nach dem Preis der Freiheit',
  'die Schuld, die keiner der beiden jemals benennt',
];

export function synthesizeIdeologicalShowdown(input: ShowdownInput, seed: number): ShowdownResult {
  const rng = createSeededRandom(seed ^ hashString(input.heroName + '|' + input.villainName));
  const exchangeCount = 3 + Math.floor(rng() * 3);
  const exchanges: Exchange[] = [];
  let heroTurn = rng() < 0.5;

  for (let i = 0; i < exchangeCount; i++) {
    const speaker = heroTurn ? input.heroName : input.villainName;
    const line = heroTurn ? pick(HERO_LINES, rng) : pick(VILLAIN_LINES, rng);
    const worldView = pick(WORLD_VIEWS, rng);
    exchanges.push({ speaker, line, worldView });
    heroTurn = !heroTurn;
  }

  const climaxLine = pick(CLIMAX_LINES, rng);
  const unresolvedTension = pick(UNRESOLVED_TENSIONS, rng);

  const wordCount =
    exchanges.reduce((sum, entry) => sum + countWords(entry.line), 0) + countWords(climaxLine);

  return {
    exchanges,
    climaxLine,
    unresolvedTension,
    wordCount,
  };
}

/* ================================================================== */
/* 5. Factory-Funktionen für Beispieldaten                             */
/* ================================================================== */

export function createSampleComparison(): OriginTraumaResult {
  return compareOriginTrauma(
    {
      heroName: 'Kael',
      heroWound: 'Verlust der eigenen Familie durch einen Verrat',
      villainName: 'Vorn',
      villainWound: 'Verlassenheit nach dem Fall der eigenen Gemeinschaft',
    },
    42,
  );
}

export function createSampleShowdown(): ShowdownResult {
  return synthesizeIdeologicalShowdown(
    {
      heroName: 'Kael',
      heroIdeology: 'Ordnung durch Schutz der Schwachen',
      villainName: 'Vorn',
      villainIdeology: 'Ordnung durch Einsicht und Kontrolle',
    },
    42,
  );
}
