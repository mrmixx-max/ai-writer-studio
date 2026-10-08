// SeaShantySynthesizer (WP 108.2)
// Shantychor- & Spill-Arbeitslied-Synthesizer.
// 3 Shanty-Gattungen, Seemanns-Vokabular, WebAudio-Rhythmus-Parameter.
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

export type ShantyGenreId = "halyard" | "capstan" | "whaling";

export interface ShantyGenre {
  id: ShantyGenreId;
  name: string;
  purpose: string;
  /** Taktart, z. B. "4/4". */
  timeSignature: string;
  /** Tempo in Schlägen pro Minute. */
  tempoBpm: number;
  /** Betonte Zählzeiten für den Chor-Akzent. */
  accentBeats: number[];
  /** Tongeschlecht. */
  mode: "dur" | "moll";
}

export const SHANTY_GENRES: ShantyGenre[] = [
  {
    id: "halyard",
    name: "Halyard Shanty",
    purpose: "Zum Segelsetzen — Zug auf den Fallen.",
    timeSignature: "4/4",
    tempoBpm: 96,
    accentBeats: [2, 4],
    mode: "dur",
  },
  {
    id: "capstan",
    name: "Capstan / Spill Shanty",
    purpose: "Zum Ankerlichten am Spill — gleichmäßiger Schritt.",
    timeSignature: "4/4",
    tempoBpm: 72,
    accentBeats: [1, 3],
    mode: "dur",
  },
  {
    id: "whaling",
    name: "Walfänger- & Heimweh-Ballade",
    purpose: "Für die Freiwache — getragen und wehmütig.",
    timeSignature: "3/4",
    tempoBpm: 60,
    accentBeats: [1],
    mode: "moll",
  },
];

export function getShantyGenre(id: ShantyGenreId): ShantyGenre | undefined {
  return SHANTY_GENRES.find((g) => g.id === id);
}

const SHANTYMAN_LINES = [
  "Der Anker hebt sich aus dem Grund",
  "O hör die Falle knarren laut",
  "Die Segel steigen, Mann für Mann",
  "Wir ziehen an, so fest wir kann",
  "Vom Mast herab pfeift kalter Wind",
  "Der Käpt'n ruft, das Schiff beginnt",
  "In sieben Wochen sind wir dort",
  "Und lassen Weib und Kind zurück",
];

const CHORUS_LINES = [
  "Way, hay, up she rises!",
  "Heave away, me hearties, heave away!",
  "Haul away, the morning's breaking!",
  "Yo ho, the tide is turning!",
  "Pull and pray, the anchor's breaking!",
  "Blow, ye winds, and take us home!",
];

const SEAMAN_TERMS = ["Takel", "Klüver", "Bramsegel", "Püttinge", "Spill", "Kluven", "Wanten", "Gording", "Fall", "Lee", "Luv", "Kombüse"];

export interface ShantyVerse {
  shantyman: string;
  chorus: string;
  /** Seemännischer Fachbegriff in diesem Vers. */
  term: string;
}

export interface Shanty {
  id: string;
  genre: ShantyGenre;
  title: string;
  verses: ShantyVerse[];
  /** Akzentschema als Schlag-Folge, z. B. [1, 0, 1, 0]. */
  accentPattern: number[];
  /** Taktlänge in Millisekunden. */
  beatMs: number;
  /** Gesamtdauer eines Durchgangs in Sekunden. */
  durationSeconds: number;
}

export function generateShanty(genreId: ShantyGenreId, verseCount: number = 4, seed: number = 42): Shanty {
  const genre = getShantyGenre(genreId) || SHANTY_GENRES[0];
  const rng = createSeededRandom(hashString(`shanty:${genreId}:${seed}`));
  const total = Math.max(1, Math.min(verseCount, SHANTYMAN_LINES.length));

  const verses: ShantyVerse[] = [];
  const usedShantyman = new Set<number>();
  const usedChorus = new Set<number>();
  let guard = 0;
  while (verses.length < total && guard < 200) {
    guard++;
    const si = Math.floor(rng() * SHANTYMAN_LINES.length);
    const ci = Math.floor(rng() * CHORUS_LINES.length);
    if (usedShantyman.has(si) || usedChorus.has(ci)) continue;
    usedShantyman.add(si);
    usedChorus.add(ci);
    verses.push({
      shantyman: SHANTYMAN_LINES[si],
      chorus: CHORUS_LINES[ci],
      term: pick(SEAMAN_TERMS, rng),
    });
  }

  const beatsPerBar = Number(genre.timeSignature.split("/")[0]);
  const accentPattern = Array.from({ length: beatsPerBar }, (_, i) => (genre.accentBeats.includes(i + 1) ? 1 : 0));
  const beatMs = Math.round((60000 / genre.tempoBpm) * 10) / 10;
  const barsPerVerse = 4;
  const durationSeconds = Math.round(((beatMs * beatsPerBar * barsPerVerse * verses.length) / 1000) * 10) / 10;

  const title = `${genre.name} — ${pick(["Der Anker", "Die Falle", "Nordwind", "Heimwärts", "Der alte Mast"], rng)}`;

  return {
    id: `SHANTY-${hashString(`${genreId}:${verseCount}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    genre,
    title,
    verses,
    accentPattern,
    beatMs,
    durationSeconds,
  };
}

export interface ShantyAudioPatch {
  tempoBpm: number;
  beatMs: number;
  /** Impuls-Parameter für den Taktschlag (WebAudio-Modell). */
  clickFrequencyHz: number;
  clickDecayMs: number;
  /** Chor-Pegel 0..1 relativ zum Vorsänger. */
  chorusGain: number;
  /** Vorsänger-Pegel 0..1. */
  shantymanGain: number;
  /** Grundton der Melodie in Hz. */
  tonicHz: number;
  scaleIntervals: number[];
  instruction: string;
}

/** Dur- und Moll-Intervalle in Halbtönen. */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function buildShantyAudioPatch(shanty: Shanty): ShantyAudioPatch {
  const isMoll = shanty.genre.mode === "moll";
  const tonicHz = isMoll ? 220 : 261.63;
  const clickFrequencyHz = shanty.genre.id === "capstan" ? 1800 : shanty.genre.id === "halyard" ? 2400 : 1200;
  const clickDecayMs = shanty.genre.id === "whaling" ? 180 : 90;
  const chorusGain = isMoll ? 0.55 : 0.8;
  const shantymanGain = isMoll ? 0.85 : 0.7;

  return {
    tempoBpm: shanty.genre.tempoBpm,
    beatMs: shanty.beatMs,
    clickFrequencyHz,
    clickDecayMs,
    chorusGain,
    shantymanGain,
    tonicHz,
    scaleIntervals: isMoll ? [...MINOR_SCALE] : [...MAJOR_SCALE],
    instruction: `${shanty.genre.timeSignature} bei ${shanty.genre.tempoBpm} BPM (${shanty.beatMs} ms/Schlag), ${isMoll ? "Moll" : "Dur"} auf ${tonicHz} Hz. Taktschlag ${clickFrequencyHz} Hz, Chor-Pegel ${chorusGain}.`,
  };
}

export interface ShantyReport {
  id: string;
  shanty: Shanty;
  patch: ShantyAudioPatch;
  verseCount: number;
  totalBeats: number;
}

export function analyzeShanty(genreId: ShantyGenreId, verseCount: number = 4, seed: number = 42): ShantyReport {
  const shanty = generateShanty(genreId, verseCount, seed);
  const patch = buildShantyAudioPatch(shanty);
  const beatsPerBar = Number(shanty.genre.timeSignature.split("/")[0]);
  const totalBeats = beatsPerBar * 4 * shanty.verses.length;
  return {
    id: `SHANTYREP-${hashString(`${genreId}:${verseCount}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    shanty,
    patch,
    verseCount: shanty.verses.length,
    totalBeats,
  };
}

export function createSampleShanty(): Shanty {
  return generateShanty("halyard", 4, 42);
}

export function createSampleShantyReport(): ShantyReport {
  return analyzeShanty("capstan", 4, 42);
}
