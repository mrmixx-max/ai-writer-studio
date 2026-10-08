// GraphicScoreArranger (WP 105.1)
// Grafische Partitur & Avantgarde-Soundtrack.
// Spannungs-zu-Klang-Matrix, WebAudio-Synthese, druckfertiger Partitur-Export (SVG).
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

export type SoundSculptureId = "drone" | "microtonal" | "crescendo" | "cluster" | "glissando" | "silence";

export interface SoundSculpture {
  id: SoundSculptureId;
  name: string;
  description: string;
  /** Notation als grafische Anweisung für den Export. */
  graphicMark: string;
}

export const SOUND_SCULPTURES: SoundSculpture[] = [
  { id: "drone", name: "Drone", description: "Tiefes, unveränderliches Liegen eines Klangs.", graphicMark: "▬" },
  { id: "microtonal", name: "Mikrotonale Reibung", description: "Zwei Tonhöhen, die sich um wenige Cent überlagern.", graphicMark: "≈" },
  { id: "crescendo", name: "Wuchtiges Crescendo", description: "Von kaum hörbar zum lähmenden Fortissimo.", graphicMark: "◤" },
  { id: "cluster", name: "Cluster", description: "Dichte Traube benachbarter Töne als Klangwand.", graphicMark: "▓" },
  { id: "glissando", name: "Glissando-Kurve", description: "Gleitende Tonhöhenbewegung über den Tonraum.", graphicMark: "╱" },
  { id: "silence", name: "Stille", description: "Bewusst gesetzte Leere als dramaturgischer Schnitt.", graphicMark: "▯" },
];

export function getSoundSculpture(id: SoundSculptureId): SoundSculpture | undefined {
  return SOUND_SCULPTURES.find((s) => s.id === id);
}

export interface SceneTension {
  sceneId: string;
  label: string;
  /** Dramaturgische Spannung 0..1. */
  tension: number;
  /** Dauer der Szene in Sekunden. */
  durationSeconds: number;
}

export interface ScoreBand {
  id: string;
  sceneId: string;
  sculpture: SoundSculpture;
  startSeconds: number;
  durationSeconds: number;
  /** Intensität 0..1 (Höhe des grafischen Bandes). */
  intensity: number;
  /** Basisfrequenz in Hz für die WebAudio-Synthese. */
  baseFrequencyHz: number;
  /** FM-/Rauheits-Index 0..1. */
  roughness: number;
}

const SCULPTURE_POOL_BY_TENSION: { max: number; pool: SoundSculptureId[] }[] = [
  { max: 0.2, pool: ["silence", "drone"] },
  { max: 0.45, pool: ["drone", "microtonal", "glissando"] },
  { max: 0.7, pool: ["glissando", "cluster", "microtonal"] },
  { max: 0.9, pool: ["crescendo", "cluster", "glissando"] },
  { max: 1.01, pool: ["crescendo", "cluster"] },
];

export function chooseSculpture(tension: number, seed: number = 42): SoundSculpture {
  const t = Math.max(0, Math.min(1, tension));
  const tier = SCULPTURE_POOL_BY_TENSION.find((x) => t < x.max) ?? SCULPTURE_POOL_BY_TENSION[SCULPTURE_POOL_BY_TENSION.length - 1];
  const rng = createSeededRandom(hashString(`sculpt:${Math.round(t * 100)}:${seed}`));
  const id = pick(tier.pool, rng);
  return getSoundSculpture(id) || SOUND_SCULPTURES[0];
}

export interface GraphicScore {
  id: string;
  title: string;
  bands: ScoreBand[];
  totalSeconds: number;
  peakTension: number;
}

export function arrangeGraphicScore(title: string, scenes: SceneTension[], seed: number = 42): GraphicScore {
  const bands: ScoreBand[] = [];
  let cursor = 0;
  scenes.forEach((scene, i) => {
    const sculpture = chooseSculpture(scene.tension, seed + i);
    const rng = createSeededRandom(hashString(`band:${scene.sceneId}:${seed + i}`));
    const baseFrequencyHz = Math.round(
      sculpture.id === "silence" ? 0 : 55 + scene.tension * 440 * (0.8 + rng() * 0.4)
    );
    bands.push({
      id: `band-${i + 1}`,
      sceneId: scene.sceneId,
      sculpture,
      startSeconds: cursor,
      durationSeconds: Math.max(1, scene.durationSeconds),
      intensity: Math.round(Math.max(0, Math.min(1, scene.tension)) * 100) / 100,
      baseFrequencyHz,
      roughness: Math.round(rng() * 100) / 100,
    });
    cursor += Math.max(1, scene.durationSeconds);
  });

  return {
    id: `SCORE-${hashString(`${title}:${scenes.length}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    title,
    bands,
    totalSeconds: cursor,
    peakTension: scenes.reduce((m, s) => Math.max(m, s.tension), 0),
  };
}

export interface ScoreExport {
  svg: string;
  width: number;
  height: number;
  bandCount: number;
}

/** Rendert die grafische Partitur als Vektor-SVG (druckfertig). */
export function renderScoreSvg(score: GraphicScore, width: number = 800, height: number = 320): ScoreExport {
  const margin = 40;
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;
  const total = Math.max(1, score.totalSeconds);

  const bandShapes = score.bands
    .map((band) => {
      const x = margin + (band.startSeconds / total) * usableWidth;
      const w = Math.max(2, (band.durationSeconds / total) * usableWidth);
      const h = Math.max(3, band.intensity * usableHeight * 0.8);
      const y = margin + usableHeight - h;
      const opacity = 0.35 + band.intensity * 0.6;
      const fill = `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, var(--panel))`;
      const label = `${band.sculpture.graphicMark} ${band.sculpture.name}`;
      return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" style="fill: ${fill}; stroke: var(--border)" stroke-width="1" /><text x="${(x + 3).toFixed(1)}" y="${(margin + usableHeight - 6).toFixed(1)}" style="fill: var(--muted)" font-size="8">${label}</text></g>`;
    })
    .join("");

  const timeTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const x = margin + f * usableWidth;
      const secs = Math.round(total * f);
      return `<line x1="${x.toFixed(1)}" y1="${margin}" x2="${x.toFixed(1)}" y2="${(margin + usableHeight).toFixed(1)}" style="stroke: var(--border)" stroke-width="0.5" /><text x="${x.toFixed(1)}" y="${(height - 12).toFixed(1)}" text-anchor="middle" style="fill: var(--muted)" font-size="8">${secs}s</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect x="${margin}" y="${margin}" width="${usableWidth}" height="${usableHeight}" style="fill: none; stroke: var(--border-strong)" stroke-width="1" />
  ${timeTicks}
  ${bandShapes}
  <text x="${margin}" y="${margin - 14}" style="fill: var(--accent)" font-size="12" font-weight="bold">${score.title}</text>
</svg>`;

  return { svg, width, height, bandCount: score.bands.length };
}

export interface AudioPatchBand {
  sculptureId: SoundSculptureId;
  oscillator: OscillatorType;
  frequencyHz: number;
  detuneCents: number;
  gain: number;
  filterHz: number;
}

export interface ScoreAudioPatch {
  id: string;
  durationSeconds: number;
  bands: AudioPatchBand[];
  instruction: string;
}

export function buildScoreAudioPatch(score: GraphicScore): ScoreAudioPatch {
  const bands: AudioPatchBand[] = score.bands.map((band) => {
    const isDrone = band.sculpture.id === "drone" || band.sculpture.id === "silence";
    const oscillator: OscillatorType =
      band.sculpture.id === "cluster" ? "sawtooth" : band.sculpture.id === "microtonal" ? "square" : isDrone ? "sine" : "triangle";
    return {
      sculptureId: band.sculpture.id,
      oscillator,
      frequencyHz: band.baseFrequencyHz,
      detuneCents: band.sculpture.id === "microtonal" ? Math.round(band.roughness * 30) : 0,
      gain: Math.round(band.intensity * 100) / 100,
      filterHz: Math.round(400 + band.intensity * 6000),
    };
  });

  const instruction = `${score.bands.length} Klangbänder über ${score.totalSeconds}s. ${score.bands.filter((b) => b.sculpture.id === "crescendo").length} Crescendi, ${score.bands.filter((b) => b.sculpture.id === "silence").length} Stille-Schnitte.`;

  return {
    id: `PATCH-${hashString(score.id).toString(16).padStart(8, "0").toUpperCase()}`,
    durationSeconds: score.totalSeconds,
    bands,
    instruction,
  };
}

export function createSampleSceneTensions(): SceneTension[] {
  return [
    { sceneId: "s1", label: "Eröffnung am Hafen", tension: 0.15, durationSeconds: 40 },
    { sceneId: "s2", label: "Die Warnung", tension: 0.45, durationSeconds: 30 },
    { sceneId: "s3", label: "Verfolgung durch die Gassen", tension: 0.85, durationSeconds: 55 },
    { sceneId: "s4", label: "Atempause im Keller", tension: 0.3, durationSeconds: 25 },
    { sceneId: "s5", label: "Der Sturm bricht los", tension: 1.0, durationSeconds: 60 },
    { sceneId: "s6", label: "Nach der Schlacht", tension: 0.1, durationSeconds: 35 },
  ];
}

export function createSampleGraphicScore(): GraphicScore {
  return arrangeGraphicScore("Die Schenke am Nebelpass", createSampleSceneTensions(), 42);
}

export function createSampleScoreExport(): ScoreExport {
  return renderScoreSvg(createSampleGraphicScore());
}
