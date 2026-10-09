// @vitest-environment jsdom
/**
 * Tests: antagonistMoralJustification (WP 130.1 — Meilenstein 63.0 / v7.5.0)
 *
 * Antagonisten-Selbstrechtfertigungs-Synthesizer.
 * Deckt deterministischen Zufall, die vier Philosophien, den Monolog-
 * Synthesizer, den Verführungs-Regler sowie Randfälle ab.
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ANTAGONIST_PHILOSOPHIES,
  synthesizeJustificationMonologue,
  calibrateSeduction,
  createSampleAntagonist,
  createSampleMonologue,
} from "./antagonistMoralJustification";

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const PHILOSOPHY_IDS = [
  "utilitarianMartyr",
  "traumatizedMirror",
  "darwinistClimber",
  "benevolentDespot",
] as const;

/** Wortzählung analog zum Service (Leerzeichen-getrennt, leere Tokens verworfen). */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Findet eine Philosophie per ID. */
function philosophyById(id: string) {
  const found = ANTAGONIST_PHILOSOPHIES.find((p) => p.id === id);
  if (!found) throw new Error(`Philosophie fehlt: ${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch für gleichen Input", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("ist deterministisch auch bei wiederholtem Aufruf in Folge", () => {
    const a = hashString("Antagonist");
    const b = hashString("Antagonist");
    const c = hashString("Antagonist");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("liefert für den FNV-Offset-Basis-Fall '' den Startwert", () => {
    expect(hashString("")).toBe(2166136261 >>> 0);
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("Villain")).not.toBe(hashString("villain"));
  });

  it("unterscheidet Buchstabenreihenfolge", () => {
    expect(hashString("ab")).not.toBe(hashString("ba"));
  });

  it("liefert einen ganzzahligen Wert", () => {
    expect(Number.isInteger(hashString("x"))).toBe(true);
  });

  it("liegt im 32-Bit-unsigned-Bereich", () => {
    for (const s of ["", "a", "Antagonist", "🎭", "äöü", "x".repeat(500)]) {
      const h = hashString(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("ist stets gleich seinem eigenen >>> 0-Wert", () => {
    for (const s of ["a", "Monolog", "Kälte", "ziel"]) {
      expect(hashString(s)).toBe(hashString(s) >>> 0);
    }
  });

  it("verarbeitet Unicode/Umlaute deterministisch", () => {
    expect(hashString("Ärger")).toBe(hashString("Ärger"));
    expect(hashString("äöü")).toBe(hashString("äöü"));
  });

  it("unterscheidet Umlaut-Varianten", () => {
    expect(hashString("ärger")).not.toBe(hashString("arger"));
  });

  it("verarbeitet Emojis deterministisch", () => {
    expect(hashString("🎭🔥")).toBe(hashString("🎭🔥"));
  });

  it("liefert für lange Strings denselben Wert bei Wiederholung", () => {
    const long = "Der utilitaristische Märtyrer ".repeat(40);
    expect(hashString(long)).toBe(hashString(long));
  });

  it("behandelt Nicht-Strings defensiv wie den leeren String", () => {
    expect(hashString(null as unknown as string)).toBe(hashString(""));
    expect(hashString(undefined as unknown as string)).toBe(hashString(""));
    expect(hashString(42 as unknown as string)).toBe(hashString(""));
  });

  it("erzeugt über viele unterschiedliche Inputs kaum Kollisionen", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(hashString(`villain-${i}`));
    }
    expect(seen.size).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("liefert eine Funktion", () => {
    expect(typeof createSeededRandom(1)).toBe("function");
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect(a()).toBe(b());
  });

  it("liefert dieselbe Sequenz über mehrere Ziehungen", () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    for (let i = 0; i < 25; i++) {
      expect(a()).toBe(b());
    }
  });

  it("liefert alle 500 Ziehungen in [0, 1)", () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("liefert über 500 Ziehungen niemals NaN", () => {
    const rng = createSeededRandom(999);
    for (let i = 0; i < 500; i++) {
      expect(Number.isNaN(rng())).toBe(false);
    }
  });

  it("liefert keine konstante Sequenz", () => {
    const rng = createSeededRandom(5);
    const first = rng();
    let varied = false;
    for (let i = 0; i < 50; i++) {
      if (rng() !== first) varied = true;
    }
    expect(varied).toBe(true);
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    let differ = false;
    for (let i = 0; i < 20; i++) {
      if (a() !== b()) differ = true;
    }
    expect(differ).toBe(true);
  });

  it("Seed 0 funktioniert und liefert gültige Werte", () => {
    const rng = createSeededRandom(0);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("Seed 0xffffffff funktioniert", () => {
    const rng = createSeededRandom(0xffffffff);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("negative Seeds werden defensiv zu 32-Bit-unsigned", () => {
    const a = createSeededRandom(-1);
    const b = createSeededRandom((-1 >>> 0));
    expect(a()).toBe(b());
  });

  it("zwei Generatoren sind unabhängig voneinander", () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    const aSeq = [a(), a()];
    // b startet unbeeinflusst von a
    expect(b()).toBe(aSeq[0]);
    expect(b()).toBe(aSeq[1]);
  });

  it("der Generatorfortschritt ist reproduzierbar", () => {
    const a = createSeededRandom(55);
    a(); a(); a();
    const b = createSeededRandom(55);
    b(); b(); b();
    expect(a()).toBe(b());
  });
});

// ---------------------------------------------------------------------------
// ANTAGONIST_PHILOSOPHIES
// ---------------------------------------------------------------------------

describe("ANTAGONIST_PHILOSOPHIES", () => {
  it("enthält genau 4 Einträge", () => {
    expect(ANTAGONIST_PHILOSOPHIES).toHaveLength(4);
  });

  it("enthält genau die vier erwarteten IDs", () => {
    expect(ANTAGONIST_PHILOSOPHIES.map((p) => p.id).sort()).toEqual(
      [...PHILOSOPHY_IDS].sort(),
    );
  });

  it("die IDs sind eindeutig", () => {
    const ids = ANTAGONIST_PHILOSOPHIES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("die Namen sind eindeutig", () => {
    const names = ANTAGONIST_PHILOSOPHIES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const id of PHILOSOPHY_IDS) {
    describe(`Eintrag ${id}`, () => {
      const p = philosophyById(id);

      it("hat die erwartete ID", () => {
        expect(p.id).toBe(id);
      });

      it("hat einen nicht-leeren Namen", () => {
        expect(typeof p.name).toBe("string");
        expect(p.name.trim().length).toBeGreaterThan(0);
      });

      it("hat eine nicht-leere Beschreibung", () => {
        expect(typeof p.description).toBe("string");
        expect(p.description.trim().length).toBeGreaterThan(20);
      });

      it("hat einen nicht-leeren coreBelief", () => {
        expect(typeof p.coreBelief).toBe("string");
        expect(p.coreBelief.trim().length).toBeGreaterThan(10);
      });

      it("hat ein nicht-leeres examples-Array", () => {
        expect(Array.isArray(p.examples)).toBe(true);
        expect(p.examples.length).toBeGreaterThan(0);
      });

      it("alle examples sind nicht-leere Strings", () => {
        for (const ex of p.examples) {
          expect(typeof ex).toBe("string");
          expect(ex.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// synthesizeJustificationMonologue — je Philosophie
// ---------------------------------------------------------------------------

for (const id of PHILOSOPHY_IDS) {
  describe(`synthesizeJustificationMonologue — ${id}`, () => {
    const philosophy = philosophyById(id);
    const base = { philosophyId: id, villainName: "Der Schatten" };

    it("liefert ein Objekt mit allen Feldern", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(typeof m.philosophy).toBe("string");
      expect(typeof m.monologue).toBe("string");
      expect(Array.isArray(m.rhetoricalDevices)).toBe(true);
      expect(typeof m.wordCount).toBe("number");
      expect(typeof m.chillingLine).toBe("string");
    });

    it("erzeugt einen nicht-leeren Monolog", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.monologue.trim().length).toBeGreaterThan(100);
    });

    it("die philosophy entspricht dem Namen der gewählten Philosophie", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.philosophy).toBe(philosophy.name);
    });

    it("rhetoricalDevices ist ein nicht-leeres Array", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.rhetoricalDevices.length).toBeGreaterThan(0);
    });

    it("alle rhetoricalDevices sind nicht-leere Strings", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      for (const d of m.rhetoricalDevices) {
        expect(typeof d).toBe("string");
        expect(d.trim().length).toBeGreaterThan(0);
      }
    });

    it("wordCount entspricht der tatsächlichen Wortzahl des Monologs", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.wordCount).toBe(countWords(m.monologue));
    });

    it("wordCount ist positiv", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.wordCount).toBeGreaterThan(0);
    });

    it("chillingLine ist nicht leer", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.chillingLine.trim().length).toBeGreaterThan(0);
    });

    it("chillingLine ist Teil des Monologs", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.monologue.includes(m.chillingLine)).toBe(true);
    });

    it("der Monolog besteht aus vier Absätzen", () => {
      const m = synthesizeJustificationMonologue(base, 42);
      expect(m.monologue.split("\n\n")).toHaveLength(4);
    });

    it("funktioniert mit angegebenem victimCount", () => {
      const m = synthesizeJustificationMonologue({ ...base, victimCount: 5000 }, 42);
      expect(m.monologue.trim().length).toBeGreaterThan(100);
      expect(m.wordCount).toBe(countWords(m.monologue));
    });

    it("funktioniert mit angegebenem goal", () => {
      const m = synthesizeJustificationMonologue({ ...base, goal: "den Weltfrieden" }, 42);
      expect(m.monologue.trim().length).toBeGreaterThan(100);
      expect(m.wordCount).toBe(countWords(m.monologue));
    });

    it("funktioniert mit victimCount und goal gemeinsam", () => {
      const m = synthesizeJustificationMonologue(
        { ...base, victimCount: 123, goal: "eine neue Ordnung" },
        42,
      );
      expect(m.philosophy).toBe(philosophy.name);
      expect(m.rhetoricalDevices.length).toBeGreaterThan(0);
    });

    it("ist deterministisch für gleichen Seed", () => {
      const a = synthesizeJustificationMonologue(base, 42);
      const b = synthesizeJustificationMonologue(base, 42);
      expect(a.monologue).toBe(b.monologue);
      expect(a.chillingLine).toBe(b.chillingLine);
      expect(a.wordCount).toBe(b.wordCount);
    });

    it("die zurückgegebenen rhetoricalDevices sind eine frische Kopie", () => {
      const a = synthesizeJustificationMonologue(base, 42);
      const len = a.rhetoricalDevices.length;
      a.rhetoricalDevices.push("Manipuliert");
      const b = synthesizeJustificationMonologue(base, 42);
      expect(b.rhetoricalDevices.length).toBe(len);
    });
  });
}

// ---------------------------------------------------------------------------
// synthesizeJustificationMonologue — unbekannte Philosophie
// ---------------------------------------------------------------------------

describe("synthesizeJustificationMonologue — unbekannte Philosophie", () => {
  const first = philosophyById("utilitarianMartyr");

  it("fällt auf die erste Philosophie zurück", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "gibtsNicht", villainName: "X" },
      1,
    );
    expect(m.philosophy).toBe(first.name);
  });

  it("leere philosophyId fällt ebenfalls zurück", () => {
    const m = synthesizeJustificationMonologue({ philosophyId: "", villainName: "X" }, 1);
    expect(m.philosophy).toBe(first.name);
  });

  it("unbekannte Philosophie liefert dennoch gültige Bausteine", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "unknown", villainName: "X" },
      1,
    );
    expect(m.monologue.trim().length).toBeGreaterThan(100);
    expect(m.rhetoricalDevices.length).toBeGreaterThan(0);
    expect(m.wordCount).toBe(countWords(m.monologue));
  });

  it("unbekannte Philosophie ist deterministisch", () => {
    const a = synthesizeJustificationMonologue({ philosophyId: "zzz", villainName: "X" }, 5);
    const b = synthesizeJustificationMonologue({ philosophyId: "zzz", villainName: "X" }, 5);
    expect(a.monologue).toBe(b.monologue);
  });
});

// ---------------------------------------------------------------------------
// synthesizeJustificationMonologue — Randfälle
// ---------------------------------------------------------------------------

describe("synthesizeJustificationMonologue — Randfälle", () => {
  it("leerer villainName wird durch den Fallback ersetzt", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "" },
      42,
    );
    expect(m.monologue).toContain("Der Antagonist");
  });

  it("reiner Whitespace-Name wird durch den Fallback ersetzt", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "   " },
      42,
    );
    expect(m.monologue).toContain("Der Antagonist");
  });

  it("sehr langer Name wird übernommen", () => {
    const longName = "Der " + "unaussprechlich ".repeat(20) + "Grausame";
    const m = synthesizeJustificationMonologue(
      { philosophyId: "traumatizedMirror", villainName: longName },
      42,
    );
    expect(m.monologue).toContain(longName);
  });

  it("Umlaute im Namen werden übernommen", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "darwinistClimber", villainName: "Fürst Ärgerlärm" },
      42,
    );
    expect(m.monologue).toContain("Fürst Ärgerlärm");
  });

  it("deutsche Anführungszeichen im goal sind unproblematisch", () => {
    const m = synthesizeJustificationMonologue(
      {
        philosophyId: "benevolentDespot",
        villainName: "Der Hüter",
        goal: 'das „größte Gut“',
      },
      42,
    );
    expect(m.monologue.trim().length).toBeGreaterThan(100);
    expect(m.wordCount).toBe(countWords(m.monologue));
  });

  it("der Name wird getrimmt", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "  Name  " },
      42,
    );
    expect(m.monologue).toContain("Name");
    expect(m.monologue).not.toContain("  Name  ");
  });

  it("leerer Name und leeres goal sind robust", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "benevolentDespot", villainName: "", goal: "" },
      42,
    );
    expect(m.monologue.trim().length).toBeGreaterThan(100);
  });

  it("negativer victimCount wird toleriert", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "darwinistClimber", villainName: "X", victimCount: -5 },
      42,
    );
    expect(m.monologue.trim().length).toBeGreaterThan(100);
  });

  it("nicht-endlicher Seed ist robust", () => {
    const m = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "X" },
      NaN,
    );
    expect(m.monologue.trim().length).toBeGreaterThan(100);
    expect(m.wordCount).toBe(countWords(m.monologue));
  });

  it("seed NaN ist deterministisch", () => {
    const a = synthesizeJustificationMonologue({ philosophyId: "utilitarianMartyr", villainName: "X" }, NaN);
    const b = synthesizeJustificationMonologue({ philosophyId: "utilitarianMartyr", villainName: "X" }, NaN);
    expect(a.monologue).toBe(b.monologue);
  });
});

// ---------------------------------------------------------------------------
// calibrateSeduction
// ---------------------------------------------------------------------------

describe("calibrateSeduction — Levels", () => {
  const levels: { input: number; expected: number }[] = [
    { input: 0, expected: 0 },
    { input: 25, expected: 25 },
    { input: 50, expected: 50 },
    { input: 75, expected: 75 },
    { input: 100, expected: 100 },
    { input: -10, expected: 0 },
    { input: 150, expected: 100 },
  ];

  for (const { input, expected } of levels) {
    describe(`Level ${input}`, () => {
      const c = calibrateSeduction("utilitarianMartyr", input, 42);

      it(`echot/klemmt den Level auf ${expected}`, () => {
        expect(c.level).toBe(expected);
      });

      it("hat ein nicht-leeres label", () => {
        expect(c.label.trim().length).toBeGreaterThan(0);
      });

      it("hat eine nicht-leere toneGuidance", () => {
        expect(c.toneGuidance.trim().length).toBeGreaterThan(0);
      });

      it("hat eine nicht-leere sampleLine", () => {
        expect(c.sampleLine.trim().length).toBeGreaterThan(0);
      });

      it("hat einen nicht-leeren readerEffect", () => {
        expect(c.readerEffect.trim().length).toBeGreaterThan(0);
      });
    });
  }
});

describe("calibrateSeduction — Bereichszuordnung", () => {
  it("Level 0 erhält das kälteste Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 0, 1).label).toBe("Kaltblütig abstoßend");
  });

  it("Level 25 erhält das kalkulierte Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 25, 1).label).toBe("Kalkuliert distanziert");
  });

  it("Level 50 erhält das ambivalente Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 50, 1).label).toBe("Ambivalent beunruhigend");
  });

  it("Level 75 erhält das tragische Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 75, 1).label).toBe("Tragisch bewegend");
  });

  it("Level 90 erhält das herzzerreißende Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 90, 1).label).toBe(
      "Tragischer herzzerreißender Antiheld",
    );
  });

  it("Level 100 erhält das herzzerreißende Label", () => {
    expect(calibrateSeduction("utilitarianMartyr", 100, 1).label).toBe(
      "Tragischer herzzerreißender Antiheld",
    );
  });

  it("Level 89 liegt noch im 75er-Bereich", () => {
    expect(calibrateSeduction("utilitarianMartyr", 89, 1).label).toBe("Tragisch bewegend");
  });

  it("Level 24 liegt noch im 0er-Bereich", () => {
    expect(calibrateSeduction("utilitarianMartyr", 24, 1).label).toBe("Kaltblütig abstoßend");
  });

  it("Level 49 liegt noch im 25er-Bereich", () => {
    expect(calibrateSeduction("utilitarianMartyr", 49, 1).label).toBe("Kalkuliert distanziert");
  });
});

describe("calibrateSeduction — Rundung und Robustheit", () => {
  it("rundet 49.6 auf 50", () => {
    expect(calibrateSeduction("utilitarianMartyr", 49.6, 1).level).toBe(50);
  });

  it("rundet 49.4 auf 49", () => {
    expect(calibrateSeduction("utilitarianMartyr", 49.4, 1).level).toBe(49);
  });

  it("NaN-Level fällt auf 0 zurück", () => {
    expect(calibrateSeduction("utilitarianMartyr", NaN, 1).level).toBe(0);
  });

  it("Infinity-Level fällt defensiv auf 0 zurück (nicht-endlich → min)", () => {
    expect(calibrateSeduction("utilitarianMartyr", Infinity, 1).level).toBe(0);
  });

  it("-Infinity-Level fällt defensiv auf 0 zurück", () => {
    expect(calibrateSeduction("utilitarianMartyr", -Infinity, 1).level).toBe(0);
  });

  it("unbekannte Philosophie liefert dennoch gültige Werte", () => {
    const c = calibrateSeduction("gibtsNicht", 50, 1);
    expect(c.label.trim().length).toBeGreaterThan(0);
    expect(c.toneGuidance.trim().length).toBeGreaterThan(0);
    expect(c.sampleLine.trim().length).toBeGreaterThan(0);
    expect(c.readerEffect.trim().length).toBeGreaterThan(0);
  });

  it("leere philosophyId liefert dennoch gültige Werte", () => {
    const c = calibrateSeduction("", 50, 1);
    expect(c.level).toBe(50);
    expect(c.label.trim().length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = calibrateSeduction("traumatizedMirror", 60, 42);
    const b = calibrateSeduction("traumatizedMirror", 60, 42);
    expect(a).toEqual(b);
  });

  it("unterschiedliche Seeds variieren die Beispielzeile über mehrere Seeds", () => {
    const lines = new Set<string>();
    for (let s = 0; s < 12; s++) {
      lines.add(calibrateSeduction("darwinistClimber", 50, s).sampleLine);
    }
    expect(lines.size).toBeGreaterThan(1);
  });

  it("die Beispielzeile beginnt mit der Basiszeile des Bereichs", () => {
    const c = calibrateSeduction("utilitarianMartyr", 0, 42);
    expect(c.sampleLine.startsWith("Ich tue, was getan werden muss.")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinismus über Funktionen hinweg
// ---------------------------------------------------------------------------

describe("Determinismus über Funktionen hinweg", () => {
  it("gleicher Seed erzeugt für jede Philosophie denselben Monolog", () => {
    for (const id of PHILOSOPHY_IDS) {
      const a = synthesizeJustificationMonologue({ philosophyId: id, villainName: "V" }, 99);
      const b = synthesizeJustificationMonologue({ philosophyId: id, villainName: "V" }, 99);
      expect(a.monologue).toBe(b.monologue);
    }
  });

  it("unterschiedliche Seeds variieren den Monolog über mehrere Seeds", () => {
    const texts = new Set<string>();
    for (let s = 0; s < 12; s++) {
      texts.add(
        synthesizeJustificationMonologue(
          { philosophyId: "benevolentDespot", villainName: "V" },
          s,
        ).monologue,
      );
    }
    expect(texts.size).toBeGreaterThan(1);
  });

  it("hashString + createSeededRandom sind als Kette deterministisch", () => {
    const seedA = hashString("kette#1");
    const seedB = hashString("kette#1");
    const rngA = createSeededRandom(seedA);
    const rngB = createSeededRandom(seedB);
    for (let i = 0; i < 30; i++) {
      expect(rngA()).toBe(rngB());
    }
  });

  it("unterschiedliche villainName erzeugen unterschiedliche Monologe", () => {
    const a = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "Alpha" },
      42,
    );
    const b = synthesizeJustificationMonologue(
      { philosophyId: "utilitarianMartyr", villainName: "Beta" },
      42,
    );
    expect(a.monologue).not.toBe(b.monologue);
  });

  it("calibrateSeduction ist für jeden Level deterministisch", () => {
    for (const lvl of [0, 25, 50, 75, 100]) {
      const a = calibrateSeduction("utilitarianMartyr", lvl, 7);
      const b = calibrateSeduction("utilitarianMartyr", lvl, 7);
      expect(a).toEqual(b);
    }
  });

  it("unterschiedliche Philosophien erzeugen unterschiedliche rhetoricalDevices", () => {
    const seen = new Set<string>();
    for (const id of PHILOSOPHY_IDS) {
      const m = synthesizeJustificationMonologue({ philosophyId: id, villainName: "V" }, 42);
      seen.add(m.rhetoricalDevices.join("|"));
    }
    expect(seen.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

describe("createSampleAntagonist", () => {
  it("liefert die erste Philosophie", () => {
    expect(createSampleAntagonist()).toEqual(ANTAGONIST_PHILOSOPHIES[0]);
  });

  it("liefert einen Eintrag mit der ID utilitarianMartyr", () => {
    expect(createSampleAntagonist().id).toBe("utilitarianMartyr");
  });

  it("liefert nicht-leere Kernfelder", () => {
    const a = createSampleAntagonist();
    expect(a.name.trim().length).toBeGreaterThan(0);
    expect(a.description.trim().length).toBeGreaterThan(0);
    expect(a.coreBelief.trim().length).toBeGreaterThan(0);
    expect(a.examples.length).toBeGreaterThan(0);
  });
});

describe("createSampleMonologue", () => {
  it("liefert einen nicht-leeren Monolog", () => {
    expect(createSampleMonologue().monologue.trim().length).toBeGreaterThan(100);
  });

  it("nutzt die Philosophie utilitarianMartyr", () => {
    expect(createSampleMonologue().philosophy).toBe(philosophyById("utilitarianMartyr").name);
  });

  it("hat passende wordCount", () => {
    const m = createSampleMonologue();
    expect(m.wordCount).toBe(countWords(m.monologue));
  });

  it("hat nicht-leere rhetoricalDevices", () => {
    expect(createSampleMonologue().rhetoricalDevices.length).toBeGreaterThan(0);
  });

  it("hat eine nicht-leere chillingLine", () => {
    expect(createSampleMonologue().chillingLine.trim().length).toBeGreaterThan(0);
  });

  it("ist deterministisch über Aufrufe hinweg", () => {
    expect(createSampleMonologue().monologue).toBe(createSampleMonologue().monologue);
  });
});
