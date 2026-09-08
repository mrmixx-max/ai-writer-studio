// Volltextsuche über alle Projekte (Sprint 24, Agent 2).
// Durchsucht Projektnamen, Kapiteltitel, Kapitelinhalte sowie
// Synopsis/Purpose (Scope "notes" — Kapitel haben kein separates
// Notizfeld; Synopsis + Purpose sind die notizartigen Metadaten).
// Ersetzen persistiert über den Projekt-Service (inkl. Verschlüsselung
// für Inhalte), Verlauf liegt in localStorage (guards für Node-Tests).
import {
  listProjects,
  listChapters,
  getChapter,
  updateChapter,
  renameChapter,
  renameProject,
  updateChapterFields,
} from "@/services/project";

export interface SearchQuery {
  text: string;
  projects?: string[]; // leer = alle Projekte
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  scope: "title" | "content" | "notes" | "all";
}

export interface SearchResult {
  projectId: string;
  projectTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchStats {
  totalResults: number;
  projectCount: number;
  duration: number; // ms
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Kompiliert den Suchausdruck; null bei leerem Text oder ungültigem Regex. */
export function buildSearchRegex(query: SearchQuery, global = true): RegExp | null {
  if (!query.text) return null;
  try {
    let pattern = query.regex ? query.text : escapeRegExp(query.text);
    if (query.wholeWord) pattern = `\\b(?:${pattern})\\b`;
    const flags = query.caseSensitive ? (global ? "g" : "") : global ? "gi" : "i";
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

type FieldKind = "projectName" | "title" | "content" | "synopsis" | "purpose";

interface FieldRef {
  kind: FieldKind;
  text: string;
  multiline: boolean;
}

function scopeIncludes(kind: FieldKind, scope: SearchQuery["scope"]): boolean {
  if (scope === "all") return true;
  if (scope === "title") return kind === "projectName" || kind === "title";
  if (scope === "content") return kind === "content";
  return kind === "synopsis" || kind === "purpose"; // notes
}

interface ChapterLike {
  id: string;
  title: string;
  content: string;
  synopsis?: string;
  purpose?: string;
}

function chapterFields(ch: ChapterLike, scope: SearchQuery["scope"]): FieldRef[] {
  const fields: FieldRef[] = [];
  const push = (kind: FieldKind, text: string | undefined, multiline: boolean) => {
    if (text === undefined || text === null) return;
    if (!scopeIncludes(kind, scope)) return;
    fields.push({ kind, text, multiline });
  };
  push("title", ch.title, false);
  push("content", ch.content, true);
  push("synopsis", ch.synopsis, false);
  push("purpose", ch.purpose, false);
  return fields;
}

/** Alle Treffer eines Feldes (zeilenweise; matchStart/End relativ zur Zeile). */
function scanField(
  text: string,
  multiline: boolean,
  rx: RegExp,
  make: (line: number, column: number, lineText: string, start: number, end: number) => SearchResult,
): SearchResult[] {
  const out: SearchResult[] = [];
  const lines = multiline ? text.split("\n") : [text];
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    // Leeres Match (z. B. Regex "a*") darf nicht endlos laufen.
    while ((m = rx.exec(lineText)) !== null) {
      const matched = m[0];
      out.push(make(i + 1, m.index + 1, lineText, m.index, m.index + matched.length));
      if (matched.length === 0) rx.lastIndex++;
      if (rx.lastIndex > lineText.length) break;
    }
  }
  return out;
}

// ---- Verlauf (Recent Searches) ----

const RECENT_KEY = "ai-writer-studio:recent-searches";
const MAX_RECENT = 10;
let recentCache: string[] | null = null;

function loadRecentSync(): string[] {
  if (recentCache !== null) return [...recentCache];
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(RECENT_KEY) : null;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    recentCache = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    recentCache = [];
  }
  return [...(recentCache ?? [])];
}

function saveRecentSync(list: string[]): void {
  recentCache = [...list];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    }
  } catch {
    // Storage voll/blockiert — Verlauf bleibt In-Memory, Suche läuft weiter.
  }
}

function pushRecent(text: string): void {
  if (!text) return;
  const list = loadRecentSync().filter((s) => s !== text);
  list.unshift(text);
  saveRecentSync(list.slice(0, MAX_RECENT));
}

export async function getRecentSearches(): Promise<string[]> {
  return loadRecentSync();
}

export async function clearRecentSearches(): Promise<void> {
  saveRecentSync([]);
}

// ---- Suche ----

export async function search(
  query: SearchQuery,
): Promise<{ results: SearchResult[]; stats: SearchStats }> {
  const start = Date.now();
  const empty = { results: [] as SearchResult[], stats: { totalResults: 0, projectCount: 0, duration: 0 } };
  const rx = buildSearchRegex(query, true);
  if (!rx) {
    empty.stats.duration = Date.now() - start;
    return empty;
  }
  pushRecent(query.text);

  const results: SearchResult[] = [];
  const seenProjects = new Set<string>();
  const filter = query.projects && query.projects.length > 0 ? new Set(query.projects) : null;

  let projects;
  try {
    projects = listProjects();
  } catch {
    empty.stats.duration = Date.now() - start;
    return empty;
  }

  for (const project of projects) {
    if (filter && !filter.has(project.id)) continue;
    // Projektname (titel-Scope).
    if (scopeIncludes("projectName", query.scope)) {
      for (const r of scanField(project.name, false, rx, (line, column, text, s, e) => ({
        projectId: project.id,
        projectTitle: project.name,
        line,
        column,
        text,
        matchStart: s,
        matchEnd: e,
      }))) {
        results.push(r);
        seenProjects.add(project.id);
      }
    }
    let chapters;
    try {
      chapters = listChapters(project.id);
    } catch {
      continue;
    }
    for (const ch of chapters) {
      const full = getChapter(ch.id) ?? ch;
      const like: ChapterLike = {
        id: full.id,
        title: full.title,
        content: full.content,
        synopsis: full.synopsis,
        purpose: full.purpose,
      };
      for (const field of chapterFields(like, query.scope)) {
        const kind = field.kind;
        for (const r of scanField(field.text, field.multiline, rx, (line, column, text, s, e) => ({
          projectId: project.id,
          projectTitle: project.name,
          chapterId: full.id,
          chapterTitle: full.title,
          line: kind === "content" ? line : 1,
          column,
          text,
          matchStart: s,
          matchEnd: e,
        }))) {
          results.push(r);
          seenProjects.add(project.id);
        }
      }
    }
  }

  return {
    results,
    stats: {
      totalResults: results.length,
      projectCount: seenProjects.size,
      duration: Date.now() - start,
    },
  };
}

// ---- Ersetzen ----

async function persistField(
  projectId: string,
  chapterId: string | undefined,
  kind: FieldKind,
  newText: string,
): Promise<void> {
  if (kind === "projectName") {
    await renameProject(projectId, newText);
    return;
  }
  if (!chapterId) return;
  if (kind === "title") await renameChapter(chapterId, newText);
  else if (kind === "content") await updateChapter(chapterId, newText);
  else if (kind === "synopsis") await updateChapterFields(chapterId, { synopsis: newText });
  else await updateChapterFields(chapterId, { purpose: newText });
}

interface LocatedField {
  projectId: string;
  projectName: string;
  chapterId?: string;
  kind: FieldKind;
  text: string;
}

/** Felder in exakt derselben Reihenfolge wie search() — ersetzt das erste Trefferfeld. */
function locateFields(
  projectId: string,
  projectName: string,
  ch: ChapterLike | null,
  scope: SearchQuery["scope"],
): LocatedField[] {
  const out: LocatedField[] = [];
  if (scopeIncludes("projectName", scope)) {
    out.push({ projectId, projectName, kind: "projectName", text: projectName });
  }
  if (ch) {
    for (const f of chapterFields(ch, scope)) {
      out.push({ projectId, projectName, chapterId: ch.id, kind: f.kind, text: f.text });
    }
  }
  return out;
}

function iterProjects(query: SearchQuery): { id: string; name: string }[] {
  const filter = query.projects && query.projects.length > 0 ? new Set(query.projects) : null;
  try {
    const all = listProjects();
    return filter ? all.filter((p) => filter.has(p.id)) : all;
  } catch {
    return [];
  }
}

/** Ersetzt nur das erste Vorkommen (in search()-Reihenfolge). Gibt 1 oder 0 zurück. */
export async function replace(query: SearchQuery, replacement: string): Promise<number> {
  const rxFirst = buildSearchRegex(query, false);
  if (!rxFirst) return 0;
  pushRecent(query.text);
  for (const project of iterProjects(query)) {
    const chapterIds: ChapterLike[] = (() => {
      try {
        return listChapters(project.id).map((c) => {
          const full = getChapter(c.id) ?? c;
          return {
            id: full.id,
            title: full.title,
            content: full.content,
            synopsis: full.synopsis,
            purpose: full.purpose,
          } as ChapterLike;
        });
      } catch {
        return [];
      }
    })();
    // Projektname zuerst, dann Kapitel für Kapitel.
    const candidates: { ch: ChapterLike | null }[] = [{ ch: null }, ...chapterIds.map((ch) => ({ ch }))];
    for (const { ch } of candidates) {
      for (const field of locateFields(project.id, project.name, ch, query.scope)) {
        rxFirst.lastIndex = 0;
        if (!rxFirst.test(field.text)) continue;
        rxFirst.lastIndex = 0;
        const next = field.text.replace(rxFirst, replacement);
        await persistField(project.id, field.chapterId, field.kind, next);
        return 1;
      }
    }
  }
  return 0;
}

/** Ersetzt alle Vorkommen in allen Projekten. Gibt die Anzahl Ersetzungen zurück. */
export async function replaceAll(query: SearchQuery, replacement: string): Promise<number> {
  const rxCount = buildSearchRegex(query, true);
  const rxReplace = buildSearchRegex(query, true);
  if (!rxCount || !rxReplace) return 0;
  pushRecent(query.text);
  let total = 0;
  for (const project of iterProjects(query)) {
    let chapters: ChapterLike[];
    try {
      chapters = listChapters(project.id).map((c) => {
        const full = getChapter(c.id) ?? c;
        return {
          id: full.id,
          title: full.title,
          content: full.content,
          synopsis: full.synopsis,
          purpose: full.purpose,
        } as ChapterLike;
      });
    } catch {
      continue;
    }
    const candidates: { ch: ChapterLike | null }[] = [{ ch: null }, ...chapters.map((ch) => ({ ch }))];
    for (const { ch } of candidates) {
      for (const field of locateFields(project.id, project.name, ch, query.scope)) {
        rxCount.lastIndex = 0;
        let n = 0;
        let m: RegExpExecArray | null;
        while ((m = rxCount.exec(field.text)) !== null) {
          n++;
          if (m[0].length === 0) rxCount.lastIndex++;
          if (rxCount.lastIndex > field.text.length) break;
        }
        if (n === 0) continue;
        rxReplace.lastIndex = 0;
        const next = field.text.replace(rxReplace, replacement);
        await persistField(project.id, field.chapterId, field.kind, next);
        total += n;
      }
    }
  }
  return total;
}
