// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SOUND_SCULPTURES,
  getSoundSculpture,
  chooseSculpture,
  arrangeGraphicScore,
  renderScoreSvg,
  buildScoreAudioPatch,
  createSampleSceneTensions,
  createSampleGraphicScore,
  createSampleScoreExport,
} from "./graphicScoreArranger";

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
    const r = createSeededRandom(9);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("SOUND_SCULPTURES", () => {
  it("enthält sechs Klangskulpturen", () => {
    expect(SOUND_SCULPTURES).toHaveLength(6);
  });
  it("jede Skulptur hat eine grafische Marke", () => {
    for (const s of SOUND_SCULPTURES) {
      expect(s.graphicMark.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
  it("getSoundSculpture findet das Crescendo", () => {
    expect(getSoundSculpture("crescendo")?.name).toContain("Crescendo");
  });
  it("getSoundSculpture liefert undefined für unbekannt", () => {
    expect(getSoundSculpture("xyz" as never)).toBeUndefined();
  });
});

describe("chooseSculpture", () => {
  it("ist deterministisch", () => {
    expect(chooseSculpture(0.5, 42).id).toBe(chooseSculpture(0.5, 42).id);
  });
  it("niedrige Spannung wählt Stille oder Drone", () => {
    const s = chooseSculpture(0.05, 42);
    expect(["silence", "drone"]).toContain(s.id);
  });
  it("höchste Spannung wählt Crescendo oder Cluster", () => {
    const s = chooseSculpture(1.0, 42);
    expect(["crescendo", "cluster"]).toContain(s.id);
  });
  it("Spannung wird auf 0..1 begrenzt", () => {
    expect(chooseSculpture(-5, 42).id).toBe(chooseSculpture(0, 42).id);
    expect(chooseSculpture(99, 42).id).toBe(chooseSculpture(1, 42).id);
  });
});

describe("arrangeGraphicScore", () => {
  const scenes = createSampleSceneTensions();
  it("ist deterministisch", () => {
    expect(arrangeGraphicScore("T", scenes, 42).id).toBe(arrangeGraphicScore("T", scenes, 42).id);
  });
  it("erzeugt ein Band je Szene", () => {
    expect(arrangeGraphicScore("T", scenes, 42).bands).toHaveLength(6);
  });
  it("Bänder sind sequenziell angeordnet", () => {
    const score = arrangeGraphicScore("T", scenes, 42);
    for (let i = 1; i < score.bands.length; i++) {
      expect(score.bands[i].startSeconds).toBeGreaterThanOrEqual(
        score.bands[i - 1].startSeconds + score.bands[i - 1].durationSeconds
      );
    }
  });
  it("berechnet die Gesamtdauer", () => {
    const score = arrangeGraphicScore("T", scenes, 42);
    expect(score.totalSeconds).toBe(scenes.reduce((s, x) => s + x.durationSeconds, 0));
  });
  it("ermittelt die Spitzenspannung", () => {
    expect(arrangeGraphicScore("T", scenes, 42).peakTension).toBe(1);
  });
  it("leere Szenenliste liefert leere Partitur", () => {
    const score = arrangeGraphicScore("T", [], 42);
    expect(score.bands).toHaveLength(0);
    expect(score.totalSeconds).toBe(0);
  });
  it("Intensität bleibt im Bereich 0..1", () => {
    for (const band of arrangeGraphicScore("T", scenes, 42).bands) {
      expect(band.intensity).toBeGreaterThanOrEqual(0);
      expect(band.intensity).toBeLessThanOrEqual(1);
    }
  });
  it("Stille-Band hat Frequenz 0", () => {
    const score = arrangeGraphicScore("T", [{ sceneId: "s", label: "L", tension: 0.05, durationSeconds: 10 }], 42);
    const band = score.bands[0];
    if (band.sculpture.id === "silence") {
      expect(band.baseFrequencyHz).toBe(0);
    }
  });
});

describe("renderScoreSvg", () => {
  it("erzeugt SVG mit Design-Tokens", () => {
    const exp = renderScoreSvg(createSampleGraphicScore());
    expect(exp.svg).toContain("<svg");
    expect(exp.svg).toContain("var(--accent)");
  });
  it("enthält keine Hex-Farben", () => {
    const exp = renderScoreSvg(createSampleGraphicScore());
    expect(exp.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("nennt den Titel und Zeitmarken", () => {
    const exp = renderScoreSvg(createSampleGraphicScore());
    expect(exp.svg).toContain("Die Schenke am Nebelpass");
    expect(exp.svg).toContain("s<");
  });
  it("ist deterministisch", () => {
    expect(renderScoreSvg(createSampleGraphicScore()).svg).toBe(renderScoreSvg(createSampleGraphicScore()).svg);
  });
  it("zählt die Bänder", () => {
    expect(renderScoreSvg(createSampleGraphicScore()).bandCount).toBe(6);
  });
});

describe("buildScoreAudioPatch", () => {
  it("erzeugt ein Patch je Band", () => {
    const patch = buildScoreAudioPatch(createSampleGraphicScore());
    expect(patch.bands).toHaveLength(6);
  });
  it("Cluster nutzen Sägezahn, Drones Sinus", () => {
    const patch = buildScoreAudioPatch(createSampleGraphicScore());
    for (const b of patch.bands) {
      if (b.sculptureId === "cluster") expect(b.oscillator).toBe("sawtooth");
      if (b.sculptureId === "drone") expect(b.oscillator).toBe("sine");
    }
  });
  it("erzeugt eine lesbare Anweisung", () => {
    const patch = buildScoreAudioPatch(createSampleGraphicScore());
    expect(patch.instruction).toContain("Klangbänder");
    expect(patch.durationSeconds).toBeGreaterThan(0);
  });
  it("Gain bleibt im Bereich 0..1", () => {
    for (const b of buildScoreAudioPatch(createSampleGraphicScore()).bands) {
      expect(b.gain).toBeGreaterThanOrEqual(0);
      expect(b.gain).toBeLessThanOrEqual(1);
    }
  });
  it("ist deterministisch", () => {
    expect(buildScoreAudioPatch(createSampleGraphicScore()).id).toBe(buildScoreAudioPatch(createSampleGraphicScore()).id);
  });
});

describe("createSampleSceneTensions", () => {
  it("erzeugt sechs Szenen", () => {
    expect(createSampleSceneTensions()).toHaveLength(6);
  });
  it("Spannung bleibt im Bereich 0..1", () => {
    for (const s of createSampleSceneTensions()) {
      expect(s.tension).toBeGreaterThanOrEqual(0);
      expect(s.tension).toBeLessThanOrEqual(1);
    }
  });
});

describe("createSampleScoreExport", () => {
  it("erzeugt einen druckfertigen Export", () => {
    const exp = createSampleScoreExport();
    expect(exp.svg).toContain("<svg");
    expect(exp.width).toBe(800);
  });
});
