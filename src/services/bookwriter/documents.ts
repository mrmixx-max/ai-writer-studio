// Bookwriter: Dokumentenverwaltung mit RAG.
//
// Ablauf: Dokument hochladen → Chunken → in DB speichern → Suche über
// Kapitel-Metadaten → relevante Passagen ins Kapitel-Prompt einspeisen.

import { getDb, persist } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import { tokenize, buildPosting, serializePosting } from "@/services/knowledge/lexical";
import type { BookwriterDocument } from "@/types/bookwriter";

const DOC_COLS =
  "id, project_id, title, file_type, file_name, content, chunk_count, created_at";

function rowToDoc(v: unknown[]): BookwriterDocument {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    title: v[2] as string,
    fileType: v[3] as string,
    fileName: v[4] as string,
    content: v[5] as string,
    chunkCount: Number(v[6]),
    createdAt: Number(v[7]),
  };
}

/** Alle Dokumente eines Projekts. */
export function listDocuments(projectId: string): BookwriterDocument[] {
  const res = getDb().exec(
    `SELECT ${DOC_COLS} FROM bookwriter_documents WHERE project_id = ? ORDER BY created_at DESC`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToDoc) : [];
}

/** Ein Dokument laden. */
export function getDocument(id: string): BookwriterDocument | null {
  const res = getDb().exec(`SELECT ${DOC_COLS} FROM bookwriter_documents WHERE id = ?`, [id]);
  return res.length ? rowToDoc(res[0].values[0]) : null;
}

/** Dokument löschen. */
export async function deleteDocument(id: string): Promise<void> {
  getDb().run("DELETE FROM bookwriter_documents WHERE id = ?", [id]);
  await persist();
}

export interface AddDocumentInput {
  projectId: string;
  title: string;
  fileType: string;
  fileName: string;
  content: string;
}

/**
 * Speichert ein Dokument und chunkt es.
 * Wirft nicht — Fehler landen als Fehlerobjekt.
 */
export async function addDocument(input: AddDocumentInput): Promise<{
  doc: BookwriterDocument | null;
  chunks: number;
  error: string | null;
}> {
  try {
    const chunks = chunkText(input.content);
    const doc: BookwriterDocument = {
      id: uid("bdoc"),
      projectId: input.projectId,
      title: input.title,
      fileType: input.fileType,
      fileName: input.fileName,
      content: input.content,
      chunkCount: chunks.length,
      createdAt: Date.now(),
    };

    getDb().exec(
      `INSERT INTO bookwriter_documents (${DOC_COLS}) VALUES (?,?,?,?,?,?,?,?)`,
      [
        doc.id, doc.projectId, doc.title, doc.fileType, doc.fileName,
        doc.content, doc.chunkCount, doc.createdAt,
      ],
    );
    await persist();

    return { doc, chunks: chunks.length, error: null };
  } catch (e) {
    return { doc: null, chunks: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface DocChunk {
  text: string;
  startChar: number;
  endChar: number;
  termFreq: string;
}

/** Chunkt Text in überlappende Segmente (~500 Tokens). */
function chunkText(text: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  const maxLen = 1500;
  const overlap = 200;

  let pos = 0;
  while (pos < text.length) {
    const end = Math.min(pos + maxLen, text.length);
    const chunk = text.slice(pos, end);

    const posting = buildPosting(chunk);

    chunks.push({
      text: chunk,
      startChar: pos,
      endChar: end,
      termFreq: serializePosting(posting),
    });

    if (end >= text.length) break;
    pos += maxLen - overlap;
  }

  return chunks;
}

export interface RagHit {
  docId: string;
  docTitle: string;
  text: string;
  startChar: number;
  score: number;
}

/**
 * BM25-Suche über Dokument-Chunks.
 * Sucht nach relevanten Passagen für ein Kapitel.
 */
export function searchDocuments(
  projectId: string,
  query: string,
  limit = 4,
): RagHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const allChunks: Array<{
    docId: string;
    docTitle: string;
    text: string;
    startChar: number;
    termFreq: Record<string, number>;
    length: number;
  }> = [];

  for (const doc of listDocuments(projectId)) {
    // Chunks rekonstruieren aus dem vollen Text (einfacher Ansatz)
    const chunks = chunkText(doc.content);
    for (const c of chunks) {
      allChunks.push({
        docId: doc.id,
        docTitle: doc.title,
        text: c.text,
        startChar: c.startChar,
        termFreq: JSON.parse(c.termFreq).tf,
        length: c.text.length,
      });
    }
  }

  if (allChunks.length === 0) return [];

  // BM25-Scoring
  const avgLen = allChunks.reduce((s, c) => s + c.length, 0) / allChunks.length;
  const N = allChunks.length;
  const k1 = 1.2;
  const b = 0.75;

  const df: Record<string, number> = {};
  for (const token of tokens) {
    df[token] = allChunks.filter((c) => c.termFreq[token] > 0).length;
  }

  const scored = allChunks.map((chunk) => {
    let score = 0;
    for (const token of tokens) {
      const tf = chunk.termFreq[token] || 0;
      const idf = Math.log((N - (df[token] || 0) + 0.5) / ((df[token] || 0) + 0.5) + 1);
      const norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunk.length / avgLen)));
      score += idf * norm;
    }
    return { ...chunk, score };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({
      docId: c.docId,
      docTitle: c.docTitle,
      text: c.text,
      startChar: c.startChar,
      score: c.score,
    }));
}

/**
 * Formatiert RAG-Treffer als Rechercheergebnis für das Kapitel-Prompt.
 */
export function formatRagContext(hits: RagHit[]): string {
  if (hits.length === 0) return "";
  return hits
    .map((h, i) => `[Quelle ${i + 1}: ${h.docTitle}]\n${h.text}\n`)
    .join("\n");
}
