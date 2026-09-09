// Rewrite Engine Tests (Sprint 26, Agent 3)
import { describe, it, expect } from "vitest";
import {
  rewriteText,
  rewriteAll,
  REWRITE_TECHNIQUES,
} from "./rewriteEngine";

describe("Rewrite Engine", () => {
  it("rewriteText applies simplify technique", () => {
    const text = "Er kam zu dem Schluss, dass es falsch ist.";
    const result = rewriteText(text, "simplify");
    expect(result.rewritten).toContain("schlussfolgerte");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("rewriteText applies vivid technique", () => {
    const text = "Das ist sehr gut und sehr schlecht.";
    const result = rewriteText(text, "vivid");
    expect(result.rewritten).not.toBe(text);
  });

  it("rewriteText returns original for unknown technique", () => {
    const text = "Test text";
    const result = rewriteText(text, "unknown");
    expect(result.rewritten).toBe(text);
  });

  it("rewriteAll returns results for all techniques", () => {
    const text = "Der Hund ist sehr gut. Die Katze ist sehr schlecht.";
    const results = rewriteAll(text);
    expect(results.length).toBe(REWRITE_TECHNIQUES.length);
  });
});
