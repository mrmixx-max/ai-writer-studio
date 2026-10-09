// DialectIsoglossWeaver (WP 133.1)
//
// Dialekt-Isoglossen- & Akzent-Weber: geografische Dialektgrenzen (Isoglossen),
// ein subtiler Dialog-Modulator und ein Generator für regionale Metaphern.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zieht ein Element per RNG. Wirft bei leerem Array (kein stiller undefined-Rückfall). */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error('pick: leeres Array – kein Element verfügbar');
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Typen ──────────────────────────────────────────────────────────────────

/** Kanonische Kennung einer Dialektregion. */
export type DialectRegionId = 'north' | 'south' | 'mountain' | 'harbor';

/** Ein Standard-Vokabel mit regionaler Entsprechung. */
export interface VocabularyPair {
  standard: string;
  local: string;
}

/** Eine Dialektregion mit Wortschatz, Satzmustern und Bildwelt. */
export interface DialectRegion {
  id: DialectRegionId;
  name: string;
  description: string;
  vocabulary: VocabularyPair[];
  sentencePatterns: string[];
  metaphors: string[];
}

/** Eine Isoglosse (Dialektgrenze) zwischen Regionen. */
export interface Isogloss {
  id: string;
  name: string;
  description: string;
  regions: string[];
  marker: string;
}

/** Ergebnis der Regions-Auflösung. */
export interface DialectRegionMap {
  region: string;
  vocabulary: VocabularyPair[];
  patterns: string[];
  metaphors: string[];
  description: string;
}

/** Eine Dialogzeile als Eingabe. */
export interface DialogueLine {
  speaker: string;
  text: string;
  regionId: string;
}

/** Eine modulierte Dialogzeile als Ausgabe. */
export interface ModulatedLine {
  speaker: string;
  original: string;
  modulated: string;
  region: string;
  changes: string[];
}

/** Ergebnis der Dialog-Modulation. */
export interface DialogueModulation {
  lines: ModulatedLine[];
  readabilityScore: number;
  description: string;
}

/** Eine regionale Metapher zu einem Konzept. */
export interface RegionalMetaphor {
  region: string;
  concept: string;
  metaphor: string;
  explanation: string;
}

// ─── Regionsdaten ───────────────────────────────────────────────────────────

/** Die vier Dialektregionen. */
export const DIALECT_REGIONS = [
  {
    id: 'north',
    name: 'Nordregion',
    description:
      'Küsten- und Tieflanddialekt mit plattdeutschen Wurzeln: kurz, trocken, unterkühlt freundlich.',
    vocabulary: [
      { standard: 'sprechen', local: 'schnacken' },
      { standard: 'Mädchen', local: 'Deern' },
      { standard: 'klein', local: 'lütt' },
      { standard: 'ein bisschen', local: 'en beten' },
      { standard: 'schnell', local: 'flott' },
      { standard: 'guten Tag', local: 'Moin' },
    ],
    sentencePatterns: [
      'Kurze Hauptsätze, das Verb stets an zweiter Stelle.',
      'Untertreibung als Grundton: „ganz nett“ heißt hier „ausgezeichnet“.',
      'Partikeln wie „man“ und „mal“ werden beiläufig eingeschoben.',
    ],
    metaphors: [
      'dem Priel, der bei Ebbe kommt und geht',
      'einem Deich, der stillhält, egal wie sehr die See drückt',
      'dem grauen Licht über dem Watt vor Sonnenaufgang',
      'einem alten Kutter, der nie ganz untergeht',
    ],
  },
  {
    id: 'south',
    name: 'Südregion',
    description:
      'Alpennaher Dialekt mit weichem Klang, schmelzenden Vokalen und betonter Höflichkeit.',
    vocabulary: [
      { standard: 'sprechen', local: 'redn' },
      { standard: 'Brötchen', local: 'Semmel' },
      { standard: 'Mädchen', local: 'Madl' },
      { standard: 'ein bisschen', local: 'a bisserl' },
      { standard: 'sehr', local: 'sakrisch' },
      { standard: 'guten Tag', local: 'Grüß Gott' },
    ],
    sentencePatterns: [
      'Weiche, gezogene Endungen mit schmelzendem Tonfall.',
      'Verstärkungen werden vorangestellt: „sakrisch guat“.',
      'Fragen enden mit der Partikel „gell“.',
    ],
    metaphors: [
      'einem Almabtrieb, bei dem jeder Schritt nach Hause führt',
      'dem Föhn, der die Wolken über die Kämme fegt',
      'einer Maß Bier nach getaner Feldarbeit',
      'einem Glockengeläut, das über das Tal wandert',
    ],
  },
  {
    id: 'mountain',
    name: 'Bergregion',
    description:
      'Herber Bergdialekt mit knappen Lauten, harten Konsonanten und spröder Bildwelt.',
    vocabulary: [
      { standard: 'sprechen', local: 'redn' },
      { standard: 'Junge', local: 'Bua' },
      { standard: 'Mädchen', local: 'Dirndl' },
      { standard: 'klein', local: 'kloan' },
      { standard: 'ja', local: 'jo' },
      { standard: 'sehr', local: 'arg' },
      { standard: 'guten Tag', local: 'Griass di' },
    ],
    sentencePatterns: [
      'Knappe, abgehackte Sätze wie ein Steig am Grat.',
      'Doppelte Verneinung zur Bekräftigung: „des is koa Nix“.',
      'Häufige Ausrufe und kurze Zurufe.',
    ],
    metaphors: [
      'einem Grat, der nur einen Tritt verzeiht',
      'der Kälte im Fels, die auch im Sommer bleibt',
      'einem Lawinenhang, der wartet, bis du atmest',
      'dem Echo, das erst nach der Stille kommt',
    ],
  },
  {
    id: 'harbor',
    name: 'Hafenregion',
    description:
      'Rauer Hafen- und Werftdialekt: derb, laut, voller Seefahrerbilder und Galgenhumor.',
    vocabulary: [
      { standard: 'sprechen', local: 'klönen' },
      { standard: 'Geld', local: 'Kies' },
      { standard: 'Arbeit', local: 'Maloche' },
      { standard: 'schnell', local: 'fix' },
      { standard: 'betrunken', local: 'duhn' },
      { standard: 'guten Tag', local: 'Tach' },
    ],
    sentencePatterns: [
      'Derbe, direkte Rede ohne Umwege.',
      'Flüche und Seemannsgarn werden eingestreut.',
      'Sätze enden oft mit der Bestätigung „wa?“.',
    ],
    metaphors: [
      'einem Tau, das reißt, wenn alle ziehen',
      'der Brandung an der Mole bei Sturmflut',
      'einem Rost, der langsam, aber sicher frisst',
      'dem Nebelhorn, das man hört, wenn man es braucht',
    ],
  },
] as const;

/** Die Isoglossen (Dialektgrenzen) zwischen den Regionen. */
export const ISOGLOSSES = [
  {
    id: 'iso-broetchen-semmel',
    name: 'Brötchen-Semmel-Linie',
    description:
      'Die bekannteste Wortgrenze: nördlich heißt es „Brötchen“, südlich „Semmel“.',
    regions: ['north', 'south'],
    marker: 'Brötchen ↔ Semmel',
  },
  {
    id: 'iso-moin-gruessgott',
    name: 'Moin-Grüß-Gott-Grenze',
    description:
      'Die Grußformel verrät die Herkunft: „Moin“ im Norden, „Grüß Gott“ im Süden.',
    regions: ['north', 'south'],
    marker: 'Moin ↔ Grüß Gott',
  },
  {
    id: 'iso-deern-madl',
    name: 'Deern-Madl-Linie',
    description:
      'Das Wort für das Mädchen wechselt an dieser Grenze von „Deern“ zu „Madl“ und „Dirndl“.',
    regions: ['north', 'harbor', 'south', 'mountain'],
    marker: 'Deern ↔ Madl',
  },
  {
    id: 'iso-maloche-kloenen',
    name: 'Maloche-Klönen-Grenze',
    description:
      'Die Werft- und Hafenrede kennt „Maloche“ und „klönen“; das Bergland spricht knapper.',
    regions: ['harbor', 'mountain'],
    marker: 'Maloche ↔ redn',
  },
  {
    id: 'iso-priel-bergsee',
    name: 'Priel-Bergsee-Grenze',
    description:
      'Die Bildwelt kippt von Ebbe und Priel der Küste zur Kälte des Fels und der Bergseen.',
    regions: ['harbor', 'mountain'],
    marker: 'Priel ↔ Bergsee',
  },
] as const;

// ─── Interne Regional-Marker (nicht Teil der öffentlichen Regionsdaten) ──────

const REGION_OPENERS: Record<DialectRegionId, readonly string[]> = {
  north: ['Moin', 'Nu'],
  south: ['Servus', 'Hoi'],
  mountain: ['Hoi', 'Griass di'],
  harbor: ['Tach', 'Nu'],
};

const REGION_TAGS: Record<DialectRegionId, readonly string[]> = {
  north: ['ne?', 'nich?'],
  south: ['gell?', 'gä?'],
  mountain: ['gell?', 'oder?'],
  harbor: ['wa?', 'nich?'],
};

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

type DialectRegionEntry = (typeof DIALECT_REGIONS)[number];

/** Löst eine Regionskennung auf; fällt deterministisch auf die erste Region zurück. */
function resolveRegion(regionId: string): DialectRegionEntry {
  const found = DIALECT_REGIONS.find((region) => region.id === regionId);
  return found ?? DIALECT_REGIONS[0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Übernimmt die Groß-/Kleinschreibung des Originals auf die Ersetzung. */
function capitalizeLike(source: string, replacement: string): string {
  if (source.length === 0 || replacement.length === 0) return replacement;
  const first = source[0];
  const isUpper = first === first.toUpperCase() && first !== first.toLowerCase();
  return isUpper
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement[0].toLowerCase() + replacement.slice(1);
}

/** Kleinschreibung des ersten Zeichens (für vorangestellte Partikeln). */
function lowerFirst(text: string): string {
  if (text.length === 0) return text;
  return text[0].toLowerCase() + text.slice(1);
}

function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

function countSentences(text: string): number {
  return text
    .split(/[.!?…]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

/** Ersetzt Standard-Vokabeln durch regionale Entsprechungen und protokolliert die Änderungen. */
function applyVocabulary(
  text: string,
  vocabulary: readonly VocabularyPair[],
  changes: string[],
): string {
  let result = text;
  for (const pair of vocabulary) {
    if (!pair.standard) continue;
    const pattern = new RegExp('\\b' + escapeRegExp(pair.standard) + '\\b', 'gi');
    let count = 0;
    result = result.replace(pattern, (match) => {
      count++;
      return capitalizeLike(match, pair.local);
    });
    if (count > 0) {
      changes.push(`Vokabel: „${pair.standard}“ → „${pair.local}“ (${count}×)`);
    }
  }
  return result;
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Löst eine Region auf und liefert Wortschatz, Satzmuster und Bildwelt.
 * Der Seed wählt deterministisch das Leitmuster und Leitbild in der Beschreibung.
 */
export function mapDialectRegion(regionId: string, seed: number): DialectRegionMap {
  const region = resolveRegion(regionId);
  const rng = createSeededRandom(hashString('region:' + region.id + ':' + seed));
  const pattern = pick(region.sentencePatterns, rng);
  const metaphor = pick(region.metaphors, rng);

  return {
    region: region.id,
    vocabulary: region.vocabulary.map((v) => ({ standard: v.standard, local: v.local })),
    patterns: [...region.sentencePatterns],
    metaphors: [...region.metaphors],
    description: `${region.description} Leitmuster: „${pattern}“. Leitbild: „${metaphor}“.`,
  };
}

/**
 * Moduliert Dialogzeilen in den jeweiligen Regionston: tauscht Vokabeln aus
 * und passt die Satzstruktur behutsam an, ohne die Lesbarkeit zu zerstören.
 */
export function modulateDialogue(lines: DialogueLine[], seed: number): DialogueModulation {
  const safeLines = Array.isArray(lines) ? lines : [];
  const rng = createSeededRandom(hashString('dialogue:' + seed));
  const modulatedLines: ModulatedLine[] = [];

  for (let i = 0; i < safeLines.length; i++) {
    const line = safeLines[i];
    const region = resolveRegion(line.regionId);
    const original = typeof line.text === 'string' ? line.text : '';
    const changes: string[] = [];

    if (original.trim().length === 0) {
      modulatedLines.push({
        speaker: line.speaker,
        original,
        modulated: original,
        region: region.id,
        changes,
      });
      continue;
    }

    let modulated = applyVocabulary(original, region.vocabulary, changes);

    if (rng() < 0.5) {
      const opener = pick(REGION_OPENERS[region.id], rng);
      modulated = `${opener}, ${lowerFirst(modulated)}`;
      changes.push(`Satzstruktur: regionaler Auftakt „${opener}“ vorangestellt`);
    } else {
      const tag = pick(REGION_TAGS[region.id], rng);
      modulated = `${modulated} ${tag}`;
      changes.push(`Satzstruktur: Regionalpartikel „${tag}“ angehängt`);
    }

    modulatedLines.push({
      speaker: line.speaker,
      original,
      modulated,
      region: region.id,
      changes,
    });
  }

  const joined = modulatedLines.map((l) => l.modulated).join(' ');
  const words = countWords(joined);
  const sentences = Math.max(1, countSentences(joined));
  const avgWordsPerSentence = words / sentences;
  const totalChanges = modulatedLines.reduce((sum, l) => sum + l.changes.length, 0);

  const sentencePenalty = Math.max(0, avgWordsPerSentence - 18) * 3;
  const changePenalty = words > 0 ? (totalChanges / words) * 30 : 0;
  const readabilityScore = clamp(Math.round(100 - sentencePenalty - changePenalty), 0, 100);

  const description =
    `Dialog mit ${modulatedLines.length} Zeile(n) moduliert. ` +
    `${totalChanges} Anpassungen an Vokabular und Satzstruktur. ` +
    `Lesbarkeit: ${readabilityScore}/100.`;

  return { lines: modulatedLines, readabilityScore, description };
}

/** Erzeugt eine regionale Metapher zu einem Konzept samt Erläuterung. */
export function generateRegionalMetaphor(
  regionId: string,
  concept: string,
  seed: number,
): RegionalMetaphor {
  const region = resolveRegion(regionId);
  const safeConcept =
    typeof concept === 'string' && concept.trim().length > 0 ? concept.trim() : 'der Augenblick';
  const rng = createSeededRandom(
    hashString('metaphor:' + region.id + ':' + safeConcept + ':' + seed),
  );
  const image = pick(region.metaphors, rng);

  return {
    region: region.id,
    concept: safeConcept,
    metaphor: `${safeConcept} gleicht ${image}.`,
    explanation:
      `Aus der ${region.name}. ${region.description} ` +
      `Das Bild greift auf den Alltag der Region zurück: ${image}.`,
  };
}

/** Erstellt eine Beispielregion (Nordregion). */
export function createSampleRegion(): DialectRegion {
  const region = resolveRegion('north');
  return {
    id: region.id,
    name: region.name,
    description: region.description,
    vocabulary: region.vocabulary.map((v) => ({ standard: v.standard, local: v.local })),
    sentencePatterns: [...region.sentencePatterns],
    metaphors: [...region.metaphors],
  };
}

/** Erstellt eine Beispiel-Dialogmodulation über zwei Regionen. */
export function createSampleModulation(): DialogueModulation {
  const lines: DialogueLine[] = [
    { speaker: 'Elara', text: 'Der Wind steht gut. Wir sprechen später.', regionId: 'north' },
    {
      speaker: 'Thorne',
      text: 'Ich brauche Geld, und die Arbeit wird schnell gehen.',
      regionId: 'harbor',
    },
  ];
  return modulateDialogue(lines, 42);
}
