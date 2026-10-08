// FearFrequencySynthesizer (WP 117.1, Meilenstein 56.0 / v6.8.0)
//
// Infraschall- & Angst-Frequenz-Synthesizer für Horror-Fiktion.
// WebAudio-Infraschall-Patch (18.9 Hz), EVP-Stimmenphänomene und ein
// interaktiver Grusel-Player. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module — browserkompatibel.

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

/** Wählt ein zufälliges Element; wirft bei leerem Array. */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}

/** Untere Hörschwelle: Infraschall liegt darunter. */
export const HEARING_THRESHOLD_HZ = 20;
/** Ziel-Infraschallfrequenz in Hz — löst Augapfel-Vibration und Urangst aus. */
export const FEAR_FREQUENCY_HZ = 18.9;
/** Binauraler Versatz in Hz zwischen den beiden Infraschall-Oszillatoren. */
export const BINAURAL_OFFSET_HZ = 0.1;

/** Ein einzelner Oszillator eines WebAudio-Patches. */
export interface FearOscillator {
  type: OscillatorType;
  frequency: number;
  gain: number;
}

/** WebAudio-Patch-Konfiguration für den Infraschall-Synthesizer. */
export interface InfrasoundPatch {
  oscillators: FearOscillator[];
  masterGain: number;
  durationSeconds: number;
  instruction: string;
}

/**
 * Baut einen WebAudio-Infraschall-Patch. Zwei Oszillatoren bilden ein
 * binaurales Beat-Paar bei 18.9 Hz und 18.9 + 0.1 Hz — unter der Hörschwelle,
 * aber spürbar als körperliche Beklemmung.
 */
export function buildInfrasoundPatch(baseFrequency: number = FEAR_FREQUENCY_HZ): InfrasoundPatch {
  const base = baseFrequency > 0 ? baseFrequency : FEAR_FREQUENCY_HZ;
  const oscillators: FearOscillator[] = [
    { type: "sine", frequency: Math.round(base * 1000) / 1000, gain: 0.5 },
    { type: "sine", frequency: Math.round((base + BINAURAL_OFFSET_HZ) * 1000) / 1000, gain: 0.5 },
  ];
  const instruction =
    `Zwei Sinus-Oszillatoren bei ${oscillators[0].frequency} Hz und ${oscillators[1].frequency} Hz ` +
    `(binauraler Versatz ${BINAURAL_OFFSET_HZ} Hz). Beide liegen unter ${HEARING_THRESHOLD_HZ} Hz, ` +
    `also unterhalb der Hörschwelle — nicht hörbar, aber als Augapfel-Vibration und Urangst spürbar. ` +
    `Master-Gain niedrig halten und nur über Kopfhörer bzw. subwoofer-fähige Wiedergabe abspielen.`;
  return {
    oscillators,
    masterGain: 0.18,
    durationSeconds: 90,
    instruction,
  };
}

/** Hintergrundgeräusch-Typ der EVP-Aufnahme. */
export type EVPBackgroundNoise = "wind" | "rain" | "static";

/** Elektronische Stimmenphänomene (Electronic Voice Phenomena). */
export interface EVPRecording {
  whisper: string;
  backgroundNoise: EVPBackgroundNoise;
  clarity: number;      // 0-1
  durationMs: number;
  description: string;
}

const EVP_SYLLABLES = [
  "horch", "komm", "nä", "her", "war", "um", "hin", "ter", "dir", "nicht",
  "dreh", "dich", "um", "wer", "da", "ist", "bleib", "still", "kalt", "dunkel",
  "eins", "zwei", "drei", "noch", "je", "tzt", "gleich", "vor", "bei", "hilf",
];

const EVP_NOISES: EVPBackgroundNoise[] = ["wind", "rain", "static"];

const EVP_NOISE_LABEL: Record<EVPBackgroundNoise, string> = {
  wind: "Windrauschen",
  rain: "Regenrauschen",
  static: "Bandrauschen",
};

/**
 * Erzeugt ein EVP-Phänomen: geflüsterte Silbenfragmente in diffusem
 * Hintergrundrauschen. Deterministisch über den Seed.
 */
export function generateEVP(seed: number): EVPRecording {
  const rng = createSeededRandom(hashString(`evp:${seed}`));

  const fragmentCount = 2 + Math.floor(rng() * 4); // 2-5 Silben
  const parts: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (parts.length < fragmentCount && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * EVP_SYLLABLES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    parts.push(EVP_SYLLABLES[idx]);
  }
  const whisper = parts.join("… ");

  const backgroundNoise = pick(EVP_NOISES, rng);
  // Klarheit: meist niedrig (schwer verständlich), gelegentlich klar.
  const clarity = Math.round((0.15 + rng() * 0.6) * 100) / 100;
  const durationMs = Math.round((800 + rng() * 4200) / 10) * 10;

  const description =
    `Geflüsterte Silbenfragmente („${whisper}“) eingebettet in ${EVP_NOISE_LABEL[backgroundNoise]}. ` +
    `Klarheit ${Math.round(clarity * 100)}% — die Silben sind nur bei leiser, ` +
    `wiederholter Wiedergabe als Sprache deutbar. Dauer ${durationMs} ms.`;

  return {
    whisper,
    backgroundNoise,
    clarity,
    durationMs,
    description,
  };
}

/** Zustand des interaktiven Grusel-Players. */
export interface FearPlayerState {
  isPlaying: boolean;
  currentFrequency: number;
  elapsedSeconds: number;
  totalSeconds: number;
  intensity: number;
}

/** Erstellt einen frischen Grusel-Player-Zustand (nicht spielend). */
export function createFearPlayerState(): FearPlayerState {
  return {
    isPlaying: false,
    currentFrequency: FEAR_FREQUENCY_HZ,
    elapsedSeconds: 0,
    totalSeconds: 90,
    intensity: 0,
  };
}

/** WebAudio-Patch des Grusel-Players, abgeleitet aus dem Player-Zustand. */
export interface FearPlayerPatch {
  oscillators: FearOscillator[];
  masterGain: number;
  /** Fortschritt 0-1 aus elapsed/total. */
  progress: number;
  /** Verbleibende Sekunden. */
  remainingSeconds: number;
  /** Effektive Frequenz inklusive binauralem Versatz. */
  binauralFrequency: number;
  instruction: string;
}

/**
 * Baut aus einem Player-Zustand die passende WebAudio-Konfiguration.
 * Die Intensität steuert den Master-Gain, der Fortschritt die Restzeit.
 */
export function buildFearPlayerPatch(state: FearPlayerState): FearPlayerPatch {
  const total = state.totalSeconds > 0 ? state.totalSeconds : 1;
  const progress = Math.max(0, Math.min(1, state.elapsedSeconds / total));
  const remainingSeconds = Math.max(0, Math.round((total - state.elapsedSeconds) * 10) / 10);
  const base = state.currentFrequency > 0 ? state.currentFrequency : FEAR_FREQUENCY_HZ;
  const intensity = Math.max(0, Math.min(1, state.intensity));

  const oscillators: FearOscillator[] = [
    { type: "sine", frequency: Math.round(base * 1000) / 1000, gain: Math.round((0.4 + intensity * 0.4) * 100) / 100 },
    { type: "sine", frequency: Math.round((base + BINAURAL_OFFSET_HZ) * 1000) / 1000, gain: Math.round((0.4 + intensity * 0.4) * 100) / 100 },
  ];
  const masterGain = Math.round((0.08 + intensity * 0.32) * 100) / 100;

  const instruction = state.isPlaying
    ? `Wiedergabe läuft: ${oscillators[0].frequency} Hz + binauraler Versatz, Intensität ${Math.round(intensity * 100)}%, ` +
      `noch ${remainingSeconds}s (${Math.round(progress * 100)}% abgespielt).`
    : `Player pausiert bei ${oscillators[0].frequency} Hz, Intensität ${Math.round(intensity * 100)}%. ` +
      `Auf Wiedergabe starten, um die Urangst-Frequenz abzuspielen.`;

  return {
    oscillators,
    masterGain,
    progress: Math.round(progress * 1000) / 1000,
    remainingSeconds,
    binauralFrequency: Math.round((base + BINAURAL_OFFSET_HZ) * 1000) / 1000,
    instruction,
  };
}

/** Beispiel-Infraschall-Patch mit Standard-Furchtfrequenz. */
export function createSampleInfrasoundPatch(): InfrasoundPatch {
  return buildInfrasoundPatch(FEAR_FREQUENCY_HZ);
}

/** Beispiel-EVP-Aufnahme mit festem Seed. */
export function createSampleEVP(): EVPRecording {
  return generateEVP(42);
}
