// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  sha512,
  runJubileeAudit,
  generateJubileeCertificate,
  buildRetrospectiveMatrix,
  formatJubileeAudit,
  createSampleJubileeAudit,
  createSampleJubileeCertificate,
  createSampleRetrospective,
} from "./goldenJubilee50Sentinel";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("sha512", () => {
  it("stimmt mit dem Referenzvektor für den leeren String überein", () => {
    expect(sha512("")).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    );
  });
  it("stimmt mit dem Referenzvektor für \"abc\" überein", () => {
    expect(sha512("abc")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    );
  });
  it("liefert 128 Hex-Zeichen", () => {
    expect(sha512("50. Jubiläum").length).toBe(128);
  });
  it("ist deterministisch", () => {
    expect(sha512("x")).toBe(sha512("x"));
  });
  it("unterschiedliche Eingaben erzeugen unterschiedliche Digests", () => {
    expect(sha512("a")).not.toBe(sha512("b"));
  });
});

describe("runJubileeAudit", () => {
  it("erkennt den Test-Bestand über 10.280", () => {
    const a = runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11);
    expect(a.passed).toBe(true);
    expect(a.milestone).toBe(50);
  });
  it("weniger als 10.000 Tests sind ein Fehler", () => {
    const a = runJubileeAudit(9800, 9800, 109, 671, 82, 1820, 11);
    const check = a.checks.find((c) => c.name.includes("10.280+"));
    expect(check?.status).toBe("fail");
  });
  it("warn-Band zwischen 10.000 und 10.279", () => {
    const a = runJubileeAudit(10100, 10100, 109, 671, 82, 1820, 11);
    const check = a.checks.find((c) => c.name.includes("10.280+"));
    expect(check?.status).toBe("warn");
  });
  it("Fehler in Tests senken den Status", () => {
    const a = runJubileeAudit(10310, 10200, 109, 671, 82, 1820, 11);
    expect(a.checks.find((c) => c.name.includes("0 Fehler"))?.status).not.toBe("ok");
  });
  it("zu wenige Services erzeugen warn", () => {
    const a = runJubileeAudit(10310, 10310, 98, 671, 82, 1820, 11);
    expect(a.checks.find((c) => c.name.includes("Service"))?.status).toBe("warn");
  });
  it("Gesamt-Score liegt zwischen 0 und 100", () => {
    const a = runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11);
    expect(a.overallScore).toBeGreaterThanOrEqual(0);
    expect(a.overallScore).toBeLessThanOrEqual(100);
  });
  it("Hash beginnt mit GOLD50-", () => {
    expect(runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11).hash.startsWith("GOLD50-")).toBe(true);
  });
  it("ist deterministisch", () => {
    expect(runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11).hash).toBe(
      runJubileeAudit(10310, 10310, 109, 671, 82, 1820, 11).hash
    );
  });
});

describe("generateJubileeCertificate", () => {
  it("erzeugt eine SHA-512-Signatur (128 Hex-Zeichen)", () => {
    expect(generateJubileeCertificate(createSampleJubileeAudit()).sha512Signature.length).toBe(128);
  });
  it("SVG-Siegel nutzt Design-Tokens, keine Hex-Farben", () => {
    const cert = generateJubileeCertificate(createSampleJubileeAudit());
    expect(cert.svgBadge).toContain("var(--accent)");
    expect(cert.svgBadge.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("Siegel nennt 50 und GOLDENES JUBILÄUM", () => {
    const cert = generateJubileeCertificate(createSampleJubileeAudit());
    expect(cert.svgBadge).toContain(">50<");
    expect(cert.svgBadge).toContain("GOLDENES JUBILÄUM");
  });
  it("nennt Meilenstein 50", () => {
    expect(generateJubileeCertificate(createSampleJubileeAudit()).milestone).toBe(50);
  });
  it("ist deterministisch", () => {
    const a = generateJubileeCertificate(createSampleJubileeAudit());
    const b = generateJubileeCertificate(createSampleJubileeAudit());
    expect(a.sha512Signature).toBe(b.sha512Signature);
  });
  it("unterschiedliche Aussteller-Schlüssel erzeugen unterschiedliche Signaturen", () => {
    const audit = createSampleJubileeAudit();
    expect(generateJubileeCertificate(audit, "KEY-A").sha512Signature).not.toBe(
      generateJubileeCertificate(audit, "KEY-B").sha512Signature
    );
  });
});

describe("buildRetrospectiveMatrix", () => {
  it("enthält Meilenstein 1 und 50", () => {
    const m = buildRetrospectiveMatrix();
    expect(m.entries.some((e) => e.number === 1)).toBe(true);
    expect(m.entries.some((e) => e.number === 50)).toBe(true);
  });
  it("Einträge sind aufsteigend sortiert", () => {
    const m = buildRetrospectiveMatrix();
    for (let i = 1; i < m.entries.length; i++) {
      expect(m.entries[i].number).toBeGreaterThan(m.entries[i - 1].number);
    }
  });
  it("Testzahlen wachsen monoton", () => {
    const m = buildRetrospectiveMatrix();
    for (let i = 1; i < m.entries.length; i++) {
      expect(m.entries[i].testCount).toBeGreaterThanOrEqual(m.entries[i - 1].testCount);
    }
  });
  it("berechnet das Wachstum", () => {
    const m = buildRetrospectiveMatrix();
    expect(m.totalGrowth).toBeGreaterThan(0);
    expect(m.firstVersion).toBe("1.0.0");
    expect(m.latestVersion).toBe("6.2.0");
  });
  it("ist deterministisch", () => {
    expect(buildRetrospectiveMatrix().entries.length).toBe(buildRetrospectiveMatrix().entries.length);
  });
});

describe("formatJubileeAudit", () => {
  it("formatiert den Audit als Text", () => {
    const text = formatJubileeAudit(createSampleJubileeAudit());
    expect(text).toContain("GOLDENES JUBILÄUMS-AUDIT");
    expect(text).toContain("Meilenstein 50");
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleJubileeAudit liefert bestandenes Audit", () => {
    expect(createSampleJubileeAudit().passed).toBe(true);
  });
  it("createSampleJubileeCertificate liefert Zertifikat", () => {
    expect(createSampleJubileeCertificate().testCount).toBe(10310);
  });
  it("createSampleRetrospective liefert die Matrix", () => {
    expect(createSampleRetrospective().milestonesCount).toBeGreaterThan(5);
  });
});
