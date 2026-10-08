// CognitiveReaderTwin (WP 102.1)
// Kognitiver Reader-Twin & Blick-Simulator.
// 4 Reader-Twin-Archetypen, Sakkaden- & Regressions-Heatmap.
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

export type ReaderArchetypeId = "skimmer" | "contemplator" | "dopamineSeeker" | "plotHacker";

export interface ReaderArchetype {
  id: ReaderArchetypeId;
  name: string;
  behaviour: string;
  /** Gewichtung je Satzmerkmal (0..1) — bestimmt die Fixationsdauer. */
  weights: {
    description: number;
    dialogue: number;
    verb: number;
    metaphor: number;
    complexity: number;
  };
  /** Wortzahl ohne Mikro-Belohnung, ab der die Geduld endet. */
  patienceLimit: number;
}

export const READER_ARCHETYPES: ReaderArchetype[] = [
  {
    id: "skimmer",
    name: "Der Skimmer",
    behaviour: "Überfliegt Beschreibungen, fixiert Verben und Dialoge.",
    weights: { description: 0.15, dialogue: 1, verb: 1, metaphor: 0.2, complexity: 0.1 },
    patienceLimit: 900,
  },
  {
    id: "contemplator",
    name: "Der Kontemplator",
    behaviour: "Verweilt bei Metaphern, liest komplexe Sätze mehrfach.",
    weights: { description: 1, dialogue: 0.5, verb: 0.3, metaphor: 1, complexity: 1 },
    patienceLimit: 2000,
  },
  {
    id: "dopamineSeeker",
    name: "Der Dopamin-Sucher",
    behaviour: "Verliert die Geduld bei fehlenden Mikro-Belohnungen.",
    weights: { description: 0.3, dialogue: 0.9, verb: 0.8, metaphor: 0.4, complexity: 0.2 },
    patienceLimit: 800,
  },
  {
    id: "plotHacker",
    name: "Der Plot-Hacker",
    behaviour: "Sucht logische Schwachstellen und versucht das Ende zu erraten.",
    weights: { description: 0.6, dialogue: 0.8, verb: 0.5, metaphor: 0.3, complexity: 0.9 },
    patienceLimit: 1500,
  },
];

export function getArchetype(id: ReaderArchetypeId): ReaderArchetype | undefined {
  return READER_ARCHETYPES.find((a) => a.id === id);
}

/** Ein Satz im Text mit extrahierten Merkmalen. */
export interface TextSentence {
  index: number;
  text: string;
  wordCount: number;
  hasDescription: boolean;
  hasDialogue: boolean;
  verbDensity: number; // 0..1
  metaphorDensity: number; // 0..1
  complexity: number; // 0..1 (Satzlänge/Satzbau)
}

const DESCRIPTION_MARKERS = [
  "wand", "himmel", "licht", "schatten", "duft", "farbe", "landschaft",
  "zimmer", "kleid", "geruch", "geräusch", "sonne", "regen", "nebel",
];

const METAPHOR_MARKERS = ["wie", "als ob", "gleich", "gleicht", "erinnerte an", "schien", "wirkte"];

const DIALOGUE_MARKER = /[„“"]|^—|^-/;

export function analyzeSentence(index: number, text: string): TextSentence {
  const clean = text.trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const lower = clean.toLowerCase();

  const hasDescription = DESCRIPTION_MARKERS.some((m) => lower.includes(m));
  const hasDialogue = DIALOGUE_MARKER.test(clean);

  const verbs = words.filter((w) => /(en|t|te|st|et)$/.test(w.toLowerCase()) && w.length > 3).length;
  const verbDensity = wordCount > 0 ? Math.min(1, verbs / wordCount) : 0;

  const metaphorHits = METAPHOR_MARKERS.filter((m) => lower.includes(m)).length;
  const metaphorDensity = Math.min(1, metaphorHits / 3);

  // Komplexität: lange Sätze und Nebensätze
  const clauseMarkers = (clean.match(/[,;:]|\b(der|die|das|welcher|obwohl|während|nachdem)\b/gi) || []).length;
  const complexity = Math.min(1, (wordCount / 40) * 0.6 + (clauseMarkers / 6) * 0.4);

  return { index, text: clean, wordCount, hasDescription, hasDialogue, verbDensity, metaphorDensity, complexity };
}

export function analyzeText(text: string): TextSentence[] {
  if (!text || text.trim().length === 0) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s, i) => analyzeSentence(i, s));
}

export interface Fixation {
  sentenceIndex: number;
  /** Fixationsdauer in Millisekunden. */
  dwellMs: number;
  /** Sakkade: Sprung zum nächsten Satz (true = übersprungen). */
  skipped: boolean;
  /** Regression: verwirrtes Zurückspringen. */
  regressed: boolean;
  reason: string;
}

export interface ReaderExperience {
  archetype: ReaderArchetypeId;
  fixations: Fixation[];
  totalDwellMs: number;
  skips: number;
  regressions: number;
  abandonedAtSentence: number | null;
  engagementScore: number;
}

const BASE_DWELL_MS = 240;

export function simulateReader(sentences: TextSentence[], archetypeId: ReaderArchetypeId, seed: number = 42): ReaderExperience {
  const archetype = getArchetype(archetypeId);
  if (!archetype || sentences.length === 0) {
    return {
      archetype: archetypeId,
      fixations: [],
      totalDwellMs: 0,
      skips: 0,
      regressions: 0,
      abandonedAtSentence: null,
      engagementScore: 100,
    };
  }

  const rng = createSeededRandom(hashString(`${archetypeId}:${sentences.length}:${seed}`));
  const fixations: Fixation[] = [];
  let wordsSinceReward = 0;
  let abandonedAtSentence: number | null = null;

  for (const s of sentences) {
    const w = archetype.weights;
    let interest =
      (s.hasDescription ? w.description : 0) +
      (s.hasDialogue ? w.dialogue : 0) +
      s.verbDensity * w.verb +
      s.metaphorDensity * w.metaphor +
      s.complexity * w.complexity;
    interest = Math.max(0.05, Math.min(1, interest));

    const dwellMs = Math.round(BASE_DWELL_MS * (1 + interest) * (0.85 + rng() * 0.3));
    const skipped = interest < 0.25;
    const regressed = s.complexity > 0.7 && w.complexity > 0.5 && rng() < 0.4;

    let reason = "normale Fixation";
    if (skipped) reason = "übersprungen — geringes Interesse";
    else if (regressed) reason = "Regression — Komplexität erzwingt zweites Lesen";

    fixations.push({ sentenceIndex: s.index, dwellMs, skipped, regressed, reason });

    wordsSinceReward += s.wordCount;
    // Mikro-Belohnung: Dialog oder hohe Verb-Dichte setzt den Zähler zurück
    if (s.hasDialogue || s.verbDensity > 0.3) wordsSinceReward = 0;
    if (abandonedAtSentence === null && wordsSinceReward > archetype.patienceLimit) {
      abandonedAtSentence = s.index;
    }
  }

  const totalDwellMs = fixations.reduce((sum, f) => sum + f.dwellMs, 0);
  const skips = fixations.filter((f) => f.skipped).length;
  const regressions = fixations.filter((f) => f.regressed).length;
  const engagementScore = Math.max(
    0,
    Math.min(100, 100 - skips * 3 - regressions * 2 - (abandonedAtSentence !== null ? 25 : 0))
  );

  return { archetype: archetypeId, fixations, totalDwellMs, skips, regressions, abandonedAtSentence, engagementScore };
}

export interface HeatmapCell {
  sentenceIndex: number;
  /** Intensität 0..1 über alle Archetypen. */
  intensity: number;
  /** true = mindestens ein Archetyp bricht hier ab. */
  breakPoint: boolean;
  /** true = mindestens ein Archetyp springt verwirrt zurück. */
  confusion: boolean;
}

export function buildHeatmap(experiences: ReaderExperience[]): HeatmapCell[] {
  if (experiences.length === 0) return [];
  const maxIndex = Math.max(
    0,
    ...experiences.flatMap((e) => e.fixations.map((f) => f.sentenceIndex))
  );
  const cells: HeatmapCell[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    let dwellSum = 0;
    let count = 0;
    let breakPoint = false;
    let confusion = false;
    for (const e of experiences) {
      const f = e.fixations.find((x) => x.sentenceIndex === i);
      if (f) {
        dwellSum += f.dwellMs;
        count++;
        if (f.regressed) confusion = true;
      }
      if (e.abandonedAtSentence === i) breakPoint = true;
    }
    const avg = count > 0 ? dwellSum / count : 0;
    const intensity = Math.max(0, Math.min(1, avg / (BASE_DWELL_MS * 2)));
    cells.push({ sentenceIndex: i, intensity, breakPoint, confusion });
  }
  return cells;
}

export interface ReaderTwinReport {
  id: string;
  sentenceCount: number;
  experiences: ReaderExperience[];
  heatmap: HeatmapCell[];
  weakestArchetype: ReaderArchetypeId | null;
  overallRetention: number;
}

export function analyzeReaderTwin(text: string, archetypeIds: ReaderArchetypeId[], seed: number = 42): ReaderTwinReport {
  const sentences = analyzeText(text);
  const active = archetypeIds
    .map((id) => getArchetype(id))
    .filter((a): a is ReaderArchetype => Boolean(a));
  const list = active.length > 0 ? active : READER_ARCHETYPES;

  const experiences = list.map((a, i) => simulateReader(sentences, a.id, seed + i));
  const heatmap = buildHeatmap(experiences);

  const sorted = [...experiences].sort((a, b) => a.engagementScore - b.engagementScore);
  const weakestArchetype = sorted.length > 0 ? sorted[0].archetype : null;
  const overallRetention =
    experiences.length > 0
      ? Math.round(experiences.reduce((s, e) => s + e.engagementScore, 0) / experiences.length)
      : 100;

  return {
    id: `TWIN-${hashString(`${text.length}:${archetypeIds.join(",")}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    sentenceCount: sentences.length,
    experiences,
    heatmap,
    weakestArchetype,
    overallRetention,
  };
}

export const SAMPLE_TEXT = `Der Wind strich über die Dächer wie eine Hand über kalte Haut. Lyra stand am Fenster und sah hinaus. „Wir haben keine Zeit mehr“, sagte Bram. Sie antwortete nicht sofort; denn der Himmel über Falkenstein hatte die Farbe alten Blutes angenommen, und irgendwo unter den Zinnen bellte ein Hund. „Dann gehen wir jetzt.“ Bram griff nach dem Schwert. Die Kälte kroch durch die Ritzen des Gemäuers und legte sich auf ihre Wangen.`;

export function createSampleReaderTwinReport(): ReaderTwinReport {
  return analyzeReaderTwin(SAMPLE_TEXT, ["skimmer", "contemplator", "dopamineSeeker", "plotHacker"], 42);
}
