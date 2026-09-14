// Regression: chunkSource fällt bei korruptem Kapitel-JSON auf Plaintext zurück,
// statt die Quelle still als „leer" zu indexieren.
import { describe, it, expect } from "vitest";
import { chunkSource } from "./indexer";
import type { KnowledgeSource } from "@/types/knowledge";

function chapter(content: string): KnowledgeSource {
  return {
    id: "s1", projectId: "p1", sourceType: "chapter", refId: "c1",
    title: "Kapitel 1", content, tags: null, status: "pending",
    contentHash: "x", lastError: null, createdAt: 0, updatedAt: 0, indexedAt: null,
  };
}

function tiptap(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  });
}

describe("chunkSource Kapitel-Fallback", () => {
  it("chunkt valides TipTap-JSON strukturiert", () => {
    const chunks = chunkSource(chapter(tiptap(["Anna ging nach Hamburg."])));
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].headingPath).toBe("Kapitel 1");
  });

  it("fällt bei abgebrochenem JSON auf Plaintext zurück statt leer", () => {
    const chunks = chunkSource(chapter('{"type": "doc", "content": [{"type": "para'));
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text.length).toBeGreaterThan(0);
  });

  it("fällt bei JSON ohne TipTap-Struktur auf Plaintext zurück", () => {
    const chunks = chunkSource(chapter('{"notiz": "Anna ging nach Hamburg"}'));
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("leeres TipTap-Dokument bleibt leer (kein JSON-Müll im Index)", () => {
    const chunks = chunkSource(chapter(JSON.stringify({ type: "doc", content: [] })));
    expect(chunks).toHaveLength(0);
  });
});
