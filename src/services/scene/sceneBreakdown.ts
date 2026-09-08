// Scene-Breakdown-Engine (Sprint 23, Agent 3): Szenen-Parsing, Struktur-Analyse
// und CSV-Export fuer Drehbuecher/Romane. Reine Funktionen, keine Dependencies.

export interface Scene {
  id: string;
  heading: string; // INT. ORT - TAG/NACHT
  location: string;
  timeOfDay: "day" | "night" | "dawn" | "dusk";
  characters: string[];
  dialogue: number; // Prozent
  action: number; // Prozent
  description: number; // Prozent
  conflict?: string;
  goal?: string;
  outcome?: "success" | "failure" | "partial";
  notes?: string;
  /** Wortzahl des Szenenkoerpers (gesetzt von parseScenes, Basis fuer Statistiken). */
  wordCount?: number;
}

export interface ScriptBreakdown {
  totalScenes: number;
  locations: { name: string; count: number }[];
  characters: { name: string; sceneCount: number }[];
  timeDistribution: { day: number; night: number; dawn: number; dusk: number };
  averageSceneLength: number; // Woerter
  pacing: "slow" | "medium" | "fast";
}

let idCounter = 0;

function genId(prefix: string): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return `${prefix}-${c.randomUUID()}`;
  } catch {
    /* Fallback unten */
  }
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

const HEADING_RE = /^\s*(INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?)\s*(.*)$/i;

/** Zeitangabe aus dem Heading-Teil nach dem "-" extrahieren. */
function detectTimeOfDay(heading: string): Scene["timeOfDay"] {
  const tail = heading.split("-").slice(1).join("-").toUpperCase();
  const probe = tail || heading.toUpperCase();
  if (/NACHT|NIGHT/.test(probe)) return "night";
  if (/MORGEN|DAWN|MORNING/.test(probe)) return "dawn";
  if (/ABEND|DUSK|DÄMMERUNG|DAMMERUNG|SUNSET/.test(probe)) return "dusk";
  if (/TAG|DAY/.test(probe)) return "day";
  return "day";
}

/** Ortsangabe aus dem Heading extrahieren (zwischen Prefix und "-"). */
function extractLocation(heading: string): string {
  const withoutPrefix = heading.replace(/^\s*(INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?)\s*\.?\s*/i, "");
  const beforeDash = withoutPrefix.split("-")[0] ?? "";
  const loc = beforeDash.trim().replace(/\s+/g, " ");
  return loc || withoutPrefix.trim() || heading.trim();
}

/** Figurencue: weitestgehend grossgeschriebene Zeile (Namen am Zeilenanfang). */
const CHARACTER_CUE_RE = /^[A-ZÄÖÜÀ-Þ][A-ZÄÖÜÀ-Þ\s'\-.()]{1,38}$/;
const HEADING_KEYWORDS = new Set(["INT", "EXT", "TAG", "NACHT", "INT./EXT.", "INT/EXT"]);

function isCharacterCue(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2) return false;
  if (HEADING_RE.test(t)) return false;
  if (!CHARACTER_CUE_RE.test(t)) return false;
  // Ausrufe-/Fragezeichen oder Saetze sind keine Cues.
  if (/[!?.,:;]$/.test(t)) return false;
  const words = t.split(/\s+/);
  // Reine Zeit-/Ortsangaben (TAG, NACHT …) ausschliessen.
  if (words.length === 1 && HEADING_KEYWORDS.has(t.replace(/\./g, ""))) return false;
  return true;
}

function countWords(s: string): number {
  const w = s.trim().split(/\s+/).filter(Boolean);
  return s.trim() ? w.length : 0;
}

/** Charaktere aus einem Text erkennen (grossgeschriebene Cues am Zeilenanfang). */
export function extractCharacters(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!isCharacterCue(line)) continue;
    // Klammerzusatz "(O.S.)" etc. entfernen.
    const name = line.replace(/\s*\(.*?\)\s*/g, "").trim().replace(/\s+/g, " ");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

const CONFLICT_WORDS = [
  "konflikt", "streit", "kampf", "auseinandersetzung", "widerspruch",
  "gefahr", "bedrohung", "verrat", "tod", "töte", "angst", "droh",
  "flieht", "flucht", "waffe", "schuss", "lüge", "hass", "rache",
  "conflict", "fight", "argument", "danger", "threat", "betrayal",
  "kill", "fear", "weapon", "lie", "hate", "revenge", "escape",
];

/** Ersten Satz mit Konfliktsignal zurueckgeben, sonst undefined. */
export function detectConflict(sceneText: string): string | undefined {
  const sentences = sceneText.split(/(?<=[.!?…])\s+|\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const low = s.toLowerCase();
    if (CONFLICT_WORDS.some((w) => low.includes(w))) return s;
  }
  return undefined;
}

interface BodyStats {
  dialogue: number;
  action: number;
  description: number;
  wordCount: number;
}

/** Dialog-/Action-/Beschreibungsanteile aus dem Szenenkoerper schaetzen. */
function analyzeBody(body: string): BodyStats {
  const lines = body.split(/\r?\n/);
  let dialogueWords = 0;
  let descriptionWords = 0;
  let totalWords = 0;
  let inDialogueBlock = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      inDialogueBlock = false;
      continue;
    }
    const words = countWords(line);
    totalWords += words;
    if (isCharacterCue(line)) {
      inDialogueBlock = true;
      continue;
    }
    if (/^\(.*\)$/.test(line)) {
      descriptionWords += words;
      continue;
    }
    if (inDialogueBlock) {
      dialogueWords += words;
    }
  }
  if (totalWords === 0) return { dialogue: 0, action: 0, description: 0, wordCount: 0 };
  const dialogue = Math.round((dialogueWords / totalWords) * 100);
  const description = Math.round((descriptionWords / totalWords) * 100);
  const action = Math.max(0, 100 - dialogue - description);
  return { dialogue, action, description, wordCount: totalWords };
}

/** Szenen aus Drehbuch-/Romantext parsen (INT./EXT.-Headings). */
export function parseScenes(text: string): Scene[] {
  const lines = text.split(/\r?\n/);
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const raw of lines) {
    if (HEADING_RE.test(raw.trim()) && raw.trim().length > 3) {
      current = { heading: raw.trim(), body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(raw);
    }
  }
  return sections.map((s) => {
    const body = s.body.join("\n");
    const stats = analyzeBody(body);
    return {
      id: genId("scene"),
      heading: s.heading,
      location: extractLocation(s.heading),
      timeOfDay: detectTimeOfDay(s.heading),
      characters: extractCharacters(body),
      dialogue: stats.dialogue,
      action: stats.action,
      description: stats.description,
      conflict: detectConflict(body),
      wordCount: stats.wordCount,
    } satisfies Scene;
  });
}

/** Struktur-Statistiken ueber alle Szenen berechnen. */
export function analyzeBreakdown(scenes: Scene[]): ScriptBreakdown {
  const locationsMap = new Map<string, number>();
  const charactersMap = new Map<string, number>();
  const timeDistribution = { day: 0, night: 0, dawn: 0, dusk: 0 };
  let wordSum = 0;
  let wordCounted = 0;

  for (const s of scenes) {
    locationsMap.set(s.location, (locationsMap.get(s.location) ?? 0) + 1);
    for (const c of s.characters) {
      charactersMap.set(c, (charactersMap.get(c) ?? 0) + 1);
    }
    timeDistribution[s.timeOfDay] += 1;
    if (typeof s.wordCount === "number") {
      wordSum += s.wordCount;
      wordCounted += 1;
    }
  }

  const locations = [...locationsMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const characters = [...charactersMap.entries()]
    .map(([name, sceneCount]) => ({ name, sceneCount }))
    .sort((a, b) => b.sceneCount - a.sceneCount);
  const averageSceneLength = wordCounted > 0 ? Math.round(wordSum / wordCounted) : 0;
  const pacing: ScriptBreakdown["pacing"] =
    averageSceneLength < 150 ? "fast" : averageSceneLength < 400 ? "medium" : "slow";

  return {
    totalScenes: scenes.length,
    locations,
    characters,
    timeDistribution,
    averageSceneLength,
    pacing,
  };
}

/** Verbesserungsvorschlaege aus der Strukturanalyse ableiten. */
export function suggestImprovements(breakdown: ScriptBreakdown): string[] {
  const tips: string[] = [];
  if (breakdown.totalScenes === 0) {
    return ["Noch keine Szenen erkannt — Text mit INT./EXT.-Headings strukturieren."];
  }
  const { day, night, dawn, dusk } = breakdown.timeDistribution;
  const total = breakdown.totalScenes;
  if (night / total > 0.7) {
    tips.push("Über 70 % Nachtszenen — Tag-/Dämmerungszenen für visuelle Abwechslung einstreuen.");
  }
  if (day / total > 0.8) {
    tips.push("Fast nur Tagszenen — eine Nachtszene erhöht die Kontrastwirkung.");
  }
  if (dawn + dusk === 0 && total >= 3) {
    tips.push("Keine Dämmerungszenen — Dawn/Dusk-Übergänge geben dem Pacing Atempausen.");
  }
  const top = breakdown.locations[0];
  if (top && top.count / total > 0.6) {
    tips.push(`Location „${top.name}" dominiert (${top.count}/${total} Szenen) — Schauplatzwechsel prüfen.`);
  }
  if (breakdown.locations.length === 1 && total >= 3) {
    tips.push("Nur ein Schauplatz — weitere Locations erhöhen die visuelle Vielfalt.");
  }
  if (breakdown.characters.length < 2 && total >= 2) {
    tips.push("Wenig Figurenpräsenz — Ensemble-Szenen stärken Beziehungen und Konflikt.");
  }
  if (breakdown.pacing === "slow") {
    tips.push(`Langsames Pacing (Ø ${breakdown.averageSceneLength} Wörter/Szene) — Szenen straffen oder teilen.`);
  }
  if (breakdown.pacing === "fast" && total >= 5) {
    tips.push(`Schnelles Pacing (Ø ${breakdown.averageSceneLength} Wörter/Szene) — ruhige Szenen als Anker einbauen.`);
  }
  if (tips.length === 0) {
    tips.push("Solide Struktur — weiter so: Konflikt pro Szene und klaren Ausgang prüfen.");
  }
  return tips;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Szenen als CSV exportieren (Semikolon-separiert, RFC-4180-Quoting). */
export function exportToCSV(scenes: Scene[]): string {
  const header = ["id", "heading", "location", "timeOfDay", "characters", "dialogue%", "action%", "description%", "conflict"];
  const rows = scenes.map((s) =>
    [
      s.id,
      s.heading,
      s.location,
      s.timeOfDay,
      s.characters.join(" | "),
      s.dialogue,
      s.action,
      s.description,
      s.conflict ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return [header.join(";"), ...rows].join("\n");
}
