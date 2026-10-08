// polyrhythmicSentenceStream.ts (WP 94.2)
// Polyrhythmischer Satzmelodie- & Kadenzen-Synthesizer

export type RhythmArchetype = "staccato" | "periodic" | "polysyndeton" | "asyndeton";

export interface PolyrhythmicProfile {
  id: string;
  archetype: RhythmArchetype;
  emotion: string;
  targetWordCount: number;
  sentences: GeneratedSentence[];
  rhythmAnalysis: RhythmAnalysis;
  seed: number;
}

export interface GeneratedSentence {
  text: string;
  wordCount: number;
  sentenceType: "main" | "subordinate" | "fragment" | "cumulative";
  rhythmMarker: string;
}

export interface RhythmAnalysis {
  avgWordsPerSentence: number;
  sentenceCount: number;
  fragmentRatio: number;
  subordinationDepth: number;
  polysyndetonCount: number;
  asyndetonRuns: number;
  dominantRhythm: RhythmArchetype;
}

const STACCATO_FRAGMENTS = [
  "Kälte.", "Eisen.", "Blut.", "Er sprang.", "Atem stockt.", "Herz rast.",
  "Schritt. Schritt. Schritt.", "Nichts mehr.", "Ende.", "Stille.", "Licht.",
  "Schatten.", "Stahl.", "Flamme.", "Asche.", "Wind.", "Regen.", "Donner.",
];

const PERIODIC_OPENINGS = [
  "Während die Welt dort draußen noch in ihrer gewohnten Bahn kreiste,",
  "Als der letzte Strahl der untergehenden Sonne die Fensterscheiben küsste,",
  "In dem Moment, da die Stille so laut wurde, dass sie schmerzte,",
  "Seit jenem Tag, an dem alles anders wurde, ohne dass es jemand bemerkte,",
  "Obwohl er längst wusste, was kommen würde, weigerte er sich, hinzusehen,",
];

const PERIODIC_CLOSINGS = [
  "da fiel die Entscheidung wie ein Stein in tiefes Wasser.",
  "entstand etwas, das kein Wort der Sprache fassen kann.",
  "ward das Unaussprechliche plötzlich greifbar nah.",
  "brach die Nacht herein, schwer und endgülitg.",
  "verlor die Zeit ihre Bedeutung, dehnte sich ins Unendliche.",
];

const POLYSYNDETON_CONNECTORS = [
  "und", "und dann", "und auch", "und noch", "und immer wieder",
];

const ASYNDETON_VERBS = [
  "rennen", "springen", "atmen", "blicken", "greifen", "fallen",
  "steigen", "sinken", "suchen", "finden", "verlieren", "gewinnen",
  "schreien", "flüstern", "lachen", "weinen", "hoffen", "fürchten",
];

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return (z ^ (z >>> 16)) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) return undefined as unknown as T;
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)];
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function generateStaccato(rng: () => number, targetWords: number): GeneratedSentence[] {
  const sentences: GeneratedSentence[] = [];
  let totalWords = 0;

  while (totalWords < targetWords) {
    const fragment = pickRandom(STACCATO_FRAGMENTS, rng);
    const words = countWords(fragment);
    if (totalWords + words > targetWords * 1.2) break;

    sentences.push({
      text: fragment,
      wordCount: words,
      sentenceType: "fragment",
      rhythmMarker: "🔴 STACCATO",
    });
    totalWords += words;
  }

  return sentences;
}

function generatePeriodic(rng: () => number, targetWords: number): GeneratedSentence[] {
  const sentences: GeneratedSentence[] = [];
  let totalWords = 0;

  while (totalWords < targetWords) {
    const opening = pickRandom(PERIODIC_OPENINGS, rng);
    const closing = pickRandom(PERIODIC_CLOSINGS, rng);
    const middleFragments = Math.floor(rng() * 3) + 1;
    let middle = "";

    for (let i = 0; i < middleFragments; i++) {
      const connector = pickRandom(["während", "wobei", "indem", "als", "weil"], rng);
      const action = pickRandom([
        "die Vögel sangen", "der Wind heulte", "die Zeit verrann",
        "Erinnerungen erwachten", "Schatten tanzten", "Träume zerbrachen"
      ], rng);
      middle += ` ${connector} ${action}`;
    }

    const text = `${opening}${middle}, ${closing}`;
    const words = countWords(text);

    if (totalWords + words > targetWords * 1.3) break;

    sentences.push({
      text,
      wordCount: words,
      sentenceType: "subordinate",
      rhythmMarker: "🔵 PERIODISCH",
    });
    totalWords += words;
  }

  return sentences;
}

function generatePolysyndeton(rng: () => number, targetWords: number): GeneratedSentence[] {
  const sentences: GeneratedSentence[] = [];
  let totalWords = 0;

  while (totalWords < targetWords) {
    const verbCount = Math.floor(rng() * 5) + 3;
    const verbs = [];
    for (let i = 0; i < verbCount; i++) {
      verbs.push(pickRandom(ASYNDETON_VERBS, rng));
    }

    const connector = pickRandom(POLYSYNDETON_CONNECTORS, rng);
    const subject = pickRandom(["Er", "Sie", "Es", "Der Wind", "Die Zeit", "Das Herz"], rng);
    const text = `${subject} ${verbs.join(` ${connector} `)}.`;

    const words = countWords(text);
    if (totalWords + words > targetWords * 1.2) break;

    sentences.push({
      text,
      wordCount: words,
      sentenceType: "cumulative",
      rhythmMarker: "🟢 POLYSYNDETON",
    });
    totalWords += words;
  }

  return sentences;
}

function generateAsyndeton(rng: () => number, targetWords: number): GeneratedSentence[] {
  const sentences: GeneratedSentence[] = [];
  let totalWords = 0;

  while (totalWords < targetWords) {
    const verbCount = Math.floor(rng() * 6) + 4;
    const verbs = [];
    for (let i = 0; i < verbCount; i++) {
      verbs.push(pickRandom(ASYNDETON_VERBS, rng));
    }

    const subject = pickRandom(["Er", "Sie", "Es", "Der Wind", "Die Zeit", "Das Herz"], rng);
    const text = `${subject} ${verbs.join(", ")}.`;

    const words = countWords(text);
    if (totalWords + words > targetWords * 1.2) break;

    sentences.push({
      text,
      wordCount: words,
      sentenceType: "fragment",
      rhythmMarker: "🟡 ASYNDETON",
    });
    totalWords += words;
  }

  return sentences;
}

function analyzeRhythm(sentences: GeneratedSentence[], archetype: RhythmArchetype): RhythmAnalysis {
  const totalWords = sentences.reduce((sum, s) => sum + s.wordCount, 0);
  const sentenceCount = sentences.length;
  const avgWords = sentenceCount > 0 ? totalWords / sentenceCount : 0;

  const fragments = sentences.filter(s => s.sentenceType === "fragment").length;
  const fragmentRatio = sentenceCount > 0 ? fragments / sentenceCount : 0;

  const subordinate = sentences.filter(s => s.sentenceType === "subordinate").length;
  const subordinationDepth = sentenceCount > 0 ? subordinate / sentenceCount : 0;

  const polysyndetonCount = sentences.filter(s => s.rhythmMarker.includes("POLYSYNDETON")).length;
  const asyndetonRuns = sentences.filter(s => s.rhythmMarker.includes("ASYNDETON")).length;

  return {
    avgWordsPerSentence: Math.round(avgWords * 10) / 10,
    sentenceCount,
    fragmentRatio: Math.round(fragmentRatio * 100) / 100,
    subordinationDepth: Math.round(subordinationDepth * 100) / 100,
    polysyndetonCount,
    asyndetonRuns,
    dominantRhythm: archetype,
  };
}

export function createPolyrhythmicProfile(
  archetype: RhythmArchetype,
  emotion: string,
  targetWordCount: number = 200,
  seed: number = 42
): PolyrhythmicProfile {
  const rng = createSeededRandom(hashString(archetype + emotion + targetWordCount + seed));

  let sentences: GeneratedSentence[];
  switch (archetype) {
    case "staccato":
      sentences = generateStaccato(rng, targetWordCount);
      break;
    case "periodic":
      sentences = generatePeriodic(rng, targetWordCount);
      break;
    case "polysyndeton":
      sentences = generatePolysyndeton(rng, targetWordCount);
      break;
    case "asyndeton":
      sentences = generateAsyndeton(rng, targetWordCount);
      break;
    default:
      sentences = generateStaccato(rng, targetWordCount);
  }

  const rhythmAnalysis = analyzeRhythm(sentences, archetype);

  return {
    id: `POLY-${hashString(archetype + emotion + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    archetype,
    emotion,
    targetWordCount,
    sentences,
    rhythmAnalysis,
    seed,
  };
}

export function formatPolyrhythmicProfile(profile: PolyrhythmicProfile): string {
  const archetypeLabels: Record<RhythmArchetype, string> = {
    staccato: "🔴 STACCATO-HAMMER (1-4 Wörter, Todesgefahr)",
    periodic: "🔵 PERIODISCHER SCHWELLSATZ (hinausgezögert, 40+ Wörter)",
    polysyndeton: "🟢 POLYSYNDETON-WOGE (treibende Bindewort-Wiederholung)",
    asyndeton: "🟡 ASYNDETISCHER RAUSCH (schnelle unverbundene Verbkaskaden)",
  };

  const lines = [
    "🎵 POLYRHYTHMISCHER SATZMELODIE-SYNTHESIZER",
    `ID: ${profile.id}`,
    `Archetyp: ${archetypeLabels[profile.archetype]}`,
    `Emotion: ${profile.emotion}`,
    `Ziel-Wortzahl: ${profile.targetWordCount}`,
    `Seed: ${profile.seed}`,
    "",
    "📊 RHYTHMUS-ANALYSE:",
    `  Ø Wörter/Satz: ${profile.rhythmAnalysis.avgWordsPerSentence}`,
    `  Satzanzahl: ${profile.rhythmAnalysis.sentenceCount}`,
    `  Fragment-Anteil: ${(profile.rhythmAnalysis.fragmentRatio * 100).toFixed(0)}%`,
    `  Subordinationstiefe: ${(profile.rhythmAnalysis.subordinationDepth * 100).toFixed(0)}%`,
    `  Polysyndeton-Sätze: ${profile.rhythmAnalysis.polysyndetonCount}`,
    `  Asyndeton-Runs: ${profile.rhythmAnalysis.asyndetonRuns}`,
    `  Dominanter Rhythmus: ${profile.rhythmAnalysis.dominantRhythm}`,
    "",
    "📝 GENERIERTE SÄTZE:",
  ];

  for (let i = 0; i < profile.sentences.length; i++) {
    const s = profile.sentences[i];
    lines.push(`  ${i + 1}. [${s.wordCount} Wörter] ${s.rhythmMarker} "${s.text}"`);
  }

  const fullText = profile.sentences.map(s => s.text).join(" ");
  lines.push("", "📖 VOLLTEXT:", fullText);

  return lines.join("\n");
}

export function createSampleProfile(): PolyrhythmicProfile {
  return createPolyrhythmicProfile("staccato", "Todesangst", 150, 42);
}

export function createSampleAnalysis(): RhythmAnalysis {
  return {
    avgWordsPerSentence: 3.5,
    sentenceCount: 12,
    fragmentRatio: 0.9,
    subordinationDepth: 0.1,
    polysyndetonCount: 0,
    asyndetonRuns: 0,
    dominantRhythm: "staccato",
  };
}