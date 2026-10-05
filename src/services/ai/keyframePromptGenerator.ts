// Keyframe Prompt Generator (WP 66.2)
//
// Midjourney & Leonardo Keyframe-Prompt-Studio: Generiert Start- & Endframe-Paare
// für Bild-zu-Bild-Morphing mit Midjourney v6/v6.1 Parametern und Kamera-Profilen.
//
// Design-Regeln (analog aiCinemaPromptGenerator / doubleEntendreSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Bild-Engine. */
export type ImageEngine = 'midjourney' | 'leonardo';

/** Seitenverhältnis. */
export type AspectRatio = '16:9' | '2.39:1' | '1:1' | '4:3' | '9:16';

/** Kamera-Profil. */
export type CameraProfile = 'arri-alexa-65' | 'imax-70mm' | 'panavision-70mm' | 'red-monstro' | 'sony-venice';

/** Start- & Endframe-Paar. */
export interface KeyframePair {
  /** Startframe-Prompt. */
  startPrompt: string;
  /** Endframe-Prompt. */
  endPrompt: string;
  /** Seitenverhältnis. */
  aspectRatio: AspectRatio;
  /** Kamera-Profil. */
  cameraProfile: string;
  /** Midjourney-Parameter. */
  midjourneyParams: string;
  /** Leonardo-Parameter. */
  leonardoParams: string;
  /** Character-Reference-Platzhalter. */
  cref: string;
  /** Formatierte Ausgabe. */
  formatted: string;
}

/** Ergebnis der Keyframe-Generierung. */
export interface KeyframeResult {
  /** Alle Paare. */
  pairs: KeyframePair[];
  /** Anzahl der Paare. */
  pairCount: number;
  /** Verwendete Engine. */
  engine: ImageEngine;
  /** Menschenlesbarer Engine-Name. */
  engineLabel: string;
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Engine-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Engine-Namen. */
export const ENGINE_LABELS: Record<ImageEngine, string> = {
  midjourney: 'Midjourney v6.1',
  leonardo: 'Leonardo AI',
};

/** Seitenverhältnis-Parameter. */
const ASPECT_RATIO_PARAMS: Record<AspectRatio, string> = {
  '16:9': '--ar 16:9',
  '2.39:1': '--ar 2.39:1',
  '1:1': '--ar 1:1',
  '4:3': '--ar 4:3',
  '9:16': '--ar 9:16',
};

/** Kamera-Profil-Parameter. */
const CAMERA_PROFILES: Record<CameraProfile, string> = {
  'arri-alexa-65': 'Arri Alexa 65 Cinema, large format, shallow depth of field',
  'imax-70mm': '70mm IMAX Vintage Panavision, anamorphic, film grain',
  'panavision-70mm': 'Panavision 70mm, vintage anamorphic, warm tones',
  'red-monstro': 'RED Monstro 8K, high dynamic range, crisp detail',
  'sony-venice': 'Sony Venice 6K, cinematic color science, natural skin tones',
};

/** Midjourney-Standardparameter. */
const MIDJOURNEY_DEFAULTS = '--style raw --v 6.1 --stylize 250';

/** Leonardo-Standardparameter. */
const LEONARDO_DEFAULTS = 'photorealistic, high detail, cinematic lighting';

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Engine defensiv prüfen. */
function normalizeEngine(value: unknown): ImageEngine {
  const all: ImageEngine[] = ['midjourney', 'leonardo'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as ImageEngine)
    : 'midjourney';
}

/** Seitenverhältnis defensiv prüfen. */
function normalizeAspectRatio(value: unknown): AspectRatio {
  const all: AspectRatio[] = ['16:9', '2.39:1', '1:1', '4:3', '9:16'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as AspectRatio)
    : '16:9';
}

/** Kamera-Profil defensiv prüfen. */
function normalizeCameraProfile(value: unknown): CameraProfile {
  const all: CameraProfile[] = ['arri-alexa-65', 'imax-70mm', 'panavision-70mm', 'red-monstro', 'sony-venice'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as CameraProfile)
    : 'arri-alexa-65';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

// ---------------------------------------------------------------------------
// 1) Keyframe-Paar generieren
// ---------------------------------------------------------------------------

/**
 * Generiert ein Start- & Endframe-Paar für Bild-zu-Bild-Morphing.
 *
 * Defensiv: ohne Angaben werden Standardwerte verwendet.
 */
export function generateKeyframePair(
  startDescription: string,
  endDescription: string,
  engine: ImageEngine,
  aspectRatio: AspectRatio,
  cameraProfile: CameraProfile,
): KeyframePair {
  const start = normalizeText(startDescription, 'A closed castle gate at night');
  const end = normalizeText(endDescription, 'The gate explodes open');
  const eng = normalizeEngine(engine);
  const ar = normalizeAspectRatio(aspectRatio);
  const cam = normalizeCameraProfile(cameraProfile);

  const arParam = ASPECT_RATIO_PARAMS[ar];
  const camParam = CAMERA_PROFILES[cam];

  const midjourneyParams = `${MIDJOURNEY_DEFAULTS} ${arParam}`;
  const leonardoParams = `${LEONARDO_DEFAULTS}, ${camParam}`;

  const cref = '[CHARACTER_REF: consistent face across frames]';

  const startPrompt = [
    start,
    camParam,
    cref,
    midjourneyParams,
    leonardoParams,
  ].join(', ');

  const endPrompt = [
    end,
    camParam,
    cref,
    midjourneyParams,
    leonardoParams,
  ].join(', ');

  const formatted = [
    `=== Keyframe Pair (${ENGINE_LABELS[eng]}) ===`,
    ``,
    `START FRAME:`,
    `  ${startPrompt}`,
    ``,
    `END FRAME:`,
    `  ${endPrompt}`,
    ``,
    `Parameters:`,
    `  Aspect Ratio: ${ar}`,
    `  Camera: ${cam}`,
    `  Midjourney: ${midjourneyParams}`,
    `  Leonardo: ${leonardoParams}`,
  ].join('\n');

  return {
    startPrompt,
    endPrompt,
    aspectRatio: ar,
    cameraProfile: cam,
    midjourneyParams,
    leonardoParams,
    cref,
    formatted,
  };
}

// ---------------------------------------------------------------------------
// 2) Mehrere Paare generieren
// ---------------------------------------------------------------------------

/**
 * Generiert mehrere Keyframe-Paare für eine Szene.
 *
 * Defensiv: ohne Angaben wird ein Standard-Paar zurückgegeben.
 */
export function generateKeyframePairs(
  scene: string,
  engine: ImageEngine,
  aspectRatio: AspectRatio,
  cameraProfile: CameraProfile,
  count?: number,
): KeyframeResult {
  const sceneText = normalizeText(scene, 'A dramatic scene unfolds');
  const eng = normalizeEngine(engine);
  const ar = normalizeAspectRatio(aspectRatio);
  const cam = normalizeCameraProfile(cameraProfile);
  const pairCount = typeof count === 'number' && Number.isFinite(count) && count > 0
    ? Math.min(8, Math.round(count))
    : 1;

  const rand = createSeededRandom(hashString(`${sceneText}#${eng}#${pairCount}`));

  const startTemplates = [
    'A closed castle gate at night',
    'A lone figure in a vast desert',
    'A spaceship approaching a planet',
    'A car speeding through a city',
    'A door slowly opening',
  ];

  const endTemplates = [
    'The gate explodes open',
    'The figure stands at the edge of a cliff',
    'The spaceship lands on the surface',
    'The car crashes into a barrier',
    'The door reveals a bright light',
  ];

  const pairs: KeyframePair[] = [];
  for (let i = 0; i < pairCount; i++) {
    const start = pick(startTemplates, rand);
    const end = pick(endTemplates, rand);
    pairs.push(generateKeyframePair(start, end, eng, ar, cam));
  }

  return {
    pairs,
    pairCount,
    engine: eng,
    engineLabel: ENGINE_LABELS[eng],
  };
}

// ---------------------------------------------------------------------------
// 3) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert ein Keyframe-Paar als reinen Text. */
export function formatKeyframePair(pair: KeyframePair | null | undefined): string {
  if (!pair || typeof pair.formatted !== 'string') return '';
  return pair.formatted;
}
