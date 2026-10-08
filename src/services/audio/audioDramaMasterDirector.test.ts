// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  TRACK_GAINS,
  createCastMember,
  createMasterTrack,
  addCue,
  analyzeTimeline,
  formatTimecode,
  buildCueSheet,
  exportCueSheetCsv,
  exportEdl,
  calculatePreviewMixdown,
  createAudioDramaScene,
  createAudioDramaPlan,
  createSampleAudioDramaPlan,
} from "./audioDramaMasterDirector";

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
    const r = createSeededRandom(3);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("TRACK_GAINS", () => {
  it("Stimme ist lauter als Ambient", () => {
    expect(TRACK_GAINS.voice).toBeGreaterThan(TRACK_GAINS.ambient);
  });
  it("deckt alle vier Spurtypen ab", () => {
    expect(Object.keys(TRACK_GAINS)).toHaveLength(4);
  });
});

describe("createCastMember", () => {
  it("ist deterministisch", () => {
    expect(createCastMember("Lyra", "Protagonistin", 42).voiceProfile).toBe(
      createCastMember("Lyra", "Protagonistin", 42).voiceProfile
    );
  });
  it("hat Rollen- und Stimmprofil", () => {
    const c = createCastMember("Bram", "Gefährte", 1);
    expect(c.role).toBe("Gefährte");
    expect(c.voiceProfile.length).toBeGreaterThan(0);
    expect(c.id.startsWith("cast-")).toBe(true);
  });
});

describe("createMasterTrack / addCue", () => {
  it("erzeugt die vier Spuren mit korrektem Gain", () => {
    expect(createMasterTrack("voice").gainDb).toBe(0);
    expect(createMasterTrack("ambient").gainDb).toBe(-14);
  });
  it("addCue sortiert nach Startzeit", () => {
    let t = createMasterTrack("foley");
    t = addCue(t, { id: "b", startMs: 5000, durationMs: 100, label: "spät", pan: 0 });
    t = addCue(t, { id: "a", startMs: 1000, durationMs: 100, label: "früh", pan: 0 });
    expect(t.cues[0].id).toBe("a");
  });
  it("mutiert die Eingabespur nicht", () => {
    const t = createMasterTrack("foley");
    addCue(t, { id: "x", startMs: 0, durationMs: 1, label: "x", pan: 0 });
    expect(t.cues).toHaveLength(0);
  });
});

describe("analyzeTimeline", () => {
  it("zählt Spuren und Cues", () => {
    const scene = createAudioDramaScene("Test", 42);
    const r = analyzeTimeline(scene);
    expect(r.trackCount).toBe(4);
    expect(r.cueCount).toBeGreaterThan(0);
  });
  it("berechnet die Gesamtdauer", () => {
    const r = analyzeTimeline(createAudioDramaScene("Test", 42));
    expect(r.totalDurationMs).toBeGreaterThan(0);
  });
});

describe("formatTimecode", () => {
  it("formatiert 0 ms als 00:00:00:00", () => {
    expect(formatTimecode(0)).toBe("00:00:00:00");
  });
  it("formatiert 3661000 ms als 01:01:01:00", () => {
    expect(formatTimecode(3661000)).toBe("01:01:01:00");
  });
  it("negative Werte werden auf 0 begrenzt", () => {
    expect(formatTimecode(-500)).toBe("00:00:00:00");
  });
});

describe("buildCueSheet / exportCueSheetCsv", () => {
  it("erstellt nummerierte Zeilen", () => {
    const rows = buildCueSheet(createAudioDramaScene("Test", 42));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].cueNumber).toBe(1);
  });
  it("CSV beginnt mit dem Header", () => {
    const csv = exportCueSheetCsv(createAudioDramaScene("Test", 42));
    expect(csv.split("\n")[0]).toBe("Cue,Start,Dauer,Spur,Label,Rolle");
  });
  it("CSV enthält die Rollenzuweisung", () => {
    const csv = exportCueSheetCsv(createAudioDramaScene("Test", 42));
    expect(csv).toContain("Lyra");
  });
});

describe("exportEdl", () => {
  it("beginnt mit TITLE und FCM", () => {
    const edl = exportEdl(createAudioDramaScene("Test", 42), "Die Schenke");
    const lines = edl.split("\n");
    expect(lines[0]).toBe("TITLE: Die Schenke");
    expect(lines[1]).toBe("FCM: NON-DROP FRAME");
  });
  it("enthält nummerierte Events und Clip-Namen", () => {
    const edl = exportEdl(createAudioDramaScene("Test", 42), "T");
    expect(edl).toContain("001");
    expect(edl).toContain("FROM CLIP NAME:");
  });
});

describe("calculatePreviewMixdown", () => {
  it("begrenzt den Spitzenwert auf höchstens -0.5 dB", () => {
    const m = calculatePreviewMixdown(createAudioDramaScene("Test", 42));
    expect(m.peakDb).toBeLessThanOrEqual(-0.5);
  });
  it("wendet Ducking an, wenn Sprache und Musik überlappen", () => {
    const m = calculatePreviewMixdown(createAudioDramaScene("Test", 42));
    expect(m.duckingApplied).toBe(true);
  });
  it("liefert Dauer und Sample-Anzahl", () => {
    const m = calculatePreviewMixdown(createAudioDramaScene("Test", 42), 50);
    expect(m.sampleCount).toBeGreaterThan(0);
    expect(m.durationMs).toBeGreaterThan(0);
  });
});

describe("createAudioDramaPlan", () => {
  it("ist deterministisch", () => {
    expect(createAudioDramaPlan("T", 42).id).toBe(createAudioDramaPlan("T", 42).id);
  });
  it("enthält Cuesheet, EDL und Preview", () => {
    const p = createAudioDramaPlan("T", 42);
    expect(p.cueSheetCsv.length).toBeGreaterThan(0);
    expect(p.edl).toContain("TITLE");
    expect(p.preview.durationMs).toBeGreaterThan(0);
  });
});

describe("createSampleAudioDramaPlan", () => {
  it("erzeugt einen Beispielplan mit vier Spuren", () => {
    const p = createSampleAudioDramaPlan();
    expect(p.report.trackCount).toBe(4);
    expect(p.scene.cast).toHaveLength(3);
  });
});
