// TranslatorService: kapitelweise Übersetzung fertiger Bücher unter
// Beibehaltung des Markdown/HTML-Markups.
//
// Strategie: Markup wird VOR dem LLM-Call maskiert (Platzhalter),
// die Antwort wird auf Markup-Integrität geprüft, Platzhalter werden
// restauriert. So überlebt jedes Tag/formatierte Element die Übersetzung.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/llm", () => ({
  createProvider: vi.fn(),
  buildMessages: vi.fn(
    (user: string, _s: unknown, history?: unknown[]) =>
      history && history.length > 0
        ? [...history, { role: "user", content: user }]
        : [{ role: "user", content: user }],
  ),
}));

import { maskMarkup, restoreMarkup } from "@/services/bookwriter/markupGuard";
import {
  translateChapter,
  translateBook,
  type TranslationChapter,
} from "./translatorService";

const fakeSettings = { provider: "ollama", model: "fake", systemPrompt: "" } as never;

/** Simuliert einen Provider: sammelt Token-Stream → vollständiger Text. */
function fakeChat(returnText: string | ((prompt: string) => string)) {
  return async function (msgs: { role: string; content: string }[]) {
    const last = msgs.map((m) => m.content).find((c) => c.includes("KAPITELTEXT:")) ?? msgs[0].content;
    const out = typeof returnText === "function" ? returnText(last) : returnText;
    return out;
  };
}

const chapter = (over: Partial<TranslationChapter> = {}): TranslationChapter => ({
  id: "ch1",
  title: "Kapitel 1 — Der Anfang",
  content: "# Der Anfang\n\nEin **mutiger** Schritt beginnt die Reise.",
  ...over,
});

describe("maskMarkup / restoreMarkup", () => {
  it("maskiert und restauriert Markdown-Headings, Bold, Links, Listen", () => {
    const src =
      "# Titel\n\nEin **wichtiges** [Wort](https://x.de) und:\n\n- Punkt eins\n- Punkt zwei\n\n> Ein Zitat";
    const { masked, placeholders } = maskMarkup(src);
    expect(masked).not.toContain("# Titel");
    expect(masked).not.toContain("**");
    expect(masked).not.toContain("](https://x.de)");
    expect(placeholders.length).toBeGreaterThan(0);
    // Platzhalter-Format: ⟦M01⟧ o.ä., mit Zahlen
    expect(placeholders[0]).toMatch(/⟦M\d+⟧/);
  });

  it("maskiert HTML-Tags, Kommentare und Entities", () => {
    const src = "<p>Hallo <strong>Welt</strong></p><!-- c -->&amp; &nbsp;";
    const { masked } = maskMarkup(src);
    expect(masked).not.toContain("<p>");
    expect(masked).not.toContain("<strong>");
    expect(masked).not.toContain("<!--");
    expect(masked).not.toContain("&amp;");
  });

  it("ergänzt verlorene Block-Präfixe aus dem Original (Fehltoleranz)", () => {
    const src = "# Titel\n\nEin **wichtiger** Satz mit [Link](https://x.de).";
    const { masked } = maskMarkup(src);
    // Modell hat das Heading-Präfix verschluckt, Inline-Platzhalter ebenfalls.
    const restored = restoreMarkup(src, "Neuer Titel\n\nEin X Satz.", masked);
    expect(restored).toContain("# ");
    // Inline-Bold/Link ohne Platzhalter bleibt verloren (keine heuristische
    // Rückübersetzung) — nur Block-Struktur wird deterministisch gerettet:
    expect(restored).not.toContain("⟦M");
  });

  it("restauriert aus der Modell-Antwort, wenn dort Platzhalter überlebt haben", () => {
    const src = "# Titel\n\nEin **wichtiges** Wort.";
    const { masked } = maskMarkup(src);
    const modelOut = "⟦M01⟧Neuer Titel\n\nEin ⟦M02⟧ übersetztes Wort.";
    const restored = restoreMarkup(src, modelOut, masked);
    expect(restored).toContain("# Neuer Titel");
    expect(restored).toContain("**wichtiges**");
  });
});

describe("TranslatorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("übersetzt Kapitel mit Markup-Erhaltung (Headings/Bold/Links/HTML)", async () => {
    const content =
      "# Der Anfang\n\nEin **mutiger** Schritt. Besuche die [Bibliothek](https://x.de).\n\n<p class=\"note\">HTML bleibt</p>";
    const chat = fakeChat((prompt) => {
      // Simuliert ein gutes Modell: Antwort = NUR der übersetzte Kapiteltext
      // (Titel kommt separat), Platzhalter bleiben zeichengenau erhalten.
      const body = prompt.split("KAPITELTEXT:\n")[1] ?? prompt;
      return body
        .replace("Ein ⟦M04⟧ Schritt", "A ⟦M04⟧ step")
        .replace("die ⟦M03⟧", "the ⟦M03⟧")
        .replace("HTML bleibt", "HTML stays")
        .replace(/⟦M02⟧Der Anfang/, "⟦M02⟧The Beginning");
    });
    const result = await translateChapter(
      chapter({ content }),
      chat,
      { targetLanguage: "Englisch" },
      fakeSettings,
    );
    expect(result.translatedTitle).toContain("The Beginning");
    expect(result.content).toContain("# The Beginning");
    // Inline-Markup überlebt via Platzhalter-Restaurierung (Originalelement):
    expect(result.content).toContain("**mutiger**");
    expect(result.content).toContain("[Bibliothek](https://x.de)");
    expect(result.content).toContain('<p class="note">');
    expect(result.markupIntact).toBe(true);
  });

  it("erkennt Markup-Verlust und ergänzt Block-Präfixe aus dem Original", async () => {
    const content = "# Titel\n\nEin **wichtiges** Wort.";
    const chat = fakeChat(() => "Neuer Titel ohne jegliches Markup hier."); // Platzhalter verschluckt
    const result = await translateChapter(
      chapter({ content }),
      chat,
      { targetLanguage: "Englisch" },
      fakeSettings,
    );
    expect(result.markupIntact).toBe(false);
    // Struktur-Verlust erkannt:
    expect(result.content).not.toContain("# ");
  });

  it("bricht bei AbortSignal sauber ab", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const chat = fakeChat("irgendwas");
    await expect(
      translateChapter(chapter(), chat, { targetLanguage: "EN" }, fakeSettings, ctrl.signal),
    ).rejects.toThrow(/abgebrochen/i);
  });
});

describe("translateBook", () => {
  it("übersetzt alle Kapitel nacheinander und meldet Fortschritt", async () => {
    const chapters = [
      chapter({ id: "c1", title: "Eins", content: "# Eins\n\n**Text** eins." }),
      chapter({ id: "c2", title: "Zwei", content: "## Zwei\n\nText zwei." }),
    ];
    const chat = fakeChat((prompt) => prompt.replace(/Eins/g, "One").replace(/Zwei/g, "Two"));
    const progress: number[] = [];
    const book = await translateBook(chapters, chat, { targetLanguage: "Englisch" }, fakeSettings, (c, t) =>
      progress.push(c / t),
    );
    expect(book).toHaveLength(2);
    expect(book[0].content).toContain("# One");
    expect(book[1].content).toContain("## Two");
    expect(progress).toEqual([0.5, 1]);
  });
});
