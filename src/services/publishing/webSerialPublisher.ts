// WebSerialPublisher (WP 113.2)
// Web-Serial- & Royal-Road-Studio.
// LitRPG-Statusfenster, Patreon-Cliffhanger-Score, 1-Klick-Plattform-Export.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type PlatformId = "royalRoad" | "wattpad" | "substack" | "patreon";

export interface Platform {
  id: PlatformId;
  name: string;
  /** Empfohlene Wortzahl je Kapitel. */
  targetWordCount: number;
  /** Unterstützte Formatierung. */
  supportsHtml: boolean;
  /** Maximaler Cliffhanger-Score (Patreon). */
  cliffhangerScale: number;
}

export const PLATFORMS: Platform[] = [
  { id: "royalRoad", name: "Royal Road", targetWordCount: 2000, supportsHtml: false, cliffhangerScale: 10 },
  { id: "wattpad", name: "Wattpad", targetWordCount: 1500, supportsHtml: true, cliffhangerScale: 5 },
  { id: "substack", name: "Substack", targetWordCount: 3000, supportsHtml: true, cliffhangerScale: 7 },
  { id: "patreon", name: "Patreon", targetWordCount: 2500, supportsHtml: true, cliffhangerScale: 10 },
];

export function getPlatform(id: PlatformId): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export interface LitRPGStatus {
  name: string;
  level: number;
  class: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attributes: { name: string; value: number }[];
  skills: string[];
  inventory: string[];
}

export function formatLitRPGStatus(status: LitRPGStatus): string {
  const lines = [
    `╔══════════════════════════════════════╗`,
    `║  ${status.name} — Level ${status.level} ${status.class}`,
    `╠══════════════════════════════════════╣`,
    `║  HP: ${status.hp}/${status.maxHp}  MP: ${status.mp}/${status.maxMp}`,
    `╠══════════════════════════════════════╣`,
  ];
  for (const attr of status.attributes) {
    lines.push(`║  ${attr.name}: ${attr.value}`);
  }
  lines.push(`╠══════════════════════════════════════╣`);
  lines.push(`║  Fähigkeiten: ${status.skills.join(", ")}`);
  lines.push(`╠══════════════════════════════════════╣`);
  lines.push(`║  Inventar: ${status.inventory.join(", ")}`);
  lines.push(`╚══════════════════════════════════════╝`);
  return lines.join("\n");
}

export interface CliffhangerAnalysis {
  /** Score 0..10 (10 = maximal unwiderstehlich). */
  score: number;
  /** Bewertung der Offenheit. */
  openness: number;
  /** Bewertung der Spannung. */
  tension: number;
  /** Bewertung der Emotionalität. */
  emotionalImpact: number;
  /** Bewertung des Cliffhanger-Typs. */
  cliffhangerType: string;
  /** Empfehlung für Patreon-Upload. */
  patreonRecommendation: string;
}

export function analyzeCliffhanger(
  lastParagraph: string,
  unresolvedThreads: number = 3,
  tensionLevel: number = 7,
  emotionalStakes: number = 8,
  seed: number = 42
): CliffhangerAnalysis {
  const rng = createSeededRandom(hashString(`cliffhanger:${lastParagraph}:${seed}`));

  const openness = Math.min(10, unresolvedThreads * 2 + Math.floor(rng() * 3));
  const tension = Math.min(10, tensionLevel + Math.floor(rng() * 2));
  const emotionalImpact = Math.min(10, emotionalStakes + Math.floor(rng() * 2));
  const score = Math.round((openness + tension + emotionalImpact) / 3);

  const cliffhangerTypes = [
    "Plot-Twist",
    "Offenes Geheimnis",
    "Unmittelbare Gefahr",
    "Emotionale Zäsur",
    "Weltverändernde Enthüllung",
  ];
  const cliffhangerType = pick(cliffhangerTypes, rng);

  const patreonRecommendation = score >= 8
    ? "Starkes Cliffhanger — ideal für Patreon-Bezahlposten"
    : score >= 5
      ? "Solider Cliffhanger — funktioniert auf Patreon"
      : "Schwacher Cliffhanger — für Patreon nicht empfohlen";

  return {
    score,
    openness,
    tension,
    emotionalImpact,
    cliffhangerType,
    patreonRecommendation,
  };
}

export interface ChapterExport {
  id: string;
  platform: Platform;
  title: string;
  markdown: string;
  html: string;
  wordCount: number;
  /** Geschätzte Lesezeit in Minuten. */
  readingMinutes: number;
}

export function exportChapter(
  platformId: PlatformId,
  title: string,
  content: string,
  seed: number = 42
): ChapterExport {
  const platform = getPlatform(platformId) || PLATFORMS[0];
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  const markdown = `# ${title}\n\n${content}\n\n---\n*Veröffentlicht auf ${platform.name}*`;
  const html = `<h1>${title}</h1>\n${content.split("\n\n").map((p) => `<p>${p}</p>`).join("\n")}\n<hr>\n<p><em>Veröffentlicht auf ${platform.name}</em></p>`;

  return {
    id: `EXPORT-${hashString(`${platformId}:${title}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    platform,
    title,
    markdown,
    html,
    wordCount,
    readingMinutes,
  };
}

export interface SerialReport {
  id: string;
  platform: Platform;
  chapterCount: number;
  totalWords: number;
  avgWordsPerChapter: number;
  cliffhangerAnalysis: CliffhangerAnalysis;
  export: ChapterExport;
}

export function analyzeSerial(
  platformId: PlatformId,
  chapters: { title: string; content: string }[],
  seed: number = 42
): SerialReport {
  const platform = getPlatform(platformId) || PLATFORMS[0];
  const chapterCount = chapters.length;
  const totalWords = chapters.reduce((sum, c) => sum + c.content.split(/\s+/).filter((w) => w.length > 0).length, 0);
  const avgWordsPerChapter = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;
  const lastChapter = chapters[chapters.length - 1];
  const cliffhangerAnalysis = analyzeCliffhanger(lastChapter.content, 3, 7, 8, seed);
  const chapterExport = exportChapter(platformId, lastChapter.title, lastChapter.content, seed);

  return {
    id: `SERIAL-${hashString(`${platformId}:${chapterCount}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    platform,
    chapterCount,
    totalWords,
    avgWordsPerChapter,
    cliffhangerAnalysis,
    export: chapterExport,
  };
}

export function createSampleLitRPGStatus(): LitRPGStatus {
  return {
    name: "Kael",
    level: 15,
    class: "Shadow Blade",
    hp: 340,
    maxHp: 400,
    mp: 180,
    maxMp: 220,
    attributes: [
      { name: "Stärke", value: 18 },
      { name: "Geschick", value: 22 },
      { name: "Konstitution", value: 16 },
      { name: "Intelligenz", value: 14 },
      { name: "Weisheit", value: 12 },
      { name: "Charisma", value: 10 },
    ],
    skills: ["Schattenschritt", "Giftklinge", "Verschwinden", "Kritischer Treffer"],
    inventory: ["Schwarze Klinge", "Heiltrank ×3", "Schlüssel der Ahnen", "Karte der Unterwelt"],
  };
}

export function createSampleCliffhangerAnalysis(): CliffhangerAnalysis {
  return analyzeCliffhanger("Der Schwert aus der Hand, die Flamme erlosch — und in der Dunkelheit lachte es.", 3, 7, 8, 42);
}

export function createSampleChapterExport(): ChapterExport {
  return exportChapter("royalRoad", "Kapitel 15: Der Verrat", "Der Schwert aus der Hand, die Flamme erlosch.", 42);
}

export function createSampleSerialReport(): SerialReport {
  return analyzeSerial("royalRoad", [{ title: "Kapitel 15: Der Verrat", content: "Der Schwert aus der Hand, die Flamme erlosch — und in der Dunkelheit lachte es." }], 42);
}
