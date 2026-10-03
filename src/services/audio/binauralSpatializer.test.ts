// Tests: Binaural-Spatializer-Service (WP 36.2 — 3D-Spatialisierung).
//
// Deckt ab: calculateSpatialPosition, calculateDopplerEffect, exportSpatialTimeline.
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  calculateSpatialPosition,
  calculateDopplerEffect,
  exportSpatialTimeline,
  MAX_ITD_MS,
  MAX_ILD_DB,
  SPEED_OF_SOUND,
  type SpatialCue,
} from "./binauralSpatializer";

// ---------------------------------------------------------------------------
// calculateSpatialPosition
// ---------------------------------------------------------------------------

describe("calculateSpatialPosition", () => {
  it("ist bei Azimut 0 frontal zentriert (ITD und ILD ~0)", () => {
    const pos = calculateSpatialPosition(0, 0, 1);
    expect(pos.azimuth).toBe(0);
    expect(pos.elevation).toBe(0);
    expect(pos.distance).toBe(1);
    expect(Math.abs(pos.itdMs)).toBeLessThan(1e-9);
    expect(Math.abs(pos.ildDb)).toBeLessThan(1e-9);
    expect(pos.leftGain).toBeCloseTo(1, 9);
    expect(pos.rightGain).toBeCloseTo(1, 9);
  });

  it("erreicht bei Azimut 90 Grad den maximalen ITD-Wert (~0.63ms)", () => {
    const pos = calculateSpatialPosition(90, 0, 1);
    expect(pos.itdMs).toBeCloseTo(MAX_ITD_MS, 6);
    expect(pos.itdMs).toBeLessThanOrEqual(MAX_ITD_MS + 1e-9);
    // Quelle rechts ⇒ rechtes Ohr führt, rechtes Ohr lauter.
    expect(pos.ildDb).toBeCloseTo(MAX_ILD_DB, 6);
    expect(pos.rightGain).toBeGreaterThan(pos.leftGain);
  });

  it("spiegelt das Vorzeichen bei Azimut -90 Grad", () => {
    const pos = calculateSpatialPosition(-90, 0, 1);
    expect(pos.itdMs).toBeCloseTo(-MAX_ITD_MS, 6);
    expect(pos.ildDb).toBeCloseTo(-MAX_ILD_DB, 6);
    expect(pos.leftGain).toBeGreaterThan(pos.rightGain);
  });

  it("erzeugt bei Distanz 0 KEINE Singularität (endliche Werte)", () => {
    const pos = calculateSpatialPosition(90, 0, 0);
    expect(Number.isFinite(pos.itdMs)).toBe(true);
    expect(Number.isFinite(pos.ildDb)).toBe(true);
    expect(Number.isFinite(pos.leftGain)).toBe(true);
    expect(Number.isFinite(pos.rightGain)).toBe(true);
    expect(pos.distance).toBe(0);
    // Kein NaN, keine Auslöschung: ITD bleibt der physikalische Maximalwert.
    expect(pos.itdMs).toBeCloseTo(MAX_ITD_MS, 6);
  });

  it("fällt bei ungültigen Eingaben (NaN/Infinity) auf Defaults zurück", () => {
    const pos = calculateSpatialPosition(NaN, Infinity, -5);
    expect(Number.isFinite(pos.azimuth)).toBe(true);
    expect(Number.isFinite(pos.elevation)).toBe(true);
    expect(Number.isFinite(pos.distance)).toBe(true);
    expect(Number.isFinite(pos.itdMs)).toBe(true);
    expect(Number.isFinite(pos.ildDb)).toBe(true);
    expect(Number.isFinite(pos.leftGain)).toBe(true);
    expect(Number.isFinite(pos.rightGain)).toBe(true);
    expect(pos.distance).toBeGreaterThanOrEqual(0);
  });

  it("bleibt über alle Azimute hinweg im Wertebereich und ohne Phasen-Auslöschung", () => {
    for (let az = -360; az <= 360; az += 7) {
      const pos = calculateSpatialPosition(az, 0, 1);
      expect(pos.itdMs).toBeGreaterThanOrEqual(-MAX_ITD_MS - 1e-9);
      expect(pos.itdMs).toBeLessThanOrEqual(MAX_ITD_MS + 1e-9);
      expect(pos.ildDb).toBeGreaterThanOrEqual(-MAX_ILD_DB - 1e-9);
      expect(pos.ildDb).toBeLessThanOrEqual(MAX_ILD_DB + 1e-9);
      // Keine der beiden Gains darf exakt 0 werden (keine vollständige Auslöschung).
      expect(pos.leftGain).toBeGreaterThan(0);
      expect(pos.rightGain).toBeGreaterThan(0);
    }
  });

  it("begrenzt Elevation auf den gültigen Bereich [-90, 90]", () => {
    const up = calculateSpatialPosition(0, 200, 1);
    const down = calculateSpatialPosition(0, -200, 1);
    expect(up.elevation).toBe(90);
    expect(down.elevation).toBe(-90);
  });

  it("ist bei rückwärtiger Quelle (Azimut 180) wieder mittig (ITD ~0)", () => {
    const pos = calculateSpatialPosition(180, 0, 1);
    expect(Math.abs(pos.itdMs)).toBeLessThan(1e-9);
    expect(Math.abs(pos.ildDb)).toBeLessThan(1e-9);
  });
});

// ---------------------------------------------------------------------------
// calculateDopplerEffect
// ---------------------------------------------------------------------------

describe("calculateDopplerEffect", () => {
  it("liefert bei ruhender Quelle die unveränderte Frequenz", () => {
    const res = calculateDopplerEffect(0, 440);
    expect(res.observedFrequency).toBeCloseTo(440, 6);
    expect(res.shift).toBeCloseTo(0, 6);
  });

  it("erhöht die Frequenz bei sich nähernder Quelle", () => {
    const res = calculateDopplerEffect(34.3, 440); // 10% der Schallgeschwindigkeit
    expect(res.observedFrequency).toBeGreaterThan(440);
    expect(res.shift).toBeGreaterThan(0);
    expect(res.observedFrequency).toBeCloseTo((440 * SPEED_OF_SOUND) / (SPEED_OF_SOUND - 34.3), 6);
  });

  it("senkt die Frequenz bei sich entfernender Quelle", () => {
    const res = calculateDopplerEffect(-34.3, 440);
    expect(res.observedFrequency).toBeLessThan(440);
    expect(res.shift).toBeLessThan(0);
  });

  it("erzeugt keine Singularität nahe der Schallgeschwindigkeit", () => {
    const res = calculateDopplerEffect(SPEED_OF_SOUND, 440);
    expect(Number.isFinite(res.observedFrequency)).toBe(true);
    expect(res.observedFrequency).toBeGreaterThan(0);
  });

  it("fällt bei ungültiger Frequenz auf einen defensiven Default zurück", () => {
    const res = calculateDopplerEffect(10, 0);
    expect(Number.isFinite(res.observedFrequency)).toBe(true);
    expect(res.observedFrequency).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// exportSpatialTimeline
// ---------------------------------------------------------------------------

describe("exportSpatialTimeline", () => {
  const cues: SpatialCue[] = [
    { id: "c2", azimuth: -90, elevation: 0, distance: 1, startTimeMs: 500, durationMs: 250 },
    { id: "c1", azimuth: 90, elevation: 10, distance: 2, startTimeMs: 0, durationMs: 500 },
  ];

  it("exportiert einen Header und je Cue eine Zeile", () => {
    const out = exportSpatialTimeline(cues);
    const lines = out.trim().split("\n");
    const dataLines = lines.filter((l) => l.startsWith("#") === false);
    expect(dataLines.length).toBe(2);
  });

  it("sortiert die Cues nach Startzeit", () => {
    const out = exportSpatialTimeline(cues);
    const dataLines = out.trim().split("\n").filter((l) => !l.startsWith("#"));
    expect(dataLines[0].startsWith("c1")).toBe(true);
    expect(dataLines[1].startsWith("c2")).toBe(true);
  });

  it("enthält die berechneten räumlichen Werte (ITD/ILD) je Cue", () => {
    const out = exportSpatialTimeline([cues[0]]);
    expect(out).toContain("c2");
    expect(out).toContain("-90");
    expect(out).toContain(String((-MAX_ITD_MS).toFixed(3)));
  });

  it("liefert bei leerer Cue-Liste einen gültigen Export ohne Datenzeilen", () => {
    const out = exportSpatialTimeline([]);
    expect(typeof out).toBe("string");
    expect(out).toContain("#");
    const dataLines = out.trim().split("\n").filter((l) => !l.startsWith("#"));
    expect(dataLines.length).toBe(0);
  });

  it("überspringt defensiv ungültige Cues statt zu werfen", () => {
    // Absichtlich ungültige Cues (NaN, null) für den Defensiv-Test.
    const dirty = [
      { id: "ok", azimuth: 0, elevation: 0, distance: 1, startTimeMs: 0, durationMs: 100 },
      { id: "bad", azimuth: NaN, elevation: 0, distance: 1, startTimeMs: 100, durationMs: 100 },
      null,
    ] as unknown as SpatialCue[];
    expect(() => exportSpatialTimeline(dirty)).not.toThrow();
    const out = exportSpatialTimeline(dirty);
    expect(out).toContain("ok");
  });
});
