/**
 * Tests: DopaminePacingSynthesizer (WP 72.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  parseParagraphs,
  computeDopamineLevel,
  detectCuriosityLoops,
  detectCliffhangers,
  analyzePacing,
  formatDopamineCurve,
  formatCuriosityLoops,
  formatCliffhangers,
  type ManuscriptParagraph,
} from "./dopaminePacingSynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("liefert unterschiedliche Werte für unterschiedliche Inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("liefert 32-bit unsigned int", () => {
    const h = hashString("hello");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("verarbeitet leeren String", () => {
    expect(hashString("")).toBe(0x811c9dc5);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });

  it("liefert unterschiedliche Werte für verschiedene Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });

  it("liefert Werte zwischen 0 und 1", () => {
    const r = createSeededRandom(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("parseParagraphs", () => {
  it("zerlegt Text in Absätze", () => {
    const text = "Erster Absatz.\n\nZweiter Absatz.\n\nDritter Absatz.";
    const paras = parseParagraphs(text);
    expect(paras).toHaveLength(3);
    expect(paras[0].index).toBe(1);
    expect(paras[1].index).toBe(2);
    expect(paras[2].index).toBe(3);
  });

  it("zählt Wörter korrekt", () => {
    const text = "Eins zwei drei.";
    const paras = parseParagraphs(text);
    expect(paras[0].wordCount).toBe(3);
  });

  it("ignoriert leere Absätze", () => {
    const text = "A.\n\n\n\nB.";
    const paras = parseParagraphs(text);
    expect(paras).toHaveLength(2);
  });

  it("verarbeitet leeren Text", () => {
    expect(parseParagraphs("")).toEqual([]);
  });

  it("trimmt Whitespace", () => {
    const text = "  Hallo Welt.  ";
    const paras = parseParagraphs(text);
    expect(paras[0].text).toBe("Hallo Welt.");
  });
});

describe("computeDopamineLevel", () => {
  it("berechnet Basis-Level für neutralen Text", () => {
    const p: ManuscriptParagraph = { index: 1, text: "Das ist ein Satz.", wordCount: 4 };
    const d = computeDopamineLevel(p, 42);
    expect(d.level).toBeGreaterThanOrEqual(5);
    expect(d.level).toBeLessThanOrEqual(100);
  });

  it("erhöht Level bei Überraschung", () => {
    const neutral: ManuscriptParagraph = { index: 1, text: "Er ging nach Hause.", wordCount: 4 };
    const shock: ManuscriptParagraph = { index: 1, text: "Plötzlich explodierte alles!", wordCount: 3 };
    expect(computeDopamineLevel(shock, 42).level).toBeGreaterThan(computeDopamineLevel(neutral, 42).level);
  });

  it("erhöht Level bei Gefahr", () => {
    const neutral: ManuscriptParagraph = { index: 1, text: "Es war ruhig.", wordCount: 3 };
    const danger: ManuscriptParagraph = { index: 1, text: "Gefahr! Er sterben!", wordCount: 3 };
    expect(computeDopamineLevel(danger, 42).level).toBeGreaterThan(computeDopamineLevel(neutral, 42).level);
  });

  it("erhöht Level bei Enthüllung", () => {
    const neutral: ManuscriptParagraph = { index: 1, text: "Er dachte nach.", wordCount: 3 };
    const reveal: ManuscriptParagraph = { index: 1, text: "Die Wahrheit wurde enthüllt!", wordCount: 4 };
    expect(computeDopamineLevel(reveal, 42).level).toBeGreaterThan(computeDopamineLevel(neutral, 42).level);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const p: ManuscriptParagraph = { index: 1, text: "Ein Test.", wordCount: 2 };
    expect(computeDopamineLevel(p, 42)).toEqual(computeDopamineLevel(p, 42));
  });

  it("clamppt auf Maximum 100", () => {
    const p: ManuscriptParagraph = {
      index: 1,
      text: "Plötzlich! Gefahr! Geheimnis! Kampf! Verrat! Entdeckt! Sieg! Liebe! Lachen! Trauer!",
      wordCount: 10,
    };
    expect(computeDopamineLevel(p, 42).level).toBeLessThanOrEqual(100);
  });

  it("clamppt auf Minimum 5", () => {
    const p: ManuscriptParagraph = { index: 1, text: "Ok.", wordCount: 1 };
    expect(computeDopamineLevel(p, 42).level).toBeGreaterThanOrEqual(5);
  });

  it("vergibt Label nach Level", () => {
    const high: ManuscriptParagraph = { index: 1, text: "Plötzlich! Gefahr! Geheimnis! Entdeckt! Verrat!", wordCount: 5 };
    const d = computeDopamineLevel(high, 42);
    expect(["Hoch", "Mittel", "Ruhig", "Tief"]).toContain(d.label);
  });
});

describe("detectCuriosityLoops", () => {
  it("erkennt Frage-Antwort-Paare", () => {
    const text = "Wer ist der Mörder?\n\nAlso, der Mörder war der Butler.";
    const paras = parseParagraphs(text);
    const loops = detectCuriosityLoops(paras);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops[0].setupParagraph).toBe(1);
    expect(loops[0].payoffParagraph).toBe(2);
  });

  it("findet keine Loops ohne Frage", () => {
    const text = "Es war ein dunkler Tag.\n\nDie Sonne schien.";
    const paras = parseParagraphs(text);
    expect(detectCuriosityLoops(paras)).toEqual([]);
  });

  it("begrenzt Suche auf 5 Absätze", () => {
    const text = "Was ist los?\n\nA.\n\nB.\n\nC.\n\nD.\n\nE.\n\nAlso, es war ein Unfall.";
    const paras = parseParagraphs(text);
    const loops = detectCuriosityLoops(paras);
    // Antwort ist in Absatz 7, Setup in 1 → Distanz 6 > 5 → kein Loop
    expect(loops).toEqual([]);
  });

  it("erkennt mehrere Loops", () => {
    const text = "Wer war es?\n\nAlso, es war sie.\n\nWarum hat sie es getan?\n\nDeshalb, aus Rache.";
    const paras = parseParagraphs(text);
    const loops = detectCuriosityLoops(paras);
    expect(loops.length).toBe(2);
  });

  it("berechnet Spannung nach Distanz", () => {
    const text = "Wer war es?\n\nA.\n\nB.\n\nC.\n\nAlso, es war der Butler.";
    const paras = parseParagraphs(text);
    const loops = detectCuriosityLoops(paras);
    expect(loops[0].tension).toBeGreaterThan(30);
  });
});

describe("detectCliffhangers", () => {
  it("erkennt Enthüllung als Cliffhanger", () => {
    const text = "Er öffnete die Tür. Die Wahrheit wurde enthüllt.";
    const paras = parseParagraphs(text);
    const ch = detectCliffhangers(paras);
    expect(ch.length).toBeGreaterThan(0);
    expect(ch[0].type).toBe("reveal");
  });

  it("erkennt Gefahr als Cliffhanger", () => {
    const text = "Sie hörte ein Geräusch. Plötzlich eine Explosion.";
    const paras = parseParagraphs(text);
    const ch = detectCliffhangers(paras);
    expect(ch.some((c) => c.type === "danger")).toBe(true);
  });

  it("erkennt offene Frage als Cliffhanger", () => {
    const text = "Er stand vor der Tür und öffnete sie langsam. Wer war es?";
    const paras = parseParagraphs(text);
    const ch = detectCliffhangers(paras);
    expect(ch.some((c) => c.type === "question")).toBe(true);
  });

  it("findet keine Cliffhanger in ruhigem Text", () => {
    const text = "Es war ein schöner Tag. Die Blumen blühten.";
    const paras = parseParagraphs(text);
    expect(detectCliffhangers(paras)).toEqual([]);
  });

  it("berechnet Stärke", () => {
    const text = "Er ging. Die Wahrheit wurde enthüllt.";
    const paras = parseParagraphs(text);
    const ch = detectCliffhangers(paras);
    expect(ch[0].strength).toBeGreaterThan(0);
    expect(ch[0].strength).toBeLessThanOrEqual(100);
  });
});

describe("analyzePacing", () => {
  const SAMPLE = `Sie stand am Fenster und weinte. Der Verlust saß zu tief.

Plötzlich zersplitterte das Glas. Eine Waffe, ein Schuss, keine Zeit mehr.

Wer war der Angreifer? Niemand wusste es.

Also, der Angreifer war ihr bester Freund. Die Wahrheit wurde enthüllt.`;

  it("erstellt vollständigen Bericht", () => {
    const report = analyzePacing(SAMPLE);
    expect(report.dopamineCurve.length).toBe(4);
    expect(report.curiosityLoops.length).toBeGreaterThan(0);
    expect(report.cliffhangers.length).toBeGreaterThan(0);
  });

  it("berechnet Durchschnitt", () => {
    const report = analyzePacing(SAMPLE);
    expect(report.averageDopamine).toBeGreaterThanOrEqual(0);
    expect(report.averageDopamine).toBeLessThanOrEqual(100);
  });

  it("findet Peak", () => {
    const report = analyzePacing(SAMPLE);
    expect(report.peakDopamine).toBeGreaterThanOrEqual(report.averageDopamine);
    expect(report.peakParagraph).toBeGreaterThanOrEqual(1);
  });

  it("gibt Pacing-Verdict", () => {
    const report = analyzePacing(SAMPLE);
    expect(report.pacingVerdict.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const r1 = analyzePacing(SAMPLE, 42);
    const r2 = analyzePacing(SAMPLE, 42);
    expect(r1).toEqual(r2);
  });

  it("verarbeitet leeren Text", () => {
    const report = analyzePacing("");
    expect(report.dopamineCurve).toEqual([]);
    expect(report.averageDopamine).toBe(0);
    expect(report.peakDopamine).toBe(0);
  });

  it("erkennt Curiosity-Loops im Sample", () => {
    const report = analyzePacing(SAMPLE);
    expect(report.curiosityLoops.some((l) => l.question.toLowerCase().includes("wer"))).toBe(true);
  });
});

describe("formatDopamineCurve", () => {
  it("formatiert Kurve als Text", () => {
    const report = analyzePacing("Plötzlich! Gefahr!\n\nRuhig.");
    const text = formatDopamineCurve(report);
    expect(text).toContain("§");
    expect(text).toContain("%");
    expect(text).toContain("█");
  });

  it("verarbeitet leeren Bericht", () => {
    const report = analyzePacing("");
    expect(formatDopamineCurve(report)).toBe("");
  });
});

describe("formatCuriosityLoops", () => {
  it("formatiert Loops", () => {
    const report = analyzePacing("Wer war der Mörder?\n\nAlso, es war der Butler.");
    const text = formatCuriosityLoops(report.curiosityLoops);
    expect(text).toContain("§");
    expect(text).toContain("Spannung");
  });

  it("verarbeitet leere Liste", () => {
    expect(formatCuriosityLoops([])).toContain("Keine");
  });
});

describe("formatCliffhangers", () => {
  it("formatiert Cliffhangers", () => {
    const report = analyzePacing("Die Wahrheit wurde enthüllt.");
    const text = formatCliffhangers(report.cliffhangers);
    expect(text).toContain("§");
    expect(text).toContain("Stärke");
  });

  it("verarbeitet leere Liste", () => {
    expect(formatCliffhangers([])).toContain("Keine");
  });
});
