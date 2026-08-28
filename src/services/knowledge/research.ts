// Research-Service: Quellenverwaltung, Zitate, Forschungsnotizen, Web-Clips.
//
// Reines CRUD über die Tabellen aus Migration 015 (research_*).
// Keine UI-Logik — die Komponenten in src/components/Research/ sind darstellend.
import { getDb, persist } from "@/services/db";
import type {
  ResearchSource,
  ResearchSourceKind,
  ResearchQuote,
  ResearchNote,
  ResearchClip,
  ExtractedPage,
} from "@/types/research";
import { uid } from "./util";

// ---------------------------------------------------------------------------
// Hilfs-Rowlayer
// ---------------------------------------------------------------------------

function str(v: unknown): string {
  return (v ?? "") as string;
}
function num(v: unknown): number {
  return Number(v ?? 0);
}

// ---------------------------------------------------------------------------
// Quellenverwaltung (Bücher, Artikel, Websites)
// ---------------------------------------------------------------------------

const SOURCE_COLS =
  "id, project_id, kind, title, author, year, publisher, url, isbn, notes, tags, created_at, updated_at";

function rowToSource(v: unknown[]): ResearchSource {
  return {
    id: str(v[0]),
    projectId: str(v[1]),
    kind: str(v[2]) as ResearchSourceKind,
    title: str(v[3]),
    author: str(v[4]),
    year: str(v[5]),
    publisher: str(v[6]),
    url: str(v[7]),
    isbn: str(v[8]),
    notes: str(v[9]),
    tags: str(v[10]),
    createdAt: num(v[11]),
    updatedAt: num(v[12]),
  };
}

export function listResearchSources(projectId: string, kind?: ResearchSourceKind): ResearchSource[] {
  const res = kind
    ? getDb().exec(
        `SELECT ${SOURCE_COLS} FROM research_sources WHERE project_id = ? AND kind = ? ORDER BY title`,
        [projectId, kind],
      )
    : getDb().exec(
        `SELECT ${SOURCE_COLS} FROM research_sources WHERE project_id = ? ORDER BY title`,
        [projectId],
      );
  return res.length ? res[0].values.map(rowToSource) : [];
}

export function getResearchSource(id: string): ResearchSource | null {
  const res = getDb().exec(`SELECT ${SOURCE_COLS} FROM research_sources WHERE id = ?`, [id]);
  return res.length ? rowToSource(res[0].values[0]) : null;
}

export interface ResearchSourceInput {
  projectId: string;
  kind: ResearchSourceKind;
  title: string;
  author?: string;
  year?: string;
  publisher?: string;
  url?: string;
  isbn?: string;
  notes?: string;
  tags?: string;
}

export async function upsertResearchSource(
  input: ResearchSourceInput,
  id?: string,
): Promise<ResearchSource> {
  const db = getDb();
  const now = Date.now();
  if (id) {
    db.run(
      `UPDATE research_sources SET kind=?, title=?, author=?, year=?, publisher=?, url=?, isbn=?, notes=?, tags=?, updated_at=? WHERE id=?`,
      [
        input.kind, input.title, input.author ?? "", input.year ?? "",
        input.publisher ?? "", input.url ?? "", input.isbn ?? "",
        input.notes ?? "", input.tags ?? "", now, id,
      ],
    );
    await persist();
    return getResearchSource(id)!;
  }
  const newId = uid("rsrc");
  db.run(
    `INSERT INTO research_sources (id, project_id, kind, title, author, year, publisher, url, isbn, notes, tags, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId, input.projectId, input.kind, input.title, input.author ?? "",
      input.year ?? "", input.publisher ?? "", input.url ?? "", input.isbn ?? "",
      input.notes ?? "", input.tags ?? "", now, now,
    ],
  );
  await persist();
  return getResearchSource(newId)!;
}

export async function deleteResearchSource(id: string): Promise<void> {
  const db = getDb();
  // Zitate behalten die Quellenangabe nicht mehr — sie verlieren den Verweis.
  db.run("UPDATE research_quotes SET source_id = NULL WHERE source_id = ?", [id]);
  db.run("DELETE FROM research_sources WHERE id = ?", [id]);
  await persist();
}

/** Formatiert eine Quelle als Zitat-Angabe (vereinfachtes Autor-Jahr-Titel-Schema). */
export function formatCitation(source: ResearchSource): string {
  const parts: string[] = [];
  if (source.author) parts.push(source.author);
  if (source.year) parts.push(`(${source.year})`);
  else parts.push("(o. J.)");
  parts.push(`${source.title}.`);
  if (source.kind === "book" && source.publisher) parts.push(`${source.publisher}.`);
  if (source.kind !== "book" && source.url) parts.push(source.url);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Zitate-Manager
// ---------------------------------------------------------------------------

const QUOTE_COLS = "id, project_id, source_id, text, page, comment, tags, created_at, updated_at";

function rowToQuote(v: unknown[]): ResearchQuote {
  return {
    id: str(v[0]),
    projectId: str(v[1]),
    sourceId: v[2] == null ? null : String(v[2]),
    text: str(v[3]),
    page: str(v[4]),
    comment: str(v[5]),
    tags: str(v[6]),
    createdAt: num(v[7]),
    updatedAt: num(v[8]),
  };
}

export function listResearchQuotes(projectId: string, sourceId?: string): ResearchQuote[] {
  const res = sourceId
    ? getDb().exec(
        `SELECT ${QUOTE_COLS} FROM research_quotes WHERE project_id = ? AND source_id = ? ORDER BY created_at DESC`,
        [projectId, sourceId],
      )
    : getDb().exec(
        `SELECT ${QUOTE_COLS} FROM research_quotes WHERE project_id = ? ORDER BY created_at DESC`,
        [projectId],
      );
  return res.length ? res[0].values.map(rowToQuote) : [];
}

export interface ResearchQuoteInput {
  projectId: string;
  sourceId?: string | null;
  text: string;
  page?: string;
  comment?: string;
  tags?: string;
}

export async function upsertResearchQuote(
  input: ResearchQuoteInput,
  id?: string,
): Promise<ResearchQuote> {
  const db = getDb();
  const now = Date.now();
  if (id) {
    db.run(
      `UPDATE research_quotes SET source_id=?, text=?, page=?, comment=?, tags=?, updated_at=? WHERE id=?`,
      [input.sourceId ?? null, input.text, input.page ?? "", input.comment ?? "", input.tags ?? "", now, id],
    );
    await persist();
    const res = getDb().exec(`SELECT ${QUOTE_COLS} FROM research_quotes WHERE id = ?`, [id]);
    return rowToQuote(res[0].values[0]);
  }
  const newId = uid("rquote");
  db.run(
    `INSERT INTO research_quotes (id, project_id, source_id, text, page, comment, tags, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [newId, input.projectId, input.sourceId ?? null, input.text, input.page ?? "", input.comment ?? "", input.tags ?? "", now, now],
  );
  await persist();
  const res = getDb().exec(`SELECT ${QUOTE_COLS} FROM research_quotes WHERE id = ?`, [newId]);
  return rowToQuote(res[0].values[0]);
}

export async function deleteResearchQuote(id: string): Promise<void> {
  getDb().run("DELETE FROM research_quotes WHERE id = ?", [id]);
  await persist();
}

/** Zitat mit Quellenangabe als vollständige Textzeile (z. B. zum Einfügen in den Editor). */
export function formatQuoteWithSource(
  quote: ResearchQuote,
  source: ResearchSource | null,
): string {
  if (!source) return `„${quote.text}“`;
  const loc = quote.page ? `, S. ${quote.page}` : "";
  return `„${quote.text}“ (${source.author || "Unbekannt"} ${source.year || "o. J."}${loc})`;
}

// ---------------------------------------------------------------------------
// Notizen-Manager (Forschungsnotizen)
// ---------------------------------------------------------------------------

const NOTE_COLS = "id, project_id, title, content, tags, created_at, updated_at";

function rowToNote(v: unknown[]): ResearchNote {
  return {
    id: str(v[0]),
    projectId: str(v[1]),
    title: str(v[2]),
    content: str(v[3]),
    tags: str(v[4]),
    createdAt: num(v[5]),
    updatedAt: num(v[6]),
  };
}

export function listResearchNotes(projectId: string): ResearchNote[] {
  const res = getDb().exec(
    `SELECT ${NOTE_COLS} FROM research_notes WHERE project_id = ? ORDER BY updated_at DESC`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToNote) : [];
}

export function getResearchNote(id: string): ResearchNote | null {
  const res = getDb().exec(`SELECT ${NOTE_COLS} FROM research_notes WHERE id = ?`, [id]);
  return res.length ? rowToNote(res[0].values[0]) : null;
}

export interface ResearchNoteInput {
  projectId: string;
  title: string;
  content?: string;
  tags?: string;
}

export async function upsertResearchNote(
  input: ResearchNoteInput,
  id?: string,
): Promise<ResearchNote> {
  const db = getDb();
  const now = Date.now();
  if (id) {
    db.run(
      `UPDATE research_notes SET title=?, content=?, tags=?, updated_at=? WHERE id=?`,
      [input.title, input.content ?? "", input.tags ?? "", now, id],
    );
    await persist();
    return getResearchNote(id)!;
  }
  const newId = uid("rnote");
  db.run(
    `INSERT INTO research_notes (id, project_id, title, content, tags, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [newId, input.projectId, input.title, input.content ?? "", input.tags ?? "", now, now],
  );
  await persist();
  return getResearchNote(newId)!;
}

export async function deleteResearchNote(id: string): Promise<void> {
  getDb().run("DELETE FROM research_notes WHERE id = ?", [id]);
  await persist();
}

// ---------------------------------------------------------------------------
// Web-Clipper
// ---------------------------------------------------------------------------

const CLIP_COLS = "id, project_id, url, title, content, selected_text, notes, clipped_at, updated_at";

function rowToClip(v: unknown[]): ResearchClip {
  return {
    id: str(v[0]),
    projectId: str(v[1]),
    url: str(v[2]),
    title: str(v[3]),
    content: str(v[4]),
    selectedText: str(v[5]),
    notes: str(v[6]),
    clippedAt: num(v[7]),
    updatedAt: num(v[8]),
  };
}

export function listResearchClips(projectId: string): ResearchClip[] {
  const res = getDb().exec(
    `SELECT ${CLIP_COLS} FROM research_clips WHERE project_id = ? ORDER BY clipped_at DESC`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToClip) : [];
}

export interface ResearchClipInput {
  projectId: string;
  url: string;
  title?: string;
  content?: string;
  selectedText?: string;
  notes?: string;
}

/** Legt einen Clip an — extrahiert bei Bedarf Titel/Inhalt aus der Seite. */
export async function saveResearchClip(input: ResearchClipInput): Promise<ResearchClip> {
  const db = getDb();
  const now = Date.now();
  let title = input.title ?? "";
  let content = input.content ?? "";
  if (!title || !content) {
    try {
      const page = await extractWebContent(input.url);
      title = title || page.title;
      content = content || page.content;
    } catch {
      // Netzwerk/CORS-Fehler: Clip trotzdem speichern — URL ist das Wichtigste.
    }
  }
  const newId = uid("rclip");
  db.run(
    `INSERT INTO research_clips (id, project_id, url, title, content, selected_text, notes, clipped_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [newId, input.projectId, input.url, title, content, input.selectedText ?? "", input.notes ?? "", now, now],
  );
  await persist();
  const res = getDb().exec(`SELECT ${CLIP_COLS} FROM research_clips WHERE id = ?`, [newId]);
  return rowToClip(res[0].values[0]);
}

export interface ResearchClipUpdate {
  title?: string;
  content?: string;
  selectedText?: string;
  notes?: string;
}

export async function updateResearchClip(id: string, patch: ResearchClipUpdate): Promise<ResearchClip> {
  const db = getDb();
  const now = Date.now();
  db.run(
    `UPDATE research_clips SET title=COALESCE(?, title), content=COALESCE(?, content),
       selected_text=COALESCE(?, selected_text), notes=COALESCE(?, notes), updated_at=? WHERE id=?`,
    [patch.title ?? null, patch.content ?? null, patch.selectedText ?? null, patch.notes ?? null, now, id],
  );
  await persist();
  const res = getDb().exec(`SELECT ${CLIP_COLS} FROM research_clips WHERE id = ?`, [id]);
  return rowToClip(res[0].values[0]);
}

export async function deleteResearchClip(id: string): Promise<void> {
  getDb().run("DELETE FROM research_clips WHERE id = ?", [id]);
  await persist();
}

// ---------------------------------------------------------------------------
// Web-Inhalts-Extraktion
// ---------------------------------------------------------------------------

/**
 * Lädt eine Seite und extrahiert Titel und lesbaren Haupttext.
 *
 * Hinweis zur Umgebung: Im Tauri-Webview unterliegt fetch() denselben
 * CORS-Regeln wie im Browser. Scheitert der Abruf, wirft die Funktion —
 * saveResearchClip speichert dann nur die URL weiter.
 */
export async function extractWebContent(url: string): Promise<ExtractedPage> {
  const res = await fetch(url, { headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} beim Abrufen von ${url}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Skripte/Styles entfernen, dann Text aus dem Hauptinhalt sammeln.
  doc.querySelectorAll("script, style, noscript, nav, footer, aside, iframe").forEach((el) => el.remove());
  const main =
    doc.querySelector("article") ??
    doc.querySelector("main") ??
    doc.querySelector("[role=main]") ??
    doc.body;
  const paragraphs = Array.from(main?.querySelectorAll("p, h1, h2, h3, li") ?? [])
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 40);
  const content = (paragraphs.length ? paragraphs : [main?.textContent ?? ""]).join("\n\n").trim();

  const metaTitle =
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ??
    doc.title ??
    url;

  return { title: metaTitle.trim(), content, url };
}
