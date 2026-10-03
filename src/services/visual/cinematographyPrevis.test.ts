// Cinematography-Previs-Service Tests (WP 38.2).
// Lokal, deterministisch, kein LLM.
import { describe, it, expect } from "vitest";
import {
  assignCameraShots,
  calculateScreenTime,
  estimateBudget,
  type ShotAssignment,
  type ShotType,
} from "./cinematographyPrevis";

describe("assignCameraShots", () => {
  it("liefert eine Zuordnung pro nicht-leerem Absatz", () => {
    const shots = assignCameraShots([
      "Die weite Landschaft liegt still unter dem Himmel.",
      "Ihr Gesicht ist schweißbedeckt.",
      "Eine Luftaufnahme zeigt die Stadt von oben.",
    ]);
    expect(shots).toHaveLength(3);
    expect(shots.map((s) => s.paragraphIndex)).toEqual([0, 1, 2]);
  });

  it("erkennt eine Totale anhand von Landschafts-Signalen", () => {
    const shots = assignCameraShots([
      "Die weite Landschaft liegt still unter dem Himmel.",
    ]);
    expect(shots[0].shot).toBe("wide");
    expect(shots[0].reason.length).toBeGreaterThan(0);
  });

  it("erkennt eine Großaufnahme anhand von Gesichts-Signalen", () => {
    const shots = assignCameraShots([
      "Ihr Gesicht ist schweißbedeckt, eine Träne läuft.",
    ]);
    expect(shots[0].shot).toBe("closeup");
  });

  it("erkennt eine Vogelperspektive/Luftaufnahme", () => {
    const shots = assignCameraShots([
      "Eine Luftaufnahme zeigt die Stadt von oben.",
    ]);
    expect(shots[0].shot).toBe("birdsEye");
    expect(shots[0].reason).toContain("luftaufnahme");
  });

  it("erkennt einen Dutch Angle anhand von Instabilitäts-Signalen", () => {
    const shots = assignCameraShots([
      "Die Kamera kippt, das Bild wird schräg und instabil.",
    ]);
    expect(shots[0].shot).toBe("dutchAngle");
  });

  it("erkennt einen Schuss-Gegenschuss anhand von Schulter-Signal", () => {
    const shots = assignCameraShots([
      "Über seine Schulter hinweg sagt er kein Wort.",
    ]);
    expect(shots[0].shot).toBe("overShoulder");
  });

  it("überspringt leere Absätze, behält aber den Original-Index", () => {
    const shots = assignCameraShots([
      "",
      "Die weite Landschaft liegt still unter dem Himmel.",
      "   ",
    ]);
    expect(shots).toHaveLength(1);
    expect(shots[0].paragraphIndex).toBe(1);
    expect(shots[0].shot).toBe("wide");
  });

  it("nutzt für Absätze ohne Signal eine deterministische Rotation", () => {
    const shots = assignCameraShots([
      "Lorem ipsum dolor sit amet.",
      "Consectetur adipiscing elit.",
      "Sed do eiusmod tempor.",
    ]);
    expect(shots.map((s) => s.shot)).toEqual([
      "wide",
      "overShoulder",
      "closeup",
    ]);
    for (const shot of shots) {
      expect(shot.reason).toMatch(/Standard/i);
    }
  });

  it("ist deterministisch und teilt keinen Referenzzustand", () => {
    const input = [
      "Die weite Landschaft.",
      "Ihr Gesicht ist blass.",
      "Eine Luftaufnahme der Stadt.",
    ];
    const a = assignCameraShots(input);
    const b = assignCameraShots(input);
    expect(a).toEqual(b);
    a[0].shot = "birdsEye";
    expect(assignCameraShots(input)[0].shot).toBe("wide");
  });

  it("übersteht Nicht-String-Einträge ohne Ausnahme", () => {
    const shots = assignCameraShots([
      undefined as unknown as string,
      null as unknown as string,
      42 as unknown as string,
    ]);
    expect(shots).toEqual([]);
  });

  it("übersteht eine Nicht-Array-Eingabe defensiv", () => {
    expect(assignCameraShots(undefined as unknown as string[])).toEqual([]);
    expect(assignCameraShots(null as unknown as string[])).toEqual([]);
  });

  it("liefert für jeden Treffer einen nicht-leeren Begründungstext", () => {
    const shots = assignCameraShots([
      "Ihr Gesicht.",
      "Die Landschaft.",
      "Er sagt nichts.",
    ]);
    for (const shot of shots) {
      expect(typeof shot.reason).toBe("string");
      expect(shot.reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("calculateScreenTime", () => {
  it("rechnet eine Seite als eine Minute", () => {
    const time = calculateScreenTime({ actionLines: 55, dialogueLines: 0 });
    expect(time.pages).toBe(1);
    expect(time.minutes).toBe(1);
    expect(time.scenes).toBe(1);
  });

  it("kombiniert Action- und Dialogzeilen korrekt", () => {
    // 165 Zeilen / 55 = 3 Seiten; 165 / 90 ≈ 2 Szenen.
    const time = calculateScreenTime({ actionLines: 110, dialogueLines: 55 });
    expect(time.pages).toBe(3);
    expect(time.minutes).toBe(3);
    expect(time.scenes).toBe(2);
  });

  it("rundet Seiten/Minuten auf zwei Stellen", () => {
    const time = calculateScreenTime({ actionLines: 1, dialogueLines: 0 });
    expect(time.pages).toBe(0.02);
    expect(time.minutes).toBe(0.02);
  });

  it("garantiert mindestens eine Szene bei vorhandenem Text", () => {
    const time = calculateScreenTime({ actionLines: 1, dialogueLines: 0 });
    expect(time.scenes).toBeGreaterThanOrEqual(1);
  });

  it("liefert Nullwerte bei einem leeren Dokument", () => {
    expect(calculateScreenTime({ actionLines: 0, dialogueLines: 0 })).toEqual({
      minutes: 0,
      pages: 0,
      scenes: 0,
    });
  });

  it("behandelt negative und nicht-finite Werte als Null", () => {
    const time = calculateScreenTime({
      actionLines: -5,
      dialogueLines: Number.NaN,
    });
    expect(time).toEqual({ minutes: 0, pages: 0, scenes: 0 });
  });

  it("übersteht ein fehlendes Dokument ohne Ausnahme", () => {
    const time = calculateScreenTime(
      undefined as unknown as { actionLines: number; dialogueLines: number },
    );
    expect(time).toEqual({ minutes: 0, pages: 0, scenes: 0 });
  });

  it("ist deterministisch", () => {
    const doc = { actionLines: 220, dialogueLines: 110 };
    expect(calculateScreenTime(doc)).toEqual(calculateScreenTime(doc));
  });
});

describe("estimateBudget", () => {
  it("stuft eine leere Shot-Liste als 'low' ein", () => {
    const budget = estimateBudget([]);
    expect(budget.level).toBe("low");
    expect(budget.score).toBe(0);
    expect(budget.factors).toHaveLength(1);
  });

  it("bewertet nur Totalen als niedrigen Aufwand", () => {
    const shots: ShotAssignment[] = [
      { paragraphIndex: 0, shot: "wide", reason: "a" },
      { paragraphIndex: 1, shot: "wide", reason: "b" },
      { paragraphIndex: 2, shot: "wide", reason: "c" },
    ];
    const budget = estimateBudget(shots);
    expect(budget.score).toBe(3);
    expect(budget.level).toBe("low");
  });

  it("stuft gemischte, aufwändigere Shots als 'medium' ein", () => {
    const shots: ShotAssignment[] = [
      { paragraphIndex: 0, shot: "birdsEye", reason: "a" },
      { paragraphIndex: 1, shot: "dutchAngle", reason: "b" },
      { paragraphIndex: 2, shot: "closeup", reason: "c" },
    ];
    const budget = estimateBudget(shots);
    expect(budget.score).toBe(9);
    expect(budget.level).toBe("medium");
  });

  it("stuft viele Spezial-Shots als 'high' ein", () => {
    const shots: ShotAssignment[] = [
      { paragraphIndex: 0, shot: "birdsEye", reason: "a" },
      { paragraphIndex: 1, shot: "birdsEye", reason: "b" },
      { paragraphIndex: 2, shot: "dutchAngle", reason: "c" },
      { paragraphIndex: 3, shot: "dutchAngle", reason: "d" },
      { paragraphIndex: 4, shot: "wide", reason: "e" },
    ];
    const budget = estimateBudget(shots);
    expect(budget.score).toBe(15);
    expect(budget.level).toBe("high");
  });

  it("nennt Luftaufnahmen als Aufwandsfaktor", () => {
    const budget = estimateBudget([
      { paragraphIndex: 0, shot: "birdsEye", reason: "a" },
    ]);
    expect(budget.factors.some((f) => f.includes("Luftaufnahme"))).toBe(true);
  });

  it("meldet eine hohe Einstellungsdichte bei ≥ 20 Einstellungen", () => {
    const shots: ShotAssignment[] = Array.from({ length: 20 }, (_, i) => ({
      paragraphIndex: i,
      shot: "wide" as ShotType,
      reason: "x",
    }));
    const budget = estimateBudget(shots);
    expect(budget.factors.some((f) => f.includes("Einstellungsdichte"))).toBe(
      true,
    );
  });

  it("ignoriert fehlerhafte Einträge ohne Ausnahme", () => {
    const budget = estimateBudget([
      null as unknown as ShotAssignment,
      { paragraphIndex: 0, shot: "wide", reason: "a" },
    ]);
    expect(budget.score).toBe(1);
    expect(budget.level).toBe("low");
  });

  it("übersteht eine Nicht-Array-Eingabe defensiv", () => {
    const budget = estimateBudget(undefined as unknown as ShotAssignment[]);
    expect(budget.level).toBe("low");
    expect(budget.score).toBe(0);
  });

  it("ist deterministisch", () => {
    const shots: ShotAssignment[] = [
      { paragraphIndex: 0, shot: "overShoulder", reason: "a" },
      { paragraphIndex: 1, shot: "closeup", reason: "b" },
      { paragraphIndex: 2, shot: "dutchAngle", reason: "c" },
    ];
    expect(estimateBudget(shots)).toEqual(estimateBudget(shots));
  });
});
