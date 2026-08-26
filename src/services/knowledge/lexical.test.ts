// Unit-Tests: lexikalische Suche (BM25, exakt, RRF) — vollständig offline.
import { describe, it, expect } from "vitest";
import {
  tokenize, stem, analyze, buildPosting, serializePosting, deserializePosting,
  bm25Search, exactSearch, reciprocalRankFusion,
} from "@/services/knowledge/lexical";

describe("tokenize", () => {
  it("kleinschreibt und trennt an Nicht-Buchstaben", () => {
    expect(tokenize("Anna, Bernd; Clara!")).toEqual(["anna", "bernd", "clara"]);
  });

  it("behält Umlaute und ß", () => {
    expect(tokenize("Größe Öl Fährte")).toEqual(["größe", "öl", "fährte"]);
  });

  it("entfernt Stoppwörter", () => {
    expect(tokenize("der Mantel und die Tasche")).toEqual(["mantel", "tasche"]);
  });

  it("entfernt Einzelzeichen", () => {
    expect(tokenize("a b Haus")).toEqual(["haus"]);
  });

  it("liefert für leeren Text ein leeres Array", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("stem", () => {
  it("lässt kurze Wörter unverändert", () => {
    expect(stem("haus")).toBe("haus");
  });

  it("entfernt häufige Flexionsendungen", () => {
    expect(stem("mantels")).toBe("mantel");
    expect(stem("häuser")).toBe("häus");
  });

  it("stemmt nicht, wenn der Rest zu kurz würde", () => {
    // "oben" → "ob" wäre Overstemming, muss unterbleiben
    expect(stem("oben").length).toBeGreaterThanOrEqual(4);
  });

  it("normalisiert Flexionsvarianten auf denselben Stamm", () => {
    expect(stem("mantels")).toBe(stem("mantel"));
  });
});

describe("buildPosting / Serialisierung", () => {
  it("zählt Termfrequenzen", () => {
    const p = buildPosting("Mantel Mantel Tasche");
    expect(p.tf[stem("mantel")]).toBe(2);
    expect(p.length).toBe(3);
  });

  it("überlebt einen Serialisierungs-Roundtrip", () => {
    const p = buildPosting("Anna trug den blauen Mantel.");
    const back = deserializePosting(serializePosting(p));
    expect(back).not.toBeNull();
    expect(back!.tf).toEqual(p.tf);
    expect(back!.length).toBe(p.length);
  });

  it("liefert null bei fehlerhaftem Inhalt statt zu werfen", () => {
    expect(deserializePosting("{kaputt")).toBeNull();
    expect(deserializePosting(null)).toBeNull();
  });
});

describe("bm25Search", () => {
  const docs = [
    { id: "a", posting: buildPosting("Anna trug einen blauen Mantel durch den Regen.") },
    { id: "b", posting: buildPosting("Bernd stand am Hafen und rauchte.") },
    { id: "c", posting: buildPosting("Der Mantel hing im Schrank. Anna vermisste ihn.") },
  ];

  it("findet Dokumente mit dem Suchterm", () => {
    const hits = bm25Search("Mantel", docs);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain("a");
    expect(ids).toContain("c");
    expect(ids).not.toContain("b");
  });

  it("normalisiert den Top-Score auf 1", () => {
    const hits = bm25Search("Mantel", docs);
    expect(hits[0].score).toBeCloseTo(1, 5);
  });

  it("sortiert absteigend nach Score", () => {
    const hits = bm25Search("Anna Mantel", docs);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it("meldet die getroffenen Terme", () => {
    const hits = bm25Search("Mantel Regen", docs);
    const a = hits.find((h) => h.id === "a");
    expect(a!.matchedTerms.length).toBeGreaterThanOrEqual(2);
  });

  it("liefert nichts bei reiner Stoppwort-Anfrage", () => {
    expect(bm25Search("der die das", docs)).toEqual([]);
  });

  it("liefert nichts bei leerer Dokumentmenge", () => {
    expect(bm25Search("Mantel", [])).toEqual([]);
  });

  it("respektiert das Limit", () => {
    expect(bm25Search("Anna Mantel Hafen", docs, 1)).toHaveLength(1);
  });

  it("findet Flexionsvarianten über Stemming", () => {
    const hits = bm25Search("Mantels", docs);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("exactSearch", () => {
  const docs = [
    { id: "a", text: "Anna trug einen blauen Mantel." },
    { id: "b", text: "Ein blauer Mantel lag dort. Der blaue Mantel war neu." },
    { id: "c", text: "Nichts davon hier." },
  ];

  it("findet nur exakte Teilstrings", () => {
    const hits = exactSearch("blauen Mantel", docs);
    expect(hits.map((h) => h.id)).toEqual(["a"]);
  });

  it("bewertet Mehrfachtreffer höher", () => {
    const hits = exactSearch("Mantel", docs);
    expect(hits[0].id).toBe("b");
  });

  it("ignoriert Groß-/Kleinschreibung", () => {
    expect(exactSearch("ANNA", docs).map((h) => h.id)).toEqual(["a"]);
  });

  it("liefert nichts bei leerer Anfrage", () => {
    expect(exactSearch("   ", docs)).toEqual([]);
  });
});

describe("reciprocalRankFusion", () => {
  it("belohnt Dokumente, die in beiden Listen vorkommen", () => {
    const l1 = [{ id: "a", score: 1 }, { id: "b", score: 0.5 }];
    const l2 = [{ id: "b", score: 1 }, { id: "c", score: 0.5 }];
    const fused = reciprocalRankFusion([l1, l2]);
    expect(fused[0].id).toBe("b");
  });

  it("normalisiert den Top-Score auf 1", () => {
    const fused = reciprocalRankFusion([[{ id: "a", score: 0.3 }]]);
    expect(fused[0].score).toBeCloseTo(1, 5);
  });

  it("verkraftet leere Listen", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("respektiert das Limit", () => {
    const l = [{ id: "a", score: 1 }, { id: "b", score: 0.9 }, { id: "c", score: 0.8 }];
    expect(reciprocalRankFusion([l], 60, 2)).toHaveLength(2);
  });
});

describe("analyze", () => {
  it("tokenisiert und stemmt in einem Schritt", () => {
    const out = analyze("Die Mäntel hingen dort.");
    expect(out).not.toContain("die");
    expect(out.length).toBeGreaterThan(0);
  });
});
