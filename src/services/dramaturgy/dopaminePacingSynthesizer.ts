// DopaminePacingSynthesizer (WP 72.1)
//
// Analysiert den narrativen Pacing eines Manuskripts und generiert
// Dopamin-Kurven, Curiosity-Loops und Cliffhanger-Positionen.
//
// Deterministisch: FNV-1a + mulberry32 für reproduzierbare Ergebnisse.
// Keine Node-Module — browser-kompatibel.

/** FNV-1a Hash für deterministische Variation. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG für deterministische Zufallswerte. */
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

/** Ein Absatz im Manuskript. */
export interface ManuscriptParagraph {
  index: number;
  text: string;
  wordCount: number;
}

/** Dopamin-Level eines Absatzes (0-100). */
export interface DopaminePoint {
  paragraphIndex: number;
  level: number;
  label: string;
}

/** Curiosity-Loop: Offene Frage → Verspätete Antwort. */
export interface CuriosityLoop {
  setupParagraph: number;
  payoffParagraph: number;
  question: string;
  tension: number;
}

/** Cliffhanger-Position. */
export interface Cliffhanger {
  paragraphIndex: number;
  type: "reveal" | "danger" | "reversal" | "question";
  strength: number;
  description: string;
}

/** Pacing-Bericht für ein ganzes Manuskript. */
export interface PacingReport {
  dopamineCurve: DopaminePoint[];
  curiosityLoops: CuriosityLoop[];
  cliffhangers: Cliffhanger[];
  averageDopamine: number;
  peakDopamine: number;
  peakParagraph: number;
  pacingVerdict: string;
}

/** Schlüsselwörter für Dopamin-Trigger. */
const DOPAMINE_TRIGGERS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\b(plötzlich|unerwartet|schockierend|erstaunlich)\b/gi, weight: 25, label: "Überraschung" },
  { pattern: /\b(geheimnis|verborgen|unbekannt|rätselhaft)\b/gi, weight: 20, label: "Neugier" },
  { pattern: /\b(gefahr|bedrohung|angst|panik|sterben)\b/gi, weight: 22, label: "Bedrohung" },
  { pattern: /\b(kampf|schlacht|explosion|verfolgung|flucht)\b/gi, weight: 18, label: "Action" },
  { pattern: /\b(trauer|verlust|schmerz|abschied|träne)\b/gi, weight: 15, label: "Emotion" },
  { pattern: /\b(lächeln|lachen|witz|komisch|albern)\b/gi, weight: 10, label: "Humor" },
  { pattern: /\b(liebe|umarmung|kuss|herz|zärtlich)\b/gi, weight: 12, label: "Zuneigung" },
  { pattern: /\b(entdeckt|enthüllt|wahrheit|beweis|indizien)\b/gi, weight: 24, label: "Enthüllung" },
  { pattern: /\b(verrat|betrug|lüge|täuschung|doppelzüngig)\b/gi, weight: 21, label: "Verrat" },
  { pattern: /\b(sieg|gewonnen|gerettet|triumph|erfolg)\b/gi, weight: 16, label: "Sieg" },
];

/** Schlüsselwörter für Curiosity-Loop-Erkennung. */
const CURIOSITY_SETUP: RegExp = /\b(wer|was|warum|wieso|weshalb|wohin|wann)\s+(ist|war|wird|hat|konnte|musste)\b/gi;
const CURIOSITY_PAYOFF: RegExp = /\b(also|folglich|dadurch|deshalb|darum|demnach|somit)\b/gi;

/** Schlüsselwörter für Cliffhanger-Typen. */
const CLIFFHANGER_PATTERNS: Array<{ type: Cliffhanger["type"]; pattern: RegExp; label: string }> = [
  { type: "reveal", pattern: /\b(enthüllt|entdeckt|wahrheit|beweis|indizien|gestanden|eingestanden)\b/gi, label: "Enthüllung" },
  { type: "danger", pattern: /\b(gefahr|bedrohung|sterben|angst|panik|schuss|explosion|attentat)\b/gi, label: "Gefahr" },
  { type: "reversal", pattern: /\b(doch|jedoch|aber|plötzlich|dann|jedoch|umgekehrt|gegen alle)\b/gi, label: "Wendepunkt" },
  { type: "question", pattern: /\b(wer|was|warum|wieso|weshalb)\s+(ist|war|wird|hat)\b/gi, label: "Offene Frage" },
];

/** Zerlegt Text in Absätze. */
export function parseParagraphs(text: string): ManuscriptParagraph[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p, i) => ({
      index: i + 1,
      text: p,
      wordCount: p.split(/\s+/).filter(Boolean).length,
    }));
}

/** Berechnet das Dopamin-Level eines Absatzes. */
export function computeDopamineLevel(paragraph: ManuscriptParagraph, seed: number): DopaminePoint {
  const rng = createSeededRandom(seed + paragraph.index);
  let level = 15; // Basis-Level

  for (const trigger of DOPAMINE_TRIGGERS) {
    const matches = paragraph.text.match(trigger.pattern);
    if (matches) {
      level += trigger.weight * Math.min(matches.length, 3);
    }
  }

  // Wortlängen-Einfluss: kurze Sätze = höheres Pacing
  const sentences = paragraph.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgLen = paragraph.wordCount / sentences.length;
    if (avgLen < 8) level += 10;
    else if (avgLen < 15) level += 5;
  }

  // Deterministischer Jitter
  level += Math.floor(rng() * 8) - 4;

  // Clamp
  level = Math.max(5, Math.min(100, level));

  const label =
    level >= 80 ? "Hoch" : level >= 60 ? "Mittel" : level >= 40 ? "Ruhig" : "Tief";

  return { paragraphIndex: paragraph.index, level, label };
}

/** Erkennt Curiosity-Loops (Frage → Antwort über mehrere Absätze). */
export function detectCuriosityLoops(paragraphs: ManuscriptParagraph[]): CuriosityLoop[] {
  const loops: CuriosityLoop[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const setupMatch = paragraphs[i].text.match(CURIOSITY_SETUP);
    if (!setupMatch) continue;

    // Suche Antwort in den nächsten 1-5 Absätzen
    for (let j = i + 1; j <= Math.min(i + 5, paragraphs.length - 1); j++) {
      if (paragraphs[j].text.match(CURIOSITY_PAYOFF)) {
        const question = setupMatch[0];
        const distance = j - i;
        const tension = Math.min(100, 30 + distance * 15);
        loops.push({
          setupParagraph: paragraphs[i].index,
          payoffParagraph: paragraphs[j].index,
          question,
          tension,
        });
        break;
      }
    }
  }

  return loops;
}

/** Erkennt Cliffhanger am Ende von Absätzen. */
export function detectCliffhangers(paragraphs: ManuscriptParagraph[]): Cliffhanger[] {
  const cliffhangers: Cliffhanger[] = [];

  for (const p of paragraphs) {
    // Nur letzte 30% des Absatzes prüfen
    const tailStart = Math.floor(p.text.length * 0.7);
    const tail = p.text.slice(tailStart);

    for (const ch of CLIFFHANGER_PATTERNS) {
      const match = tail.match(ch.pattern);
      if (match) {
        const strength = Math.min(100, 40 + match[0].length * 2);
        cliffhangers.push({
          paragraphIndex: p.index,
          type: ch.type,
          strength,
          description: `${ch.label}: „${match[0]}"`,
        });
        break;
      }
    }
  }

  return cliffhangers;
}

/** Erstellt den vollständigen Pacing-Bericht. */
export function analyzePacing(text: string, seed: number = 42): PacingReport {
  const paragraphs = parseParagraphs(text);
  const dopamineCurve = paragraphs.map((p) => computeDopamineLevel(p, seed));
  const curiosityLoops = detectCuriosityLoops(paragraphs);
  const cliffhangers = detectCliffhangers(paragraphs);

  const levels = dopamineCurve.map((d) => d.level);
  const averageDopamine = levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0;
  const peakDopamine = levels.length > 0 ? Math.max(...levels) : 0;
  const peakParagraph = levels.indexOf(peakDopamine) + 1;

  let pacingVerdict: string;
  if (averageDopamine >= 70) pacingVerdict = "Sehr hoch — möglicherweise überreizt";
  else if (averageDopamine >= 55) pacingVerdict = "Optimal — guter narrativer Fluss";
  else if (averageDopamine >= 40) pacingVerdict = "Ausgewogen — ruhige Passagen vorhanden";
  else pacingVerdict = "Niedrig — mehr Spannung empfohlen";

  return {
    dopamineCurve,
    curiosityLoops,
    cliffhangers,
    averageDopamine,
    peakDopamine,
    peakParagraph,
    pacingVerdict,
  };
}

/** Generiert eine textuelle Dopamin-Kurve (ASCII-Balken). */
export function formatDopamineCurve(report: PacingReport): string {
  const lines = report.dopamineCurve.map((d) => {
    const bar = "█".repeat(Math.floor(d.level / 5));
    return `§${String(d.paragraphIndex).padStart(3)} ${String(d.level).padStart(3)}% ${bar}`;
  });
  return lines.join("\n");
}

/** Generiert eine Zusammenfassung der Curiosity-Loops. */
export function formatCuriosityLoops(loops: CuriosityLoop[]): string {
  if (loops.length === 0) return "Keine Curiosity-Loops gefunden.";
  return loops
    .map(
      (l) =>
        `§${l.setupParagraph} → §${l.payoffParagraph}: „${l.question}" (Spannung: ${l.tension}%)`,
    )
    .join("\n");
}

/** Generiert eine Zusammenfassung der Cliffhanger. */
export function formatCliffhangers(cliffhangers: Cliffhanger[]): string {
  if (cliffhangers.length === 0) return "Keine Cliffhanger gefunden.";
  return cliffhangers
    .map((c) => `§${c.paragraphIndex} [${c.type}] ${c.description} (Stärke: ${c.strength}%)`)
    .join("\n");
}
