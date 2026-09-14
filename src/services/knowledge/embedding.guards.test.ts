// Guards: Embedding-Fallback-Lücken und Vektor-Validierung (kein Netz nötig).
import { describe, it, expect } from "vitest";
import {
  deserializeEmbedding,
  serializeEmbedding,
  embedBatch,
} from "./embedding";
import { DEFAULT_SETTINGS } from "@/types/config";

describe("deserializeEmbedding", () => {
  it("nimmt gültige Vektoren an", () => {
    const vec = [0.1, -0.5, 0.0, 1];
    expect(deserializeEmbedding(serializeEmbedding(vec))).toEqual(vec);
  });

  it("weist korrupte Inhalte ab statt NaN-Scores zu erzeugen", () => {
    expect(deserializeEmbedding(null)).toBeNull();
    expect(deserializeEmbedding("")).toBeNull();
    expect(deserializeEmbedding("kein-json")).toBeNull();
    expect(deserializeEmbedding("[]")).toBeNull();
    expect(deserializeEmbedding("{}")).toBeNull();
    expect(deserializeEmbedding('["a","b"]')).toBeNull();
    expect(deserializeEmbedding("[1,2,null]")).toBeNull();
    expect(deserializeEmbedding("[0.1,NaN]")).toBeNull();
    expect(deserializeEmbedding("[0.1,Infinity]")).toBeNull();
  });
});

describe("embedBatch Provider-Fallback", () => {
  it("wirft bei OpenRouter wie embedOne statt still auf Ollama zu fallen", async () => {
    const settings = { ...DEFAULT_SETTINGS, provider: "openrouter" as const };
    await expect(embedBatch(["Testsatz"], settings)).rejects.toThrow(/OpenRouter/);
  });
});
