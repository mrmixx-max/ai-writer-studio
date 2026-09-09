// Dialogue Analysis Tests (Sprint 27, Agent 2)
import { describe, it, expect } from "vitest";
import {
  extractDialogue,
  analyzeDialogue,
  generateTensionAscii,
} from "./dialogueAnalysis";

describe("Dialogue Analysis", () => {
  it("extractDialogue finds quoted speech", () => {
    const text = "»Hallo«, sagte er. »Wie geht's?«";
    const dialogue = extractDialogue(text);
    expect(dialogue.length).toBeGreaterThanOrEqual(1);
  });

  it("extractDialogue finds em-dash dialogue", () => {
    const text = "— Hallo, sagte er.";
    const dialogue = extractDialogue(text);
    expect(dialogue.length).toBeGreaterThanOrEqual(1);
  });

  it("analyzeDialogue returns analysis", () => {
    const text = "»Hallo«, sagte er. »Wie gehts?«, fragte sie.";
    const analysis = analyzeDialogue(text);
    expect(analysis.totalLines).toBeGreaterThanOrEqual(1);
    expect(analysis.characters.length).toBeGreaterThanOrEqual(1);
  });

  it("generateTensionAscii returns string", () => {
    const text = "»Hallo!«, sagte er. »Wie gehts?«";
    const analysis = analyzeDialogue(text);
    const ascii = generateTensionAscii(analysis.tensionCurve);
    expect(ascii.length).toBeGreaterThan(0);
  });
});
