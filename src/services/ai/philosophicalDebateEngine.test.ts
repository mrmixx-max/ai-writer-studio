/**
 * Tests: PhilosophicalDebateEngine (WP 74.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  generateDebate,
  generateDilemma,
  formatDebate,
  formatDilemma,
  isUtilitarian,
  isDeontological,
  findPosition,
  findDilemma,
  PHILOSOPHICAL_POSITIONS,
  MORAL_DILEMMAS,
} from "./philosophicalDebateEngine";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("liefert unterschiedliche Werte für unterschiedliche Inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("generateDebate", () => {
  it("generiert Debatte mit 2 Positionen", () => {
    const debate = generateDebate("Test", 42);
    expect(debate.participants).toHaveLength(2);
  });

  it("generiert 2 Argumente", () => {
    const debate = generateDebate("Test", 42);
    expect(debate.arguments).toHaveLength(2);
  });

  it("hat ein Dilemma", () => {
    const debate = generateDebate("Test", 42);
    expect(debate.dilemma).toBeTruthy();
  });

  it("ist deterministisch für gleichen Seed", () => {
    const d1 = generateDebate("Test", 42);
    const d2 = generateDebate("Test", 42);
    expect(d1).toEqual(d2);
  });

  it("liefert unterschiedliche Debatten für verschiedene Seeds", () => {
    const d1 = generateDebate("Test", 1);
    const d2 = generateDebate("Test", 2);
    expect(d1).not.toEqual(d2);
  });

  it("verwendet das Thema", () => {
    const debate = generateDebate("Mein Thema", 42);
    expect(debate.topic).toBe("Mein Thema");
  });

  it("hat eine Synthesis", () => {
    const debate = generateDebate("Test", 42);
    expect(debate.synthesis.length).toBeGreaterThan(0);
  });
});

describe("generateDilemma", () => {
  it("generiert ein Dilemma", () => {
    const dilemma = generateDilemma(42);
    expect(dilemma).toBeTruthy();
  });

  it("ist deterministisch", () => {
    const d1 = generateDilemma(42);
    const d2 = generateDilemma(42);
    expect(d1).toEqual(d2);
  });

  it("hat 2 Optionen", () => {
    const dilemma = generateDilemma(42);
    expect(dilemma.options).toHaveLength(2);
  });
});

describe("formatDebate", () => {
  it("formatiert Debatte als Text", () => {
    const debate = generateDebate("Test", 42);
    const text = formatDebate(debate);
    expect(text).toContain("PHILOSOPHISCHE DEBATTE");
    expect(text).toContain("DILEMMA");
    expect(text).toContain("SYNTHESIS");
  });
});

describe("formatDilemma", () => {
  it("formatiert Dilemma als Text", () => {
    const dilemma = generateDilemma(42);
    const text = formatDilemma(dilemma);
    expect(text).toContain("DILEMMA");
    expect(text).toContain("Einsatz");
  });
});

describe("isUtilitarian", () => {
  it("erkennt Utilitarismus", () => {
    const pos = findPosition("utilitarian")!;
    expect(isUtilitarian(pos)).toBe(true);
  });

  it("erkennt Nicht-Utilitarismus", () => {
    const pos = findPosition("deontological")!;
    expect(isUtilitarian(pos)).toBe(false);
  });
});

describe("isDeontological", () => {
  it("erkennt Deontologie", () => {
    const pos = findPosition("deontological")!;
    expect(isDeontological(pos)).toBe(true);
  });

  it("erkennt Nicht-Deontologie", () => {
    const pos = findPosition("utilitarian")!;
    expect(isDeontological(pos)).toBe(false);
  });
});

describe("findPosition", () => {
  it("findet Position nach ID", () => {
    const pos = findPosition("stoic");
    expect(pos).toBeTruthy();
    expect(pos!.name).toBe("Stoizismus");
  });

  it("gibt undefined für unbekannte ID", () => {
    expect(findPosition("unknown")).toBeUndefined();
  });
});

describe("findDilemma", () => {
  it("findet Dilemma nach ID", () => {
    const d = findDilemma("trolley");
    expect(d).toBeTruthy();
    expect(d!.title).toContain("Straßenbahn");
  });

  it("gibt undefined für unbekannte ID", () => {
    expect(findDilemma("unknown")).toBeUndefined();
  });
});

describe("PHILOSOPHICAL_POSITIONS", () => {
  it("hat 6 Positionen", () => {
    expect(PHILOSOPHICAL_POSITIONS).toHaveLength(6);
  });

  it("hat einzigartige IDs", () => {
    const ids = PHILOSOPHICAL_POSITIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
  });
});

describe("MORAL_DILEMMAS", () => {
  it("hat 4 Dilemmata", () => {
    expect(MORAL_DILEMMAS).toHaveLength(4);
  });

  it("hat einzigartige IDs", () => {
    const ids = MORAL_DILEMMAS.map((d) => d.id);
    expect(new Set(ids).size).toBe(4);
  });
});
