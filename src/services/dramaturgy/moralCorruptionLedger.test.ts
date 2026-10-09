// @vitest-environment jsdom
// Tests: Moral-Korruptions-Ledger (WP 130.2, Meilenstein 63.0 / v7.5.0).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  CORRUPTION_STAGES,
  CORRUPTION_STAGE_COUNT,
  buildCorruptionCurve,
  detectPointOfNoReturn,
  createSampleStage,
  createSampleCorruptionCurve,
} from "./moralCorruptionLedger";
import type {
  CorruptionCurve,
  CorruptionStage,
  PointOfNoReturnCurve,
} from "./moralCorruptionLedger";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Eine Kurve aus rohen Stations-Objekten bauen (für die Erkennung). */
function rawCurve(stages: PointOfNoReturnCurve["stages"]): PointOfNoReturnCurve {
  return { stages };
}

// ===========================================================================
// 1) hashString
// ===========================================================================

describe("hashString", () => {
  it("ist deterministisch für identische Eingaben", () => {
    expect(hashString("moralischer Abstieg")).toBe(hashString("moralischer Abstieg"));
  });

  it("liefert bei wiederholten Aufrufen stets denselben Wert", () => {
    const first = hashString("nobleIntent");
    for (let i = 0; i < 20; i++) {
      expect(hashString("nobleIntent")).toBe(first);
    }
  });

  it("erzeugt für unterschiedliche Strings unterschiedliche Hashes", () => {
    expect(hashString("nobleIntent")).not.toBe(hashString("totalBankruptcy"));
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("Cover")).not.toBe(hashString("cover"));
  });

  it("liefert ganzzahlige Werte", () => {
    expect(Number.isInteger(hashString("test"))).toBe(true);
  });

  it("liefert Werte größer oder gleich 0", () => {
    expect(hashString("test")).toBeGreaterThanOrEqual(0);
  });

  it("liefert Werte kleiner als 2 hoch 32", () => {
    expect(hashString("test")).toBeLessThan(2 ** 32);
  });

  it("bleibt im unsigned 32-bit Bereich für viele Eingaben", () => {
    const inputs = ["", "a", "ab", "abc", "Ärger", "Übermut", "ß", "東京", "x".repeat(1000)];
    for (const input of inputs) {
      const h = hashString(input);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
      expect(Number.isInteger(h)).toBe(true);
    }
  });

  it("liefert für den leeren String den FNV-1a-Offset-Basiswert", () => {
    expect(hashString("")).toBe(0x811c9dc5);
  });

  it("behandelt Nicht-Strings defensiv wie den leeren String", () => {
    expect(hashString(null as unknown as string)).toBe(hashString(""));
    expect(hashString(undefined as unknown as string)).toBe(hashString(""));
    expect(hashString(42 as unknown as string)).toBe(hashString(""));
  });

  it("ist stabil für Umlaute und Sonderzeichen", () => {
    expect(hashString("Ärger")).toBe(hashString("Ärger"));
    expect(hashString("Größe")).not.toBe(hashString("Grosse"));
  });

  it("unterscheidet führende/abschließende Leerzeichen", () => {
    expect(hashString(" stage ")).not.toBe(hashString("stage"));
  });

  it("erzeugt für eine Menge verschiedener Strings paarweise verschiedene Hashes", () => {
    const inputs = [
      "nobleIntent",
      "firstCompromise",
      "coverUp",
      "firstCollateral",
      "rationalizedCruelty",
      "paranoidPurge",
      "totalBankruptcy",
    ];
    const hashes = inputs.map(hashString);
    expect(new Set(hashes).size).toBe(inputs.length);
  });

  it("verarbeitet einen sehr langen String ohne Fehler", () => {
    const long = "korruption".repeat(5000);
    expect(hashString(long)).toBe(hashString(long));
    expect(hashString(long)).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// 2) createSeededRandom
// ===========================================================================

describe("createSeededRandom", () => {
  it("gibt eine Funktion zurück", () => {
    expect(typeof createSeededRandom(1)).toBe("function");
  });

  it("ist deterministisch für gleichen Seed (20 Ziehungen)", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("ist deterministisch über 500 Ziehungen", () => {
    const r1 = createSeededRandom(2026);
    const r2 = createSeededRandom(2026);
    const seq1: number[] = [];
    const seq2: number[] = [];
    for (let i = 0; i < 500; i++) {
      seq1.push(r1());
      seq2.push(r2());
    }
    expect(seq1).toEqual(seq2);
  });

  it("liefert Werte im Intervall [0,1) über 500 Ziehungen", () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("liefert endliche Zahlen über 500 Ziehungen", () => {
    const r = createSeededRandom(123);
    for (let i = 0; i < 500; i++) {
      expect(Number.isFinite(r())).toBe(true);
    }
  });

  it("variiert die Werte innerhalb einer Sequenz", () => {
    const r = createSeededRandom(5);
    const values = Array.from({ length: 50 }, () => r());
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it("erzeugt für unterschiedliche Seeds unterschiedliche Sequenzen", () => {
    const seqA = Array.from({ length: 10 }, () => createSeededRandom(1)());
    const seqB = Array.from({ length: 10 }, () => createSeededRandom(2)());
    expect(seqA).not.toEqual(seqB);
  });

  it("unterscheidet Seeds 0 und 1 im ersten Wert", () => {
    expect(createSeededRandom(0)()).not.toBe(createSeededRandom(1)());
  });

  it("behandelt nicht-endliche Seeds wie Seed 0", () => {
    expect(createSeededRandom(Number.NaN)()).toBe(createSeededRandom(0)());
    expect(createSeededRandom(Number.POSITIVE_INFINITY)()).toBe(createSeededRandom(0)());
    expect(createSeededRandom(Number.NEGATIVE_INFINITY)()).toBe(createSeededRandom(0)());
  });

  it("akzeptiert negative Seeds und bleibt im gültigen Bereich", () => {
    const r = createSeededRandom(-99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("akzeptiert große Seeds und bleibt im gültigen Bereich", () => {
    const r = createSeededRandom(2 ** 40 + 7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("ist unabhängig zwischen zwei Instanzen mit gleichem Seed", () => {
    const r1 = createSeededRandom(88);
    const r2 = createSeededRandom(88);
    const first1 = r1();
    const first2 = r2();
    expect(first1).toBe(first2);
    // Fortschritt der einen Instanz beeinflusst die andere nicht.
    expect(r1()).toBe(r2());
  });
});

// ===========================================================================
// 3) CORRUPTION_STAGES / CORRUPTION_STAGE_COUNT
// ===========================================================================

describe("CORRUPTION_STAGES", () => {
  it("enthält genau 7 Einträge", () => {
    expect(CORRUPTION_STAGES).toHaveLength(7);
  });

  it("hat CORRUPTION_STAGE_COUNT === 7", () => {
    expect(CORRUPTION_STAGE_COUNT).toBe(7);
  });

  it("hat CORRUPTION_STAGE_COUNT passend zur Array-Länge", () => {
    expect(CORRUPTION_STAGE_COUNT).toBe(CORRUPTION_STAGES.length);
  });

  it("nummeriert die Stufen 1..7 aufsteigend", () => {
    expect(CORRUPTION_STAGES.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("hat für jeden Eintrag eine ganzzahlige Stufennummer", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(Number.isInteger(s.stage)).toBe(true);
    }
  });

  it("hat die ids in der kanonischen Reihenfolge", () => {
    expect(CORRUPTION_STAGES.map((s) => s.id)).toEqual([
      "nobleIntent",
      "firstCompromise",
      "coverUp",
      "firstCollateral",
      "rationalizedCruelty",
      "paranoidPurge",
      "totalBankruptcy",
    ]);
  });

  it("hat eindeutige ids", () => {
    const ids = CORRUPTION_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hat eindeutige Namen", () => {
    const names = CORRUPTION_STAGES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("hat für jede Stufe einen nicht-leeren Namen", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(typeof s.name).toBe("string");
      expect(s.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jede Stufe eine nicht-leere Beschreibung", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(typeof s.description).toBe("string");
      expect(s.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jede Stufe ein nicht-leeres Beispiel", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(typeof s.example).toBe("string");
      expect(s.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jede Stufe einen nicht-leeren psychologischen Marker", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(typeof s.psychologicalMarker).toBe("string");
      expect(s.psychologicalMarker.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jede Stufe eine nicht-leere id", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(typeof s.id).toBe("string");
      expect(s.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("hat für jede Stufe eine Beschreibung länger als der Name", () => {
    for (const s of CORRUPTION_STAGES) {
      expect(s.description.length).toBeGreaterThan(s.name.length);
    }
  });

  it("hat keine führenden oder abschließenden Leerzeichen in den Feldern", () => {
    for (const s of CORRUPTION_STAGES) {
      for (const value of [s.name, s.description, s.example, s.psychologicalMarker, s.id]) {
        expect(value).toBe(value.trim());
      }
    }
  });

  it("ist als readonly deklariert, aber strukturell vollständig", () => {
    const expectedKeys: Array<keyof CorruptionStage> = [
      "stage",
      "id",
      "name",
      "description",
      "example",
      "psychologicalMarker",
    ];
    for (const s of CORRUPTION_STAGES) {
      expect(Object.keys(s).sort()).toEqual([...expectedKeys].sort());
    }
  });

  it("beginnt mit der edlen Absicht", () => {
    expect(CORRUPTION_STAGES[0].id).toBe("nobleIntent");
    expect(CORRUPTION_STAGES[0].stage).toBe(1);
  });

  it("endet mit dem totalen moralischen Bankrott", () => {
    expect(CORRUPTION_STAGES[6].id).toBe("totalBankruptcy");
    expect(CORRUPTION_STAGES[6].stage).toBe(7);
  });
});

// ===========================================================================
// 4) buildCorruptionCurve
// ===========================================================================

describe("buildCorruptionCurve", () => {
  const input = { characterName: "Lord Adrian Voss", chapters: 24 };

  it("übernimmt den Figurennamen", () => {
    expect(buildCorruptionCurve(input, 42).characterName).toBe("Lord Adrian Voss");
  });

  it("liefert genau 7 Stationen", () => {
    expect(buildCorruptionCurve(input, 42).stages).toHaveLength(7);
  });

  it("nummeriert die Stationen 1..7 aufsteigend", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.stages.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("hat aufsteigende Kapitelnummern", () => {
    const curve = buildCorruptionCurve(input, 42);
    for (let i = 1; i < curve.stages.length; i++) {
      expect(curve.stages[i].chapter).toBeGreaterThanOrEqual(curve.stages[i - 1].chapter);
    }
  });

  it("hat streng fallende Menschlichkeitswerte", () => {
    const curve = buildCorruptionCurve(input, 42);
    for (let i = 1; i < curve.stages.length; i++) {
      expect(curve.stages[i].humanityLevel).toBeLessThan(curve.stages[i - 1].humanityLevel);
    }
  });

  it("beginnt mit einem hohen Menschlichkeitswert", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.stages[0].humanityLevel).toBeGreaterThanOrEqual(90);
  });

  it("endet mit einem Menschlichkeitswert nahe 0", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.stages[6].humanityLevel).toBeLessThanOrEqual(10);
  });

  it("hält alle Menschlichkeitswerte im Bereich [0,100]", () => {
    for (const seed of [1, 7, 42, 100, 999]) {
      const curve = buildCorruptionCurve(input, seed);
      for (const s of curve.stages) {
        expect(s.humanityLevel).toBeGreaterThanOrEqual(0);
        expect(s.humanityLevel).toBeLessThanOrEqual(100);
      }
    }
  });

  it("liefert humanityAtEnd als Zahl", () => {
    expect(typeof buildCorruptionCurve(input, 42).humanityAtEnd).toBe("number");
  });

  it("setzt humanityAtEnd auf den Wert der letzten Stufe", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.humanityAtEnd).toBe(curve.stages[6].humanityLevel);
  });

  it("hat humanityAtEnd <= Menschlichkeit der ersten Stufe", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.humanityAtEnd).toBeLessThanOrEqual(curve.stages[0].humanityLevel);
  });

  it("liefert eine nicht-leere curveDescription", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(typeof curve.curveDescription).toBe("string");
    expect(curve.curveDescription.trim().length).toBeGreaterThan(0);
  });

  it("nennt den Figurennamen in der curveDescription", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.curveDescription).toContain("Lord Adrian Voss");
  });

  it("nennt die Kapitelzahl in der curveDescription", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.curveDescription).toContain("24 Kapitel");
  });

  it("nennt die Stufenanzahl in der curveDescription", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.curveDescription).toContain("7 Stufen");
  });

  it("verteilt 7 Kapitel exakt auf 1..7", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 7 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("verteilt 14 Kapitel monoton steigend", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 14 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 3, 5, 8, 10, 12, 14]);
  });

  it("verteilt 35 Kapitel monoton steigend", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 35 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 7, 12, 18, 24, 29, 35]);
  });

  it("legt bei 1 Kapitel alle Stufen ins Kapitel 1", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 1 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("fällt bei chapters = 0 auf 7 Kapitel zurück", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 0 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("fällt bei negativen Kapiteln auf 7 Kapitel zurück", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: -5 }, 42);
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("hält jede Kapitelnummer innerhalb [1, chapters]", () => {
    for (const chapters of [1, 5, 12, 24, 60, 100]) {
      const curve = buildCorruptionCurve({ characterName: "A", chapters }, 42);
      for (const s of curve.stages) {
        expect(s.chapter).toBeGreaterThanOrEqual(1);
        expect(s.chapter).toBeLessThanOrEqual(chapters);
      }
    }
  });

  it("verteilt große Kapitelzahlen monoton steigend", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 100 }, 42);
    for (let i = 1; i < curve.stages.length; i++) {
      expect(curve.stages[i].chapter).toBeGreaterThan(curve.stages[i - 1].chapter);
    }
  });

  it("übernimmt die stageIds in kanonischer Reihenfolge", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.stages.map((s) => s.stageId)).toEqual(CORRUPTION_STAGES.map((s) => s.id));
  });

  it("übernimmt die stageNames in kanonischer Reihenfolge", () => {
    const curve = buildCorruptionCurve(input, 42);
    expect(curve.stages.map((s) => s.stageName)).toEqual(CORRUPTION_STAGES.map((s) => s.name));
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = buildCorruptionCurve(input, 42);
    const b = buildCorruptionCurve(input, 42);
    expect(a).toEqual(b);
  });

  it("ist deterministisch für gleichen Seed über viele Wiederholungen", () => {
    const first = JSON.stringify(buildCorruptionCurve(input, 123));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(buildCorruptionCurve(input, 123))).toBe(first);
    }
  });

  it("variiert die Ausgabe über verschiedene Seeds", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      seen.add(JSON.stringify(buildCorruptionCurve(input, seed)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("mutiert die Eingabe nicht", () => {
    const mutable = { characterName: "Lord Adrian Voss", chapters: 24 };
    const snapshot = { ...mutable };
    buildCorruptionCurve(mutable, 42);
    expect(mutable).toEqual(snapshot);
  });

  it("nutzt „Unbekannt“ bei leerem Figurennamen", () => {
    const curve = buildCorruptionCurve({ characterName: "", chapters: 24 }, 42);
    expect(curve.characterName).toBe("Unbekannt");
  });

  it("nutzt „Unbekannt“ bei reinem Whitespace-Namen", () => {
    const curve = buildCorruptionCurve({ characterName: "   ", chapters: 24 }, 42);
    expect(curve.characterName).toBe("Unbekannt");
  });

  it("trimmt einen umgebenden Whitespace-Namen", () => {
    const curve = buildCorruptionCurve({ characterName: "  Voss  ", chapters: 24 }, 42);
    expect(curve.characterName).toBe("Voss");
  });

  it("bewahrt einen sehr langen Figurennamen", () => {
    const longName = "Baron ".repeat(60).trim();
    const curve = buildCorruptionCurve({ characterName: longName, chapters: 24 }, 42);
    expect(curve.characterName).toBe(longName);
  });

  it("bewahrt Umlaute im Figurennamen", () => {
    const curve = buildCorruptionCurve({ characterName: "Jörg Übermut", chapters: 24 }, 42);
    expect(curve.characterName).toBe("Jörg Übermut");
  });

  it("bewahrt Sonderzeichen und Unicode im Figurennamen", () => {
    const name = "Ærø • 東京 • ß";
    const curve = buildCorruptionCurve({ characterName: name, chapters: 24 }, 42);
    expect(curve.characterName).toBe(name);
  });

  it("behandelt eine leere Eingabe defensiv (Null-Objekt)", () => {
    const curve = buildCorruptionCurve({} as never, 42);
    expect(curve.characterName).toBe("Unbekannt");
    expect(curve.stages).toHaveLength(7);
  });

  it("behandelt null als Eingabe defensiv", () => {
    const curve = buildCorruptionCurve(null as never, 42);
    expect(curve.characterName).toBe("Unbekannt");
    expect(curve.stages).toHaveLength(7);
  });

  it("fällt bei ungültiger Kapitelzahl (NaN) auf 7 zurück", () => {
    const curve = buildCorruptionCurve(
      { characterName: "A", chapters: Number.NaN },
      42,
    );
    expect(curve.stages.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("liefert bei Kapitelzahl 1 dennoch fallende Menschlichkeit", () => {
    const curve = buildCorruptionCurve({ characterName: "A", chapters: 1 }, 42);
    for (let i = 1; i < curve.stages.length; i++) {
      expect(curve.stages[i].humanityLevel).toBeLessThan(curve.stages[i - 1].humanityLevel);
    }
  });

  it("bleibt die Monotonie auch über viele Seeds erhalten", () => {
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 100, 9999]) {
      const curve = buildCorruptionCurve(input, seed);
      for (let i = 1; i < curve.stages.length; i++) {
        expect(curve.stages[i].humanityLevel).toBeLessThan(curve.stages[i - 1].humanityLevel);
      }
    }
  });
});

// ===========================================================================
// 5) detectPointOfNoReturn
// ===========================================================================

describe("detectPointOfNoReturn", () => {
  const fullCurve = () => buildCorruptionCurve({ characterName: "Voss", chapters: 24 }, 42);

  it("liefert eine Stufennummer", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(typeof result.stage).toBe("number");
  });

  it("liefert eine Kapitelnummer", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(typeof result.chapter).toBe("number");
  });

  it("liefert eine nicht-leere Begründung", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.trim().length).toBeGreaterThan(0);
  });

  it("liefert ein boolesches irreversible-Feld", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(typeof result.irreversible).toBe("boolean");
  });

  it("liefert einen nicht-leeren Szenenvorschlag", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(typeof result.sceneSuggestion).toBe("string");
    expect(result.sceneSuggestion.trim().length).toBeGreaterThan(0);
  });

  it("erkennt eine vollständig abgestiegene Kurve als irreversibel", () => {
    expect(detectPointOfNoReturn(fullCurve(), 42).irreversible).toBe(true);
  });

  it("arbeitet mit einer Kurve aus buildCorruptionCurve", () => {
    const curve = fullCurve();
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBeGreaterThanOrEqual(1);
    expect(result.stage).toBeLessThanOrEqual(7);
  });

  it("wählt für die vollständige Kurve Stufe 5 (erster Wert unter 50)", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(result.stage).toBe(5);
  });

  it("übernimmt das Kapitel der gewählten Stufe", () => {
    const curve = fullCurve();
    const result = detectPointOfNoReturn(curve, 42);
    const chosen = curve.stages.find((s) => s.stage === result.stage);
    expect(result.chapter).toBe(chosen?.chapter);
  });

  it("nennt den Schwellwert 50 in der Begründung für die Standardkurve", () => {
    const result = detectPointOfNoReturn(fullCurve(), 42);
    expect(result.rationale).toContain("50");
  });

  it("bleibt die Stufe auch bei verschiedenen Seeds bei 5", () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      expect(detectPointOfNoReturn(fullCurve(), seed).stage).toBe(5);
    }
  });

  it("gibt bei leerer Kurve Stufe 0 zurück", () => {
    expect(detectPointOfNoReturn(rawCurve([]), 42).stage).toBe(0);
  });

  it("gibt bei leerer Kurve Kapitel 0 zurück", () => {
    expect(detectPointOfNoReturn(rawCurve([]), 42).chapter).toBe(0);
  });

  it("gibt bei leerer Kurve irreversible = false zurück", () => {
    expect(detectPointOfNoReturn(rawCurve([]), 42).irreversible).toBe(false);
  });

  it("liefert bei leerer Kurve dennoch eine Begründung", () => {
    const result = detectPointOfNoReturn(rawCurve([]), 42);
    expect(result.rationale.trim().length).toBeGreaterThan(0);
  });

  it("behandelt null defensiv", () => {
    const result = detectPointOfNoReturn(null as never, 42);
    expect(result.stage).toBe(0);
    expect(result.irreversible).toBe(false);
  });

  it("behandelt fehlende stages-Eigenschaft defensiv", () => {
    const result = detectPointOfNoReturn({} as never, 42);
    expect(result.stage).toBe(0);
  });

  it("filtert ungültige Stationen heraus", () => {
    const curve = rawCurve([
      { stage: null as never, chapter: 1, humanityLevel: 30 },
      { stage: 1, chapter: 1, humanityLevel: Number.NaN },
    ]);
    expect(detectPointOfNoReturn(curve, 42).stage).toBe(0);
  });

  it("wählt die erste Stufe unterhalb des Schwellwerts exakt", () => {
    const curve = rawCurve([
      { stage: 1, chapter: 2, humanityLevel: 95 },
      { stage: 2, chapter: 5, humanityLevel: 80 },
      { stage: 3, chapter: 9, humanityLevel: 49 },
      { stage: 4, chapter: 14, humanityLevel: 30 },
    ]);
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBe(3);
    expect(result.chapter).toBe(9);
  });

  it("markiert einen Wendepunkt ab Stufe 4 als irreversibel", () => {
    const curve = rawCurve([
      { stage: 1, chapter: 1, humanityLevel: 95 },
      { stage: 2, chapter: 2, humanityLevel: 80 },
      { stage: 3, chapter: 3, humanityLevel: 65 },
      { stage: 4, chapter: 4, humanityLevel: 45 },
    ]);
    expect(detectPointOfNoReturn(curve, 42).irreversible).toBe(true);
  });

  it("markiert einen Wendepunkt vor Stufe 4 als reversibel", () => {
    const curve = rawCurve([
      { stage: 1, chapter: 1, humanityLevel: 95 },
      { stage: 2, chapter: 2, humanityLevel: 60 },
      { stage: 3, chapter: 3, humanityLevel: 40 },
    ]);
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBe(3);
    expect(result.irreversible).toBe(false);
  });

  it("sortiert unsortierte Stationen vor der Auswertung", () => {
    const curve = rawCurve([
      { stage: 4, chapter: 14, humanityLevel: 30 },
      { stage: 2, chapter: 5, humanityLevel: 80 },
      { stage: 1, chapter: 2, humanityLevel: 95 },
      { stage: 3, chapter: 9, humanityLevel: 49 },
    ]);
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBe(3);
    expect(result.chapter).toBe(9);
  });

  it("wählt ohne Schwellwert-Unterschreitung den steilsten Abstieg", () => {
    const curve = rawCurve([
      { stage: 1, chapter: 1, humanityLevel: 100 },
      { stage: 2, chapter: 2, humanityLevel: 95 },
      { stage: 3, chapter: 3, humanityLevel: 60 },
      { stage: 4, chapter: 4, humanityLevel: 58 },
    ]);
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBe(3);
    expect(result.rationale).toContain("steilsten");
  });

  it("nutzt die letzte Stufe als letzten Fallback", () => {
    const curve = rawCurve([
      { stage: 1, chapter: 1, humanityLevel: 100 },
      { stage: 2, chapter: 2, humanityLevel: 100 },
      { stage: 3, chapter: 3, humanityLevel: 100 },
    ]);
    const result = detectPointOfNoReturn(curve, 42);
    expect(result.stage).toBe(3);
    expect(result.rationale).toContain("endet");
  });

  it("mutiert die übergebene Kurve nicht", () => {
    const curve = rawCurve([
      { stage: 2, chapter: 5, humanityLevel: 80 },
      { stage: 1, chapter: 2, humanityLevel: 95 },
      { stage: 3, chapter: 9, humanityLevel: 49 },
    ]);
    const snapshot = JSON.stringify(curve);
    detectPointOfNoReturn(curve, 42);
    expect(JSON.stringify(curve)).toBe(snapshot);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = detectPointOfNoReturn(fullCurve(), 42);
    const b = detectPointOfNoReturn(fullCurve(), 42);
    expect(a).toEqual(b);
  });

  it("variiert den Szenenvorschlag über verschiedene Seeds", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      seen.add(detectPointOfNoReturn(fullCurve(), seed).sceneSuggestion);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("bleibt die Stufe bei variierendem Seed konstant", () => {
    const stage = detectPointOfNoReturn(fullCurve(), 1).stage;
    for (const seed of [2, 3, 4, 5]) {
      expect(detectPointOfNoReturn(fullCurve(), seed).stage).toBe(stage);
    }
  });

  it("gibt eine Kapitelnummer >= 1 bei gültiger Kurve zurück", () => {
    expect(detectPointOfNoReturn(fullCurve(), 42).chapter).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// 6) createSampleStage / createSampleCorruptionCurve
// ===========================================================================

describe("createSampleStage", () => {
  it("liefert die Stufe 1", () => {
    expect(createSampleStage().stage).toBe(1);
  });

  it("liefert die id nobleIntent", () => {
    expect(createSampleStage().id).toBe("nobleIntent");
  });

  it("stimmt mit dem ersten Katalogeintrag überein", () => {
    expect(createSampleStage()).toEqual({ ...CORRUPTION_STAGES[0] });
  });

  it("liefert eine Kopie, keine Referenz auf den Katalog", () => {
    const sample = createSampleStage();
    expect(sample).not.toBe(CORRUPTION_STAGES[0]);
  });

  it("Mutation der Kopie verändert den Katalog nicht", () => {
    const sample = createSampleStage();
    sample.name = "Geändert";
    expect(CORRUPTION_STAGES[0].name).not.toBe("Geändert");
  });

  it("liefert für jeden Aufruf ein eigenes Objekt", () => {
    expect(createSampleStage()).not.toBe(createSampleStage());
  });
});

describe("createSampleCorruptionCurve", () => {
  it("liefert eine Kurve mit Figurennamen", () => {
    expect(createSampleCorruptionCurve().characterName).toBe("Lord Adrian Voss");
  });

  it("liefert genau 7 Stationen", () => {
    expect(createSampleCorruptionCurve().stages).toHaveLength(7);
  });

  it("ist deterministisch über mehrere Aufrufe", () => {
    const a: CorruptionCurve = createSampleCorruptionCurve();
    const b: CorruptionCurve = createSampleCorruptionCurve();
    expect(a).toEqual(b);
  });

  it("hat fallende Menschlichkeit", () => {
    const curve = createSampleCorruptionCurve();
    for (let i = 1; i < curve.stages.length; i++) {
      expect(curve.stages[i].humanityLevel).toBeLessThan(curve.stages[i - 1].humanityLevel);
    }
  });

  it("hat humanityAtEnd <= Menschlichkeit der ersten Stufe", () => {
    const curve = createSampleCorruptionCurve();
    expect(curve.humanityAtEnd).toBeLessThanOrEqual(curve.stages[0].humanityLevel);
  });

  it("liefert eine nicht-leere curveDescription", () => {
    expect(createSampleCorruptionCurve().curveDescription.trim().length).toBeGreaterThan(0);
  });

  it("hat 24 Kapitel über die Stationen verteilt", () => {
    const curve = createSampleCorruptionCurve();
    expect(curve.stages[6].chapter).toBeLessThanOrEqual(24);
    expect(curve.stages[0].chapter).toBe(1);
  });

  it("ist mit detectPointOfNoReturn als irreversibel erkennbar", () => {
    expect(detectPointOfNoReturn(createSampleCorruptionCurve(), 42).irreversible).toBe(true);
  });
});
