// @vitest-environment jsdom
/** Tests: PoliceMugshotDossier (WP 128.2, Meilenstein 62.0, v7.4.0) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  FINGERPRINT_PATTERNS,
  buildMugshotPlate,
  buildFingerprintCard,
  buildSignalement,
  createSampleMugshotPlate,
  createSampleFingerprintCard,
} from "./policeMugshotDossier";

// ---------------------------------------------------------------------------
// Hilfsdaten
// ---------------------------------------------------------------------------

const baseInput = {
  prisonerNumber: "X-00427",
  name: "Maximilian Graf",
  precinct: "1. Bezirk",
  date: "14.10.2026",
  unitSystem: "metric" as const,
};

const EXPECTED_FINGERS = [
  "Daumen links",
  "Daumen rechts",
  "Zeigefinger links",
  "Zeigefinger rechts",
  "Mittelfinger links",
  "Mittelfinger rechts",
  "Ringfinger links",
  "Ringfinger rechts",
  "kleiner Finger links",
  "kleiner Finger rechts",
];

const KNOWN_EYE_COLORS = [
  "braun",
  "blau",
  "grau",
  "grün",
  "haselnussfarben",
  "grau-blau",
];

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}/;

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch für gleichen Input", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("Maximilian Graf")).toBe(hashString("Maximilian Graf"));
  });

  it("erzeugt unterschiedliche Hashes für unterschiedliche Inputs", () => {
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("loop")).not.toBe(hashString("whorl"));
  });

  it("liefert 32-bit unsigned integer", () => {
    const h = hashString("polizei");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("behandelt leeren String", () => {
    expect(Number.isInteger(hashString(""))).toBe(true);
  });

  it("liefert einen number-Wert", () => {
    expect(typeof hashString("aktenzeichen")).toBe("number");
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("a")).not.toBe(hashString("A"));
  });

  it("bleibt stabil über wiederholte Aufrufe", () => {
    const first = hashString("signalement:42");
    for (let i = 0; i < 20; i++) {
      expect(hashString("signalement:42")).toBe(first);
    }
  });

  it("verarbeitet Umlaute und Sonderzeichen deterministisch", () => {
    const a = hashString("Jürgen Öztürk-Çelik ß");
    const b = hashString("Jürgen Öztürk-Çelik ß");
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
  });

  it("verarbeitet sehr lange Strings", () => {
    const long = "x".repeat(10000);
    const h = hashString(long);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("liefert Werte im Bereich [0, 1) über 500 Ziehungen", () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("unterscheidet sich für verschiedene Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    const v1 = r1();
    const v2 = r2();
    expect(v1).not.toBe(v2);
  });

  it("liefert ausschließlich number-Werte", () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(typeof rng()).toBe("number");
    }
  });

  it("hält 1000 Ziehungen im gültigen Bereich", () => {
    const rng = createSeededRandom(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("reproduziert dieselbe Sequenz nach erneuter Erzeugung", () => {
    const seq1: number[] = [];
    const seq2: number[] = [];
    const a = createSeededRandom(2026);
    for (let i = 0; i < 25; i++) seq1.push(a());
    const b = createSeededRandom(2026);
    for (let i = 0; i < 25; i++) seq2.push(b());
    expect(seq1).toEqual(seq2);
  });

  it("funktioniert mit Seed 0", () => {
    const rng = createSeededRandom(0);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("normalisiert negative Seeds ohne Absturz", () => {
    const rng = createSeededRandom(-1);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("erzeugt für denselben Seed identische Werte trotz Zwischenaufrufen", () => {
    const a = createSeededRandom(31415);
    const first = a();
    a();
    a();
    const b = createSeededRandom(31415);
    expect(b()).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// FINGERPRINT_PATTERNS
// ---------------------------------------------------------------------------

describe("FINGERPRINT_PATTERNS", () => {
  it("enthält genau 3 Einträge", () => {
    expect(FINGERPRINT_PATTERNS).toHaveLength(3);
  });

  it("hat die IDs loop, whorl und arch", () => {
    const ids = FINGERPRINT_PATTERNS.map((p) => p.id);
    expect(ids).toContain("loop");
    expect(ids).toContain("whorl");
    expect(ids).toContain("arch");
  });

  it("jeder Eintrag hat id, name und description", () => {
    for (const p of FINGERPRINT_PATTERNS) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.description).toBe("string");
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("die IDs sind genau die Menge {loop, whorl, arch}", () => {
    const ids = FINGERPRINT_PATTERNS.map((p) => p.id).sort();
    expect(ids).toEqual(["arch", "loop", "whorl"]);
  });

  it("hat keine doppelten IDs", () => {
    const ids = FINGERPRINT_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("benennt die Schleife korrekt", () => {
    const loop = FINGERPRINT_PATTERNS.find((p) => p.id === "loop");
    expect(loop?.name).toBe("Schleife");
  });

  it("benennt den Wirbel korrekt", () => {
    const whorl = FINGERPRINT_PATTERNS.find((p) => p.id === "whorl");
    expect(whorl?.name).toBe("Wirbel");
  });

  it("benennt den Bogen korrekt", () => {
    const arch = FINGERPRINT_PATTERNS.find((p) => p.id === "arch");
    expect(arch?.name).toBe("Bogen");
  });

  it("jede description ist ausführlich (mehr als 20 Zeichen)", () => {
    for (const p of FINGERPRINT_PATTERNS) {
      expect(p.description.length).toBeGreaterThan(20);
    }
  });

  it("jeder name ist nicht leer und getrimmt", () => {
    for (const p of FINGERPRINT_PATTERNS) {
      expect(p.name).toBe(p.name.trim());
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("die Namen sind alle verschieden", () => {
    const names = FINGERPRINT_PATTERNS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("die IDs sind kleingeschrieben", () => {
    for (const p of FINGERPRINT_PATTERNS) {
      expect(p.id).toBe(p.id.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// buildMugshotPlate
// ---------------------------------------------------------------------------

describe("buildMugshotPlate", () => {
  it("gibt plateText, heightMarks, unitSystem und svg zurück", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(typeof result.plateText).toBe("string");
    expect(result.plateText.length).toBeGreaterThan(0);
    expect(Array.isArray(result.heightMarks)).toBe(true);
    expect(result.heightMarks.length).toBeGreaterThan(0);
    expect(result.unitSystem).toBe("metric");
    expect(typeof result.svg).toBe("string");
  });

  it("svg enthält '<svg'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("<svg");
  });

  it("metrische Höhenmarken unterscheiden sich von imperialen", () => {
    const metric = buildMugshotPlate(baseInput, 42);
    const imperial = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(metric.unitSystem).toBe("metric");
    expect(imperial.unitSystem).toBe("imperial");
    expect(metric.heightMarks).not.toEqual(imperial.heightMarks);
  });

  it("metrische Marken enthalten 'cm'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    for (const mark of result.heightMarks) {
      expect(mark).toContain("cm");
    }
  });

  it("imperiale Marken enthalten Fuß/Zoll-Notation", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    for (const mark of result.heightMarks) {
      expect(mark).toMatch(/'\d+"/);
    }
  });

  it("plateText enthält Gefangenen-Nummer und Namen", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("X-00427");
    expect(result.plateText).toContain("Maximilian Graf");
  });

  it("metrische heightMarks sind nicht leer", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.heightMarks.length).toBeGreaterThan(0);
  });

  it("imperiale heightMarks sind nicht leer", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(result.heightMarks.length).toBeGreaterThan(0);
  });

  it("jede metrische Höhenmarke ist ein nicht-leerer String", () => {
    const result = buildMugshotPlate(baseInput, 42);
    for (const mark of result.heightMarks) {
      expect(typeof mark).toBe("string");
      expect(mark.length).toBeGreaterThan(0);
    }
  });

  it("jede imperiale Höhenmarke ist ein nicht-leerer String", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    for (const mark of result.heightMarks) {
      expect(typeof mark).toBe("string");
      expect(mark.length).toBeGreaterThan(0);
    }
  });

  it("metrische Marken umfassen 13 Einträge (140–200 cm in 5er-Schritten)", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.heightMarks).toHaveLength(13);
    expect(result.heightMarks[0]).toBe("140 cm");
    expect(result.heightMarks[12]).toBe("200 cm");
  });

  it("imperiale Marken umfassen 18 Einträge (4–6 ft, 6 je Fuß)", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(result.heightMarks).toHaveLength(18);
  });

  it("metrische Marken haben keine Duplikate", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(new Set(result.heightMarks).size).toBe(result.heightMarks.length);
  });

  it("imperiale Marken haben keine Duplikate", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(new Set(result.heightMarks).size).toBe(result.heightMarks.length);
  });

  it("svg beginnt mit '<svg'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg.startsWith("<svg")).toBe(true);
  });

  it("svg endet mit '</svg>'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg.endsWith("</svg>")).toBe(true);
  });

  it("svg enthält die Gefangenen-Nummer", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("X-00427");
  });

  it("svg enthält den Namen", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("Maximilian Graf");
  });

  it("svg enthält das Aufnahmedatum", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("14.10.2026");
  });

  it("svg enthält das Revier als Rohwert", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("1. Bezirk");
  });

  it("plateText enthält den aufgelösten Revier-Namen", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("Revier Mitte");
  });

  it("plateText enthält den POLIZEI-Header", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("POLIZEI");
  });

  it("plateText enthält 'Gefangenen-Nr.'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("Gefangenen-Nr.");
  });

  it("plateText enthält das Aufnahmedatum", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("14.10.2026");
  });

  it("plateText enthält die Maßeinheit-Zeile", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("Maßeinheit:");
  });

  it("metrischer plateText nennt 'Zentimeter'", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.plateText).toContain("Zentimeter");
  });

  it("imperialer plateText nennt 'Fuß/Zoll'", () => {
    const result = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(result.plateText).toContain("Fuß/Zoll");
  });

  it("löst '2. Bezirk' zu 'Revier Nord' auf", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "2. Bezirk" },
      42
    );
    expect(result.plateText).toContain("Revier Nord");
  });

  it("löst '3. Bezirk' zu 'Revier Süd' auf", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "3. Bezirk" },
      42
    );
    expect(result.plateText).toContain("Revier Süd");
  });

  it("löst '4. Bezirk' zu 'Revier Ost' auf", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "4. Bezirk" },
      42
    );
    expect(result.plateText).toContain("Revier Ost");
  });

  it("löst '5. Bezirk' zu 'Revier West' auf", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "5. Bezirk" },
      42
    );
    expect(result.plateText).toContain("Revier West");
  });

  it("reicht unbekanntes Revier unverändert durch", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "Sonderdezernat 9" },
      42
    );
    expect(result.plateText).toContain("Sonderdezernat 9");
  });

  it("erzeugt einen gültigen svg auch bei leerem Namen", () => {
    const result = buildMugshotPlate({ ...baseInput, name: "" }, 42);
    expect(result.svg.startsWith("<svg")).toBe(true);
    expect(result.svg.endsWith("</svg>")).toBe(true);
    expect(result.plateText).toContain("Name:");
  });

  it("erzeugt einen gültigen svg auch bei leerem Revier", () => {
    const result = buildMugshotPlate({ ...baseInput, precinct: "" }, 42);
    expect(result.svg.startsWith("<svg")).toBe(true);
    expect(result.svg.endsWith("</svg>")).toBe(true);
    expect(typeof result.plateText).toBe("string");
  });

  it("verarbeitet sehr lange Namen", () => {
    const longName = "A".repeat(500);
    const result = buildMugshotPlate({ ...baseInput, name: longName }, 42);
    expect(result.svg).toContain(longName);
    expect(result.svg.endsWith("</svg>")).toBe(true);
    expect(result.plateText).toContain(longName);
  });

  it("verarbeitet Umlaute im Namen", () => {
    const result = buildMugshotPlate(
      { ...baseInput, name: "Jürgen Öztürk-Çelik" },
      42
    );
    expect(result.plateText).toContain("Jürgen Öztürk-Çelik");
    expect(result.svg).toContain("Jürgen Öztürk-Çelik");
  });

  it("verarbeitet Umlaute im Revier", () => {
    const result = buildMugshotPlate(
      { ...baseInput, precinct: "Revier Süd-Ost" },
      42
    );
    expect(result.plateText).toContain("Revier Süd-Ost");
  });

  it("ist deterministisch für gleichen Input", () => {
    const r1 = buildMugshotPlate(baseInput, 1);
    const r2 = buildMugshotPlate(baseInput, 1);
    expect(r1.plateText).toBe(r2.plateText);
    expect(r1.heightMarks).toEqual(r2.heightMarks);
    expect(r1.svg).toBe(r2.svg);
  });

  it("ist unabhängig vom Seed (Seed wird ignoriert)", () => {
    const r1 = buildMugshotPlate(baseInput, 1);
    const r2 = buildMugshotPlate(baseInput, 999999);
    expect(r1.svg).toBe(r2.svg);
    expect(r1.heightMarks).toEqual(r2.heightMarks);
  });

  it("metrischer und imperialer plateText unterscheiden sich", () => {
    const metric = buildMugshotPlate(baseInput, 42);
    const imperial = buildMugshotPlate(
      { ...baseInput, unitSystem: "imperial" },
      42
    );
    expect(metric.plateText).not.toBe(imperial.plateText);
  });

  it("svg enthält keine Hex-Farben", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(HEX_COLOR_RE.test(result.svg)).toBe(false);
  });

  it("svg enthält kein 'rgba('", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).not.toContain("rgba(");
  });

  it("svg enthält einen viewBox", () => {
    const result = buildMugshotPlate(baseInput, 42);
    expect(result.svg).toContain("viewBox=");
  });

  it("unitSystem spiegelt den gewählten Input", () => {
    expect(buildMugshotPlate(baseInput, 1).unitSystem).toBe("metric");
    expect(
      buildMugshotPlate({ ...baseInput, unitSystem: "imperial" }, 1).unitSystem
    ).toBe("imperial");
  });
});

// ---------------------------------------------------------------------------
// buildFingerprintCard
// ---------------------------------------------------------------------------

describe("buildFingerprintCard", () => {
  it("gibt 10 Fingerabdrücke zurück", () => {
    const result = buildFingerprintCard(42);
    expect(result.prints).toHaveLength(10);
  });

  it("jeder Abdruck hat finger, patternId, patternName und ridges", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(typeof print.finger).toBe("string");
      expect(print.finger.length).toBeGreaterThan(0);
      expect(typeof print.patternId).toBe("string");
      expect(["loop", "whorl", "arch"]).toContain(print.patternId);
      expect(typeof print.patternName).toBe("string");
      expect(print.patternName.length).toBeGreaterThan(0);
      expect(typeof print.ridges).toBe("number");
      expect(Number.isInteger(print.ridges)).toBe(true);
      expect(print.ridges).toBeGreaterThanOrEqual(12);
      expect(print.ridges).toBeLessThan(40);
    }
  });

  it("svg ist gültig und enthält '<svg'", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
  });

  it("ist deterministisch für gleichen Seed", () => {
    const r1 = buildFingerprintCard(99);
    const r2 = buildFingerprintCard(99);
    expect(r1.prints).toEqual(r2.prints);
    expect(r1.svg).toBe(r2.svg);
  });

  it("genau 10 Abdrücke", () => {
    expect(buildFingerprintCard(1).prints).toHaveLength(10);
  });

  it("alle 10 Finger-Namen sind verschieden", () => {
    const result = buildFingerprintCard(42);
    const names = result.prints.map((p) => p.finger);
    expect(new Set(names).size).toBe(10);
  });

  it("Finger-Namen entsprechen der erwarteten Liste", () => {
    const result = buildFingerprintCard(42);
    const names = result.prints.map((p) => p.finger);
    expect(names).toEqual(EXPECTED_FINGERS);
  });

  it("jeder finger ist ein nicht-leerer String", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(typeof print.finger).toBe("string");
      expect(print.finger.length).toBeGreaterThan(0);
    }
  });

  it("jeder patternId gehört zur erlaubten Menge", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(["loop", "whorl", "arch"]).toContain(print.patternId);
    }
  });

  it("jeder patternName passt zur patternId in FINGERPRINT_PATTERNS", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      const pattern = FINGERPRINT_PATTERNS.find((p) => p.id === print.patternId);
      expect(pattern).toBeDefined();
      expect(print.patternName).toBe(pattern?.name);
    }
  });

  it("jeder ridges-Wert ist eine positive ganze Zahl", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(Number.isInteger(print.ridges)).toBe(true);
      expect(print.ridges).toBeGreaterThan(0);
    }
  });

  it("ridges liegt im Bereich 12 bis 39", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(print.ridges).toBeGreaterThanOrEqual(12);
      expect(print.ridges).toBeLessThanOrEqual(39);
    }
  });

  it("svg beginnt mit '<svg'", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg.startsWith("<svg")).toBe(true);
  });

  it("svg endet mit '</svg>'", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg.endsWith("</svg>")).toBe(true);
  });

  it("svg enthält alle Finger-Namen", () => {
    const result = buildFingerprintCard(42);
    for (const finger of EXPECTED_FINGERS) {
      expect(result.svg).toContain(finger);
    }
  });

  it("svg enthält die Linien-Beschriftung", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg).toContain("Linien:");
  });

  it("svg enthält genau 10 Rechtecke für die Karten", () => {
    const result = buildFingerprintCard(42);
    const rectCount = (result.svg.match(/<rect /g) ?? []).length;
    // 10 Karten + 1 Hintergrund
    expect(rectCount).toBe(11);
  });

  it("svg enthält keine Hex-Farben", () => {
    const result = buildFingerprintCard(42);
    expect(HEX_COLOR_RE.test(result.svg)).toBe(false);
  });

  it("svg enthält kein 'rgba('", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg).not.toContain("rgba(");
  });

  it("svg enthält einen viewBox", () => {
    const result = buildFingerprintCard(42);
    expect(result.svg).toContain("viewBox=");
  });

  it("prints ist ein Array", () => {
    expect(Array.isArray(buildFingerprintCard(42).prints)).toBe(true);
  });

  it("ist für Seeds 1..10 strukturell gültig", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = buildFingerprintCard(seed);
      expect(result.prints).toHaveLength(10);
      for (const print of result.prints) {
        expect(["loop", "whorl", "arch"]).toContain(print.patternId);
        expect(print.ridges).toBeGreaterThan(0);
      }
      expect(result.svg.startsWith("<svg")).toBe(true);
      expect(result.svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("patternId für Seeds 1..10 immer in der erlaubten Menge", () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const print of buildFingerprintCard(seed).prints) {
        expect(["loop", "whorl", "arch"]).toContain(print.patternId);
      }
    }
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Prints", () => {
    const a = buildFingerprintCard(1);
    const b = buildFingerprintCard(2);
    expect(a.prints).not.toEqual(b.prints);
  });

  it("jeder Print hat genau die vier Felder", () => {
    const result = buildFingerprintCard(42);
    for (const print of result.prints) {
      expect(Object.keys(print).sort()).toEqual(
        ["finger", "patternId", "patternName", "ridges"].sort()
      );
    }
  });
});

// ---------------------------------------------------------------------------
// buildSignalement
// ---------------------------------------------------------------------------

describe("buildSignalement", () => {
  it("gibt scars, tattoos, aliases, eyeColor, height, priorConvictions und description zurück", () => {
    const result = buildSignalement(42);
    expect(Array.isArray(result.scars)).toBe(true);
    expect(result.scars.length).toBeGreaterThan(0);
    expect(Array.isArray(result.tattoos)).toBe(true);
    expect(result.tattoos.length).toBeGreaterThan(0);
    expect(Array.isArray(result.aliases)).toBe(true);
    expect(result.aliases.length).toBeGreaterThan(0);
    expect(typeof result.eyeColor).toBe("string");
    expect(result.eyeColor.length).toBeGreaterThan(0);
    expect(typeof result.height).toBe("string");
    expect(result.height).toContain("cm");
    expect(Array.isArray(result.priorConvictions)).toBe(true);
    expect(result.priorConvictions.length).toBeGreaterThan(0);
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("description enthält SIGNALMENT-Header", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain("SIGNALMENT");
  });

  it("ist deterministisch für gleichen Seed", () => {
    const r1 = buildSignalement(77);
    const r2 = buildSignalement(77);
    expect(r1.scars).toEqual(r2.scars);
    expect(r1.tattoos).toEqual(r2.tattoos);
    expect(r1.aliases).toEqual(r2.aliases);
    expect(r1.eyeColor).toBe(r2.eyeColor);
    expect(r1.height).toBe(r2.height);
    expect(r1.priorConvictions).toEqual(r2.priorConvictions);
    expect(r1.description).toBe(r2.description);
  });

  it("scars ist ein Array aus nicht-leeren Strings", () => {
    const result = buildSignalement(42);
    expect(Array.isArray(result.scars)).toBe(true);
    for (const s of result.scars) {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it("tattoos ist ein Array aus nicht-leeren Strings", () => {
    const result = buildSignalement(42);
    expect(Array.isArray(result.tattoos)).toBe(true);
    for (const t of result.tattoos) {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it("aliases ist ein Array aus nicht-leeren Strings", () => {
    const result = buildSignalement(42);
    expect(Array.isArray(result.aliases)).toBe(true);
    for (const a of result.aliases) {
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(0);
    }
  });

  it("priorConvictions ist ein Array aus nicht-leeren Strings", () => {
    const result = buildSignalement(42);
    expect(Array.isArray(result.priorConvictions)).toBe(true);
    for (const c of result.priorConvictions) {
      expect(typeof c).toBe("string");
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it("eyeColor ist ein String aus der bekannten Farbmenge", () => {
    const result = buildSignalement(42);
    expect(typeof result.eyeColor).toBe("string");
    expect(KNOWN_EYE_COLORS).toContain(result.eyeColor);
  });

  it("height ist ein String mit cm-Angabe", () => {
    const result = buildSignalement(42);
    expect(typeof result.height).toBe("string");
    expect(result.height).toMatch(/\d+ cm$/);
  });

  it("height liegt im Bereich 155 bis 194 cm", () => {
    const result = buildSignalement(42);
    const value = Number(result.height.replace(" cm", ""));
    expect(value).toBeGreaterThanOrEqual(155);
    expect(value).toBeLessThanOrEqual(194);
  });

  it("description ist ein String", () => {
    const result = buildSignalement(42);
    expect(typeof result.description).toBe("string");
  });

  it("scars umfasst 1 bis 2 Einträge", () => {
    const result = buildSignalement(42);
    expect(result.scars.length).toBeGreaterThanOrEqual(1);
    expect(result.scars.length).toBeLessThanOrEqual(2);
  });

  it("tattoos umfasst 1 bis 2 Einträge", () => {
    const result = buildSignalement(42);
    expect(result.tattoos.length).toBeGreaterThanOrEqual(1);
    expect(result.tattoos.length).toBeLessThanOrEqual(2);
  });

  it("aliases umfasst 1 bis 3 Einträge", () => {
    const result = buildSignalement(42);
    expect(result.aliases.length).toBeGreaterThanOrEqual(1);
    expect(result.aliases.length).toBeLessThanOrEqual(3);
  });

  it("priorConvictions umfasst 1 bis 4 Einträge", () => {
    const result = buildSignalement(42);
    expect(result.priorConvictions.length).toBeGreaterThanOrEqual(1);
    expect(result.priorConvictions.length).toBeLessThanOrEqual(4);
  });

  it("scars enthält keine Duplikate", () => {
    const result = buildSignalement(42);
    expect(new Set(result.scars).size).toBe(result.scars.length);
  });

  it("tattoos enthält keine Duplikate", () => {
    const result = buildSignalement(42);
    expect(new Set(result.tattoos).size).toBe(result.tattoos.length);
  });

  it("aliases enthält keine Duplikate", () => {
    const result = buildSignalement(42);
    expect(new Set(result.aliases).size).toBe(result.aliases.length);
  });

  it("priorConvictions enthält keine Duplikate", () => {
    const result = buildSignalement(42);
    expect(new Set(result.priorConvictions).size).toBe(
      result.priorConvictions.length
    );
  });

  it("description enthält die Augenfarbe", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain(result.eyeColor);
  });

  it("description enthält die Körpergröße", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain(result.height);
  });

  it("description enthält den NARBEN-Block", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain("NARBEN:");
  });

  it("description enthält den TÄTOWIERUNGEN-Block", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain("TÄTOWIERUNGEN:");
  });

  it("description enthält den DECKNAMEN-Block", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain("DECKNAMEN:");
  });

  it("description enthält den VORSTRAFEN-Block", () => {
    const result = buildSignalement(42);
    expect(result.description).toContain("VORSTRAFEN:");
  });

  it("description enthält jede Narbe", () => {
    const result = buildSignalement(42);
    for (const s of result.scars) {
      expect(result.description).toContain(s);
    }
  });

  it("description enthält jede Tätowierung", () => {
    const result = buildSignalement(42);
    for (const t of result.tattoos) {
      expect(result.description).toContain(t);
    }
  });

  it("description enthält jeden Decknamen", () => {
    const result = buildSignalement(42);
    for (const a of result.aliases) {
      expect(result.description).toContain(a);
    }
  });

  it("description enthält jede Vorstrafe", () => {
    const result = buildSignalement(42);
    for (const c of result.priorConvictions) {
      expect(result.description).toContain(c);
    }
  });

  it("description ist mehrzeilig", () => {
    const result = buildSignalement(42);
    expect(result.description.split("\n").length).toBeGreaterThan(5);
  });

  it("aliases sind in deutsche Anführungszeichen gesetzt", () => {
    const result = buildSignalement(42);
    for (const a of result.aliases) {
      expect(a.startsWith("„")).toBe(true);
      expect(a.endsWith("“")).toBe(true);
    }
  });

  it("Seeds 1..10 liefern jeweils valides Signalement", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = buildSignalement(seed);
      expect(Array.isArray(result.scars)).toBe(true);
      expect(Array.isArray(result.tattoos)).toBe(true);
      expect(Array.isArray(result.aliases)).toBe(true);
      expect(Array.isArray(result.priorConvictions)).toBe(true);
      expect(result.scars.length).toBeGreaterThan(0);
      expect(result.tattoos.length).toBeGreaterThan(0);
      expect(result.aliases.length).toBeGreaterThan(0);
      expect(result.priorConvictions.length).toBeGreaterThan(0);
      expect(typeof result.eyeColor).toBe("string");
      expect(KNOWN_EYE_COLORS).toContain(result.eyeColor);
      expect(result.height).toMatch(/\d+ cm$/);
      expect(typeof result.description).toBe("string");
      expect(result.description).toContain("SIGNALMENT");
    }
  });

  it("Seeds 1..10 sind jeweils reproduzierbar", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(buildSignalement(seed)).toEqual(buildSignalement(seed));
    }
  });

  it("unterschiedliche Seeds erzeugen (in der Regel) unterschiedliche Ergebnisse", () => {
    const results: string[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      results.push(JSON.stringify(buildSignalement(seed)));
    }
    // Mindestens zwei der zehn Ergebnisse müssen sich unterscheiden.
    expect(new Set(results).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// createSampleMugshotPlate
// ---------------------------------------------------------------------------

describe("createSampleMugshotPlate", () => {
  it("gibt ein gültiges Mugshot-Plate zurück", () => {
    const result = createSampleMugshotPlate();
    expect(typeof result.plateText).toBe("string");
    expect(result.plateText.length).toBeGreaterThan(0);
    expect(Array.isArray(result.heightMarks)).toBe(true);
    expect(result.heightMarks.length).toBeGreaterThan(0);
    expect(result.unitSystem).toBe("metric");
    expect(result.svg).toContain("<svg");
  });

  it("ist deterministisch", () => {
    expect(createSampleMugshotPlate()).toEqual(createSampleMugshotPlate());
  });

  it("enthält die Beispiel-Gefangenen-Nummer", () => {
    expect(createSampleMugshotPlate().plateText).toContain("X-00427");
  });

  it("enthält den Beispiel-Namen", () => {
    expect(createSampleMugshotPlate().plateText).toContain("Maximilian Graf");
  });

  it("svg endet mit '</svg>'", () => {
    expect(createSampleMugshotPlate().svg.endsWith("</svg>")).toBe(true);
  });

  it("nutzt das metrische Einheitssystem", () => {
    expect(createSampleMugshotPlate().unitSystem).toBe("metric");
  });

  it("entspricht dem direkten Aufruf mit denselben Beispieldaten", () => {
    const sample = createSampleMugshotPlate();
    const direct = buildMugshotPlate(
      {
        prisonerNumber: "X-00427",
        name: "Maximilian Graf",
        precinct: "1. Bezirk",
        date: "14.10.2026",
        unitSystem: "metric",
      },
      42
    );
    expect(sample).toEqual(direct);
  });
});

// ---------------------------------------------------------------------------
// createSampleFingerprintCard
// ---------------------------------------------------------------------------

describe("createSampleFingerprintCard", () => {
  it("gibt eine gültige Fingerabdruck-Karte zurück", () => {
    const result = createSampleFingerprintCard();
    expect(result.prints).toHaveLength(10);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
  });

  it("ist deterministisch", () => {
    expect(createSampleFingerprintCard()).toEqual(createSampleFingerprintCard());
  });

  it("entspricht buildFingerprintCard(42)", () => {
    expect(createSampleFingerprintCard()).toEqual(buildFingerprintCard(42));
  });

  it("enthält 10 Abdrücke mit gültigen patternIds", () => {
    const result = createSampleFingerprintCard();
    for (const print of result.prints) {
      expect(["loop", "whorl", "arch"]).toContain(print.patternId);
    }
  });

  it("svg beginnt mit '<svg' und endet mit '</svg>'", () => {
    const result = createSampleFingerprintCard();
    expect(result.svg.startsWith("<svg")).toBe(true);
    expect(result.svg.endsWith("</svg>")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SVG-Struktur (alle SVG-erzeugenden Funktionen)
// ---------------------------------------------------------------------------

describe("SVG-Struktur aller SVG-erzeugenden Funktionen", () => {
  const svgs: Array<[string, string]> = [
    ["buildMugshotPlate metric", buildMugshotPlate(baseInput, 1).svg],
    [
      "buildMugshotPlate imperial",
      buildMugshotPlate({ ...baseInput, unitSystem: "imperial" }, 1).svg,
    ],
    ["buildFingerprintCard", buildFingerprintCard(1).svg],
    ["createSampleMugshotPlate", createSampleMugshotPlate().svg],
    ["createSampleFingerprintCard", createSampleFingerprintCard().svg],
  ];

  it("jedes SVG beginnt mit '<svg'", () => {
    for (const [, svg] of svgs) {
      expect(svg.startsWith("<svg")).toBe(true);
    }
  });

  it("jedes SVG endet mit '</svg>'", () => {
    for (const [, svg] of svgs) {
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("kein SVG enthält Hex-Farben", () => {
    for (const [label, svg] of svgs) {
      expect(HEX_COLOR_RE.test(svg), label).toBe(false);
    }
  });

  it("kein SVG enthält 'rgba('", () => {
    for (const [label, svg] of svgs) {
      expect(svg.includes("rgba("), label).toBe(false);
    }
  });

  it("jedes SVG enthält einen viewBox", () => {
    for (const [label, svg] of svgs) {
      expect(svg.includes("viewBox="), label).toBe(true);
    }
  });

  it("jedes SVG nutzt die xmlns-Deklaration", () => {
    for (const [label, svg] of svgs) {
      expect(svg.includes('xmlns="http://www.w3.org/2000/svg"'), label).toBe(
        true
      );
    }
  });

  it("kein SVG ist leer", () => {
    for (const [label, svg] of svgs) {
      expect(svg.length, label).toBeGreaterThan(0);
    }
  });
});
