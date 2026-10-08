// @vitest-environment jsdom
/**
 * Tests: UniversalFranchiseEncyclopedia (WP 120.2, Meilenstein 58.0 / v7.0.0)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  linkifyManuscript,
  EPOCHS,
  CATEGORIES,
  buildTaxonomy,
  buildCompanionBook,
  createSampleEncyclopedia,
  createSampleCompanionBook,
  type EncyclopediaRef,
  type EncyclopediaEntry,
} from "./universalFranchiseEncyclopedia";

describe("hashString", () => {
  it("ist deterministisch für gleichen Input", () => {
    expect(hashString("Falkenstein")).toBe(hashString("Falkenstein"));
    expect(hashString("")).toBe(hashString(""));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("Haus Falkenstein")).not.toBe(hashString("Haus Morgentau"));
  });

  it("liefert einen uint32-Wert", () => {
    const h = hashString("Aetherquell");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });

  it("liefert Werte im Bereich [0, 1)", () => {
    const rng = createSeededRandom(1234);
    for (let i = 0; i < 200; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("liefert für unterschiedliche Seeds unterschiedliche Sequenzen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(a()).not.toBe(b());
  });
});

describe("EPOCHS", () => {
  it("enthält fünf Epochen", () => {
    expect(EPOCHS).toHaveLength(5);
  });

  it("enthält die erwarteten Epochennamen", () => {
    expect(EPOCHS).toContain("Schöpfungszeitalter");
    expect(EPOCHS).toContain("Erstes Zeitalter");
    expect(EPOCHS).toContain("Zweites Zeitalter");
    expect(EPOCHS).toContain("Drittes Zeitalter");
    expect(EPOCHS).toContain("Gegenwart");
  });
});

describe("CATEGORIES", () => {
  it("enthält sechs Kategorien", () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it("enthält die erwarteten Kategorien", () => {
    expect(CATEGORIES).toContain("Herrscherhäuser");
    expect(CATEGORIES).toContain("Geografie");
    expect(CATEGORIES).toContain("Magie");
    expect(CATEGORIES).toContain("Religion");
    expect(CATEGORIES).toContain("Kriege");
    expect(CATEGORIES).toContain("Artefakte");
  });
});

describe("linkifyManuscript", () => {
  const encyclopedia = createSampleEncyclopedia();

  it("löst explizite [[Term]]-Verweise auf", () => {
    const result = linkifyManuscript("[[Haus Falkenstein]] regierte.", encyclopedia);
    expect(result.linkedText).toBe("[Haus Falkenstein](#haus-falkenstein) regierte.");
    expect(result.links).toHaveLength(1);
  });

  it("verlinkt Klartext-Vorkommen von Eintragsnamen", () => {
    const result = linkifyManuscript("Das Haus Falkenstein ist alt.", encyclopedia);
    expect(result.linkedText).toBe("Das [Haus Falkenstein](#haus-falkenstein) ist alt.");
  });

  it("liefert ein links-Array mit term, targetId und category", () => {
    const result = linkifyManuscript("Das Haus Falkenstein ist alt.", encyclopedia);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({
      term: "Haus Falkenstein",
      targetId: "haus-falkenstein",
      category: "Herrscherhäuser",
    });
  });

  it("bevorzugt den längsten Namen (kein Teil-Match)", () => {
    const custom: EncyclopediaRef[] = [
      { id: "falkenstein", name: "Falkenstein", category: "Geografie" },
      {
        id: "schlacht-von-falkenstein",
        name: "Schlacht von Falkenstein",
        category: "Kriege",
      },
    ];
    const result = linkifyManuscript("Die Schlacht von Falkenstein war blutig.", custom);
    expect(result.linkedText).toBe(
      "Die [Schlacht von Falkenstein](#schlacht-von-falkenstein) war blutig.",
    );
    expect(result.links).toHaveLength(1);
    expect(result.links[0].targetId).toBe("schlacht-von-falkenstein");
  });

  it("dedupliziert Links je Ziel in Reihenfolge des Auftretens", () => {
    const result = linkifyManuscript(
      "Haus Falkenstein und abermals Haus Falkenstein.",
      encyclopedia,
    );
    expect(result.links).toHaveLength(1);
    expect(result.links[0].targetId).toBe("haus-falkenstein");
  });

  it("liefert keine Links für unbekannte Begriffe", () => {
    const result = linkifyManuscript("Ein völlig unverfänglicher Satz.", encyclopedia);
    expect(result.links).toHaveLength(0);
    expect(result.linkedText).toBe("Ein völlig unverfänglicher Satz.");
  });
});

describe("buildTaxonomy", () => {
  it("übernimmt Epochen und Kategorien", () => {
    const tax = buildTaxonomy([...EPOCHS], [...CATEGORIES]);
    expect(tax.epochs).toHaveLength(5);
    expect(tax.categories).toHaveLength(6);
    expect(tax.epochs).toEqual([...EPOCHS]);
    expect(tax.categories).toEqual([...CATEGORIES]);
  });

  it("erzeugt Querverbindungen als Kreuzprodukt", () => {
    const tax = buildTaxonomy([...EPOCHS], [...CATEGORIES]);
    expect(tax.crossLinks).toHaveLength(5 * 6);
    expect(tax.crossLinks).toContain("Schöpfungszeitalter → Herrscherhäuser");
    expect(tax.crossLinks).toContain("Gegenwart → Artefakte");
  });

  it("kopiert die Eingabe-Arrays (keine Referenzteilung)", () => {
    const epochs = ["Epoche A"];
    const categories = ["Kategorie X"];
    const tax = buildTaxonomy(epochs, categories);
    expect(tax.epochs).not.toBe(epochs);
    expect(tax.categories).not.toBe(categories);
  });
});

describe("buildCompanionBook", () => {
  const encyclopedia = createSampleEncyclopedia();

  it("liefert Titel, Abschnitte, Index und Seitenzahl", () => {
    const book = buildCompanionBook(encyclopedia, 42);
    expect(typeof book.title).toBe("string");
    expect(book.title.length).toBeGreaterThan(0);
    expect(book.sections).toHaveLength(5);
    expect(book.index).toHaveLength(encyclopedia.length);
    expect(book.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("erzeugt einen Abschnitt je Epoche", () => {
    const book = buildCompanionBook(encyclopedia, 42);
    const headings = book.sections.map((s) => s.heading);
    expect(headings).toEqual([...EPOCHS]);
  });

  it("verteilt alle Einträge auf die Abschnitte", () => {
    const book = buildCompanionBook(encyclopedia, 42);
    const total = book.sections.reduce((sum, s) => sum + s.entries.length, 0);
    expect(total).toBe(encyclopedia.length);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = buildCompanionBook(encyclopedia, 42);
    const b = buildCompanionBook(encyclopedia, 42);
    expect(a).toEqual(b);
  });

  it("sortiert den Index alphabetisch", () => {
    const book = buildCompanionBook(encyclopedia, 42);
    const sorted = [...book.index].sort((x, y) => x.localeCompare(y, "de"));
    expect(book.index).toEqual(sorted);
  });

  it("formatiert Abschnitts-Einträge mit Name, Kategorie und Beschreibung", () => {
    const entries: EncyclopediaEntry[] = [
      { id: "e1", name: "Testartefakt", category: "Artefakte", description: "Eine Beschreibung." },
    ];
    const book = buildCompanionBook(entries, 7);
    const allEntries = book.sections.flatMap((s) => s.entries);
    expect(allEntries).toContain("Testartefakt (Artefakte): Eine Beschreibung.");
  });
});

describe("createSampleEncyclopedia", () => {
  it("liefert gültige Enzyklopädie-Einträge", () => {
    const entries = createSampleEncyclopedia();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe("string");
      expect(entry.description.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(entry.category);
    }
  });

  it("vergibt eindeutige IDs", () => {
    const entries = createSampleEncyclopedia();
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("createSampleCompanionBook", () => {
  it("liefert einen gültigen Begleitband", () => {
    const book = createSampleCompanionBook();
    expect(typeof book.title).toBe("string");
    expect(book.title.length).toBeGreaterThan(0);
    expect(book.sections).toHaveLength(5);
    expect(book.index.length).toBe(createSampleEncyclopedia().length);
    expect(book.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("ist deterministisch", () => {
    expect(createSampleCompanionBook()).toEqual(createSampleCompanionBook());
  });
});
