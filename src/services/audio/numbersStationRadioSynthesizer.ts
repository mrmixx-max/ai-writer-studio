// numbersStationRadioSynthesizer.ts
// Kurzwellen-Synthesizer für Spionage-Fiktion (Kalter-Krieg-Station).
// FNV-1a Hash, mulberry32 PRNG, Radio-Atmosphäre, synthetische Zahlen-Stimme und Player.

// ─── Utility-Typen ─────────────────────────────────────────

export interface RadioOscillator {
  type: OscillatorType;
  frequency: number;
  gain: number;
}

export interface RadioAtmosphere {
  oscillators: RadioOscillator[];
  noiseLevel: number;
  fadingRate: number;
  description: string;
}

export type VoiceType = 'female' | 'male' | 'robot';

export interface NumbersTransmission {
  blocks: string[];
  intro: string;
  outro: string;
  voiceType: VoiceType;
  frequency: string;
}

export interface RadioPlayerState {
  isPlaying: boolean;
  currentBlock: number;
  totalBlocks: number;
  elapsedSeconds: number;
  totalSeconds: number;
  frequency: string;
}

export interface WebAudioPatch {
  oscillators: RadioOscillator[];
  noiseLevel: number;
  gainNodes: { id: string; gain: number }[];
  connections: { from: string; to: string }[];
}

// ─── PRNG ───────────────────────────────────────────────────

/**
 * FNV-1a Hash (32-bit) — berechnet einen deterministischen unsigned 32-bit Hash.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0; // FNV prime
  }
  return hash >>> 0;
}

/**
 * mulberry32 PRNG — liefert eine Funktion, die [0,1) Zahlen erzeugt.
 */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wählt ein zufälliges Element aus einem Array. Wirft Fehler bei leerem Array.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error('pick(): leeres Array');
  return arr[Math.floor(rng() * arr.length)];
}

// ─── WP 119.1 — Kurzwellen-Atmosphäre ─────────────────────

export function buildRadioAtmosphere(): RadioAtmosphere {
  return {
    oscillators: [
      { type: 'sine', frequency: 440, gain: 0.15 },
      { type: 'triangle', frequency: 880, gain: 0.08 },
      { type: 'sine', frequency: 1200, gain: 0.05 },
    ],
    noiseLevel: 0.03,
    fadingRate: 0.7,
    description: 'Ionosphärisches Flackern mit statischem Rauschen und Abstimm-Pfeifton.',
  };
}

// ─── WP 119.1 — Synthetische Zahlen-Stimme ─────────────────

const GERMAN_DIGITS: readonly string[] = [
  'Zero', 'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun',
];

const INTRO_FANFARE = '♫ Spieldosen-Fanfare: Ding-ding-ding-ding-ding ♫';
const OUTRO_TEXT = 'Ende der Übertragung';

function numberBlock(rng: () => number, size: number): string {
  const parts: string[] = [];
  for (let i = 0; i < size; i++) {
    parts.push(pick(GERMAN_DIGITS, rng));
  }
  return parts.join('-');
}

export function generateNumbersTransmission(
  seed: number,
  blockCount: number = 3,
): NumbersTransmission {
  const rng = createSeededRandom(hashString('numbers:' + seed));
  const voiceType = pick(['female', 'male', 'robot'] as const, rng) as VoiceType;
  const frequency = `${(5 + Math.floor(rng() * 10))}.${String(Math.floor(rng() * 999)).padStart(3, '0')} MHz`;

  const blocks: string[] = [];
  for (let b = 0; b < blockCount; b++) {
    blocks.push(numberBlock(rng, 5));
  }

  return {
    blocks,
    intro: INTRO_FANFARE,
    outro: OUTRO_TEXT,
    voiceType,
    frequency,
  };
}

// ─── WP 119.1 — Interaktiver Spionage-Radio-Player ────────

export function createRadioPlayerState(): RadioPlayerState {
  return {
    isPlaying: false,
    currentBlock: 0,
    totalBlocks: 3,
    elapsedSeconds: 0,
    totalSeconds: 180,
    frequency: '7.425 MHz',
  };
}

export function buildRadioPlayerPatch(state: RadioPlayerState): WebAudioPatch {
  const atmosphere = buildRadioAtmosphere();

  return {
    oscillators: [
      ...atmosphere.oscillators,
      { type: 'sine', frequency: parseFloat(state.frequency), gain: state.isPlaying ? 0.2 : 0 },
    ],
    noiseLevel: state.isPlaying ? atmosphere.noiseLevel : 0,
    gainNodes: [
      { id: 'master', gain: state.isPlaying ? 1 : 0 },
      { id: 'fading', gain: 1 - atmosphere.fadingRate * 0.3 },
    ],
    connections: state.isPlaying
      ? [
          { from: 'osc-0', to: 'master' },
          { from: 'noise', to: 'fading' },
          { from: 'fading', to: 'master' },
        ]
      : [],
  };
}

// ─── Factory-Funktionen ────────────────────────────────────

export function createSampleTransmission(): NumbersTransmission {
  return generateNumbersTransmission(hashString('sample'));
}

export function createSampleRadioPlayerState(): RadioPlayerState {
  const state = createRadioPlayerState();
  state.isPlaying = true;
  state.currentBlock = 1;
  state.elapsedSeconds = 42;
  return state;
}
