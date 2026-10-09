// @vitest-environment jsdom
// psychologicalGaslightingWeaver Tests (WP 131.1, Meilenstein 63.0 / v7.5.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  MANIPULATION_TACTICS,
  weaveManipulativeDialogue,
  buildManipulationArc,
  createSampleDialogue,
  createSampleArc,
} from "./psychologicalGaslightingWeaver";

const TACTIC_IDS = [
  "realityInversion",
  "loveBombingWithdrawal",
  "darvo",
  "triangulation",
];

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("ist deterministisch für denselben String", () => {
    expect(hashString("gaslight")).toBe(hashString("gaslight"));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("darvo")).not.toBe(hashString("triangulation"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Manipulation");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("behandelt den leeren String ohne Fehler", () => {
    expect(typeof hashString("")).toBe("number");
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("Darvo")).not.toBe(hashString("darvo"));
  });

  it("verarbeitet Umlaute", () => {
    expect(typeof hashString("Zärtlichkeit")).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------
describe("createSeededRandom", () => {
  it("ist deterministisch für denselben Seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("erzeugt unterschiedliche Folgen für unterschiedliche Seeds", () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });
});

// ---------------------------------------------------------------------------
// MANIPULATION_TACTICS
// ---------------------------------------------------------------------------
describe("MANIPULATION_TACTICS", () => {
  it("enthält genau 4 Taktiken", () => {
    expect(MANIPULATION_TACTICS).toHaveLength(4);
  });

  it("enthält die erwarteten IDs in Reihenfolge", () => {
    expect(MANIPULATION_TACTICS.map((t) => t.id)).toEqual(TACTIC_IDS);
  });

  it("hat gültige Felder für jede Taktik", () => {
    for (const t of MANIPULATION_TACTICS) {
      expect(typeof t.id).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.targetEffect.length).toBeGreaterThan(0);
      expect(t.warningSign.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// weaveManipulativeDialogue — pro Taktik
// ---------------------------------------------------------------------------
describe("weaveManipulativeDialogue", () => {
  for (const tacticId of TACTIC_IDS) {
    describe(`Taktik ${tacticId}`, () => {
      it("liefert Taktikname und Wortwechsel", () => {
        const d = weaveManipulativeDialogue(
          { tacticId, manipulatorName: "Marlene", victimName: "Jonas" },
          42,
        );
        expect(d.tactic.length).toBeGreaterThan(0);
        expect(Array.isArray(d.exchanges)).toBe(true);
        expect(d.exchanges.length).toBeGreaterThan(0);
      });

      it("hat vollständige Wortwechsel", () => {
        const d = weaveManipulativeDialogue(
          { tacticId, manipulatorName: "Marlene", victimName: "Jonas" },
          42,
        );
        for (const x of d.exchanges) {
          expect(x.speaker.length).toBeGreaterThan(0);
          expect(x.line.length).toBeGreaterThan(0);
          expect(x.subtext.length).toBeGreaterThan(0);
        }
      });

      it("hält die Eskalation im Bereich 0-10", () => {
        const d = weaveManipulativeDialogue(
          { tacticId, manipulatorName: "A", victimName: "B" },
          42,
        );
        expect(d.escalationLevel).toBeGreaterThanOrEqual(0);
        expect(d.escalationLevel).toBeLessThanOrEqual(10);
      });

      it("liefert eine Subtext-Zusammenfassung", () => {
        const d = weaveManipulativeDialogue(
          { tacticId, manipulatorName: "A", victimName: "B" },
          42,
        );
        expect(d.subtextSummary.length).toBeGreaterThan(0);
      });

      it("ist deterministisch bei gleichem Seed", () => {
        const a = weaveManipulativeDialogue({ tacticId, manipulatorName: "M", victimName: "V" }, 5);
        const b = weaveManipulativeDialogue({ tacticId, manipulatorName: "M", victimName: "V" }, 5);
        expect(a.exchanges.map((x) => x.line)).toEqual(b.exchanges.map((x) => x.line));
        expect(a.escalationLevel).toBe(b.escalationLevel);
      });
    });
  }

  it("nennt Manipulator und Opfer im Dialog", () => {
    const d = weaveManipulativeDialogue(
      { tacticId: "realityInversion", manipulatorName: "Marlene", victimName: "Jonas" },
      42,
    );
    const speakers = d.exchanges.map((x) => x.speaker);
    expect(speakers.some((s) => s.includes("Marlene"))).toBe(true);
    expect(speakers.some((s) => s.includes("Jonas"))).toBe(true);
  });

  it("verarbeitet einen optionalen Kontext", () => {
    const d = weaveManipulativeDialogue(
      {
        tacticId: "darvo",
        manipulatorName: "A",
        victimName: "B",
        context: "ein gemeinsames Abendessen",
      },
      42,
    );
    expect(d.exchanges.length).toBeGreaterThan(0);
  });

  it("behandelt eine unbekannte Taktik-ID ohne Absturz", () => {
    const d = weaveManipulativeDialogue(
      { tacticId: "gibtsnicht", manipulatorName: "A", victimName: "B" },
      42,
    );
    expect(d.exchanges.length).toBeGreaterThan(0);
  });

  it("behandelt leere Namen ohne Absturz", () => {
    const d = weaveManipulativeDialogue(
      { tacticId: "triangulation", manipulatorName: "", victimName: "" },
      42,
    );
    expect(d.exchanges.length).toBeGreaterThan(0);
  });

  it("behandelt sehr lange Namen", () => {
    const long = "A".repeat(300);
    const d = weaveManipulativeDialogue(
      { tacticId: "loveBombingWithdrawal", manipulatorName: long, victimName: long },
      42,
    );
    expect(d.exchanges.length).toBeGreaterThan(0);
  });

  it("verarbeitet Umlaute in den Namen", () => {
    const d = weaveManipulativeDialogue(
      { tacticId: "darvo", manipulatorName: "Jürgen Müller", victimName: "Änne Böhm" },
      42,
    );
    expect(d.exchanges.length).toBeGreaterThan(0);
  });

  it("erzeugt unterschiedliche Dialoge für unterschiedliche Seeds", () => {
    const a = weaveManipulativeDialogue({ tacticId: "darvo", manipulatorName: "M", victimName: "V" }, 1);
    const b = weaveManipulativeDialogue({ tacticId: "darvo", manipulatorName: "M", victimName: "V" }, 99);
    expect(a.exchanges.map((x) => x.line)).not.toEqual(b.exchanges.map((x) => x.line));
  });
});

// ---------------------------------------------------------------------------
// buildManipulationArc
// ---------------------------------------------------------------------------
describe("buildManipulationArc", () => {
  for (const sceneCount of [3, 6, 12]) {
    it(`erzeugt ${sceneCount} Szenen`, () => {
      const arc = buildManipulationArc({ tacticId: "darvo", sceneCount }, 42);
      expect(arc.scenes).toHaveLength(sceneCount);
    });
  }

  it("nummeriert Szenen aufsteigend ab 1", () => {
    const arc = buildManipulationArc({ tacticId: "darvo", sceneCount: 6 }, 42);
    expect(arc.scenes.map((s) => s.sceneNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("hält Vertrauen und Kontrolle im Bereich 0-100", () => {
    const arc = buildManipulationArc({ tacticId: "realityInversion", sceneCount: 8 }, 42);
    for (const s of arc.scenes) {
      expect(s.victimConfidence).toBeGreaterThanOrEqual(0);
      expect(s.victimConfidence).toBeLessThanOrEqual(100);
      expect(s.manipulatorControl).toBeGreaterThanOrEqual(0);
      expect(s.manipulatorControl).toBeLessThanOrEqual(100);
    }
  });

  it("beschreibt jede Szene", () => {
    const arc = buildManipulationArc({ tacticId: "darvo", sceneCount: 6 }, 42);
    for (const s of arc.scenes) {
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("liefert Bruchpunkt und Erholungs-Empfehlung", () => {
    const arc = buildManipulationArc({ tacticId: "darvo", sceneCount: 6 }, 42);
    expect(typeof arc.breakingPoint).toBe("number");
    expect(arc.recoverySuggestion.length).toBeGreaterThan(0);
  });

  it("klemmt sceneCount 0 auf das Minimum", () => {
    const arc = buildManipulationArc({ tacticId: "darvo", sceneCount: 0 }, 42);
    expect(arc.scenes.length).toBeGreaterThanOrEqual(2);
  });

  it("klemmt einen zu großen sceneCount", () => {
    const arc = buildManipulationArc({ tacticId: "darvo", sceneCount: 999 }, 42);
    expect(arc.scenes.length).toBeLessThanOrEqual(12);
  });

  it("nutzt 6 Szenen als Default", () => {
    const arc = buildManipulationArc({ tacticId: "darvo" }, 42);
    expect(arc.scenes).toHaveLength(6);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildManipulationArc({ tacticId: "triangulation", sceneCount: 7 }, 3);
    const b = buildManipulationArc({ tacticId: "triangulation", sceneCount: 7 }, 3);
    expect(a.scenes.map((s) => s.victimConfidence)).toEqual(b.scenes.map((s) => s.victimConfidence));
    expect(a.breakingPoint).toBe(b.breakingPoint);
  });

  it("funktioniert für alle vier Taktiken", () => {
    for (const tacticId of TACTIC_IDS) {
      const arc = buildManipulationArc({ tacticId, sceneCount: 5 }, 42);
      expect(arc.scenes).toHaveLength(5);
    }
  });
});

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------
describe("createSampleDialogue", () => {
  it("liefert einen gültigen Beispiel-Dialog", () => {
    const d = createSampleDialogue();
    expect(d.exchanges.length).toBeGreaterThan(0);
    expect(d.tactic.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(createSampleDialogue().exchanges.map((x) => x.line)).toEqual(
      createSampleDialogue().exchanges.map((x) => x.line),
    );
  });
});

describe("createSampleArc", () => {
  it("liefert einen gültigen Beispiel-Verlauf", () => {
    const arc = createSampleArc();
    expect(arc.scenes.length).toBeGreaterThan(0);
    expect(arc.recoverySuggestion.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(createSampleArc().scenes.map((s) => s.victimConfidence)).toEqual(
      createSampleArc().scenes.map((s) => s.victimConfidence),
    );
  });
});
