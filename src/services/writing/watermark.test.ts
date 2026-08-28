import { describe, it, expect } from "vitest";
import {
  analyzeText,
  tokenize,
  sentenceSplit,
  calculateEntropy,
  calculateBurstiness,
  calculateTypeTokenRatio,
  calculateZipfCoefficient,
  calculateHapaxRatio,
  detectGreenListBias,
  calculateSentenceEntropy,
  stripInvisibleUnicode,
  generateAntiWatermarkPrompt,
  formatReport,
  type WatermarkReport,
} from "@/services/writing/watermark";

describe("watermark detection", () => {
  it("tokenizes text correctly", () => {
    expect(tokenize("Hello world")).toEqual(["hello", "world"]);
    expect(tokenize("Der die das")).toEqual(["der", "die", "das"]);
  });

  it("splits sentences", () => {
    const sentences = sentenceSplit("First sentence. Second sentence! Third?");
    expect(sentences).toHaveLength(3);
  });

  it("calculates entropy", () => {
    const highEntropy = calculateEntropy(["a", "b", "c", "d", "e", "f"]);
    const lowEntropy = calculateEntropy(["a", "a", "a", "a", "a", "a"]);
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it("detects AI-like text with high score", () => {
    // AI-Text: gleichmäßig, wenig Burstigkeit, niedrige Entropie
    const aiText = "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.";
    const report = analyzeText(aiText);
    expect(report.aiScore).toBeGreaterThan(0);
  });

  it("gives lower score for varied text", () => {
    // Menschlich: variabel, hohe Burstigkeit
    const humanText = "Kurz. Jetzt kommt ein langer Satz mit vielen Wörtern und komplexen Strukturen, die nicht gleichmäßig sind. Mischung! Variable Längen? Ja!";
    const report = analyzeText(humanText);
    const aiText = "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.";
    const aiReport = analyzeText(aiText);
    expect(report.aiScore).toBeLessThanOrEqual(aiReport.aiScore);
  });

  it("calculates burstiness correctly", () => {
    const uniform = ["word word word", "word word word", "word word word"];
    const varied = ["short", "this is a longer sentence with more words", "medium length here"];
    expect(calculateBurstiness(varied)).toBeGreaterThan(calculateBurstiness(uniform));
  });

  it("calculates type-token ratio", () => {
    const diverse = ["a", "b", "c", "d", "e"];
    const repetitive = ["a", "a", "a", "b", "b"];
    expect(calculateTypeTokenRatio(diverse)).toBeGreaterThan(calculateTypeTokenRatio(repetitive));
  });

  it("calculates Zipf coefficient", () => {
    const tokens = ["the", "the", "the", "cat", "cat", "sat", "on", "mat", "a", "an"];
    const zipf = calculateZipfCoefficient(tokens);
    expect(zipf).toBeGreaterThanOrEqual(0);
  });

  it("calculates hapax ratio", () => {
    const tokens = ["a", "a", "b", "c", "d", "e", "f"];
    const ratio = calculateHapaxRatio(tokens);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it("detects green-list bias", () => {
    const biasedText = "the the the a a a an an an and and and";
    const normalText = "cat sat on mat bird flew tree";
    expect(detectGreenListBias(tokenize(biasedText))).toBeGreaterThan(detectGreenListBias(tokenize(normalText)));
  });

  it("calculates sentence entropy", () => {
    const varied = ["Short.", "This is a medium length sentence.", "A very very very very very very very very very very long sentence with many words."];
    const uniform = ["Medium one.", "Medium two.", "Medium three."];
    expect(calculateSentenceEntropy(varied)).toBeGreaterThan(calculateSentenceEntropy(uniform));
  });

  it("handles short text without zipf/ngram", () => {
    const shortText = "Short text";
    const report = analyzeText(shortText);
    expect(report.zipfCoefficient).toBe(0);
    expect(report.details.note).toContain("short");
  });

  it("returns zero for empty text", () => {
    const report = analyzeText("");
    expect(report.aiScore).toBe(0);
    expect(report.details.error).toBe("empty text");
  });

  it("strips invisible Unicode characters", () => {
    const dirty = "Hello\u200AWorld\u202FTest\u2009";
    const clean = stripInvisibleUnicode(dirty);
    expect(clean).not.toContain("\u200A");
    expect(clean).not.toContain("\u202F");
    expect(clean).toContain("Hello");
    expect(clean).toContain("World");
  });

  it("generates anti-watermark prompt", () => {
    const report: WatermarkReport = {
      perplexity: 50,
      burstiness: 0.1,
      ngramBias: 0.08,
      greenListRatio: 0.5,
      sentenceEntropy: 0.5,
      wordEntropy: 5.0,
      typeTokenRatio: 0.3,
      zipfCoefficient: 0.4,
      hapaxRatio: 0.2,
      aiScore: 80,
      details: { tokenCount: 100, sentenceCount: 5 },
    };
    const prompt = generateAntiWatermarkPrompt("Test text", report);
    expect(prompt).toContain("Rewrite");
    expect(prompt).toContain("AI markers");
    expect(prompt).toContain("Test text");
  });

  it("formats report correctly", () => {
    const report: WatermarkReport = {
      perplexity: 50.123,
      burstiness: 0.456,
      ngramBias: 0.0123,
      greenListRatio: 0.345,
      sentenceEntropy: 0.678,
      wordEntropy: 7.89,
      typeTokenRatio: 0.456,
      zipfCoefficient: 0.789,
      hapaxRatio: 0.234,
      aiScore: 45.6,
      details: { tokenCount: 100, sentenceCount: 5 },
    };
    const formatted = formatReport(report);
    expect(formatted).toContain("AI Score");
    expect(formatted).toContain("45.6");
    expect(formatted).toContain("Perplexity");
    expect(formatted).toContain("Burstiness");
  });

  it("ai score is capped at 100", () => {
    const report: WatermarkReport = {
      perplexity: 10,
      burstiness: 0.05,
      ngramBias: 0.1,
      greenListRatio: 0.9,
      sentenceEntropy: 0.1,
      wordEntropy: 1.0,
      typeTokenRatio: 0.1,
      zipfCoefficient: 0.1,
      hapaxRatio: 0.05,
      aiScore: 150,
      details: { tokenCount: 100, sentenceCount: 5 },
    };
    const formatted = formatReport(report);
    expect(formatted).not.toContain("150");
  });
});
