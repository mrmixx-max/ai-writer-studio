// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  EMAIL_STEPS,
  getEmailStep,
  generateNewsletterSequence,
  splitSubjectLines,
  previewEmailSequence,
  createSampleEmailStep,
  createSampleNewsletterSequence,
} from "./authorNewsletterSequence";

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
    const r = createSeededRandom(19);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("EMAIL_STEPS", () => {
  it("enthält fünf E-Mail-Schritte", () => {
    expect(EMAIL_STEPS).toHaveLength(5);
  });
  it("jeder Schritt hat 3 Betreffzeilen", () => {
    for (const s of EMAIL_STEPS) {
      expect(s.subjectLines).toHaveLength(3);
    }
  });
  it("Schritte sind nach Tag-Offset sortiert", () => {
    for (let i = 1; i < EMAIL_STEPS.length; i++) {
      expect(EMAIL_STEPS[i].dayOffset).toBeGreaterThan(EMAIL_STEPS[i - 1].dayOffset);
    }
  });
  it("Willkommen ist Tag 0", () => {
    expect(getEmailStep("welcome")!.dayOffset).toBe(0);
  });
  it("Lese-Runde ist der letzte Schritt", () => {
    expect(getEmailStep("readingCircle")!.dayOffset).toBe(21);
  });
  it("getEmailStep lieferv undefined für unbekannt", () => {
    expect(getEmailStep("xyz" as never)).toBeUndefined();
  });
});

describe("generateNewsletterSequence", () => {
  it("ist deterministisch", () => {
    expect(generateNewsletterSequence(42).id).toBe(generateNewsletterSequence(42).id);
  });
  it("enthält 5 Schritte und 21 Tage Gesamtdauer", () => {
    const seq = generateNewsletterSequence(42);
    expect(seq.steps).toHaveLength(5);
    expect(seq.totalDays).toBe(21);
  });
  it("Schritte behalten ihre IDs", () => {
    const seq = generateNewsletterSequence(42);
    expect(seq.steps.map((s) => s.id)).toEqual(["welcome", "originStory", "coverReveal", "releaseDay", "readingCircle"]);
  });
});

describe("splitSubjectLines", () => {
  it("ist deterministisch", () => {
    expect(splitSubjectLines(42)[0].variants).toEqual(splitSubjectLines(42)[0].variants);
  });
  it("liefert 3 Varianten je Schritt", () => {
    for (const v of splitSubjectLines(42)) {
      expect(v.variants).toHaveLength(3);
    }
  });
  it("empfohlene Variante ist eine der drei", () => {
    for (const v of splitSubjectLines(42)) {
      expect(v.variants).toContain(v.recommended);
    }
  });
  it("keine Duplikate in den Varianten", () => {
    for (const v of splitSubjectLines(42)) {
      expect(new Set(v.variants).size).toBe(3);
    }
  });
});

describe("previewEmailSequence", () => {
  it("ist deterministisch", () => {
    expect(previewEmailSequence(42)[0].subject).toBe(previewEmailSequence(42)[0].subject);
  });
  it("enthält 5 Vorschauen", () => {
    expect(previewEmailSequence(42)).toHaveLength(5);
  });
  it("jede Vorschau hat Betreff, Body und CTA", () => {
    for (const p of previewEmailSequence(42)) {
      expect(p.subject.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
      expect(p.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleEmailStep liefert Willkommen", () => {
    expect(createSampleEmailStep().id).toBe("welcome");
  });
  it("createSampleNewsletterSequence liefert 5 Schritte", () => {
    expect(createSampleNewsletterSequence().steps).toHaveLength(5);
  });
});
