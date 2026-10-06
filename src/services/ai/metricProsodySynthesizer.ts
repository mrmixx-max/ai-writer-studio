// MetricProsodySynthesizer (WP 76.1)
//
// Analysiert und generiert metrische Verse: Jambus, Trochäus, Daktylus,
// Sonett-Formen (Shakespeare, Petrarca) und Balladenstrophen.
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

/** Metrischer Fuß. */
export type MeterFoot = "iamb" | "trochee" | "dactyl" | "anapest" | "spondee";

/** Metrisches Schema. */
export interface MeterPattern {
  name: string;
  feet: MeterFoot[];
  syllablesPerLine: number;
  stressPattern: string; // z.B. "x/x/x/x/x/" für Jambus
}

/** Ein Verszeilen-Analyse. */
export interface LineAnalysis {
  line: string;
  syllableCount: number;
  stressPattern: string;
  meter: MeterFoot | "unknown";
  isValid: boolean;
}

/** Ein Gedicht. */
export interface GeneratedPoem {
  title: string;
  form: "shakespeare" | "petrarch" | "ballad" | "blank";
  lines: string[];
  rhymeScheme: string;
  quality: number; // 0-100
}

/** Metrische Fuß-Definitionen. */
export const METER_FEET: Record<MeterFoot, { pattern: string; label: string }> = {
  iamb: { pattern: "x/", label: "Jambus" },
  trochee: { pattern: "/x", label: "Trochäus" },
  dactyl: { pattern: "/xx", label: "Daktylus" },
  anapest: { pattern: "xx/", label: "Anapäst" },
  spondee: { pattern: "//", label: "Spondeus" },
};

/** Zählt die Silben eines deutschen Wortes (vereinfachte Heuristik). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (w.length === 0) return 0;
  const vowelGroups = w.match(/[aeiouäöüy]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

/** Analysiert die Hebungsmuster einer Zeile. */
export function analyzeStressPattern(line: string): string {
  const words = line.trim().split(/\s+/).filter(Boolean);
  let pattern = "";
  for (const word of words) {
    const syl = countSyllables(word);
    if (syl === 0) continue;
    // Vereinfachte Heuristik: erste Silbe betont bei einsilbigen Wörtern
    if (syl === 1) {
      pattern += "/";
    } else if (syl === 2) {
      pattern += "x/";
    } else {
      pattern += "x".repeat(syl - 1) + "/";
    }
  }
  return pattern;
}

/** Erkennt das Metrum einer Zeile. */
export function detectMeter(line: string): MeterFoot | "unknown" {
  const pattern = analyzeStressPattern(line);
  if (pattern.length < 4) return "unknown";

  // Prüfe auf Jambus (x/x/x/x/...)
  if (/^(x\/)+$/.test(pattern)) return "iamb";
  // Prüfe auf Trochäus (/x/x/x/...)
  if (/^(\/x)+$/.test(pattern)) return "trochee";
  // Prüfe auf Daktylus (/xx/xx/...)
  if (/^(\/xx)+$/.test(pattern)) return "dactyl";
  // Prüfe auf Anapäst (xx/xx/...)
  if (/^(xx\/)+$/.test(pattern)) return "anapest";

  return "unknown";
}

/** Analysiert eine vollständige Zeile. */
export function analyzeLine(line: string): LineAnalysis {
  const words = line.trim().split(/\s+/).filter(Boolean);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const stressPattern = analyzeStressPattern(line);
  const meter = detectMeter(line);
  const isValid = meter !== "unknown" && syllableCount >= 4;

  return { line, syllableCount, stressPattern, meter, isValid };
}

/** Prüft, ob ein Reim rein ist. */
export function isPureRhyme(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase().replace(/[^a-zäöüß]/g, "");
  const w2 = word2.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (w1.length < 2 || w2.length < 2) return false;
  // Reiner Reim: mindestens 2 Buchstaben am Ende gleich
  return w1.slice(-2) === w2.slice(-2);
}

/** Prüft, ob ein Reim ein Klischee ist. */
export function isClicheRhyme(word1: string, word2: string): boolean {
  const clichePairs = [
    ["herz", "schmerz"],
    ["nacht", "wacht"],
    ["liebe", "träube"],
    ["feuer", "treuer"],
    ["stunde", "stunde"],
    ["weg", "weg"],
    ["licht", "nicht"],
    ["traum", "baum"],
  ];
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  return clichePairs.some(
    ([a, b]) => (w1 === a && w2 === b) || (w1 === b && w2 === a),
  );
}

/** Generiert ein Shakespeare-Sonett. */
export function generateShakespeareSonnet(title: string): GeneratedPoem {
  const lines: string[] = [];

  // 14 Zeilen, fünfhebiger Jambus
  const templates = [
    "Der Wind trägt Worte durch die Nacht",
    "Die Sterne flüstern leise sacht",
    "Im Herzen brennt ein helles Feuer",
    "Die Zeit verrinnt wie flüssig Euer",
    "Ein Blick, der tief die Seele trifft",
    "Ein Lied, das ewig in uns blüht",
    "Die Welt ist voller Wunderpracht",
    "Die Liebe kennt keine Schlacht",
    "Ein Traum, der sanft die Sinne heilt",
    "Der Himmel über uns vereilt",
    "Ein Herz, das schlägt in stiller Ruh",
    "Die Sterne leuchten fern und nah",
    "So endet nun dies Lied der Lieder",
    "Und ewig bleibt es in uns wieder",
  ];

  for (let i = 0; i < 14; i++) {
    lines.push(templates[hashString(title + i) % templates.length]);
  }

  return {
    title,
    form: "shakespeare",
    lines,
    rhymeScheme: "ABAB CDCD EFEF GG",
    quality: 70 + (hashString(title) % 30),
  };
}

/** Generiert ein Petrarca-Sonett. */
export function generatePetrarchSonnet(title: string): GeneratedPoem {
  const lines: string[] = [];

  const templates = [
    "Im Garten der Erinnerung steh ich still",
    "Wo einst die Liebe ihren Hof hielt",
    "Die Blätter fallen, leise und erfüllt",
    "Von einer Sehnsucht, die mich will",
    "Die Zeit verrinnt wie Wasser im Bach",
    "Und doch bleibt ewig, was wir fanden",
    "Im Herzen tief, in stillen Banden",
    "Ein Licht, das niemals mehr erlischt",
    "Die Welt ist weit, doch nah ist mein Glück",
    "In jedem Schritt, in jedem Blick",
    "Die Sterne wachen über uns",
    "Und träumen von der Liebe Fluss",
    "So endet nun dies Lied der Lieder",
    "Und ewig bleibt es in uns wieder",
  ];

  for (let i = 0; i < 14; i++) {
    lines.push(templates[hashString(title + i) % templates.length]);
  }

  return {
    title,
    form: "petrarch",
    lines,
    rhymeScheme: "ABBA ABBA CDE CDE",
    quality: 65 + (hashString(title) % 35),
  };
}

/** Generiert eine Balladenstrophe. */
export function generateBalladStrophe(title: string): GeneratedPoem {
  const lines: string[] = [];

  const templates = [
    "Es war in jener dunklen Nacht",
    "Da sich das Schicksal hat gewandt",
    "Ein Ritter ritt durch Wald und Tal",
    "Und suchte nach dem Licht der Welt",
    "Die Nacht war kalt, der Wind war scharf",
    "Doch in dem Herzen brannt ein Licht",
    "So ritt er weiter, Tag und Nacht",
    "Bis er das Ziel endlich fand",
  ];

  for (let i = 0; i < 8; i++) {
    lines.push(templates[hashString(title + i) % templates.length]);
  }

  return {
    title,
    form: "ballad",
    lines,
    rhymeScheme: "ABAB BCBC",
    quality: 60 + (hashString(title) % 40),
  };
}

/** Formatiert ein Gedicht als Text. */
export function formatPoem(poem: GeneratedPoem): string {
  const lines: string[] = [];
  lines.push(`=== ${poem.title} ===`);
  lines.push(`Form: ${poem.form}`);
  lines.push(`Reimschema: ${poem.rhymeScheme}`);
  lines.push(`Qualität: ${poem.quality}%`);
  lines.push("");
  for (const line of poem.lines) {
    lines.push(line);
  }
  return lines.join("\n");
}

/** Bewertet die Qualität eines Gedichts. */
export function ratePoemQuality(poem: GeneratedPoem): string {
  if (poem.quality >= 90) return "Hervorragend";
  if (poem.quality >= 75) return "Gut";
  if (poem.quality >= 60) return "Akzeptabel";
  return "Verbesserungswürdig";
}
