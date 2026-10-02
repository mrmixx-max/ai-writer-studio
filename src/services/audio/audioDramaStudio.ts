// Hörspiel-Studio-Service (WP 20.1 — Soundscape & Foley).
//
// Verarbeitet Audio-Regieanweisungen im Manuskript ([ambience: ...],
// [sfx: ...], [music: ...], [dialogue: ...]), baut daraus eine
// Mehrspur-Timeline (Dialoge / SFX / Musik) und berechnet einen
// Stereo-Mixdown mit Lautstärke-Ducking und Spitzenwert-Limiter.
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Defensive Fallbacks: fehlende/ungültige Daten (null, NaN, negativ,
//   falsche Typen) werden auf Defaults abgebildet statt zu werfen.
// - Der Mixdown begrenzt den Spitzenwert per Gain-Reduktion auf -0.5 dB
//   (kein Hard-Clipping) — es entstehen keine Clipping-Verzerrungen.
//
// Modell (dokumentiert, damit Ergebnisse reproduzierbar sind):
// - Der Parser legt Cues in Lesereihenfolge sequenziell ab: die Startzeit
//   eines Cues ist das Ende des vorherigen, sofern nicht `start=` gesetzt ist.
// - `ambience`-Cues liegen auf der SFX-Spur (Track-Typen kennen kein eigenes
//   `ambience`; Atmosphäre ist klanglich Foley/SFX).
// - Ducking (-12 dB) senkt Musik und Atmosphäre ab, sobald im selben
//   Mixdown-Block Sprache (Dialogue) aktiv ist. SFX wird nicht geduckt.

// --- Types ---------------------------------------------------------------------------

/** Art einer Audio-Regieanweisung. */
export type AudioCueType = "dialogue" | "sfx" | "music" | "ambience";

/** Typ einer Timeline-Spur (ohne `ambience` — Atmosphäre liegt auf der SFX-Spur). */
export type TrackType = "dialogue" | "sfx" | "music";

/** Eine einzelne Audio-Regieanweisung mit Zeit- und Mix-Parametern. */
export interface AudioCue {
  /** Stabile ID, z. B. "cue-0". */
  id: string;
  type: AudioCueType;
  /** Startzeit in Millisekunden (>= 0). */
  startTime: number;
  /** Dauer in Millisekunden (>= 0). */
  duration: number;
  /** Lautstärke als Faktor 0..1. */
  volume: number;
  /** Panorama -1 (links) .. 1 (rechts). */
  pan: number;
  /** Anzeigename / Asset-Label, z. B. "regensturm". */
  label: string;
  /** Zusatzdaten, z. B. `{ fadeMs: 2000 }`. */
  metadata?: Record<string, unknown>;
}

/** Eine Spur der Mehrspur-Timeline. */
export interface Track {
  id: string;
  name: string;
  type: TrackType;
  cues: AudioCue[];
}

/** Mehrspur-Timeline mit Gesamtdauer. */
export interface MultiTrackTimeline {
  tracks: Track[];
  durationMs: number;
}

/** Ergebnis des Stereo-Mixdowns. */
export interface MixdownResult {
  durationMs: number;
  /** Spitzenamplitude pro Mixdown-Block (0 .. LIMITER_LINEAR). */
  peaks: number[];
  /** true, sobald Musik/Atmosphäre unter Sprache abgesenkt wurde. */
  duckingApplied: boolean;
}

// --- Konstanten ----------------------------------------------------------------------

/** Auflösung des Mixdown-Rasters in Millisekunden (ein Peak je Block). */
export const MIXDOWN_RESOLUTION_MS = 100;

/** Ducking-Pegel unter Sprache in Dezibel. */
export const DUCKING_DB = -12;
/** Ducking als linearer Faktor (10^(-12/20) ≈ 0.2512). */
export const DUCKING_GAIN = 10 ** (DUCKING_DB / 20);

/** Spitzenwert-Limiter in Dezibel (verhindert Clipping). */
export const LIMITER_DB = -0.5;
/**
 * Limiter als linearer Faktor. 10^(-0.5/20) ≈ 0.9440609 — bewusst auf 4
 * Dezimalstellen gerundet (0.9441), damit gerundete Block-Spitzen die
 * Limiter-Invariante `peaks <= LIMITER_LINEAR` exakt einhalten und die
 * Rundung nicht über den Limiter hinaus aufrundet. Weiterhin < 1 (kein Clipping).
 */
export const LIMITER_LINEAR = 0.9441;

/** Default-Dauern je Cue-Typ in Millisekunden. */
export const DEFAULT_DURATIONS: Record<AudioCueType, number> = {
  dialogue: 2000,
  sfx: 1000,
  music: 4000,
  ambience: 8000,
};

/** Default-Lautstärken je Cue-Typ (0..1). */
export const DEFAULT_VOLUMES: Record<AudioCueType, number> = {
  dialogue: 1,
  sfx: 0.8,
  music: 0.6,
  ambience: 0.5,
};

/** Default-Labels je Cue-Typ (falls die Anweisung kein Label enthält). */
export const DEFAULT_LABELS: Record<AudioCueType, string> = {
  dialogue: "Dialog",
  sfx: "Geräusch",
  music: "Musik",
  ambience: "Atmosphäre",
};

const CUE_TYPES: readonly AudioCueType[] = ["dialogue", "sfx", "music", "ambience"];

// --- Kleine, defensive Helfer --------------------------------------------------------

/** Begrenzt auf [min, max]; NaN/Infinity → min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Begrenzt auf 0..1; NaN/Infinity → 0. */
function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Rundet auf 4 Dezimalstellen (eliminiert Float-Rauschen in Ergebnissen). */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** true, wenn `value` ein bekannter Cue-Typ ist. */
function isCueType(value: unknown): value is AudioCueType {
  return typeof value === "string" && (CUE_TYPES as readonly string[]).includes(value);
}

/**
 * Parst eine Zeitangabe zu Millisekunden.
 * Akzeptiert "2s" / "1.5s" / "500ms" / "500"; eine nackte Zahl gilt als Sekunden.
 * Gibt `undefined` zurück, wenn nicht parsebar.
 */
export function parseTimeMs(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim().toLowerCase();
  const m = /^(-?\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?)?$/.exec(s);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const isMillis = m[2] === "ms";
  return Math.max(0, isMillis ? n : n * 1000);
}

/**
 * Parst eine Lautstärke zu einem Faktor 0..1.
 * "40%" → 0.4, "0.4" → 0.4, "40" → 0.4 (Werte > 1 gelten als Prozent).
 * Gibt `undefined` zurück, wenn nicht parsebar.
 */
export function parseVolume(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? clamp01(n / 100) : undefined;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n > 1 ? clamp01(n / 100) : clamp01(n);
}

/** Parst ein Panorama zu -1..1; nicht parsebar → `undefined`. */
export function parsePan(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? clamp(n, -1, 1) : undefined;
}

/** Erzeugt die (optionale) Metadaten-Map aus den Attributen einer Anweisung. */
function buildMetadata(attrs: Record<string, string>): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  const fadeMs = parseTimeMs(attrs["fade"]);
  if (fadeMs !== undefined) metadata["fadeMs"] = fadeMs;
  // Unbekannte Attribute unverändert übernehmen (Round-Trip-Erhalt).
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "volume" || key === "pan" || key === "duration" || key === "dur" || key === "start" || key === "fade") {
      continue;
    }
    metadata[key] = value;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

// --- 1) Parser -----------------------------------------------------------------------

const DIRECTIVE_RE = /\[(ambience|sfx|music|dialogue)\s*:\s*([^\]]*)\]/gi;
const ATTR_RE = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.+)$/;

/**
 * Erkennt Audio-Regieanweisungen im Manuskript und liefert sie in
 * Lesereihenfolge als Cues zurück. Unbekannte `key=value`-Attribute landen
 * in `metadata`. Fehlende Werte werden je Typ defensiv defaultet.
 *
 * Beispiel: `[sfx: tuerschlag pan=-0.7]` → SFX-Cue "tuerschlag", pan -0.7.
 */
export function parseAudioCues(text: string): AudioCue[] {
  if (typeof text !== "string" || text.length === 0) return [];

  const cues: AudioCue[] = [];
  let offset = 0;
  let index = 0;
  DIRECTIVE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DIRECTIVE_RE.exec(text)) !== null) {
    const type = (match[1] ?? "").toLowerCase() as AudioCueType;
    const payload = match[2] ?? "";

    const labelParts: string[] = [];
    const attrs: Record<string, string> = {};
    for (const part of payload.trim().split(/\s+/)) {
      if (part.length === 0) continue;
      const am = ATTR_RE.exec(part);
      if (am) attrs[am[1].toLowerCase()] = am[2];
      else labelParts.push(part);
    }

    const explicitDuration = parseTimeMs(attrs["duration"] ?? attrs["dur"]);
    const duration = explicitDuration ?? DEFAULT_DURATIONS[type];
    const explicitStart = parseTimeMs(attrs["start"]);
    const startTime = explicitStart ?? offset;
    offset = startTime + duration;

    const explicitVolume = parseVolume(attrs["volume"]);
    const volume = explicitVolume ?? DEFAULT_VOLUMES[type];
    const pan = parsePan(attrs["pan"]) ?? 0;

    const cue: AudioCue = {
      id: `cue-${index}`,
      type,
      startTime,
      duration,
      volume,
      pan,
      label: labelParts.join(" ").trim() || DEFAULT_LABELS[type],
    };
    const metadata = buildMetadata(attrs);
    if (metadata) cue.metadata = metadata;

    cues.push(cue);
    index += 1;
  }

  return cues;
}

// --- 2) Mehrspur-Timeline ------------------------------------------------------------

/** Normalisiert einen (evtl. unvollständigen) Cue defensiv zu gültigen Werten. */
function sanitizeCue(raw: AudioCue, index: number): AudioCue {
  const type = isCueType(raw.type) ? raw.type : "sfx";
  const cue: AudioCue = {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `cue-${index}`,
    type,
    startTime: Math.max(0, Number.isFinite(raw.startTime) ? raw.startTime : 0),
    duration: Math.max(0, Number.isFinite(raw.duration) ? raw.duration : DEFAULT_DURATIONS[type]),
    volume: Number.isFinite(raw.volume) ? clamp01(raw.volume) : DEFAULT_VOLUMES[type],
    pan: clamp(Number.isFinite(raw.pan) ? raw.pan : 0, -1, 1),
    label: typeof raw.label === "string" && raw.label.length > 0 ? raw.label : DEFAULT_LABELS[type],
  };
  if (raw.metadata && typeof raw.metadata === "object") cue.metadata = raw.metadata;
  return cue;
}

/**
 * Verteilt Cues auf getrennte Spuren (Dialoge / SFX / Musik), sortiert sie
 * innerhalb der Spur nach Startzeit und liefert die Gesamtdauer.
 * `ambience` wird der SFX-Spur zugeordnet. Die drei Spuren existieren immer,
 * auch wenn sie leer sind (stabile Struktur für UI/Export).
 */
export function buildMultiTrackTimeline(cues: AudioCue[]): MultiTrackTimeline {
  const tracks: Track[] = [
    { id: "track-dialogue", name: "Dialoge", type: "dialogue", cues: [] },
    { id: "track-sfx", name: "SFX", type: "sfx", cues: [] },
    { id: "track-music", name: "Musik", type: "music", cues: [] },
  ];
  const byType: Record<TrackType, Track> = {
    dialogue: tracks[0],
    sfx: tracks[1],
    music: tracks[2],
  };

  let durationMs = 0;
  if (Array.isArray(cues)) {
    cues.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const cue = sanitizeCue(raw, index);
      const trackType: TrackType =
        cue.type === "dialogue" ? "dialogue" : cue.type === "music" ? "music" : "sfx";
      byType[trackType].cues.push(cue);
      durationMs = Math.max(durationMs, cue.startTime + cue.duration);
    });
  }

  for (const track of tracks) {
    track.cues.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  }

  return { tracks, durationMs: Math.round(durationMs) };
}

// --- 3) Stereo-Mixdown ---------------------------------------------------------------

/** Konstante-Leistungs-Panning: [links, rechts] für pan -1..1. */
function panGains(pan: number): [number, number] {
  const p = clamp(Number.isFinite(pan) ? pan : 0, -1, 1);
  const angle = ((p + 1) / 2) * (Math.PI / 2);
  return [Math.cos(angle), Math.sin(angle)];
}

/** true, wenn der Cue den Block [blockStart, blockEnd) zeitlich überlappt. */
function overlaps(cue: AudioCue, blockStart: number, blockEnd: number): boolean {
  const start = Number.isFinite(cue.startTime) ? cue.startTime : 0;
  const duration = Number.isFinite(cue.duration) ? cue.duration : 0;
  return start < blockEnd && start + duration > blockStart;
}

/**
 * Berechnet den Stereo-Mixdown der Timeline in 100-ms-Blöcken.
 * - Musik und Atmosphäre werden um -12 dB abgesenkt, solange im selben Block
 *   Sprache (Dialogue) aktiv ist (`duckingApplied`).
 * - Der Spitzenwert je Block wird per Gain-Reduktion auf -0.5 dB begrenzt;
 *   es entsteht kein Hard-Clipping.
 * Leere/ungültige Timelines liefern `{ durationMs: 0, peaks: [], duckingApplied: false }`.
 */
export function calculateMixdown(timeline: MultiTrackTimeline): MixdownResult {
  const raw = timeline as MultiTrackTimeline | null | undefined;
  const tracks = raw && Array.isArray(raw.tracks) ? raw.tracks : [];

  const allCues: AudioCue[] = [];
  for (const track of tracks) {
    if (!track || !Array.isArray(track.cues)) continue;
    for (const cue of track.cues) {
      if (cue && typeof cue === "object") allCues.push(cue);
    }
  }

  let durationMs = raw && Number.isFinite(raw.durationMs) && raw.durationMs > 0 ? raw.durationMs : 0;
  for (const cue of allCues) {
    const start = Number.isFinite(cue.startTime) ? cue.startTime : 0;
    const dur = Number.isFinite(cue.duration) ? cue.duration : 0;
    durationMs = Math.max(durationMs, start + dur);
  }
  durationMs = Math.round(durationMs);
  if (durationMs <= 0) {
    return { durationMs: 0, peaks: [], duckingApplied: false };
  }

  const blockCount = Math.ceil(durationMs / MIXDOWN_RESOLUTION_MS);
  const peaks: number[] = [];
  let duckingApplied = false;

  for (let block = 0; block < blockCount; block += 1) {
    const blockStart = block * MIXDOWN_RESOLUTION_MS;
    const blockEnd = blockStart + MIXDOWN_RESOLUTION_MS;

    let hasDialogue = false;
    for (const cue of allCues) {
      if (cue.type === "dialogue" && overlaps(cue, blockStart, blockEnd)) {
        hasDialogue = true;
        break;
      }
    }

    let sumL = 0;
    let sumR = 0;
    for (const cue of allCues) {
      if (!overlaps(cue, blockStart, blockEnd)) continue;
      let gain = Number.isFinite(cue.volume) ? clamp01(cue.volume) : 1;
      const isDuckable = cue.type === "music" || cue.type === "ambience";
      if (hasDialogue && isDuckable) {
        gain *= DUCKING_GAIN;
        duckingApplied = true;
      }
      const [gl, gr] = panGains(cue.pan);
      sumL += gain * gl;
      sumR += gain * gr;
    }

    let peak = Math.max(Math.abs(sumL), Math.abs(sumR));
    if (peak > LIMITER_LINEAR) {
      // Gain-Reduktion statt Hard-Clipping: Block-Spitze auf den Limiter ziehen.
      const scale = LIMITER_LINEAR / peak;
      sumL *= scale;
      sumR *= scale;
      peak = Math.max(Math.abs(sumL), Math.abs(sumR));
    }
    peaks.push(round4(peak));
  }

  return { durationMs, peaks, duckingApplied };
}
