// Indexer: baut den Wissensindex eines Projekts auf.
//
// Ablauf pro Quelle: Chunking → (optional) Embedding → BM25-Posting → DB.
// Das BM25-Posting wird IMMER berechnet, auch wenn Embeddings verfügbar sind.
// Grund: Hybrid-Suche braucht beide Signale, und der Index bleibt nutzbar,
// wenn das Embedding-Modell später nicht mehr erreichbar ist.

import type { AppSettings } from "@/types/config";
import type { KnowledgeSource, RetrievalStrategy } from "@/types/knowledge";
import { chunkTiptap, chunkPlainText, type Chunk } from "./chunking";
import { probeEmbeddings, embedBatch, serializeEmbedding, embeddingModelFor } from "./embedding";
import { buildPosting, serializePosting } from "./lexical";
import { replaceChunks, type NewChunk } from "./chunks";
import { listSources, getSource, setSourceStatus } from "./sources";
import { createJob, updateJobProgress, finishJob } from "./jobs";

export interface IndexResult {
  jobId: string;
  sourcesProcessed: number;
  chunksCreated: number;
  strategy: RetrievalStrategy;
  /** true wenn ohne Embeddings indexiert wurde. */
  degraded: boolean;
  notice: string | null;
  failures: { sourceId: string; title: string; error: string }[];
}

export interface IndexOptions {
  /** Nur diese Quelle indexieren. */
  sourceId?: string;
  /** Auch Quellen mit Status "indexed" neu aufbauen. */
  force?: boolean;
  /** Fortschritts-Callback für die UI. */
  onProgress?: (done: number, total: number, label: string) => void;
}

/** Erzeugt Chunks passend zum Quellentyp. */
function chunkSource(src: KnowledgeSource): Chunk[] {
  if (src.sourceType === "chapter") {
    // Kapitelinhalt liegt als TipTap-JSON vor
    const looksJson = src.content.trim().startsWith("{");
    return looksJson ? chunkTiptap(src.content, src.title) : chunkPlainText(src.content, src.title);
  }
  return chunkPlainText(src.content, src.title);
}

/**
 * Indexiert ein Projekt oder eine einzelne Quelle.
 * Blockiert nie die UI: der Aufrufer startet das ohne await bzw. mit Fortschrittsanzeige.
 * Wirft nicht — Fehler landen in `IndexResult.failures`.
 */
export async function indexProject(
  projectId: string,
  settings: AppSettings,
  options: IndexOptions = {},
): Promise<IndexResult> {
  const all = listSources(projectId);
  const targets = options.sourceId
    ? all.filter((s) => s.id === options.sourceId)
    : options.force
      ? all
      : all.filter((s) => s.status !== "indexed");

  const probe = await probeEmbeddings(settings);
  const strategy: RetrievalStrategy = probe.available ? "hybrid" : "lexical";
  const model = embeddingModelFor(settings);

  const job = await createJob(projectId, options.sourceId ?? null, targets.length, strategy);

  const failures: IndexResult['failures'] = [];
  let processed = 0;
  let chunksTotal = 0;

  for (const src of targets) {
    options.onProgress?.(processed, targets.length, src.title);
    try {
      const chunks = chunkSource(src);

      if (chunks.length === 0) {
        // Leere Quelle ist kein Fehler, aber auch nichts zu indexieren
        await replaceChunks(projectId, src.id, src.sourceType, []);
        await setSourceStatus(src.id, "indexed");
        processed++;
        await updateJobProgress(job.id, processed, chunksTotal, `${src.title}: leer`);
        continue;
      }

      // Embeddings nur wenn verfügbar; Posting immer.
      let vectors: number[][] | null = null;
      if (probe.available) {
        try {
          vectors = await embedBatch(chunks.map((c) => c.text), settings);
        } catch {
          // Modell fiel mitten im Lauf aus → lexikalisch weiterarbeiten statt abbrechen.
          // Der Chunk bleibt durchsuchbar, nur ohne semantisches Signal.
          vectors = null;
        }
      }

      const rows: NewChunk[] = chunks.map((c, i) => ({
        chunkIndex: c.chunkIndex,
        text: c.text,
        headingPath: c.headingPath,
        tokenCount: c.tokenCount,
        embedding: vectors?.[i] ? serializeEmbedding(vectors[i]) : null,
        embeddingModel: vectors?.[i] ? model : null,
        termFreq: serializePosting(buildPosting(c.text)),
      }));

      const n = await replaceChunks(projectId, src.id, src.sourceType, rows);
      chunksTotal += n;
      await setSourceStatus(src.id, "indexed");
      processed++;
      await updateJobProgress(job.id, processed, chunksTotal, src.title);
    } catch (e) {
      const msg = (e as Error).message || String(e);
      failures.push({ sourceId: src.id, title: src.title, error: msg });
      await setSourceStatus(src.id, "failed", msg);
      processed++;
      await updateJobProgress(job.id, processed, chunksTotal, `Fehler: ${src.title}`);
    }
  }

  const notice = buildNotice(probe.notice, failures.length, targets.length);
  await finishJob(job.id, failures.length && failures.length === targets.length ? "failed" : "done", notice);
  options.onProgress?.(targets.length, targets.length, "Fertig");

  return {
    jobId: job.id,
    sourcesProcessed: processed,
    chunksCreated: chunksTotal,
    strategy,
    degraded: !probe.available,
    notice,
    failures,
  };
}

function buildNotice(probeNotice: string | null, failures: number, total: number): string | null {
  const parts: string[] = [];
  if (probeNotice) parts.push(probeNotice);
  if (failures > 0) {
    parts.push(
      failures === total
        ? "Keine Quelle konnte indexiert werden."
        : `${failures} von ${total} Quellen konnten nicht indexiert werden.`,
    );
  }
  return parts.length ? parts.join(" ") : null;
}

/** Indexiert genau eine Quelle. Komfort-Wrapper für „Nur dieses Kapitel indexieren". */
export async function indexSingleSource(
  projectId: string,
  sourceId: string,
  settings: AppSettings,
  onProgress?: IndexOptions["onProgress"],
): Promise<IndexResult> {
  const src = getSource(sourceId);
  if (!src) {
    return {
      jobId: "", sourcesProcessed: 0, chunksCreated: 0, strategy: "lexical",
      degraded: true, notice: "Die Quelle wurde nicht gefunden.",
      failures: [{ sourceId, title: "unbekannt", error: "Quelle nicht gefunden" }],
    };
  }
  return indexProject(projectId, settings, { sourceId, force: true, onProgress });
}
