// Thematischer Soundtrack- & MIDI-Composer-Service (WP 48.2).
//
// Erzeugt thematische Musik-Scores (Emotion → Harmonie), Figuren-Leitmotive
// (4-Takt-Melodiebogen) und exportiert Scores als Standard-MIDI (Base64).
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Defensive Fallbacks: fehlende/ungültige Daten werden auf Defaults abgebildet.
// - Gleiche Eingabe ⇒ gleiche Ausgabe (keine Zufalls-/Zeitquellen).
// - Base64 wird ohne Umgebungs-Abhängigkeit (Buffer/btoa) selbst kodiert.

// --- Types ---------------------------------------------------------------------------

/** Emotionale Szenen-Kategorie. */
export type SceneEmotion =
  | "melancholy"
  | "triumph"
  | "dread"
  | "playful"
  | "romantic"
  | "mystery";

/** Optionale Steuerung der Score-Komposition. */
export interface ScoreOptions {
  /** Tempo in BPM. */
  tempo?: number;
  /** Tonart-/Grundton-Override, z. B. "E", "Bb", "F#". */
  key?: string;
  /** Instrument-/Track-Bezeichnung. */
  instrument?: string;
}

/** Ein Akkord mit Name, Noten und Dauer (in Beats). */
export interface Chord {
  name: string;
  notes: string[];
  duration: number;
}

/** Eine Note mit Tonhöhe, Dauer (in Beats) und Anschlagstärke (0–127). */
export interface Note {
  pitch: string;
  duration: number;
  velocity: number;
}

/** Ein vollständiger Musik-Score. */
export interface MusicalScore {
  id: string;
  emotion: SceneEmotion;
  key: string;
  tempo: number;
  scale: string;
  chords: Chord[];
  melody: Note[];
  /** Gesamtdauer in Sekunden. */
  duration: number;
}

/** Ein Figuren-Leitmotiv (4-Takt-Melodiebogen). */
export interface Leitmotif {
  characterName: string;
  emotion: SceneEmotion;
  notes: Note[];
  contour: "rising" | "falling" | "wave";
}

/** Skalen-Beschreibung für eine Emotion. */
export interface ScaleInfo {
  name: string;
  root: string;
  /** Halbton-Intervalle vom Grundton (7 Stufen). */
  intervals: number[];
  mode: string;
}

// --- Konstanten ----------------------------------------------------------------------

/** Alle bekannten Emotionen (Reihenfolge = Iterations-/Anzeige-Ordnung). */
export const SCENE_EMOTIONS: readonly SceneEmotion[] = [
  "melancholy",
  "triumph",
  "dread",
  "playful",
  "romantic",
  "mystery",
];

/** Fallback-Emotion bei ungültiger Eingabe. */
export const DEFAULT_EMOTION: SceneEmotion = "melancholy";

/** Fallback-Tempo in BPM. */
export const DEFAULT_TEMPO = 120;

/** Fallback-Instrument. */
export const DEFAULT_INSTRUMENT = "piano";

/** Ticks pro Viertelnote im exportierten MIDI. */
export const MIDI_TICKS_PER_BEAT = 480;

/** Beats pro Takt. */
const BEATS_PER_BAR = 4;

/** Anzahl Takte eines Standard-Scores. */
const SCORE_BARS = 4;

// Halbton-Intervalle der unterstützten Modi.
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// --- Interne Emotion-Konfiguration ---------------------------------------------------

interface EmotionConfig {
  scale: ScaleInfo;
  tempo: number;
  /** Akkord-Progression als 0-basierte Skalenstufen. */
  progression: number[];
  /** Melodiebogen des Leitmotivs als Skalenstufen. */
  contour: number[];
  /** Bevorzugt b-Notennamen (z. B. D-Moll ⇒ Bb statt A#). */
  useFlats: boolean;
}

const EMOTION_CONFIG: Record<SceneEmotion, EmotionConfig> = {
  melancholy: {
    scale: { name: "D Minor", root: "D", intervals: AEOLIAN, mode: "aeolian" },
    tempo: 60,
    progression: [0, 3, 5, 4], // i – iv – VI – v
    contour: [7, 6, 5, 4, 3, 2, 1, 0], // fallend
    useFlats: true,
  },
  triumph: {
    scale: { name: "C Major", root: "C", intervals: IONIAN, mode: "ionian" },
    tempo: 120,
    progression: [0, 4, 5, 3], // I – V – vi – IV
    contour: [0, 1, 2, 3, 4, 5, 6, 7], // steigend
    useFlats: false,
  },
  dread: {
    scale: { name: "C# Phrygian", root: "C#", intervals: PHRYGIAN, mode: "phrygian" },
    tempo: 48,
    progression: [0, 1, 0, 6], // i – bII – i – bVII
    contour: [6, 5, 4, 3, 2, 1, 0, -1], // fallend
    useFlats: false,
  },
  playful: {
    scale: { name: "G Major", root: "G", intervals: IONIAN, mode: "ionian" },
    tempo: 132,
    progression: [0, 5, 3, 4], // I – vi – IV – V (Dur-Moll-Wechsel)
    contour: [0, 2, 4, 6, 4, 2, 0, 2], // Welle
    useFlats: false,
  },
  romantic: {
    scale: { name: "A Major", root: "A", intervals: IONIAN, mode: "ionian" },
    tempo: 76,
    progression: [0, 3, 4, 5], // I – IV – V – vi
    contour: [0, 1, 3, 5, 6, 4, 2, 1], // Welle
    useFlats: false,
  },
  mystery: {
    scale: { name: "F# Lydian", root: "F#", intervals: LYDIAN, mode: "lydian" },
    tempo: 90,
    progression: [0, 1, 5, 0], // I – II – vi – I
    contour: [0, 2, 4, 5, 4, 3, 1, 0], // Welle
    useFlats: false,
  },
};

const MODE_TITLE: Record<string, string> = {
  aeolian: "Minor",
  ionian: "Major",
  phrygian: "Phrygian",
  lydian: "Lydian",
};

// --- Deterministischer Pseudo-Zufallsgenerator (LCG) --------------------------------

/** Linearer Kongruenz-Generator: gleicher Seed ⇒ gleiche Sequenz. */
function createLCG(seed: number): () => number {
  let state = Math.abs(Math.floor(seed)) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Stabiler FNV-1a-Hash über einen String (deterministisch). */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --- Kleine, defensive Helfer --------------------------------------------------------

/** true, wenn `value` eine bekannte SceneEmotion ist. */
function isSceneEmotion(value: unknown): value is SceneEmotion {
  return typeof value === "string" && (SCENE_EMOTIONS as readonly string[]).includes(value);
}

/** Begrenzt eine Ganzzahl auf [min, max]; NaN/Infinity → min. */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Modulo 12 (immer nicht-negativ). */
function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

/** Sanitisiert das Tempo defensiv. */
function sanitizeTempo(value: unknown, fallback: number): number {
  const t = Number(value);
  if (!Number.isFinite(t) || t <= 0) return clampInt(fallback, 20, 300);
  return clampInt(t, 20, 300);
}

/** Sanitisiert den Instrument-Namen defensiv. */
function sanitizeInstrument(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_INSTRUMENT;
  const trimmed = value.trim();
  if (trimmed.length === 0) return DEFAULT_INSTRUMENT;
  return trimmed.slice(0, 40);
}

/** Sanitisiert einen Figuren-Namen defensiv. */
function sanitizeCharacterName(value: unknown): string {
  if (typeof value !== "string") return "Unbenannt";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Unbenannt";
  return trimmed.slice(0, 80);
}

/** Rundet auf drei Nachkommastellen (deterministische Ausgabe). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// --- Noten-/Pitch-Helfer -------------------------------------------------------------

/**
 * Parst eine Notenbezeichnung (z. B. "C4", "F#5", "Bb3") zu einer MIDI-Nummer.
 * Liefert `null` bei ungültiger Eingabe.
 */
function parsePitch(pitch: unknown): number | null {
  if (typeof pitch !== "string") return null;
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = parseInt(match[3], 10);
  if (!Number.isFinite(octave)) return null;
  let semitone = base[letter];
  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;
  return (octave + 1) * 12 + semitone;
}

/** Notenname (ohne Oktave) für eine MIDI-Nummer. */
function pitchClass(midi: number, useFlats: boolean): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[mod12(Math.round(midi))];
}

/** Vollständiger Notenname inkl. Oktave für eine MIDI-Nummer. */
function midiToPitch(midi: number, useFlats: boolean): string {
  const m = Math.round(midi);
  const octave = Math.floor(m / 12) - 1;
  return pitchClass(m, useFlats) + octave;
}

/** Skalenstufe (auch außerhalb 0..6) → MIDI-Nummer. */
function degreeToMidi(rootMidi: number, intervals: number[], degree: number): number {
  const n = intervals.length;
  const octaveShift = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return rootMidi + intervals[idx] + 12 * octaveShift;
}

// --- 1) getScaleForEmotion -----------------------------------------------------------

/**
 * Liefert die zur Emotion passende Skala.
 * Defensive Fallbacks: unbekannte Emotion → Default-Emotion.
 */
export function getScaleForEmotion(emotion: SceneEmotion): ScaleInfo {
  const safe = isSceneEmotion(emotion) ? emotion : DEFAULT_EMOTION;
  const scale = EMOTION_CONFIG[safe].scale;
  // Frische Kopie, damit Aufrufer die Konstanten nicht mutieren können.
  return {
    name: scale.name,
    root: scale.root,
    intervals: [...scale.intervals],
    mode: scale.mode,
  };
}

/** Wendet einen Grundton-Override (z. B. "Eb") auf eine Skala an. */
function applyKeyOverride(scale: ScaleInfo, key: unknown): ScaleInfo {
  if (typeof key !== "string") return scale;
  const match = /^([A-Ga-g])([#b]?)$/.exec(key.trim());
  if (!match) return scale;
  const root = match[1].toUpperCase() + match[2];
  const title = MODE_TITLE[scale.mode] ?? "Scale";
  return {
    name: `${root} ${title}`,
    root,
    intervals: [...scale.intervals],
    mode: scale.mode,
  };
}

// --- Akkord-Aufbau -------------------------------------------------------------------

/** Baut einen diatonalen Dreiklang auf der gegebenen Skalenstufe. */
function buildChord(scale: ScaleInfo, degree: number, useFlats: boolean): Chord {
  const rootMidi = parsePitch(`${scale.root}4`) ?? 60;
  const r = degreeToMidi(rootMidi, scale.intervals, degree);
  const third = degreeToMidi(rootMidi, scale.intervals, degree + 2);
  const fifth = degreeToMidi(rootMidi, scale.intervals, degree + 4);

  const thirdInterval = mod12(third - r);
  const fifthInterval = mod12(fifth - r);

  let quality = "?";
  if (thirdInterval === 4 && fifthInterval === 7) quality = "";
  else if (thirdInterval === 3 && fifthInterval === 7) quality = "m";
  else if (thirdInterval === 3 && fifthInterval === 6) quality = "dim";
  else if (thirdInterval === 4 && fifthInterval === 8) quality = "aug";
  else if (thirdInterval === 3 && fifthInterval === 8) quality = "m(#5)";

  return {
    name: pitchClass(r, useFlats) + quality,
    notes: [midiToPitch(r, useFlats), midiToPitch(third, useFlats), midiToPitch(fifth, useFlats)],
    duration: BEATS_PER_BAR,
  };
}

// --- Melodie-Generierung -------------------------------------------------------------

/** Erzeugt eine deterministische Melodie über `totalBeats` Beats (je 1 Beat pro Note). */
function generateMelody(
  emotion: SceneEmotion,
  scale: ScaleInfo,
  totalBeats: number,
  useFlats: boolean,
): Note[] {
  const rng = createLCG(hashString(`${emotion}|melody|${scale.root}|${scale.mode}`));
  const rootMidi = parsePitch(`${scale.root}4`) ?? 60;
  const steps = [-2, -1, -1, 0, 1, 1, 2];
  const notes: Note[] = [];
  let degree = 0;

  for (let i = 0; i < totalBeats; i++) {
    const midi = degreeToMidi(rootMidi, scale.intervals, degree);
    notes.push({
      pitch: midiToPitch(midi, useFlats),
      duration: 1,
      velocity: 70 + Math.floor(rng() * 31), // 70–100
    });
    const step = steps[Math.floor(rng() * steps.length)];
    degree = clampInt(degree + step, -3, 10);
  }

  return notes;
}

// --- 2) composeForEmotion ------------------------------------------------------------

/**
 * Komponiert einen thematischen Score (Akkord-Progression + Melodie) für eine Emotion.
 * Deterministisch: gleiche Eingabe ⇒ gleicher Score.
 */
export function composeForEmotion(emotion: SceneEmotion, options: ScoreOptions = {}): MusicalScore {
  const safeEmotion = isSceneEmotion(emotion) ? emotion : DEFAULT_EMOTION;
  const config = EMOTION_CONFIG[safeEmotion];

  const scale = applyKeyOverride(getScaleForEmotion(safeEmotion), options?.key);
  const useFlats = config.useFlats || scale.root.includes("b");
  const tempo = sanitizeTempo(options?.tempo, config.tempo);
  const instrument = sanitizeInstrument(options?.instrument);

  const totalBeats = SCORE_BARS * BEATS_PER_BAR; // 16

  const chords: Chord[] = config.progression.map((degree) => buildChord(scale, degree, useFlats));
  const melody = generateMelody(safeEmotion, scale, totalBeats, useFlats);

  const duration = round3(totalBeats * (60 / tempo));
  const id = `score_${safeEmotion}_${slug(scale.name)}_${tempo}_${slug(instrument)}`;

  return {
    id,
    emotion: safeEmotion,
    key: scale.name,
    tempo,
    scale: scale.mode,
    chords,
    melody,
    duration,
  };
}

/** Macht einen String datei-/ID-tauglich. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- 3) assignLeitmotif --------------------------------------------------------------

/** Leitet die Kontur aus den tatsächlichen Tonhöhen ab. */
function computeContour(notes: Note[]): "rising" | "falling" | "wave" {
  const midis = notes.map((n) => parsePitch(n.pitch) ?? 60);
  if (midis.length < 2) return "wave";

  let monotonicUp = true;
  let monotonicDown = true;
  for (let i = 1; i < midis.length; i++) {
    if (midis[i] < midis[i - 1]) monotonicUp = false;
    if (midis[i] > midis[i - 1]) monotonicDown = false;
  }

  const first = midis[0];
  const last = midis[midis.length - 1];
  if (monotonicUp && last > first) return "rising";
  if (monotonicDown && last < first) return "falling";
  return "wave";
}

/**
 * Erzeugt ein Figuren-Leitmotiv (4-Takt-Melodiebogen) für Charakter + Emotion.
 * Deterministisch; Velocity variiert mit dem Charakter-Namen.
 */
export function assignLeitmotif(characterName: string, emotion: SceneEmotion): Leitmotif {
  const safeEmotion = isSceneEmotion(emotion) ? emotion : DEFAULT_EMOTION;
  const safeName = sanitizeCharacterName(characterName);
  const config = EMOTION_CONFIG[safeEmotion];
  const scale = getScaleForEmotion(safeEmotion);
  const useFlats = config.useFlats;

  const rootMidi = parsePitch(`${scale.root}4`) ?? 60;
  const rng = createLCG(hashString(`${safeName}|${safeEmotion}|leitmotif`));

  const notes: Note[] = config.contour.map((degree) => ({
    pitch: midiToPitch(degreeToMidi(rootMidi, scale.intervals, degree), useFlats),
    duration: 1,
    velocity: 70 + Math.floor(rng() * 31), // 70–100
  }));

  return {
    characterName: safeName,
    emotion: safeEmotion,
    notes,
    contour: computeContour(notes),
  };
}

// --- 4) exportAsMidi -----------------------------------------------------------------

interface MidiEvent {
  tick: number;
  seq: number;
  bytes: number[];
}

/** Kodiert eine MIDI-Variable-Length-Quantity. */
function encodeVarLen(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Umgebungsunabhängige Base64-Kodierung eines Byte-Arrays. */
function toBase64(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] & 0xff;
    const b1 = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}

/** Wandelt einen String in sein ASCII-Byte-Array. */
function asciiBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

/** Big-Endian-32-Bit-Wert als 4 Bytes. */
function uint32be(value: number): number[] {
  const v = Math.max(0, Math.floor(value)) >>> 0;
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

/** Sanitisiert einen Beat-Wert für MIDI (endlich, > 0). */
function sanitizeBeats(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/**
 * Exportiert einen Score als Standard-MIDI-Datei (Format 0), Base64-kodiert.
 * Defensive Fallbacks: ungültige Noten werden übersprungen; ohne Eingabe entsteht
 * eine gültige, leere MIDI-Datei (Tempo + End-of-Track).
 */
export function exportAsMidi(score: MusicalScore): string {
  const safeScore: Partial<MusicalScore> =
    score && typeof score === "object" ? score : ({} as Partial<MusicalScore>);

  const events: MidiEvent[] = [];
  let seq = 0;
  let maxTick = 0;

  const push = (tick: number, bytes: number[]): void => {
    const t = Math.max(0, Math.round(tick));
    events.push({ tick: t, seq: seq++, bytes });
    if (t > maxTick) maxTick = t;
  };

  // Tempo-Meta-Event (µs pro Viertelnote).
  const tempo = sanitizeTempo(safeScore.tempo, DEFAULT_TEMPO);
  const microsPerBeat = Math.round(60000000 / tempo);
  push(0, [
    0xff,
    0x51,
    0x03,
    (microsPerBeat >> 16) & 0xff,
    (microsPerBeat >> 8) & 0xff,
    microsPerBeat & 0xff,
  ]);

  // Akkorde (je Akkord ein Takt).
  if (Array.isArray(safeScore.chords)) {
    let tick = 0;
    for (const chord of safeScore.chords) {
      if (!chord || !Array.isArray(chord.notes)) continue;
      const duration = Math.max(1, Math.round(sanitizeBeats(chord.duration) * MIDI_TICKS_PER_BEAT));
      for (const noteName of chord.notes) {
        const midi = parsePitch(noteName);
        if (midi == null) continue;
        push(tick, [0x90, midi & 0x7f, 0x50]); // Note On, Velocity 80
        push(tick + duration, [0x80, midi & 0x7f, 0x40]); // Note Off
      }
      tick += duration;
    }
  }

  // Melodie (sequenziell ab Tick 0).
  if (Array.isArray(safeScore.melody)) {
    let tick = 0;
    for (const note of safeScore.melody) {
      if (!note) continue;
      const duration = Math.max(1, Math.round(sanitizeBeats(note.duration) * MIDI_TICKS_PER_BEAT));
      const midi = parsePitch(note.pitch);
      if (midi != null) {
        const velocity = clampInt(Number(note.velocity), 1, 127);
        push(tick, [0x90, midi & 0x7f, velocity]);
        push(tick + duration, [0x80, midi & 0x7f, 0x40]);
      }
      tick += duration;
    }
  }

  // End-of-Track.
  push(maxTick, [0xff, 0x2f, 0x00]);

  // Events stabil nach Tick sortieren (seq als Tie-Breaker).
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.seq - b.seq);

  const trackBytes: number[] = [];
  let lastTick = 0;
  for (const event of sorted) {
    trackBytes.push(...encodeVarLen(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  }

  // Header-Chunk: MThd, Länge 6, Format 0, 1 Track, Division.
  const header: number[] = [
    ...asciiBytes("MThd"),
    ...uint32be(6),
    0x00,
    0x00, // Format 0
    0x00,
    0x01, // 1 Track
    (MIDI_TICKS_PER_BEAT >> 8) & 0xff,
    MIDI_TICKS_PER_BEAT & 0xff,
  ];

  // Track-Chunk: MTrk, Länge, Events.
  const track: number[] = [...asciiBytes("MTrk"), ...uint32be(trackBytes.length), ...trackBytes];

  return toBase64([...header, ...track]);
}
