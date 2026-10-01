// Schnellaktionen für markierten Text (WP2.2).
//
// Die drei geforderten Aktionen sind redaktionelle Handgriffe, die sich
// inhaltlich unterscheiden — nicht nur in der Temperatur:
//
//   "Zeige, statt zu erzählen" (Show, don't tell)
//     Ersetzt zusammenfassende Aussagen durch konkrete Handlung, Sinneseindruck
//     oder Dialog. Ein Satz wie "Sie war wütend." wird zu etwas, das man sieht.
//
//   "Atmosphäre verdichten"
//     Verstärkt Sinneseindrücke und Stimmung, OHNE Handlung zu erfinden.
//
//   "Dialog schärfen"
//     Gibt Figuren unterscheidbare Stimmen, kürzt Höflichkeitsfloskeln,
//     macht aus indirekter Rede echte Rede.
//
// Jede Aktion hat einen eigenen Prompt. Eine gemeinsame "verbessere den Text"-
// Anweisung würde bei allen drei dasselbe Ergebnis liefern — austauschbare
// Prosa, die keines der Probleme wirklich löst.

import { z } from "zod";
import { parseStructuredJson } from "@/services/llm/structured";
import { stripOuterQuotes } from "@/services/bookwriter/rewrite";

/** Kennung einer Schnellaktion. */
export type QuickActionId = "show-dont-tell" | "atmosphere" | "sharpen-dialogue";

export interface QuickAction {
  id: QuickActionId;
  /** Anzeigename (deutsch, wie im Bubble-Menü). */
  label: string;
  /** Kurzhinweis für Tooltip. */
  hint: string;
}

/** Die auswählbaren Aktionen in Anzeige-Reihenfolge. */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: "show-dont-tell",
    label: "Zeige, statt zu erzählen",
    hint: "Ersetzt zusammenfassende Aussagen durch Handlung, Sinneseindruck oder Dialog.",
  },
  {
    id: "atmosphere",
    label: "Atmosphäre verdichten",
    hint: "Verstärkt Sinneseindrücke und Stimmung, ohne Handlung zu erfinden.",
  },
  {
    id: "sharpen-dialogue",
    label: "Dialog schärfen",
    hint: "Gibt Figuren unterscheidbare Stimmen und kürzt Floskeln.",
  },
];

/** Die Anweisung je Aktion. Bewusst als eigene Texte, nicht als Parameter. */
const ACTION_PROMPTS: Record<QuickActionId, string> = {
  "show-dont-tell": `Überarbeite die Textstelle nach dem Grundsatz "Zeige, statt zu erzählen".

Konkret:
- Ersetze zusammenfassende Aussagen über Gefühle durch konkrete Beobachtbares:
  Handlung, Körperreaktion, Sinneseindruck oder wörtliche Rede.
- Beispiel: "Sie war wütend." → "Ihre Finger krallten sich in die Tischkante."
- Erfinde KEINE neuen Handlungselemente. Nutze nur, was in der Stelle angelegt ist.
- Behalte Zeitform, Perspektive und Figuren bei.`,

  atmosphere: `Verdichte die Atmosphäre der Textstelle.

Konkret:
- Verstärke Sinneseindrücke (Geruch, Geräusch, Temperatur, Licht, Textur).
- Wähle wenige, dafür präzise Details statt vieler allgemeiner.
- Erzeuge Stimmung durch das, was wahrgenommen wird — nicht durch Benennung
  ("es war unheimlich" ist zu vermeiden).
- Erfinde KEINE neue Handlung und keine neuen Figuren.
- Behalte Zeitform und Perspektive bei.`,

  "sharpen-dialogue": `Schärfe den Dialog der Textstelle.

Konkret:
- Gib jeder Figur eine unterscheidbare Stimme (Wortwahl, Satzlänge, Rhythmus).
- Kürze Höflichkeitsfloskeln und Füllwörter, die echte Rede selten hat.
- Wo indirekte Rede steht, mache echte, wörtliche Rede daraus.
- Subtext: Figuren sagen selten direkt, was sie meinen.
- Erfinde KEINE neuen Informationen oder Wendungen. Der Inhalt bleibt gleich.`,
};

/** Ein Ergebnis der Schnellaktion. */
export interface QuickActionResult {
  /** Überarbeitete Textstelle. */
  text: string;
  /** Die angewandte Aktion. */
  action: QuickActionId;
  /** Anzahl Modellaufrufe (1 = direkt gültig, 2 = mit Reparaturversuch). */
  attempts: number;
}

/** Callback für den Modell-Aufruf (injizierbar → LLM-frei testbar). */
export type QuickActionComplete = (prompt: string) => Promise<string>;

/**
 * Struktur der Modell-Antwort.
 *
 * Warum JSON statt reinem Text: Ohne Umschließung ist nicht unterscheidbar, ob
 * das Modell die Textstelle geliefert hat oder eine Erklärung dazu ("Hier ist
 * meine Überarbeitung: …"). Das Feld `text` macht die Grenze eindeutig.
 */
export const quickActionSchema = z.object({
  text: z.string({ error: "text fehlt" }).min(1, "text ist leer"),
});

/**
 * Baut den Prompt für eine Schnellaktion.
 *
 * Die Textstelle wird klar abgegrenzt, damit das Modell sie nicht mit der
 * Anweisung vermischt — bei kurzen Stellen ein häufiger Fehler.
 */
export function buildQuickActionPrompt(
  action: QuickActionId,
  passage: string,
  context?: { title?: string; language?: string },
): string {
  const instruction = ACTION_PROMPTS[action];
  const lang = context?.language ?? "Deutsch";
  const titleLine = context?.title ? `Kapitel: "${context.title}"\n` : "";

  return (
    `${titleLine}Sprache: ${lang}\n\n` +
    `${instruction}\n\n` +
    `--- TEXTSTELLE (Anfang) ---\n${passage}\n--- TEXTSTELLE (Ende) ---\n\n` +
    `Gib NUR die überarbeitete Textstelle zurück, ohne Erklärung, ohne Vorwort, ` +
    `ohne Anführungszeichen um das Ganze.\n` +
    `Antworte als JSON: {"text": "…überarbeitete Stelle…"}`
  );
}

/**
 * Führt eine Schnellaktion aus.
 *
 * @param action    Welche Aktion.
 * @param passage   Der markierte Text.
 * @param complete  Modell-Aufruf.
 * @param context   Optional: Kapiteltitel und Sprache.
 *
 * Wirft bei leerer Textstelle oder wenn das Modell nichts Brauchbares liefert.
 */
export async function runQuickAction(
  action: QuickActionId,
  passage: string,
  complete: QuickActionComplete,
  context?: { title?: string; language?: string },
): Promise<QuickActionResult> {
  if (!passage.trim()) {
    throw new Error("Schnellaktion: Die Textstelle ist leer.");
  }

  const prompt = buildQuickActionPrompt(action, passage, context);
  const raw = await complete(prompt);

  // Das Modell liefert entweder {"text": "…"} oder — trotz Anweisung — den
  // nackten Text. Beides wird akzeptiert; JSON hat Vorrang, weil es die
  // Grenze eindeutig macht.
  const outcome = await parseStructuredJson<{ text: string }>(
    raw,
    quickActionSchema,
    undefined,
    `quick-action/${action}`,
  );

  if (outcome.ok) {
    const text = cleanPassage(outcome.value.text);
    if (text) return { text, action, attempts: 1 };
  }

  // Fallback: nackter Text ohne JSON-Hülle.
  const bare = cleanPassage(raw);
  if (!bare) {
    throw new Error(
      `Schnellaktion "${action}": Das Modell lieferte keine brauchbare Überarbeitung.`,
    );
  }
  return { text: bare, action, attempts: 1 };
}

/**
 * Entfernt Umschließungen, die Modelle gern hinzufügen: Anführungszeichen,
 * Code-Fences, einleitende Floskeln. Die Textstelle muss direkt einsetzbar sein.
 */
export function cleanPassage(raw: string): string {
  let s = raw.trim();

  // Code-Fences entfernen.
  s = s.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/, "").trim();

  // Umschließende Anführungszeichen ZUERST: Modelle schreiben die Floskel
  // häufig INNERHALB der Quotes ("Hier ist meine Überarbeitung: …"). Würde
  // erst die Floskel entfernt, bliebe sie wegen des führenden " stehen.
  s = stripOuterQuotes(s);

  // Einleitende Floskel vor der eigentlichen Stelle abschneiden.
  s = s.replace(
    /^(?:Hier ist (?:meine|die) (?:Überarbeitung|Version|Fassung)|Überarbeitete (?:Textstelle|Fassung)|Ergebnis)\s*:?\s*/i,
    "",
  ).trim();

  // Nach dem Floskel-Schnitt können erneut Quotes übrig sein.
  s = stripOuterQuotes(s);

  return s.trim();
}
