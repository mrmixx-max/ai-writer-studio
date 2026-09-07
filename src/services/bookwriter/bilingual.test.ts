// Bilingual-Book-Engine (Sprint 15, Agent 1): Tests mit gemockter CompleteFn.
// 0 echte API-Calls.

import { describe, it, expect, vi } from "vitest";

import {
  detectLanguage,
  translateChapter,
  translateOutline,
  buildBilingualPrompt,
  type CompleteFn,
} from "./bilingual";
import { maskMarkup } from "./markupGuard";
import type { BookOutline } from "@/types/bookwriter";

/** Fake-CompleteFn: gibt eine feste Antwort zurück, protokolliert Prompts. */
function fakeComplete(answer: string | ((prompt: string) => string)) {
  const calls: string[] = [];
  const fn: CompleteFn = async (prompt: string) => {
    calls.push(prompt);
    return typeof answer === "function" ? answer(prompt) : answer;
  };
  return { fn, calls };
}

const chapter = (over: { title?: string; content?: string } = {}) => ({
  id: "ch1",
  title: over.title ?? "Kapitel 1 — Der Anfang",
  content: over.content ?? "Ein mutiger Schritt beginnt die Reise.",
});

const outline = (): BookOutline => ({
  totalWords: 5000,
  chapters: [
    {
      title: "Der Fund im Wald",
      goal: "Die Gruppe entdeckt die alte Hütte im Wald.",
      conflict: "Ein Sturm zieht auf und schneidet den Rückweg ab.",
      outcome: "Sie beschließen, die Nacht in der Hütte zu verbringen.",
      estimatedWords: 2500,
      pov: "Anna erzählt in der Ich-Form von den Ereignissen.",
      research: ["Sturm", "Hütte"],
      subchapters: ["Ankunft bei der Hütte", "Der Sturm beginnt"],
    },
    {
      title: "Die Entscheidung",
      goal: "Am Morgen beraten sie über den weiteren Weg.",
      conflict: "Die Vorräte sind fast aufgebraucht.",
      outcome: "Jonas schlägt vor, dem Fluss zu folgen.",
      estimatedWords: 2500,
      pov: "Anna erzählt in der Ich-Form von den Ereignissen.",
      research: ["Fluss"],
      subchapters: [],
    },
  ],
});

// --- detectLanguage ---------------------------------------------------------

describe("detectLanguage", () => {
  it("erkennt Deutsch mit Umlauten/ß über die Dichte-Heuristik", () => {
    expect(
      detectLanguage("Die Größe der Bäume änderte sich: Blätter, Äste und das süße Flüstern des Waldes."),
    ).toBe("de");
  });

  it("erkennt Deutsch mit ß", () => {
    expect(
      detectLanguage("Die Straße führt durch das große Tal, wo die Füße müde werden und die Grüße verhallen."),
    ).toBe("de");
  });

  it("erkennt Deutsch ohne Umlaute über Stoppwörter", () => {
    expect(
      detectLanguage("Der Hund rennt durch den grossen Garten und bellt, weil er den Ball sucht."),
    ).toBe("de");
  });

  it("erkennt Englisch", () => {
    expect(
      detectLanguage("The quick brown fox jumps over the lazy dog while the sun shines over the hills."),
    ).toBe("en");
  });

  it("gibt 'other' für leeren Text zurück", () => {
    expect(detectLanguage("")).toBe("other");
    expect(detectLanguage("   \n  ")).toBe("other");
  });

  it("rät nicht bei sehr kurzen mehrdeutigen Texten", () => {
    expect(detectLanguage("Hi ok")).toBe("other");
    expect(detectLanguage("x")).toBe("other");
  });

  it("erkennt kurze deutsche Texte mit starkem Signal (Umlaut)", () => {
    expect(detectLanguage("Grüße")).toBe("de");
  });

  it("gibt 'other' ohne Stoppwort-Treffer und bei Gleichstand zurück", () => {
    expect(detectLanguage("abc xyz qwerty foo bar")).toBe("other");
    expect(detectLanguage("der the foo")).toBe("other");
  });
});

// --- buildBilingualPrompt ----------------------------------------------------

describe("buildBilingualPrompt", () => {
  it("nennt Zielsprache und Markup-Schutzregeln", () => {
    const p = buildBilingualPrompt("Hallo ⟦M01⟧ Welt", "en");
    expect(p).toContain("Englisch");
    expect(p).toContain("Hallo ⟦M01⟧ Welt");
    expect(p).toContain("⟦M##⟧");
  });
});

// --- translateChapter --------------------------------------------------------

describe("translateChapter", () => {
  it("delegiert an complete und liefert die Übersetzung zurück", async () => {
    const { fn, calls } = fakeComplete("A brave step begins the journey.");
    const out = await translateChapter(chapter(), "en", fn);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("Englisch");
    expect(out).toBe("A brave step begins the journey.");
  });

  it("übergibt den Kapiteltext im Prompt", async () => {
    const { fn, calls } = fakeComplete((prompt) => `EN:${prompt.length}`);
    await translateChapter(chapter({ content: "Der alte Wald rauscht in der Nacht." }), "en", fn);
    expect(calls[0]).toContain("Der alte Wald rauscht in der Nacht.");
  });

  it("erhält Markdown-Markup (Heading, Bold, Link) bei Echo-Antwort", async () => {
    const src = "# Der Anfang\n\nEin **mutiger** [Schritt](https://x.de) beginnt die Reise.";
    const { fn } = fakeComplete(maskMarkup(src).masked);
    const out = await translateChapter(chapter({ content: src }), "en", fn);
    expect(out).toBe(src);
  });

  it("erhält HTML-Tags bei Echo-Antwort", async () => {
    const src = "<p>Der <strong>alte</strong> Wald rauscht.</p>";
    const { fn } = fakeComplete(maskMarkup(src).masked);
    const out = await translateChapter(chapter({ content: src }), "en", fn);
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>");
  });

  it("ruft complete nicht für leeren Inhalt und gibt ihn unverändert zurück", async () => {
    const { fn, calls } = fakeComplete("SHOULD NOT BE USED");
    expect(await translateChapter(chapter({ content: "" }), "en", fn)).toBe("");
    expect(await translateChapter(chapter({ content: "   " }), "en", fn)).toBe("   ");
    expect(calls).toHaveLength(0);
  });

  it("übersetzt auch sehr kurze Texte", async () => {
    const { fn, calls } = fakeComplete("Go.");
    const out = await translateChapter(chapter({ content: "Geh." }), "en", fn);
    expect(calls).toHaveLength(1);
    expect(out).toBe("Go.");
  });

  it("ist ein No-op ohne Provider-Call, wenn der Inhalt schon in der Zielsprache ist", async () => {
    const en = "The quick brown fox jumps over the lazy dog while the sun shines brightly.";
    const { fn, calls } = fakeComplete("SHOULD NOT BE USED");
    expect(await translateChapter(chapter({ content: en }), "en", fn)).toBe(en);
    expect(calls).toHaveLength(0);
  });

  it("reicht Fehler von complete weiter", async () => {
    const failing: CompleteFn = async () => {
      throw new Error("Provider down");
    };
    await expect(translateChapter(chapter(), "en", failing)).rejects.toThrow("Provider down");
  });
});

// --- translateOutline --------------------------------------------------------

describe("translateOutline", () => {
  it("übersetzt alle Freitext-Felder und behält Strukturdaten", async () => {
    const { fn, calls } = fakeComplete((prompt) => {
      const m = prompt.match(/TEXT:\n([\s\S]*)$/);
      return `EN:${m?.[1] ?? prompt}`;
    });
    const out = await translateOutline(outline(), "en", fn);
    expect(out.chapters).toHaveLength(2);
    expect(out.totalWords).toBe(5000);
    expect(out.chapters[0].estimatedWords).toBe(2500);
    expect(out.chapters[0].research).toEqual(["Sturm", "Hütte"]);
    expect(out.chapters[0].title).toMatch(/^EN:/);
    expect(out.chapters[0].goal).toMatch(/^EN:/);
    expect(out.chapters[0].conflict).toMatch(/^EN:/);
    expect(out.chapters[0].outcome).toMatch(/^EN:/);
    expect(out.chapters[0].pov).toMatch(/^EN:/);
    expect(out.chapters[0].subchapters).toEqual([
      expect.stringMatching(/^EN:/),
      expect.stringMatching(/^EN:/),
    ]);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("mutiert die Eingabe nicht", async () => {
    const { fn } = fakeComplete("EN:x");
    const src = outline();
    const before = JSON.stringify(src);
    await translateOutline(src, "en", fn);
    expect(JSON.stringify(src)).toBe(before);
  });

  it("ruft complete nicht für leere Gliederungen", async () => {
    const { fn, calls } = fakeComplete("SHOULD NOT BE USED");
    const out = await translateOutline({ totalWords: 0, chapters: [] }, "en", fn);
    expect(out.chapters).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("überspringt leere Felder ohne Provider-Call", async () => {
    const emptyOutline: BookOutline = {
      totalWords: 0,
      chapters: [
        {
          title: "",
          goal: "",
          conflict: "",
          outcome: "",
          estimatedWords: 0,
          pov: "",
          research: [],
          subchapters: [""],
        },
      ],
    };
    const counted = vi.fn(async (_p: string) => "EN:x");
    const out = await translateOutline(emptyOutline, "en", counted);
    expect(counted).not.toHaveBeenCalled();
    expect(out.chapters[0].title).toBe("");
    expect(out.chapters[0].subchapters).toEqual([""]);
  });

  it("erhält Markup in Gliederungs-Feldern", async () => {
    const src: BookOutline = {
      totalWords: 100,
      chapters: [
        {
          title: "Kapitel **eins**",
          goal: "Ziel",
          conflict: "Konflikt",
          outcome: "Ergebnis",
          estimatedWords: 100,
          pov: "Ich",
          research: [],
          subchapters: [],
        },
      ],
    };
    const { fn } = fakeComplete((prompt) => {
      const m = prompt.match(/TEXT:\n([\s\S]*)$/);
      return m?.[1] ?? prompt;
    });
    const out = await translateOutline(src, "en", fn);
    expect(out.chapters[0].title).toBe("Kapitel **eins**");
  });
});
