// Tests: Artikel-Generator (Sprint 16, Agent 2). Complete ist gemockt.
import { describe, it, expect, vi } from "vitest";
import {
  generateArticle,
  buildArticlePrompt,
  parseArticleResponse,
  ArticleGenError,
  type SearchResult,
} from "./articleGen";

const RESULTS: SearchResult[] = [
  { title: "Stadt baut neues Radnetz", snippet: "Der Stadtrat beschliesst 20 km neue Radwege.", source: "Lokalblatt" },
  { title: "Kritik vom ADFC", text: "Der ADFC fordert mehr Tempo beim Ausbau.", url: "https://example.de/adfc" },
];

const MARKER_OK = [
  "TITEL: Neues Radnetz beschlossen",
  "ARTIKEL: Der Stadtrat hat 20 km neue Radwege beschlossen. Der ADFC fordert mehr Tempo.",
  "ZUSAMMENFASSUNG: Stadtrat beschliesst Radwege-Ausbau.",
  "BILDPROMPT: City council voting on new bike lanes, newspaper photo",
].join("\n");

describe("generateArticle: Erfolg", () => {
  it("liefert title, body, summary, imagePrompt", async () => {
    const a = await generateArticle(RESULTS, "neutral", async () => MARKER_OK);
    expect(a.title).toBe("Neues Radnetz beschlossen");
    expect(a.body).toContain("20 km neue Radwege");
    expect(a.summary).toContain("Radwege-Ausbau");
    expect(a.imagePrompt).toContain("bike lanes");
  });

  it("uebergibt Quellen an complete (Prompt enthaelt Titel + Snippets)", async () => {
    const complete = vi.fn(async () => MARKER_OK);
    await generateArticle(RESULTS, "neutral", complete);
    const prompt = (complete.mock.calls[0] as unknown[])[0] as string;
    expect(prompt).toContain("Stadt baut neues Radnetz");
    expect(prompt).toContain("20 km neue Radwege");
    expect(prompt).toContain("ADFC");
  });

  it("Default-Stil ist neutral", async () => {
    const complete = vi.fn(async () => MARKER_OK);
    await generateArticle(RESULTS, undefined, complete);
    expect(((complete.mock.calls[0] as unknown[])[0] as string).toLowerCase()).toContain("neutral");
  });

  it("parst JSON-Antworten (englische Keys)", async () => {
    const json = JSON.stringify({
      title: "J-Titel",
      body: "J-Body mit mindestens drei Saetzen. Zweiter Satz. Dritter Satz.",
      summary: "J-Summary.",
      imagePrompt: "J-Image.",
    });
    const a = await generateArticle(RESULTS, "neutral", async () => json);
    expect(a.title).toBe("J-Titel");
    expect(a.body).toContain("J-Body");
  });
});

describe("generateArticle: Fehlerfaelle", () => {
  it("leere Ergebnisliste -> ArticleGenError kind=empty", async () => {
    await expect(generateArticle([], "neutral", async () => MARKER_OK)).rejects.toMatchObject({
      name: "ArticleGenError",
      kind: "empty",
    });
  });

  it("leere Modell-Antwort -> kind=empty", async () => {
    await expect(generateArticle(RESULTS, "neutral", async () => "   ")).rejects.toMatchObject({
      kind: "empty",
    });
  });

  it("unverstaendliche Kurzantwort -> kind=malformed", async () => {
    await expect(generateArticle(RESULTS, "neutral", async () => "???")).rejects.toMatchObject({
      kind: "malformed",
    });
  });

  it("fehlende complete-Funktion -> kind=args", async () => {
    await expect(
      generateArticle(RESULTS, "neutral", undefined as never),
    ).rejects.toMatchObject({ kind: "args" });
  });

  it("Complete-Fehler werden als kind=complete verpackt", async () => {
    const boom = new Error("offline");
    await expect(
      generateArticle(RESULTS, "neutral", async () => {
        throw boom;
      }),
    ).rejects.toMatchObject({ name: "ArticleGenError", kind: "complete" });
  });

  it("unbekannter Stil -> kind=args", async () => {
    await expect(
      generateArticle(RESULTS, "boulevard" as never, async () => MARKER_OK),
    ).rejects.toMatchObject({ kind: "args" });
  });
});

describe("Stil-Varianten", () => {
  it("sensational: Prompt enthaelt Boulevard-Cue", () => {
    expect(buildArticlePrompt(RESULTS, "sensational")).toContain("Boulevard");
  });

  it("analytical: Prompt enthaelt Analyse-Cue", () => {
    expect(buildArticlePrompt(RESULTS, "analytical")).toContain("analytisch");
  });

  it("Stile erzeugen unterschiedliche Prompts", () => {
    const n = buildArticlePrompt(RESULTS, "neutral");
    const s = buildArticlePrompt(RESULTS, "sensational");
    const a = buildArticlePrompt(RESULTS, "analytical");
    expect(new Set([n, s, a]).size).toBe(3);
  });
});

describe("parseArticleResponse: Fallbacks", () => {
  it("reiner Fliesstext (lang) -> Body, Titel-Fallback, Summary aus Body", () => {
    const body = "Der Stadtrat hat entschieden. Es folgen 20 km Radwege. Der ADFC lobt den Beschluss.";
    const a = parseArticleResponse(body, "Fallback-Titel");
    expect(a.body).toBe(body);
    expect(a.title).toBe("Fallback-Titel");
    expect(a.summary).toBe(body.slice(0, 200));
    expect(a.imagePrompt).toContain("Fallback-Titel");
  });

  it("fehlender Titel -> erste Quelle, fehlender Bildprompt -> generiert", () => {
    const raw = "ARTIKEL: Ein langer Artikeltext mit mehreren Saetzen. Zweiter Satz hier. Dritter Satz.";
    const a = parseArticleResponse(raw, "Quellen-Titel");
    expect(a.title).toBe("Quellen-Titel");
    expect(a.imagePrompt).toContain("Quellen-Titel");
  });

  it("ArticleGenError ist instanceof Error", () => {
    expect(new ArticleGenError("empty", "x")).toBeInstanceOf(Error);
  });
});
