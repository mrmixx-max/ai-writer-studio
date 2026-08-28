// KI-Gedächtnis: automatische Extraktion von Erinnerungen aus Chat-/Dokumenttext.
// Heuristisch (ohne LLM): erkennt Figuren, Orte und Fakten an Hand von Mustern.
import type { MemoryKind } from "./types";

const CHARACTER_PATTERNS = [
  /(?:die|der)\s+Figur\s+["„']?([A-ZÄÖÜ][\wäöüß-]{2,30})["„']?/g,
  /(?:charakter|protagonist|antagonist|held(?:in)?|hauptfigur|nebenfigur)\s+[:—-]?\s+([A-ZÄÖÜ][\wäöüß-]{2,30})/gi,
];

const LOCATION_PATTERNS = [
  /(?:der\s+Ort|die\s+Stadt|das\s+Dorf|das\s+Schloss|die\s+Burg|das\s+Königreich|die\s+Welt)\s+["„']?([A-ZÄÖÜ][\wäöüß-]{2,30})["„']?/g,
  /(?:spielt|handelt)\s+.*?in\s+([A-ZÄÖÜ][\wäöüß-]{2,30})/g,
];

const FACT_PATTERNS = [
  /(?:wichtig|merk|notier|behalte|erinnere|fakt|fakten?(?:blatt)?)\s*[:—-]\s+(.{10,300})/gi,
  /(?:entscheidung|beschlossen|festgelegt)\s*[:—-]\s+(.{10,300})/gi,
];

interface Candidate {
  kind: MemoryKind;
  title: string;
  content: string;
  importance: number;
}

function collect(pattern: RegExp, text: string, fn: (m: RegExpExecArray) => Candidate | null): Candidate[] {
  const out: Candidate[] = [];
  const re = new RegExp(pattern.source, pattern.flags);
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(text)) !== null && guard++ < 200) {
    const c = fn(m);
    if (c) out.push(c);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/**
 * Extrahiert Kandidaten für das Langzeit-Gedächtnis aus einem Text (Chat-Nachricht, Dokument).
 * Dedupe über Titel passiert im store (saveMemory merged Duplikate).
 */
export function extractMemories(text: string): Candidate[] {
  if (!text || text.length < 10) return [];
  const out: Candidate[] = [];

  for (const p of CHARACTER_PATTERNS) {
    out.push(...collect(p, text, (m) => ({
      kind: "charakter",
      title: m[1],
      content: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 160).trim(),
      importance: 3,
    })));
  }
  for (const p of LOCATION_PATTERNS) {
    out.push(...collect(p, text, (m) => ({
      kind: "ort",
      title: m[1],
      content: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 160).trim(),
      importance: 3,
    })));
  }
  for (const p of FACT_PATTERNS) {
    out.push(...collect(p, text, (m) => ({
      kind: "fakt",
      title: m[1].slice(0, 60).trim(),
      content: m[1].trim(),
      importance: 4,
    })));
  }

  // Dedupe innerhalb des Extraktionslaufs
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.kind}:${c.title.toLowerCase()}`;
    if (seen.has(key) || c.title.length < 2) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

/**
 * Extrahiert und speichert Erinnerungen aus einer Chat-Nachricht.
 * sessionId/chapterId/projectId werden vermerkt, damit der Ursprung nachvollziehbar bleibt.
 */
export const MEMORY_EXTRACTION_MIN_LENGTH = 40;
