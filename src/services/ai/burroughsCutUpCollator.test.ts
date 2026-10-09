// @vitest-environment jsdom
// Burroughs Cut-Up-Collator Tests (Meilenstein 60.0 / v7.2.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  CUT_PATTERNS,
  cutUpText,
  polishCutUp,
  buildCollage,
  createSampleCutPattern,
  createSampleCollage,
} from "./burroughsCutUpCollator";

const SOURCE =
  "Der Traum öffnet seine Augen über der Stadt und die Uhr im Nebel schlägt dreizehnmal.";
const FOREIGN =
  "Ein Spiegel zerbricht in der Hand des Fremden und der Schatten liest eine Nachricht.";

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("ist deterministisch für denselben String", () => {
    expect(hashString("cut-up")).toBe(hashString("cut-up"));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("quadrant")).not.toBe(hashString("diagonal"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Burroughs");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("Nova")).not.toBe(hashString("nova"));
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
    for (let i = 0; i < 1000; i++) {
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
// CUT_PATTERNS
// ---------------------------------------------------------------------------
describe("CUT_PATTERNS", () => {
  it("enthält genau 3 Schnittmuster", () => {
    expect(CUT_PATTERNS).toHaveLength(3);
  });

  it("enthält die erwarteten IDs", () => {
    const ids = CUT_PATTERNS.map((p) => p.id);
    expect(ids).toEqual(["quadrant", "diagonal", "threeWord"]);
  });

  it("hat gültige Felder für jedes Muster", () => {
    for (const p of CUT_PATTERNS) {
      expect(typeof p.id).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.bandCount).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// cutUpText
// ---------------------------------------------------------------------------
describe("cutUpText", () => {
  it("liefert Segmente und Metadaten", () => {
    const result = cutUpText(SOURCE, FOREIGN, "quadrant", 1);
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.pattern).toBe("quadrant");
    expect(result.sourceLength).toBe(SOURCE.length);
    expect(result.foreignLength).toBe(FOREIGN.length);
  });

  it("ist deterministisch für denselben Seed", () => {
    const a = cutUpText(SOURCE, FOREIGN, "threeWord", 5);
    const b = cutUpText(SOURCE, FOREIGN, "threeWord", 5);
    expect(a.segments).toEqual(b.segments);
  });

  it("funktioniert mit allen drei Mustern", () => {
    for (const p of CUT_PATTERNS) {
      const result = cutUpText(SOURCE, FOREIGN, p.id, 3);
      expect(result.pattern).toBe(p.id);
      expect(result.segments.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// polishCutUp
// ---------------------------------------------------------------------------
describe("polishCutUp", () => {
  const segments = ["Der Traum", "zerbricht", "im Nebel", "und der Schatten"];

  it("liefert Text, Glätte und Atemlosigkeit", () => {
    const result = polishCutUp(segments, 1);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.smoothness).toBeGreaterThanOrEqual(0);
    expect(result.smoothness).toBeLessThanOrEqual(100);
    expect(typeof result.breathless).toBe("boolean");
  });

  it("ist deterministisch für denselben Seed", () => {
    expect(polishCutUp(segments, 9).text).toBe(polishCutUp(segments, 9).text);
  });
});

// ---------------------------------------------------------------------------
// buildCollage
// ---------------------------------------------------------------------------
describe("buildCollage", () => {
  it("liefert eine vollständige Collage", () => {
    const result = buildCollage(SOURCE, FOREIGN, "quadrant", 1);
    expect(result.title.length).toBeGreaterThan(0);
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.polishedText.length).toBeGreaterThan(0);
    expect(result.smoothness).toBeGreaterThanOrEqual(0);
    expect(result.smoothness).toBeLessThanOrEqual(100);
    expect(result.coverSvg).toContain("<svg");
  });

  it("ist deterministisch für denselben Seed", () => {
    const a = buildCollage(SOURCE, FOREIGN, "diagonal", 4);
    const b = buildCollage(SOURCE, FOREIGN, "diagonal", 4);
    expect(a.title).toBe(b.title);
    expect(a.polishedText).toBe(b.polishedText);
    expect(a.coverSvg).toBe(b.coverSvg);
  });
});

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------
describe("createSampleCutPattern", () => {
  it("liefert ein gültiges Schnittmuster", () => {
    const p = createSampleCutPattern();
    expect(p.id).toBe("quadrant");
    expect(p.bandCount).toBeGreaterThan(0);
  });

  it("liefert eine Kopie, nicht das Original", () => {
    const p = createSampleCutPattern();
    p.name = "verändert";
    expect(CUT_PATTERNS[0].name).not.toBe("verändert");
  });
});

describe("createSampleCollage", () => {
  it("liefert eine gültige Beispiel-Collage", () => {
    const c = createSampleCollage();
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.segments.length).toBeGreaterThan(0);
    expect(c.coverSvg).toContain("<svg");
  });
});
