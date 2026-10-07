// @vitest-environment jsdom
/** Tests: Grand9000CitadelSentinel (WP 87.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  sha256,
  hmacSha256,
  runCitadelAudit,
  generateCitadelCertificate,
  formatCitadelAudit,
  createSampleAudit,
  createSampleCertificate,
  type CitadelAudit,
  type CitadelCertificate,
} from "./grand9000CitadelSentinel";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("sha256", () => {
  it("berechnet korrekten Hash für leeren String", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("berechnet korrekten Hash für 'test'", () => {
    expect(sha256("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });

  it("unterschiedliche Eingaben → unterschiedliche Hashes", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("lange Eingabe", () => {
    const long = "a".repeat(10000);
    const hash = sha256(long);
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("ist deterministisch", () => {
    expect(sha256("deterministisch")).toBe(sha256("deterministisch"));
  });
});

describe("hmacSha256", () => {
  it("berechnet HMAC", () => {
    const hmac = hmacSha256("key", "message");
    expect(hmac.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hmac)).toBe(true);
  });

  it("unterschiedliche Keys → unterschiedliche HMACs", () => {
    expect(hmacSha256("key1", "msg")).not.toBe(hmacSha256("key2", "msg"));
  });

  it("ist deterministisch", () => {
    expect(hmacSha256("key", "msg")).toBe(hmacSha256("key", "msg"));
  });
});

describe("runCitadelAudit", () => {
  it("bestand bei Erreichen aller Schwellen", () => {
    const audit = runCitadelAudit(9050, 9050, 89, 65, 1650, 2800, 14, 95);
    expect(audit.passed).toBe(true);
    expect(audit.overallScore).toBe(100);
    expect(audit.checks.every(c => c.status === "ok")).toBe(true);
  });

  it("warnung bei Grenzwerten", () => {
    const audit = runCitadelAudit(8850, 8850, 85, 60, 1550, 3500, 20, 150);
    expect(audit.passed).toBe(true);
    expect(audit.overallScore).toBeLessThan(100);
    expect(audit.checks.some(c => c.status === "warn")).toBe(true);
  });

  it("fail bei Unterschreitung kritischer Werte", () => {
    const audit = runCitadelAudit(8000, 7900, 70, 50, 1000, 5000, 50, 250);
    expect(audit.passed).toBe(false);
    expect(audit.checks.some(c => c.status === "fail")).toBe(true);
  });

  it("Hash ist deterministisch", () => {
    const a1 = runCitadelAudit(9000, 9000, 87, 62, 1600, 3000, 16, 120);
    const a2 = runCitadelAudit(9000, 9000, 87, 62, 1600, 3000, 16, 120);
    expect(a1.hash).toBe(a2.hash);
    expect(a1.hash).toContain("CITADEL9K-");
  });

  it("enthält alle 8 Prüfungen", () => {
    const audit = runCitadelAudit(9050, 9050, 89, 65, 1650, 2800, 14, 95);
    expect(audit.checks.length).toBe(8);
    const names = audit.checks.map(c => c.name);
    expect(names).toContain("Test-Schallmauer (9.000+)");
    expect(names).toContain("Test-Bestand (0 Fehler)");
    expect(names).toContain("Service-Registrierung");
    expect(names).toContain("Lazy-Chunk-Coverage");
    expect(names).toContain("i18n-Vollständigkeit (4 Sprachen)");
    expect(names).toContain("Bundle-Größe");
    expect(names).toContain("Maximale Latenz");
    expect(names).toContain("Heap-Allokation");
  });
});

describe("generateCitadelCertificate", () => {
  it("erzeugt Zertifikat mit allen Feldern", () => {
    const audit = createSampleAudit();
    const cert = generateCitadelCertificate(audit);
    expect(cert.id).toContain("CIT9K-");
    expect(cert.title).toBe("9.000 Tests Citadel Siegel");
    expect(cert.version).toBe("5.3.0");
    expect(cert.auditHash).toBe(audit.hash);
    expect(cert.testCount).toBe(audit.totalTests);
    expect(cert.serviceCount).toBe(audit.serviceCount);
    expect(cert.signature.length).toBe(64);
    expect(cert.svgBadge).toContain("<svg");
    expect(cert.svgBadge).toContain("9.000 TESTS");
  });

  it("Signatur ist deterministisch", () => {
    const audit = createSampleAudit();
    const c1 = generateCitadelCertificate(audit);
    const c2 = generateCitadelCertificate(audit);
    expect(c1.signature).toBe(c2.signature);
  });
});

describe("formatCitadelAudit", () => {
  it("formatiert Audit als Text", () => {
    const audit = createSampleAudit();
    const text = formatCitadelAudit(audit);
    expect(text).toContain("9.000 TESTS CITADEL AUDIT");
    expect(text).toContain(audit.hash);
    expect(text).toContain("BESTANDEN");
    expect(text).toContain("Test-Schallmauer");
  });
});

describe("createSampleAudit", () => {
  it("erzeugt Beispiel-Audit", () => {
    const audit = createSampleAudit();
    expect(audit.totalTests).toBe(9050);
    expect(audit.passedTests).toBe(9050);
    expect(audit.serviceCount).toBe(89);
    expect(audit.chunkCount).toBe(65);
    expect(audit.i18nKeyCount).toBe(1650);
    expect(audit.passed).toBe(true);
  });
});

describe("createSampleCertificate", () => {
  it("erzeugt Beispiel-Zertifikat", () => {
    const cert = createSampleCertificate();
    expect(cert.id).toContain("CIT9K-");
    expect(cert.svgBadge).toContain("BESTANDEN");
  });
});