// TonalIllusionSynthesizer (WP 107.1)
// Shepard-Tone- & Akustik-Illusionen-Synthesizer.
// Shepard-Ton-Generator, akustische Pareidolie, WebAudio-Echtzeit-Parameter.
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

/** Zentrale Frequenz des Shepard-Tons (Hz) und Hörbereich. */
export const SHEPARD_CENTER_HZ = 440;
export const SHEPARD_MIN_HZ = 40;
export const SHEPARD_MAX_HZ = 8000;

/** Gaußsche Amplituden-Hüllkurve über log₂(f/center) — erzeugt die endlose Tonleiter. */
export function gaussianEnvelope(frequencyHz: number, centerHz: number = SHEPARD_CENTER_HZ, sigma: number = 1.1): number {
  if (frequencyHz <= 0 || centerHz <= 0) return 0;
  const x = Math.log2(frequencyHz / centerHz);
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

export interface ShepardPartial {
  /** Frequenz in Hz. */
  frequencyHz: number;
  /** Oktavlage relativ zur Zentrale (−3..+3). */
  octave: number;
  /** Gaußsche Amplitude 0..1. */
  amplitude: number;
}

/**
 * Baut die Partialtöne eines Shepard-Tons für eine gegebene Tonhöhenklasse (0..1).
 * 0 entspricht der Zentrale, 1 dem Ende der Oktave — die Partialtöne rotieren oktavweise.
 */
export function buildShepardPartials(step: number, sigma: number = 1.1): ShepardPartial[] {
  const clamped = ((step % 1) + 1) % 1;
  const semitoneOffset = clamped * 12; // 0..12 Halbtöne
  const partials: ShepardPartial[] = [];
  for (let octave = -3; octave <= 3; octave++) {
    const frequencyHz = SHEPARD_CENTER_HZ * Math.pow(2, octave + semitoneOffset / 12);
    if (frequencyHz < SHEPARD_MIN_HZ || frequencyHz > SHEPARD_MAX_HZ) continue;
    partials.push({
      frequencyHz: Math.round(frequencyHz * 100) / 100,
      octave,
      amplitude: Math.round(gaussianEnvelope(frequencyHz, SHEPARD_CENTER_HZ, sigma) * 1000) / 1000,
    });
  }
  return partials;
}

export interface ShepardTone {
  id: string;
  step: number;
  partials: ShepardPartial[];
  /** Anzahl der Partialtöne (typisch 7 für ±3 Oktaven). */
  partialCount: number;
  /** Gesamtenergie der Hüllkurve. */
  energy: number;
  direction: "ascending" | "descending";
}

export function synthesizeShepardTone(step: number, direction: "ascending" | "descending" = "ascending", sigma: number = 1.1): ShepardTone {
  const partials = buildShepardPartials(step, sigma);
  const energy = Math.round(partials.reduce((s, p) => s + p.amplitude, 0) * 1000) / 1000;
  return {
    id: `SHEPARD-${hashString(`${step}:${direction}:${sigma}`).toString(16).padStart(8, "0").toUpperCase()}`,
    step: Math.round(((step % 1) + 1) % 1 * 1000) / 1000,
    partials,
    partialCount: partials.length,
    energy,
    direction,
  };
}

/** Erzeugt eine vollständige (scheinbar endlose) Tonleiter als Sequenz von Schritten. */
export function buildEndlessScale(steps: number = 12, direction: "ascending" | "descending" = "ascending", sigma: number = 1.1): ShepardTone[] {
  const total = Math.max(1, Math.floor(steps));
  const tones: ShepardTone[] = [];
  for (let i = 0; i < total; i++) {
    // Absteigend läuft die Tonhöhenklasse rückwärts; die Oktavlage rotiert weiter aufwärts.
    const raw = direction === "ascending" ? i / total : (total - i - 1) / total;
    tones.push(synthesizeShepardTone(raw, direction, sigma));
  }
  return tones;
}

export type PareidoliaSourceId = "rain" | "wind" | "crowd" | "machinery";

export interface PareidoliaSource {
  id: PareidoliaSourceId;
  name: string;
  /** Trägerrauschen: Filtertyp für die WebAudio-Kette. */
  filterType: BiquadFilterType;
  cutoffHz: number;
  /** Bandbreite der Formant-Modulation in Hz. */
  formantHz: number;
}

export const PAREIDOLIA_SOURCES: PareidoliaSource[] = [
  { id: "rain", name: "Regenrauschen", filterType: "bandpass", cutoffHz: 1200, formantHz: 380 },
  { id: "wind", name: "Windrauschen", filterType: "lowpass", cutoffHz: 800, formantHz: 240 },
  { id: "crowd", name: "Schenkengemurmel", filterType: "bandpass", cutoffHz: 900, formantHz: 520 },
  { id: "machinery", name: "Maschinenbrummen", filterType: "highpass", cutoffHz: 300, formantHz: 160 },
];

export function getPareidoliaSource(id: PareidoliaSourceId): PareidoliaSource | undefined {
  return PAREIDOLIA_SOURCES.find((s) => s.id === id);
}

export interface PareidoliaLoop {
  id: string;
  source: PareidoliaSource;
  /** Die scheinbar geflüsterten Silben im Rauschen. */
  whisperedSyllables: string[];
  /** Modulationsrate in Hz (0.5–4 Hz wirkt wie flüsternde Sprache). */
  modulationRateHz: number;
  /** Verstärkung der Formanten 0..1. */
  formantGain: number;
  instruction: string;
}

const WHISPER_SYLLABLES = [
  "horch", "komm", "näher", "warum", "hinter", "dir", "nicht", "um",
  "dreh", "dich", "um", "wer", "da", "ist", "bleib", "still",
  "eins", "zwei", "drei", "noch", "nicht", "jetzt", "gleich", "vorbei",
];

export function generatePareidoliaLoop(sourceId: PareidoliaSourceId, syllableCount: number = 3, seed: number = 42): PareidoliaLoop {
  const source = getPareidoliaSource(sourceId) || PAREIDOLIA_SOURCES[0];
  const rng = createSeededRandom(hashString(`parei:${sourceId}:${seed}`));
  const total = Math.max(1, Math.min(syllableCount, WHISPER_SYLLABLES.length));
  const syllables: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (syllables.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * WHISPER_SYLLABLES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    syllables.push(WHISPER_SYLLABLES[idx]);
  }
  const modulationRateHz = Math.round((0.5 + rng() * 3.5) * 100) / 100;
  const formantGain = Math.round((0.4 + rng() * 0.5) * 100) / 100;
  return {
    id: `PAREI-${hashString(`${sourceId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    source,
    whisperedSyllables: syllables,
    modulationRateHz,
    formantGain,
    instruction: `${source.name} über ${source.filterType} @ ${source.cutoffHz} Hz, Formant ${source.formantHz} Hz, Modulation ${modulationRateHz} Hz.`,
  };
}

export interface IllusionPlayerState {
  id: string;
  shepardTones: ShepardTone[];
  pareidolia: PareidoliaLoop;
  masterGain: number;
  /** Dauer einer vollständigen Illusionsschleife in Sekunden. */
  loopSeconds: number;
  instruction: string;
}

export function buildIllusionPlayerState(
  steps: number = 12,
  sourceId: PareidoliaSourceId = "rain",
  seed: number = 42
): IllusionPlayerState {
  const shepardTones = buildEndlessScale(steps, "ascending");
  const pareidolia = generatePareidoliaLoop(sourceId, 3, seed);
  const rng = createSeededRandom(hashString(`player:${steps}:${sourceId}:${seed}`));
  const masterGain = Math.round((0.5 + rng() * 0.4) * 100) / 100;
  const loopSeconds = Math.round(steps * 0.25 * 10) / 10;
  return {
    id: `ILLUSION-${hashString(`${steps}:${sourceId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    shepardTones,
    pareidolia,
    masterGain,
    loopSeconds,
    instruction: `Shepard-Leiter über ${steps} Schritte (${loopSeconds}s pro Umlauf), Grundpegel ${masterGain}.`,
  };
}

export interface IllusionReport {
  id: string;
  player: IllusionPlayerState;
  /** Durchschnittliche Energie der Hüllkurve über die Leiter. */
  averageEnergy: number;
  /** Anzahl der Schritte mit voller 7-Oktaven-Deckung. */
  fullCoverageSteps: number;
  pitchClassCoverage: number;
}

export function analyzeIllusion(steps: number = 12, sourceId: PareidoliaSourceId = "rain", seed: number = 42): IllusionReport {
  const player = buildIllusionPlayerState(steps, sourceId, seed);
  const tones = player.shepardTones;
  const averageEnergy =
    tones.length > 0 ? Math.round((tones.reduce((s, t) => s + t.energy, 0) / tones.length) * 1000) / 1000 : 0;
  const fullCoverageSteps = tones.filter((t) => t.partialCount >= 7).length;
  const distinctSteps = new Set(tones.map((t) => t.step)).size;
  const pitchClassCoverage = tones.length > 0 ? Math.round((distinctSteps / tones.length) * 100) : 0;
  return {
    id: `ILLREPORT-${hashString(`${steps}:${sourceId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    player,
    averageEnergy,
    fullCoverageSteps,
    pitchClassCoverage,
  };
}

export function createSampleShepardTone(): ShepardTone {
  return synthesizeShepardTone(0, "ascending");
}

export function createSampleIllusionReport(): IllusionReport {
  return analyzeIllusion(12, "rain", 42);
}
