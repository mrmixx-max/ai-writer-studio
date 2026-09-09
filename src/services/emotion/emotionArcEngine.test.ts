// Emotional Arc Engine Tests (Sprint 26, Agent 6)
import { describe, it, expect } from "vitest";
import {
  analyzeEmotionalArc,
  getEmotionColor,
  generateAsciiArc,
} from "./emotionArcEngine";

describe("Emotional Arc Engine", () => {
  it("analyzeEmotionalArc returns arc with points", () => {
    const text = "Der Hund bellt vor Freude. Die Katze schläft traurig. Der Vogel singt fröhlich.";
    const arc = analyzeEmotionalArc(text);
    expect(arc.points.length).toBeGreaterThan(0);
    expect(arc.dominantEmotion).toBeDefined();
  });

  it("analyzeEmotionalArc detects emotions", () => {
    const text = "Sie weinte vor Trauer. Er lachte vor Freude. Sie zitterte vor Angst.";
    const arc = analyzeEmotionalArc(text);
    expect(arc.points.some((p) => p.emotion === "trauer")).toBe(true);
    expect(arc.points.some((p) => p.emotion === "freude")).toBe(true);
    expect(arc.points.some((p) => p.emotion === "angst")).toBe(true);
  });

  it("analyzeEmotionalArc returns flat for empty text", () => {
    const arc = analyzeEmotionalArc("");
    expect(arc.arcType).toBe("flat");
    expect(arc.points.length).toBe(0);
  });

  it("getEmotionColor returns color for known emotion", () => {
    expect(getEmotionColor("freude")).toBe("#ffd700");
    expect(getEmotionColor("trauer")).toBe("#4169e1");
    expect(getEmotionColor("unknown")).toBe("#888888");
  });

  it("generateAsciiArc returns string", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const arc = analyzeEmotionalArc(text);
    const ascii = generateAsciiArc(arc);
    expect(ascii.length).toBeGreaterThan(0);
    expect(ascii).toContain("0%");
  });
});
