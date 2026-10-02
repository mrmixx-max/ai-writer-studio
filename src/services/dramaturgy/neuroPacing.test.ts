// Tests: Neuro-Pacing & Plutchik-Resonanzkurve (WP 28.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  analyzeEmotionVector,
  detectFatigue,
  generateResonanceCurve,
  PLUTCHIK_AXES,
  PAUSE_THRESHOLD,
  MAX_SUSTAINED_CHAPTERS,
  MONOTONY_THRESHOLD,
} from "./neuroPacing";
import type { ChapterInput, PlutchikVector } from "./neuroPacing";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Ein Kapitel mit Inhalt und 1-basierter Nummer bauen. */
function makeChapter(chapterNumber: number, content: string, id = `ch${chapterNumber}`): ChapterInput {
  return { id, title: `Kapitel ${chapterNumber}`, content, chapterNumber };
}

// Texte mit je 5 distinkten Achsen-Tokens → Amplitude 100 (gesättigt).
const HIGH_JOY = "Freude Glück lachen strahlen jubeln";
const HIGH_ANGER = "Wut Zorn Groll Hass toben";
const HIGH_FEAR = "Angst Furcht Schrecken Panik Grauen";
const HIGH_SADNESS = "Trauer Schmerz Verlust Kummer Tränen";
const HIGH_TRUST = "Vertrauen Treue Loyal Sicherheit Geborgen";
const HIGH_DISGUST = "Ekel Widerlich Abscheu Verachtung Grässlich";

// Text ohne jedes Achsen-Keyword → Amplitude 0 (echte Pause).
const PAUSE_TEXT = "Der Tag verging ruhig.";

// Texte mit 1–4 Freude-Tokens → Amplituden 25/50/75/100 (steigend).
const JOY_1 = "Freude";
const JOY_2 = "Freude Glück";
const JOY_3 = "Freude Glück lachen";

const ZERO_VECTOR: PlutchikVector = {
  fear: 0,
  anger: 0,
  joy: 0,
  sadness: 0,
  trust: 0,
  disgust: 0,
  surprise: 0,
  anticipation: 0,
};

// ---------------------------------------------------------------------------
// 1) analyzeEmotionVector
// ---------------------------------------------------------------------------

describe("analyzeEmotionVector", () => {
  it("liefert einen Null-Vektor für leeren Text", () => {
    expect(analyzeEmotionVector("")).toEqual(ZERO_VECTOR);
    expect(analyzeEmotionVector("   \n\t  ")).toEqual(ZERO_VECTOR);
  });

  it("erkennt Angst-Tokens auf der fear-Achse", () => {
    const vector = analyzeEmotionVector("Die Angst und Furcht ließen ihn zittern.");
    expect(vector.fear).toBe(75); // 3 distinkte Tokens × 25
    expect(vector.joy).toBe(0);
    expect(vector.anger).toBe(0);
  });

  it("sättigt eine Achse bei 100 Punkten", () => {
    const vector = analyzeEmotionVector("Angst Furcht Schrecken Panik Grauen Entsetzen");
    expect(vector.fear).toBe(100); // 6 Tokens, saturiert
  });

  it("erkennt Freude-Tokens auf der joy-Achse", () => {
    const vector = analyzeEmotionVector("Freude und Glück ließen alle lachen und strahlen.");
    expect(vector.joy).toBe(100); // 4 distinkte Tokens
    expect(vector.sadness).toBe(0);
  });

  it("bewertet gemischte Achsen getrennt", () => {
    const vector = analyzeEmotionVector("Der Zorn und die Angst rangen miteinander.");
    expect(vector.anger).toBe(25);
    expect(vector.fear).toBe(25);
    expect(vector.joy).toBe(0);
  });

  it("wertet case-insensitiv aus", () => {
    expect(analyzeEmotionVector("ANGST Panik").fear).toBe(50);
  });

  it("wirft nicht bei nicht-string-Eingaben und liefert einen Null-Vektor", () => {
    expect(() => analyzeEmotionVector(undefined as unknown as string)).not.toThrow();
    expect(analyzeEmotionVector(null as unknown as string)).toEqual(ZERO_VECTOR);
    expect(analyzeEmotionVector(42 as unknown as string)).toEqual(ZERO_VECTOR);
  });
});

// ---------------------------------------------------------------------------
// 2) detectFatigue
// ---------------------------------------------------------------------------

describe("detectFatigue", () => {
  it("liefert ein leeres Array bei fehlenden Kapiteln", () => {
    expect(detectFatigue([])).toEqual([]);
  });

  it("meldet keinen Pausenmangel, wenn Pausen regelmäßig gesetzt sind", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_JOY),
      makeChapter(3, PAUSE_TEXT),
      makeChapter(4, HIGH_JOY),
      makeChapter(5, HIGH_JOY),
      makeChapter(6, PAUSE_TEXT),
    ];
    expect(detectFatigue(chapters)).toEqual([]);
  });

  it("warnt bei mehr als der Schwelle aufeinanderfolgender Kapitel ohne Pause", () => {
    // Vier aufgeladene Kapitel, aber unterschiedliche Dominanzachsen
    // → isoliert die Pausen-Warnung (keine Monotonie-Warnung).
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_ANGER),
      makeChapter(3, HIGH_FEAR),
      makeChapter(4, HIGH_SADNESS),
    ];
    const warnings = detectFatigue(chapters);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].chapterNumber).toBe(1);
    expect(warnings[0].severity).toBe("low");
    expect(warnings[0].message).toContain("Pausenmangel");
    expect(warnings[0].message).toContain("4");
  });

  it("stuft einen Lauf der Länge 5 als medium ein", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_ANGER),
      makeChapter(3, HIGH_FEAR),
      makeChapter(4, HIGH_SADNESS),
      makeChapter(5, HIGH_TRUST),
    ];
    const warnings = detectFatigue(chapters);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("medium");
  });

  it("stuft einen Lauf der Länge 6 als high ein", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_ANGER),
      makeChapter(3, HIGH_FEAR),
      makeChapter(4, HIGH_SADNESS),
      makeChapter(5, HIGH_TRUST),
      makeChapter(6, HIGH_DISGUST),
    ];
    const warnings = detectFatigue(chapters);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("high");
  });

  it("warnt bei emotionaler Monotonie", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_JOY),
      makeChapter(3, HIGH_JOY),
      makeChapter(4, HIGH_JOY),
    ];
    const monotony = detectFatigue(chapters).filter((w) => w.message.includes("Monotonie"));
    expect(monotony).toHaveLength(1);
    expect(monotony[0].chapterNumber).toBe(1);
    expect(monotony[0].severity).toBe("low");
  });

  it("meldet Monotonie NICHT unterhalb der Schwelle", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_JOY),
      makeChapter(3, HIGH_JOY),
    ];
    expect(detectFatigue(chapters)).toEqual([]);
  });

  it("unterbricht einen Monotonie-Lauf durch Achsenwechsel", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(2, HIGH_JOY),
      makeChapter(3, HIGH_ANGER),
      makeChapter(4, HIGH_JOY),
      makeChapter(5, HIGH_JOY),
    ];
    const monotony = detectFatigue(chapters).filter((w) => w.message.includes("Monotonie"));
    expect(monotony).toEqual([]);
  });

  it("ignoriert Kapitel mit ungültiger chapterNumber defensiv", () => {
    const chapters = [
      makeChapter(1, HIGH_JOY),
      makeChapter(0, HIGH_JOY, "invalid-zero"),
      makeChapter(Number.NaN, HIGH_JOY, "invalid-nan"),
    ];
    expect(detectFatigue(chapters)).toEqual([]);
  });

  it("wirft nicht bei null/undefined-Eingaben", () => {
    expect(() => detectFatigue(undefined as unknown as ChapterInput[])).not.toThrow();
    expect(detectFatigue(null as unknown as ChapterInput[])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3) generateResonanceCurve
// ---------------------------------------------------------------------------

describe("generateResonanceCurve", () => {
  it("liefert eine leere Kurve bei fehlenden Kapiteln", () => {
    expect(generateResonanceCurve([])).toEqual({ points: [], peaks: [], valleys: [] });
  });

  it("erzeugt einen Punkt pro Kapitel in aufsteigender Kapitelreihenfolge", () => {
    const chapters = [
      makeChapter(3, JOY_3), // 75
      makeChapter(1, PAUSE_TEXT), // 0
      makeChapter(2, HIGH_JOY), // 100
    ];
    const curve = generateResonanceCurve(chapters);
    expect(curve.points).toEqual([0, 100, 75]);
  });

  it("erkennt Hoch- und Tiefpunkte", () => {
    const chapters = [
      makeChapter(1, PAUSE_TEXT), // 0
      makeChapter(2, HIGH_JOY), // 100
      makeChapter(3, PAUSE_TEXT), // 0
      makeChapter(4, HIGH_JOY), // 100
      makeChapter(5, PAUSE_TEXT), // 0
    ];
    const curve = generateResonanceCurve(chapters);
    expect(curve.points).toEqual([0, 100, 0, 100, 0]);
    expect(curve.peaks).toEqual([1, 3]);
    expect(curve.valleys).toEqual([2]);
  });

  it("behandelt Plateaus: nur der erste Index eines Plateaus zählt", () => {
    const chapters = [
      makeChapter(1, PAUSE_TEXT), // 0
      makeChapter(2, HIGH_JOY), // 100
      makeChapter(3, HIGH_JOY), // 100
      makeChapter(4, PAUSE_TEXT), // 0
    ];
    const curve = generateResonanceCurve(chapters);
    expect(curve.points).toEqual([0, 100, 100, 0]);
    expect(curve.peaks).toEqual([1]);
    expect(curve.valleys).toEqual([]);
  });

  it("liefert keine Extrema bei weniger als drei Kapiteln", () => {
    const curve = generateResonanceCurve([makeChapter(1, PAUSE_TEXT), makeChapter(2, HIGH_JOY)]);
    expect(curve.points).toEqual([0, 100]);
    expect(curve.peaks).toEqual([]);
    expect(curve.valleys).toEqual([]);
  });

  it("erkennt keine Extrema bei monoton steigender Kurve", () => {
    const chapters = [
      makeChapter(1, PAUSE_TEXT), // 0
      makeChapter(2, JOY_1), // 25
      makeChapter(3, JOY_2), // 50
      makeChapter(4, JOY_3), // 75
      makeChapter(5, HIGH_JOY), // 100
    ];
    const curve = generateResonanceCurve(chapters);
    expect(curve.points).toEqual([0, 25, 50, 75, 100]);
    expect(curve.peaks).toEqual([]);
    expect(curve.valleys).toEqual([]);
  });

  it("wirft nicht bei null/undefined-Eingaben", () => {
    expect(() => generateResonanceCurve(undefined as unknown as ChapterInput[])).not.toThrow();
    expect(generateResonanceCurve(null as unknown as ChapterInput[])).toEqual({
      points: [],
      peaks: [],
      valleys: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Konstanten / Vertrag
// ---------------------------------------------------------------------------

describe("Vertrag", () => {
  it("führt genau die acht Plutchik-Achsen", () => {
    expect(PLUTCHIK_AXES).toEqual([
      "fear",
      "anger",
      "joy",
      "sadness",
      "trust",
      "disgust",
      "surprise",
      "anticipation",
    ]);
  });

  it("liefert einen Vektor mit allen acht Achsen", () => {
    const vector = analyzeEmotionVector("Freude");
    expect(Object.keys(vector).sort()).toEqual([...PLUTCHIK_AXES].sort());
  });

  it("setzt die Schwellen deterministisch", () => {
    expect(PAUSE_THRESHOLD).toBe(25);
    expect(MAX_SUSTAINED_CHAPTERS).toBe(3);
    expect(MONOTONY_THRESHOLD).toBe(4);
  });
});
