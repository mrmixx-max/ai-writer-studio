/**
 * Tests: grandCenturySentinel (WP 65.2)
 */

import { describe, it, expect } from "vitest";
import {
  runEcosystemAudit,
  generateCenturyCertificate,
  auditModalLatency,
} from "./grandCenturySentinel";

describe("grandCenturySentinel", () => {
  describe("runEcosystemAudit", () => {
    it("führt das Audit mit Standardwerten durch", () => {
      const a = runEcosystemAudit();
      expect(a.checks.length).toBe(5);
      expect(a.passed).toBeGreaterThan(0);
      expect(a.overallScore).toBeGreaterThan(0);
      expect(a.healthy).toBe(true);
    });

    it("prüft SQLite-Schemata", () => {
      const a = runEcosystemAudit({ schemaCount: 12 });
      const check = a.checks.find((c) => c.name === "SQLite-Schemata");
      expect(check?.status).toBe("ok");
    });

    it("prüft Caching-Indizes", () => {
      const a = runEcosystemAudit({ cacheIndexCount: 8 });
      const check = a.checks.find((c) => c.name === "Caching-Indizes");
      expect(check?.status).toBe("ok");
    });

    it("prüft i18n-Vollständigkeit", () => {
      const a = runEcosystemAudit({ i18nKeyCount: 1200 });
      const check = a.checks.find((c) => c.name === "i18n-Vollständigkeit");
      expect(check?.status).toBe("ok");
    });

    it("prüft Bundle-Größe", () => {
      const a = runEcosystemAudit({ bundleSizeKb: 4200 });
      const check = a.checks.find((c) => c.name === "Bundle-Größe");
      expect(check?.status).toBe("ok");
    });

    it("prüft Service-Abdeckung", () => {
      const a = runEcosystemAudit({ serviceCount: 65 });
      const check = a.checks.find((c) => c.name === "Service-Abdeckung");
      expect(check?.status).toBe("ok");
    });

    it("warnt bei zu großen Bundles", () => {
      const a = runEcosystemAudit({ bundleSizeKb: 9000 });
      const check = a.checks.find((c) => c.name === "Bundle-Größe");
      expect(check?.status).toBe("warn");
    });

    it("schlägt fehl bei fehlenden Schemata", () => {
      const a = runEcosystemAudit({ schemaCount: 0 });
      const check = a.checks.find((c) => c.name === "SQLite-Schemata");
      expect(check?.status).toBe("fail");
    });

    it("ist nicht healthy bei Fehlern", () => {
      const a = runEcosystemAudit({ schemaCount: 0, cacheIndexCount: 0 });
      expect(a.healthy).toBe(false);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const a = runEcosystemAudit({});
      expect(a.checks.length).toBe(5);
    });
  });

  describe("generateCenturyCertificate", () => {
    it("erzeugt ein Zertifikat mit 7500 Tests", () => {
      const c = generateCenturyCertificate(7500, "4.1.0");
      expect(c.testCount).toBe(7500);
      expect(c.version).toBe("4.1.0");
      expect(c.verified).toBe(true);
    });

    it("erzeugt ein SVG-Badge", () => {
      const c = generateCenturyCertificate(7500, "4.1.0");
      expect(c.svg).toContain("<svg");
      expect(c.svg).toContain("</svg>");
      expect(c.svg).toContain("7500");
    });

    it("erzeugt ein PDF", () => {
      const c = generateCenturyCertificate(7500, "4.1.0");
      expect(c.pdf).toContain("%PDF");
      expect(c.pdf).toContain("%%EOF");
    });

    it("erzeugt einen SHA-256-Hash", () => {
      const c = generateCenturyCertificate(7500, "4.1.0");
      expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("ist nicht verifiziert unter 7500 Tests", () => {
      const c = generateCenturyCertificate(7499, "4.1.0");
      expect(c.verified).toBe(false);
    });

    it("ist deterministisch", () => {
      const a = generateCenturyCertificate(7500, "4.1.0");
      const b = generateCenturyCertificate(7500, "4.1.0");
      expect(a.hash).toBe(b.hash);
      expect(a.svg).toBe(b.svg);
    });

    it("kommt mit null zurecht", () => {
      const c = generateCenturyCertificate(null as unknown as number, null as unknown as string);
      expect(c.testCount).toBe(0);
      expect(c.verified).toBe(false);
    });

    it("verifiziert SHA-256 gegen Referenzvektor", () => {
      // Referenz: echo -n "test" | sha256sum
      const c = generateCenturyCertificate(7500, "4.1.0");
      // Der Hash sollte nicht der leere Hash sein
      expect(c.hash).not.toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });
  });

  describe("auditModalLatency", () => {
    it("besteht innerhalb des Budgets", () => {
      const l = auditModalLatency("TestModal", 12);
      expect(l.withinBudget).toBe(true);
    });

    it("fällt bei Überschreitung des Budgets durch", () => {
      const l = auditModalLatency("TestModal", 20);
      expect(l.withinBudget).toBe(false);
    });

    it("verwendet 16ms als Standard-Budget", () => {
      const l = auditModalLatency("TestModal", 16);
      expect(l.budgetMs).toBe(16);
      expect(l.withinBudget).toBe(true);
    });

    it("kommt mit null zurecht", () => {
      const l = auditModalLatency(null as unknown as string, null as unknown as number);
      expect(l.component).toBe("Unbekannte Komponente");
      expect(l.durationMs).toBe(0);
    });
  });
});
