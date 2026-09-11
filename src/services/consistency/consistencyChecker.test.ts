// Consistency Checker Tests (Sprint 26, Agent 1)
import { describe, it, expect } from "vitest";
import {
  checkCharacterConsistency,
  checkTimelineConsistency,
  checkPlotConsistency,
  checkEmotionalConsistency,
  generateConsistencyReport,
} from "./consistencyChecker";
import type { Character } from "@/services/character/characterManager";

describe("Consistency Checker", () => {
  it("checkCharacterConsistency finds duplicate names", () => {
    const chars: Character[] = [
      { id: "1", name: "Max", age: 30, backstory: "Ein Held", relationships: [] },
      { id: "2", name: "Max", age: 25, backstory: "Auch ein Held", relationships: [] },
    ];
    const issues = checkCharacterConsistency(chars);
    expect(issues.some((i) => i.message.includes("Doppelter"))).toBe(true);
  });

  it("checkCharacterConsistency finds invalid age", () => {
    const chars: Character[] = [
      { id: "1", name: "Test", age: -5, backstory: "Ein Held", relationships: [] },
    ];
    const issues = checkCharacterConsistency(chars);
    expect(issues.some((i) => i.message.includes("Ungültiges Alter"))).toBe(true);
  });

  it("checkCharacterConsistency finds missing name", () => {
    const chars: Character[] = [
      { id: "1", name: "", age: 30, backstory: "Ein Held", relationships: [] },
    ];
    const issues = checkCharacterConsistency(chars);
    expect(issues.some((i) => i.message.includes("ohne Namen"))).toBe(true);
  });

  it("checkTimelineConsistency finds duplicate dates", () => {
    const events = [
      { id: "1", date: "2024-01-15", title: "A" },
      { id: "2", date: "2024-01-15", title: "B" },
    ];
    const issues = checkTimelineConsistency(events);
    expect(issues.some((i) => i.message.includes("Doppelter Zeitstempel"))).toBe(true);
  });

  it("checkTimelineConsistency finds invalid dates", () => {
    const events = [
      { id: "1", date: "invalid", title: "A" },
    ];
    const issues = checkTimelineConsistency(events);
    expect(issues.some((i) => i.message.includes("Ungültiges Datum"))).toBe(true);
  });

  it("checkPlotConsistency finds short chapters", () => {
    const chapters = [
      { id: "1", title: "Kapitel", content: "Kurz" },
    ];
    const issues = checkPlotConsistency(chapters);
    expect(issues.some((i) => i.message.includes("sehr kurz"))).toBe(true);
  });

  it("checkEmotionalConsistency detects no emotions", () => {
    const chapters = [
      { id: "1", title: "Kapitel", content: "Der Hund bellt. Die Katze schläft." },
    ];
    const issues = checkEmotionalConsistency(chapters);
    expect(issues.some((i) => i.message.includes("Keine Emotionen"))).toBe(true);
  });

  it("generateConsistencyReport returns summary", () => {
    const report = generateConsistencyReport({
      characters: [
        { id: "1", name: "Max", age: 30, backstory: "Ein mutiger Held mit einer langen Beschreibung", relationships: [] },
      ],
    });
    expect(report.summary.total).toBe(0);
    expect(report.issues.length).toBe(0);
  });
});
