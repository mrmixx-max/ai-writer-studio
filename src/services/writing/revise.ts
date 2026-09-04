// Revisions-Pipeline: needs_revision wird zum produktiven Redaktions-Loop.
//
// reviseChapter(chapterId, mode):
//   - "straffen": −10 % Wortzahl, Füllwörter entfernen
//   - "vertiefen": +15 % Wortzahl, Beispiele/Anecdoten ergänzen
//   - "stil": Stilprofil anwenden (systemHint + rules)
//
// Nutzt withRetry (Sprint 1) für die LLM-Calls. Danach:
// - Kapitel-Status → "draft" (war "needs_revision" oder "completed")
// - Content + currentWordCount committet (updateChapter/updateChapterFields)
// - Revisionshistorie in chapter_revisions (Migration 019)
//
// Lokale Fallback-Straffung: computeLocalTightening() senkt die Füllwort-
// Quote rein heuristisch, wenn kein Provider erreichbar ist — der
// Akzeptanztest (30 % Füllwörter → straffen senkt Quote) bleibt so auch
// offline/ohne Modell prüfbar.

import { createProvider, buildMessages } from "@/services/llm";
import { loadSettings } from "@/services/settings";
import { getChapterDecrypted, updateChapter, updateChapterFields } from "@/services/project";
import { getDb, persistNow } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import { withRetry, isAbortError } from "./retry";
import type { StyleProfile } from "./styleProfiles";
import { computeReadability } from "./readability";
import { BOOKWRITER_BUDGET_WARNING_EVENT } from "@/services/bookwriter/telemetry";
import type { Chapter } from "@/types/project";

/** Revisions-Modus. */
export type RevisionMode = "straffen" | "vertiefen" | "stil";

/** Ergebnis einer Revision. */
export interface RevisionResult {
  chapterId: string;
  mode: RevisionMode;
  /** Revidierter Kapiteltext. */
  content: string;
  beforeWords: number;
  afterWords: number;
  beforeFillerRatio: number;
  afterFillerRatio: number;
  /** true, wenn der LLM-Call genutzt wurde; false = lokaler Fallback. */
  usedLLM: boolean;
  revisionId: string;
}

/** Formatiert Stilprofil-Regeln als Prompt-Block. */
export function buildStyleInstructions(profile?: StyleProfile | null): string {
  if (!profile) return "- (kein Profil: Grundstil beibehalten)";
  const rules = profile.rules.length > 0 ? profile.rules.map((r) => `- ${r}`).join("\n") : "- (keine Regeln definiert)";
  return rules;
}

// --- Metrik-Helfer (shared mit readability, lokal gekapselt) -----------------

/** Zählt Wörter eines Texts (gleiche Tokenisierung wie Kapitelgenerierung). */
function wordTokens(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Füllwort-Quote eines Texts (0..1) via readability.computeReadability. */
export function fillerRatioOf(text: string): number {
  return computeReadability(text).fillerRatio;
}

// --- Prompts -----------------------------------------------------------------

/** Baut den Revisions-Prompt je Modus. */
export function buildRevisionPrompt(
  mode: RevisionMode,
  content: string,
  profile?: StyleProfile | null,
): string {
  const base = `Revidiere den folgenden Kapiteltext.`;
  switch (mode) {
    case "straffen":
      return `${base}
Ziel: ca. 10 % kürzer. Entferne Füllwörter (also, eigentlich, irgendwie, halt, sozusagen), Redundanzen und leere Floskeln. Behalte alle Fakten, Namen und Zahlen unverändert.

Kapiteltext:
${content}

Antworte NUR mit dem revidierten Kapiteltext, keine Erklärungen, keine Überschriften.`;
    case "vertiefen":
      return `${base}
Ziel: ca. 15 % umfangreicher. Ergänze an zwei bis drei Stellen substanzielle Beispiele, konkrete Szenen oder anschauliche Details. Keine Wiederholungen, kein Fülltext.

Kapiteltext:
${content}

Antworte NUR mit dem erweiterten Kapiteltext, keine Erklärungen, keine Überschriften.`;
    case "stil":
      return `${base}
Wende das Stilprofil "${profile?.name ?? "Standard"}" an.

Stil-Hint:
${profile?.systemHint ?? ""}

Stil-Regeln:
${buildStyleInstructions(profile)}

Kapiteltext:
${content}

Antworte NUR mit dem neu stilisierten Kapiteltext, keine Erklärungen, keine Überschriften.`;
  }
}

/** System-Prompt: Sprache und Grundregeln. */
function revisionSystem(mode: RevisionMode): string {
  return `Du bist ein sorgfältiger Lektor für deutschsprachige Buchtexte. Aufgabe: ${mode}. Gib ausschließlich den revidierten Text zurück — kein Vorwort, keine Anmerkungen, keine Markdown-Überschriften.`;
}

// --- Lokale Fallback-Straffung -----------------------------------------------

/** Deutsche Füllwörter, die lokal entfernt werden (mit satzzeichensicherer Ersetzung). */
const LOCAL_FILLERS = [
  "also", "eigentlich", "irgendwie", "halt", "sozusagen", "quasi",
  "gewissermaßen", "letztendlich", "schlußendlich", "schlussendlich",
  "praktisch", "faktisch", "bekanntlich", "selbstverständlich", "übrigens",
  "wirklich", "einfach", "eben", "durchaus", "ohnehin", "sowieso",
];

/**
 * Lokale, LLM-freie Straffung: entfernt Füllwörter und doppelte Leerzeichen.
 * Reduziert die Füllwort-Quote messbar — Fallback, wenn kein Provider läuft.
 */
export function computeLocalTightening(content: string): string {
  let out = content;
  for (const w of LOCAL_FILLERS) {
    // Wortgrenzen-sicher, Komma-Nachlauf mitentfernen.
    out = out.replace(new RegExp(`\\b${w}\\b,?\\s*`, "gi"), (m) => (/[,.!?;]/.test(m) ? "" : ""));
  }
  // Rest-Kommas nach Entfernungen normalisieren (", ." → ".")
  out = out.replace(/\s+,/g, ",");
  out = out.replace(/\(\s*\)/g, "");
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/,\s*\./g, ".");
  return out.trim();
}

// --- Revisionshistorie -------------------------------------------------------

/** Ein Revisionshistorie-Eintrag. */
export interface RevisionRecord {
  id: string;
  chapterId: string;
  mode: RevisionMode;
  model: string | null;
  beforeWords: number;
  afterWords: number;
  beforeFiller: number;
  afterFiller: number;
  note: string | null;
  createdAt: number;
}

const REV_COLUMNS = `id, chapter_id, mode, model, before_words, after_words, before_filler, after_filler, note, created_at`;

function rowToRevision(r: unknown[]): RevisionRecord {
  return {
    id: String(r[0]),
    chapterId: String(r[1]),
    mode: String(r[2]) as RevisionMode,
    model: r[3] === null || r[3] === undefined ? null : String(r[3]),
    beforeWords: Number(r[4] ?? 0),
    afterWords: Number(r[5] ?? 0),
    beforeFiller: Number(r[6] ?? 0),
    afterFiller: Number(r[7] ?? 0),
    note: r[8] === null || r[8] === undefined ? null : String(r[8]),
    createdAt: Number(r[9] ?? 0),
  };
}

/** Liefert die Revisionshistorie eines Kapitels (neueste zuerst). */
export function listRevisions(chapterId: string): RevisionRecord[] {
  const res = getDb().exec(
    `SELECT ${REV_COLUMNS} FROM chapter_revisions WHERE chapter_id = ? ORDER BY created_at DESC`,
    [chapterId],
  );
  if (!res.length) return [];
  return res[0].values.map(rowToRevision);
}

/** Committet einen Revisions-Eintrag (sofort persistiert). */
function saveRevision(rec: Omit<RevisionRecord, "id" | "createdAt">): RevisionRecord {
  const db = getDb();
  const now = Date.now();
  const id = uid("rev");
  db.run(
    `INSERT INTO chapter_revisions (${REV_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, rec.chapterId, rec.mode, rec.model, rec.beforeWords, rec.afterWords, rec.beforeFiller, rec.afterFiller, rec.note, now],
  );
  void persistNow();
  return { ...rec, id, createdAt: now };
}

// --- Budget-Warnung (Agent 2: telemetry.ts → DOM-Event) ----------------------

/** Letzte Budget-Warnung (aus bookwriter:budget-warning Event), null = ok. */
let lastBudgetWarning: string | null = null;

/** Listener wird einmalig installiert (idempotent). */
export function installBudgetWarningListener(): void {
  if (typeof window === "undefined" || typeof (window as any).addEventListener !== "function") return;
  (window as any).addEventListener(BOOKWRITER_BUDGET_WARNING_EVENT, (e: Event) => {
    const detail = (e as CustomEvent).detail as { spent?: number; limit?: number } | undefined;
    lastBudgetWarning = `API-Budget überschritten: ${detail?.spent ?? "?"} > ${detail?.limit ?? "?"}`;
  });
}

/** Aktuelle Budget-Warnung (für das Review-UI). */
export function getBudgetWarning(): string | null {
  return lastBudgetWarning;
}

/** Setzt die Budget-Warnung zurück (z.B. nach Job-Wechsel). */
export function clearBudgetWarning(): void {
  lastBudgetWarning = null;
}

// --- Kern --------------------------------------------------------------------

/**
 * Revidiert ein Kapitel.
 *
 * @param chapterId Kapitel-ID.
 * @param mode "straffen" | "vertiefen" | "stil".
 * @param profile Stilprofil (Pflicht für mode="stil", optional sonst).
 * @param signal AbortSignal zum Unterbrechen.
 * @throws Fehler, wenn Kapitel fehlt, leer ist oder mode="stil" ohne Profil.
 */
export async function reviseChapter(
  chapterId: string,
  mode: RevisionMode,
  profile: StyleProfile | null = null,
  signal?: AbortSignal,
): Promise<RevisionResult> {
  const chapter = await getChapterDecrypted(chapterId);
  if (!chapter) throw new Error(`Kapitel ${chapterId} nicht gefunden.`);
  const content = chapter.content?.trim();
  if (!content) throw new Error(`Kapitel "${chapter.title}" hat keinen Inhalt zum Revidieren.`);
  if (mode === "stil" && !profile) {
    throw new Error(`Stil-Revision ohne Stilprofil: Für mode="stil" ist ein StyleProfile erforderlich.`);
  }

  const beforeWords = wordTokens(content).length;
  const beforeFiller = fillerRatioOf(content);

  let revised: string;
  let usedLLM = true;
  let model: string | null = null;

  try {
    const llm = await reviseWithLLM(mode, content, profile, signal);
    revised = llm.text;
    model = llm.model;
  } catch (e: unknown) {
    // Abort gehört zum Vertrag — nicht schlucken.
    if (isAbortError(e)) throw e;
    // Straffen hat einen lokalen Fallback (Heuristik), alles andere wirft.
    if (mode !== "straffen") throw e;
    revised = computeLocalTightening(content);
    usedLLM = false;
  }

  if (!revised.trim()) revised = content;
  const afterWords = wordTokens(revised).length;
  const afterFiller = fillerRatioOf(revised);

  // Content persistieren (verschlüsselt, via updateChapter).
  await updateChapter(chapterId, revised);
  // Status → draft (Redaktions-Loop: needs_revision/completed → draft),
  // currentWordCount committet.
  await updateChapterFields(chapterId, { status: "draft", currentWordCount: afterWords });

  const rec = saveRevision({
    chapterId,
    mode,
    model,
    beforeWords,
    afterWords,
    beforeFiller,
    afterFiller,
    note: usedLLM
      ? `LLM-Revision (${mode}${profile ? `, Profil: ${profile.name}` : ""})`
      : "Lokale Straffung (Provider nicht erreichbar)",
  });

  return {
    chapterId,
    mode,
    content: revised,
    beforeWords,
    afterWords,
    beforeFillerRatio: beforeFiller,
    afterFillerRatio: afterFiller,
    usedLLM,
    revisionId: rec.id,
  };
}

/** Führt die Revision über den konfigurierten Provider aus (withRetry). */
async function reviseWithLLM(
  mode: RevisionMode,
  content: string,
  profile: StyleProfile | null,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const prompt = buildRevisionPrompt(mode, content, profile);
  const messages = buildMessages(prompt, settings, [{ role: "system", content: revisionSystem(mode) }]);

  const chunks: string[] = [];
  await withRetry(async (attempt, isJsonRetry) => {
    void attempt;
    void isJsonRetry;
    chunks.length = 0;
    for await (const token of provider.chat(messages, {
      model: settings.model,
      temperature: mode === "stil" ? 0.6 : 0.5,
      maxTokens: 8192,
    })) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      chunks.push(token);
    }
    if (!chunks.join("").trim()) {
      throw new Error("Leere Antwort vom Provider (JSON/Retry-Kandidat).");
    }
  }, signal);

  return { text: chunks.join("").trim(), model: settings.model };
}

/** Holt ein Kapitel inkl. Historie — für das Review-UI. */
export async function loadChapterForReview(chapterId: string): Promise<{ chapter: Chapter; revisions: RevisionRecord[] } | null> {
  const chapter = await getChapterDecrypted(chapterId);
  if (!chapter) return null;
  return { chapter, revisions: listRevisions(chapterId) };
}