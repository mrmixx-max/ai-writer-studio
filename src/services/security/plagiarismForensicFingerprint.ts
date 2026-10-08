// PlagiarismForensicFingerprint (WP 107.2)
// Forensischer Plagiats- & Stil-Fingerabdruck.
// Syntaktischer N-Gram-Scanner, Zero-Entropy-Fingerabdruck, gerichtsfestes Gutachten.
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

export type PosTag = "art" | "subst" | "verb" | "adj" | "adv" | "praep" | "konj" | "pron" | "zahl" | "sonst";

const ARTICLES = ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "eines", "einer"];
const PRONOUNS = ["ich", "du", "er", "sie", "es", "wir", "ihr", "mich", "dich", "sich", "uns", "euch", "man", "wer", "was"];
const PREPOSITIONS = ["in", "an", "auf", "über", "unter", "vor", "hinter", "neben", "zwischen", "durch", "gegen", "für", "ohne", "um", "mit", "bei", "nach", "von", "zu", "aus", "seit"];
const CONJUNCTIONS = ["und", "oder", "aber", "denn", "weil", "obwohl", "während", "nachdem", "dass", "wenn", "als", "doch", "sondern"];
const ADVERBS = ["nicht", "sehr", "schon", "noch", "nur", "auch", "immer", "nie", "oft", "kaum", "fast", "wieder", "dort", "hier", "jetzt", "dann"];

/** Grobe deutsche POS-Heuristik über Wortendungen und Funktionswortlisten. */
export function tagWord(word: string): PosTag {
  // Zahlen vor dem Buchstaben-Strippen prüfen — sonst wird "42" zu "" und fällt auf "sonst".
  if (/^\d+$/.test(word.trim())) return "zahl";
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (w.length === 0) return "sonst";
  if (ARTICLES.includes(w)) return "art";
  if (PRONOUNS.includes(w)) return "pron";
  if (PREPOSITIONS.includes(w)) return "praep";
  if (CONJUNCTIONS.includes(w)) return "konj";
  if (ADVERBS.includes(w)) return "adv";
  if (/(en|ern|eln|ieren)$/.test(w) && w.length > 4) return "verb";
  if (/(lich|ig|isch|bar|sam|haft|los)$/.test(w)) return "adj";
  // Großgeschriebene Wörter im Original sind Substantive (deutsche Orthografie)
  if (/^[A-ZÄÖÜ]/.test(word)) return "subst";
  return "sonst";
}

export function tagSequence(text: string): PosTag[] {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(tagWord);
}

export interface PosNGram {
  pattern: string;
  count: number;
}

/** Zählt POS-N-Gramme (Standard n=3) — die syntaktische DNA. */
export function extractPosNGrams(text: string, n: number = 3): PosNGram[] {
  const tags = tagSequence(text);
  const size = Math.max(2, Math.floor(n));
  const counts = new Map<string, number>();
  for (let i = 0; i <= tags.length - size; i++) {
    const pattern = tags.slice(i, i + size).join("-");
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.pattern.localeCompare(b.pattern)));
}

export interface StyleProfile {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  /** Standardabweichung der Satzlängen — Rhythmus-Signatur. */
  sentenceLengthStdDev: number;
  /** Anteil langer Wörter (> 7 Zeichen). */
  longWordRatio: number;
  /** Type-Token-Ratio: Vokabelvielfalt 0..1. */
  typeTokenRatio: number;
  posNGrams: PosNGram[];
}

export function buildStyleProfile(text: string): StyleProfile {
  const clean = text.trim();
  if (clean.length === 0) {
    return { wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, sentenceLengthStdDev: 0, longWordRatio: 0, typeTokenRatio: 0, posNGrams: [] };
  }

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length);

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 100) / 100 : 0;

  const mean = sentenceLengths.length > 0 ? sentenceLengths.reduce((s, l) => s + l, 0) / sentenceLengths.length : 0;
  const variance =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((s, l) => s + (l - mean) * (l - mean), 0) / sentenceLengths.length
      : 0;
  const sentenceLengthStdDev = Math.round(Math.sqrt(variance) * 100) / 100;

  const longWords = words.filter((w) => w.replace(/[^a-zA-ZäöüÄÖÜß]/g, "").length > 7).length;
  const longWordRatio = wordCount > 0 ? Math.round((longWords / wordCount) * 1000) / 1000 : 0;

  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-zäöüß]/g, "")).filter((w) => w.length > 0));
  const typeTokenRatio = wordCount > 0 ? Math.round((unique.size / wordCount) * 1000) / 1000 : 0;

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    sentenceLengthStdDev,
    longWordRatio,
    typeTokenRatio,
    posNGrams: extractPosNGrams(clean, 3),
  };
}

export interface StyleFingerprint {
  id: string;
  /** Zero-Entropy-Hash über die stabilsten Stilmerkmale. */
  hash: string;
  /** Die 12 häufigsten POS-N-Gramme — die syntaktische Signatur. */
  topPatterns: string[];
  profile: StyleProfile;
}

export function computeStyleFingerprint(text: string): StyleFingerprint {
  const profile = buildStyleProfile(text);
  const topPatterns = profile.posNGrams.slice(0, 12).map((g) => g.pattern);

  // Quantisierte Merkmale: die Hash-Eingabe überlebt kleine Umformulierungen.
  const quantised = [
    Math.round(profile.avgSentenceLength),
    Math.round(profile.sentenceLengthStdDev),
    Math.round(profile.longWordRatio * 10),
    Math.round(profile.typeTokenRatio * 20),
    topPatterns.slice(0, 8).join(","),
  ].join("|");

  return {
    id: `FP-${hashString(`${text.length}:${topPatterns.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    hash: `STYLE-${hashString(quantised).toString(16).padStart(16, "0").toUpperCase()}`,
    topPatterns,
    profile,
  };
}

export interface SimilarityResult {
  /** Syntaktische Ähnlichkeit 0..1 (POS-N-Gramm-Überlappung, gewichtet). */
  syntacticSimilarity: number;
  /** Rhythmus-Ähnlichkeit 0..1 (Satzlängen-Verteilung). */
  rhythmSimilarity: number;
  /** Vokabel-Ähnlichkeit 0..1 (Type-Token und lange Wörter). */
  lexicalSimilarity: number;
  /** Gesamt-Ähnlichkeitsindex 0..100 für das Gutachten. */
  overallIndex: number;
  /** Übereinstimmende POS-Muster. */
  sharedPatterns: string[];
  verdict: "unabhängig" | "verwandt" | "verdächtig" | "plagiat";
}

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared++;
  return shared / Math.max(setA.size, setB.size);
}

export function compareFingerprints(a: StyleFingerprint, b: StyleFingerprint): SimilarityResult {
  const sharedPatterns = a.topPatterns.filter((p) => b.topPatterns.includes(p));
  const syntacticSimilarity = Math.round(overlapRatio(a.topPatterns, b.topPatterns) * 1000) / 1000;

  const rhythmA = a.profile.avgSentenceLength;
  const rhythmB = b.profile.avgSentenceLength;
  const rhythmMax = Math.max(rhythmA, rhythmB, 1);
  const rhythmSimilarity = Math.round((1 - Math.abs(rhythmA - rhythmB) / rhythmMax) * 1000) / 1000;

  const lexA = a.profile.longWordRatio * 0.5 + a.profile.typeTokenRatio * 0.5;
  const lexB = b.profile.longWordRatio * 0.5 + b.profile.typeTokenRatio * 0.5;
  const lexicalSimilarity = Math.round((1 - Math.abs(lexA - lexB) / Math.max(lexA, lexB, 0.001)) * 1000) / 1000;

  const overallIndex = Math.max(
    0,
    Math.min(100, Math.round((syntacticSimilarity * 0.6 + rhythmSimilarity * 0.25 + lexicalSimilarity * 0.15) * 100))
  );

  const verdict =
    overallIndex >= 85 ? "plagiat" : overallIndex >= 65 ? "verdächtig" : overallIndex >= 45 ? "verwandt" : "unabhängig";

  return { syntacticSimilarity, rhythmSimilarity, lexicalSimilarity, overallIndex, sharedPatterns, verdict };
}

export interface ForensicReport {
  id: string;
  reference: StyleFingerprint;
  suspect: StyleFingerprint;
  similarity: SimilarityResult;
  findings: string[];
  generatedAt: string;
}

export function buildForensicReport(referenceText: string, suspectText: string): ForensicReport {
  const reference = computeStyleFingerprint(referenceText);
  const suspect = computeStyleFingerprint(suspectText);
  const similarity = compareFingerprints(reference, suspect);

  const findings: string[] = [];
  findings.push(
    `Syntaktische DNA: ${similarity.sharedPatterns.length} von ${reference.topPatterns.length} Signaturmustern stimmen überein.`
  );
  findings.push(
    `Rhythmus: Referenz Ø ${reference.profile.avgSentenceLength} Wörter/Satz (±${reference.profile.sentenceLengthStdDev}), Verdacht Ø ${suspect.profile.avgSentenceLength} (±${suspect.profile.sentenceLengthStdDev}).`
  );
  findings.push(
    `Vokabular: Type-Token-Ratio ${reference.profile.typeTokenRatio} vs. ${suspect.profile.typeTokenRatio}; lange Wörter ${(reference.profile.longWordRatio * 100).toFixed(1)}% vs. ${(suspect.profile.longWordRatio * 100).toFixed(1)}%.`
  );
  if (similarity.sharedPatterns.length > 0) {
    findings.push(`Gemeinsame Muster: ${similarity.sharedPatterns.slice(0, 5).join(", ")}.`);
  }
  findings.push(
    similarity.verdict === "plagiat"
      ? "Befund: Die syntaktische Übereinstimmung liegt im Plagiatsbereich — ein Gutachten ist angezeigt."
      : similarity.verdict === "verdächtig"
        ? "Befund: Erhöhte Übereinstimmung — weitere Prüfung empfohlen."
        : "Befund: Keine ausreichende Übereinstimmung für einen Plagiatsverdacht."
  );

  return {
    id: `FORENSIC-${hashString(`${reference.hash}:${suspect.hash}`).toString(16).padStart(8, "0").toUpperCase()}`,
    reference,
    suspect,
    similarity,
    findings,
    generatedAt: "1970-01-01T00:00:00.000Z",
  };
}

export const SAMPLE_REFERENCE_TEXT = `Der Wind strich über die Dächer, und Lyra stand am Fenster und sah in die Dunkelheit hinaus. Sie dachte an den Brief, den sie nie abgeschickt hatte. Bram trat hinter sie, ohne ein Wort zu sagen. Die Stadt unter ihnen schlief, aber die Gassen waren voller Schatten, die sich bewegten. „Wir müssen gehen", flüsterte er. Sie antwortete nicht sofort, denn der Himmel hatte die Farbe alten Blutes angenommen.`;

export const SAMPLE_SUSPECT_TEXT = `Der Sturm fuhr über die Giebel, und Mira blieb am Fenster und blickte in die Finsternis. Sie dachte an die Nachricht, die sie niemals fortgesandt hatte. Toran kam hinter sie, ohne etwas zu äußern. Die Stadt unter ihnen ruhte, doch die Straßen waren voller Schemen, die wanderten. „Wir müssen fort", raunte er. Sie erwiderte nichts sogleich, denn das Firmament hatte den Ton alten Blutes angenommen.`;

export function createSampleForensicReport(): ForensicReport {
  return buildForensicReport(SAMPLE_REFERENCE_TEXT, SAMPLE_SUSPECT_TEXT);
}
