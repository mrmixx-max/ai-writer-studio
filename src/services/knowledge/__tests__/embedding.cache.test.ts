// Tests: Embedding-Cache in embedding.ts.
//
// Identische Chunks dürfen nicht neu eingebettet werden. Der Cache ist ein
// In-Memory LRU (Map<contentHash, number[]>); hier wird er gegen einen
// gestubbten fetch geprüft, der Aufrufe zählt.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/config";
import {
  embedOne,
  embedBatch,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
} from "@/services/knowledge/embedding";

/** Settings mit Ollama auf einem Port, auf dem nichts lauscht — fetch wird ohnehin gestubbt. */
const settings = {
  ...DEFAULT_SETTINGS,
  provider: "ollama" as const,
  ollamaBaseUrl: "http://127.0.0.1:11434",
};

const FAKE_VEC = [0.1, 0.2, 0.3];

/** Stubbt fetch: zählt /api/embeddings-Aufrufe, liefert immer FAKE_VEC. */
function stubFetch() {
  let calls = 0;
  const callsPerText: string[] = [];
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init?.body ?? "{}"));
    callsPerText.push(body.prompt);
    return {
      ok: true,
      json: async () => ({ embedding: FAKE_VEC }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return {
    get calls() { return calls; },
    callsPerText,
  };
}

describe("Embedding-Cache", () => {
  beforeEach(() => {
    clearEmbeddingCache();
    vi.unstubAllGlobals();
  });

  it("bettet denselben Text nur einmal ein (Cache-Hit beim zweiten Aufruf)", async () => {
    const stub = stubFetch();

    const v1 = await embedOne("Ein Testabsatz über Anna.", settings);
    const v2 = await embedOne("Ein Testabsatz über Anna.", settings);

    expect(stub.calls).toBe(1);
    expect(v1).toEqual(FAKE_VEC);
    expect(v2).toEqual(FAKE_VEC);
    expect(getEmbeddingCacheStats().hits).toBe(1);
    expect(getEmbeddingCacheStats().misses).toBe(1);
  });

  it("unterscheidet verschiedene Texte (Cache-Miss → erneuter API-Call)", async () => {
    const stub = stubFetch();

    await embedOne("Text A über Hamburg.", settings);
    await embedOne("Text B über Berlin.", settings);

    expect(stub.calls).toBe(2);
    expect(getEmbeddingCacheStats().misses).toBe(2);
  });

  it("normalisiert Whitespace: Varianten mit anderem Leerraum treffen denselben Cache-Eintrag", async () => {
    const stub = stubFetch();

    await embedOne("Anna   geht  nach\nHamburg.", settings);
    await embedOne("Anna geht nach Hamburg.", settings);

    expect(stub.calls).toBe(1);
    expect(getEmbeddingCacheStats().hits).toBe(1);
  });

  it("embedBatch dedupliziert identische Texte vor dem API-Call", async () => {
    const stub = stubFetch();
    const texts = ["Duplikat A", "Duplikat A", "Duplikat B", "Duplikat A", "Duplikat B"];

    const out = await embedBatch(texts, settings);

    // Ollama: 1 Text pro Request — nur die 2 einzigartigen Texte werden gesendet
    expect(stub.calls).toBe(2);
    expect(out).toHaveLength(5);
    // Reihenfolge und Zuordnung bleiben erhalten
    expect(out[0]).toEqual(FAKE_VEC);
    expect(out[1]).toEqual(FAKE_VEC);
    expect(out[4]).toEqual(FAKE_VEC);
    expect(stub.callsPerText).toHaveLength(2);
  });

  it("embedBatch ruft bei bereits gecachten Texten gar kein fetch auf", async () => {
    const stub = stubFetch();

    await embedOne("Schon bekannt.", settings); // 1 Call, landet im Cache
    const out = await embedBatch(["Schon bekannt.", "Schon bekannt."], settings);

    expect(stub.calls).toBe(1);
    expect(out).toEqual([FAKE_VEC, FAKE_VEC]);
    expect(getEmbeddingCacheStats().hits).toBeGreaterThanOrEqual(2);
  });

  it("clearEmbeddingCache leert Cache und Statistiken", async () => {
    stubFetch();
    await embedOne("Wird gleich gelöscht.", settings);
    expect(getEmbeddingCacheStats().size).toBe(1);

    clearEmbeddingCache();

    expect(getEmbeddingCacheStats()).toEqual({ hits: 0, misses: 0, size: 0 });
  });

  it("LRU-Verhalten: Einträge bleiben über Zugriffe hinweg abrufbar, Statistiken stimmen", async () => {
    // MAX_CACHE_ENTRIES ist 10_000 — das Eviktionslimit selbst ist in Tests zu groß,
    // aber die Grundmechanik wird geprüft: Einträge landen im Cache und bleiben Hits.
    const stub = stubFetch();
    for (let i = 0; i < 25; i++) {
      await embedOne(`Eintrag Nummer ${i}.`, settings);
    }
    const stats = getEmbeddingCacheStats();
    expect(stats.size).toBe(25);
    expect(stub.calls).toBe(25);
    expect(stats.misses).toBe(25);

    // Erneuter Zugriff auf frühe Einträge → Cache-Hit, kein API-Call
    await embedOne("Eintrag Nummer 0.", settings);
    await embedOne("Eintrag Nummer 24.", settings);
    expect(stub.calls).toBe(25);
    const after = getEmbeddingCacheStats();
    expect(after.hits).toBe(2);
    expect(after.misses).toBe(25);
    expect(after.size).toBe(25);
  });
});

describe("Embedding-Hilfsfunktionen", () => {
  it("cosineSimilarity: identische Vektoren → 1, orthogonale → 0, Dimensionskonflikt → 0", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([], [1])).toBe(0);
  });

  it("serialize/deserialize sind symmetrisch", () => {
    const vec = [0.123456789, -1.5, 42];
    const raw = serializeEmbedding(vec);
    expect(deserializeEmbedding(raw)).toEqual([0.123457, -1.5, 42]);
    expect(deserializeEmbedding(null)).toBeNull();
    expect(deserializeEmbedding("kein json")).toBeNull();
  });
});
