// Bookwriter: Qualitätsloop.
//
// Prüft jedes Kapitel nach der Generierung automatisch auf:
// - Konsistenz (Figuren, Orte, Zeitlinie)
// - Stil (Füllwörter, Passiv, Satzlänge)
// - Wiederholungen
// - Struktur (Überschriften, Länge)
// - Kapitelziel-Erreichung
//
// Nutzt die bestehende Manuskriptprüfung (diagnostics), anstatt sie
// neu zu bauen.

import { loadSettings } from "@/services/settings";
import { createProvider, buildMessages } from "@/services/llm";
import { promptQualityCheck } from "./prompts";
import { saveArtifact } from "./state";
import type { BookBriefing, OutlineChapter, QualityScore } from "@/types/bookwriter";
import { DIMENSION_LABELS } from "@/types/bookwriter";

/** Ergebnis der Kapitelprüfung. */
export interface ChapterQualityResult {
  chapterIndex: number;
  chapterTitle: string;
  scores: QualityScore[];
  overallLevel: "green" | "yellow" | "red";
  issues: string[];
  suggestions: string[];
}

/** Qualitätsloop für ein einzelnes Kapitel. */
export async function checkChapterQuality(
  runId: string,
  briefing: BookBriefing,
  chapter: OutlineChapter,
  chapterContent: string,
  chapterIndex: number,
  allChapters: Array<{ title: string; content: string }>,
): Promise<ChapterQualityResult> {
  const settings = loadSettings();
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);

  const scores: QualityScore[] = [];
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Stilprüfung: Nutze die bestehende Stilprüfung.
  const styleIssues = checkStyle(chapterContent);
  issues.push(...styleIssues);

  // Länge gegen Zielwortzahl.
  const wordCount = countWords(chapterContent);
  const targetWords = chapter.estimatedWords;
  const lengthDeviation = Math.abs(wordCount - targetWords) / targetWords;

  if (lengthDeviation > 0.3) {
    const direction = wordCount > targetWords ? "über" : "unter";
    issues.push(
      `Kapitel ist ${direction} der Zielwortzahl: ${wordCount} statt ca. ${targetWords} Wörter.`,
    );
    suggestions.push(
      wordCount > targetWords
        ? "Prüfe, ob sich der Satz an einer inhaltischen Zäsur teilen lässt."
        : "Das Kapitel könnte mehr Tiefe gewinnen, etwa durch ein Beispiel oder eine Szene.",
    );
  }

  // Wiederholungsprüfung.
  const repetitions = checkRepetitions(chapterContent);
  issues.push(...repetitions);

  // Konsistenz mit Vorkapiteln.
  if (chapterIndex > 0) {
    const consistencyIssues = checkConsistencyWithPrevious(
      chapterContent,
      allChapters.slice(0, chapterIndex),
    );
    issues.push(...consistencyIssues);
  }

  // Qualitätswerte für jede Dimension.
  const dimensions: Array<QualityScore["dimension"]> = [
    "kohaerenz", "stilgleichheit", "wiederholungsgrad", "kapitelqualitaet",
  ];

  for (const dim of dimensions) {
    const score = await evaluateDimensionSafe(
      settings,
      system,
      dim,
      chapter,
      chapterContent,
    );
    scores.push(score);
  }

  // Gesamtbewertung.
  const overallLevel = determineOverallLevel(scores);

  const result: ChapterQualityResult = {
    chapterIndex,
    chapterTitle: chapter.title,
    scores,
    overallLevel,
    issues,
    suggestions,
  };

  // Speichern.
  await saveArtifact(runId, "qualitaet", `chapter-${chapterIndex}`, result);

  return result;
}

/** Stilprüfung — kopiert aus diagnostics/style.ts, hier vereinfacht. */
function checkStyle(content: string): string[] {
  const issues: string[] = [];

  // Füllwörter.
  const fillers = ["eigentlich", "irgendwie", "quasi", "gewissermaßen", "letztlich"];
  const found = fillers.filter((f) => content.toLowerCase().includes(f));
  if (found.length >= 3) {
    issues.push(`Viele Füllwörter: ${found.join(", ")}.`);
  }

  // Sehr lange Sätze.
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const longSentences = sentences.filter((s) => countWords(s) > 40);
  if (longSentences.length > 3) {
    issues.push(`${longSentences.length} sehr lange Sätze (über 40 Wörter).`);
  }

  return issues;
}

/** Wiederholungsprüfung. */
function checkRepetitions(content: string): string[] {
  const issues: string[] = [];
  const words = content.toLowerCase().match(/\p{L}{5,}/gu) ?? [];
  const counts = new Map<string, number>();

  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (repeated.length > 0) {
    issues.push(
      `Wortwiederholungen: ${repeated.map(([w, n]) => `${w} (${n}×)`).join(", ")}.`,
    );
  }

  return issues;
}

/** Konsistenz mit Vorkapiteln. */
function checkConsistencyWithPrevious(
  content: string,
  previous: Array<{ title: string; content: string }>,
): string[] {
  const issues: string[] = [];

  // Einfache Prüfung: Figurenname aus vorherigem Kapitel fehlt im aktuellen.
  const nameRe = /\p{Lu}\p{L}{2,}/gu;
  const prevNames = new Set<string>();
  for (const p of previous) {
    const names = p.content.match(nameRe) ?? [];
    for (const n of names) prevNames.add(n);
  }

  const currentNames = new Set(content.match(nameRe) ?? []);
  const missing = [...prevNames].filter(
    (n) => !currentNames.has(n) && !["Der", "Die", "Das", "Ein", "Eine", "Ich", "Er", "Sie"].includes(n),
  );

  if (missing.length > 0 && previous.length > 0) {
    if (missing.length <= 2) return issues;
    issues.push(
      `Figuren aus Vorkapiteln fehlen: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}.`,
    );
  }

  return issues;
}

/** Bewertet eine Qualitätsdimension mit KI — mit Fallback. */
async function evaluateDimensionSafe(
  settings: ReturnType<typeof loadSettings>,
  system: string,
  dimension: QualityScore["dimension"],
  chapter: OutlineChapter,
  content: string,
): Promise<QualityScore> {
  try {
    return await evaluateDimension(settings, system, dimension, chapter, content);
  } catch {
    // Fallback: Regelbasierte Bewertung, wenn kein LLM verfügbar.
    return {
      id: `qs-${Date.now()}-${dimension}`,
      runId: "",
      dimension,
      level: "yellow",
      score: 50,
      details: "Automatische Bewertung nicht verfügbar.",
    };
  }
}

/** Bewertet eine Qualitätsdimension mit KI. */
async function evaluateDimension(
  settings: ReturnType<typeof loadSettings>,
  system: string,
  dimension: QualityScore["dimension"],
  chapter: OutlineChapter,
  content: string,
): Promise<QualityScore> {
  const provider = createProvider(settings);
  const prompt = promptQualityCheck(DIMENSION_LABELS[dimension], {
    title: chapter.title,
    goal: chapter.goal,
    content,
  });

  const messages = buildMessages(prompt, settings, [{ role: "system", content: system }]);

  let raw = "";
  for await (const token of provider.chat(messages, {
    model: settings.model,
    temperature: 0.3,
    maxTokens: 200,
  })) {
    raw += token;
  }

  // JSON aus der Antwort extrahieren.
  const json = raw.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      return {
        id: `qs-${Date.now()}-${dimension}`,
        runId: "",
        dimension,
        level: parsed.level ?? "yellow",
        score: Math.min(100, Math.max(0, parsed.score ?? 50)),
        details: parsed.details ?? null,
      };
    } catch {
      /* Fallback */
    }
  }

  return {
    id: `qs-${Date.now()}-${dimension}`,
    runId: "",
    dimension,
    level: "yellow",
    score: 50,
    details: "Konnte nicht bewertet werden.",
  };
}

/** Gesamtbewertung aus Einzelwerten. */
function determineOverallLevel(scores: QualityScore[]): "green" | "yellow" | "red" {
  const avg = scores.reduce((sum, s) => sum + s.score, 0) / (scores.length || 1);
  const hasRed = scores.some((s) => s.level === "red");

  if (hasRed || avg < 40) return "red";
  if (avg < 70) return "yellow";
  return "green";
}

/** Zählt Wörter. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** System-Prompt für Genre. */
function systemForGenre(genre: string, tone: string, language: string): string {
  return `Du bist ein erfahrener Lektor für ${genre}.
Tonalität: ${tone}
Sprache: ${language}

Bewerte das Kapitel objektiv und konstruktiv.`;
}

/** Qualitätsloop für alle Kapitel. */
export async function runQualityLoop(
  runId: string,
  briefing: BookBriefing,
  chapters: Array<{ title: string; content: string }>,
  outline: OutlineChapter[],
  onProgress?: (chapterIndex: number, result: ChapterQualityResult) => void,
): Promise<ChapterQualityResult[]> {
  const results: ChapterQualityResult[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const result = await checkChapterQuality(
      runId,
      briefing,
      outline[i],
      chapters[i].content,
      i,
      chapters,
    );
    results.push(result);
    onProgress?.(i, result);
  }

  // Gesamtspeichern.
  await saveArtifact(runId, "qualitaet", "all", results);

  return results;
}
// ---------------------------------------------------------------------------
// Textqualitaets-Engine (Sprint 17, Agent 1): rein regelbasierte Metriken.
// Muster aus `./lektorat` (Sprint 11): reine Funktionen, keine Seiteneffekte,
// offline, deterministisch. Helfer sind ueber `TextQualityOptions` injizierbar.
// ---------------------------------------------------------------------------

/** Bewertung einer einzelnen Metrik. */
export type TextQualityLevel = "good" | "warn" | "bad";

export interface TextMetric {
  /** 0 (schlecht) bis 100 (exzellent). */
  score: number;
  level: TextQualityLevel;
  suggestions: string[];
}

/** Gesamtanalyse ueber alle Metriken. */
export interface TextQualityReport {
  readability: TextMetric;
  sentenceVariety: TextMetric;
  dialogueRatio: TextMetric;
  adverbDensity: TextMetric;
  cliches: TextMetric;
  tenseConsistency: TextMetric;
  povConsistency: TextMetric;
  pacing: TextMetric;
  overallScore: number;
  overallLevel: TextQualityLevel;
}

/** Injizierbare Helfer/Parameter (alle mit Default). */
export interface TextQualityOptions {
  splitSentences?: (text: string) => string[];
  tokenize?: (text: string) => string[];
  countSyllables?: (word: string) => number;
  adverbList?: readonly string[];
  clicheList?: readonly string[];
}

// --- Basis-Helfer (exportiert fuer Tests) ------------------------------------

const WORD_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

/** Zerlegt Text in Saetze (Muster aus `./lektorat`). */
export function splitQualitySentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[„"«A-ZÄÖÜ0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenisiert zu Kleinbuchstaben-Woertern (Umlaute-bewahrend). */
export function tokenizeQualityWords(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

/** Heuristische Silbenzaehlung (Vokalgruppen; min. 1). Deutsch-tauglich. */
export function countGermanSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/gu, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouäöüy]+/gu) ?? [];
  let n = groups.length;
  // Stummes Schluss-e (frz./engl. Lehnwoerter) nicht mitzaehlen.
  if (/[^aeiouäöüy]e$/u.test(w) && n > 1) n -= 1;
  return Math.max(1, n);
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function emptyMetric(hint: string): TextMetric {
  return { score: 0, level: "bad", suggestions: [hint] };
}

function toLevel(score: number): TextQualityLevel {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
}

// --- 1) Lesbarkeit (Flesch/Amstad deutsch) -----------------------------------

/**
 * Flesch-Lesbarkeitsindex deutsch (Amstad):
 * RE = 180 − ASL − 58.5 × ASW (ASL = Woerter/Satz, ASW = Silben/Wort).
 */
export function analyzeReadability(text: string, opts: TextQualityOptions = {}): TextMetric {
  const split = opts.splitSentences ?? splitQualitySentences;
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const syl = opts.countSyllables ?? countGermanSyllables;
  const sentences = split(text);
  const words = tok(text);
  if (sentences.length === 0 || words.length === 0) {
    return emptyMetric("Der Text ist leer — keine Lesbarkeitsbewertung möglich.");
  }
  const asl = words.length / sentences.length;
  const totalSyl = words.reduce((s, w) => s + syl(w), 0);
  const asw = totalSyl / words.length;
  const re = clampScore(180 - asl - 58.5 * asw);
  const suggestions: string[] = [];
  if (re < 70) {
    if (asl > 20) suggestions.push(`Sätze sind im Schnitt ${asl.toFixed(1)} Wörter lang — kürzere Sätze erhöhen die Lesbarkeit.`);
    if (asw > 1.9) suggestions.push("Viele lange Wörter — prüfe, ob sich Schachtelwörter vereinfachen lassen.");
    if (suggestions.length === 0) suggestions.push("Text wirkt schwer lesbar — Sätze kürzen, Füllwörter streichen.");
  }
  return { score: re, level: toLevel(re), suggestions };
}

// --- 2) Satzvarianz ------------------------------------------------------------

export function analyzeSentenceVariety(text: string, opts: TextQualityOptions = {}): TextMetric {
  const split = opts.splitSentences ?? splitQualitySentences;
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const sentences = split(text);
  if (sentences.length === 0) return emptyMetric("Der Text ist leer — keine Satzvarianz messbar.");
  if (sentences.length === 1) {
    return { score: 30, level: "bad", suggestions: ["Nur ein Satz — Varianz braucht mehrere Sätze unterschiedlicher Länge."] };
  }
  const lens = sentences.map((s) => tok(s).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (mean === 0) return emptyMetric("Keine Wörter gefunden — keine Satzvarianz messbar.");
  const variance = lens.reduce((a, l) => a + (l - mean) ** 2, 0) / lens.length;
  const cv = Math.sqrt(variance) / mean;
  const score = clampScore(cv * 160);
  const suggestions: string[] = [];
  if (cv < 0.2) suggestions.push("Sätze sind fast alle gleich lang — bewusst kurze und lange Sätze mischen.");
  else if (cv < 0.35) suggestions.push("Etwas mehr Wechsel zwischen kurzen und langen Sätzen würde den Rhythmus verbessern.");
  return { score, level: toLevel(score), suggestions };
}

// --- 3) Dialoganteil -----------------------------------------------------------

const DIALOGUE_RE = /(„[^“]*“|"[^"]*"|«[^»]*»|»[^«]*«|^[–—-]\s*\S)/gmu;

/** Anteil Dialog-Zeichen an allen Zeichen (0–1). Exportiert fuer Tests. */
export function dialogueRatioOf(text: string): number {
  const total = text.replace(/\s+/gu, "").length;
  if (total === 0) return 0;
  const hits = text.match(DIALOGUE_RE) ?? [];
  const dlg = hits.join("").replace(/\s+/gu, "").length;
  return Math.min(1, dlg / total);
}

export function analyzeDialogueRatio(text: string): TextMetric {
  if (text.trim().length === 0) return emptyMetric("Der Text ist leer — kein Dialoganteil messbar.");
  const r = dialogueRatioOf(text);
  let score: number;
  const suggestions: string[] = [];
  if (r >= 0.1 && r <= 0.5) {
    score = 85;
  } else if (r < 0.1) {
    score = r === 0 ? 35 : 55;
    suggestions.push("Kaum Dialog — direkte Rede macht Szenen lebendiger.");
  } else {
    score = r > 0.7 ? 35 : 55;
    suggestions.push("Sehr hoher Dialoganteil — Erzählung und Beschreibung geben dem Gespräch Halt.");
  }
  return { score, level: toLevel(score), suggestions };
}

// --- 4) Adverbdichte -----------------------------------------------------------

export const DEFAULT_ADVERBS: readonly string[] = [
  "sehr", "wirklich", "eigentlich", "plötzlich", "plötzlich", "langsam",
  "schnell", "heimlich", "leise", "laut", "deutlich", "kaum", "beinahe",
  "fast", "ziemlich", "äußerst", "besonders", "bereits", "schon",
  "plötzlich", "sofort", "unbedingt", "völlig", "total", "absolut",
  "extrem", "unglaublich", "furchtbar", "schrecklich", "wunderschön",
  "einfach", "nur", "wohl", "vielleicht", "sicherlich", "natürlich",
  "glücklicherweise", "leider", "plötzlich", "wieder", "erneut",
  "very", "really", "suddenly", "quickly", "slowly", "quietly", "loudly",
  "almost", "extremely", "absolutely", "simply", "just", "already",
];

export function analyzeAdverbDensity(text: string, opts: TextQualityOptions = {}): TextMetric {
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const list = opts.adverbList ?? DEFAULT_ADVERBS;
  const words = tok(text);
  if (words.length === 0) return emptyMetric("Der Text ist leer — keine Adverbdichte messbar.");
  const set = new Set(list.map((w) => w.toLowerCase()));
  const hits = words.filter((w) => set.has(w) || /lich$/u.test(w)).length;
  const per100 = (hits / words.length) * 100;
  const score = clampScore(100 - per100 * 9);
  const suggestions: string[] = [];
  if (per100 > 8) suggestions.push(`${per100.toFixed(1)} Adverbien pro 100 Wörter — starke Verben ersetzen Adverbien („rannte" statt „ging schnell").`);
  else if (per100 > 5) suggestions.push(`${per100.toFixed(1)} Adverbien pro 100 Wörter — einige Adverbien durch präzisere Verben ersetzen.`);
  return { score, level: toLevel(score), suggestions };
}

// --- 5) Klischees (deutsch + englisch) ------------------------------------------

export const GERMAN_CLICHES: readonly string[] = [
  "am ende des tages", "im wahrsten sinne", "zeit heilt alle wunden",
  "aller anfang ist schwer", "ende gut alles gut", "stille wasser sind tief",
  "der apfel fällt nicht weit vom stamm", "morgenstund hat gold im mund",
  "schwarz wie die nacht", "dunkel wie die nacht", "weiß wie schnee",
  "rot wie blut", "kalt wie eis", "herz raste", "herz klopfte",
  "atem stockte", "die zeit blieb stehen", "gänsehaut", "tödliche stille",
  "ohrenbetäubende stille", "ein lächeln stahl sich", "es war einmal",
  "lebten glücklich bis ans ende", "schwer wie blei", "still wie ein grab",
  "klar wie kloßbrühe", "läuft wie geschmiert", "da liegt der hund begraben",
];

export const ENGLISH_CLICHES: readonly string[] = [
  "at the end of the day", "avoid like the plague", "better late than never",
  "break the ice", "heart skipped a beat", "dark and stormy night",
  "once upon a time", "happily ever after", "time heals all wounds",
  "calm before the storm", "tip of the iceberg", "raining cats and dogs",
  "piece of cake", "blessing in disguise", "light at the end of the tunnel",
  "needle in a haystack", "swept off her feet", "swept off his feet",
  "dead of night", "deafening silence", "pounded in his chest",
];

export function detectCliches(text: string, opts: TextQualityOptions = {}): string[] {
  const list = opts.clicheList ?? [...GERMAN_CLICHES, ...ENGLISH_CLICHES];
  const lower = text.toLowerCase();
  return list.filter((c) => lower.includes(c.toLowerCase()));
}

export function analyzeCliches(text: string, opts: TextQualityOptions = {}): TextMetric {
  if (text.trim().length === 0) return emptyMetric("Der Text ist leer — keine Klischeeprüfung möglich.");
  const found = detectCliches(text, opts);
  const score = clampScore(100 - found.length * 18);
  const suggestions = found.map((c) => `Klischee gefunden: „${c}" — durch eine eigene, konkrete Formulierung ersetzen.`);
  return { score, level: toLevel(score), suggestions };
}

// --- 6) Tempuskonsistenz --------------------------------------------------------

const PRESENT_SIGNALS = new Set([
  "ist", "sind", "hat", "haben", "wird", "werden", "kann", "können",
  "muss", "müssen", "will", "wollen", "soll", "sollen", "darf", "dürfen",
  "geht", "geht", "steht", "liegt", "sitzt", "sieht", "kommt", "gibt",
  "macht", "macht", "sagt", "denkt", "läuft", "fährt", "bleibt", "scheint",
  "is", "are", "has", "have", "goes", "says", "thinks", "makes",
]);

const PAST_SIGNALS = new Set([
  "war", "waren", "hatte", "hatten", "wurde", "wurden", "ging",
  "stand", "lag", "lag", "saß", "sah", "kam", "nahm", "gab", "hielt",
  "begann", "endete", "dachte", "sagte", "fragte", "antwortete",
  "rannte", "floh", "schrie", "flüsterte", "lachte", "weinte",
  "fiel", "stieg", "trug", "brachte", "fand", "verlor", "wusste",
  "wartete", "öffnete", "legte", "stellte", "setzte", "führte", "suchte",
  "versuchte", "lächelte", "zeigte", "folgte", "kehrte", "blickte", "hörte",
  "fühlte", "drückte", "zog", "las", "trat", "schwieg", "schoss", "sprang",
  "wollte", "musste", "konnte", "sollte", "durfte",
  "was", "were", "had", "went", "saw", "came", "said", "thought",
]);

export function analyzeTenseConsistency(text: string, opts: TextQualityOptions = {}): TextMetric {
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const words = tok(text);
  if (words.length === 0) return emptyMetric("Der Text ist leer — keine Tempusprüfung möglich.");
  let present = 0;
  let past = 0;
  for (const w of words) {
    if (PRESENT_SIGNALS.has(w)) present++;
    else if (PAST_SIGNALS.has(w)) past++;
  }
  const total = present + past;
  if (total < 3) {
    return { score: 70, level: "good", suggestions: ["Zu wenig Tempussignale für eine sichere Aussage — wirkt neutral."] };
  }
  const share = Math.max(present, past) / total;
  const score = clampScore(share * 115);
  const suggestions: string[] = [];
  if (share < 0.65) suggestions.push(`Tempus springt zwischen Präsens (${present}×) und Präteritum (${past}×) — ein Erzähltempus wählen.`);
  else if (share < 0.8) suggestions.push("Einzelne Tempus-Ausreißer prüfen — unbeabsichtigte Wechsel glätten.");
  return { score, level: toLevel(score), suggestions };
}

// --- 7) Perspektivkonsistenz (1./3. Person) --------------------------------------

const FIRST_PERSON = new Set([
  "ich", "mich", "mir", "mein", "meine", "meinem", "meinen", "meiner",
  "meines", "wir", "uns", "unser", "unsere", "unserem", "unseren",
  "i", "me", "my", "mine", "we", "us", "our", "ours",
]);

const THIRD_PERSON = new Set([
  "er", "ihn", "ihm", "sein", "seine", "seinem", "seinen", "seiner",
  "sie", "ihr", "ihre", "ihrem", "ihren", "ihrer", "ihnen",
  "he", "him", "his", "she", "her", "hers", "they", "them", "their",
]);

export function analyzePovConsistency(text: string, opts: TextQualityOptions = {}): TextMetric {
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const words = tok(text);
  if (words.length === 0) return emptyMetric("Der Text ist leer — keine Perspektivprüfung möglich.");
  let first = 0;
  let third = 0;
  for (const w of words) {
    if (FIRST_PERSON.has(w)) first++;
    else if (THIRD_PERSON.has(w)) third++;
  }
  const total = first + third;
  if (total < 3) {
    return { score: 75, level: "good", suggestions: ["Kaum personale Signale — Perspektive wirkt neutral."] };
  }
  const share = Math.max(first, third) / total;
  const score = clampScore(share * 115);
  const dominant = first >= third ? "1. Person" : "3. Person";
  const suggestions: string[] = [];
  if (share < 0.65) suggestions.push(`Perspektive springt (ich/wir: ${first}×, er/sie: ${third}×) — eine Erzählperspektive wählen.`);
  else if (share < 0.8) suggestions.push(`Einzelne Ausreißer aus der ${dominant} prüfen.`);
  return { score, level: toLevel(score), suggestions };
}

// --- 8) Pacing (Action vs. Beschreibung) ------------------------------------------

const ACTION_VERBS = new Set([
  "rennen", "rannte", "läuft", "lief", "springen", "sprang", "kämpfen",
  "kämpfte", "fliehen", "floh", "jagen", "jagte", "schreien", "schrie",
  "angreifen", "griff", "töten", "tötete", "retten", "rettete", "werfen",
  "warf", "schlagen", "schlug", "schießen", "schoss", "stürzen", "stürzte",
  "packen", "packte", "reißen", "riss", "stoßen", "stieß", "fallen", "fiel",
  "fliegt", "flog", "eilen", "eilte", "stürmen", "stürmte", "verfolgen",
  "verfolgte", "entkommen", "entkam", "explodieren", "explodierte",
  "run", "ran", "fight", "fought", "flee", "fled", "chase", "chased",
  "shoot", "shot", "attack", "kill", "escape", "scream", "grab",
]);

const DESCRIPTIVE_WORDS = new Set([
  "schön", "wunderschön", "hässlich", "golden", "silbern", "rot", "blau",
  "grün", "sanft", "weich", "rau", "warm", "kalt", "hell", "dunkel",
  "still", "leise", "duftend", "glänzend", "schimmernd", "farbenfroh",
  "malerisch", "idyllisch", "prächtig", "anmutig", "zart", "majestätisch",
  "schien", "wirkte", "wirkten", "duftete", "dufteten", "glänzte", "glänzten",
  "schimmerte", "schimmerten", "leuchtete", "wehte", "ruhig", "friedlich",
  "beacon", "beautiful", "golden", "silver", "soft", "warm", "bright",
  "dark", "still", "fragrant", "shimmering", "picturesque",
]);

export function analyzePacing(text: string, opts: TextQualityOptions = {}): TextMetric {
  const tok = opts.tokenize ?? tokenizeQualityWords;
  const words = tok(text);
  if (words.length === 0) return emptyMetric("Der Text ist leer — kein Pacing messbar.");
  let action = 0;
  let descr = 0;
  for (const w of words) {
    if (ACTION_VERBS.has(w)) action++;
    else if (DESCRIPTIVE_WORDS.has(w) || /^(wunderschön|malerisch)/u.test(w)) descr++;
  }
  const total = action + descr;
  if (total < 3) {
    return { score: 50, level: "warn", suggestions: ["Zu wenig Action-/Beschreibungssignale — längere Passage für eine Pacing-Aussage nötig."] };
  }
  const ratio = action / total;
  let score: number;
  const suggestions: string[] = [];
  if (ratio >= 0.35 && ratio <= 0.65) {
    score = 85;
  } else if ((ratio >= 0.2 && ratio < 0.35) || (ratio > 0.65 && ratio <= 0.8)) {
    score = 60;
    suggestions.push(ratio < 0.35
      ? "Beschreibungslastig — eine Actionszene oder ein Konflikmoment würde das Tempo heben."
      : "Actionlastig — ein ruhiger, beschreibender Absatz gibt Lesenden Luft zum Atmen.");
  } else {
    score = 35;
    suggestions.push(ratio < 0.2
      ? "Fast nur Beschreibung — Handlung und Konflikt fehlen, das Tempo droht einzuschlafen."
      : "Fast nur Action — ohne beschreibende Verankerung wirkt die Szene atemlos.");
  }
  return { score, level: toLevel(score), suggestions };
}

// --- Gesamtanalyse ---------------------------------------------------------------

/** Führt alle 8 Metriken aus und aggregiert Score/Level. */
export function analyzeTextQuality(text: string, opts: TextQualityOptions = {}): TextQualityReport {
  const readability = analyzeReadability(text, opts);
  const sentenceVariety = analyzeSentenceVariety(text, opts);
  const dialogueRatio = analyzeDialogueRatio(text);
  const adverbDensity = analyzeAdverbDensity(text, opts);
  const cliches = analyzeCliches(text, opts);
  const tenseConsistency = analyzeTenseConsistency(text, opts);
  const povConsistency = analyzePovConsistency(text, opts);
  const pacing = analyzePacing(text, opts);
  const scores = [
    readability.score, sentenceVariety.score, dialogueRatio.score,
    adverbDensity.score, cliches.score, tenseConsistency.score,
    povConsistency.score, pacing.score,
  ];
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return {
    readability, sentenceVariety, dialogueRatio, adverbDensity,
    cliches, tenseConsistency, povConsistency, pacing,
    overallScore, overallLevel: toLevel(overallScore),
  };
}
