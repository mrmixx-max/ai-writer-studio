// freudianSlipDialogueSynthesizer.ts (WP 94.1)
// Freudscher Fehlleistungs- & Vermeidungs-Synthesizer

export interface FreudianSlipProfile {
  id: string;
  surfaceTopic: string;
  repressedContent: string;
  characterName: string;
  dialogueLines: DialogueLine[];
  leakageMarkers: LeakageMarker[];
  seed: number;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  hasLeakage: boolean;
  leakageType?: "slip" | "avoidance" | "stutter" | "substitution";
}

export interface LeakageMarker {
  index: number;
  originalWord: string;
  leakedWord: string;
  type: "slip" | "avoidance" | "stutter" | "substitution";
  context: string;
}

const AVOIDANCE_PHRASES = [
  "Ich möchte nicht darüber reden",
  "Das geht Sie nichts an",
  "Können wir das Thema wechseln?",
  "Ich erinnere mich nicht genau",
  "Es ist kompliziert",
  "Lassen Sie uns später darüber sprechen",
  "Ich weiß nicht, was Sie meinen",
  "Das ist lange her",
];

const STUTTER_PATTERNS = [
  "Ich... ich meinte...",
  "Es war ein... ein Versehen",
  "Ich habe nicht... nicht gewollt",
  "Das war... das war anders",
];

const SUBSTITUTION_MAP: Record<string, string[]> = {
  "Mord": ["Mord", "Tod", "Ende", "Schluss", "Mord", "Mord"],
  "Verrat": ["Verrat", "Bruch", "Fehler", "Irrtum", "Verrat"],
  "Liebe": ["Liebe", "Leid", "Lust", "Last", "Liebe"],
  "Angst": ["Angst", "Enge", "Ahnung", "Achtung", "Angst"],
  "Schuld": ["Schuld", "Schulden", "Schlund", "Schulter", "Schuld"],
  "Tod": ["Tod", "Tot", "Tor", "Trug", "Tod"],
  "Blut": ["Blut", "Blüte", "Blick", "Boden", "Blut"],
  "Messer": ["Messer", "Messen", "Messen", "Meer", "Messer"],
  "Gift": ["Gift", "Gift", "Glaube", "Gier", "Gift"],
  "Feuer": ["Feuer", "Feurig", "Ferne", "Falle", "Feuer"],
};

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return (z ^ (z >>> 16)) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) return undefined as unknown as T;
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)];
}

function extractTabooWords(content: string): string[] {
  const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const tabooCandidates = ["mord", "verrat", "liebe", "angst", "schuld", "tod", "blut", "messer", "gift", "feuer",
    "heimlich", "geheim", "versteckt", "gelogen", "betrogen", "gestohlen", "getötet", "vergiftet"];
  return words.filter(w => tabooCandidates.includes(w.toLowerCase()));
}

function generateSubstitution(word: string, rng: () => number): string {
  if (!word) return "";
  const lower = word.toLowerCase();
  const key = Object.keys(SUBSTITUTION_MAP).find(k => k.toLowerCase() === lower);
  if (key) {
    const options = SUBSTITUTION_MAP[key];
    return pickRandom(options, rng) || word;
  }
  const vowels = "aeiouäöü";
  let result = "";
  for (const ch of word) {
    if (vowels.includes(ch.toLowerCase()) && rng() < 0.3) {
      result += pickRandom(vowels.split(""), rng);
    } else {
      result += ch;
    }
  }
  return result || word;
}

export function createFreudianSlipProfile(
  surfaceTopic: string,
  repressedContent: string,
  characterName: string = "Protagonist",
  seed: number = 42
): FreudianSlipProfile {
  const rng = createSeededRandom(hashString(surfaceTopic + repressedContent + characterName + seed));
  const tabooWords = extractTabooWords(repressedContent || " ");
  const dialogueLines: DialogueLine[] = [];
  const leakageMarkers: LeakageMarker[] = [];
  let lineIndex = 0;

  const openingLine = pickRandom(AVOIDANCE_PHRASES, rng) || "Nun, das ist eine interessante Frage...";
  dialogueLines.push({
    speaker: characterName,
    text: openingLine,
    hasLeakage: false,
  });
  lineIndex++;

  const numLines = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < numLines; i++) {
    const useAvoidance = rng() < 0.4;
    const useSlip = tabooWords.length > 0 && rng() < 0.35;
    const useStutter = rng() < 0.2;
    const useSubstitution = tabooWords.length > 0 && rng() < 0.25;

    let text = "";
    let hasLeakage = false;
    let leakageType: LeakageMarker["type"] = "avoidance";

    if (useSlip && tabooWords.length > 0) {
      const taboo = pickRandom(tabooWords, rng);
      const substitution = generateSubstitution(taboo, rng);
      text = `Ich habe nie... nie ${substitution}... ${taboo} getan.`;
      hasLeakage = true;
      leakageType = "slip";
      leakageMarkers.push({
        index: lineIndex,
        originalWord: taboo,
        leakedWord: substitution,
        type: "slip",
        context: text,
      });
    } else if (useSubstitution && tabooWords.length > 0) {
      const taboo = pickRandom(tabooWords, rng);
      const substitution = generateSubstitution(taboo, rng);
      text = `Es war ein reiner ${substitution}... äh, ${taboo}.`;
      hasLeakage = true;
      leakageType = "substitution";
      leakageMarkers.push({
        index: lineIndex,
        originalWord: taboo,
        leakedWord: substitution,
        type: "substitution",
        context: text,
      });
    } else if (useStutter) {
      text = pickRandom(STUTTER_PATTERNS, rng) || "Äh... ähm...";
      hasLeakage = true;
      leakageType = "stutter";
    } else if (useAvoidance) {
      text = pickRandom(AVOIDANCE_PHRASES, rng) || "Ich möchte nicht darüber reden.";
      hasLeakage = true;
      leakageType = "avoidance";
    } else {
      text = `Natürlich, ${surfaceTopic.toLowerCase()} ist ganz normal.`;
    }

    dialogueLines.push({
      speaker: characterName,
      text,
      hasLeakage,
      leakageType,
    });
    lineIndex++;
  }

  const closingLine = `Lassen Sie mich in Ruhe mit ${surfaceTopic.toLowerCase()}.`;
  dialogueLines.push({
    speaker: characterName,
    text: closingLine,
    hasLeakage: false,
  });

  return {
    id: `FREUD-${hashString(surfaceTopic + repressedContent + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    surfaceTopic,
    repressedContent,
    characterName,
    dialogueLines,
    leakageMarkers,
    seed,
  };
}

export function formatFreudianSlipProfile(profile: FreudianSlipProfile): string {
  const lines = [
    "🧠 FREUD'SCHER FEHLLEISTUNGS-SYNTHESIZER",
    `ID: ${profile.id}`,
    `Figur: ${profile.characterName}`,
    `Oberflächen-Thema: ${profile.surfaceTopic}`,
    `Verdrängter Inhalt: ${profile.repressedContent}`,
    `Seed: ${profile.seed}`,
    "",
    "💬 DIALOG:",
  ];

  for (const line of profile.dialogueLines) {
    const marker = line.hasLeakage ? " ⚡" : "";
    lines.push(`${line.speaker}: "${line.text}"${marker}`);
  }

  if (profile.leakageMarkers.length > 0) {
    lines.push("", "⚡ UNBEWUSSTE DURCHBRÜCHE (LEAKAGE):");
    for (const leak of profile.leakageMarkers) {
      lines.push(
        `  Zeile ${leak.index}: "${leak.leakedWord}" → "${leak.originalWord}" (${leak.type})`
      );
    }
  }

  return lines.join("\n");
}

export function createSampleProfile(): FreudianSlipProfile {
  return createFreudianSlipProfile(
    "Der Unfall",
    "Ich habe den Bremszug absichtlich durchgeschnitten, weil er mich erpresst hat. Mord aus Notwehr.",
    "Thomas",
    42
  );
}

export function createSampleLeakage(): LeakageMarker[] {
  return [
    { index: 2, originalWord: "Mord", leakedWord: "Mord", type: "slip", context: 'Ich habe nie... nie Mord... Mord getan.' },
    { index: 4, originalWord: "Tod", leakedWord: "Tor", type: "substitution", context: 'Es war ein reiner Tor... äh, Tod.' },
  ];
}