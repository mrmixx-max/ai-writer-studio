// CinematicFoleyAtmosComposer (WP 121.1 — Meilestone 58.0 / v7.0.0)
//
// Kinematischer Foley- & Raum-Atmosphäre-Komponist für immersives Audio.
// Kombiniert sechs dynamische Foley-Schichten, Szenen-Synchronisation und
// einen Echtzeit-WebAudio-Mixer-Patch.
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Gleiche Eingabe + gleicher Seed ⇒ gleiche Ausgabe (FNV-1a + mulberry32).
// - Keine Node-Module (browser-kompatibel).

// --- Deterministische Primitiven -----------------------------------------------------

/** FNV-1a-Hash über einen String; liefert einen unsigned 32-Bit-Wert. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32-PRNG; liefert eine Funktion, die Werte in [0, 1) erzeugt. */
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

/**
 * Wählt deterministisch ein Element aus `arr`.
 * Wirft bei leerem Array.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("pick: Array darf nicht leer sein");
  }
  const idx = Math.floor(rng() * arr.length) % arr.length;
  return arr[idx];
}

// --- Typen ---------------------------------------------------------------------------

/** Die sechs dynamischen Foley-Schicht-Typen. */
export type FoleyLayerType =
  | "footsteps"
  | "weather"
  | "roomTone"
  | "mechanical"
  | "ambience"
  | "effects";

/** Eine Foley-Schicht mit klanglichen Parametern. */
export interface FoleyLayer {
  id: string;
  name: string;
  description: string;
  /** Basisfrequenz in Hz. */
  baseFrequency: number;
  /** Modulationsrate in Hz. */
  modulationRate: number;
  /** Verstärkung (Gain) 0-1. */
  gain: number;
  layerType: FoleyLayerType;
}

/** Ein einzelner Atmosphäre-Cue, ausgelöst durch ein Signalwort. */
export interface AtmosCue {
  layerId: string;
  trigger: string;
  intensity: number; // 0-1
}

/** Ergebnis der Szenen-Synchronisation. */
export interface SceneAtmosphere {
  matchedLayers: string[];
  cues: AtmosCue[];
  durationSeconds: number;
}

/** Eine Schicht-Eingabe für den Mixer-Patch. */
export interface MixerLayerInput {
  id: string;
  gain: number;
}

/** Ein Oszillator-Eintrag im Mixer-Patch. */
export interface MixerOscillator {
  type: OscillatorType;
  frequency: number;
  gain: number;
}

/** Ergebnis des Mixer-Patch-Builders. */
export interface MixerPatch {
  oscillators: MixerOscillator[];
  masterGain: number;
  instruction: string;
}

// --- 1) Foley-Schichten --------------------------------------------------------------

/** Die sechs dynamischen Foley-Schichten. */
export const FOLEY_LAYERS: readonly FoleyLayer[] = [
  {
    id: "foley-footsteps",
    name: "Schrittuntergründe",
    description: "Fußschritte auf Holz, Stein, Laub oder Schnee.",
    baseFrequency: 220,
    modulationRate: 2.5,
    gain: 0.45,
    layerType: "footsteps",
  },
  {
    id: "foley-weather",
    name: "Wetter",
    description: "Wind, Regen, Donner und aufziehende Stürme.",
    baseFrequency: 160,
    modulationRate: 0.4,
    gain: 0.6,
    layerType: "weather",
  },
  {
    id: "foley-roomtone",
    name: "Raumhall",
    description: "Hall und Nachklang von Kathedralen, Hallen und Kellern.",
    baseFrequency: 110,
    modulationRate: 0.2,
    gain: 0.35,
    layerType: "roomTone",
  },
  {
    id: "foley-mechanical",
    name: "Mechanische Geräusche",
    description: "Räder, Ketten, Rüstungen und Hebemechanik.",
    baseFrequency: 300,
    modulationRate: 3.0,
    gain: 0.4,
    layerType: "mechanical",
  },
  {
    id: "foley-ambience",
    name: "Umgebungsgeräusche",
    description: "Grundrauschen, ferne Stimmen und Landschaftsbett.",
    baseFrequency: 90,
    modulationRate: 0.15,
    gain: 0.3,
    layerType: "ambience",
  },
  {
    id: "foley-effects",
    name: "Soundeffekte",
    description: "Akzentuierte Einzeleffekte wie Fackelzischen oder Knacken.",
    baseFrequency: 480,
    modulationRate: 4.0,
    gain: 0.5,
    layerType: "effects",
  },
];

// --- 2) Szenen-Synchronisation -------------------------------------------------------

/** Signalwort → Foley-Schicht-Zuordnung. */
interface SignalRule {
  word: string;
  layerId: string;
  trigger: string;
}

const SIGNAL_RULES: readonly SignalRule[] = [
  { word: "Schnee", layerId: "foley-footsteps", trigger: "gedämpfte Schritte im Schnee" },
  { word: "Wind", layerId: "foley-weather", trigger: "heulender Wind" },
  { word: "Regen", layerId: "foley-weather", trigger: "prasselnder Regen" },
  { word: "Marmor", layerId: "foley-footsteps", trigger: "klare Schritte auf Marmor" },
  { word: "Kathedrale", layerId: "foley-roomtone", trigger: "weiter Kathedralhall" },
  { word: "Fackel", layerId: "foley-effects", trigger: "zischende Fackel" },
  { word: "Rüstung", layerId: "foley-mechanical", trigger: "klirrende Rüstung" },
];

/**
 * Synchronisiert einen Szenen-Text mit der Foley-Atmosphäre.
 * Erkennt Signalwörter und ordnet passende Hintergrundgeräusche zu.
 * Deterministisch: gleicher Text + gleicher Seed ⇒ gleiches Ergebnis.
 */
export function syncSceneToAtmosphere(text: string, seed: number): SceneAtmosphere {
  const rng = createSeededRandom(hashString(text) ^ (seed >>> 0));
  const haystack = typeof text === "string" ? text : "";

  const matchedLayers: string[] = [];
  const cues: AtmosCue[] = [];

  for (const rule of SIGNAL_RULES) {
    if (haystack.includes(rule.word)) {
      if (!matchedLayers.includes(rule.layerId)) {
        matchedLayers.push(rule.layerId);
      }
      const intensity = Math.round((0.5 + rng() * 0.5) * 100) / 100;
      cues.push({ layerId: rule.layerId, trigger: rule.trigger, intensity });
    }
  }

  // Grunddauer: wächst mit der Textlänge, deterministisch begrenzt.
  const words = haystack.split(/\s+/).filter((w) => w.length > 0).length;
  const baseDuration = 8 + words * 0.75;
  const jitter = rng() * 4;
  const durationSeconds = Math.round((baseDuration + jitter) * 10) / 10;

  return { matchedLayers, cues, durationSeconds };
}

// --- 3) Echtzeit-WebAudio-Mixer ------------------------------------------------------

/**
 * Baut einen WebAudio-Mixer-Patch aus den gewünschten Schichten.
 * Deterministisch: gleiche Schichten + gleiche Dauer ⇒ gleicher Patch.
 */
export function buildMixerPatch(
  layers: readonly MixerLayerInput[],
  durationSeconds: number,
): MixerPatch {
  const safeLayers = Array.isArray(layers) ? layers : [];
  const safeDuration =
    Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 10;

  const oscillators: MixerOscillator[] = [];
  let gainSum = 0;

  for (const layer of safeLayers) {
    const profile = FOLEY_LAYERS.find((l) => l.id === layer.id);
    const seed = hashString(layer.id) ^ (safeDuration * 1000) >>> 0;
    const rng = createSeededRandom(seed);

    const base = profile ? profile.baseFrequency : 200;
    const mod = profile ? profile.modulationRate : 1;
    const profileGain = profile ? profile.gain : 0.3;

    const requestedGain = Number.isFinite(layer.gain) ? layer.gain : profileGain;
    const gain = Math.min(1, Math.max(0, requestedGain));

    const types: readonly OscillatorType[] = ["sine", "triangle", "sawtooth", "square"];
    const type = pick(types, rng);
    const frequency = Math.round((base + mod * (1 + rng())) * 100) / 100;

    oscillators.push({ type, frequency, gain });
    gainSum += gain;
  }

  const masterGain =
    oscillators.length === 0
      ? 0
      : Math.round(Math.min(1, gainSum / oscillators.length) * 100) / 100;

  const instruction =
    oscillators.length === 0
      ? "Keine Schichten: Mixer bleibt stumm."
      : `WebAudio: ${oscillators.length} Oszillator(en) auf Master-Gain ` +
        `${masterGain} mischen, Dauer ${safeDuration}s, mit Fade-in/out versehen.`;

  return { oscillators, masterGain, instruction };
}

// --- Beispiel-Fabriken ---------------------------------------------------------------

/** Erstellt eine Beispiel-Szene mit Signalwörtern. */
export function createSampleScene(): SceneAtmosphere {
  const text =
    "Schnee fiel auf den Marmor der Kathedrale, während Wind durch die " +
    "Gänge heulte und eine Fackel flackerte; ferne Rüstung klirrte.";
  return syncSceneToAtmosphere(text, 42);
}

/** Erstellt einen Beispiel-Mixer-Patch über alle sechs Foley-Schichten. */
export function createSampleMixerPatch(): MixerPatch {
  const layers: MixerLayerInput[] = FOLEY_LAYERS.map((l) => ({ id: l.id, gain: l.gain }));
  return buildMixerPatch(layers, 30);
}
