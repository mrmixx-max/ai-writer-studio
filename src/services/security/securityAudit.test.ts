// Tests: Security Audit & Input Validation.
import { describe, it, expect } from "vitest";
import { generateSecurityAuditReport } from "./securityAudit";
import {
  validatePrompt,
  validateFilename,
  sanitizeMarkdown,
} from "@/utils/validation";
import { TokenBucketRateLimit } from "@/utils/rateLimit";

describe("Security Audit", () => {
  it("generiert einen Audit-Bericht mit Findings", () => {
    const report = generateSecurityAuditReport();
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.passedChecks.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it("alle Findings haben valide Schweregrade", () => {
    const report = generateSecurityAuditReport();
    const severities = ["critical", "high", "medium", "low"];
    for (const f of report.findings) {
      expect(severities).toContain(f.severity);
    }
  });
});

describe("Input Validation", () => {
  it("validatePrompt() akzeptiert valide Prompts", () => {
    expect(() => validatePrompt("Schreibe ein Kapitel über KI.")).not.toThrow();
  });

  it("validatePrompt() lehnt leere Prompts ab", () => {
    expect(() => validatePrompt("")).toThrow(/nicht leer/);
  });

  it("validatePrompt() lehnt zu lange Prompts ab", () => {
    const long = "a ".repeat(200000);
    expect(() => validatePrompt(long)).toThrow(/zu lang/);
  });

  it("validateFilename() akzeptiert valide Dateinamen", () => {
    expect(() => validateFilename("mein-buch.docx")).not.toThrow();
  });

  it("validateFilename() lehnt Path Traversal ab", () => {
    expect(() => validateFilename("../../etc/passwd")).toThrow(
      /Pfad-Traversal/
    );
    expect(() =>
      validateFilename("../../../windows/system32/config")
    ).toThrow(/Pfad-Traversal/);
  });

  it("validateFilename() lehnt leere Dateinamen ab", () => {
    expect(() => validateFilename("")).toThrow(/nicht leer/);
  });

  it("sanitizeMarkdown() entfernt Script-Tags", () => {
    expect(
      sanitizeMarkdown("<script>alert('xss')</script>")
    ).not.toContain("<script>");
  });

  it("sanitizeMarkdown() entfernt javascript: URLs", () => {
    expect(sanitizeMarkdown("[link](javascript:alert(1))")).not.toContain(
      "javascript:"
    );
  });
});

describe("Rate Limiting", () => {
  it("TokenBucket erlaubt Requests unter dem Limit", () => {
    const rl = new TokenBucketRateLimit(10, 1); // 10 tokens, 1/sec refill
    expect(rl.tryConsume(5)).toBe(true);
  });

  it("TokenBucket blockiert Requests über dem Limit", () => {
    const rl = new TokenBucketRateLimit(5, 1);
    expect(rl.tryConsume(5)).toBe(true);
    expect(rl.tryConsume(1)).toBe(false);
  });

  it("TokenBucket refills über die Zeit", async () => {
    const rl = new TokenBucketRateLimit(2, 10); // 2 tokens, 10/sec refill
    rl.tryConsume(2); // empty
    expect(rl.tryConsume(1)).toBe(false);
    await new Promise((r) => setTimeout(r, 110)); // wait for refill
    expect(rl.tryConsume(1)).toBe(true);
  });
});
