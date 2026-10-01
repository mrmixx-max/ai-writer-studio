// Kontext-Budget: Passt den Prompt an das Kontextfenster des Modells an.
//
// Problem (WP1.3): Bisher wurde der Prompt unabhängig vom Modell gebaut.
// - Ein 4096-Token-Modell bekam einen Prompt, der nie hineinpasst → das
//   Modell schneidet still ab, die Kapitelqualität bricht ein, ohne Fehler.
// - Ein 128k-Modell bekam nur die letzten 200 Zeichen der Vorkapitel, obwohl
//   deutlich mehr hineinpasst.
//
// Dieses Modul beantwortet EINE Frage: Wie viel Prompt passt zu diesem Modell,
// und in welcher Reihenfolge wird gekürzt, wenn es nicht passt?
//
// Kürzungsreihenfolge (bewusst NICHT nach "ältestes zuerst"): Der Kern bleibt
// immer erhalten, weggeschnitten wird von außen nach innen.
//   1. Buchkonzept      — wichtig, aber ersetzbar durch Prämisse
//   2. Frühere Kapitel  — Zusammenfassungen, von den ältesten an
//   3. Recherche-Notizen
//   4. Fakten-Base      — die stabilen Charaktere/Orte sind am schwersten zu
//                         ersetzen; sie fallen zuletzt weg
// Der System-Prompt und die unmittelbare Aufgabe werden NIE gekürzt.

import { estimateTokens } from "@/services/knowledge/chunking";
import { getLocalModelProfile } from "@/services/llm/localModelProfiles";

/** Ein benannter, kürzbarer Prompt-Baustein. */
export interface ContextSection {
  /** Name für Log und Tests, z. B. "concept" oder "facts". */
  name: string;
  text: string;
  /** Niedriger = wird früher weggeschnitten. */
  priority: number;
}

/** Ergebnis einer Budget-Anpassung. */
export interface BudgetResult {
  /** Die gekürzten Bausteine in der übergebenen Reihenfolge. */
  sections: ContextSection[];
  /** Geschätzte Tokenzahl aller Bausteine nach dem Kürzen. */
  usedTokens: number;
  /** Für den Prompt verfügbare Token (Kontextfenster minus Reserven). */
  availableTokens: number;
  /** Namen der Bausteine, die (teilweise) gekürzt wurden. */
  trimmed: string[];
}

/**
 * Reserven: Was vom Kontextfenster NICHT für den Prompt verwendet wird.
 *
 * - OUTPUT_RESERVE_RATIO: Die Antwort braucht Platz. Ein Kapitel-Chunk von
 *   800 Wörtern sind grob 1100 Token; die Ratio deckt auch größere Ausgaben ab.
 * - SAFETY_TOKENS: Puffer für die Chat-Vorlage (Rollen-Marker, Sonderzeichen)
 *   und für die Ungenauigkeit der Schätzung. estimateTokens ist konservativ,
 *   aber nicht exakt — ohne Puffer kippt ein Prompt knapp über die Grenze.
 */
export const OUTPUT_RESERVE_RATIO = 0.35;
export const SAFETY_TOKENS = 256;

/**
 * Kürzungsreihenfolge (niedriger = früher weg).
 * Exportiert, damit Aufrufer und Tests dieselbe Ordnung sehen.
 */
export const SECTION_PRIORITY = {
  /** Buchkonzept — inhaltlich wichtig, aber die Prämisse trägt das Nötigste. */
  concept: 1,
  /** Frühere Kapitel-Zusammenfassungen — ab den ältesten entbehrlich. */
  previousChapters: 2,
  /** RAG-Treffer aus Projektdokumenten. */
  research: 3,
  /** Fakten-Base: Charaktere, Orte, Zeitlinie — zuletzt kürzen. */
  facts: 4,
  /** World-Bible: Regeln und Historie der Welt. */
  world: 5,
} as const;

/**
 * Für den Prompt verfügbare Token im Kontextfenster des Modells.
 *
 * Das Kontextfenster ist Prompt UND Antwort zusammen. Deshalb wird zuerst die
 * Ausgabe-Reserve abgezogen, dann der Sicherheitspuffer.
 */
export function availablePromptTokens(model: string): number {
  const profile = getLocalModelProfile(model);
  const window = profile.contextTokens;
  const afterOutput = window * (1 - OUTPUT_RESERVE_RATIO);
  return Math.max(0, Math.floor(afterOutput - SAFETY_TOKENS));
}

/**
 * Kürzt Text auf höchstens `maxTokens`, ohne mitten im Wort abzureißen.
 * Schneidet bevorzugt an einer Satzgrenze, sonst an einem Leerzeichen.
 * Markiert eine Kürzung sichtbar, damit das Modell weiß, dass Kontext fehlt.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  if (estimateTokens(text) <= maxTokens) return text;

  // estimateTokens rechnet Zeichen/3.4 — die zulässige Zeichenzahl ergibt sich
  // daraus zurück. Kleiner Puffer, weil die Markierung selbst Platz braucht.
  const marker = "\n[…gekürzt]";
  const markerTokens = estimateTokens(marker);
  const budgetTokens = Math.max(1, maxTokens - markerTokens);
  const maxChars = Math.floor(budgetTokens * 3.4);
  if (maxChars >= text.length) return text;

  const slice = text.slice(0, maxChars);
  // Satzende suchen (letzte 30 % des Schnitts), sonst Wortgrenze.
  const searchFrom = Math.floor(maxChars * 0.7);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". ", searchFrom),
    slice.lastIndexOf("! ", searchFrom),
    slice.lastIndexOf("? ", searchFrom),
    slice.lastIndexOf("\n", searchFrom),
  );
  const cut = sentenceEnd > 0 ? sentenceEnd + 1 : slice.lastIndexOf(" ");
  return (cut > 0 ? slice.slice(0, cut) : slice).trimEnd() + marker;
}

/**
 * Passt die Prompt-Bausteine an das Kontextfenster an.
 *
 * Algorithmus: Solange über Budget, den Baustein mit der NIEDRIGSTEN Priorität
 * kürzen (bei Gleichstand den längsten). Ein Baustein wird erst auf einen
 * Bruchteil reduziert, dann ganz verworfen — so bleibt sein Kern möglichst lange.
 */
export function fitToBudget(
  sections: ContextSection[],
  model: string,
  availableTokens = availablePromptTokens(model),
): BudgetResult {
  const trimmed: string[] = [];
  // Kopie: der Aufrufer soll sein Original behalten.
  const work = sections.map((s) => ({ ...s }));

  const total = () => work.reduce((sum, s) => sum + estimateTokens(s.text), 0);
  if (total() <= availableTokens) {
    return { sections: work, usedTokens: total(), availableTokens, trimmed };
  }

  // Wiederholt den aktuell entbehrlichsten Baustein verkleinern.
  // Schutz gegen Endlosschleifen: höchstens 40 Runden.
  for (let round = 0; round < 40 && total() > availableTokens; round++) {
    const over = total() - availableTokens;

    // Kandidat: niedrigste Priorität, bei Gleichstand der längste Text.
    const candidates = work
      .filter((s) => s.text.length > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return estimateTokens(b.text) - estimateTokens(a.text);
      });
    const victim = candidates[0];
    if (!victim) break; // nichts mehr zu kürzen

    const victimTokens = estimateTokens(victim.text);
    if (victimTokens <= over) {
      // Baustein passt komplett ins Ersparnis → ganz entfernen.
      if (!trimmed.includes(victim.name)) trimmed.push(victim.name);
      victim.text = "";
      continue;
    }

    // Nur teilweise kürzen: Zielgröße = aktuelle minus Überhang.
    const target = Math.max(0, victimTokens - over);
    const next = truncateToTokens(victim.text, target);
    if (!trimmed.includes(victim.name)) trimmed.push(victim.name);
    if (next === victim.text) {
      // Kein Fortschritt möglich (z. B. sehr kurzer Text) → verwerfen,
      // sonst dreht die Schleife.
      victim.text = "";
    } else {
      victim.text = next;
    }
  }

  return { sections: work, usedTokens: total(), availableTokens, trimmed };
}

/**
 * Baut den fertigen Kontext-String aus den (bereits gekürzten) Bausteinen.
 * Leere Bausteine werden übersprungen — kein leeres Gerüst im Prompt.
 */
export function renderSections(sections: ContextSection[]): string {
  return sections
    .filter((s) => s.text.trim().length > 0)
    .map((s) => s.text.trim())
    .join("\n\n");
}
