// KI-gestützter Text-Review (Sprint 23, Agent 2): LLM-generierte
// Verbesserungsvorschläge mit Fokus-Bereichen, Score und Anwendelogik.
//
// - reviewText(): LLM-Review via Provider (JSON-Antwort), mit lokaler
//   Heuristik als Offline-Fallback (Muster: revise.ts computeLocalTightening).
// - Der LLM-Client ist injizierbar (opts.client) — so bleibt die Funktion
//   ohne Provider-Mock testbar (Muster: BilingualPanel `chat`-Prop).
// - applySuggestion()/applyAllSuggestions(): rein, synchron, ohne LLM.

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";

export type ReviewFocus =
  | "structure"
  | "clarity"
  | "tone"
  | "pacing"
  | "dialogue"
  | "description"
  | "grammar"
  | "consistency";

export type ReviewTone = "professional" | "casual" | "academic" | "creative";

export interface ReviewRequest {
  text: string;
  focusAreas: ReviewFocus[];
  tone: ReviewTone;
}

export interface FeedbackSuggestion {
  id: string;
  focus: ReviewFocus;
  line?: number;
  original: string;
  suggestion: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface ReviewFeedback {
  overallScore: number;
  summary: string;
  suggestions: FeedbackSuggestion[];
  strengths: string[];
  weaknesses: string[];
}

/** Alle verfügbaren Fokus-Bereiche (stabile Reihenfolge für die UI). */
const FOCUS_AREAS: ReviewFocus[] = [
  "structure",
  "clarity",
  "tone",
  "pacing",
  "dialogue",
  "description",
  "grammar",
  "consistency",
];

/** Liefert alle verfügbaren Fokus-Bereiche (Kopie — Aufrufer kann nicht mutieren). */
export function getAvailableFocusAreas(): ReviewFocus[] {
  return [...FOCUS_AREAS];
}

/** Injizierbarer LLM-Client: Prompt rein, Rohtext raus. Default nutzt den Provider. */
export type ReviewClient = (prompt: string, signal?: AbortSignal) => Promise<string>;

export interface ReviewOptions {
  client?: ReviewClient;
  signal?: AbortSignal;
}

const FOCUS_LABELS: Record<ReviewFocus, string> = {
  structure: "Struktur (Aufbau, Absätze, roter Faden)",
  clarity: "Klarheit (Verständlichkeit, Satzbau)",
  tone: "Ton (Stimmigkeit, Register)",
  pacing: "Tempo (Rhythmus, Spannungsbogen)",
  dialogue: "Dialoge (Natürlichkeit, Stimmen)",
  description: "Beschreibung (Bildhaftigkeit, Details)",
  grammar: "Grammatik & Rechtschreibung",
  consistency: "Konsistenz (Logik, Fakten, Zeit)",
};

/** Baut den Review-Prompt für das LLM (inkl. JSON-Antwortschema). */
export function buildReviewPrompt(req: ReviewRequest): string {
  const focusList =
    req.focusAreas.length > 0
      ? req.focusAreas.map((f) => `- ${f}: ${FOCUS_LABELS[f]}`).join("\n")
      : "- (alle Bereiche)";
  return (
    `Du bist ein sorgfältiger Lektor. Analysiere den folgenden Text im Ton "${req.tone}" ` +
    `mit Fokus auf:\n${focusList}\n\nTEXT:\n${req.text}\n\n` +
    `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Vorwort) im Format:\n` +
    `{"overallScore": 0-100, "summary": "...", ` +
    `"suggestions": [{"id": "s1", "focus": "<einer der Fokus-Bereiche>", "line": 1, ` +
    `"original": "Textausschnitt", "suggestion": "Verbesserung", ` +
    `"reason": "Begründung", "priority": "high|medium|low"}], ` +
    `"strengths": ["..."], "weaknesses": ["..."]}`
  );
}

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === "string" ? Number(n) : (n as number);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function isFocus(f: unknown): f is ReviewFocus {
  return typeof f === "string" && (FOCUS_AREAS as string[]).includes(f);
}

function isPriority(p: unknown): p is FeedbackSuggestion["priority"] {
  return p === "high" || p === "medium" || p === "low";
}

/** Extrahiert das erste JSON-Objekt aus einer LLM-Rohantwort (toleriert Code-Fences). */
export function extractJsonObject(raw: string): unknown | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Normalisiert eine geparste LLM-Antwort zu ReviewFeedback (defensiv, nie Throw). */
export function normalizeFeedback(parsed: unknown, req: ReviewRequest): ReviewFeedback {
  const fallback = localReview(req);
  if (typeof parsed !== "object" || parsed === null) return fallback;
  const p = parsed as Record<string, unknown>;
  const rawSug = Array.isArray(p.suggestions) ? p.suggestions : [];
  const suggestions: FeedbackSuggestion[] = rawSug
    .map((s, i) => {
      if (typeof s !== "object" || s === null) return null;
      const r = s as Record<string, unknown>;
      const original = typeof r.original === "string" ? r.original : "";
      const suggestion = typeof r.suggestion === "string" ? r.suggestion : "";
      if (!original || !suggestion) return null;
      return {
        id: typeof r.id === "string" && r.id ? r.id : `s${i + 1}`,
        focus: isFocus(r.focus) ? r.focus : (req.focusAreas[0] ?? "clarity"),
        line: typeof r.line === "number" && Number.isFinite(r.line) ? Math.round(r.line) : undefined,
        original,
        suggestion,
        reason: typeof r.reason === "string" ? r.reason : "",
        priority: isPriority(r.priority) ? r.priority : "medium",
      } as FeedbackSuggestion;
    })
    .filter((s): s is FeedbackSuggestion => s !== null);
  return {
    overallScore: clampScore(p.overallScore, fallback.overallScore),
    summary: typeof p.summary === "string" && p.summary ? p.summary : fallback.summary,
    suggestions,
    strengths: Array.isArray(p.strengths)
      ? p.strengths.filter((s): s is string => typeof s === "string")
      : fallback.strengths,
    weaknesses: Array.isArray(p.weaknesses)
      ? p.weaknesses.filter((s): s is string => typeof s === "string")
      : fallback.weaknesses,
  };
}

const LOCAL_FILLERS = [
  "also",
  "eigentlich",
  "irgendwie",
  "halt",
  "sozusagen",
  "quasi",
  "letztendlich",
  "praktisch",
  "bekanntlich",
  "übrigens",
  "wirklich",
  "einfach",
  "durchaus",
  "ohnehin",
];

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

function wordsOf(s: string): string[] {
  return s.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
}

/**
 * Lokale, LLM-freie Heuristik (Offline-Fallback): bewertet Satzlängen,
 * Füllwörter und Textlänge je angefragtem Fokus-Bereich.
 */
export function localReview(req: ReviewRequest): ReviewFeedback {
  const text = req.text.trim();
  if (!text) {
    return { overallScore: 0, summary: "Kein Text zum Prüfen.", suggestions: [], strengths: [], weaknesses: [] };
  }
  const sentences = sentencesOf(text);
  const words = wordsOf(text);
  const lower = text.toLowerCase();
  const fillerHits = LOCAL_FILLERS.filter((f) => new RegExp(`\\b${f}\\b`, "i").test(lower));
  const longSentences = sentences.filter((s) => wordsOf(s).length > 25);

  const wants = (f: ReviewFocus) => req.focusAreas.length === 0 || req.focusAreas.includes(f);
  const suggestions: FeedbackSuggestion[] = [];
  let id = 0;
  const nextId = () => `local-${++id}`;

  if (wants("clarity") && longSentences.length > 0) {
    const first = longSentences[0];
    suggestions.push({
      id: nextId(),
      focus: "clarity",
      line: sentences.indexOf(first) + 1,
      original: first.length > 120 ? first.slice(0, 120) + "…" : first,
      suggestion: "Diesen Satz in zwei kürzere Sätze aufteilen.",
      reason: `Sehr langer Satz (${wordsOf(first).length} Wörter) — kurze Sätze erhöhen die Lesbarkeit.`,
      priority: "medium",
    });
  }
  if ((wants("clarity") || wants("tone")) && fillerHits.length > 0) {
    suggestions.push({
      id: nextId(),
      focus: "clarity",
      original: fillerHits[0],
      suggestion: "(streichen)",
      reason: `Füllwort („${fillerHits[0]}") schwächt die Aussage — ersatzlos streichen.`,
      priority: "low",
    });
  }
  if (wants("structure") && sentences.length >= 6 && !/\n\s*\n|\n/.test(text)) {
    suggestions.push({
      id: nextId(),
      focus: "structure",
      original: text.slice(0, 80) + "…",
      suggestion: "Text in Absätze gliedern (ein Gedanke pro Absatz).",
      reason: "Langer Fließtext ohne Absatzgliederung — Absätze geben Orientierung.",
      priority: "high",
    });
  }
  if (wants("grammar") && / {2,}/.test(text)) {
    suggestions.push({
      id: nextId(),
      focus: "grammar",
      original: "doppelte Leerzeichen",
      suggestion: "Doppelte Leerzeichen entfernen.",
      reason: "Formatierungsfehler: doppelte Leerzeichen gefunden.",
      priority: "low",
    });
  }

  const penalties = longSentences.length * 4 + fillerHits.length * 3 + (suggestions.some((s) => s.focus === "structure") ? 10 : 0);
  const overallScore = Math.max(5, Math.min(98, 85 - penalties));
  const strengths: string[] = [];
  if (longSentences.length === 0) strengths.push("Angenehme Satzlängen.");
  if (fillerHits.length === 0) strengths.push("Keine typischen Füllwörter gefunden.");
  if (words.length > 50) strengths.push("Ausreichende Textsubstanz für eine Bewertung.");
  const weaknesses: string[] = [];
  if (longSentences.length > 0) weaknesses.push(`${longSentences.length} sehr lange Sätze.`);
  if (fillerHits.length > 0) weaknesses.push(`Füllwörter: ${fillerHits.slice(0, 5).join(", ")}.`);
  if (sentences.length >= 6 && !/\n/.test(text)) weaknesses.push("Fehlende Absatzgliederung.");

  return {
    overallScore,
    summary: `Lokale Heuristik (offline): ${words.length} Wörter, ${sentences.length} Sätze — ${suggestions.length} Hinweise.`,
    suggestions,
    strengths,
    weaknesses,
  };
}

/** Default-Client über den konfigurierten LLM-Provider (streamt, sammelt, gibt Rohtext zurück). */
async function providerClient(prompt: string, signal?: AbortSignal): Promise<string> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) throw new Error("Provider nicht erreichbar");
  let raw = "";
  for await (
    const token of provider.chat(
      [
        { role: "system" as const, content: "Du bist ein sorgfältiger Lektor. Antworte ausschließlich mit dem verlangten JSON." },
        { role: "user" as const, content: prompt },
      ],
      { model: settings.model, temperature: 0.4, maxTokens: settings.maxTokens },
      signal,
    )
  ) {
    raw += token;
  }
  return raw;
}

/**
 * Führt einen KI-Review durch. Nutzt opts.client (Tests/Panel-Mock) oder den
 * konfigurierten Provider; bei Fehlern/Abbrüchen greift die lokale Heuristik
 * (außer bei explizitem Abort — der wird weitergereicht).
 */
export async function reviewText(request: ReviewRequest, opts?: ReviewOptions): Promise<ReviewFeedback> {
  if (!request.text.trim()) {
    return { overallScore: 0, summary: "Kein Text zum Prüfen.", suggestions: [], strengths: [], weaknesses: [] };
  }
  const focusAreas = request.focusAreas.length > 0 ? request.focusAreas : getAvailableFocusAreas();
  const req: ReviewRequest = { ...request, focusAreas };
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildReviewPrompt(req), opts?.signal);
    const parsed = extractJsonObject(raw);
    if (!parsed) return localReview(req);
    return normalizeFeedback(parsed, req);
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || opts?.signal?.aborted) throw e;
    return localReview(req);
  }
}

/**
 * Wendet einen einzelnen Vorschlag an: ersetzt das erste Vorkommen von
 * `original` durch `suggestion`. Sonderfall "(streichen)": entfernt das
 * Original. Unverändert, wenn nichts gefunden wird.
 */
export function applySuggestion(text: string, suggestion: FeedbackSuggestion): string {
  const { original, suggestion: replacement } = suggestion;
  if (!original || !text.includes(original)) return text;
  if (replacement === "(streichen)") {
    return text.replace(original, "").replace(/[ \t]{2,}/g, " ").replace(/\s+,/g, ",").trim() === ""
      ? text.replace(original, "").trim()
      : text.replace(original, "").replace(/ {2,}/g, " ");
  }
  return text.replace(original, replacement);
}

/** Wendet alle Vorschläge sequentiell an (überspringt nicht mehr auffindbare). */
export function applyAllSuggestions(text: string, suggestions: FeedbackSuggestion[]): string {
  return suggestions.reduce((acc, s) => applySuggestion(acc, s), text);
}
