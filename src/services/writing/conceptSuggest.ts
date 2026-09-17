// Buchkonzept-Generator per KI: aus Thema/Genre/Zielgruppe entsteht ein
// ganzes Konzept (Prämisse, Figuren/Welt, Erzählstimme, Spannungsbogen,
// Themen) als Generierprompt für Gliederung + Kapitel.
// Mit Offline-Fallback (Template), damit die UI nie hängt.

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";

/** Eingaben für die Konzept-Generierung. */
export interface ConceptSuggestInput {
  topic: string;
  genre?: string;
  targetAudience?: string;
  language?: string;
}

/**
 * Mindestmaß für ein tragfähiges Konzept (Audit M2): Ein 6-Abschnitte-Konzept
 * mit je 2–5 Sätzen liegt deutlich darüber; darunter steuert das Konzept
 * Gliederung + Kapitel nur dünn — der Autor bekommt einen Hinweis statt
 * stiller Akzeptanz.
 */
export const CONCEPT_MIN_CHARS = 300;

/** true, wenn das Konzept zu dünn ist, um Gliederung + Kapitel zu tragen. */
export function isThinConcept(concept: string): boolean {
  return concept.trim().length < CONCEPT_MIN_CHARS;
}

/** Platzhalter-Konzept ohne Modell (Template aus den Formulardaten). */
export function suggestConceptOffline(input: ConceptSuggestInput): string {
  const topic = input.topic.trim() || "Unbenanntes Buch";
  const genre = input.genre?.trim() || "offen";
  const audience = input.targetAudience?.trim() || "allgemein";
  return [
    `Prämisse: ${topic}.`,
    `Genre: ${genre} | Zielgruppe: ${audience}.`,
    "Figuren/Welt: [Hauptfiguren, Schauplätze und Regeln der Welt hier festlegen]",
    "Erzählstimme: [Erzählperspektive und Ton hier festlegen]",
    "Spannungsbogen: [Ausgangslage, Wendepunkte und Auflösung hier skizzieren]",
    "Themen: [Kernfragen und Motive des Buches hier festlegen]",
  ].join("\n");
}

/** Prompt für den Modell-Call (Konzept als strukturierter Fließtext). */
export function buildConceptSuggestPrompt(input: ConceptSuggestInput): string {
  return (
    `Du bist ein erfahrener Lektor und Buchkonzepter. Entwirf ein ganzes Buchkonzept ` +
    `als Generierprompt für eine KI, die daraus Gliederung und Kapitel schreibt.\n\n` +
    `Thema: ${input.topic.trim() || "(nicht angegeben)"}\n` +
    `Genre: ${input.genre?.trim() || "(offen)"}\n` +
    `Zielgruppe: ${input.targetAudience?.trim() || "(offen)"}\n` +
    `Sprache: ${input.language?.trim() || "Deutsch"}\n\n` +
    `Struktur (genau diese 6 Abschnitte, je 2–5 Sätze, auf Deutsch):\n` +
    `Prämisse: …\nFiguren/Welt: …\nErzählstimme: …\nSpannungsbogen: …\nThemen: …\nStil-Vorgaben: …\n\n` +
    `Antworte NUR mit dem Konzepttext. Keine Einleitung, keine Erklärung.`
  );
}

/**
 * Generiert ein Buchkonzept vom Modell (mit Offline-Fallback).
 * Abort gehört zum Vertrag und wird nicht geschluckt.
 */
export async function suggestConcept(
  input: ConceptSuggestInput,
  signal?: AbortSignal,
): Promise<{ concept: string; usedLLM: boolean }> {
  const settings = loadSettings();
  try {
    const provider = createProvider(settings);
    const healthy = await provider.healthCheck().catch(() => false);
    if (!healthy) return { concept: suggestConceptOffline(input), usedLLM: false };
    const chunks: string[] = [];
    for await (
      const token of provider.chat(
        [{ role: "user", content: buildConceptSuggestPrompt(input) }],
        { model: settings.model, temperature: 0.8, maxTokens: 2048 },
        signal,
      )
    ) {
      if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      chunks.push(token);
    }
    const concept = chunks.join("").trim();
    if (!concept) return { concept: suggestConceptOffline(input), usedLLM: false };
    return { concept, usedLLM: true };
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || signal?.aborted) throw e;
    return { concept: suggestConceptOffline(input), usedLLM: false };
  }
}
