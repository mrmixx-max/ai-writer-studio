// Tests: Physical-Print-Simulator (WP 45.2)
import { describe, it, expect } from "vitest";
import {
  calculateSpineWidth,
  calculateCoverDimensions,
  simulate3dHardcover,
  listPaperPresets,
  PAPER_PRESETS,
  COVER_ALLOWANCE_HARDCOVER_MM,
  COVER_ALLOWANCE_SOFTCOVER_MM,
  DEFAULT_BLEED_MM,
  DEFAULT_TRIM_SIZE,
  SPINE_CURVE_SEGMENTS,
  type PaperType,
  type BindingType,
  type SpineResult,
  type TrimSize,
} from "./physicalPrintSimulator";

// Standard-Trimmgröße für Umschlag-Tests (A5).
const A5: TrimSize = { widthMm: 148, heightMm: 210, label: "A5" };

// ---------------------------------------------------------------------------
// calculateSpineWidth
// ---------------------------------------------------------------------------

describe("calculateSpineWidth", () => {
  it("Offset 80g, Softcover: 200 Seiten → 8.20mm", () => {
    // (200/2) * (80/1000) * 1.0 + 0.2 = 8.2
    const r = calculateSpineWidth(200, "offset80", "softcover");
    expect(r.spineWidthMm).toBe(8.2);
    expect(r.coverAllowanceMm).toBe(COVER_ALLOWANCE_SOFTCOVER_MM);
    expect(r.pageCount).toBe(200);
    expect(r.paper).toBe("offset80");
    expect(r.binding).toBe("softcover");
  });

  it("Offset 80g, Hardcover: 200 Seiten → 8.60mm", () => {
    // 8.0 + 0.6
    const r = calculateSpineWidth(200, "offset80", "hardcover");
    expect(r.spineWidthMm).toBe(8.6);
    expect(r.coverAllowanceMm).toBe(COVER_ALLOWANCE_HARDCOVER_MM);
    expect(r.binding).toBe("hardcover");
  });

  it("Werkdruck 90g (Vol 1.5), Softcover: 300 Seiten → 20.45mm", () => {
    // (300/2) * 0.09 * 1.5 + 0.2 = 20.25 + 0.2
    const r = calculateSpineWidth(300, "werkdruck90", "softcover");
    expect(r.spineWidthMm).toBe(20.45);
  });

  it("Werkdruck 90g (Vol 1.75), Softcover: 300 Seiten → 23.83mm", () => {
    // (300/2) * 0.09 * 1.75 + 0.2 = 23.625 + 0.2 = 23.825 → gerundet 23.83
    const r = calculateSpineWidth(300, "werkdruck90_175", "softcover");
    expect(r.spineWidthMm).toBe(23.83);
  });

  it("Bilderdruck 100g (Vol 0.9), Softcover: 400 Seiten → 18.20mm", () => {
    // (400/2) * 0.1 * 0.9 + 0.2 = 18.0 + 0.2
    const r = calculateSpineWidth(400, "bilderdruck100", "softcover");
    expect(r.spineWidthMm).toBe(18.2);
  });

  it("0 Seiten → nur Umschlagzugabe (0.20mm Softcover)", () => {
    const r = calculateSpineWidth(0, "offset80", "softcover");
    expect(r.spineWidthMm).toBe(0.2);
    expect(r.pageCount).toBe(0);
  });

  it("negative Seitenzahl wird defensiv zu 0", () => {
    const r = calculateSpineWidth(-100, "offset80", "softcover");
    expect(r.spineWidthMm).toBe(0.2);
    expect(r.pageCount).toBe(0);
  });

  it("NaN-Seitenzahl wird defensiv zu 0", () => {
    const r = calculateSpineWidth(NaN, "offset80", "softcover");
    expect(r.spineWidthMm).toBe(0.2);
    expect(r.pageCount).toBe(0);
  });

  it("Infinity-Seitenzahl wird defensiv zu 0", () => {
    const r = calculateSpineWidth(Infinity, "offset80", "softcover");
    expect(r.pageCount).toBe(0);
  });

  it("ungerade Seitenzahl wird abgerundet (floor)", () => {
    // 201 → 201/2 = 100.5 Bogen; floor(201) = 201 → 100.5*0.08+0.2 = 8.24
    const r = calculateSpineWidth(201, "offset80", "softcover");
    expect(r.pageCount).toBe(201);
    expect(r.spineWidthMm).toBe(8.24);
  });

  it("unbekanntes Papier fällt auf Offset 80 zurück", () => {
    const r = calculateSpineWidth(200, "doesNotExist" as PaperType, "softcover");
    expect(r.paper).toBe("offset80");
    expect(r.spineWidthMm).toBe(8.2);
  });

  it("unbekannter Bindungstyp fällt auf Softcover zurück", () => {
    const r = calculateSpineWidth(200, "offset80", "saddle" as BindingType);
    expect(r.binding).toBe("softcover");
    expect(r.spineWidthMm).toBe(8.2);
  });

  it("Ergebnis ist deterministisch (gleiche Eingabe → gleicher Wert)", () => {
    const a = calculateSpineWidth(342, "werkdruck90", "hardcover");
    const b = calculateSpineWidth(342, "werkdruck90", "hardcover");
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// calculateCoverDimensions
// ---------------------------------------------------------------------------

describe("calculateCoverDimensions", () => {
  const spine: SpineResult = calculateSpineWidth(200, "offset80", "softcover");

  it("addiert Rücken und 2× Beschnitt (A5, 8.20mm Rücken)", () => {
    // Breite: 148 + 8.2 + 148 + 2*3 = 310.2; Höhe: 210 + 2*3 = 216
    const c = calculateCoverDimensions(spine, A5);
    expect(c.frontWidthMm).toBe(148);
    expect(c.backWidthMm).toBe(148);
    expect(c.spineWidthMm).toBe(8.2);
    expect(c.totalWidthMm).toBe(310.2);
    expect(c.totalHeightMm).toBe(216);
    expect(c.bleedMm).toBe(DEFAULT_BLEED_MM);
  });

  it("Bleed ist Standard 3mm", () => {
    const c = calculateCoverDimensions(spine, A5);
    expect(c.bleedMm).toBe(3);
  });

  it("ungültige Trimmgröße fällt auf A5-Defaults zurück", () => {
    const c = calculateCoverDimensions(spine, {
      widthMm: NaN,
      heightMm: -5,
      label: "",
    } as TrimSize);
    expect(c.totalWidthMm).toBe(
      DEFAULT_TRIM_SIZE.widthMm * 2 + 8.2 + 2 * DEFAULT_BLEED_MM,
    );
    expect(c.totalHeightMm).toBe(DEFAULT_TRIM_SIZE.heightMm + 2 * DEFAULT_BLEED_MM);
  });

  it("ungültige Rückenbreite wird defensiv zu 0", () => {
    const bad = { ...spine, spineWidthMm: NaN } as SpineResult;
    const c = calculateCoverDimensions(bad, A5);
    expect(c.spineWidthMm).toBe(0);
    expect(c.totalWidthMm).toBe(148 + 0 + 148 + 6);
  });

  it("Rundung auf zwei Nachkommastellen", () => {
    const s: SpineResult = calculateSpineWidth(201, "offset80", "softcover"); // 8.24
    const c = calculateCoverDimensions(s, A5);
    expect(c.totalWidthMm).toBe(310.24);
  });
});

// ---------------------------------------------------------------------------
// simulate3dHardcover
// ---------------------------------------------------------------------------

describe("simulate3dHardcover", () => {
  const dims = calculateCoverDimensions(
    calculateSpineWidth(200, "offset80", "hardcover"), // Rücken 8.6
    A5,
  );

  it("liefert 17 Stützpunkte der Rückenkurve", () => {
    const s = simulate3dHardcover(dims);
    expect(s.spineCurve).toHaveLength(SPINE_CURVE_SEGMENTS + 1);
  });

  it("flache Rückenkurve ohne roundedSpine (y überall 0)", () => {
    const s = simulate3dHardcover(dims);
    expect(s.spineCurve.every((p) => p.y === 0)).toBe(true);
  });

  it("gerundeter Rücken erzeugt gewölbte Kurve (max y = Radius)", () => {
    const s = simulate3dHardcover(dims, {
      dustjacketFlaps: false,
      roundedSpine: true,
    });
    const maxY = Math.max(...s.spineCurve.map((p) => p.y));
    // Radius = Rückenbreite / 2 = 8.6 / 2 = 4.3
    expect(maxY).toBeCloseTo(4.3, 5);
  });

  it("ohne dustjacketFlaps ist die Einschlagbreite 0", () => {
    const s = simulate3dHardcover(dims, {
      dustjacketFlaps: false,
      roundedSpine: false,
    });
    expect(s.flapWidthMm).toBe(0);
  });

  it("dustjacketFlaps ohne Breite nutzt Default 80mm", () => {
    const s = simulate3dHardcover(dims, {
      dustjacketFlaps: true,
      roundedSpine: false,
    });
    expect(s.flapWidthMm).toBe(80);
  });

  it("dustjacketFlaps mit expliziter Breite übernimmt diese", () => {
    const s = simulate3dHardcover(dims, {
      dustjacketFlaps: true,
      flapWidthMm: 100,
      roundedSpine: false,
    });
    expect(s.flapWidthMm).toBe(100);
  });

  it("ungültige Einschlagbreite fällt auf Default 80mm zurück", () => {
    const s = simulate3dHardcover(dims, {
      dustjacketFlaps: true,
      flapWidthMm: NaN,
      roundedSpine: false,
    });
    expect(s.flapWidthMm).toBe(80);
  });

  it("totalDepthMm = Rückenbreite + 2× Deckelstärke (8.6 + 5)", () => {
    const s = simulate3dHardcover(dims);
    expect(s.totalDepthMm).toBe(13.6);
  });

  it("jointMm ist gesetzt und positiv", () => {
    const s = simulate3dHardcover(dims);
    expect(s.jointMm).toBeGreaterThan(0);
  });

  it("fehlende Options werden defensiv behandelt", () => {
    const s = simulate3dHardcover(dims);
    expect(s.flapWidthMm).toBe(0);
    expect(s.spineCurve.every((p) => p.y === 0)).toBe(true);
    expect(Number.isFinite(s.totalDepthMm)).toBe(true);
  });

  it("ungültige Rückenbreite in dims wird defensiv zu 0", () => {
    const bad = { ...dims, spineWidthMm: NaN } as typeof dims;
    const s = simulate3dHardcover(bad, {
      dustjacketFlaps: false,
      roundedSpine: true,
    });
    expect(s.totalDepthMm).toBe(5); // 0 + 2*2.5
    expect(s.spineCurve.every((p) => p.y === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listPaperPresets
// ---------------------------------------------------------------------------

describe("listPaperPresets", () => {
  it("liefert alle vier Presets", () => {
    const presets = listPaperPresets();
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      "offset80",
      "werkdruck90",
      "werkdruck90_175",
      "bilderdruck100",
    ]);
  });

  it("Preset-Werte entsprechen der Spezifikation", () => {
    const byId = Object.fromEntries(listPaperPresets().map((p) => [p.id, p]));
    expect(byId.offset80).toMatchObject({ grammage: 80, volume: 1.0 });
    expect(byId.werkdruck90).toMatchObject({ grammage: 90, volume: 1.5 });
    expect(byId.werkdruck90_175).toMatchObject({ grammage: 90, volume: 1.75 });
    expect(byId.bilderdruck100).toMatchObject({ grammage: 100, volume: 0.9 });
  });

  it("jedes Preset hat ein nicht-leeres Label", () => {
    for (const p of listPaperPresets()) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("liefert eine Kopie — Mutation beeinflusst die Quelle nicht", () => {
    const first = listPaperPresets();
    first[0].grammage = 999;
    const second = listPaperPresets();
    expect(second[0].grammage).toBe(PAPER_PRESETS[0].grammage);
    expect(second[0].grammage).toBe(80);
  });
});
