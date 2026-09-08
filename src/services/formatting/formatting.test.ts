// @vitest-environment jsdom
// Engine-Tests für die erweiterte Formatierung (Sprint 24, Agent 5).
import { describe, it, expect } from "vitest";
import {
  applyFormat,
  getFormatCategories,
  getKeyboardShortcuts,
  insertAtCursor,
  stripFormatting,
  wrapText,
} from "./formatting";

describe("getFormatCategories", () => {
  it("gibt alle 7 Kategorien mit Aktionen zurück", () => {
    const cats = getFormatCategories();
    expect(cats.map((c) => c.id)).toEqual([
      "basis",
      "headings",
      "lists",
      "links",
      "quotes",
      "tables",
      "separators",
    ]);
    for (const cat of cats) {
      expect(cat.actions.length).toBeGreaterThan(0);
    }
  });
});

describe("applyFormat", () => {
  it("wendet die Aktion auf die Selektion an (bold)", () => {
    expect(applyFormat("bold", "Hallo")).toBe("**Hallo**");
  });

  it("nutzt einen Platzhalter bei leerer Selektion statt leerem Markup", () => {
    expect(applyFormat("bold", "")).toBe("**Text**");
    expect(applyFormat("h1", "")).toBe("# Text");
  });

  it("formatiert Überschriften, Listen, Links, Zitate, Tabellen und Trenner", () => {
    expect(applyFormat("h2", "Kapitel")).toBe("## Kapitel");
    expect(applyFormat("unordered", "a\nb")).toBe("- a\n- b");
    expect(applyFormat("ordered", "a\nb")).toBe("1. a\n2. b");
    expect(applyFormat("task", "todo")).toBe("- [ ] todo");
    expect(applyFormat("link", "hier")).toBe("[hier](url)");
    expect(applyFormat("image", "alt")).toBe("![alt](url)");
    expect(applyFormat("footnote", "Wort")).toBe("Wort[^1]");
    expect(applyFormat("blockquote", "Zitat")).toBe("> Zitat");
    expect(applyFormat("italic", "x")).toBe("*x*");
    expect(applyFormat("strikethrough", "x")).toBe("~~x~~");
    expect(applyFormat("code", "x")).toBe("`x`");
    expect(applyFormat("table", "")).toContain("| Spalte 1 | Spalte 2 |");
    expect(applyFormat("hr", "")).toContain("---");
    expect(applyFormat("pagebreak", "")).toContain("page-break-after");
  });

  it("wirft bei unbekannter Aktions-ID", () => {
    expect(() => applyFormat("gibts-nicht", "x")).toThrowError(/Unbekannte Format-Aktion/);
  });
});

describe("wrapText", () => {
  it("wrappet Text mit dem gegebenen Wrapper", () => {
    expect(wrapText("Hallo", "**")).toBe("**Hallo**");
    expect(wrapText("Hallo", "_")).toBe("_Hallo_");
    expect(wrapText("", "**")).toBe("****");
  });
});

describe("insertAtCursor", () => {
  it("fügt an der Cursor-Position ein und meldet den neuen Cursor", () => {
    expect(insertAtCursor("Hallo Welt", "!", 5)).toEqual({ text: "Hallo! Welt", newCursor: 6 });
  });

  it("clampt Positionen außerhalb des Textes", () => {
    expect(insertAtCursor("abc", "X", -5)).toEqual({ text: "Xabc", newCursor: 1 });
    expect(insertAtCursor("abc", "X", 99)).toEqual({ text: "abcX", newCursor: 4 });
  });
});

describe("getKeyboardShortcuts", () => {
  it("liefert Shortcuts für die Kern-Aktionen", () => {
    const shortcuts = getKeyboardShortcuts();
    const byAction = new Map(shortcuts.map((s) => [s.action, s.key]));
    expect(byAction.get("bold")).toBe("Ctrl+B");
    expect(byAction.get("italic")).toBe("Ctrl+I");
    expect(byAction.get("link")).toBe("Ctrl+K");
    expect(shortcuts.length).toBeGreaterThanOrEqual(10);
  });
});

describe("stripFormatting", () => {
  it("entfernt Markdown-Markup", () => {
    expect(stripFormatting("**fett** und *kursiv*")).toBe("fett und kursiv");
    expect(stripFormatting("# Titel")).toBe("Titel");
    expect(stripFormatting("- Punkt")).toBe("Punkt");
    expect(stripFormatting("[Link](http://x)")).toBe("Link");
  });
});
