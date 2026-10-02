// Ambient-Synthesizer-Service (WP 31.1 — Prozeduraler Ambient-Klangteppich).
//
// Generiert prozedurale Soundscapes für verschiedene Szenen-Typen
// (Regen, Feuer, Taverne, Sci-Fi, binaurale Beats).
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Defensive Fallbacks: fehlende/ungültige Daten werden auf Defaults abgebildet.
// - Gleiche Eingabe ⇒ gleiche Ausgabe (keine Zufallsquellen).
// - Saubere mathematische Puffer ohne Buffer-Underruns.

// --- Types ---------------------------------------------------------------------------

export type AmbientType = "rain" | "fire" | "tavern" | "scifi" | "binaural";

export interface AmbientSound {
  /** Typ des Ambient-Sounds. */
  type: AmbientType;
  /** Dauer in Sekunden. */
  durationSec: number;
  /** Sample-Rate in Hz. */
  sampleRate: number;
  /** PCM-Daten als normalisierte Float-Werte [-1, 1]. */
  data: number[];
}

export interface BinauralConfig {
  /** Basis-Frequenz in Hz (Träger). */
  baseFrequency: number;
  /** Beat-Frequenz in Hz (Differenz zwischen linkem und rechtem Ohr). */
  beatFrequency: number;
  /** Dauer in Sekunden. */
  durationSec: number;
}

// --- Konstanten ----------------------------------------------------------------------

const AMBIENT_TYPES: readonly AmbientType[] = ["rain", "fire", "tavern", "scifi", "binaural"];

/** Standard-Sample-Rate in Hz. */
export const DEFAULT_SAMPLE_RATE = 44100;

/** Standard-Dauer in Sekunden. */
export const DEFAULT_DURATION_SEC = 10;

/** Alpha-Wellen Frequenzbereich in Hz. */
export const ALPHA_MIN_HZ = 8;
export const ALPHA_MAX_HZ = 12;

/** Theta-Wellen Frequenzbereich in Hz. */
export const THETA_MIN_HZ = 4;
export const THETA_MAX_HZ = 8;

/** Standard-Basis-Frequenz für binaurale Beats in Hz. */
export const DEFAULT_BASE_FREQUENCY = 200;

/** Maximale Puffer-Länge in Samples (Sicherheitsgrenze). */
const MAX_BUFFER_SAMPLES = 44100 * 60; // 60 Sekunden bei 44.1kHz

// --- Deterministischer Pseudo-Zufallsgenerator (LCG) --------------------------------

/**
 * Linearer Kongruenz-Generator für deterministische Pseudo-Zufallszahlen.
 * Gleiche Seed ⇒ gleiche Sequenz.
 */
function createLCG(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

// --- Kleine, defensive Helfer --------------------------------------------------------

/** Begrenzt auf [min, max]; NaN/Infinity → min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** true, wenn `value` ein bekannter AmbientType ist. */
function isAmbientType(value: unknown): value is AmbientType {
  return typeof value === "string" && (AMBIENT_TYPES as readonly string[]).includes(value);
}

/** Sanitisiert die Dauer defensiv. */
function sanitizeDuration(durationSec: unknown): number {
  const d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) return DEFAULT_DURATION_SEC;
  return clamp(d, 0.1, 300);
}

// --- 1) generateAmbientSound ----------------------------------------------------------

/**
 * Generiert einen prozeduralen Ambient-Soundscape.
 * Deterministisch: gleiche Parameter ⇒ gleiche PCM-Daten.
 */
export function generateAmbientSound(
  type: AmbientType,
  durationSec: number,
): AmbientSound {
  const safeType: AmbientType = isAmbientType(type) ? type : "rain";
  const safeDuration = sanitizeDuration(durationSec);
  const sampleRate = DEFAULT_SAMPLE_RATE;

  // Berechne die Anzahl der Samples (immer mindestens 1)
  const numSamples = Math.max(1, Math.floor(sampleRate * safeDuration));

  // Sicherheitsgrenze einhalten
  const cappedSamples = Math.min(numSamples, MAX_BUFFER_SAMPLES);

  // Generiere PCM-Daten basierend auf Typ
  const data = generatePCMData(safeType, cappedSamples, sampleRate);

  return {
    type: safeType,
    durationSec: safeDuration,
    sampleRate,
    data,
  };
}

/** Generiert PCM-Daten für den gegebenen Ambient-Typ. */
function generatePCMData(type: AmbientType, numSamples: number, sampleRate: number): number[] {
  const data: number[] = new Array(numSamples);

  switch (type) {
    case "rain":
      generateRain(data, numSamples, sampleRate);
      break;
    case "fire":
      generateFire(data, numSamples, sampleRate);
      break;
    case "tavern":
      generateTavern(data, numSamples, sampleRate);
      break;
    case "scifi":
      generateScifi(data, numSamples, sampleRate);
      break;
    case "binaural":
      generateBinaural(data, numSamples, sampleRate);
      break;
  }

  return data;
}

/** Regen: weißes Rauschen mit Tiefpass-Filterung. */
function generateRain(data: number[], numSamples: number, _sampleRate: number): void {
  const rng = createLCG(42);
  let last = 0;
  const alpha = 0.15; // Tiefpass-Faktor

  for (let i = 0; i < numSamples; i++) {
    const white = rng() * 2 - 1;
    last = last + alpha * (white - last);
    data[i] = last * 0.7; // Lautstärke reduzieren
  }
}

/** Feuer: knisterndes Rauschen mit gelegentlichen Knackern. */
function generateFire(data: number[], numSamples: number, _sampleRate: number): void {
  const rng = createLCG(1337);
  let last = 0;
  const alpha = 0.08;

  for (let i = 0; i < numSamples; i++) {
    const white = rng() * 2 - 1;
    last = last + alpha * (white - last);

    // Gelegentliche Knacker (5% Wahrscheinlichkeit)
    const crackle = rng() < 0.05 ? (rng() * 2 - 1) * 0.5 : 0;

    data[i] = clamp(last * 0.6 + crackle, -1, 1);
  }
}

/** Taverne: warmes, tiefes Rauschen mit leichter Modulation. */
function generateTavern(data: number[], numSamples: number, sampleRate: number): void {
  const rng = createLCG(777);
  let last = 0;
  const alpha = 0.05;

  for (let i = 0; i < numSamples; i++) {
    const white = rng() * 2 - 1;
    last = last + alpha * (white - last);

    // Langsame Amplituden-Modulation (Stimmen-Atmosphäre)
    const t = i / sampleRate;
    const modulation = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t);

    data[i] = clamp(last * modulation * 0.5, -1, 1);
  }
}

/** Sci-Fi: synthetischer Drone mit harmonischen Obertönen. */
function generateScifi(data: number[], numSamples: number, sampleRate: number): void {
  const rng = createLCG(999);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Basis-Drone (tiefe Frequenz)
    const base = Math.sin(2 * Math.PI * 55 * t);

    // Harmonische Obertöne
    const overtone1 = 0.3 * Math.sin(2 * Math.PI * 110 * t);
    const overtone2 = 0.15 * Math.sin(2 * Math.PI * 165 * t);
    const overtone3 = 0.08 * Math.sin(2 * Math.PI * 220 * t);

    // Leichtes Rauschen für Textur
    const noise = (rng() * 2 - 1) * 0.05;

    // Langsame Frequenz-Modulation
    const fm = 1 + 0.1 * Math.sin(2 * Math.PI * 0.2 * t);

    data[i] = clamp((base + overtone1 + overtone2 + overtone3) * fm * 0.4 + noise, -1, 1);
  }
}

/** Binaurale Beats: zwei leicht verschiedene Frequenzen für linkes/rechtes Ohr. */
function generateBinaural(data: number[], numSamples: number, sampleRate: number): void {
  const baseFreq = DEFAULT_BASE_FREQUENCY;
  const beatFreq = 10; // Alpha-Bereich

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Mono-Mischung beider Kanäle (für einfache Wiedergabe)
    const left = Math.sin(2 * Math.PI * baseFreq * t);
    const right = Math.sin(2 * Math.PI * (baseFreq + beatFreq) * t);

    // Mittelwert beider Kanäle
    data[i] = clamp((left + right) * 0.5 * 0.8, -1, 1);
  }
}

// --- 2) coupleSceneToSound -----------------------------------------------------------

/**
 * Wählt basierend auf Szenen-Tags den passenden Ambient-Typ.
 * Defensive Fallbacks: leere/unbekannte Tags → "rain".
 */
export function coupleSceneToSound(sceneTags: string[]): AmbientType {
  if (!Array.isArray(sceneTags) || sceneTags.length === 0) {
    return "rain";
  }

  // Normalisiere Tags (lowercase, trim)
  const normalized = sceneTags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().trim());

  if (normalized.length === 0) {
    return "rain";
  }

  // Tag-Mapping
  const tagMap: Record<string, AmbientType> = {
    // Regen
    regen: "rain",
    rain: "rain",
    regnerisch: "rain",
    gewitter: "rain",
    storm: "rain",
    sturm: "rain",
    // Feuer
    feuer: "fire",
    fire: "fire",
    lagerfeuer: "fire",
    kamin: "fire",
    brand: "fire",
    // Taverne
    taverne: "tavern",
    tavern: "tavern",
    wirtshaus: "tavern",
    kneipe: "tavern",
    bar: "tavern",
    pub: "tavern",
    // Sci-Fi
    scifi: "scifi",
    "sci-fi": "scifi",
    space: "scifi",
    weltraum: "scifi",
    futuristisch: "scifi",
    cyberpunk: "scifi",
    // Binaurale Beats
    binaural: "binaural",
    meditation: "binaural",
    entspannung: "binaural",
    sleep: "binaural",
    schlaf: "binaural",
    focus: "binaural",
    fokus: "binaural",
  };

  // Zähle Vorkommen jedes Typs
  const counts: Record<AmbientType, number> = {
    rain: 0,
    fire: 0,
    tavern: 0,
    scifi: 0,
    binaural: 0,
  };

  for (const tag of normalized) {
    const mapped = tagMap[tag];
    if (mapped) {
      counts[mapped]++;
    }
  }

  // Finde den Typ mit den meisten Vorkommen
  let bestType: AmbientType = "rain";
  let bestCount = 0;

  for (const type of AMBIENT_TYPES) {
    if (counts[type] > bestCount) {
      bestCount = counts[type];
      bestType = type;
    }
  }

  return bestType;
}

// --- 3) getBinauralBeats ------------------------------------------------------------

/**
 * Generiert eine Binaural-Config für Alpha- oder Theta-Wellen.
 * Alpha: 8-12 Hz, Theta: 4-8 Hz.
 */
export function getBinauralBeats(frequency: "alpha" | "theta"): BinauralConfig {
  const safeFreq: "alpha" | "theta" = frequency === "theta" ? "theta" : "alpha";

  const minHz = safeFreq === "alpha" ? ALPHA_MIN_HZ : THETA_MIN_HZ;
  const maxHz = safeFreq === "alpha" ? ALPHA_MAX_HZ : THETA_MAX_HZ;

  // Wähle eine deterministische Frequenz im Bereich (Mitte)
  const beatFrequency = (minHz + maxHz) / 2;

  return {
    baseFrequency: DEFAULT_BASE_FREQUENCY,
    beatFrequency,
    durationSec: DEFAULT_DURATION_SEC,
  };
}
