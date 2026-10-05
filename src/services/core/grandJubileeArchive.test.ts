/**
 * Tests: grandJubileeArchive (WP 61.2 — 7.000-Tests-Jubiläums-Siegel & Sentinel)
 */

import { describe, it, expect } from "vitest";
import {
  runGrandCompletenessScan,
  issueJubileeCertificate,
  verifyJubileeCertificate,
  generateJubileeBadgeSvg,
  runPerformanceAudit,
  formatCompletenessReport,
  JUBILEE_TARGET,
  ISSUER,
  KEYSTROKE_BUDGET_MS,
  BADGE_GLYPH,
} from "./grandJubileeArchive";

const HEALTHY_INPUT = {
  serviceCount: 66,
  modeCount: 120,
  i18nKeysPerLocale: [980, 980, 980, 980],
  lazyChunks: 120,
  reachableServices: 66,
};

describe("grandJubileeArchive — runGrandCompletenessScan", () => {
  it("scannt ein gesundes System", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(s.checks.length).toBe(5);
    expect(s.status).toBe("ok");
  });

  it("alle Prüfpunkte bestehen bei gesundem System", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(s.failed).toBe(0);
    expect(s.passed).toBe(5);
  });

  it("Gesamt-Score ist 1 bei perfektem System", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(s.overallScore).toBe(1);
  });

  it("prüft die Service-Registrierung", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(s.checks[0].name).toBe("Service-Registrierung");
    expect(s.checks[0].detail).toContain("66");
  });

  it("prüft die i18n-Parität", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    const i18n = s.checks.find((c) => c.name === "i18n-Vollständigkeit");
    expect(i18n?.score).toBe(1);
    expect(i18n?.detail).toContain("4 Sprachen");
  });

  it("erkennt fehlende i18n-Parität", () => {
    const s = runGrandCompletenessScan({ ...HEALTHY_INPUT, i18nKeysPerLocale: [900, 980, 980, 980] });
    const i18n = s.checks.find((c) => c.name === "i18n-Vollständigkeit");
    expect(i18n?.score).toBeLessThan(1);
  });

  it("erkennt nur 2 Sprachen als unvollständig", () => {
    const s = runGrandCompletenessScan({ ...HEALTHY_INPUT, i18nKeysPerLocale: [980, 980] });
    const i18n = s.checks.find((c) => c.name === "i18n-Vollständigkeit");
    expect(i18n?.score).toBe(0.5);
  });

  it("prüft die Reachability", () => {
    const s = runGrandCompletenessScan({ ...HEALTHY_INPUT, reachableServices: 60 });
    const reach = s.checks.find((c) => c.name === "Reachability");
    expect(reach?.score).toBeLessThan(1);
    expect(reach?.status).toBe("warn");
  });

  it("meldet verwaiste Services als Fehler", () => {
    const s = runGrandCompletenessScan({ ...HEALTHY_INPUT, reachableServices: 30 });
    expect(s.status).toBe("fail");
    expect(s.failed).toBeGreaterThan(0);
  });

  it("erkennt ein leeres System", () => {
    const s = runGrandCompletenessScan({});
    expect(s.status).toBe("fail");
    expect(s.failed).toBeGreaterThan(0);
  });

  it("kommt ohne Input zurecht", () => {
    const s = runGrandCompletenessScan();
    expect(s.checks.length).toBe(5);
    expect(s.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("kommt mit null zurecht", () => {
    expect(runGrandCompletenessScan(null).checks.length).toBe(5);
    expect(runGrandCompletenessScan(undefined).failed).toBeGreaterThan(0);
  });

  it("ignoriert ungültige i18n-Einträge", () => {
    const s = runGrandCompletenessScan({
      ...HEALTHY_INPUT,
      i18nKeysPerLocale: [980, "x", null, 980] as never,
    });
    expect(s.checks.length).toBe(5);
  });

  it("Score bleibt zwischen 0 und 1", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(s.overallScore).toBeGreaterThanOrEqual(0);
    expect(s.overallScore).toBeLessThanOrEqual(1);
  });

  it("exportiert die Jubiläums-Konstante", () => {
    expect(JUBILEE_TARGET).toBe(7000);
  });
});

describe("grandJubileeArchive — issueJubileeCertificate", () => {
  it("stellt ein Zertifikat aus", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1000);
    expect(c.testCount).toBe(7000);
    expect(c.version).toBe("3.9.0");
    expect(c.hash.length).toBe(64);
  });

  it("vergibt Gold bei 7000 Tests", () => {
    expect(issueJubileeCertificate(7000, "3.9.0", 1).medal).toBe("gold");
    expect(issueJubileeCertificate(7100, "3.9.0", 1).medal).toBe("gold");
  });

  it("vergibt Silber knapp unter der Marke", () => {
    expect(issueJubileeCertificate(6500, "3.9.0", 1).medal).toBe("silver");
  });

  it("vergibt Bronze bei deutlich weniger Tests", () => {
    expect(issueJubileeCertificate(100, "3.9.0", 1).medal).toBe("bronze");
  });

  it("ist deterministisch", () => {
    const a = issueJubileeCertificate(7000, "3.9.0", 12345);
    const b = issueJubileeCertificate(7000, "3.9.0", 12345);
    expect(a.hash).toBe(b.hash);
    expect(a.signature).toBe(b.signature);
    expect(a.id).toBe(b.id);
  });

  it("unterschiedliche Eingaben erzeugen unterschiedliche Hashes", () => {
    const a = issueJubileeCertificate(7000, "3.9.0", 1);
    const b = issueJubileeCertificate(7001, "3.9.0", 1);
    expect(a.hash).not.toBe(b.hash);
  });

  it("nennt den Aussteller", () => {
    expect(issueJubileeCertificate(7000, "3.9.0", 1).issuer).toBe(ISSUER);
  });

  it("leitet die ID aus dem Hash ab", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(c.id).toBe(`jubilee-${c.hash.slice(0, 12)}`);
  });

  it("nutzt die Jubiläums-Marke als Standard", () => {
    expect(issueJubileeCertificate().testCount).toBe(JUBILEE_TARGET);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(issueJubileeCertificate(null, null, null).testCount).toBe(7000);
    expect(issueJubileeCertificate("x", "3.9.0", "y").version).toBe("3.9.0");
    expect(issueJubileeCertificate(undefined, undefined, undefined).version).toBe("3.9.0");
  });

  it("nutzt keinen Date.now()-Zeitstempel", () => {
    expect(issueJubileeCertificate(7000, "3.9.0").timestamp).toBe(0);
  });

  it("erzeugt einen SHA-256-korrekten Hash (Node-Referenzvektor)", () => {
    // Referenz: sha256("7000|3.9.0|0|gold") via Node crypto.
    const c = issueJubileeCertificate(7000, "3.9.0", 0);
    expect(c.hash).toBe("d4e29b2d1fcdee635099e0e53d01fd8cbe01972d28f0410b5eab8b61ff59421f");
  });

  it("erzeugt einen 64-stelligen Hex-Hash", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.signature).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("grandJubileeArchive — verifyJubileeCertificate", () => {
  it("verifiziert ein gültiges Zertifikat", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 12345);
    expect(verifyJubileeCertificate(c)).toBe(true);
  });

  it("erkennt manipulierte Testzahl", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(verifyJubileeCertificate({ ...c, testCount: 99999 })).toBe(false);
  });

  it("erkennt manipulierte Version", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(verifyJubileeCertificate({ ...c, version: "9.9.9" })).toBe(false);
  });

  it("erkennt manipulierte Signatur", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(verifyJubileeCertificate({ ...c, signature: "deadbeef" })).toBe(false);
  });

  it("erkennt manipulierte Medaille", () => {
    const c = issueJubileeCertificate(100, "3.9.0", 1);
    expect(verifyJubileeCertificate({ ...c, medal: "gold" })).toBe(false);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(verifyJubileeCertificate(null)).toBe(false);
    expect(verifyJubileeCertificate(undefined)).toBe(false);
    expect(verifyJubileeCertificate({} as never)).toBe(false);
  });
});

describe("grandJubileeArchive — generateJubileeBadgeSvg", () => {
  it("erzeugt ein SVG-Badge", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    const svg = generateJubileeBadgeSvg(c);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("zeigt die Testzahl", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(generateJubileeBadgeSvg(c)).toContain("7000");
  });

  it("zeigt die Version", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(generateJubileeBadgeSvg(c)).toContain("3.9.0");
  });

  it("zeigt den Badge-Glyph", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(generateJubileeBadgeSvg(c)).toContain(BADGE_GLYPH);
  });

  it("nennt den System-Sentinel", () => {
    const c = issueJubileeCertificate(7000, "3.9.0", 1);
    expect(generateJubileeBadgeSvg(c)).toContain("System-Sentinel");
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(generateJubileeBadgeSvg(null)).toContain("<svg");
    expect(generateJubileeBadgeSvg(undefined)).toContain("—");
  });
});

describe("grandJubileeArchive — runPerformanceAudit", () => {
  it("prüft die Editor-Latenz", () => {
    const a = runPerformanceAudit(66);
    expect(a.serviceCount).toBe(66);
    expect(a.keystrokeLatencyMs).toBeGreaterThan(0);
  });

  it("bleibt bei 61+ Diensten im Budget", () => {
    const a = runPerformanceAudit(66);
    expect(a.withinBudget).toBe(true);
    expect(a.keystrokeLatencyMs).toBeLessThan(KEYSTROKE_BUDGET_MS);
  });

  it("wächst sublinear mit der Dienstzahl", () => {
    const few = runPerformanceAudit(10);
    const many = runPerformanceAudit(100);
    // Verzehnfachung der Dienste darf die Latenz nicht verzehnfachen.
    expect(many.keystrokeLatencyMs).toBeLessThan(few.keystrokeLatencyMs * 3);
  });

  it("liefert ein Urteil", () => {
    const a = runPerformanceAudit(66);
    expect(a.verdict).toContain("Flüssig");
  });

  it("meldet das Budget", () => {
    expect(runPerformanceAudit(66).budgetMs).toBe(KEYSTROKE_BUDGET_MS);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(runPerformanceAudit().serviceCount).toBe(0);
    expect(runPerformanceAudit(null).keystrokeLatencyMs).toBe(0);
    expect(runPerformanceAudit("x").withinBudget).toBe(true);
  });
});

describe("grandJubileeArchive — formatCompletenessReport", () => {
  it("formatiert einen Bericht", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    const report = formatCompletenessReport(s);
    expect(report).toContain("Vollständigkeit");
    expect(report).toContain("Service-Registrierung");
  });

  it("nennt die Bestanden-Zahl", () => {
    const s = runGrandCompletenessScan(HEALTHY_INPUT);
    expect(formatCompletenessReport(s)).toContain("5 bestanden");
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(formatCompletenessReport(null)).toBe("");
    expect(formatCompletenessReport(undefined)).toBe("");
  });
});
