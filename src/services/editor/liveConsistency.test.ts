// Tests für den Live-Konsistenzwächter (WP3.1).
//
// Kernaussage: Der Wächter meldet nur WIDERSPRÜCHE — Fälle, in denen beide
// Seiten explizit sind. Ein Wächter, der beim Schreiben ständig falsch
// anspringt, wird abgeschaltet und ist dann nutzlos.

import { describe, it, expect } from "vitest";
import {
  checkTextAgainstCharacter,
  checkTextLive,
  filterIntentionalChanges,
  isIntentionalChange,
  ATTRIBUTE_CATEGORIES,
  type LiveFinding,
} from "./liveConsistency";
import type { Character } from "@/services/characters/characters";

function char(over: Partial<Character> = {}): Character {
  return {
    id: "c1",
    projectId: "p1",
    name: "Anna",
    aliases: [],
    age: "34",
    role: "Protagonistin",
    traits: "blaue Augen, langes blondes Haar",
    notes: "",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("checkTextAgainstCharacter — Widerspruch erkannt", () => {
  it("meldet abweichende Augenfarbe", () => {
    const text = "Anna blickte auf. Ihre braunen Augen musterten den Raum.";
    const f = checkTextAgainstCharacter(text, char());
    expect(f).toHaveLength(1);
    expect(f[0].category).toBe("augenfarbe");
    expect(f[0].expected).toBe("blau");
    expect(f[0].found).toBe("braun");
    expect(f[0].characterName).toBe("Anna");
  });

  it("erkennt auch die umgekehrte Wortstellung", () => {
    const text = "Anna blickte auf. Die Augen waren braun und müde.";
    const f = checkTextAgainstCharacter(text, char());
    expect(f).toHaveLength(1);
    expect(f[0].found).toBe("braun");
  });

  it("meldet abweichende Haarfarbe", () => {
    const text = "Anna schüttelte ihr schwarzes Haar.";
    const f = checkTextAgainstCharacter(text, char());
    expect(f.some((x) => x.category === "haarfarbe" && x.found === "schwarz")).toBe(true);
  });

  it("liefert den Satz als Belegstelle", () => {
    const text = "Anna blickte auf. Ihre braunen Augen musterten den Raum.";
    const f = checkTextAgainstCharacter(text, char());
    expect(f[0].excerpt).toContain("braunen Augen");
  });

  it("gibt die Zeichenposition an", () => {
    const text = "Anna blickte auf. Ihre braunen Augen musterten den Raum.";
    const f = checkTextAgainstCharacter(text, char());
    expect(f[0].index).toBeGreaterThan(0);
    expect(text.slice(f[0].index)).toMatch(/^braun/i);
  });
});

describe("checkTextAgainstCharacter — KEIN Fehlalarm", () => {
  it("meldet nichts bei übereinstimmender Augenfarbe", () => {
    const text = "Anna blickte auf. Ihre blauen Augen musterten den Raum.";
    expect(checkTextAgainstCharacter(text, char())).toEqual([]);
  });

  it("meldet nichts, wenn die Figur nicht vorkommt", () => {
    const text = "Bertram blickte auf. Seine braunen Augen musterten den Raum.";
    expect(checkTextAgainstCharacter(text, char())).toEqual([]);
  });

  it("meldet nichts, wenn die Figur keine Merkmale hat", () => {
    const text = "Anna blickte auf. Ihre braunen Augen musterten den Raum.";
    expect(checkTextAgainstCharacter(text, char({ traits: "" }))).toEqual([]);
  });

  it("meldet nichts, wenn im Text kein Merkmal genannt wird", () => {
    const text = "Anna blickte auf und verließ den Raum.";
    expect(checkTextAgainstCharacter(text, char())).toEqual([]);
  });

  it("meldet nichts, wenn die Figurendaten das Merkmal nicht nennen", () => {
    // Text nennt "braune Augen", die Figur hat nur "langes Haar" — das ist
    // eine Lücke, kein Widerspruch.
    const text = "Anna blickte auf. Ihre braunen Augen musterten den Raum.";
    expect(checkTextAgainstCharacter(text, char({ traits: "langes Haar" }))).toEqual([]);
  });

  it("meldet nichts, wenn nur ein Adjektiv ohne Kategoriebezug vorkommt", () => {
    // "braun" allein (z. B. "brauner Mantel") ist kein Augenfarbe-Hinweis.
    const text = "Anna trug einen braunen Mantel.";
    expect(checkTextAgainstCharacter(text, char())).toEqual([]);
  });

  it("findet die Figur auch über einen Alias", () => {
    const text = "Anni blickte auf. Ihre braunen Augen musterten den Raum.";
    const f = checkTextAgainstCharacter(text, char({ aliases: ["Anni"] }));
    expect(f).toHaveLength(1);
  });
});

describe("checkTextLive", () => {
  it("prüft alle übergebenen Figuren", () => {
    const chars = [
      char({ id: "c1", name: "Anna" }),
      char({ id: "c2", name: "Bertram", traits: "grüne Augen" }),
    ];
    const text = "Anna und Bertram. Annas braune Augen, Bertrams graue Augen.";
    const r = checkTextLive(text, "p1", chars);
    expect(r.charactersChecked).toBe(2);
    expect(r.findings).toHaveLength(2);
  });

  it("liefert leeres Ergebnis bei leerem Text", () => {
    const r = checkTextLive("   ", "p1", [char()]);
    expect(r.findings).toEqual([]);
  });

  it("liefert leeres Ergebnis ohne Figuren", () => {
    expect(checkTextLive("Text", "p1", []).findings).toEqual([]);
  });
});

describe("isIntentionalChange — bewusste Änderung", () => {
  it("erkennt eine Haarfärbung", () => {
    expect(isIntentionalChange("Sie färbte ihr Haar schwarz.")).toBe(true);
  });

  it("erkennt einen Haarschnitt", () => {
    expect(isIntentionalChange("Sie schnitt sich die Haare kurz.")).toBe(true);
  });

  it("erkennt keine normale Beschreibung", () => {
    expect(isIntentionalChange("Ihre braunen Augen musterten den Raum.")).toBe(false);
  });

  it("filtert solche Befunde heraus", () => {
    const findings: LiveFinding[] = [
      {
        characterId: "c1", characterName: "Anna", category: "haarfarbe",
        categoryLabel: "Haarfarbe", expected: "blond", found: "schwarz",
        excerpt: "Sie färbte ihr Haar schwarz.", index: 0,
      },
      {
        characterId: "c1", characterName: "Anna", category: "augenfarbe",
        categoryLabel: "Augenfarbe", expected: "blau", found: "braun",
        excerpt: "Ihre braunen Augen musterten den Raum.", index: 0,
      },
    ];
    const kept = filterIntentionalChanges(findings);
    expect(kept).toHaveLength(1);
    expect(kept[0].category).toBe("augenfarbe");
  });
});

describe("ATTRIBUTE_CATEGORIES", () => {
  it("deckt Augenfarbe und Haarfarbe ab", () => {
    const ids = ATTRIBUTE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("augenfarbe");
    expect(ids).toContain("haarfarbe");
  });

  it("hat für jede Kategorie Werte und Substantive", () => {
    for (const c of ATTRIBUTE_CATEGORIES) {
      expect(c.values.length).toBeGreaterThan(2);
      expect(c.nouns.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(2);
    }
  });
});
