// Conflict Map Tests (Sprint 28, Agent 5)
import { describe, it, expect } from "vitest";
import { generateConflictMap } from "./conflictMap";

describe("Conflict Map", () => {
  it("generateConflictMap returns map", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const map = generateConflictMap(text);
    expect(map.conflicts).toBeDefined();
    expect(map.totalConflicts).toBeGreaterThanOrEqual(0);
  });
});
