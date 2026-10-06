/**
 * Tests: Jubilee40SovereignVault (WP 85.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  runJubilee40Audit,
  createSovereignVault,
  generateJubilee40Seal,
  formatJubilee40Audit,
  createSampleAudit,
} from "./jubilee40SovereignVault";

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

describe("runJubilee40Audit", () => {
  it("führt Audit durch", () => {
    const audit = runJubilee40Audit(87, 64, 1542, 8796);
    expect(audit.checks.length).toBeGreaterThan(0);
    expect(audit.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("ist deterministisch", () => {
    const a1 = runJubilee40Audit(87, 64, 1542, 8796);
    const a2 = runJubilee40Audit(87, 64, 1542, 8796);
    expect(a1).toEqual(a2);
  });

  it("besteht bei ausreichenden Werten", () => {
    const audit = runJubilee40Audit(87, 64, 1542, 8800);
    expect(audit.passed).toBe(true);
  });

  it("warnet bei niedrigen Werten", () => {
    const audit = runJubilee40Audit(10, 5, 100, 100);
    expect(audit.passed).toBe(false);
  });
});

describe("createSovereignVault", () => {
  it("erstellt Vault", () => {
    const vault = createSovereignVault("Test", 85, 60, 1500, 8000);
    expect(vault.title).toBe("Test");
    expect(vault.hash).toContain("AIWS40-");
  });

  it("ist deterministisch", () => {
    const v1 = createSovereignVault("Test", 85, 60, 1500, 8000);
    const v2 = createSovereignVault("Test", 85, 60, 1500, 8000);
    expect(v1).toEqual(v2);
  });
});

describe("generateJubilee40Seal", () => {
  it("generiert SVG-Siegel", () => {
    const audit = createSampleAudit();
    const seal = generateJubilee40Seal(audit);
    expect(seal).toContain("<svg");
    expect(seal).toContain("40");
  });
});

describe("formatJubilee40Audit", () => {
  it("formatiert Audit als Text", () => {
    const audit = createSampleAudit();
    const text = formatJubilee40Audit(audit);
    expect(text).toContain("40. JUBILÄUMS-SOVERIGN-VAULT AUDIT");
  });
});

describe("createSampleAudit", () => {
  it("erstellt Beispiel-Audit", () => {
    const audit = createSampleAudit();
    expect(audit.checks.length).toBeGreaterThan(0);
  });
});