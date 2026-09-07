// Sprint 16, Agent 4 — Tests fuer newspaperLayout (TDD).
import { describe, it, expect } from "vitest";
import {
  buildNewspaper,
  newspaperToMarkdown,
  type NewsArticle,
} from "./newspaperLayout";

function makeArticle(over: Partial<NewsArticle> & { id: string }): NewsArticle {
  return {
    headline: `Headline ${over.id}`,
    body: `Body ${over.id}`,
    ...over,
  };
}

describe("buildNewspaper — Struktur", () => {
  it("platziert Artikel mit Lead-Headline auf Seite 1", () => {
    const articles = [makeArticle({ id: "a1" }), makeArticle({ id: "a2" })];
    const paper = buildNewspaper(articles);
    expect(paper.pages).toHaveLength(1);
    expect(paper.pages[0].lead?.articleId).toBe("a1");
    expect(paper.pages[0].lead?.role).toBe("lead");
    expect(paper.pages[0].lead?.headlineSize).toBe("xl");
  });

  it("liefert leere Zeitung bei leerer Artikelliste", () => {
    expect(buildNewspaper([])).toEqual({ pages: [], toc: [] });
  });

  it("baut ein TOC mit Seitennummern pro Artikel", () => {
    const articles = [makeArticle({ id: "a1" }), makeArticle({ id: "a2" })];
    const paper = buildNewspaper(articles);
    expect(paper.toc).toHaveLength(2);
    expect(paper.toc[0]).toMatchObject({ title: "Headline a1", page: 1, articleId: "a1" });
  });

  it("paginiert bei mehr Artikeln als articlesPerPage auf mehrere Seiten", () => {
    const articles = Array.from({ length: 5 }, (_, i) => makeArticle({ id: `a${i}` }));
    const paper = buildNewspaper(articles, { articlesPerPage: 2 });
    expect(paper.pages).toHaveLength(3);
    expect(paper.pages[1].pageNumber).toBe(2);
    expect(paper.toc.find((t) => t.articleId === "a4")?.page).toBe(3);
  });

  it("sortiert Lead-Prioritaet vor und setzt sie als Lead-Story", () => {
    const articles = [
      makeArticle({ id: "n1" }),
      makeArticle({ id: "lead1", priority: "lead", headline: "Top" }),
    ];
    const paper = buildNewspaper(articles);
    expect(paper.pages[0].lead?.articleId).toBe("lead1");
  });

  it("verteilt Artikel round-robin auf Spalten", () => {
    const articles = Array.from({ length: 4 }, (_, i) => makeArticle({ id: `a${i}` }));
    const paper = buildNewspaper(articles, { articlesPerPage: 4, columnsPerPage: 2 });
    const cols = paper.pages[0].columns;
    expect(cols).toHaveLength(2);
    const all = cols.flatMap((c) => c.articleIds).sort();
    expect(all).toEqual(["a0", "a1", "a2", "a3"]);
  });

  it("verfuegt Bild-Slots nur an Artikel mit imageUrl, Lead bekommt top-Position", () => {
    const articles = [
      makeArticle({ id: "a1", imageUrl: "https://img/1.jpg", priority: "lead" }),
      makeArticle({ id: "a2", imageUrl: "https://img/2.jpg" }),
      makeArticle({ id: "a3" }),
    ];
    const paper = buildNewspaper(articles);
    const slots = paper.pages[0].imageSlots;
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ articleId: "a1", position: "top" });
    expect(slots[1].position).toBe("inline");
    expect(paper.pages[0].articles[2].imageSlot).toBeNull();
  });

  it("begrenzt Bild-Slots auf maxImagesPerPage", () => {
    const articles = Array.from({ length: 3 }, (_, i) =>
      makeArticle({ id: `a${i}`, imageUrl: `https://img/${i}.jpg` })
    );
    const paper = buildNewspaper(articles, { maxImagesPerPage: 1 });
    expect(paper.pages[0].imageSlots).toHaveLength(1);
  });

  it("begrenzt Seiten auf maxPages", () => {
    const articles = Array.from({ length: 9 }, (_, i) => makeArticle({ id: `a${i}` }));
    const paper = buildNewspaper(articles, { articlesPerPage: 2, maxPages: 2 });
    expect(paper.pages).toHaveLength(2);
  });
});

describe("newspaperToMarkdown — Export", () => {
  it("exportiert Masthead, TOC, Headlines und Bild-Platzhalter", () => {
    const articles = [
      makeArticle({ id: "a1", headline: "Titel Eins", imageUrl: "https://img/1.jpg" }),
      makeArticle({ id: "a2", headline: "Titel Zwei" }),
    ];
    const paper = buildNewspaper(articles);
    const md = newspaperToMarkdown(paper, articles, { masthead: "Testblatt" });
    expect(md).toContain("# Testblatt");
    expect(md).toContain("## Inhaltsverzeichnis");
    expect(md).toContain("Titel Eins");
    expect(md).toContain("![Bild:");
    expect(md).toContain("https://img/1.jpg");
    expect(md).toContain("## Seite 1");
  });

  it("exportiert leere Zeitung mit Hinweis", () => {
    const md = newspaperToMarkdown(buildNewspaper([]), []);
    expect(md).toContain("Keine Artikel");
  });
});
