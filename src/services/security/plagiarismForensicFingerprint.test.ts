// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  tagWord,
  tagSequence,
  extractPosNGrams,
  buildStyleProfile,
  computeStyleFingerprint,
  compareFingerprints,
  buildForensicReport,
  createSampleForensicReport,
  SAMPLE_REFERENCE_TEXT,
  SAMPLE_SUSPECT_TEXT,
} from "./plagiarismForensicFingerprint";

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
    const r = createSeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("tagWord", () => {
  it("erkennt Artikel", () => {
    expect(tagWord("der")).toBe("art");
    expect(tagWord("eine")).toBe("art");
  });
  it("erkennt Pronomen", () => {
    expect(tagWord("ich")).toBe("pron");
  });
  it("erkennt Präpositionen", () => {
    expect(tagWord("über")).toBe("praep");
  });
  it("erkennt Konjunktionen", () => {
    expect(tagWord("obwohl")).toBe("konj");
  });
  it("erkennt Adverbien", () => {
    expect(tagWord("nicht")).toBe("adv");
  });
  it("erkennt Zahlen", () => {
    expect(tagWord("42")).toBe("zahl");
  });
  it("erkennt Verben an der Endung", () => {
    expect(tagWord("wandern")).toBe("verb");
    expect(tagWord("studieren")).toBe("verb");
  });
  it("erkennt Adjektive an der Endung", () => {
    expect(tagWord("wunderlich")).toBe("adj");
    expect(tagWord("furchtbar")).toBe("adj");
  });
  it("erkennt großgeschriebene Substantive", () => {
    expect(tagWord("Fenster")).toBe("subst");
  });
  it("leerer String ergibt sonst", () => {
    expect(tagWord("")).toBe("sonst");
  });
});

describe("tagSequence", () => {
  it("liefert ein Tag je Wort", () => {
    expect(tagSequence("Der Wind strich")).toHaveLength(3);
  });
  it("leerer String liefert leeres Array", () => {
    expect(tagSequence("")).toHaveLength(0);
  });
  it("ignoriert Mehrfach-Leerzeichen", () => {
    expect(tagSequence("der   Wind")).toHaveLength(2);
  });
});

describe("extractPosNGrams", () => {
  it("liefert Muster mit Zählungen", () => {
    const grams = extractPosNGrams("Der Wind strich über die Dächer", 3);
    expect(grams.length).toBeGreaterThan(0);
    expect(grams[0].count).toBeGreaterThan(0);
    expect(grams[0].pattern).toContain("-");
  });
  it("n=3 erzeugt Dreier-Muster", () => {
    const grams = extractPosNGrams("Der Wind strich über die Dächer", 3);
    expect(grams[0].pattern.split("-")).toHaveLength(3);
  });
  it("leerer Text liefert leeres Array", () => {
    expect(extractPosNGrams("", 3)).toHaveLength(0);
  });
  it("ist deterministisch", () => {
    expect(extractPosNGrams(SAMPLE_REFERENCE_TEXT, 3).map((g) => g.pattern)).toEqual(
      extractPosNGrams(SAMPLE_REFERENCE_TEXT, 3).map((g) => g.pattern)
    );
  });
  it("sortiert nach Häufigkeit absteigend", () => {
    const grams = extractPosNGrams(SAMPLE_REFERENCE_TEXT, 3);
    for (let i = 1; i < grams.length; i++) {
      expect(grams[i].count).toBeLessThanOrEqual(grams[i - 1].count);
    }
  });
  it("n wird auf mindestens 2 begrenzt", () => {
    const grams = extractPosNGrams("Der Wind strich", 1);
    expect(grams[0].pattern.split("-").length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildStyleProfile", () => {
  it("leerer Text liefert Nullprofil", () => {
    const p = buildStyleProfile("");
    expect(p.wordCount).toBe(0);
    expect(p.posNGrams).toHaveLength(0);
  });
  it("zählt Wörter und Sätze", () => {
    const p = buildStyleProfile("Der Wind strich. Die Tür schlug zu.");
    expect(p.wordCount).toBe(7);
    expect(p.sentenceCount).toBe(2);
  });
  it("berechnet die durchschnittliche Satzlänge", () => {
    const p = buildStyleProfile("Eins zwei drei. Vier fünf sechs.");
    expect(p.avgSentenceLength).toBe(3);
  });
  it("Satzlängen-Standardabweichung ist 0 bei gleich langen Sätzen", () => {
    const p = buildStyleProfile("Eins zwei drei. Vier fünf sechs.");
    expect(p.sentenceLengthStdDev).toBe(0);
  });
  it("Type-Token-Ratio bleibt im Bereich 0..1", () => {
    const p = buildStyleProfile(SAMPLE_REFERENCE_TEXT);
    expect(p.typeTokenRatio).toBeGreaterThan(0);
    expect(p.typeTokenRatio).toBeLessThanOrEqual(1);
  });
  it("Anteil langer Wörter bleibt im Bereich 0..1", () => {
    const p = buildStyleProfile(SAMPLE_REFERENCE_TEXT);
    expect(p.longWordRatio).toBeGreaterThanOrEqual(0);
    expect(p.longWordRatio).toBeLessThanOrEqual(1);
  });
});

describe("computeStyleFingerprint", () => {
  it("ist deterministisch", () => {
    expect(computeStyleFingerprint(SAMPLE_REFERENCE_TEXT).hash).toBe(computeStyleFingerprint(SAMPLE_REFERENCE_TEXT).hash);
  });
  it("Hash beginnt mit STYLE-", () => {
    expect(computeStyleFingerprint(SAMPLE_REFERENCE_TEXT).hash.startsWith("STYLE-")).toBe(true);
  });
  it("liefert höchstens 12 Signaturmuster", () => {
    expect(computeStyleFingerprint(SAMPLE_REFERENCE_TEXT).topPatterns.length).toBeLessThanOrEqual(12);
  });
  it("unterschiedliche Texte erzeugen unterschiedliche Hashes", () => {
    expect(computeStyleFingerprint("Der Wind strich über die Dächer.").hash).not.toBe(
      computeStyleFingerprint("Ein ganz anderer Satz mit völlig verschiedenen Wörtern und Strukturen.").hash
    );
  });
});

describe("compareFingerprints", () => {
  const a = computeStyleFingerprint(SAMPLE_REFERENCE_TEXT);
  const b = computeStyleFingerprint(SAMPLE_SUSPECT_TEXT);
  it("identische Fingerabdrücke ergeben 100 %", () => {
    const res = compareFingerprints(a, a);
    expect(res.overallIndex).toBe(100);
    expect(res.verdict).toBe("plagiat");
  });
  it("paraphrasierte Texte liegen im verdächtigen Bereich", () => {
    const res = compareFingerprints(a, b);
    expect(res.overallIndex).toBeGreaterThan(45);
    expect(["verwandt", "verdächtig", "plagiat"]).toContain(res.verdict);
  });
  it("Ähnlichkeiten bleiben im Bereich 0..1", () => {
    const res = compareFingerprints(a, b);
    for (const v of [res.syntacticSimilarity, res.rhythmSimilarity, res.lexicalSimilarity]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("Gesamtindex bleibt im Bereich 0..100", () => {
    const res = compareFingerprints(a, b);
    expect(res.overallIndex).toBeGreaterThanOrEqual(0);
    expect(res.overallIndex).toBeLessThanOrEqual(100);
  });
  it("nennt gemeinsame Muster", () => {
    expect(compareFingerprints(a, b).sharedPatterns.length).toBeGreaterThan(0);
  });
  it("unabhängige Texte liegen niedriger als Paraphrasen", () => {
    const unrelated = computeStyleFingerprint("Zahlen und Formeln ordnen sich in Reihen. Drei mal vier ergibt zwölf.");
    expect(compareFingerprints(a, unrelated).overallIndex).toBeLessThan(compareFingerprints(a, b).overallIndex);
  });
  it("leerer Verdachtstext ergibt keine hohe Ähnlichkeit", () => {
    const empty = computeStyleFingerprint("");
    // Ein Nullprofil hat keine Muster; die Überlappung bleibt deshalb bei 0.
    expect(compareFingerprints(empty, a).syntacticSimilarity).toBe(0);
    expect(compareFingerprints(empty, a).overallIndex).toBeLessThan(85);
  });
});

describe("buildForensicReport", () => {
  it("ist deterministisch", () => {
    expect(buildForensicReport(SAMPLE_REFERENCE_TEXT, SAMPLE_SUSPECT_TEXT).id).toBe(
      buildForensicReport(SAMPLE_REFERENCE_TEXT, SAMPLE_SUSPECT_TEXT).id
    );
  });
  it("enthält Referenz, Verdacht und Ähnlichkeit", () => {
    const r = buildForensicReport(SAMPLE_REFERENCE_TEXT, SAMPLE_SUSPECT_TEXT);
    expect(r.reference.hash.startsWith("STYLE-")).toBe(true);
    expect(r.suspect.hash.startsWith("STYLE-")).toBe(true);
    expect(r.similarity.overallIndex).toBeGreaterThan(0);
  });
  it("erzeugt Gutachten-Befunde", () => {
    const r = buildForensicReport(SAMPLE_REFERENCE_TEXT, SAMPLE_SUSPECT_TEXT);
    expect(r.findings.length).toBeGreaterThanOrEqual(4);
    expect(r.findings.some((f) => f.includes("Syntaktische DNA"))).toBe(true);
  });
  it("Zeitstempel ist fixiert (deterministisch)", () => {
    expect(buildForensicReport("a b c", "d e f").generatedAt).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("createSampleForensicReport", () => {
  it("erzeugt einen Beispielbericht", () => {
    const r = createSampleForensicReport();
    expect(r.similarity.overallIndex).toBeGreaterThan(0);
    expect(r.findings.length).toBeGreaterThan(0);
  });
});
