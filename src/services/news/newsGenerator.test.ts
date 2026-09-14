// Tests: News Generator — Guards (Topic-Pflicht, Count-Clamp, Hybrid-Fallback).
import { describe, it, expect, afterEach, vi } from "vitest";
import { generateNewsArticles } from "./newsGenerator";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("generateNewsArticles", () => {
  it("wirft bei leerem Thema (statt sinnloser Demo-Headlines)", async () => {
    await expect(
      generateNewsArticles({ topic: "   ", language: "de", count: 2 }),
    ).rejects.toThrow("Kein Thema angegeben");
  });

  it("liefert Demo-Artikel in der gewünschten Anzahl", async () => {
    const articles = await generateNewsArticles({
      topic: "Künstliche Intelligenz",
      language: "de",
      count: 3,
    });
    expect(articles).toHaveLength(3);
    for (const a of articles) {
      expect(a.headline).toBeTruthy();
      expect(a.body).toBeTruthy();
    }
  });

  it("klemmt übergroße Counts auf 12", async () => {
    const articles = await generateNewsArticles({
      topic: "Klima",
      language: "de",
      count: 99,
    });
    expect(articles).toHaveLength(12);
  });

  it("fällt bei leerer LLM-JSON-Antwort auf Demo zurück (kein leeres Ergebnis)", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ response: "[]" }), {
        status: 200,
      })) as typeof fetch;
    const articles = await generateNewsArticles({
      topic: "Wirtschaft",
      language: "de",
      count: 3,
      useLLM: true,
    });
    expect(articles).toHaveLength(3);
    expect(articles[0].headline).toBeTruthy();
  });

  it("ersetzt leere LLM-Felder durch Demo-Fallback (keine leeren Headlines)", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          response: JSON.stringify([
            { headline: "", teaser: "T", body: "", source: "LLM" },
          ]),
        }),
        { status: 200 },
      )) as typeof fetch;
    const articles = await generateNewsArticles({
      topic: "Sport",
      language: "de",
      count: 1,
      useLLM: true,
    });
    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBeTruthy();
    expect(articles[0].body).toBeTruthy();
  });
});
