// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  VIGNETTE_KINDS,
  getVignetteKind,
  COMPASS_DIRECTIONS,
  buildCompassRose,
  buildRhumbNetwork,
  createPortolanChart,
  buildPrintSheet,
  analyzePortolanChart,
  createSamplePortolanChart,
  createSamplePortolanReport,
} from "./portolanNauticalChart";

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
    const r = createSeededRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("VIGNETTE_KINDS", () => {
  it("enthält sechs maritime Vignetten", () => {
    expect(VIGNETTE_KINDS).toHaveLength(6);
  });
  it("jede Vignette hat Beschreibung und SVG", () => {
    for (const v of VIGNETTE_KINDS) {
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.svg.length).toBeGreaterThan(10);
    }
  });
  it("Vignetten nutzen Design-Tokens, keine Hex-Farben", () => {
    for (const v of VIGNETTE_KINDS) {
      expect(v.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
    }
  });
  it("getVignetteKind findet die Krake", () => {
    expect(getVignetteKind("kraken")?.name).toBe("Krake");
  });
  it("getVignetteKind liefert undefined für unbekannt", () => {
    expect(getVignetteKind("xyz" as never)).toBeUndefined();
  });
});

describe("COMPASS_DIRECTIONS", () => {
  it("enthält 16 Richtungen", () => {
    expect(COMPASS_DIRECTIONS).toHaveLength(16);
  });
  it("beginnt mit Nord und endet mit Nordnordwest", () => {
    expect(COMPASS_DIRECTIONS[0]).toBe("N");
    expect(COMPASS_DIRECTIONS[15]).toBe("NNW");
  });
  it("Süden liegt an Position 9", () => {
    expect(COMPASS_DIRECTIONS[8]).toBe("S");
  });
});

describe("buildCompassRose", () => {
  it("erzeugt 16 Strahlen", () => {
    expect(buildCompassRose(100, 100, 50).rays).toHaveLength(16);
  });
  it("alle Strahlen beginnen im Zentrum", () => {
    const rose = buildCompassRose(100, 100, 50);
    for (const ray of rose.rays) {
      expect(ray.x1).toBe(100);
      expect(ray.y1).toBe(100);
    }
  });
  it("Nordstrahl zeigt nach oben (y kleiner als Zentrum)", () => {
    const rose = buildCompassRose(100, 100, 50);
    const north = rose.rays.find((r) => r.direction === "N")!;
    expect(north.y2).toBeLessThan(100);
  });
  it("Südstrahl zeigt nach unten", () => {
    const rose = buildCompassRose(100, 100, 50);
    const south = rose.rays.find((r) => r.direction === "S")!;
    expect(south.y2).toBeGreaterThan(100);
  });
  it("Oststrahl zeigt nach rechts", () => {
    const rose = buildCompassRose(100, 100, 50);
    const east = rose.rays.find((r) => r.direction === "O")!;
    expect(east.x2).toBeGreaterThan(100);
  });
  it("ist deterministisch", () => {
    expect(buildCompassRose(50, 50, 30).rays[0].x2).toBe(buildCompassRose(50, 50, 30).rays[0].x2);
  });
});

describe("buildRhumbNetwork", () => {
  it("erzeugt Strahlen von jeder Rose", () => {
    const lines = buildRhumbNetwork([buildCompassRose(100, 100, 50)], 500, 400);
    expect(lines.length).toBeGreaterThan(0);
  });
  it("Linien enden am oder vor dem Kartenrand", () => {
    const lines = buildRhumbNetwork([buildCompassRose(100, 100, 50)], 500, 400);
    for (const l of lines) {
      expect(l.toX).toBeGreaterThanOrEqual(-0.1);
      expect(l.toX).toBeLessThanOrEqual(500.1);
      expect(l.toY).toBeGreaterThanOrEqual(-0.1);
      expect(l.toY).toBeLessThanOrEqual(400.1);
    }
  });
  it("trägt die Zielrichtung", () => {
    const lines = buildRhumbNetwork([buildCompassRose(100, 100, 50)], 500, 400);
    expect(COMPASS_DIRECTIONS).toContain(lines[0].bearing);
  });
  it("ist deterministisch", () => {
    const a = buildRhumbNetwork([buildCompassRose(100, 100, 50)], 500, 400);
    const b = buildRhumbNetwork([buildCompassRose(100, 100, 50)], 500, 400);
    expect(a.map((l) => l.toX)).toEqual(b.map((l) => l.toX));
  });
  it("leere Rosenliste liefert keine Linien", () => {
    expect(buildRhumbNetwork([], 500, 400)).toHaveLength(0);
  });
});

describe("createPortolanChart", () => {
  it("ist deterministisch", () => {
    expect(createPortolanChart({ title: "Test", seed: 42 }).id).toBe(createPortolanChart({ title: "Test", seed: 42 }).id);
  });
  it("erzeugt SVG mit Design-Tokens", () => {
    const c = createPortolanChart({ title: "Test", seed: 42 });
    expect(c.svg).toContain("<svg");
    expect(c.svg).toContain("var(--accent)");
  });
  it("enthält keine Hex-Farben", () => {
    const c = createPortolanChart({ title: "Test", seed: 42 });
    expect(c.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("nennt den Titel im SVG", () => {
    expect(createPortolanChart({ title: "Das Zwölfgestirn-Meer", seed: 42 }).svg).toContain("Das Zwölfgestirn-Meer");
  });
  it("erzeugt die gewünschte Rosenzahl", () => {
    expect(createPortolanChart({ title: "T", roseCount: 3, seed: 1 }).roses).toHaveLength(3);
  });
  it("erzeugt höchstens die gewünschte Vignettenzahl", () => {
    expect(createPortolanChart({ title: "T", vignetteCount: 4, seed: 1 }).vignettes.length).toBeLessThanOrEqual(4);
  });
  it("Vignetten sind ohne Duplikate", () => {
    const c = createPortolanChart({ title: "T", vignetteCount: 6, seed: 7 });
    expect(new Set(c.vignettes.map((v) => v.kind)).size).toBe(c.vignettes.length);
  });
  it("Standard-Auflösung ist 900×650", () => {
    const c = createPortolanChart({ title: "T", seed: 1 });
    expect(c.width).toBe(900);
    expect(c.height).toBe(650);
  });
  it("DPI ist 300", () => {
    expect(createPortolanChart({ title: "T", seed: 1 }).dpi).toBe(300);
  });
  it("erzwingt Mindestabmessungen", () => {
    const c = createPortolanChart({ title: "T", width: 50, height: 50, seed: 1 });
    expect(c.width).toBeGreaterThanOrEqual(200);
    expect(c.height).toBeGreaterThanOrEqual(200);
  });
});

describe("buildPrintSheet", () => {
  it("berechnet Zoll aus Pixeln bei 300 DPI", () => {
    const c = createPortolanChart({ title: "T", width: 900, height: 600, seed: 1 });
    const sheet = buildPrintSheet(c);
    expect(sheet.widthInches).toBe(3);
    expect(sheet.heightInches).toBe(2);
  });
  it("rechnet den Beschnitt in die Pixelgröße ein", () => {
    const c = createPortolanChart({ title: "T", width: 900, height: 600, seed: 1 });
    const sheet = buildPrintSheet(c, 300, 0.125);
    expect(sheet.pixelWidth).toBe(Math.round((3 + 0.25) * 300));
  });
  it("liefert drucktechnische Hinweise", () => {
    const sheet = buildPrintSheet(createSamplePortolanChart());
    expect(sheet.notes.length).toBeGreaterThanOrEqual(4);
    expect(sheet.notes[0]).toContain("300");
  });
  it("DPI wird auf mindestens 72 begrenzt", () => {
    const sheet = buildPrintSheet(createSamplePortolanChart(), 10);
    expect(sheet.dpi).toBe(72);
  });
});

describe("analyzePortolanChart", () => {
  it("ist deterministisch", () => {
    expect(analyzePortolanChart({ title: "T", seed: 42 }).id).toBe(analyzePortolanChart({ title: "T", seed: 42 }).id);
  });
  it("zählt Rosen, Loxodromen und Vignetten", () => {
    const r = analyzePortolanChart({ title: "T", roseCount: 2, vignetteCount: 4, seed: 42 });
    expect(r.roseCount).toBe(2);
    expect(r.vignetteCount).toBeLessThanOrEqual(4);
    expect(r.rhumbLineCount).toBeGreaterThan(0);
  });
  it("enthält das Druckblatt", () => {
    expect(analyzePortolanChart({ title: "T", seed: 42 }).printSheet.dpi).toBe(300);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSamplePortolanChart liefert eine Seekarte", () => {
    expect(createSamplePortolanChart().title).toBe("Das Zwölfgestirn-Meer");
  });
  it("createSamplePortolanReport liefert einen Bericht", () => {
    expect(createSamplePortolanReport().printSheet.notes.length).toBeGreaterThan(0);
  });
});
