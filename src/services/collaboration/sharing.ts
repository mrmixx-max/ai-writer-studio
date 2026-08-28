// Sharing-Service: Projekt als portierbare Datei teilen (.json-Bundle) und
// Export mit Kommentaren (Anhang "Anmerkungen" an den Export anhängen).
import JSZip from "jszip";
import { getDb, persist } from "@/services/db";
import { createProject, createChapter, listChapters } from "@/services/project";
import { listComments, listChanges, listSuggestions } from "@/services/collaboration";
import type { Block } from "@/services/export";
import type { Project } from "@/types/project";
import type { Comment, TrackChange, Suggestion } from "@/types/collaboration";

// --- Export mit Kommentaren -------------------------------------------------

/** Baut den Anhang "Anmerkungen" als Blöcke (für md/txt/docx/pdf-Export). */
export function buildCommentAppendix(chapterId: string, chapterTitle?: string): Block[] {
  const comments = listComments(chapterId);
  if (comments.length === 0) return [];
  const blocks: Block[] = [];
  if (chapterTitle) blocks.push({ type: "h2", text: `Anmerkungen — ${chapterTitle}` });
  else blocks.push({ type: "h2", text: "Anmerkungen" });
  for (const c of comments) {
    const status = c.status === "resolved" ? " [erledigt]" : "";
    blocks.push({ type: "quote", text: `„${truncate(c.anchorText, 80)}" — ${c.author}${status}` });
    blocks.push({ type: "p", text: c.body });
  }
  return blocks;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// --- Projekt-Sharing (.json-Bundle) -----------------------------------------

/** Struktur eines geteilten Projekt-Bundles (.awshare). */
export interface ShareBundle {
  format: "ai-writer-studio/share";
  version: 1;
  exportedAt: number;
  project: { name: string };
  chapters: { id: string; title: string; orderIndex: number; content: string }[];
  comments: Comment[];
  changes: TrackChange[];
  suggestions: Suggestion[];
}

/** Sammelt das gesamte Projekt inkl. Collaborations-Daten als Bundle. */
export function buildProjectBundle(project: Project): ShareBundle {
  const chapters = listChapters(project.id);
  const comments: Comment[] = [];
  const changes: TrackChange[] = [];
  const suggestions: Suggestion[] = [];
  for (const ch of chapters) {
    comments.push(...listComments(ch.id));
    changes.push(...listChanges(ch.id));
    suggestions.push(...listSuggestions(ch.id));
  }
  return {
    format: "ai-writer-studio/share",
    version: 1,
    exportedAt: Date.now(),
    project: { name: project.name },
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, orderIndex: c.orderIndex, content: c.content })),
    comments,
    changes,
    suggestions,
  };
}

/** Lädt ein Bundle als .awshare-Datei herunter (Teilen via Dateiaustausch). */
export async function shareProject(project: Project): Promise<void> {
  const bundle = buildProjectBundle(project);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(project.name)}.awshare.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "projekt";
}

/** Teilt das Projekt als ZIP-Archiv (Bundle + MD-Export mit Kommentaren). */
export async function shareProjectAsZip(project: Project, mdWithComments: string): Promise<void> {
  const zip = new JSZip();
  zip.file("share.json", JSON.stringify(buildProjectBundle(project), null, 2));
  zip.file("manuskript-mit-kommentaren.md", mdWithComments);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(project.name)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ergebnis eines Bundle-Imports. */
export interface ImportResult {
  projectId: string;
  chapters: number;
  comments: number;
  changes: number;
  suggestions: number;
}

/** Importiert ein geteiltes Bundle als neues Projekt (inkl. Collaborations-Daten). */
export async function importProjectBundle(json: string): Promise<ImportResult> {
  const bundle = JSON.parse(json) as ShareBundle;
  if (bundle.format !== "ai-writer-studio/share" || !Array.isArray(bundle.chapters)) {
    throw new Error("Keine gültige AI Writer Studio Share-Datei.");
  }
  const project = await createProject(`${bundle.project.name} (importiert)`);
  const chapterIdMap = new Map<string, string>();
  for (const ch of bundle.chapters) {
    const created = await createChapter(project.id, ch.title, ch.content);
    chapterIdMap.set(ch.id, created.id);
  }
  const db = getDb();
  for (const c of bundle.comments) {
    const newChapterId = chapterIdMap.get(c.chapterId);
    if (!newChapterId) continue;
    db.run(
      "INSERT INTO comments (id, chapter_id, anchor_start, anchor_end, anchor_text, author, body, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [c.id, newChapterId, c.anchorStart, c.anchorEnd, c.anchorText, c.author, c.body, c.status, c.createdAt],
    );
  }
  for (const ch of bundle.changes) {
    const newChapterId = chapterIdMap.get(ch.chapterId);
    if (!newChapterId) continue;
    db.run(
      "INSERT INTO track_changes (id, chapter_id, kind, position, text, replaced_text, author, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [ch.id, newChapterId, ch.kind, ch.position, ch.text, ch.replacedText, ch.author, ch.createdAt],
    );
  }
  for (const s of bundle.suggestions) {
    const newChapterId = chapterIdMap.get(s.chapterId);
    if (!newChapterId) continue;
    db.run(
      "INSERT INTO suggestions (id, chapter_id, kind, anchor_start, anchor_end, original_text, proposed_text, author, note, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [s.id, newChapterId, s.kind, s.anchorStart, s.anchorEnd, s.originalText, s.proposedText, s.author, s.note, s.status, s.createdAt],
    );
  }
  await persist();
  return {
    projectId: project.id,
    chapters: bundle.chapters.length,
    comments: bundle.comments.length,
    changes: bundle.changes.length,
    suggestions: bundle.suggestions.length,
  };
}
