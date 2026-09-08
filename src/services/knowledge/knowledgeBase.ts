// Lokale Wissensdatenbank (Chromadb-ähnlich, vollständig offline).
//
// Eigenständiger In-Memory-Store mit CRUD, TF-IDF-Ranking und
// Markdown-Im-/Export. Ergänzt das projektgebundene RAG-System
// (sources/indexer/retrieval), ersetzt es nicht: Dort liegt die
// Kapitel-/Fragment-Indexierung, hier schnelle Notiz-Einträge ohne DB.

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  source?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SearchQuery {
  text: string;
  tags?: string[];
  limit: number;
}

export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
}

type NewEntry = Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt">;

const store = new Map<string, KnowledgeEntry>();

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `kb-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Zerlegt Text in suchbare Tokens (klein, Unicode-Buchstaben/Ziffern, min. 2 Zeichen). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

function entryText(entry: KnowledgeEntry): string {
  return `${entry.title}\n${entry.content}`;
}

/** Nur für Tests: leert den Store. */
export function clearEntries(): void {
  store.clear();
}

export async function addEntry(entry: NewEntry): Promise<KnowledgeEntry> {
  const now = Date.now();
  const created: KnowledgeEntry = {
    ...entry,
    tags: [...entry.tags],
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  store.set(created.id, created);
  return { ...created, tags: [...created.tags] };
}

export async function updateEntry(
  id: string,
  updates: Partial<KnowledgeEntry>,
): Promise<KnowledgeEntry> {
  const existing = store.get(id);
  if (!existing) throw new Error(`KnowledgeEntry nicht gefunden: ${id}`);
  // id/createdAt sind unveränderlich.
  const { id: _id, createdAt: _created, ...rest } = updates; // eslint-disable-line @typescript-eslint/no-unused-vars
  const updated: KnowledgeEntry = {
    ...existing,
    ...rest,
    tags: rest.tags ? [...rest.tags] : [...existing.tags],
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  store.set(id, updated);
  return { ...updated, tags: [...updated.tags] };
}

export async function deleteEntry(id: string): Promise<void> {
  if (!store.delete(id)) throw new Error(`KnowledgeEntry nicht gefunden: ${id}`);
}

export async function getAllEntries(): Promise<KnowledgeEntry[]> {
  return [...store.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((e) => ({ ...e, tags: [...e.tags] }));
}

/**
 * TF-IDF-Suche über Titel + Content.
 * Score: Summe über Query-Terme von tf * idf (idf mit +1 geglättet).
 * Optionaler Tag-Filter (mind. ein Tag muss übereinstimmen), Limit via query.limit.
 */
export async function search(query: SearchQuery): Promise<SearchResult[]> {
  const queryTerms = tokenize(query.text);
  if (queryTerms.length === 0) return [];

  let candidates = [...store.values()];
  if (query.tags && query.tags.length > 0) {
    const wanted = new Set(query.tags.map((t) => t.toLowerCase()));
    candidates = candidates.filter((e) => e.tags.some((t) => wanted.has(t.toLowerCase())));
  }
  if (candidates.length === 0) return [];

  // Dokumentfrequenzen über alle Kandidaten.
  const docFreq = new Map<string, number>();
  const docsTerms = new Map<string, Map<string, number>>();
  for (const entry of candidates) {
    const counts = termCounts(tokenize(entryText(entry)));
    docsTerms.set(entry.id, counts);
    for (const term of counts.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const n = candidates.length;
  const results: SearchResult[] = [];
  for (const entry of candidates) {
    const counts = docsTerms.get(entry.id)!;
    let score = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term) ?? 0;
      if (tf === 0) continue;
      const df = docFreq.get(term) ?? 1;
      score += tf * (Math.log(n / df) + 1);
    }
    if (score > 0) results.push({ entry: { ...entry, tags: [...entry.tags] }, score });
  }

  results.sort((a, b) => b.score - a.score);
  const limit = Math.max(1, Math.floor(query.limit));
  return results.slice(0, limit);
}

/** Exportiert alle Einträge als Markdown (ein `## `-Abschnitt je Eintrag, `---` als Trenner). */
export async function exportToMarkdown(): Promise<string> {
  const entries = await getAllEntries();
  return entries
    .map((e) => {
      const meta: string[] = [];
      if (e.source) meta.push(`Quelle: ${e.source}`);
      if (e.tags.length > 0) meta.push(`Tags: ${e.tags.join(", ")}`);
      meta.push(`ID: ${e.id}`);
      return `## ${e.title}\n\n*${meta.join(" · ")}*\n\n${e.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Importiert Einträge aus Markdown (Format von exportToMarkdown).
 * Gibt die Anzahl importierter Einträge zurück. Fremde IDs werden ignoriert
 * (jeder Import erzeugt neue IDs), Titel/Content sind Pflicht.
 */
export async function importFromMarkdown(markdown: string): Promise<number> {
  const sections = markdown.split(/^---\s*$/m);
  let count = 0;
  for (const section of sections) {
    const lines = section.trim().split("\n");
    if (lines.length === 0 || lines[0].trim() === "") continue;
    const titleMatch = /^##\s+(.+)\s*$/.exec(lines[0].trim());
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    // Optionale Meta-Zeile unter der Überschrift (Leerzeilen erlaubt):
    // *Quelle: x · Tags: a, b · ID: ...*
    let cursor = 1;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
    let source: string | undefined;
    let tags: string[] = [];
    let bodyStart = cursor;
    if (cursor < lines.length && /^\*.*\*$/.test(lines[cursor].trim())) {
      const meta = lines[cursor].trim().replace(/^\*|\*$/g, "");
      for (const part of meta.split("·")) {
        const [key, ...rest] = part.split(":");
        const value = rest.join(":").trim();
        if (/^quelle$/i.test(key.trim())) source = value || undefined;
        if (/^tags$/i.test(key.trim()) && value) {
          tags = value.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }
      bodyStart = cursor + 1;
    }
    const content = lines.slice(bodyStart).join("\n").trim();
    if (!title || !content) continue;
    await addEntry({ title, content, source, tags });
    count += 1;
  }
  return count;
}
