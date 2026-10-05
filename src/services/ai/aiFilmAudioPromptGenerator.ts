// AI Film Audio Prompt Generator (WP 67.1)
//
// 3-Spur Audio- & Sprach-Prompt-Director für ElevenLabs, Suno und Foley FX.
// Generiert Dialogzeilen mit SSML-Regieanweisungen, sekundengenaue
// Geräusch-Prompts und genre-perfekte Musik-Prompts.
//
// Design-Regeln (analog aiCinemaPromptGenerator / keyframePromptGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Audio-Engine. */
export type AudioEngine = 'elevenlabs' | 'suno' | 'udio';

/** Spur-Typ. */
export type TrackType = 'voice' | 'foley' | 'score';

/** Dialogzeile mit SSML-Regie. */
export interface DialogueLine {
  /** Sprecher. */
  speaker: string;
  /** Text. */
  text: string;
  /** SSML-Regieanweisung. */
  ssml: string;
  /** Stimmfärbungs-Cue. */
  voiceCue: string;
  /** Timecode in Sekunden. */
  timecode: number;
}

/** Foley-Ereignis. */
export interface FoleyEvent {
  /** Beschreibung. */
  description: string;
  /** Timecode in Sekunden. */
  timecode: number;
  /** Dauer in Sekunden. */
  duration: number;
  /** Prompt. */
  prompt: string;
}

/** Musik-Sektion. */
export interface ScoreSection {
  /** Struktur-Tag. */
  tag: string;
  /** Beschreibung. */
  description: string;
  /** Timecode in Sekunden. */
  timecode: number;
  /** Prompt. */
  prompt: string;
}

/** Ergebnis der Audio-Prompt-Generierung. */
export interface AudioPromptResult {
  /** Spur 1: Voice & Dialog. */
  dialogue: DialogueLine[];
  /** Spur 2: Foley & Sound FX. */
  foley: FoleyEvent[];
  /** Spur 3: Soundtrack & Score. */
  score: ScoreSection[];
  /** Verwendete Engine. */
  engine: AudioEngine;
  /** Menschenlesbarer Engine-Name. */
  engineLabel: string;
  /** Formatierte Ausgabe. */
  formatted: string;
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
export const AUDIO_ENGINE_LABELS: Record<AudioEngine, string> = {
  elevenlabs: 'ElevenLabs TTS',
  suno: 'Suno AI',
  udio: 'Udio',
};

/** SSML-Regieanweisungen. */
const SSML_TEMPLATES = [
  '<break time="0.8s"/>',
  '<emphasis level="strong">',
  '<prosody rate="slow">',
  '<prosody pitch="-10%">',
  '<prosody volume="soft">',
];

/** Stimmfärbungs-Cues. */
const VOICE_CUES = [
  '[flüstert heiser, unterdrücktes Weinen]',
  '[tief, langsam, bedächtig]',
  '[scharf, schnell, panisch]',
  '[sanft, warm, vertraut]',
  '[kalt, distanziert, berechnend]',
];

/** Foley-Vorlagen. */
const FOLEY_TEMPLATES = [
  'Schwerer Eisenbeschlag fällt auf Steinboden, dumpfes metallisches Echo',
  'Tür knarrt langsam auf, quietschende Scharniere',
  'Schritte auf Kopfsteinpflaster, nasser Asphalt',
  'Wind heult durch enge Gasse, Papier raschelt',
  'Glas zerbricht, Scherben klimpern auf dem Boden',
  'Motor heult auf, Reifen quietschen auf Asphalt',
];

/** Musik-Struktur-Tags. */
const SCORE_TAGS = [
  '[Dark Orchestral Intro]',
  '[Minor Key Cello Solo]',
  '[Epic Brass Climax]',
  '[Tense Percussion Build]',
  '[Ethereal Ambient Pad]',
  '[Dramatic String Staccato]',
];

/** Musik-Beschreibungen. */
const SCORE_DESCRIPTIONS = [
  'Low strings swell with tension, distant timpani rolls',
  'Solo cello plays a mournful melody, sparse piano accents',
  'Full orchestra erupts with brass fanfare, driving rhythm',
  'Percussion builds with increasing intensity, taiko drums',
  'Ambient pads create an otherworldly atmosphere, subtle choir',
  'Strings play rapid staccato notes, creating urgency',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Engine defensiv prüfen. */
function normalizeEngine(value: unknown): AudioEngine {
  const all: AudioEngine[] = ['elevenlabs', 'suno', 'udio'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as AudioEngine)
    : 'elevenlabs';
}

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

// ---------------------------------------------------------------------------
// 1) Voice & Dialog (ElevenLabs / TTS)
// ---------------------------------------------------------------------------

/**
 * Generiert Dialogzeilen mit SSML-Regieanweisungen und Stimmfärbungs-Cues.
 *
 * Defensiv: ohne Angaben werden Standarddialoge verwendet.
 */
export function generateDialogue(
  lines: string[] | null | undefined,
  engine: AudioEngine,
): DialogueLine[] {
  const eng = normalizeEngine(engine);
  const rand = createSeededRandom(hashString(`dialogue#${eng}`));

  const defaultLines = [
    'I know what you did',
    'We need to leave now',
    'The gate is closing',
    'Trust me, please',
  ];

  const texts = Array.isArray(lines) && lines.length > 0
    ? lines.map((l) => normalizeText(l, ''))
    : defaultLines;

  return texts.map((text, i) => {
    const ssml = pick(SSML_TEMPLATES, rand);
    const cue = pick(VOICE_CUES, rand);
    return {
      speaker: `Character ${i + 1}`,
      text,
      ssml: `<speak>${ssml}${text}</speak>`,
      voiceCue: cue,
      timecode: i * 5,
    };
  });
}

// ---------------------------------------------------------------------------
// 2) Foley & Sound FX (ElevenLabs SFX / AudioGen)
// ---------------------------------------------------------------------------

/**
 * Erzeugt sekundengenaue Geräusch-Prompts.
 *
 * Defensiv: ohne Angaben werden Standard-Foley-Ereignisse verwendet.
 */
export function generateFoley(
  events: string[] | null | undefined,
  engine: AudioEngine,
): FoleyEvent[] {
  const eng = normalizeEngine(engine);
  const rand = createSeededRandom(hashString(`foley#${eng}`));

  const texts = Array.isArray(events) && events.length > 0
    ? events.map((e) => normalizeText(e, ''))
    : FOLEY_TEMPLATES;

  return texts.map((desc, i) => {
    const duration = 2 + Math.floor(rand() * 4);
    return {
      description: desc,
      timecode: i * 7,
      duration,
      prompt: `${desc} bei 00:${String(i * 7).padStart(2, '0')}, Dauer ${duration}s`,
    };
  });
}

// ---------------------------------------------------------------------------
// 3) Soundtrack & Score (Suno / Udio)
// ---------------------------------------------------------------------------

/**
 * Generiert genre-perfekte Musik-Prompts mit Struktur-Tags.
 *
 * Defensiv: ohne Angaben werden Standard-Sektionen verwendet.
 */
export function generateScore(
  sections: string[] | null | undefined,
  engine: AudioEngine,
): ScoreSection[] {
  const eng = normalizeEngine(engine);
  const rand = createSeededRandom(hashString(`score#${eng}`));

  const texts = Array.isArray(sections) && sections.length > 0
    ? sections.map((s) => normalizeText(s, ''))
    : SCORE_DESCRIPTIONS;

  return texts.map((desc, i) => {
    const tag = pick(SCORE_TAGS, rand);
    return {
      tag,
      description: desc,
      timecode: i * 10,
      prompt: `${tag} ${desc}`,
    };
  });
}

// ---------------------------------------------------------------------------
// 4) Gesamtes Audio-Prompt
// ---------------------------------------------------------------------------

/**
 * Generiert alle drei Spuren für eine Szene.
 *
 * Defensiv: ohne Angaben werden Standardwerte verwendet.
 */
export function generateAudioPrompts(
  engine: AudioEngine,
  dialogueLines?: string[] | null,
  foleyEvents?: string[] | null,
  scoreSections?: string[] | null,
): AudioPromptResult {
  const eng = normalizeEngine(engine);

  const dialogue = generateDialogue(dialogueLines, eng);
  const foley = generateFoley(foleyEvents, eng);
  const score = generateScore(scoreSections, eng);

  const formatted = [
    `=== AI Film Audio Prompts (${AUDIO_ENGINE_LABELS[eng]}) ===`,
    ``,
    `SPUR 1: VOICE & DIALOG`,
    ...dialogue.map((d) => {
      const lines = [
        `  [${d.timecode}s] ${d.speaker}: "${d.text}"`,
        `    SSML: ${d.ssml}`,
        `    Cue: ${d.voiceCue}`,
      ];
      return lines.join('\n');
    }),
    ``,
    `SPUR 2: FOLEY & SOUND FX`,
    ...foley.map((f) => {
      const lines = [
        `  [${f.timecode}s] ${f.description}`,
        `    Prompt: ${f.prompt}`,
      ];
      return lines.join('\n');
    }),
    ``,
    `SPUR 3: SOUNDTRACK & SCORE`,
    ...score.map((s) => {
      const lines = [
        `  [${s.timecode}s] ${s.tag}`,
        `    ${s.description}`,
        `    Prompt: ${s.prompt}`,
      ];
      return lines.join('\n');
    }),
  ].join('\n');

  return {
    dialogue,
    foley,
    score,
    engine: eng,
    engineLabel: AUDIO_ENGINE_LABELS[eng],
    formatted,
  };
}

// ---------------------------------------------------------------------------
// 5) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert das Audio-Prompt als reinen Text. */
export function formatAudioPrompts(result: AudioPromptResult | null | undefined): string {
  if (!result || typeof result.formatted !== 'string') return '';
  return result.formatted;
}
