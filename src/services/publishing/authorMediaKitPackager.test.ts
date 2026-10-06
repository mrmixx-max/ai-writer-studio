/**
 * Tests: AuthorMediaKitPackager (WP 77.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  generateBio,
  generateInterviewQuestions,
  createMediaOneSheet,
  formatMediaOneSheet,
  createSampleOneSheet,
} from "./authorMediaKitPackager";

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

describe("generateBio", () => {
  it("generiert kurze Bio", () => {
    const bio = generateBio("Erik", "short");
    expect(bio.length).toBeGreaterThan(0);
  });

  it("generiert mittlere Bio", () => {
    const bio = generateBio("Erik", "medium");
    expect(bio.length).toBeGreaterThan(0);
  });

  it("generiert lange Bio", () => {
    const bio = generateBio("Erik", "long");
    expect(bio.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const b1 = generateBio("Erik", "short");
    const b2 = generateBio("Erik", "short");
    expect(b1).toBe(b2);
  });
});

describe("generateInterviewQuestions", () => {
  it("generiert 5 Fragen", () => {
    const questions = generateInterviewQuestions("Test");
    expect(questions).toHaveLength(5);
  });

  it("ist deterministisch", () => {
    const q1 = generateInterviewQuestions("Test");
    const q2 = generateInterviewQuestions("Test");
    expect(q1).toEqual(q2);
  });
});

describe("createMediaOneSheet", () => {
  it("erstellt One-Sheet", () => {
    const sheet = createMediaOneSheet("Titel", "Logline", "Autor", "ISBN", 9.99);
    expect(sheet.title).toBe("Titel");
    expect(sheet.logline).toBe("Logline");
    expect(sheet.isbn).toBe("ISBN");
  });

  it("hat Interview-Fragen", () => {
    const sheet = createMediaOneSheet("Titel", "Logline", "Autor", "ISBN", 9.99);
    expect(sheet.interviewQuestions.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const s1 = createMediaOneSheet("Titel", "Logline", "Autor", "ISBN", 9.99);
    const s2 = createMediaOneSheet("Titel", "Logline", "Autor", "ISBN", 9.99);
    expect(s1).toEqual(s2);
  });
});

describe("formatMediaOneSheet", () => {
  it("formatiert One-Sheet als Text", () => {
    const sheet = createSampleOneSheet();
    const text = formatMediaOneSheet(sheet);
    expect(text).toContain("MEDIA ONE-SHEET");
    expect(text).toContain("Comp Titles");
  });
});

describe("createSampleOneSheet", () => {
  it("erstellt Beispiel-One-Sheet", () => {
    const sheet = createSampleOneSheet();
    expect(sheet.title).toBeTruthy();
    expect(sheet.interviewQuestions.length).toBeGreaterThan(0);
  });
});
