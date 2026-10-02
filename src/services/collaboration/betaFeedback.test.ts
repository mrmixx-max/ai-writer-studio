// Tests für den Beta-Reader-Service (WP 14.1, Feedback-Hub).
// Rein lokal, deterministisch — kein LLM, kein DB, kein Netzwerk.
import { describe, it, expect } from "vitest";
import {
  generateReaderHtml,
  parseFeedbackFile,
  applyFeedbackToChapter,
  type ChapterInput,
  type FeedbackImport,
} from "./betaFeedback";

const CHAPTER: ChapterInput = {
  id: "ch-1",
  title: "Der dunkle Wald",
  content: "Es war einmal ein dunkler Wald.\n\nDer Wind heulte durch die Bäume.",
};

describe("generateReaderHtml", () => {
  it("liefert ein vollständiges, eigenständiges HTML-Dokument", () => {
    const html = generateReaderHtml(CHAPTER);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("</html>");
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain("Der dunkle Wald");
    // kein externer Ressourcen-Verweis (offline-fähig)
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("rendert Content als Absätze mit data-pos", () => {
    const html = generateReaderHtml(CHAPTER);
    expect(html).toContain('<p data-pos="0">');
    expect(html).toContain("Es war einmal ein dunkler Wald.");
    expect(html).toContain("Der Wind heulte durch die Bäume.");
  });

  it("aktiviert den Dark-Mode nur bei darkMode: true", () => {
    expect(generateReaderHtml(CHAPTER, { darkMode: true })).toContain('<body class="dark">');
    expect(generateReaderHtml(CHAPTER, { darkMode: false })).toContain('<body class="light">');
    expect(generateReaderHtml(CHAPTER)).toContain('<body class="light">');
  });

  it("zeigt Emote-Buttons nur bei showEmotes: true", () => {
    const withEmotes = generateReaderHtml(CHAPTER, { showEmotes: true });
    expect(withEmotes).toContain('data-emote="thrill"');
    expect(withEmotes).toContain('data-emote="slow"');
    expect(withEmotes).toContain('data-emote="plot-hole"');
    expect(withEmotes).toContain('data-emote="favorite"');

    const withoutEmotes = generateReaderHtml(CHAPTER);
    expect(withoutEmotes).not.toContain('data-emote="thrill"');
    expect(withoutEmotes).not.toContain('id="fb-emotes"');
  });

  it("escaped HTML in Titel und Content (keine Injection)", () => {
    const html = generateReaderHtml({
      id: "ch-x",
      title: '<img src=x onerror="alert(1)">',
      content: "Ein <b>fetter</b> Satz & ein <script>alert(2)</script>.",
    });
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
  });

  it("kommt mit leerem Content zurecht", () => {
    const html = generateReaderHtml({ id: "", title: "", content: "" });
    expect(html).toContain("Unbenanntes Kapitel");
    expect(html).toContain("(Noch kein Inhalt)");
    expect(html).toContain("</html>");
  });
});

describe("parseFeedbackFile", () => {
  it("parst eine gültige .aiwsfeedback-Datei vollständig", () => {
    const file = JSON.stringify({
      format: "ai-writer-studio/feedback",
      version: 1,
      chapterId: "ch-1",
      exportedAt: 123,
      comments: [{ id: "c1", text: "Starker Anfang!", position: 5, author: "Anna" }],
      emotes: [{ id: "e1", type: "thrill", position: 10 }],
      ratings: [{ chapterId: "ch-1", pacing: 4 }],
    });
    const fb = parseFeedbackFile(file);
    expect(fb.comments).toEqual([{ id: "c1", text: "Starker Anfang!", position: 5, author: "Anna" }]);
    expect(fb.emotes).toEqual([{ id: "e1", type: "thrill", position: 10 }]);
    expect(fb.ratings).toEqual([{ chapterId: "ch-1", pacing: 4 }]);
  });

  it("liefert leeres Feedback bei ungültigem JSON statt zu werfen", () => {
    expect(parseFeedbackFile("{kaputt")).toEqual({ comments: [], emotes: [], ratings: [] });
    expect(parseFeedbackFile("")).toEqual({ comments: [], emotes: [], ratings: [] });
    expect(parseFeedbackFile("null")).toEqual({ comments: [], emotes: [], ratings: [] });
    expect(parseFeedbackFile("[1,2,3]")).toEqual({ comments: [], emotes: [], ratings: [] });
  });

  it("filtert kaputte Einträge und füllt fehlende Felder auf", () => {
    const file = JSON.stringify({
      comments: [
        { text: "Ohne ID/Autor", position: "7" },
        { text: "" }, // leerer Text → verwerfen
        "kein objekt", // → verwerfen
      ],
      emotes: [
        { type: "unknown-type", position: 1 }, // ungültiger Typ → verwerfen
        { type: "favorite", position: 3 },
      ],
      ratings: [{ chapterId: "ch-1", pacing: "5" }, { chapterId: "ch-1", pacing: "abc" }],
    });
    const fb = parseFeedbackFile(file);
    expect(fb.comments).toHaveLength(1);
    expect(fb.comments[0]).toMatchObject({ id: "c1", author: "Anonym", position: 7 });
    expect(fb.emotes).toEqual([{ id: "e2", type: "favorite", position: 3 }]);
    expect(fb.ratings).toEqual([{ chapterId: "ch-1", pacing: 5 }]);
  });

  it("akzeptiert verschachteltes Feedback unter `feedback`/`data`", () => {
    const nested = JSON.stringify({
      feedback: { comments: [{ id: "c1", text: "Hi", position: 1, author: "Bob" }], emotes: [], ratings: [] },
    });
    expect(parseFeedbackFile(nested).comments[0].text).toBe("Hi");

    const dataWrapped = JSON.stringify({ data: { comments: [], emotes: [], ratings: [{ chapterId: "ch", pacing: 2 }] } });
    expect(parseFeedbackFile(dataWrapped).ratings[0].pacing).toBe(2);
  });

  it("begrenzt Pacing auf 1–5 und füllt fehlende Arrays auf", () => {
    const fb = parseFeedbackFile(JSON.stringify({ ratings: [{ chapterId: "ch", pacing: 99 }] }));
    expect(fb.ratings[0].pacing).toBe(5);
    expect(fb.comments).toEqual([]);
    expect(fb.emotes).toEqual([]);
  });
});

describe("applyFeedbackToChapter", () => {
  it("fügt Kommentar-Marker an der richtigen Position ein", () => {
    const fb: FeedbackImport = {
      comments: [{ id: "c1", text: "Starker Einstieg", position: 0, author: "Anna" }],
      emotes: [],
      ratings: [],
    };
    const out = applyFeedbackToChapter(CHAPTER, fb);
    expect(out.content).toContain("[[Kommentar von Anna: Starker Einstieg]]");
    expect(out.content.indexOf("[[Kommentar von Anna: Starker Einstieg]]")).toBeLessThan(
      out.content.indexOf("Es war einmal"),
    );
  });

  it("fügt Emote-Marker mit deutschem Label ein", () => {
    const fb: FeedbackImport = {
      comments: [],
      emotes: [{ id: "e1", type: "plot-hole", position: 0 }],
      ratings: [],
    };
    const out = applyFeedbackToChapter(CHAPTER, fb);
    expect(out.content).toContain("[[🕳️ Logikloch]]");
  });

  it("hängt eine Tempo-Fußzeile mit gerundetem Durchschnitt an", () => {
    const fb: FeedbackImport = {
      comments: [],
      emotes: [],
      ratings: [
        { chapterId: "ch-1", pacing: 3 },
        { chapterId: "ch-1", pacing: 4 },
      ],
    };
    const out = applyFeedbackToChapter(CHAPTER, fb);
    // Ø von 3 und 4 = 3.5 → gerundet 4
    expect(out.content).toContain("[Bewertung — Tempo: 4/5 (2 Stimmen)]");
    expect(out.content.trimEnd().endsWith("[Bewertung — Tempo: 4/5 (2 Stimmen)]")).toBe(true);
  });

  it("begrenzt Positionen auf die Content-Länge", () => {
    const fb: FeedbackImport = {
      comments: [{ id: "c1", text: "Ende", position: 99999, author: "Bo" }],
      emotes: [],
      ratings: [],
    };
    const out = applyFeedbackToChapter(CHAPTER, fb);
    expect(out.content).toContain("Bäume. [[Kommentar von Bo: Ende]]");
  });

  it("lässt das Kapitel bei leerem Feedback unverändert", () => {
    const out = applyFeedbackToChapter(CHAPTER, { comments: [], emotes: [], ratings: [] });
    expect(out).toEqual(CHAPTER);
    expect(out).not.toBe(CHAPTER); // neue Instanz, Eingabe nicht mutiert
  });

  it("überspringt ungültige Einträge defensiv", () => {
    const fb = {
      comments: [{ id: "c1", text: "   ", position: 0, author: "X" }],
      emotes: [{ id: "e1", type: "nonsense" as never, position: 0 }],
      ratings: [{ chapterId: "ch-1", pacing: Number.NaN }],
    } as unknown as FeedbackImport;
    const out = applyFeedbackToChapter(CHAPTER, fb);
    expect(out.content).toBe(CHAPTER.content);
  });

  it("verändert die Eingabe nicht (Immutabilität) und behält id/title", () => {
    const fb: FeedbackImport = {
      comments: [{ id: "c1", text: "Notiz", position: 0, author: "Cara" }],
      emotes: [{ id: "e1", type: "favorite", position: 0 }],
      ratings: [{ chapterId: "ch-1", pacing: 5 }],
    };
    const out = applyFeedbackToChapter(CHAPTER, fb);
    expect(CHAPTER.content).toBe("Es war einmal ein dunkler Wald.\n\nDer Wind heulte durch die Bäume.");
    expect(out.id).toBe("ch-1");
    expect(out.title).toBe("Der dunkle Wald");
    expect(out.content).toContain("[[Kommentar von Cara: Notiz]]");
    expect(out.content).toContain("[[❤️ Favorit]]");
    expect(out.content).toContain("[Bewertung — Tempo: 5/5]");
  });
});
