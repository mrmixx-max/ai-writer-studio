// LLM-Rewrite-Engine (Sprint 17, Agent 4).
//
// Schreibt Textstellen anhand von Qualitaetsbefunden (Agent 1:
// `ChapterQualityResult.issues`/`suggestions` aus `./quality`) gezielt um.
// Muster aus `./lektorat` (Sprint 11): reine Funktionen, keine Seiteneffekte,
// einzige LLM-Schnittstelle ist die injizierbare `CompleteFn`
// `(prompt) => Promise<string>` — Tests mocken `complete`. Die
// Produktions-Verdrahtung (`createOllamaComplete`) nutzt `completeOnce` aus
// `@/services/llm` via Lazy-Import — kein neuer Netzwerk-Code
// (Router-Pattern aus `src/services/llm/` bleibt unberuehrt, read-only).

import type { ChapterQualityResult } from "./quality";

/** Tonalitaet der Ueberarbeitung. */
export type RewriteTone = "preserve" | "formal" | "casual";

/** Laengenvorgabe der Ueberarbeitung. */
export type RewriteLength = "same" | "shorter" | "longer";

/** Optionen fuer `rewritePassage` (alle mit Default). */
export interface RewriteOptions {
  /** `preserve` = Tonalitaet beibehalten (Default). */
  tone?: RewriteTone;
  /** `same` = ungefaehr gleiche Laenge (Default). */
  length?: RewriteLength;
}

/** Ein einzelner Rewrite-Befund (z.B. aus `ChapterQualityResult`). */
export interface RewriteFinding {
  /** Konkreter Befund, z.B. ein Eintrag aus `ChapterQualityResult.issues`. */
  issue: string;
  /** Optionaler Verbesserungsvorschlag, z.B. aus `suggestions`. */
  suggestion?: string;
}

/** Findings-Eingabe: fertige Objekte, reine Strings oder Qualitaetsergebnis. */
export type RewriteFindingsInput =
  | Array<RewriteFinding | string>
  | Pick<ChapterQualityResult, "issues" | "suggestions">;

/** Injizierbare LLM-Funktion — einzige LLM-Schnittstelle dieses Moduls. */
export type CompleteFn = (prompt: string) => Promise<string>;

/** Aufgeloeste Optionen (alle Felder gesetzt). */
export interface ResolvedRewriteOptions {
  tone: RewriteTone;
  length: RewriteLength;
}

/** Default-Optionen. */
export const DEFAULT_REWRITE_OPTIONS: ResolvedRewriteOptions = {
  tone: "preserve",
  length: "same",
} as const;

/** Gueltige Werte (fuer Validierung, exportiert fuer Tests/UI). */
export const REWRITE_TONES: readonly RewriteTone[] = ["preserve", "formal", "casual"];
export const REWRITE_LENGTHS: readonly RewriteLength[] = ["same", "shorter", "longer"];

/**
 * Normalisiert die Findings-Eingabe auf `{ issue, suggestion? }[]`.
 * - Strings werden zu `{ issue: <string> }`.
 * - Leere/Whitespace-Eintraege werden verworfen.
 * - Ein `ChapterQualityResult`-artiges Objekt (`{ issues, suggestions }`)
 *   paart issues[i] mit suggestions[i] (soweit vorhanden).
 */
export function normalizeFindings(input: RewriteFindingsInput): RewriteFinding[] {
  if (!Array.isArray(input)) {
    const { issues, suggestions } = input;
    return (issues ?? [])
      .map((issue, i) => ({
        issue: issue?.trim() ? issue.trim() : "",
        suggestion: suggestions?.[i]?.trim() ? suggestions[i].trim() : undefined,
      }))
      .filter((f) => f.issue.length > 0);
  }
  const out: RewriteFinding[] = [];
  for (const entry of input) {
    if (typeof entry === "string") {
      if (entry.trim().length > 0) out.push({ issue: entry.trim() });
    } else if (entry && typeof entry.issue === "string" && entry.issue.trim().length > 0) {
      const f: RewriteFinding = { issue: entry.issue.trim() };
      if (entry.suggestion?.trim()) f.suggestion = entry.suggestion.trim();
      out.push(f);
    }
  }
  return out;
}

/** Loest Teil-Optionen gegen die Defaults auf (inkl. Validierung). */
export function resolveRewriteOptions(options?: RewriteOptions): ResolvedRewriteOptions {
  const tone = options?.tone ?? DEFAULT_REWRITE_OPTIONS.tone;
  const length = options?.length ?? DEFAULT_REWRITE_OPTIONS.length;
  if (!REWRITE_TONES.includes(tone)) {
    throw new Error(`Unbekannter Ton: ${String(tone)}. Erlaubt: ${REWRITE_TONES.join(", ")}.`);
  }
  if (!REWRITE_LENGTHS.includes(length)) {
    throw new Error(`Unbekannte Laenge: ${String(length)}. Erlaubt: ${REWRITE_LENGTHS.join(", ")}.`);
  }
  return { tone, length };
}

const TONE_INSTRUCTIONS: Record<RewriteTone, string> = {
  preserve: "Behalte die Tonalitaet und Stimme des Originals bei.",
  formal: "Formuliere formeller und sachlicher als das Original.",
  casual: "Formuliere lockerer und alltagsnaeher als das Original.",
};

const LENGTH_INSTRUCTIONS: Record<RewriteLength, string> = {
  same: "Halte ungefaehr die gleiche Laenge wie das Original.",
  shorter: "Kuerze deutlich (Faustregel: etwa zwei Drittel der Original-Laenge).",
  longer: "Baue die Stelle aus und vertiefe sie (Faustregel: etwa ein Drittel laenger).",
};

/**
 * Baut den gezielten Rewrite-Prompt aus Befunden + Optionen.
 * Exportiert, damit Tests/UI den Prompt pruefen koennen, ohne ein LLM zu rufen.
 */
export function buildRewritePrompt(
  passage: string,
  findings: RewriteFinding[],
  options?: RewriteOptions,
): string {
  const { tone, length } = resolveRewriteOptions(options);
  const lines = [
    "Du bist ein deutscher Lektor. Ueberarbeite die folgende Textstelle gezielt anhand der Befunde.",
    `Ton: ${TONE_INSTRUCTIONS[tone]}`,
    `Laenge: ${LENGTH_INSTRUCTIONS[length]}`,
    "Befunde:",
    ...findings.map((f, i) =>
      f.suggestion ? `${i + 1}. ${f.issue} -> ${f.suggestion}` : `${i + 1}. ${f.issue}`,
    ),
    `Textstelle: „${passage}“`,
    "Gib NUR die ueberarbeitete Textstelle zurueck, ohne Erklaerung, ohne Aufzaehlung.",
  ];
  return lines.join("\n");
}

/**
 * Entfernt eine einzelne aeussere Anfuehrungszeichen-Schicht (deutsch „…" oder
 * ASCII "..."), falls das LLM die Antwort darin verpackt hat.
 */
export function stripOuterQuotes(text: string): string {
  const t = text.trim();
  if (t.length >= 2) {
    const pairs: Array<[string, string]> = [
      ["„", "“"],
      ["“", "“"],
      ['"', '"'],
      ["«", "»"],
      ["»", "«"],
    ];
    for (const [open, close] of pairs) {
      if (t.startsWith(open) && t.endsWith(close)) return t.slice(1, -1).trim();
    }
  }
  return t;
}

/**
 * Schreibt eine Textstelle anhand der Qualitaetsbefunde via LLM um.
 *
 * - Leere Passage -> wirft (nichts zu ueberarbeiten).
 * - Keine Befunde -> gibt die Passage unveraendert zurueck, OHNE das LLM zu rufen.
 * - Leere/Whitespace-Antwort des LLM -> wirft (Fehlverhalten, kein stilles Fallback).
 * - `complete` wirft -> Fehler wird mit Kontext weitergegeben.
 */
export async function rewritePassage(
  passage: string,
  findings: RewriteFindingsInput,
  options?: RewriteOptions,
  complete?: CompleteFn,
): Promise<string> {
  if (!passage || passage.trim().length === 0) {
    throw new Error("rewritePassage: Die Textstelle ist leer.");
  }
  const normalized = normalizeFindings(findings);
  if (normalized.length === 0) return passage;

  const resolved = resolveRewriteOptions(options);
  const prompt = buildRewritePrompt(passage, normalized, resolved);
  const completeFn = complete ?? createOllamaComplete();

  let raw: string;
  try {
    raw = await completeFn(prompt);
  } catch (err) {
    throw new Error(
      `rewritePassage: LLM-Aufruf fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  if (!raw || raw.trim().length === 0) {
    throw new Error("rewritePassage: Das LLM lieferte keine brauchbare Umformulierung (leere Antwort).");
  }
  return stripOuterQuotes(raw);
}

/**
 * Baut eine `CompleteFn` auf dem bestehenden LLM-Service (`completeOnce` aus
 * `@/services/llm` + Settings). Lazy-Importe: Dieses Modul bleibt ohne Aufruf
 * dieser Funktion netzwerk- und seitenffektfrei. Es entsteht KEIN neuer
 * Netzwerk-Code — nur Verdrahtung (Muster aus `./lektorat`).
 */
export function createOllamaComplete(): CompleteFn {
  return async (prompt: string): Promise<string> => {
    const { loadSettings } = await import("@/services/settings");
    const { completeOnce } = await import("@/services/llm");
    const settings = loadSettings();
    return completeOnce(settings, prompt);
  };
}
