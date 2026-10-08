// GlitchCyberpunkSoundscape (WP 113.1)
// Glitch-Cyberpunk- & Netrunning-Soundscape.
// Multi-Oszillator WebAudio, Netrunning-Effekte, Studio-Player.
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

export type SoundscapeLayerId = "bassDrone" | "serverHum" | "glitchImpulse" | "netrunningFeedback" | "hudSignal";

export interface SoundscapeLayer {
  id: SoundscapeLayerId;
  name: string;
  /** Grundfrequenz in Hz. */
  baseFrequency: number;
  /** Modulationsrate in Hz. */
  modulationRate: number;
  /** Modulationstiefe 0..1. */
  modulationDepth: number;
  /** Lautstärke 0..1. */
  gain: number;
  /** Oszillator-Typ. */
  oscillatorType: OscillatorType;
  description: string;
}

export const SOUNDSCAPE_LAYERS: SoundscapeLayer[] = [
  {
    id: "bassDrone",
    name: "Dark-Synth-Bass",
    baseFrequency: 55,
    modulationRate: 0.1,
    modulationDepth: 0.3,
    gain: 0.7,
    oscillatorType: "sawtooth",
    description: "Analoger Sägezahn-Brummen — dunkel, bedrohlich, unaufhaltsam",
  },
  {
    id: "serverHum",
    name: "60-Hz-Serverbrummen",
    baseFrequency: 60,
    modulationRate: 0.05,
    modulationDepth: 0.1,
    gain: 0.5,
    oscillatorType: "sine",
    description: "Industrieller Netzstrom-Brummen von Großrechnern",
  },
  {
    id: "glitchImpulse",
    name: "Bitcrushed Rauschimpuls",
    baseFrequency: 1200,
    modulationRate: 8,
    modulationDepth: 0.8,
    gain: 0.3,
    oscillatorType: "square",
    description: "Digitale Artefakte, Datenkorruption, Bitcrush-Effekte",
  },
  {
    id: "netrunningFeedback",
    name: "Netrunning-Rückkopplung",
    baseFrequency: 440,
    modulationRate: 2,
    modulationDepth: 0.5,
    gain: 0.2,
    oscillatorType: "triangle",
    description: "Akustische Rückkopplung von Datenströmen und Modem-Handshakes",
  },
  {
    id: "hudSignal",
    name: "HUD-Signalton",
    baseFrequency: 880,
    modulationRate: 0.5,
    modulationDepth: 0.2,
    gain: 0.15,
    oscillatorType: "sine",
    description: "Klassische HUD-Signal-Kombinationen und Benachrichtigungstöne",
  },
];

export function getSoundscapeLayer(id: SoundscapeLayerId): SoundscapeLayer | undefined {
  return SOUNDSCAPE_LAYERS.find((l) => l.id === id);
}

export interface SoundscapePreset {
  id: string;
  name: string;
  layers: SoundscapeLayer[];
  /** Gesamtdauer in Sekunden. */
  durationSeconds: number;
  /** Beschreibung des Soundscapes. */
  description: string;
}

export function generateSoundscapePreset(name: string, layerIds: SoundscapeLayerId[], durationSeconds: number = 30, seed: number = 42): SoundscapePreset {
  const layers = layerIds.map((id) => getSoundscapeLayer(id)).filter((l): l is SoundscapeLayer => l !== undefined);
  return {
    id: `SOUND-${hashString(`${name}:${layerIds.join(",")}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    layers,
    durationSeconds: Math.max(5, Math.min(300, durationSeconds)),
    description: `Generatives Cyberpunk-Soundscape mit ${layers.length} Schichten`,
  };
}

export interface WebAudioPatch {
  /** Oszillator-Konfigurationen. */
  oscillators: {
    type: OscillatorType;
    frequency: number;
    gain: number;
    modulationRate: number;
    modulationDepth: number;
  }[];
  /** Gesamtleistung 0..1. */
  masterGain: number;
  /** Sample-Rate (für Referenz). */
  sampleRate: number;
  instruction: string;
}

export function buildWebAudioPatch(preset: SoundscapePreset): WebAudioPatch {
  const oscillators = preset.layers.map((l) => ({
    type: l.oscillatorType,
    frequency: l.baseFrequency,
    gain: l.gain,
    modulationRate: l.modulationRate,
    modulationDepth: l.modulationDepth,
  }));
  const masterGain = Math.min(1, preset.layers.reduce((sum, l) => sum + l.gain, 0) / preset.layers.length);

  return {
    oscillators,
    masterGain: Math.round(masterGain * 100) / 100,
    sampleRate: 44100,
    instruction: `${preset.layers.length} Oszillatoren bei ${preset.durationSeconds}s — Frequenzen ${preset.layers.map((l) => `${l.baseFrequency}Hz`).join(", ")}`,
  };
}

export interface NetrunningEffect {
  id: string;
  name: string;
  /** Dauer in Millisekunden. */
  durationMs: number;
  /** Frequenz in Hz. */
  frequency: number;
  /** Beschreibung des Effekts. */
  description: string;
}

export const NETRUNNING_EFFECTS: NetrunningEffect[] = [
  { id: "handshake", name: "Modem-Handshake", durationMs: 800, frequency: 1200, description: "Klassisches Modem-Handshake-Signal mit Frequenzwechsel" },
  { id: "dataStream", name: "Datenstrom", durationMs: 1500, frequency: 2400, description: "Schnelle Folge von Datenspikes — wie ein Großrechner liest" },
  { id: "firewallBreach", name: "Firewall-Durchbruch", durationMs: 2000, frequency: 800, description: "Tiefer, bedrohlicher Ton — Sicherheitsumgehung" },
  { id: "icePick", name: "ICE-Pick", durationMs: 1200, frequency: 1800, description: "Rhythmisches Klopfen — Intrusions-Kountermeasures-Engagement" },
  { id: "blackwall", name: "Schwarze Wand", durationMs: 3000, frequency: 200, description: "Ultimative Barriere — tiefster, unheimlichster Ton" },
];

export function getNetrunningEffect(id: string): NetrunningEffect | undefined {
  return NETRUNNING_EFFECTS.find((e) => e.id === id);
}

export interface StudioPlayerState {
  isPlaying: boolean;
  currentLayer: SoundscapeLayerId | null;
  elapsedSeconds: number;
  totalSeconds: number;
  /** WebAudio-Patch für die aktuelle Wiedergabe. */
  patch: WebAudioPatch | null;
}

export function createInitialPlayerState(): StudioPlayerState {
  return {
    isPlaying: false,
    currentLayer: null,
    elapsedSeconds: 0,
    totalSeconds: 0,
    patch: null,
  };
}

export function createSampleSoundscapePreset(): SoundscapePreset {
  return generateSoundscapePreset("Neon Rain", ["bassDrone", "serverHum", "glitchImpulse", "hudSignal"], 60, 42);
}

export function createSampleWebAudioPatch(): WebAudioPatch {
  return buildWebAudioPatch(createSampleSoundscapePreset());
}
