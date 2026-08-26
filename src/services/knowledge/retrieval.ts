// Retrieval-Service: semantische, exakte und Hybrid-Suche über den Projektindex.
//
// Zentrale Regel dieses Moduls: Es wird NIEMALS stillschweigend degradiert.
// Jedes Ergebnis trägt `degraded` und `notice`, damit die UI dem Autor sagen kann,
// auf welcher Grundlage die Treffer entstanden sind.

import type { AppSettings } from "@/types/config";
import type {
  RetrievalResult, RetrievalHit, RetrievalStrategy, SearchMode, KnowledgeSourceType,
} from "@/types/knowledge";
import { embedOne, cosineSimilarity, deserializeEmbedding, probeEmbeddings } from "./embedding";
import { bm25Search, exactSearch, reciprocalRankFusion, deserializePosting, type Bm25Doc } from "./lexical";
import { listChunks, listChunksByType } from "./chunks";
import { listSources } from "./sources";

export interface SearchOptions {
  mode?: SearchMode;
  limit?: number;
  /** Nur in diesen Quellentypen suchen. */
  sourceTypes?: KnowledgeSourceType[];
  /** Mindest-Score, unter dem Treffer verworfen werden. */
  minScore?: number;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_MIN_SCORE = 0.05;

/**
 * Durchsucht den Wissensindex eines Projekts.
 * Wirft nicht: bei fehlendem Embedding-Modell wird lexikalisch gesucht und das gemeldet.
 */
export async function searchKnowledge(
  projectId: string,
  query: string,
  settings: AppSettings,
  options: SearchOptions = {},
): Promise<RetrievalResult> {
  const mode = options.mode ?? "hybrid";
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const chunks = options.sourceTypes?.length
    ? listChunksByType(projectId, options.sourceTypes)
    : listChunks(projectId);

  if (!query.trim()) {
    return emptyResult(chunks.length, "Es wurde keine Suchanfrage angegeben.");
  }
  if (chunks.length === 0) {
    return emptyResult(0, "Der Wissensindex ist leer. Aktualisiere das Projektwissen, um die Suche zu nutzen.");
  }

  // Quellentitel für die Trefferanzeige
  const sourceTitles = new Map(listSources(projectId).map((s) => [s.id, s.title]));
  const byId = new Map(chunks.map((c) => [c.id, c]));

  const toHit = (id: string, score: number, via: RetrievalStrategy): RetrievalHit | null => {
    const c = byId.get(id);
    if (!c) return null;
    return {
      chunkId: c.id,
      sourceId: c.sourceId,
      sourceTitle: sourceTitles.get(c.sourceId) ?? "Unbekannte Quelle",
      sourceType: c.sourceType,
      headingPath: c.headingPath,
      text: c.text,
      score,
      via,
    };
  };

  // ---- Exakte Suche: kein Modell nötig ----
  if (mode === "exact") {
    const hits = exactSearch(query, chunks.map((c) => ({ id: c.id, text: c.text })), limit)
      .map((h) => toHit(h.id, h.score, "lexical"))
      .filter((h): h is RetrievalHit => h !== null);
    return {
      hits,
      strategyUsed: "lexical",
      degraded: false,
      notice: hits.length ? null : `Für „${query}" wurde keine exakte Übereinstimmung gefunden.`,
      totalChunksSearched: chunks.length,
    };
  }

  // ---- BM25 vorbereiten (wird in beiden verbleibenden Modi gebraucht) ----
  const bm25Docs: Bm25Doc[] = [];
  for (const c of chunks) {
    const p = deserializePosting(c.termFreq);
    if (p) bm25Docs.push({ id: c.id, posting: p });
  }
  const lexHits = bm25Search(query, bm25Docs, limit * 3);

  // ---- Embeddings besorgen ----
  const embedded = chunks.filter((c) => c.embedding);
  let queryVec: number[] | null = null;
  let embedNotice: string | null = null;

  if (embedded.length > 0) {
    try {
      queryVec = await embedOne(query, settings);
    } catch {
      const probe = await probeEmbeddings(settings);
      embedNotice = probe.notice;
      queryVec = null;
    }
  } else {
    embedNotice =
      "Für dieses Projekt liegen keine Embeddings vor. Es wird die lexikalische Suche verwendet. " +
      "Starte Ollama und aktualisiere das Projektwissen, um die semantische Suche zu aktivieren.";
  }

  // ---- Kein Vektor verfügbar → lexikalisch, ehrlich gemeldet ----
  if (!queryVec) {
    const hits = lexHits
      .filter((h) => h.score >= minScore)
      .slice(0, limit)
      .map((h) => toHit(h.id, h.score, "lexical"))
      .filter((h): h is RetrievalHit => h !== null);
    return {
      hits,
      strategyUsed: "lexical",
      degraded: true,
      notice: embedNotice,
      totalChunksSearched: chunks.length,
    };
  }

  // ---- Semantische Treffer ----
  const semScored: { id: string; score: number }[] = [];
  for (const c of embedded) {
    const vec = deserializeEmbedding(c.embedding);
    if (!vec) continue;
    const sim = cosineSimilarity(queryVec, vec);
    if (sim > 0) semScored.push({ id: c.id, score: sim });
  }
  semScored.sort((a, b) => b.score - a.score);
  const semTop = semScored.slice(0, limit * 3);

  const partialNotice =
    embedded.length < chunks.length
      ? `${chunks.length - embedded.length} von ${chunks.length} Abschnitten haben kein Embedding und wurden nur lexikalisch berücksichtigt.`
      : null;

  if (mode === "semantic") {
    const hits = semTop
      .filter((h) => h.score >= minScore)
      .slice(0, limit)
      .map((h) => toHit(h.id, h.score, "embedding"))
      .filter((h): h is RetrievalHit => h !== null);
    return {
      hits,
      strategyUsed: "embedding",
      degraded: false,
      notice: partialNotice,
      totalChunksSearched: embedded.length,
    };
  }

  // ---- Hybrid: Rangfusion aus beiden Signalen ----
  const fused = reciprocalRankFusion([semTop, lexHits.map((h) => ({ id: h.id, score: h.score }))], 60, limit);
  const semIds = new Set(semTop.slice(0, limit).map((s) => s.id));
  const hits = fused
    .filter((h) => h.score >= minScore)
    .map((h) => toHit(h.id, h.score, semIds.has(h.id) ? "embedding" : "lexical"))
    .filter((h): h is RetrievalHit => h !== null);

  return {
    hits,
    strategyUsed: "hybrid",
    degraded: false,
    notice: partialNotice,
    totalChunksSearched: chunks.length,
  };
}

function emptyResult(searched: number, notice: string): RetrievalResult {
  return { hits: [], strategyUsed: "lexical", degraded: false, notice, totalChunksSearched: searched };
}

/**
 * Formatiert Treffer als Kontextblock für einen LLM-Prompt.
 * Jeder Abschnitt trägt seine Quelle, damit das Modell zitieren kann
 * und der Autor die Herkunft nachvollzieht.
 */
export function formatContextBlock(result: RetrievalResult, maxChars = 6000): string {
  if (!result.hits.length) return "";
  const parts: string[] = [];
  let used = 0;
  for (let i = 0; i < result.hits.length; i++) {
    const h = result.hits[i];
    const label = h.headingPath ? `${h.sourceTitle} › ${h.headingPath}` : h.sourceTitle;
    const block = `[Quelle ${i + 1}: ${label}]\n${h.text}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

/** Kurze Quellenliste für die Anzeige unter einer KI-Antwort. */
export function formatSourceList(result: RetrievalResult): string[] {
  return result.hits.map((h, i) => {
    const label = h.headingPath ? `${h.sourceTitle} › ${h.headingPath}` : h.sourceTitle;
    return `${i + 1}. ${label} (${Math.round(h.score * 100)} %)`;
  });
}
