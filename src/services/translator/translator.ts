// Translator service: DE↔EN with glossary support
// Uses local heuristics for language detection and LLM (Ollama) for translation

import { getLogger } from "@/services/logger";

const log = getLogger("translator");

export interface TranslationRequest {
  text: string;
  sourceLang: 'de' | 'en';
  targetLang: 'de' | 'en';
  glossary?: Record<string, string>;
  context?: string;
}

export interface TranslationResult {
  translated: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
}

// German word indicators for language detection
const GERMAN_WORDS = [
  'der', 'die', 'das', 'und', 'oder', 'aber', 'auch', 'nicht', 'ist', 'sind',
  'haben', 'hatte', 'werden', 'wurde', 'mit', 'von', 'zu', 'für', 'auf',
  'bei', 'über', 'unter', 'durch', 'nach', 'vor', 'zwischen', 'während',
  'können', 'müssen', 'sollen', 'wollen', 'dürfen', 'mögen', 'werden',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'mein', 'dein',
  'sein', 'ihr', 'unser', 'euer', 'dieser', 'diese', 'dieses', 'jeder',
  'jede', 'jedes', 'alle', 'viele', 'wenige', 'einige', 'andere',
  'ß', 'ä', 'ö', 'ü'
];

// English word indicators for language detection
const ENGLISH_WORDS = [
  'the', 'and', 'or', 'but', 'also', 'not', 'is', 'are', 'have', 'had',
  'will', 'would', 'with', 'from', 'to', 'for', 'on', 'at', 'in', 'by',
  'over', 'under', 'through', 'after', 'before', 'between', 'during',
  'can', 'must', 'should', 'would', 'could', 'might', 'may', 'shall',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'each', 'every', 'all', 'many', 'few', 'some', 'other', 'another'
];

// In-memory glossary storage (in production, this would be persisted)
const globalGlossary: Record<string, string> = {};

/**
 * Detect language using word frequency heuristics
 */
export async function detectLanguage(text: string): Promise<'de' | 'en'> {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(word => word.length > 2);

  let germanScore = 0;
  let englishScore = 0;

  // Check for German-specific characters
  if (/[äöüß]/.test(lowerText)) {
    germanScore += 10;
  }

  // Count word matches
  words.forEach(word => {
    if (GERMAN_WORDS.includes(word)) {
      germanScore += 1;
    }
    if (ENGLISH_WORDS.includes(word)) {
      englishScore += 1;
    }
  });

  // Default to German if scores are equal (bias for German content)
  return germanScore >= englishScore ? 'de' : 'en';
}

/** Injizierbare Optionen: Fetch-Mock (Tests) + Abort (Panel-Abbruch). */
export interface TranslateOptions {
  /** Injizierbare fetch-Funktion (Default: globalThis.fetch). */
  fetchFn?: typeof fetch;
  /** Abbruch-Signal — Abort wird weitergereicht, kein stiller Fallback. */
  signal?: AbortSignal;
  /** Modellname (Default "llama3.2"). */
  model?: string;
}

/**
 * Baut den Übersetzungs-Prompt (pure, ohne Netz — testbar).
 * Exportiert, damit der Prompt-Bau wie bei buildSummaryPrompt/buildReviewPrompt prüfbar ist.
 */
export function buildTranslationPrompt(request: TranslationRequest): string {
  const { text, sourceLang, targetLang, glossary = {}, context = '' } = request;

  // Merge global glossary with request-specific glossary
  const mergedGlossary = { ...globalGlossary, ...glossary };

  // Build glossary context
  let glossaryText = '';
  if (Object.keys(mergedGlossary).length > 0) {
    glossaryText = '\n\nGlossar/Glossary:\n' +
      Object.entries(mergedGlossary)
        .map(([source, target]) => `${source} → ${target}`)
        .join('\n');
  }

  // Build context
  let contextText = '';
  if (context) {
    contextText = `
Kontext/Context: ${context}`;
  }

  const sourceLangName = sourceLang === 'de' ? 'Deutsch' : 'English';
  const targetLangName = targetLang === 'de' ? 'Deutsch' : 'English';

  return `Übersetze den folgenden Text von ${sourceLangName} nach ${targetLangName}. Beachte dabei das Glossar und den Kontext. Gib nur die Übersetzung zurück, ohne weitere Erklärungen.${glossaryText}${contextText}\n\nText:\n${text}`;
}

/**
 * Translate text using LLM via Ollama.
 *
 * Guards (konsistent zu summarize/reviewText):
 * - leerer Text → sofortiger Leer-Fallback, kein Netz-Call.
 * - Abort → wird weitergereicht (kein stiller Fallback).
 * - leere/korrupte LLM-Antwort → Original mit confidence 0.0 (kein
 *   Erfolgs-Confidence für einen Fallback).
 * - sonstige Fehler → Original mit confidence 0.0 + Warnung ins Log.
 */
export async function translate(request: TranslationRequest, opts: TranslateOptions = {}): Promise<TranslationResult> {
  const { text, sourceLang, targetLang } = request;

  if (!text.trim()) {
    return {
      translated: '',
      sourceLang,
      targetLang,
      confidence: 0.0
    };
  }

  if (sourceLang === targetLang) {
    return {
      translated: text,
      sourceLang,
      targetLang,
      confidence: 1.0
    };
  }

  if (opts.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");

  const fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    log.warn("kein fetch verfügbar — Fallback auf Originaltext.");
    return { translated: text, sourceLang, targetLang, confidence: 0.0 };
  }

  const prompt = buildTranslationPrompt(request);

  try {
    // Call local Ollama instance
    const response = await fetchFn('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: opts.model ?? 'llama3.2', // Default model, can be configured
        prompt: prompt,
        stream: false
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = await response.json();
    const raw = typeof data.response === "string" ? data.response.trim() : "";
    if (!raw) {
      log.warn("leere Modell-Antwort — Fallback auf Originaltext.");
      return {
        translated: text,
        sourceLang,
        targetLang,
        confidence: 0.0
      };
    }

    return {
      translated: raw,
      sourceLang,
      targetLang,
      confidence: 0.85 // Estimated confidence for LLM translation
    };

  } catch (error) {
    if ((error as Error)?.name === "AbortError" || opts.signal?.aborted) throw error;
    log.warn(`Translation failed: ${error instanceof Error ? error.message : String(error)} — Fallback auf Originaltext.`);

    // Fallback: return original text with low confidence
    return {
      translated: text,
      sourceLang,
      targetLang,
      confidence: 0.0
    };
  }
}

/**
 * Get current glossary
 */
export async function getGlossary(): Promise<Record<string, string>> {
  return { ...globalGlossary };
}

/**
 * Add entry to glossary
 */
export async function addToGlossary(source: string, target: string): Promise<void> {
  globalGlossary[source.trim()] = target.trim();
}

/**
 * Remove entry from glossary
 */
export async function removeFromGlossary(source: string): Promise<void> {
  delete globalGlossary[source.trim()];
}
