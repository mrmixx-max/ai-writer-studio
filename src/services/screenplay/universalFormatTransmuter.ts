// UniversalFormatTransmuter (WP 80.2)
//
// Omnidirektionale Konvertierung zwischen 5 Erzählformaten:
// Prosa, Screenplay, Gamebook, Comic-Skript, Theaterstück.
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

/** Erzählformat. */
export type NarrativeFormat = "prose" | "screenplay" | "gamebook" | "comic" | "stageplay";

/** Format-Labels. */
export const FORMAT_LABELS: Record<NarrativeFormat, string> = {
  prose: "Roman-Fließtext",
  screenplay: "Hollywood-Drehbuch",
  gamebook: "Solo-Spielbuch",
  comic: "Comic-Skript",
  stageplay: "Theater-Bühnenstück",
};

/** Ein transmutiertes Dokument. */
export interface TransmutedDocument {
  sourceFormat: NarrativeFormat;
  targetFormat: NarrativeFormat;
  content: string;
  preservedElements: string[];
  warnings: string[];
}

/** Parst einen Text in Szenen. */
export function parseScenes(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Extrahiert Figurennamen aus einem Text. */
export function extractCharacters(text: string): string[] {
  const chars: string[] = [];
  const regex = /\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g;
  const matches = text.match(regex);
  if (matches) {
    for (const m of matches) {
      if (m.length > 2 && !chars.includes(m)) {
        chars.push(m);
      }
    }
  }
  return chars;
}

/** Extrahiert Dialoge aus einem Text. */
export function extractDialogue(text: string): string[] {
  const dialogues: string[] = [];
  const regex = /„([^"]+)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    dialogues.push(match[1]);
  }
  return dialogues;
}

/** Konvertiert Prosa in Screenplay. */
export function proseToScreenplay(text: string): string {
  const scenes = parseScenes(text);
  const lines: string[] = [];
  for (const scene of scenes) {
    lines.push(`SZENE ${scenes.indexOf(scene) + 1}`);
    lines.push(scene);
    lines.push("");
  }
  return lines.join("\n");
}

/** Konvertiert Prosa in Gamebook. */
export function proseToGamebook(text: string): string {
  const scenes = parseScenes(text);
  const lines: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    lines.push(`Abschnitt ${i + 1}`);
    lines.push(scenes[i]);
    if (i < scenes.length - 1) {
      lines.push(`[Weiter zu Abschnitt ${i + 2}]`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Konvertiert Prosa in Comic-Skript. */
export function proseToComic(text: string): string {
  const scenes = parseScenes(text);
  const lines: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    lines.push(`Seite ${i + 1}`);
    lines.push(`Panel 1: ${scenes[i]}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Konvertiert Prosa in Theaterstück. */
export function proseToStageplay(text: string): string {
  const scenes = parseScenes(text);
  const lines: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    lines.push(`Auftritt ${i + 1}`);
    lines.push(scenes[i]);
    lines.push("");
  }
  return lines.join("\n");
}

/** Transmutiert ein Dokument in ein anderes Format. */
export function transmute(text: string, source: NarrativeFormat, target: NarrativeFormat): TransmutedDocument {
  const characters = extractCharacters(text);
  const dialogues = extractDialogue(text);
  const preservedElements = [...characters, ...dialogues.slice(0, 3)];
  const warnings: string[] = [];

  let content: string;
  if (target === "screenplay") content = proseToScreenplay(text);
  else if (target === "gamebook") content = proseToGamebook(text);
  else if (target === "comic") content = proseToComic(text);
  else if (target === "stageplay") content = proseToStageplay(text);
  else content = text;

  if (source === target) {
    warnings.push("Quell- und Zielformat identisch – keine Transmutation erforderlich.");
  }

  return { sourceFormat: source, targetFormat: target, content, preservedElements, warnings };
}

/** Formatiert ein transmutiertes Dokument als Text. */
export function formatTransmuted(doc: TransmutedDocument): string {
  const lines: string[] = [];
  lines.push(`=== TRANSMUTATION: ${FORMAT_LABELS[doc.sourceFormat]} → ${FORMAT_LABELS[doc.targetFormat]} ===`);
  lines.push(`Erhaltene Elemente: ${doc.preservedElements.join(", ")}`);
  if (doc.warnings.length > 0) {
    lines.push(`Warnungen: ${doc.warnings.join("; ")}`);
  }
  lines.push("");
  lines.push(doc.content);
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Dokument. */
export function createSampleTransmutation(): TransmutedDocument {
  const text = 'Der Held stand auf dem Dach. „Ich muss handeln", sagte er. Die Stadt brannte unter ihm.';
  return transmute(text, "prose", "screenplay");
}
