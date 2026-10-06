/**
 * Tests: grand8000JubileeSentinel (WP 71.2)
 */

import { describe, it, expect } from "vitest";
import {
  runDiamondAudit,
  generateDiamondCertificate,
  auditSubMillisecond,
  auditAllComponents,
  sha256,
} from "./grand8000JubileeSentinel";

describe("grand8000JubileeSentinel", () => {
  describe("sha256", () => {
    it("stimmt mit dem leeren Referenzvektor überein", () => {
      // echo -n "" | sha256sum
      expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("stimmt mit dem 'test'-Referenzvektor überein", () => {
      // echo -n "test" | sha256sum
      expect(sha256("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    });

    it("stimmt mit dem Zertifikats-Referenzvektor überein", () => {
      // Node: crypto.createHash('sha256').update(payload,'utf8').digest('hex')
      const payload = "AI Writer Studio v4.5.0 — 8000 Tests — Grand 8000 Diamond";
      expect(sha256(payload)).toBe("d7db31c03d9bc1c41c538c8c3aa9b6ded274c0f922584cb7ef50b79dab2c594c");
    });

    it("liefert immer 64 Hex-Zeichen", () => {
      for (const s of ["", "a", "Hallo Welt", "äöüß", "x".repeat(200)]) {
        expect(sha256(s)).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it("ist deterministisch", () => {
      expect(sha256("abc")).toBe(sha256("abc"));
    });

    it("unterscheidet verschiedene Eingaben", () => {
      expect(sha256("abc")).not.toBe(sha256("abd"));
    });
  });

  describe("runDiamondAudit", () => {
    it("führt das Audit mit Standardwerten durch", () => {
      const a = runDiamondAudit();
      expect(a.checks.length).toBe(6);
      expect(a.healthy).toBe(true);
    });

    it("prüft registrierte Werkzeuge", () => {
      const a = runDiamondAudit({ toolCount: 87 });
      expect(a.checks.find((c) => c.name === "Registrierte Werkzeuge")?.status).toBe("ok");
    });

    it("prüft Lazy-Chunks", () => {
      const a = runDiamondAudit({ chunkCount: 20 });
      expect(a.checks.find((c) => c.name === "Lazy-Chunks")?.status).toBe("ok");
    });

    it("prüft i18n-Schlüssel", () => {
      const a = runDiamondAudit({ i18nKeyCount: 1300 });
      expect(a.checks.find((c) => c.name === "i18n-Schlüssel")?.status).toBe("ok");
    });

    it("prüft Caching-Tabellen", () => {
      const a = runDiamondAudit({ cacheTableCount: 6 });
      expect(a.checks.find((c) => c.name === "Caching-Tabellen")?.status).toBe("ok");
    });

    it("prüft die Service-Abdeckung", () => {
      const a = runDiamondAudit({ serviceCount: 70 });
      expect(a.checks.find((c) => c.name === "Service-Abdeckung")?.status).toBe("ok");
    });

    it("warnt bei grenzwertig großen Bundles", () => {
      const a = runDiamondAudit({ bundleSizeKb: 6500 });
      expect(a.checks.find((c) => c.name === "Bundle-Größe")?.status).toBe("warn");
    });

    it("schlägt bei deutlich zu großen Bundles fehl", () => {
      const a = runDiamondAudit({ bundleSizeKb: 9000 });
      expect(a.checks.find((c) => c.name === "Bundle-Größe")?.status).toBe("fail");
    });

    it("schlägt fehl ohne Werkzeuge", () => {
      const a = runDiamondAudit({ toolCount: 0 });
      expect(a.checks.find((c) => c.name === "Registrierte Werkzeuge")?.status).toBe("fail");
      expect(a.healthy).toBe(false);
    });

    it("sperrt das Siegel bei fehlenden Werkzeugen trotz perfektem Score", () => {
      // Harte Voraussetzung: ohne Werkzeuge kein Diamant-Siegel.
      const a = runDiamondAudit({ toolCount: 0, chunkCount: 50, i18nKeyCount: 2000, cacheTableCount: 10, serviceCount: 80, bundleSizeKb: 1000 });
      expect(a.healthy).toBe(false);
    });

    it("sperrt das Siegel bei fehlenden Services", () => {
      const a = runDiamondAudit({ serviceCount: 0 });
      expect(a.healthy).toBe(false);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const a = runDiamondAudit({});
      expect(a.checks.length).toBe(6);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(runDiamondAudit())).toBe(JSON.stringify(runDiamondAudit()));
    });
  });

  describe("generateDiamondCertificate", () => {
    it("erzeugt ein Zertifikat mit 8000 Tests", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.testCount).toBe(8000);
      expect(c.version).toBe("4.5.0");
      expect(c.verified).toBe(true);
    });

    it("erzeugt ein SVG-Badge", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.svg).toContain("<svg");
      expect(c.svg).toContain("</svg>");
      expect(c.svg).toContain("8000");
      expect(c.svg).toContain("Diamond");
    });

    it("nutzt Design-Tokens im SVG statt Hex-Farben", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.svg).toContain("var(--accent)");
      expect(c.svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });

    it("erzeugt ein PDF", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.pdf).toContain("%PDF");
      expect(c.pdf).toContain("%%EOF");
    });

    it("erzeugt eine SHA-256-Prüfsumme", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("stimmt mit dem Referenzvektor überein", () => {
      const c = generateDiamondCertificate(8000, "4.5.0");
      expect(c.hash).toBe("d7db31c03d9bc1c41c538c8c3aa9b6ded274c0f922584cb7ef50b79dab2c594c");
    });

    it("ist unter 8000 Tests nicht verifiziert", () => {
      const c = generateDiamondCertificate(7999, "4.5.0");
      expect(c.verified).toBe(false);
    });

    it("ist deterministisch", () => {
      const a = generateDiamondCertificate(8000, "4.5.0");
      const b = generateDiamondCertificate(8000, "4.5.0");
      expect(a.hash).toBe(b.hash);
      expect(a.svg).toBe(b.svg);
      expect(a.pdf).toBe(b.pdf);
    });

    it("kommt mit null zurecht", () => {
      const c = generateDiamondCertificate(null as unknown as number, null as unknown as string);
      expect(c.testCount).toBe(0);
      expect(c.verified).toBe(false);
      expect(c.version).toBe("4.5.0");
    });
  });

  describe("auditSubMillisecond", () => {
    it("besteht innerhalb des Budgets", () => {
      expect(auditSubMillisecond("Modal", 12).withinBudget).toBe(true);
    });

    it("fällt bei Überschreitung durch", () => {
      expect(auditSubMillisecond("Modal", 20).withinBudget).toBe(false);
    });

    it("verwendet 16 ms als Standard-Budget", () => {
      const c = auditSubMillisecond("Modal", 16);
      expect(c.budgetMs).toBe(16);
      expect(c.withinBudget).toBe(true);
    });

    it("kommt mit null zurecht", () => {
      const c = auditSubMillisecond(null as unknown as string, null as unknown as number);
      expect(c.component).toBe("Unbekannte Komponente");
      expect(c.durationMs).toBe(0);
    });

    it("behandelt 0 nicht als fehlenden Wert", () => {
      const c = auditSubMillisecond("Modal", 0);
      expect(c.durationMs).toBe(0);
      expect(c.withinBudget).toBe(true);
    });
  });

  describe("auditAllComponents", () => {
    it("prüft eine Liste", () => {
      const r = auditAllComponents([
        { name: "A", durationMs: 5 },
        { name: "B", durationMs: 12 },
      ]);
      expect(r.checks.length).toBe(2);
      expect(r.allWithinBudget).toBe(true);
    });

    it("erkennt eine zu langsame Komponente", () => {
      const r = auditAllComponents([
        { name: "A", durationMs: 5 },
        { name: "B", durationMs: 25 },
      ]);
      expect(r.allWithinBudget).toBe(false);
    });

    it("nennt die langsamste Komponente", () => {
      const r = auditAllComponents([
        { name: "A", durationMs: 5 },
        { name: "B", durationMs: 14 },
        { name: "C", durationMs: 2 },
      ]);
      expect(r.slowest).toBe("B");
    });

    it("kommt mit leerer Liste zurecht", () => {
      const r = auditAllComponents([]);
      expect(r.checks).toEqual([]);
      expect(r.allWithinBudget).toBe(true);
      expect(r.slowest).toBeNull();
    });

    it("kommt mit null zurecht", () => {
      const r = auditAllComponents(null);
      expect(r.checks).toEqual([]);
    });

    it("ist deterministisch", () => {
      const list = [{ name: "A", durationMs: 5 }, { name: "B", durationMs: 9 }];
      expect(JSON.stringify(auditAllComponents(list))).toBe(JSON.stringify(auditAllComponents(list)));
    });
  });
});
