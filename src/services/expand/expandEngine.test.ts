// Expand Engine Tests (Sprint 26, Agent 4)
import { describe, it, expect } from "vitest";
import {
  expandText,
  expandAll,
  EXPAND_TECHNIQUES,
} from "./expandEngine";

describe("Expand Engine", () => {
  it("expandText applies sensory technique", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const result = expandText(text, "sensory");
    expect(result.expanded.length).toBeGreaterThan(text.length);
    expect(result.additions.length).toBeGreaterThan(0);
  });

  it("expandText applies emotional technique", () => {
    const text = "Der Hund bellt. Die Katze schläft. Der Vogel singt. Die Maus läuft. Der Fisch schwimmt. Die Schlange kriecht. Der Löwe brüllt.";
    const result = expandText(text, "emotional");
    expect(result.expanded).not.toBe(result.original);
  });

  it("expandText returns original for unknown technique", () => {
    const text = "Test text";
    const result = expandText(text, "unknown");
    expect(result.expanded).toBe(text);
  });

  it("expandAll returns results for all techniques", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const results = expandAll(text);
    expect(results.length).toBe(EXPAND_TECHNIQUES.length);
  });
});
