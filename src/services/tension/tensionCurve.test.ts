// Tension Curve Tests (Sprint 28, Agent 2)
import { describe, it, expect } from "vitest";
import { analyzeTensionCurve } from "./tensionCurve";

describe("Tension Curve", () => {
  it("analyzeTensionCurve returns curve", () => {
    const text = "Der Hund bellt. Die Katze schläft. Der Vogel singt.";
    const curve = analyzeTensionCurve(text);
    expect(curve.points.length).toBeGreaterThan(0);
    expect(curve.peak).toBeGreaterThanOrEqual(0);
  });
});
