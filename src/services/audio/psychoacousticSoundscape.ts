// PsychoacousticSoundscape (WP 85.1)
//
// Psychoakustischer Flow-State-Synthesizer mit binauralen Beats
// und prozeduralen Naturgeräuschen. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

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

/** Binaural-Frequenz. */
export type BinauralFreq = "gamma" | "alpha" | "theta" | "delta" | "beta";

/** Naturgeräusch-Typ. */
export type NatureSound = "fire" | "rain" | "ocean" | "library" | "forest" | "wind";

/** Eine Klanglandschaft. */
export interface Soundscape {
  id: string;
  name: string;
  binauralFreq: BinauralFreq;
  carrierFreq: number;      // Trägerfrequenz in Hz
  beatFreq: number;         // Beat-Frequenz in Hz
  natureSounds: NatureSound[];
  natureVolumes: number[];  // 0-1
  durationMinutes: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

/** Binaural-Presets. */
export const BINAURAL_PRESETS: Record<BinauralFreq, { carrier: number; beat: number; label: string }> = {
  gamma: { carrier: 200, beat: 40, label: "Gamma (40 Hz) - Konzentration" },
  alpha: { carrier: 200, beat: 10, label: "Alpha (10 Hz) - Kreativität" },
  theta: { carrier: 200, beat: 6, label: "Theta (6 Hz) - Träumen" },
  delta: { carrier: 200, beat: 2, label: "Delta (2 Hz) - Tiefschlaf" },
  beta: { carrier: 200, beat: 15, label: "Beta (15 Hz) - Aufmerksamkeit" },
};

/** Naturgeräusch-Profile. */
export const NATURE_PROFILES: Record<NatureSound, { baseFreq: number; modulation: number; label: string }> = {
  fire: { baseFreq: 200, modulation: 0.3, label: "Kaminfeuer" },
  rain: { baseFreq: 500, modulation: 0.5, label: "Regen auf Ziegeldach" },
  ocean: { baseFreq: 100, modulation: 0.2, label: "Meeresbrandung" },
  library: { baseFreq: 800, modulation: 0.1, label: "Bibliothekssausen" },
  forest: { baseFreq: 400, modulation: 0.4, label: "Waldambiente" },
  wind: { baseFreq: 150, modulation: 0.6, label: "Wind in den Bäumen" },
};

/** Erstellt eine Klanglandschaft. */
export function createSoundscape(
  name: string,
  binauralFreq: BinauralFreq,
  natureSounds: NatureSound[],
  durationMinutes: number = 45,
  seed: number = 42
): Soundscape {
  const rng = createSeededRandom(seed);
  const preset = BINAURAL_PRESETS[binauralFreq];
  const natureVolumes = natureSounds.map(() => 0.3 + rng() * 0.5);

  return {
    id: `ss-${hashString(name + seed).toString(16).padStart(8, "0")}`,
    name,
    binauralFreq,
    carrierFreq: preset.carrier,
    beatFreq: preset.beat,
    natureSounds,
    natureVolumes,
    durationMinutes,
    fadeInSeconds: 10,
    fadeOutSeconds: 20,
  };
}

/** Berechnet die binaurale Frequenz in Hz. */
export function computeBinauralFrequency(carrier: number, beat: number): number {
  return carrier + beat / 2;
}

/** Formatiert eine Klanglandschaft als Text. */
export function formatSoundscape(soundscape: Soundscape): string {
  const lines: string[] = [];
  lines.push(`=== KLANG LANDSCHAFT: ${soundscape.name} ===`);
  lines.push(`Binaural: ${BINAURAL_PRESETS[soundscape.binauralFreq].label}`);
  lines.push(`Träger: ${soundscape.carrierFreq} Hz`);
  lines.push(`Beat: ${soundscape.beatFreq} Hz`);
  lines.push(`Dauer: ${soundscape.durationMinutes} Min`);
  lines.push(`Fade-in: ${soundscape.fadeInSeconds}s, Fade-out: ${soundscape.fadeOutSeconds}s`);
  lines.push("");
  lines.push("Naturgeräusche:");
  for (let i = 0; i < soundscape.natureSounds.length; i++) {
    const ns = soundscape.natureSounds[i];
    const vol = Math.round(soundscape.natureVolumes[i] * 100);
    lines.push(`  ${NATURE_PROFILES[ns].label}: ${vol}%`);
  }
  return lines.join("\n");
}

/** Erstellt eine Beispiel-Klanglandschaft. */
export function createSampleSoundscape(): Soundscape {
  return createSoundscape(
    "Tiefes Schreiben",
    "alpha",
    ["fire", "rain"],
    45,
    42
  );
}