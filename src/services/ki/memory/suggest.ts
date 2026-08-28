// KI-Gedächtnis: Kontext-Vorschläge — schlägt relevante Erinnerungen + Projektwissen vor.
// Relevanz-Scoring per Stichwort-Überlappung zwischen aktuellem Text und Erinnerung.
import { listMemory } from "./store";
import { getDb } from "@/services/db";
import type { MemoryContextSuggestion, MemoryEntry } from "./types";

const STOPWORDS = new Set([
  "und", "oder", "der", "die", "das", "ein", "eine", "einer", "einem", "den", "dem", "des",
  "ist", "sind", "war", "waren", "hat", "haben", "wird", "werden", "mit", "von", "zu", "zum",
  "zur", "im", "in", "am", "an", "auf", "für", "aus", "bei", "nach", "nicht", "auch", "als",
  "wie", "sich", "so", "noch", "nur", "schon", "dass", "wenn", "aber", "er", "sie", "es",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\wäöüßäöü\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function overlapScore(textTokens: Set<string>, entry: MemoryEntry): number {
  const entryTokens = tokenize(`${entry.title} ${entry.content}`);
  let hits = 0;
  for (const t of entryTokens) if (textTokens.has(t)) hits++;
  if (!entryTokens.size) return 0;
  // Wichtigkeit (1–5) als Multiplikator, Trefferquote als Basis
  return (hits / entryTokens.size) * (0.5 + entry.importance / 5);
}

/**
 * Schlägt relevante Kontext-Bausteine vor: gespeicherte Erinnerungen,
 * die thematisch zum aktuellen Text passen (aktuelles Kapitel / Auswahl).
 */
export function suggestMemoryContext(currentText: string, projectId: string | null): MemoryContextSuggestion[] {
  if (!currentText.trim()) return [];
  const textTokens = tokenize(currentText);

  // Kandidaten: alle des Projekts + direkte Stichwort-Treffer
  const pool = [...listMemory({ projectId }), ...listMemory({ projectId: null })];
  const unique = new Map<string, MemoryEntry>();
  for (const e of pool) unique.set(e.id, e);

  const suggestions: MemoryContextSuggestion[] = [];
  for (const entry of unique.values()) {
    const score = overlapScore(textTokens, entry);
    if (score <= 0) continue;
    const hits = [...tokenize(`${entry.title} ${entry.content}`)].filter((t) => textTokens.has(t));
    suggestions.push({
      entry,
      score,
      reason: hits.length ? `Erwähnt: ${hits.slice(0, 3).join(", ")}` : "Thematisch passend",
    });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
}

export interface ProjectFact {
  label: string;
  detail: string;
}

/** Liest Projektwissen (Figuren, Orte, Lore) direkt aus dem Projekt als Vorschläge. */
export function suggestProjectContext(projectId: string | null): ProjectFact[] {
  if (!projectId) return [];
  const db = getDb();
  const out: ProjectFact[] = [];
  try {
    const chars = db.exec("SELECT name, role, traits FROM characters WHERE project_id = ? LIMIT 20", [projectId]);
    if (chars.length) for (const r of chars[0].values) {
      out.push({ label: `Figur: ${r[0]}`, detail: [r[1], r[2]].filter(Boolean).join(" — ") });
    }
    const locs = db.exec("SELECT name, description FROM locations WHERE project_id = ? LIMIT 20", [projectId]);
    if (locs.length) for (const r of locs[0].values) {
      out.push({ label: `Ort: ${r[0]}`, detail: String(r[1] ?? "") });
    }
    const lore = db.exec("SELECT name, category, description FROM lore_entries WHERE project_id = ? LIMIT 20", [projectId]);
    if (lore.length) for (const r of lore[0].values) {
      out.push({ label: `${r[1]}: ${r[0]}`, detail: String(r[2] ?? "") });
    }
  } catch {
    // Tabellen können in älteren Projekten fehlen — dann keine Vorschläge
  }
  return out;
}

/**
 * Vollständiger Kontext-Block für den KI-Request:
 * Erinnerungen (relevanz-sortiert) + Projektwissen, kompakt für den Prompt.
 */
export function buildSuggestedContext(
  currentText: string,
  projectId: string | null,
  maxChars = 2000,
): { block: string; usedIds: string[] } {
  const suggestions = suggestMemoryContext(currentText, projectId);
  const facts = suggestProjectContext(projectId);
  const parts: string[] = [];
  let used = 0;
  const usedIds: string[] = [];

  if (suggestions.length) {
    parts.push("— Erinnerungen —");
    for (const s of suggestions) {
      const line = `- [${s.entry.kind}] ${s.entry.title}: ${s.entry.content.replace(/\n+/g, " ").slice(0, 200)} (${s.reason})`;
      if (used + line.length > maxChars) break;
      parts.push(line);
      used += line.length;
      usedIds.push(s.entry.id);
    }
  }
  if (facts.length && used < maxChars) {
    parts.push("— Projektwissen —");
    for (const f of facts) {
      const line = `- ${f.label}${f.detail ? `: ${f.detail.slice(0, 150)}` : ""}`;
      if (used + line.length > maxChars) break;
      parts.push(line);
      used += line.length;
    }
  }
  return { block: parts.join("\n"), usedIds };
}
