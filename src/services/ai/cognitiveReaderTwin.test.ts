// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  READER_ARCHETYPES,
  getArchetype,
  analyzeSentence,
  analyzeText,
  simulateReader,
  buildHeatmap,
  analyzeReaderTwin,
  createSampleReaderTwinReport,
  SAMPLE_TEXT,
} from "./cognitiveReaderTwin";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("READER_ARCHETYPES", () => {
  it("enthält vier Archetypen", () => {
    expect(READER_ARCHETYPES).toHaveLength(4);
  });
  it("Skimmer gewichtet Dialog höher als Beschreibung", () => {
    const skimmer = getArchetype("skimmer");
    expect(skimmer!.weights.dialogue).toBeGreaterThan(skimmer!.weights.description);
  });
  it("Kontemplator gewichtet Metaphern hoch", () => {
    expect(getArchetype("contemplator")!.weights.metaphor).toBeGreaterThan(0.5);
  });
  it("Dopamin-Sucher hat die niedrigste Geduldsgrenze", () => {
    const limit = getArchetype("dopamineSeeker")!.patienceLimit;
    for (const a of READER_ARCHETYPES) {
      if (a.id !== "dopamineSeeker") expect(a.patienceLimit).toBeGreaterThanOrEqual(limit);
    }
  });
  it("getArchetype liefert undefined für unbekannt", () => {
    expect(getArchetype("xyz" as never)).toBeUndefined();
  });
});

describe("analyzeSentence", () => {
  it("zählt Wörter", () => {
    expect(analyzeSentence(0, "Der Wind strich über die Dächer.").wordCount).toBe(6);
  });
  it("erkennt Dialog", () => {
    expect(analyzeSentence(0, "„Wir gehen jetzt“, sagte er.").hasDialogue).toBe(true);
  });
  it("erkennt Beschreibung", () => {
    expect(analyzeSentence(0, "Der Himmel hatte die Farbe alten Blutes.").hasDescription).toBe(true);
  });
  it("erkennt Metaphern-Marker", () => {
    expect(analyzeSentence(0, "Der Wind strich wie eine Hand über die Haut.").metaphorDensity).toBeGreaterThan(0);
  });
  it("Komplexität bleibt im Bereich 0..1", () => {
    const s = analyzeSentence(0, "Obwohl der Himmel, der über den Zinnen hing, die Farbe alten Blutes angenommen hatte, schwieg sie.");
    expect(s.complexity).toBeGreaterThanOrEqual(0);
    expect(s.complexity).toBeLessThanOrEqual(1);
  });
});

describe("analyzeText", () => {
  it("leerer Text liefert leeres Array", () => {
    expect(analyzeText("")).toHaveLength(0);
  });
  it("teilt Text in Sätze", () => {
    const sentences = analyzeText("Er ging. Sie blieb. Dann kam der Sturm.");
    expect(sentences).toHaveLength(3);
    expect(sentences[0].index).toBe(0);
  });
  it("ist deterministisch", () => {
    expect(analyzeText(SAMPLE_TEXT).map((s) => s.wordCount)).toEqual(analyzeText(SAMPLE_TEXT).map((s) => s.wordCount));
  });
});

describe("simulateReader", () => {
  const sentences = analyzeText(SAMPLE_TEXT);
  it("ist deterministisch", () => {
    expect(simulateReader(sentences, "skimmer", 42).totalDwellMs).toBe(simulateReader(sentences, "skimmer", 42).totalDwellMs);
  });
  it("verschiedene Archetypen erleben unterschiedlich", () => {
    const a = simulateReader(sentences, "skimmer", 42);
    const b = simulateReader(sentences, "contemplator", 42);
    expect(a.totalDwellMs).not.toBe(b.totalDwellMs);
  });
  it("erzeugt eine Fixation je Satz", () => {
    expect(simulateReader(sentences, "contemplator", 1).fixations).toHaveLength(sentences.length);
  });
  it("Engagement bleibt im Bereich 0..100", () => {
    const e = simulateReader(sentences, "plotHacker", 5);
    expect(e.engagementScore).toBeGreaterThanOrEqual(0);
    expect(e.engagementScore).toBeLessThanOrEqual(100);
  });
  it("leerer Text liefert neutrales Ergebnis", () => {
    const e = simulateReader([], "skimmer", 42);
    expect(e.fixations).toHaveLength(0);
    expect(e.engagementScore).toBe(100);
  });
  it("unbekannter Archetyp liefert neutrales Ergebnis", () => {
    const e = simulateReader(sentences, "xyz" as never, 42);
    expect(e.fixations).toHaveLength(0);
  });
});

describe("buildHeatmap", () => {
  it("leeres Array liefert leere Heatmap", () => {
    expect(buildHeatmap([])).toHaveLength(0);
  });
  it("eine Zelle je Satz", () => {
    const sentences = analyzeText(SAMPLE_TEXT);
    const exp = simulateReader(sentences, "skimmer", 42);
    expect(buildHeatmap([exp])).toHaveLength(sentences.length);
  });
  it("Intensität bleibt im Bereich 0..1", () => {
    const sentences = analyzeText(SAMPLE_TEXT);
    const exps = (["skimmer", "contemplator"] as const).map((a) => simulateReader(sentences, a, 42));
    for (const cell of buildHeatmap(exps)) {
      expect(cell.intensity).toBeGreaterThanOrEqual(0);
      expect(cell.intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe("analyzeReaderTwin", () => {
  it("ist deterministisch", () => {
    expect(analyzeReaderTwin(SAMPLE_TEXT, ["skimmer"], 42).id).toBe(analyzeReaderTwin(SAMPLE_TEXT, ["skimmer"], 42).id);
  });
  it("erzeugt eine Erfahrung je Archetyp", () => {
    const r = analyzeReaderTwin(SAMPLE_TEXT, ["skimmer", "contemplator"], 42);
    expect(r.experiences).toHaveLength(2);
  });
  it("leere Archetypen fallen auf alle vier zurück", () => {
    expect(analyzeReaderTwin(SAMPLE_TEXT, [], 42).experiences).toHaveLength(4);
  });
  it("benennt den schwächsten Archetyp", () => {
    const r = analyzeReaderTwin(SAMPLE_TEXT, ["skimmer", "contemplator", "dopamineSeeker"], 42);
    expect(r.weakestArchetype).not.toBeNull();
    expect(r.experiences.some((e) => e.archetype === r.weakestArchetype)).toBe(true);
  });
  it("Gesamt-Retention bleibt im Bereich 0..100", () => {
    const r = analyzeReaderTwin(SAMPLE_TEXT, ["skimmer"], 42);
    expect(r.overallRetention).toBeGreaterThanOrEqual(0);
    expect(r.overallRetention).toBeLessThanOrEqual(100);
  });
  it("zählt Sätze", () => {
    expect(analyzeReaderTwin(SAMPLE_TEXT, ["skimmer"], 42).sentenceCount).toBeGreaterThan(0);
  });
});

describe("createSampleReaderTwinReport", () => {
  it("erzeugt einen Bericht mit vier Archetypen", () => {
    const r = createSampleReaderTwinReport();
    expect(r.experiences).toHaveLength(4);
    expect(r.heatmap.length).toBeGreaterThan(0);
  });
});
