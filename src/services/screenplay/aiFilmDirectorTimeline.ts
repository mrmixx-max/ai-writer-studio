// AI Film Director Timeline (WP 67.2)
//
// Interaktive Regie-Timeline & Produktions-Dossier: Synchronisiert Videos,
// Bilder, Dialoge und Sounds auf einer Zeitleiste und exportiert ein
// druckfertiges Pitchbook.
//
// Design-Regeln (analog aiCinemaPromptGenerator / keyframePromptGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leerge Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Shot-Kachel. */
export interface ShotCell {
  /** 1-basierte Nummer. */
  index: number;
  /** Timecode-Start in Sekunden. */
  startSec: number;
  /** Timecode-Ende in Sekunden. */
  endSec: number;
  /** Formatierter Timecode. */
  timecode: string;
  /** Kamera-Icon. */
  cameraIcon: string;
  /** Prompt-Vorschau. */
  promptPreview: string;
  /** Shot-Typ. */
  shotType: string;
}

/** Timeline-Eintrag. */
export interface TimelineEntry {
  /** Shot-Kachel. */
  shot: ShotCell;
  /** Dialog-Zeile. */
  dialogue: string;
  /** Foley-Ereignis. */
  foley: string;
  /** Musik-Sektion. */
  score: string;
}

/** Produktions-Dossier. */
export interface ProductionDossier {
  /** Titel. */
  title: string;
  /** Alle Timeline-Einträge. */
  entries: TimelineEntry[];
  /** Markdown-Export. */
  markdown: string;
  /** JSON-Export. */
  json: string;
  /** CSV-Export. */
  csv: string;
  /** PDF-Export (minimal). */
  pdf: string;
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
// Kamera-Icons
// ---------------------------------------------------------------------------

/** Kamera-Icons je Shot-Typ. */
const CAMERA_ICONS: Record<string, string> = {
  establishing: "🎥",
  dialogue: "🎬",
  closeup: "🔍",
  action: "🏃",
  detail: "📷",
  transition: "🔄",
};

/** Shot-Typen. */
const SHOT_TYPES = ["establishing", "dialogue", "closeup", "action", "detail", "transition"];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Timecode formatieren (MM:SS). */
function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 1) Shot-Grid generieren
// ---------------------------------------------------------------------------

/**
 * Generiert ein Shot-Grid mit Timecodes für eine Szene.
 *
 * Defensiv: ohne Angaben werden Standard-Shots verwendet.
 */
export function generateShotGrid(
  scene: string,
  shotCount?: number,
): ShotCell[] {
  const sceneText = normalizeText(scene, 'A dramatic scene unfolds');
  const count = typeof shotCount === 'number' && Number.isFinite(shotCount) && shotCount > 0
    ? Math.min(12, Math.round(shotCount))
    : 6;

  const rand = createSeededRandom(hashString(`${sceneText}#${count}`));

  const cells: ShotCell[] = [];
  let currentTime = 0;

  for (let i = 0; i < count; i++) {
    const duration = 3 + Math.floor(rand() * 5);
    const shotType = pick(SHOT_TYPES, rand);
    const icon = CAMERA_ICONS[shotType] ?? "🎥";

    cells.push({
      index: i + 1,
      startSec: currentTime,
      endSec: currentTime + duration,
      timecode: `${formatTimecode(currentTime)} - ${formatTimecode(currentTime + duration)}`,
      cameraIcon: icon,
      promptPreview: `${shotType}: ${sceneText.slice(0, 60)}...`,
      shotType,
    });

    currentTime += duration;
  }

  return cells;
}

// ---------------------------------------------------------------------------
// 2) Timeline-Einträge generieren
// ---------------------------------------------------------------------------

/**
 * Synchronisiert Shots, Dialoge, Foley und Musik auf einer Zeitleiste.
 *
 * Defensiv: ohne Angaben werden Standardwerte verwendet.
 */
export function generateTimeline(
  scene: string,
  shotCount?: number,
): TimelineEntry[] {
  const sceneText = normalizeText(scene, 'A dramatic scene unfolds');
  const cells = generateShotGrid(sceneText, shotCount);

  const rand = createSeededRandom(hashString(`timeline#${sceneText}`));

  const dialogues = [
    'I know what you did',
    'We need to leave now',
    'The gate is closing',
    'Trust me, please',
    'There is no way back',
    'Look behind you',
  ];

  const foleyEvents = [
    'Door creaks open',
    'Glass shatters',
    'Footsteps on gravel',
    'Wind howls',
    'Engine roars',
    'Gunshot echoes',
  ];

  const scoreSections = [
    '[Dark Orchestral Intro]',
    '[Minor Key Cello Solo]',
    '[Epic Brass Climax]',
    '[Tense Percussion Build]',
    '[Ethereal Ambient Pad]',
    '[Dramatic String Staccato]',
  ];

  return cells.map((cell) => ({
    shot: cell,
    dialogue: pick(dialogues, rand),
    foley: pick(foleyEvents, rand),
    score: pick(scoreSections, rand),
  }));
}

// ---------------------------------------------------------------------------
// 3) Produktions-Dossier exportieren
// ---------------------------------------------------------------------------

/**
 * Exportiert ein Produktions-Dossier als Markdown, JSON, CSV und PDF.
 *
 * Defensiv: ohne Angaben wird ein leeres Dossier zurückgegeben.
 */
export function exportProductionDossier(
  title: string,
  entries: TimelineEntry[] | null | undefined,
  generatedAt?: string,
): ProductionDossier {
  const safeTitle = normalizeText(title, 'AI Film Director\'s Pitchbook');
  const safeEntries = Array.isArray(entries) ? entries : [];

  // Deterministisch: fester Zeitstempel, sofern der Aufrufer keinen übergibt.
  // `new Date()` würde zwei identische Aufrufe unterschiedlich ausgeben.
  const timestamp = typeof generatedAt === 'string' && generatedAt.length > 0
    ? generatedAt
    : '1970-01-01T00:00:00.000Z';

  const markdown = [
    `# ${safeTitle}`,
    '',
    `**Generated:** ${timestamp.split('T')[0]}`,
    `**Shots:** ${safeEntries.length}`,
    '',
    '## Shot List',
    '',
    ...safeEntries.map((e) => {
      const lines = [
        `### Shot ${String(e.shot.index).padStart(2, '0')}: ${e.shot.timecode}`,
        `- **Type:** ${e.shot.shotType}`,
        `- **Camera:** ${e.shot.cameraIcon}`,
        `- **Prompt:** ${e.shot.promptPreview}`,
        `- **Dialogue:** ${e.dialogue}`,
        `- **Foley:** ${e.foley}`,
        `- **Score:** ${e.score}`,
      ];
      return lines.join('\n');
    }),
    '',
    '---',
    '*AI Film Director\'s Pitchbook*',
  ].join('\n');

  const json = JSON.stringify(
    {
      title: safeTitle,
      generated: timestamp,
      shotCount: safeEntries.length,
      shots: safeEntries.map((e) => ({
        index: e.shot.index,
        timecode: e.shot.timecode,
        type: e.shot.shotType,
        camera: e.shot.cameraIcon,
        prompt: e.shot.promptPreview,
        dialogue: e.dialogue,
        foley: e.foley,
        score: e.score,
      })),
    },
    null,
    2,
  );

  const csv = [
    'Index,Timecode,Type,Camera,Prompt,Dialogue,Foley,Score',
    ...safeEntries.map((e) =>
      [
        e.shot.index,
        `"${e.shot.timecode}"`,
        e.shot.shotType,
        e.shot.cameraIcon,
        `"${e.shot.promptPreview.replace(/"/g, '""')}"`,
        `"${e.dialogue.replace(/"/g, '""')}"`,
        `"${e.foley.replace(/"/g, '""')}"`,
        `"${e.score.replace(/"/g, '""')}"`,
      ].join(','),
    ),
  ].join('\n');

  const pdf = [
    `%PDF-1.4`,
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`,
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`,
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length 200>>stream`,
    `BT /F1 24 Tf 50 750 Td (${safeTitle}) Tj ET`,
    `BT /F1 14 Tf 50 700 Td (Shots: ${safeEntries.length}) Tj ET`,
    ...safeEntries.slice(0, 10).map((e, i) =>
      `BT /F1 10 Tf 50 ${650 - i * 20} Td (Shot ${e.shot.index}: ${e.shot.timecode} - ${e.shot.shotType}) Tj ET`,
    ),
    `endstream endobj`,
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj`,
    `trailer<</Root 1 0 R>>`,
    `%%EOF`,
  ].join('\n');

  return {
    title: safeTitle,
    entries: safeEntries,
    markdown,
    json,
    csv,
    pdf,
  };
}

// ---------------------------------------------------------------------------
// 4) Formatierung
// ---------------------------------------------------------------------------

/** Formatiert die Timeline als reinen Text. */
export function formatTimeline(entries: TimelineEntry[] | null | undefined): string {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  return entries
    .map((e) => {
      const lines = [
        `Shot ${String(e.shot.index).padStart(2, '0')}: ${e.shot.timecode}`,
        `  ${e.shot.cameraIcon} ${e.shot.shotType}`,
        `  ${e.shot.promptPreview}`,
        `  Dialogue: ${e.dialogue}`,
        `  Foley: ${e.foley}`,
        `  Score: ${e.score}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}
