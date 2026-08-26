// Sync: spiegelt Projektentitäten als Wissensquellen.
//
// Aufgabe: Kapitel, Fragmente, Figuren-/Ortsprofile und Notizen als
// knowledge_sources abbilden und bei Änderungen auf "stale" setzen.
// Läuft rein lokal, ohne LLM — deshalb immer verfügbar.

import { listChapters, getChapter } from "@/services/project";
import { listFragments } from "@/services/fragment";
import { tiptapToText } from "@/services/editor/count";
import { upsertSource, listSources, deleteSource } from "./sources";
import {
  listCharacters, listLocations, listNotes,
  characterToText, locationToText, noteToText,
} from "./profiles";
import type { KnowledgeSource } from "@/types/knowledge";

export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
  /** Quellen, die nach dem Sync neu indexiert werden müssen. */
  staleCount: number;
}

/**
 * Synchronisiert alle Wissensquellen eines Projekts.
 * Idempotent: mehrfacher Aufruf erzeugt keine Duplikate.
 */
export async function syncProjectSources(projectId: string): Promise<SyncResult> {
  const before = listSources(projectId);
  const beforeIds = new Set(before.map((s) => s.id));
  const seen = new Set<string>();
  let created = 0;
  let updated = 0;

  // --- Kapitel ---
  const chapters = listChapters(projectId);
  for (const ch of chapters) {
    const full = getChapter(ch.id);
    const json = full?.content ?? ch.content ?? "{}";
    // Kapitelinhalt als TipTap-JSON übernehmen; der Indexer chunkt strukturorientiert.
    const src = await upsertSource({
      projectId,
      sourceType: "chapter",
      refId: ch.id,
      title: ch.title,
      content: json,
    });
    seen.add(src.id);
    if (beforeIds.has(src.id)) updated++; else created++;
  }

  // --- Fragmente (pro Kapitel) ---
  for (const ch of chapters) {
    const frags = listFragments(ch.id);
    for (const f of frags) {
      if (!f.content.trim() && !f.title.trim()) continue;
      const meta: string[] = [];
      if (f.speaker) meta.push(`Sprecher: ${f.speaker}`);
      if (f.tone) meta.push(`Ton: ${f.tone}`);
      if (f.timeRef) meta.push(`Zeit: ${f.timeRef}`);
      const body = meta.length ? `${meta.join(" · ")}\n\n${f.content}` : f.content;
      const src = await upsertSource({
        projectId,
        sourceType: "fragment",
        refId: f.id,
        title: `${ch.title} › ${f.title || "Fragment"}`,
        content: `# ${f.title || "Fragment"}\n\n${body}`,
      });
      seen.add(src.id);
      if (beforeIds.has(src.id)) updated++; else created++;
    }
  }

  // --- Figurenprofile ---
  for (const c of listCharacters(projectId)) {
    const src = await upsertSource({
      projectId,
      sourceType: "character",
      refId: c.id,
      title: `Figur: ${c.name}`,
      content: characterToText(c),
    });
    seen.add(src.id);
    if (beforeIds.has(src.id)) updated++; else created++;
  }

  // --- Ortsprofile ---
  for (const l of listLocations(projectId)) {
    const src = await upsertSource({
      projectId,
      sourceType: "location",
      refId: l.id,
      title: `Ort: ${l.name}`,
      content: locationToText(l),
    });
    seen.add(src.id);
    if (beforeIds.has(src.id)) updated++; else created++;
  }

  // --- Notizen ---
  for (const n of listNotes(projectId)) {
    const src = await upsertSource({
      projectId,
      sourceType: "note",
      refId: n.id,
      title: n.title,
      content: noteToText(n),
      tags: n.tags,
    });
    seen.add(src.id);
    if (beforeIds.has(src.id)) updated++; else created++;
  }

  // --- Verwaiste Quellen entfernen ---
  // Referenztexte (sourceType "reference") sind manuell gepflegt und werden nie automatisch gelöscht.
  let removed = 0;
  for (const s of before) {
    if (s.sourceType === "reference") continue;
    if (!seen.has(s.id)) {
      await deleteSource(s.id);
      removed++;
    }
  }

  const after = listSources(projectId);
  const staleCount = after.filter((s) => s.status !== "indexed").length;

  return { created, updated, removed, staleCount };
}

/**
 * Synchronisiert nur ein Kapitel. Für den Button „Nur dieses Kapitel indexieren"
 * und für Autosave-getriebene Stale-Markierung.
 */
export async function syncChapterSource(
  projectId: string,
  chapterId: string,
): Promise<KnowledgeSource | null> {
  const ch = getChapter(chapterId);
  if (!ch) return null;
  return upsertSource({
    projectId,
    sourceType: "chapter",
    refId: ch.id,
    title: ch.title,
    content: ch.content ?? "{}",
  });
}

/** Extrahiert den Plaintext eines Kapitels — für Diagnostik und Preflight. */
export function chapterPlainText(chapterId: string): string {
  const ch = getChapter(chapterId);
  if (!ch) return "";
  try {
    return tiptapToText(JSON.parse(ch.content || "{}"));
  } catch {
    return ch.content ?? "";
  }
}
