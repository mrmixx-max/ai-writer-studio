// Ghost-Text: kontextuelle Fortsetzung für die Tab-Taste (WP2.2).
//
// Ablauf: Der Autor drückt Tab → das Modell schlägt eine Fortsetzung vor →
// der Vorschlag erscheint als Vorschau → Tab übernimmt, Escape verwirft.
//
// Zentrale Design-Entscheidung: Der Vorschlag wird NIE automatisch in das
// Dokument geschrieben. Ein Copilot, der ungefragt Text einfügt, ist bei einem
// Manuskript unbrauchbar — jeder Satz ist eine Autorenentscheidung.
//
// Der eigentliche Qualitätshebel liegt im Prompt: Das Modell neigt dazu, den
// Kontext ZUSAMMENZUFASSEN oder neu anzusetzen, statt fortzufahren. Beides
// erzeugt Text, der beim Einfügen doppelt oder falsch klingt. Deshalb:
// - Der Kontext wird klar abgegrenzt (Anfang/Ende-Marker).
// - Die Anweisung verbietet Wiederholung ausdrücklich.
// - Ein Sanity-Check verwirft Vorschläge, die den Kontext wiederholen.

import { z } from "zod";
import { parseStructuredJson } from "@/services/llm/structured";
import { cleanPassage } from "./quickActions";

/** Ein Fortsetzungsvorschlag. */
export interface GhostSuggestion {
  /** Der vorgeschlagene Text (ohne den bestehenden Kontext). */
  text: string;
  /** Anzahl Modellaufrufe. */
  attempts: number;
}

/** Callback für den Modell-Aufruf (injizierbar → LLM-frei testbar). */
export type GhostComplete = (prompt: string) => Promise<string>;

/**
 * Wie viel Kontext ans Modell geht.
 *
 * Nicht das ganze Kapitel: Der Anschluss muss an die UNMITTELBARE Umgebung
 * passen. Ein zu großer Kontext verwässert den Fokus und kostet nur Token.
 */
export const GHOST_CONTEXT_CHARS = 1500;
/** Obergrenze für den Vorschlag — ein Absatz, nicht eine halbe Seite. */
export const GHOST_MAX_CHARS = 600;

export const ghostSchema = z.object({
  text: z.string({ error: "text fehlt" }).min(1, "text ist leer"),
});

/**
 * Baut den Fortsetzungs-Prompt.
 *
 * @param context     Text VOR der Einfügemarke.
 * @param language    Sprache des Manuskripts.
 * @param instruction Optionaler Zusatz ("spannender", "knapper Dialog").
 */
export function buildGhostPrompt(
  context: string,
  language = "Deutsch",
  instruction?: string,
): string {
  // Nur das Ende des Kontexts — dort muss angeschlossen werden.
  const tail = context.slice(-GHOST_CONTEXT_CHARS);
  const extra = instruction?.trim() ? `\nZusätzliche Vorgabe: ${instruction.trim()}` : "";

  return (
    `Sprache: ${language}\n\n` +
    `Du setzt einen laufenden Erzähltext fort.\n\n` +
    `--- BISHERIGER TEXT (Anfang) ---\n${tail}\n--- BISHERIGER TEXT (Ende) ---\n\n` +
    `Schreibe die unmittelbare Fortsetzung: ein bis drei Sätze.\n\n` +
    `Wichtig:\n` +
    `- Beginne dort, wo der Text aufhört. Wiederhole NICHTS aus dem bisherigen Text.\n` +
    `- Fasse den bisherigen Text NICHT zusammen und leite nicht neu ein.\n` +
    `- Keine Wiederholung von Satzanfängen, die schon dastanden.\n` +
    `- Bleib in Zeitform, Perspektive und Tonfall.\n` +
    `- Kein Vorwort, keine Erklärung, keine Anführungszeichen um das Ganze.${extra}\n\n` +
    `Antworte als JSON: {"text": "…Fortsetzung…"}`
  );
}

/**
 * Erzeugt einen Fortsetzungsvorschlag.
 *
 * @param context  Text vor der Einfügemarke.
 * @param complete Modell-Aufruf.
 * @param options  Sprache, Zusatzvorgabe.
 *
 * Gibt null zurück, wenn kein brauchbarer Vorschlag entstand (z. B. das Modell
 * wiederholt nur den Kontext). Der Aufrufer zeigt dann keine Vorschau an —
 * besser als ein Vorschlag, der beim Übernehmen doppelten Text erzeugt.
 */
export async function suggestContinuation(
  context: string,
  complete: GhostComplete,
  options: { language?: string; instruction?: string } = {},
): Promise<GhostSuggestion | null> {
  if (!context.trim()) return null;

  const prompt = buildGhostPrompt(context, options.language, options.instruction);
  const raw = await complete(prompt);

  const outcome = await parseStructuredJson<{ text: string }>(
    raw,
    ghostSchema,
    undefined,
    "ghost-text",
  );

  const candidate = outcome.ok ? cleanPassage(outcome.value.text) : cleanPassage(raw);
  if (!candidate) return null;

  if (!isUsableSuggestion(candidate, context)) return null;

  return {
    text: candidate.length > GHOST_MAX_CHARS
      ? candidate.slice(0, GHOST_MAX_CHARS).trimEnd()
      : candidate,
    attempts: 1,
  };
}

/**
 * Mindestlänge eines brauchbaren Vorschlags.
 *
 * 3 Zeichen ("Ja.") ist formal ein Satz, aber als Fortsetzungsvorschlag
 * wertlos — er trägt die Erzählung nicht weiter und würde den Autor nur
 * unterbrechen. 12 Zeichen lassen Kurzsätze wie "Er schwieg." durch.
 */
export const GHOST_MIN_CHARS = 12;

/**
 * Prüft, ob ein Vorschlag als Fortsetzung taugt.
 *
 * Fängt die zwei häufigsten Modellfehler ab:
 *  1. Der Vorschlag wiederholt den Kontext (führt beim Einfügen zu Dopplung).
 *  2. Der Vorschlag ist zu kurz, um etwas beizutragen.
 */
export function isUsableSuggestion(suggestion: string, context: string): boolean {
  const s = suggestion.trim();
  if (s.length < GHOST_MIN_CHARS) return false;

  const tail = context.slice(-GHOST_CONTEXT_CHARS);
  const tailNormalized = normalizeForCompare(tail);

  // Wiederholt der Vorschlag einen längeren Ausschnitt aus dem Kontext?
  // Geprüft wird gegen das ENDE des Kontexts, weil dort angeschlossen wird.
  const probe = normalizeForCompare(s).slice(0, 120);
  if (probe.length >= 20 && tailNormalized.includes(probe)) return false;

  // Der Vorschlag enthält den kompletten Kontext (Modell hat zusammengefasst).
  if (s.length > tail.length && normalizeForCompare(s).includes(tailNormalized)) return false;

  return true;
}

/** Normalisiert für den Vergleich: Kleinschreibung, Whitespace vereinheitlicht. */
function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
