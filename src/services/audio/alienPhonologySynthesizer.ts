// AlienPhonologySynthesizer (WP 103.1)
// Nicht-menschliche Alien-Phonologie-Engine.
// Biomechanische Lautapparate, Conlang-Übersetzungs-Matrix, WebAudio-Parameter.
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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type VocalApparatusId = "insectoid" | "hydroAcoustic" | "crystalline";

export interface VocalApparatus {
  id: VocalApparatusId;
  name: string;
  mechanism: string;
  /** WebAudio-Oszillator-Typ. */
  oscillator: OscillatorType;
  baseFrequencyHz: number;
  /** Anzahl Klicks/Zirpen pro Sekunde. */
  clickRate: number;
  description: string;
}

export const VOCAL_APPARATUS: VocalApparatus[] = [
  {
    id: "insectoid",
    name: "Insektoid / Chitin",
    mechanism: "Mandibel-Reiben und Flügel-Stridulation",
    oscillator: "square",
    baseFrequencyHz: 4200,
    clickRate: 24,
    description: "Schnelle Klickfolgen, Zirpen, raues Reiben der Chitinpanzer.",
  },
  {
    id: "hydroAcoustic",
    name: "Hydro-Akustik",
    mechanism: "Resonanzkammern und Blasen-Kavitation",
    oscillator: "sine",
    baseFrequencyHz: 180,
    clickRate: 8,
    description: "Pfeifmuster, Klickserien und Infraschall-Vibrationen im Wasser.",
  },
  {
    id: "crystalline",
    name: "Kristallin / Mineralisch",
    mechanism: "Glasartiges Klingen schwingender Mineralplatten",
    oscillator: "triangle",
    baseFrequencyHz: 2600,
    clickRate: 14,
    description: "Gläsernes Klingen und Schwingungs-Interferenzen.",
  },
];

export function getVocalApparatus(id: VocalApparatusId): VocalApparatus | undefined {
  return VOCAL_APPARATUS.find((a) => a.id === id);
}

/** Phonem-Vorrat je Lautapparat — fremdartige Silben ohne menschliche Artikulation. */
const PHONEME_BANKS: Record<VocalApparatusId, string[]> = {
  insectoid: ["k't", "ss'k", "tik", "zrrt", "kik'k", "sst", "rrik", "tss'k", "chit", "zzk"],
  hydroAcoustic: ["wuu", "ooo'p", "mluu", "hhho", "uu'w", "phoo", "woom", "lhuu", "mmo", "uulp"],
  crystalline: ["shing", "tinn'k", "klin", "ssring", "tzzin", "gliss", "ring'k", "tinn", "zhing", "klinn"],
};

export function getPhonemeBank(apparatusId: VocalApparatusId): string[] {
  return [...(PHONEME_BANKS[apparatusId] ?? PHONEME_BANKS.insectoid)];
}

export interface AlienWord {
  native: string;
  /** Kognitive Sinntranslation für den Leser. */
  translation: string;
  /** Betonung / prosodische Markierung. */
  stress: string;
}

const CONCEPT_POOL = [
  { concept: "Wasser", gloss: "das fließende Gedächtnis" },
  { concept: "Tod", gloss: "das Verstummen vor dem Schwarm" },
  { concept: "Nest", gloss: "der gemeinsame Atem" },
  { concept: "Feind", gloss: "der kalte Geruch" },
  { concept: "Hunger", gloss: "die leere Kammer" },
  { concept: "Licht", gloss: "das obere Brennen" },
  { concept: "Zeit", gloss: "die wandernde Schale" },
  { concept: "Königin", gloss: "die vieläugige Stimme" },
  { concept: "Traum", gloss: "das wandelnde Bild ohne Körper" },
  { concept: "Schwarm", gloss: "die tausendfache Hand" },
  { concept: "Angst", gloss: "das Zittern der Mandibeln" },
  { concept: "Gesang", gloss: "das Reiben der Seelen" },
];

export function generateAlienWord(apparatusId: VocalApparatusId, conceptIndex: number, seed: number = 42): AlienWord {
  const bank = getPhonemeBank(apparatusId);
  const rng = createSeededRandom(hashString(`${apparatusId}:${conceptIndex}:${seed}`));
  const syllables = 1 + Math.floor(rng() * 3);
  let native = "";
  for (let i = 0; i < syllables; i++) {
    native += pick(bank, rng);
    if (i < syllables - 1 && rng() < 0.4) native += "-";
  }
  const entry = CONCEPT_POOL[conceptIndex % CONCEPT_POOL.length];
  const stressIdx = Math.floor(rng() * Math.max(1, syllables));
  const stress = native
    .split("-")
    .map((s, i) => (i === stressIdx ? s.toUpperCase() : s))
    .join("-");
  return { native, translation: entry.gloss, stress };
}

export interface ConlangLexicon {
  apparatus: VocalApparatus;
  words: AlienWord[];
}

export function buildLexicon(apparatusId: VocalApparatusId, count: number = 8, seed: number = 42): ConlangLexicon {
  const apparatus = getVocalApparatus(apparatusId) || VOCAL_APPARATUS[0];
  const total = Math.max(1, Math.min(count, CONCEPT_POOL.length));
  const words: AlienWord[] = [];
  for (let i = 0; i < total; i++) {
    words.push(generateAlienWord(apparatusId, i, seed));
  }
  return { apparatus, words };
}

export interface AlienUtterance {
  apparatus: VocalApparatusId;
  nativeText: string;
  translation: string;
  wordCount: number;
  /** Prosodische Kurve (0..1 je Wort) für die WebAudio-Synthese. */
  prosody: number[];
}

export function synthesizeUtterance(
  apparatusId: VocalApparatusId,
  conceptIndices: number[],
  seed: number = 42
): AlienUtterance {
  const rng = createSeededRandom(hashString(`utt:${apparatusId}:${conceptIndices.join(",")}:${seed}`));
  const words = conceptIndices.map((c, i) => generateAlienWord(apparatusId, c, seed + i));
  const nativeText = words.map((w) => w.stress).join(" … ");
  const translation = words.map((w) => w.translation).join("; ");
  const prosody = words.map(() => Math.round((0.3 + rng() * 0.7) * 100) / 100);
  return {
    apparatus: apparatusId,
    nativeText,
    translation,
    wordCount: words.length,
    prosody,
  };
}

export interface WebAudioPatch {
  oscillator: OscillatorType;
  baseFrequencyHz: number;
  /** FM-Modulationsindex für metallische Klänge. */
  fmIndex: number;
  /** Klickrate (Impulse pro Sekunde). */
  clickRate: number;
  /** Infraschall-Anteil 0..1. */
  infrasoundMix: number;
  /** Nachhall-Dauer in Sekunden. */
  reverbSeconds: number;
  durationSeconds: number;
  /** Menschlich lesbare Synthese-Anweisung. */
  instruction: string;
}

export function buildWebAudioPatch(apparatusId: VocalApparatusId, wordCount: number = 3, seed: number = 42): WebAudioPatch {
  const app = getVocalApparatus(apparatusId) || VOCAL_APPARATUS[0];
  const rng = createSeededRandom(hashString(`patch:${apparatusId}:${wordCount}:${seed}`));

  const fmIndex = apparatusId === "crystalline" ? 8 + rng() * 6 : apparatusId === "insectoid" ? 4 + rng() * 4 : 1 + rng() * 2;
  const infrasoundMix = apparatusId === "hydroAcoustic" ? 0.4 + rng() * 0.4 : rng() * 0.15;
  const reverbSeconds = apparatusId === "hydroAcoustic" ? 2.5 + rng() * 2 : apparatusId === "crystalline" ? 1.5 + rng() : 0.2 + rng() * 0.4;
  const durationSeconds = Math.round((wordCount * (apparatusId === "insectoid" ? 0.6 : 1.2)) * 10) / 10;

  const instruction =
    apparatusId === "insectoid"
      ? `Rechteck-Oszillator @ ${Math.round(app.baseFrequencyHz)} Hz, ${Math.round(app.clickRate)} Klicks/s, kurzer Raum (${reverbSeconds.toFixed(1)}s).`
      : apparatusId === "hydroAcoustic"
        ? `Sinus @ ${Math.round(app.baseFrequencyHz)} Hz mit ${Math.round(infrasoundMix * 100)}% Infraschall, langer Hall (${reverbSeconds.toFixed(1)}s).`
        : `Dreieck-Oszillator @ ${Math.round(app.baseFrequencyHz)} Hz, FM-Index ${fmIndex.toFixed(1)} für gläsernes Klingen.`;

  return {
    oscillator: app.oscillator,
    baseFrequencyHz: app.baseFrequencyHz,
    fmIndex: Math.round(fmIndex * 10) / 10,
    clickRate: app.clickRate,
    infrasoundMix: Math.round(infrasoundMix * 100) / 100,
    reverbSeconds: Math.round(reverbSeconds * 10) / 10,
    durationSeconds,
    instruction,
  };
}

export interface PhonologyReport {
  id: string;
  apparatus: VocalApparatus;
  lexicon: ConlangLexicon;
  utterance: AlienUtterance;
  patch: WebAudioPatch;
}

export function analyzePhonology(
  apparatusId: VocalApparatusId,
  conceptIndices: number[] = [0, 3, 9],
  seed: number = 42
): PhonologyReport {
  const apparatus = getVocalApparatus(apparatusId) || VOCAL_APPARATUS[0];
  const lexicon = buildLexicon(apparatusId, 8, seed);
  const utterance = synthesizeUtterance(apparatusId, conceptIndices, seed);
  const patch = buildWebAudioPatch(apparatusId, utterance.wordCount, seed);
  return {
    id: `XENO-${hashString(`${apparatusId}:${conceptIndices.join(",")}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    apparatus,
    lexicon,
    utterance,
    patch,
  };
}

export function createSamplePhonologyReport(): PhonologyReport {
  return analyzePhonology("insectoid", [0, 3, 9, 5], 42);
}
