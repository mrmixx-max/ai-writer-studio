/**
 * Tests: OpticalMarginAlignment (WP 83.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  computeAlignment,
  computeAllAlignments,
  generateHangingPunctuationCSS,
  generateSVGFallback,
  formatAlignments,
  createSampleAlignments,
  GLYPH_PROTRUSION,
  GLYPH_LABELS,
} from "./opticalMarginAlignment";

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

describe("computeAlignment", () => {
  it("berechnet Ausgleich für Bindestrich", () => {
    const result = computeAlignment("hyphen");
    expect(result.protrusionPercent).toBe(100);
  });

  it("berechnet Ausgleich für Punkt", () => {
    const result = computeAlignment("period");
    expect(result.protrusionPercent).toBe(70);
  });
});

describe("computeAllAlignments", () => {
  it("berechnet alle 5 Ausgleiche", () => {
    const results = computeAllAlignments();
    expect(results).toHaveLength(5);
  });
});

describe("generateHangingPunctuationCSS", () => {
  it("generiert CSS", () => {
    const css = generateHangingPunctuationCSS();
    expect(css).toContain("hanging-punctuation");
  });
});

describe("generateSVGFallback", () => {
  it("generiert SVG", () => {
    const svg = generateSVGFallback("hyphen");
    expect(svg).toContain("<svg");
  });
});

describe("formatAlignments", () => {
  it("formatiert Ausgleiche als Text", () => {
    const results = createSampleAlignments();
    const text = formatAlignments(results);
    expect(text).toContain("OPTISCHER RANDAUSGLEICH");
  });
});

describe("createSampleAlignments", () => {
  it("erstellt Beispiel-Ausgleiche", () => {
    const results = createSampleAlignments();
    expect(results).toHaveLength(5);
  });
});

describe("GLYPH_PROTRUSION", () => {
  it("hat alle Glyphen", () => {
    expect(Object.keys(GLYPH_PROTRUSION)).toHaveLength(5);
  });
});

describe("GLYPH_LABELS", () => {
  it("hat alle Labels", () => {
    expect(Object.keys(GLYPH_LABELS)).toHaveLength(5);
  });
});
