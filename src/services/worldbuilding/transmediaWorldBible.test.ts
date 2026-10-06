/**
 * Tests: TransmediaWorldBible (WP 74.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createEmptyBible,
  addCanonEntry,
  addCosmologyLevel,
  checkCollisions,
  auditAllCollisions,
  getEntriesByTier,
  searchEntries,
  createSampleBible,
  formatWorldBible,
  exportAsMarkdown,
  TIER_LABELS,
  type CanonEntry,
  type CosmologyLevel,
} from "./transmediaWorldBible";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("createEmptyBible", () => {
  it("erstellt leere Bibel", () => {
    const bible = createEmptyBible("Test");
    expect(bible.title).toBe("Test");
    expect(bible.entries).toEqual([]);
    expect(bible.cosmologyLevels).toEqual([]);
  });
});

describe("addCanonEntry", () => {
  it("fügt Eintrag hinzu", () => {
    const bible = createEmptyBible("Test");
    const entry: CanonEntry = {
      id: "e1",
      title: "Titel",
      tier: "core",
      description: "Beschreibung",
      contradictions: [],
    };
    const updated = addCanonEntry(bible, entry);
    expect(updated.entries).toHaveLength(1);
  });

  it("verändert nicht Original", () => {
    const bible = createEmptyBible("Test");
    const entry: CanonEntry = {
      id: "e1",
      title: "Titel",
      tier: "core",
      description: "Beschreibung",
      contradictions: [],
    };
    addCanonEntry(bible, entry);
    expect(bible.entries).toHaveLength(0);
  });
});

describe("addCosmologyLevel", () => {
  it("fügt Ebene hinzu", () => {
    const bible = createEmptyBible("Test");
    const level: CosmologyLevel = {
      id: "l1",
      name: "Ebene",
      description: "Beschreibung",
      inviolableLaws: [],
    };
    const updated = addCosmologyLevel(bible, level);
    expect(updated.cosmologyLevels).toHaveLength(1);
  });
});

describe("checkCollisions", () => {
  it("findet keine Kollisionen bei leerem Kanon", () => {
    const bible = createEmptyBible("Test");
    const entry: CanonEntry = {
      id: "e1",
      title: "Titel",
      tier: "core",
      description: "Beschreibung",
      contradictions: ["Widerspruch"],
    };
    const report = checkCollisions(bible, entry);
    expect(report.conflicts).toEqual([]);
    expect(report.severity).toBe("none");
  });

  it("findet Kollisionen bei widersprüchlichen Einträgen", () => {
    let bible = createEmptyBible("Test");
    bible = addCanonEntry(bible, {
      id: "e1",
      title: "Eins",
      tier: "core",
      description: "Beschreibung",
      contradictions: ["Die Welt ist ewig"],
    });
    const newEntry: CanonEntry = {
      id: "e2",
      title: "Zwei",
      tier: "core",
      description: "Beschreibung",
      contradictions: ["Die Welt ist ewig"],
    };
    const report = checkCollisions(bible, newEntry);
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(report.severity).toBe("minor");
  });
});

describe("auditAllCollisions", () => {
  it("findet keine Kollisionen in leerer Bibel", () => {
    const bible = createEmptyBible("Test");
    expect(auditAllCollisions(bible)).toEqual([]);
  });

  it("findet Kollisionen bei widersprüchlichen Einträgen", () => {
    let bible = createEmptyBible("Test");
    bible = addCanonEntry(bible, {
      id: "e1",
      title: "Eins",
      tier: "core",
      description: "Beschreibung",
      contradictions: ["Die Welt ist ewig"],
    });
    bible = addCanonEntry(bible, {
      id: "e2",
      title: "Zwei",
      tier: "core",
      description: "Beschreibung",
      contradictions: ["Die Welt ist ewig"],
    });
    const collisions = auditAllCollisions(bible);
    expect(collisions.length).toBeGreaterThan(0);
  });
});

describe("getEntriesByTier", () => {
  it("filtert nach Kern-Kanon", () => {
    const bible = createSampleBible();
    const core = getEntriesByTier(bible, "core");
    expect(core.every((e) => e.tier === "core")).toBe(true);
  });

  it("filtert nach Prequel-Kanon", () => {
    const bible = createSampleBible();
    const prequel = getEntriesByTier(bible, "prequel");
    expect(prequel.every((e) => e.tier === "prequel")).toBe(true);
  });

  it("filtert nach Legenden", () => {
    const bible = createSampleBible();
    const legend = getEntriesByTier(bible, "legend");
    expect(legend.every((e) => e.tier === "legend")).toBe(true);
  });
});

describe("searchEntries", () => {
  it("findet Einträge nach Titel", () => {
    const bible = createSampleBible();
    const results = searchEntries(bible, "Schöpfung");
    expect(results.length).toBeGreaterThan(0);
  });

  it("findet Einträge nach Beschreibung", () => {
    const bible = createSampleBible();
    const results = searchEntries(bible, "Aether");
    expect(results.length).toBeGreaterThan(0);
  });

  it("findet keine Einträge bei unbekanntem Begriff", () => {
    const bible = createSampleBible();
    expect(searchEntries(bible, "xyz123")).toEqual([]);
  });
});

describe("createSampleBible", () => {
  it("erstellt Beispiel-Bibel mit Daten", () => {
    const bible = createSampleBible();
    expect(bible.entries.length).toBeGreaterThan(0);
    expect(bible.cosmologyLevels.length).toBeGreaterThan(0);
  });

  it("hat Einträge auf allen Tier-Stufen", () => {
    const bible = createSampleBible();
    expect(getEntriesByTier(bible, "core").length).toBeGreaterThan(0);
    expect(getEntriesByTier(bible, "prequel").length).toBeGreaterThan(0);
    expect(getEntriesByTier(bible, "legend").length).toBeGreaterThan(0);
  });
});

describe("formatWorldBible", () => {
  it("formatiert Bibel als Text", () => {
    const bible = createSampleBible();
    const text = formatWorldBible(bible);
    expect(text).toContain("TRANSMEDIALE WELT-BIBEL");
    expect(text).toContain("KANON");
    expect(text).toContain("KOSMOLOGIE");
  });
});

describe("exportAsMarkdown", () => {
  it("exportiert als Markdown", () => {
    const bible = createSampleBible();
    const md = exportAsMarkdown(bible);
    expect(md).toContain("#");
    expect(md).toContain("##");
  });
});

describe("TIER_LABELS", () => {
  it("hat alle Tier-Labels", () => {
    expect(TIER_LABELS.core).toBeTruthy();
    expect(TIER_LABELS.prequel).toBeTruthy();
    expect(TIER_LABELS.legend).toBeTruthy();
  });
});
