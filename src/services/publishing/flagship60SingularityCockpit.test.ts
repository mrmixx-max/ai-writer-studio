// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  sha512,
  runSingularityAudit,
  generateSingularityCertificate,
  createMagnumOpusUniversalArchive,
  formatSingularityAudit,
  createSampleSingularityAudit,
  createSampleSingularityCertificate,
  createSampleUniversalArchive,
} from "./flagship60SingularityCockpit";

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
    const r = createSeededRandom(9);
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
    expect(sha512("AI Writer Studio").length).toBe(128);
  });
  it("ist deterministisch", () => {
    expect(sha512("x")).toBe(sha512("x"));
  });
  it("unterschiedliche Eingaben erzeugen unterschiedliche Digests", () => {
    expect(sha512("a")).not.toBe(sha512("b"));
  });
});

describe("runSingularityAudit", () => {
  it("erkennt den Durchbruch der 10.000er-Marke", () => {
    const a = runSingularityAudit(10042, 10042, 104, 665, 74, 1780, 12);
    expect(a.crossedTenThousand).toBe(true);
    expect(a.passed).toBe(true);
  });
  it("markiert weniger als 9.800 Tests als fail", () => {
    const a = runSingularityAudit(9700, 9700, 104, 665, 74, 1780, 12);
    const check = a.checks.find((c) => c.name.includes("Schallmauer"));
    expect(check?.status).toBe("fail");
    expect(a.crossedTenThousand).toBe(false);
  });
  it("warn-Band zwischen 9.800 und 9.999", () => {
    const a = runSingularityAudit(9900, 9900, 104, 665, 74, 1780, 12);
    const check = a.checks.find((c) => c.name.includes("Schallmauer"));
    expect(check?.status).toBe("warn");
  });
  it("Fehler in Tests senken den Status", () => {
    const a = runSingularityAudit(10042, 10000, 104, 665, 74, 1780, 12);
    const check = a.checks.find((c) => c.name.includes("0 Fehler"));
    expect(check?.status).not.toBe("ok");
  });
  it("zu wenige Services erzeugen warn", () => {
    const a = runSingularityAudit(10042, 10042, 95, 665, 74, 1780, 12);
    const check = a.checks.find((c) => c.name.includes("Service"));
    expect(check?.status).toBe("warn");
  });
  it("Gesamt-Score liegt zwischen 0 und 100", () => {
    const a = runSingularityAudit(10042, 10042, 104, 665, 74, 1780, 12);
    expect(a.overallScore).toBeGreaterThanOrEqual(0);
    expect(a.overallScore).toBeLessThanOrEqual(100);
  });
  it("Hash beginnt mit SING6K-", () => {
    expect(runSingularityAudit(10042, 10042, 104, 665, 74, 1780, 12).hash.startsWith("SING6K-")).toBe(true);
  });
  it("ist deterministisch", () => {
    expect(runSingularityAudit(10042, 10042, 104, 665, 74, 1780, 12).hash).toBe(
      runSingularityAudit(10042, 10042, 104, 665, 74, 1780, 12).hash
    );
  });
});

describe("generateSingularityCertificate", () => {
  it("erzeugt eine SHA-512-Signatur (128 Hex-Zeichen)", () => {
    const cert = generateSingularityCertificate(createSampleSingularityAudit());
    expect(cert.sha512Signature.length).toBe(128);
  });
  it("SVG-Siegel nutzt Design-Tokens, keine Hex-Farben", () => {
    const cert = generateSingularityCertificate(createSampleSingularityAudit());
    expect(cert.svgBadge).toContain("var(--accent)");
    expect(cert.svgBadge.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("Siegel nennt 10.000 und BESTANDEN", () => {
    const cert = generateSingularityCertificate(createSampleSingularityAudit());
    expect(cert.svgBadge).toContain("10.000");
    expect(cert.svgBadge).toContain("BESTANDEN");
  });
  it("ist deterministisch", () => {
    const a = generateSingularityCertificate(createSampleSingularityAudit());
    const b = generateSingularityCertificate(createSampleSingularityAudit());
    expect(a.sha512Signature).toBe(b.sha512Signature);
  });
  it("unterschiedliche Aussteller-Schlüssel erzeugen unterschiedliche Signaturen", () => {
    const audit = createSampleSingularityAudit();
    expect(generateSingularityCertificate(audit, "KEY-A").sha512Signature).not.toBe(
      generateSingularityCertificate(audit, "KEY-B").sha512Signature
    );
  });
});

describe("createMagnumOpusUniversalArchive", () => {
  it("erzeugt ein .aiws60-Archiv mit allen Werkteilen", () => {
    const arch = createMagnumOpusUniversalArchive("Das Zwölfgestirn");
    expect(arch.extension).toBe(".aiws60");
    expect(arch.entries.length).toBeGreaterThanOrEqual(6);
    expect(arch.totalBytes).toBeGreaterThan(0);
  });
  it("ist 50 Jahre lesbar", () => {
    expect(createMagnumOpusUniversalArchive("X").readableUntilYear).toBe(2076);
  });
  it("Checksumme ist eine SHA-512", () => {
    expect(createMagnumOpusUniversalArchive("X").checksum.length).toBe(128);
  });
  it("ist deterministisch", () => {
    expect(createMagnumOpusUniversalArchive("X").id).toBe(createMagnumOpusUniversalArchive("X").id);
  });
});

describe("formatSingularityAudit", () => {
  it("formatiert den Audit als Text", () => {
    const text = formatSingularityAudit(createSampleSingularityAudit());
    expect(text).toContain("SINGULARITÄTS-AUDIT");
    expect(text).toContain("10.000er-Schallmauer: DURCHBROCHEN");
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleSingularityAudit liefert bestandenes Audit", () => {
    expect(createSampleSingularityAudit().passed).toBe(true);
  });
  it("createSampleSingularityCertificate liefert Zertifikat", () => {
    expect(createSampleSingularityCertificate().testCount).toBe(10042);
  });
  it("createSampleUniversalArchive liefert Archiv", () => {
    expect(createSampleUniversalArchive().title).toBe("Das Zwölfgestirn");
  });
});
