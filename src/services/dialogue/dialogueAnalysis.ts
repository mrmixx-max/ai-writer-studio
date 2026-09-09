// Dialogue Analysis (Sprint 27, Agent 2): Dialog-Analysen, Redeverteilung,
// Spannungskurve. Lokal, kein LLM nötig, deterministisch.

export interface DialogueLine {
  character: string;
  text: string;
  line: number;
  emotion: string;
  wordCount: number;
}

export interface CharacterDialogue {
  character: string;
  totalLines: number;
  totalWords: number;
  averageLineLength: number;
  emotions: Record<string, number>;
}

export interface DialogueAnalysis {
  totalLines: number;
  totalWords: number;
  characters: CharacterDialogue[];
  dialogueRatio: number;
  averageLineLength: number;
  tensionCurve: { line: number; tension: number }[];
  emotionDistribution: Record<string, number>;
}

/**
 * Extrahiert Dialogzeilen aus dem Text.
 * Erkennt Muster: »...«, „...“, "...", —..., --...
 */
export function extractDialogue(text: string): DialogueLine[] {
  const lines = text.split("\n");
  const dialogue: DialogueLine[] = [];
  const patterns = [
    /^[»""„"»]([^»""„"»]+)[»""„"»]\s*,?\s*(?:sagte|fragte|antwortete|rief|murmelte|flüsterte|schrie)?\s*(\w+)?/i,
    /^[—–-]\s*([^—–-]+?)(?:\s*,?\s*(?:sagte|fragte|antwortete|rief|murmelte|flüsterte|schrie)?\s*(\w+))?$/i,
    /^([A-ZÄÖÜ][a-zäöüß]+)\s*:\s*[""]?(.+?)[""]?\s*$/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const text = match[1]?.trim() ?? match[2]?.trim() ?? "";
        const character = match[2]?.trim() ?? match[1]?.trim() ?? "Unbekannt";
        if (text.length > 3) {
          dialogue.push({
            character: character.length < 30 ? character : "Unbekannt",
            text,
            line: i,
            emotion: extractEmotion(text),
            wordCount: text.split(/\s+/).filter(Boolean).length,
          });
        }
        break;
      }
    }
  }

  return dialogue;
}

function extractEmotion(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("!") && (lower.includes("schnell") || lower.includes("schnell"))) return "aufgeregt";
  if (lower.includes("?") && (lower.includes("was") || lower.includes("wie"))) return "neugierig";
  if (lower.includes("...")) return "nachdenklich";
  if (lower.includes("!")) return "laut";
  if (lower.includes("liebe") || lower.includes("herz")) return "zärtlich";
  if (lower.includes("hass") || lower.includes("wut")) return "wütend";
  if (lower.includes("angst") || lower.includes("furcht")) return "ängstlich";
  if (lower.includes("freude") || lower.includes("glück")) return "freudig";
  return "neutral";
}

/**
 * Analysiert die Dialogstruktur.
 */
export function analyzeDialogue(text: string): DialogueAnalysis {
  const dialogue = extractDialogue(text);
  const allWords = text.split(/\s+/).filter(Boolean);
  const characterMap = new Map<string, { lines: number; words: number; emotions: Record<string, number> }>();

  for (const line of dialogue) {
    if (!characterMap.has(line.character)) {
      characterMap.set(line.character, { lines: 0, words: 0, emotions: {} });
    }
    const char = characterMap.get(line.character)!;
    char.lines++;
    char.words += line.wordCount;
    char.emotions[line.emotion] = (char.emotions[line.emotion] ?? 0) + 1;
  }

  const characters: CharacterDialogue[] = [...characterMap.entries()].map(([name, data]) => ({
    character: name,
    totalLines: data.lines,
    totalWords: data.words,
    averageLineLength: data.lines > 0 ? Math.round(data.words / data.lines) : 0,
    emotions: data.emotions,
  }));

  const totalWords = dialogue.reduce((s, d) => s + d.wordCount, 0);
  const tensionCurve = calculateTensionCurve(dialogue);
  const emotionDistribution = dialogue.reduce((acc, d) => {
    acc[d.emotion] = (acc[d.emotion] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalLines: dialogue.length,
    totalWords,
    characters,
    dialogueRatio: allWords.length > 0 ? Math.round((totalWords / allWords.length) * 100) / 100 : 0,
    averageLineLength: dialogue.length > 0 ? Math.round(totalWords / dialogue.length) : 0,
    tensionCurve,
    emotionDistribution,
  };
}

function calculateTensionCurve(dialogue: DialogueLine[]): { line: number; tension: number }[] {
  const curve: { line: number; tension: number }[] = [];
  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    let tension = 30;
    if (line.emotion === "aufgeregt" || line.emotion === "wütend") tension = 80;
    if (line.emotion === "ängstlich") tension = 70;
    if (line.emotion === "laut") tension = 75;
    if (line.emotion === "zärtlich") tension = 20;
    if (line.emotion === "freudig") tension = 25;
    if (line.emotion === "nachdenklich") tension = 40;
    if (line.text.includes("!")) tension += 10;
    if (line.text.includes("?")) tension += 5;
    if (line.text.includes("...")) tension -= 5;
    curve.push({ line: i, tension: Math.min(100, Math.max(0, tension)) });
  }
  return curve;
}

/**
 * Generiert einen ASCII-Diagramm der Spannungskurve.
 */
export function generateTensionAscii(curve: { line: number; tension: number }[], width = 50, height = 12): string {
  if (curve.length === 0) return "Keine Daten";

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(" "));
  for (let i = 0; i < curve.length; i++) {
    const x = Math.floor((i / curve.length) * (width - 1));
    const y = height - 1 - Math.floor((curve[i].tension / 100) * (height - 1));
    if (y >= 0 && y < height && x >= 0 && x < width) {
      grid[y][x] = "█";
    }
  }

  const lines = grid.map((row) => row.join(""));
  lines.push("0%" + " ".repeat(width - 8) + "100%");
  return lines.join("\n");
}
