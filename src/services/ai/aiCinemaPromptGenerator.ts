// AI Cinema Prompt Generator (WP 66.1)
//
// Shot-by-Shot Video-Prompt-Synthesizer für Sora, Runway Gen-3, Kling und Luma.
// Zerlegt eine Szene in Einzeleinstellungen und generiert engine-spezifische
// Prompts mit Konsistenz-Tags.
//
// Design-Regeln (analog doubleEntendreSynthesizer / characterVoiceEvolution):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Video-Engine. */
export type VideoEngine = 'sora' | 'runway' | 'kling' | 'luma';

/** Shot-Typ. */
export type ShotType = 'establishing' | 'dialogue' | 'closeup' | 'action' | 'detail' | 'transition';

/** Einzeleinstellung. */
export interface Shot {
  /** 1-basierte Nummer. */
  index: number;
  /** Shot-Typ. */
  type: ShotType;
  /** Menschenlesbarer Typ-Name. */
  typeLabel: string;
  /** Beschreibung. */
  description: string;
  /** Engine-spezifischer Prompt. */
  prompt: string;
  /** Konsistenz-Tags. */
  consistencyTags: string[];
  /** Kamera-Befehl (Runway). */
  cameraCommand?: string;
  /** Realismus-Anker (Kling/Luma). */
  realismAnchor?: string;
}

/** Ergebnis der Szenen-Dekonstruktion. */
export interface SceneDeconstruction {
  /** Original-Szenenbeschreibung. */
  scene: string;
  /** Alle Shots. */
  shots: Shot[];
  /** Anzahl der Shots. */
  shotCount: number;
  /** Konsistenz-Tags über alle Shots. */
  globalConsistencyTags: string[];
  /** Formatierte Shot-Liste. */
  formatted: string;
}

/** Konsistenz-Profile. */
export interface ConsistencyProfile {
  /** Haarfarbe. */
  hairColor: string;
  /** Kleidung. */
  clothing: string;
  /** Alter. */
  age: string;
  /** Beleuchtung. */
  lighting: string;
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
// Shot-Typen
// ---------------------------------------------------------------------------

/** Menschenlesbare Shot-Typ-Namen. */
export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  establishing: 'Totale / Establishing',
  dialogue: 'Halbnah / Dialogue',
  closeup: 'Detail / Close-Up',
  action: 'Action / Tracking',
  detail: 'Detail / Insert',
  transition: 'Übergang / Transition',
};

/** Engine-spezifische Prompt-Präfixe. */
const ENGINE_PREFIXES: Record<VideoEngine, string> = {
  sora: 'Cinematic scene with physically accurate lighting, depth of field, and narrative dynamism',
  runway: '[Camera: Slow tracking dolly in, 35mm anamorphic, chiaroscuro lighting, 24fps]',
  kling: 'Hyperrealistic scene with volumetric fog, particle effects, and motion vectors',
  luma: 'Dreamlike realism with volumetric mist, light rays, and fluid motion',
};

/** Kamera-Befehle je Shot-Typ (Runway). */
const CAMERA_COMMANDS: Record<ShotType, string> = {
  establishing: 'Slow aerial drone shot, wide angle, 24mm',
  dialogue: 'Static medium shot, 50mm, shallow depth of field',
  closeup: 'Slow push-in, 85mm, extreme shallow depth of field',
  action: 'Handheld tracking shot, 35mm, dynamic movement',
  detail: 'Macro shot, 100mm, rack focus',
  transition: 'Whip pan, 24mm, motion blur',
};

/** Realismus-Anker je Shot-Typ (Kling/Luma). */
const REALISM_ANCHORS: Record<ShotType, string> = {
  establishing: 'Photorealistic landscape, natural lighting, 8K detail',
  dialogue: 'Natural skin texture, realistic eye movement, subtle micro-expressions',
  closeup: 'Hyperdetailed skin pores, realistic subsurface scattering',
  action: 'Realistic motion blur, physics-based movement, natural momentum',
  detail: 'Photorealistic texture, accurate material properties',
  transition: 'Natural motion blur, realistic camera shake',
};

/** Konsistenz-Tags je Shot-Typ. */
const CONSISTENCY_TAGS: Record<ShotType, string[]> = {
  establishing: ['wide shot', 'environment', 'atmosphere'],
  dialogue: ['character', 'facial expression', 'eye contact'],
  closeup: ['detail', 'texture', 'emotion'],
  action: ['movement', 'physics', 'momentum'],
  detail: ['insert', 'prop', 'texture'],
  transition: ['camera movement', 'pacing', 'rhythm'],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Engine defensiv prüfen. */
function normalizeEngine(value: unknown): VideoEngine {
  const all: VideoEngine[] = ['sora', 'runway', 'kling', 'luma'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as VideoEngine)
    : 'sora';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Konsistenz-Profil defensiv prüfen. */
function normalizeProfile(value: Partial<ConsistencyProfile> | null | undefined): ConsistencyProfile {
  return {
    hairColor: normalizeText(value?.hairColor, 'dark brown'),
    clothing: normalizeText(value?.clothing, 'leather jacket'),
    age: normalizeText(value?.age, 'mid-30s'),
    lighting: normalizeText(value?.lighting, 'golden hour'),
  };
}

// ---------------------------------------------------------------------------
// 1) Szenen-Dekonstruktion
// ---------------------------------------------------------------------------

/**
 * Zerlegt eine Szene in 4–8 Einzeleinstellungen und generiert engine-spezifische
 * Prompts mit Konsistenz-Tags.
 *
 * Defensiv: ohne Angaben wird eine Standardszene verwendet.
 */
export function deconstructScene(
  scene: string,
  engine: VideoEngine,
  profile?: Partial<ConsistencyProfile> | null,
): SceneDeconstruction {
  const sceneText = normalizeText(scene, 'A lone figure stands at the edge of a cliff, looking out over a vast landscape');
  const eng = normalizeEngine(engine);
  const prof = normalizeProfile(profile);

  const rand = createSeededRandom(hashString(`${sceneText}#${eng}`));

  // 4–8 Shots, deterministisch
  const shotCount = 4 + Math.floor(rand() * 5);

  // Shot-Typen-Verteilung
  const shotTypes: ShotType[] = ['establishing', 'dialogue', 'closeup', 'action'];
  while (shotTypes.length < shotCount) {
    shotTypes.push(pick(['detail', 'transition', 'dialogue', 'action'] as const, rand));
  }

  const globalTags = [
    `hair: ${prof.hairColor}`,
    `clothing: ${prof.clothing}`,
    `age: ${prof.age}`,
    `lighting: ${prof.lighting}`,
  ];

  const shots: Shot[] = shotTypes.map((type, i) => {
    const prefix = ENGINE_PREFIXES[eng];
    const cameraCmd = eng === 'runway' ? CAMERA_COMMANDS[type] : undefined;
    const realismAnchor = eng === 'kling' || eng === 'luma' ? REALISM_ANCHORS[type] : undefined;

    const prompt = [
      prefix,
      `${SHOT_TYPE_LABELS[type]}: ${sceneText}`,
      cameraCmd,
      realismAnchor,
      ...globalTags.map((t) => `[${t}]`),
    ]
      .filter(Boolean)
      .join(', ');

    return {
      index: i + 1,
      type,
      typeLabel: SHOT_TYPE_LABELS[type],
      description: sceneText,
      prompt,
      consistencyTags: [...CONSISTENCY_TAGS[type], ...globalTags],
      cameraCommand: cameraCmd,
      realismAnchor,
    };
  });

  const formatted = shots
    .map((s) => {
      const lines = [
        `Shot ${String(s.index).padStart(2, '0')}: ${s.typeLabel}`,
        `  ${s.prompt}`,
      ];
      if (s.cameraCommand) lines.push(`  Camera: ${s.cameraCommand}`);
      if (s.realismAnchor) lines.push(`  Realism: ${s.realismAnchor}`);
      lines.push(`  Tags: ${s.consistencyTags.join(', ')}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return {
    scene: sceneText,
    shots,
    shotCount,
    globalConsistencyTags: globalTags,
    formatted,
  };
}

// ---------------------------------------------------------------------------
// 2) Konsistenz-Tags
// ---------------------------------------------------------------------------

/**
 * Generiert Konsistenz-Tags für eine Figur über alle Schnitte hinweg.
 */
export function generateConsistencyTags(
  profile?: Partial<ConsistencyProfile> | null,
): string[] {
  const prof = normalizeProfile(profile);
  return [
    `hair: ${prof.hairColor}`,
    `clothing: ${prof.clothing}`,
    `age: ${prof.age}`,
    `lighting: ${prof.lighting}`,
  ];
}

// ---------------------------------------------------------------------------
// 3) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert die Shot-Liste als reinen Text. */
export function formatShotList(deconstruction: SceneDeconstruction | null | undefined): string {
  if (!deconstruction || typeof deconstruction.formatted !== 'string') return '';
  return deconstruction.formatted;
}
