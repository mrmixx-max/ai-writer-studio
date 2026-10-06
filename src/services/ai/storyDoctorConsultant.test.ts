/**
 * Tests: StoryDoctorConsultant (WP 80.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  diagnoseManuscript,
  formatTreatmentPlan,
  createSamplePlan,
  SEVERITY_LABELS,
  CATEGORY_LABELS,
} from "./storyDoctorConsultant";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("diagnoseManuscript", () => {
  it("diagnostiziert Probleme", () => {
    const text = "Der Held versprach, die Stadt zu retten. Ein Widerspruch in der Handlung.";
    const plan = diagnoseManuscript(text);
    expect(plan.totalIssues).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const text = "Der Held versprach, die Stadt zu retten.";
    const p1 = diagnoseManuscript(text);
    const p2 = diagnoseManuscript(text);
    expect(p1).toEqual(p2);
  });

  it("hat Gesundheit zwischen 0 und 100", () => {
    const plan = diagnoseManuscript("Der Held versprach etwas.");
    expect(plan.overallHealth).toBeGreaterThanOrEqual(0);
    expect(plan.overallHealth).toBeLessThanOrEqual(100);
  });
});

describe("formatTreatmentPlan", () => {
  it("formatiert Plan als Text", () => {
    const plan = createSamplePlan();
    const text = formatTreatmentPlan(plan);
    expect(text).toContain("STORY-DOCTOR");
  });
});

describe("createSamplePlan", () => {
  it("erstellt Beispiel-Plan", () => {
    const plan = createSamplePlan();
    expect(plan.totalIssues).toBeGreaterThan(0);
  });
});

describe("SEVERITY_LABELS", () => {
  it("hat alle Schweregrade", () => {
    expect(Object.keys(SEVERITY_LABELS)).toHaveLength(4);
  });
});

describe("CATEGORY_LABELS", () => {
  it("hat alle Kategorien", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(5);
  });
});
