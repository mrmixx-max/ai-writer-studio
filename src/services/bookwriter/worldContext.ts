// World-Kontext (RAG-Light): Welt-Regeln, Historie und Lore für den Prompt.
//
// Problem (WP1.3): World-Bible und Lore existierten nur als UI-Daten. Die
// Kapitelgenerierung kannte weder die Weltregeln noch die Artefakte und Mythen
// des Projekts — das Modell erfand bei jedem Kapitel eine neue Welt.
//
// Ansatz: Kein Embedding-Index, sondern Relevanz über Erwähnungen. Für die
// aktuelle Szene (Titel, Ziel, Konflikt, Ausgang) wird gezählt, welche
// Lore-Einträge dort vorkommen (countLoreMentions, bereits vorhanden). Alles,
// was erwähnt wird, kommt zuerst; der Rest folgt als Grundgerüst, bis das
// Budget erschöpft ist.
//
// Das ist bewusst "RAG-Light": deterministisch, ohne Modell-Call, testbar.
// Ein Embedding-Retrieval wäre genauer, kostet aber einen Index und einen
// Modell-Aufruf pro Kapitel — für Weltregeln, die ohnehin wenige hundert
// Zeilen umfassen, ist das der falsche Preis.

import { getWorldBible } from "@/services/worldbuilding/worldbible";
import { listLore, countLoreMentions, type LoreEntry } from "@/services/worldbuilding/lore";
import { estimateTokens } from "@/services/knowledge/chunking";

/** Obergrenzen, damit ein umfangreiches Weltprojekt den Prompt nicht flutet. */
export const MAX_WORLD_RULES = 25;
export const MAX_HISTORY_EVENTS = 15;
/** Ohne Erwähnung: so viele Lore-Einträge kommen trotzdem mit. */
export const MAX_UNMENTIONED_LORE = 12;
export const MAX_MENTIONED_LORE = 20;

/** Die für die Szene relevanten Welt-Bausteine. */
export interface WorldContext {
  /** Fertiger Textblock ("" wenn das Projekt keine Welt-Daten hat). */
  text: string;
  /** Geschätzte Token des Blocks. */
  tokens: number;
  /** Namen der Lore-Einträge, die in der SZENE erwähnt wurden (nicht: alle aufgenommenen). */
  mentioned: string[];
  /** Namen aller Lore-Einträge, die im Block stehen. */
  included: string[];
}

/**
 * Baut den Welt-Kontext für eine Szene.
 *
 * @param projectId  Projekt, dessen World-Bible/Lore gelesen wird.
 * @param sceneText  Text der geplanten Szene (Titel, Ziel, Konflikt, Ausgang).
 *                   Erwähnte Lore-Einträge werden bevorzugt aufgenommen.
 * @param maxTokens  Obergrenze für den fertigen Block. 0 = unbegrenzt.
 */
export function buildWorldContext(
  projectId: string,
  sceneText = "",
  maxTokens = 0,
): WorldContext {
  const lines: string[] = [];

  const bible = getWorldBible(projectId);
  if (bible) {
    if (bible.premise.trim()) {
      lines.push("Welt-Prämisse:", bible.premise.trim());
    }
    if (bible.rules.length) {
      // Kategorien gruppieren: mehrere "Magie"-Regeln gehören zusammen.
      const byCategory = new Map<string, string[]>();
      for (const r of bible.rules.slice(0, MAX_WORLD_RULES)) {
        if (!r.text.trim()) continue;
        const cat = r.category.trim() || "Allgemein";
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(r.text.trim());
      }
      if (byCategory.size) {
        lines.push("Weltregeln (verbindlich):");
        for (const [cat, rules] of byCategory) {
          lines.push(`- ${cat}: ${rules.join(" | ")}`);
        }
      }
    }
    // Chronologie: erst sammeln, dann die Überschrift nur bei Treffern setzen —
    // sonst bliebe bei lauter leeren Ereignissen eine nackte Überschrift stehen.
    const events: string[] = [];
    for (const e of bible.history.slice(0, MAX_HISTORY_EVENTS)) {
      if (!e.title.trim() && !e.description.trim()) continue;
      const year = e.year.trim() ? `${e.year.trim()}: ` : "";
      events.push(`- ${year}${e.title.trim() || e.description.trim()}`);
    }
    if (events.length) {
      lines.push("Chronologie:", ...events);
    }
    if (bible.notes.trim()) {
      lines.push("Anmerkungen:", bible.notes.trim());
    }
  }

  // Lore nach Relevanz: erwähnte zuerst (nach Häufigkeit), dann der Rest.
  const lore = listLore(projectId);
  const mentioned: string[] = [];
  const included: string[] = [];
  if (lore.length) {
    const scored = lore.map((entry: LoreEntry) => ({
      entry,
      hits: sceneText ? countLoreMentions(entry, sceneText) : 0,
    }));
    const hit = scored
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, MAX_MENTIONED_LORE);
    const rest = scored
      .filter((s) => s.hits === 0)
      .slice(0, MAX_UNMENTIONED_LORE);

    const chosen = [...hit, ...rest];
    if (chosen.length) {
      lines.push("Lore (Figuren, Orte, Artefakte, Mythen):");
      for (const { entry, hits } of chosen) {
        included.push(entry.name);
        if (hits > 0) mentioned.push(entry.name);
        const desc = entry.description.trim() || entry.notes.trim();
        const aliases = entry.aliases.filter((a) => a.trim()).join(", ");
        const aliasPart = aliases ? ` (auch: ${aliases})` : "";
        const hitPart = hits > 0 ? ` [in dieser Szene erwähnt]` : "";
        lines.push(`- ${entry.name}${aliasPart} [${entry.category}]${hitPart}: ${desc}`);
      }
    }
  }

  if (!lines.length) return { text: "", tokens: 0, mentioned, included };

  let text = `Welt-Kontext (verbindlich — nicht widersprechen):\n${lines.join("\n")}`;
  if (maxTokens > 0 && estimateTokens(text) > maxTokens) {
    // Kürzen ohne Satzlogik: Weltzeilen sind eigenständig, ein harter Schnitt
    // an der Zeilengrenze ist hier sinnvoller als ein Satz-Fallback.
    const kept: string[] = [];
    let used = 0;
    for (const line of text.split("\n")) {
      const t = estimateTokens(line);
      if (used + t > maxTokens) break;
      kept.push(line);
      used += t;
    }
    text = kept.join("\n") + "\n[…gekürzt]";
  }

  return { text, tokens: estimateTokens(text), mentioned, included };
}
