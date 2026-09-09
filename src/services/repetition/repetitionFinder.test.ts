// Repetition Finder Tests (Sprint 26, Agent 2)
import { describe, it, expect } from "vitest";
import {
  findWordRepetitions,
  findPhraseRepetitions,
  generateRepetitionReport,
} from "./repetitionFinder";

describe("Repetition Finder", () => {
  it("findWordRepetitions finds repeated words", () => {
    const text = "Der Hund bellt. Der Hund rennt. Der Hund schläft.";
    const reps = findWordRepetitions(text);
    expect(reps.some((r) => r.text === "hund")).toBe(true);
  });

  it("findWordRepetitions ignores stopwords", () => {
    const text = "Der die das und ist ein eine nicht mit auf für den dem von zu bei als auch noch nach über sich sie er es ich wir ihr was wie wer wo wenn dass so dann aber aus wird hat nur war kann muss schon.";
    const reps = findWordRepetitions(text);
    expect(reps.length).toBe(0);
  });

  it("findPhraseRepetitions finds repeated phrases", () => {
    const text = "Es war einmal ein Hund. Es war einmal eine Katze. Es war einmal ein Vogel.";
    const reps = findPhraseRepetitions(text);
    expect(reps.some((r) => r.text.includes("es war einmal"))).toBe(true);
  });

  it("generateRepetitionReport returns report", () => {
    const text = "Der Hund bellt. Der Hund rennt. Der Hund schläft. Die Katze schläft.";
    const report = generateRepetitionReport(text);
    expect(report.totalWords).toBeGreaterThan(0);
    expect(report.repetitions.length).toBeGreaterThan(0);
  });
});
