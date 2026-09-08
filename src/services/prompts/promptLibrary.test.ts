// Sprint 24, Agent 4: Tests fuer die PromptLibrary-Engine (NEUE Datei).
// Deckt ab: vordefinierte Prompts, Kategorie-Filter, Suche, Favoriten,
// Hinzufuegen/Loeschen, Nutzungszaehlung. Keine LLM-Calls, kein Netzwerk.
import { describe, it, expect, beforeEach } from "vitest";
import {
  addPrompt,
  deletePrompt,
  getFavorites,
  getPrompts,
  getPromptsByCategory,
  incrementUsage,
  resetLibraryForTests,
  searchPrompts,
  toggleFavorite,
} from "./promptLibrary";

beforeEach(() => {
  resetLibraryForTests();
});

describe("getPrompts", () => {
  it("gibt die vordefinierten Prompts zurueck (20+)", async () => {
    const prompts = await getPrompts();
    expect(prompts.length).toBeGreaterThanOrEqual(20);
    const names = prompts.map((p) => p.name);
    for (const expected of [
      "Kapitel umschreiben",
      "Dialog verbessern",
      "Spannung aufbauen",
      "Korrekturlesen",
      "SEO Optimierung",
      "Charakter entwickeln",
      "Plot Twist finden",
      "Show don't tell",
      "Übergänge glätten",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("deckt alle sechs Kategorien ab", async () => {
    const prompts = await getPrompts();
    const cats = new Set(prompts.map((p) => p.category));
    for (const c of ["writing", "editing", "research", "marketing", "business", "creative"]) {
      expect(cats.has(c as never)).toBe(true);
    }
  });
});

describe("searchPrompts", () => {
  it("findet einen Prompt per Name", async () => {
    const found = await searchPrompts("SEO");
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((p) => p.name === "SEO Optimierung")).toBe(true);
  });

  it("findet per Tag und ist case-insensitiv", async () => {
    const found = await searchPrompts("plOT");
    expect(found.some((p) => p.name === "Plot Twist finden")).toBe(true);
  });

  it("leere Suche liefert alle Prompts", async () => {
    expect((await searchPrompts("   ")).length).toBe((await getPrompts()).length);
  });
});

describe("getPromptsByCategory", () => {
  it("filtert nach Kategorie", async () => {
    const writing = await getPromptsByCategory("writing");
    expect(writing.length).toBeGreaterThan(0);
    expect(writing.every((p) => p.category === "writing")).toBe(true);
    const marketing = await getPromptsByCategory("marketing");
    expect(marketing.some((p) => p.name === "SEO Optimierung")).toBe(true);
  });
});

describe("toggleFavorite / getFavorites", () => {
  it("aendert den Favorit-Status und pflegt die Favoritenliste", async () => {
    expect(await getFavorites()).toEqual([]);
    const all = await getPrompts();
    const id = all[0].id;
    await toggleFavorite(id);
    expect((await getFavorites()).map((p) => p.id)).toEqual([id]);
    await toggleFavorite(id);
    expect(await getFavorites()).toEqual([]);
  });

  it("wirft bei unbekannter id", async () => {
    await expect(toggleFavorite("gibt-es-nicht")).rejects.toThrow();
  });
});

describe("addPrompt / deletePrompt / incrementUsage", () => {
  it("Hinzufuegen, Nutzung zaehlen und Loeschen im Roundtrip", async () => {
    const before = (await getPrompts()).length;
    const created = await addPrompt({
      name: "Testprompt Sprint24",
      category: "writing",
      description: "Nur ein Test",
      prompt: "Mache {{was}}",
      variables: [{ name: "was", label: "Was", defaultValue: "alles" }],
      tags: ["test"],
      favorite: false,
    });
    expect(created.id).toBeTruthy();
    expect(created.usageCount).toBe(0);
    expect((await getPrompts()).length).toBe(before + 1);

    await incrementUsage(created.id);
    await incrementUsage(created.id);
    expect((await searchPrompts("Sprint24"))[0].usageCount).toBe(2);

    await deletePrompt(created.id);
    expect((await getPrompts()).length).toBe(before);
  });

  it("deletePrompt wirft bei unbekannter id", async () => {
    await expect(deletePrompt("gibt-es-nicht")).rejects.toThrow();
  });
});
