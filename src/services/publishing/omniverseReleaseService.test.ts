/**
 * Tests: omniverseReleaseService (WP 63.2 — Omniverse 4.0 Master Release Cockpit)
 */

import { describe, it, expect } from "vitest";
import {
  runOmniversePreflight,
  buildOmniverseArchive,
  verifyOmniverseArchive,
  buildVgWortNormPage,
  formatPreflightReport,
  formatArchiveManifest,
  NORM_LINES_PER_PAGE,
  NORM_CHARS_PER_LINE,
  NORM_CHARS_PER_PAGE,
  FEE_PER_NORM_PAGE,
  ARCHIVE_EXTENSION,
} from "./omniverseReleaseService";

/** Erzeugt einen Roman-Umfang von ≥ 40.000 Wörtern. */
const BIG_CHAPTERS = Array.from({ length: 20 }, (_, i) =>
  Array.from({ length: 2000 }, (_, j) => `Wort${i}_${j}`).join(" "),
);

const HEALTHY = {
  chapters: BIG_CHAPTERS,
  characterCount: 12,
  conlangWords: 25,
  locationCount: 8,
  hasBarcode: true,
  localeCount: 4,
};

describe("omniverseReleaseService — runOmniversePreflight", () => {
  it("führt den Preflight aus", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.checks.length).toBe(6);
  });

  it("gibt ein gesundes Manuskript frei", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.releaseReady).toBe(true);
    expect(p.status).toBe("ok");
  });

  it("alle Prüfpunkte bestehen bei gesundem Manuskript", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.failed).toBe(0);
    expect(p.passed).toBe(6);
  });

  it("prüft den Manuskript-Umfang", () => {
    const p = runOmniversePreflight(HEALTHY);
    const c = p.checks.find((x) => x.name === "Manuskript-Umfang");
    expect(c?.score).toBe(1);
    expect(c?.detail).toContain("40.000");
  });

  it("warnt bei zu kurzem Manuskript", () => {
    const p = runOmniversePreflight({ ...HEALTHY, chapters: ["Nur ein kurzer Text."] });
    const c = p.checks.find((x) => x.name === "Manuskript-Umfang");
    expect(c?.status).toBe("warn");
  });

  it("sperrt den Release bei leerem Manuskript", () => {
    const p = runOmniversePreflight({});
    expect(p.releaseReady).toBe(false);
    expect(p.failed).toBeGreaterThan(0);
  });

  it("sperrt den Release bei unvollständigem Manuskript (harte Voraussetzung)", () => {
    // Alle Lexika stimmen, aber das Manuskript ist zu kurz.
    const p = runOmniversePreflight({
      chapters: ["Ein sehr kurzer Text."],
      characterCount: 12,
      conlangWords: 25,
      locationCount: 8,
      hasBarcode: true,
      localeCount: 4,
    });
    expect(p.releaseReady).toBe(false);
    expect(p.status).toBe("warn");
  });

  it("gibt erst ab 40.000 Wörtern frei", () => {
    const short = runOmniversePreflight({ ...HEALTHY, chapters: BIG_CHAPTERS.slice(0, 5) });
    expect(short.releaseReady).toBe(false);
    const full = runOmniversePreflight(HEALTHY);
    expect(full.releaseReady).toBe(true);
  });

  it("prüft das Figuren-Lexikon", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.checks.find((x) => x.name === "Figuren-Lexikon")?.score).toBe(1);
  });

  it("prüft das Conlang-Lexikon", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.checks.find((x) => x.name === "Conlang-Lexikon")?.score).toBe(1);
  });

  it("prüft das Schauplatz-Lexikon", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.checks.find((x) => x.name === "Schauplatz-Lexikon")?.score).toBe(1);
  });

  it("prüft den Barcode", () => {
    const withBarcode = runOmniversePreflight(HEALTHY);
    const without = runOmniversePreflight({ ...HEALTHY, hasBarcode: false });
    expect(withBarcode.checks.find((x) => x.name === "EAN-13-Barcode")?.score).toBe(1);
    expect(without.checks.find((x) => x.name === "EAN-13-Barcode")?.status).toBe("warn");
  });

  it("prüft die i18n-Abdeckung", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.checks.find((x) => x.name === "i18n-Abdeckung")?.score).toBe(1);
  });

  it("Gesamtscore bleibt zwischen 0 und 1", () => {
    const p = runOmniversePreflight(HEALTHY);
    expect(p.overallScore).toBeGreaterThanOrEqual(0);
    expect(p.overallScore).toBeLessThanOrEqual(1);
  });

  it("kommt ohne Input zurecht", () => {
    const p = runOmniversePreflight();
    expect(p.checks.length).toBe(6);
    expect(p.releaseReady).toBe(false);
  });

  it("kommt mit null zurecht", () => {
    expect(runOmniversePreflight(null).checks.length).toBe(6);
    expect(runOmniversePreflight(undefined).failed).toBeGreaterThan(0);
  });

  it("exportiert die VG-Wort-Konstanten", () => {
    expect(NORM_LINES_PER_PAGE).toBe(30);
    expect(NORM_CHARS_PER_LINE).toBe(60);
    expect(NORM_CHARS_PER_PAGE).toBe(1800);
  });
});

describe("omniverseReleaseService — buildOmniverseArchive", () => {
  it("baut ein Archiv", () => {
    const a = buildOmniverseArchive(HEALTHY, "4.0.0");
    expect(a.filename).toBe(`omniverse-4.0.0${ARCHIVE_EXTENSION}`);
    expect(a.entries.length).toBe(8);
  });

  it("enthält alle Formate", () => {
    const a = buildOmniverseArchive(HEALTHY);
    const paths = a.entries.map((e) => e.path);
    expect(paths).toContain("manuscript/print-x1a.pdf");
    expect(paths).toContain("manuscript/ebook.epub");
    expect(paths).toContain("manuscript/audiobook-cues.json");
  });

  it("enthält alle Lexika", () => {
    const a = buildOmniverseArchive(HEALTHY);
    const paths = a.entries.map((e) => e.path);
    expect(paths).toContain("lexicon/characters.json");
    expect(paths).toContain("lexicon/conlang.json");
    expect(paths).toContain("lexicon/locations.json");
  });

  it("enthält das Masterpiece Seal", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(a.entries.map((e) => e.path)).toContain("seal/masterpiece-seal.json");
  });

  it("enthält die Normseite", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(a.entries.map((e) => e.path)).toContain("normpage/vgwort-normseiten.txt");
  });

  it("berechnet die Gesamtgröße", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(a.totalBytes).toBeGreaterThan(0);
    expect(a.totalBytes).toBe(a.entries.reduce((s, e) => s + e.sizeBytes, 0));
  });

  it("berechnet die Wortzahl", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(a.totalWords).toBe(40000);
  });

  it("erzeugt Hash und Signatur", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ist deterministisch", () => {
    const a = buildOmniverseArchive(HEALTHY, "4.0.0");
    const b = buildOmniverseArchive(HEALTHY, "4.0.0");
    expect(a.hash).toBe(b.hash);
    expect(a.signature).toBe(b.signature);
  });

  it("nutzt eine Standardversion", () => {
    expect(buildOmniverseArchive(HEALTHY).version).toBe("4.0.0");
    expect(buildOmniverseArchive(HEALTHY, null).version).toBe("4.0.0");
  });

  it("kommt ohne Manuskript zurecht", () => {
    const a = buildOmniverseArchive();
    expect(a.entries.length).toBe(8);
    expect(a.totalWords).toBe(0);
  });
});

describe("omniverseReleaseService — verifyOmniverseArchive", () => {
  it("verifiziert ein gültiges Archiv", () => {
    const a = buildOmniverseArchive(HEALTHY, "4.0.0");
    expect(verifyOmniverseArchive(a)).toBe(true);
  });

  it("erkennt manipulierte Version", () => {
    const a = buildOmniverseArchive(HEALTHY, "4.0.0");
    expect(verifyOmniverseArchive({ ...a, version: "9.9.9" })).toBe(false);
  });

  it("erkennt manipulierte Wortzahl", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(verifyOmniverseArchive({ ...a, totalWords: 999 })).toBe(false);
  });

  it("erkennt manipulierte Signatur", () => {
    const a = buildOmniverseArchive(HEALTHY);
    expect(verifyOmniverseArchive({ ...a, signature: "deadbeef" })).toBe(false);
  });

  it("erkennt manipulierte Einträge", () => {
    const a = buildOmniverseArchive(HEALTHY);
    const tampered = { ...a, entries: [...a.entries, { path: "hack", description: "x", sizeBytes: 1 }] };
    expect(verifyOmniverseArchive(tampered)).toBe(false);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(verifyOmniverseArchive(null)).toBe(false);
    expect(verifyOmniverseArchive(undefined)).toBe(false);
    expect(verifyOmniverseArchive({} as never)).toBe(false);
  });

  it("erzeugt einen SHA-256-korrekten Hash (Node-Referenzvektor)", () => {
    // Referenz: sha256("4.0.0|0|<manifest>") via Node crypto — verifiziert die
    // browser-kompatible SHA-256-Implementierung gegen eine unabhängige Quelle.
    const a = buildOmniverseArchive();
    expect(a.hash).toBe("b86028a3d3698accb68dfc9becf5d936a995d3e62ab56db4357c26e9f2a5c96a");
  });
});

describe("omniverseReleaseService — buildVgWortNormPage", () => {
  it("erzeugt Normseiten", () => {
    const n = buildVgWortNormPage(HEALTHY);
    expect(n.pages.length).toBeGreaterThan(0);
  });

  it("jede Seite hat höchstens 30 Zeilen", () => {
    const n = buildVgWortNormPage(HEALTHY);
    n.pages.forEach((p) => {
      expect(p.length).toBeLessThanOrEqual(NORM_LINES_PER_PAGE);
    });
  });

  it("jede Zeile hat höchstens 60 Anschläge", () => {
    const n = buildVgWortNormPage(HEALTHY);
    n.pages.forEach((p) => {
      p.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(NORM_CHARS_PER_LINE);
      });
    });
  });

  it("berechnet die Zeichenzahl", () => {
    const n = buildVgWortNormPage(HEALTHY);
    expect(n.totalCharacters).toBeGreaterThan(1000);
  });

  it("berechnet die Normseiten-Anzahl", () => {
    const n = buildVgWortNormPage(HEALTHY);
    expect(n.normPageCount).toBeGreaterThan(0);
    expect(n.normPageCount).toBe(Math.ceil(n.totalCharacters / NORM_CHARS_PER_PAGE));
  });

  it("berechnet das geschätzte Honorar", () => {
    const n = buildVgWortNormPage(HEALTHY);
    expect(n.estimatedFee).toBeGreaterThan(0);
    expect(n.estimatedFee).toBeCloseTo(n.normPageCount * FEE_PER_NORM_PAGE, 2);
  });

  it("ist deterministisch", () => {
    const a = buildVgWortNormPage(HEALTHY);
    const b = buildVgWortNormPage(HEALTHY);
    expect(a.totalCharacters).toBe(b.totalCharacters);
  });

  it("kommt ohne Text zurecht", () => {
    const n = buildVgWortNormPage({});
    expect(n.pages).toEqual([]);
    expect(n.totalCharacters).toBe(0);
    expect(n.normPageCount).toBe(0);
    expect(buildVgWortNormPage().pageCount).toBe(0);
    expect(buildVgWortNormPage(null).estimatedFee).toBe(0);
  });
});

describe("omniverseReleaseService — Formatierung", () => {
  it("formatiert den Preflight-Bericht", () => {
    const text = formatPreflightReport(runOmniversePreflight(HEALTHY));
    expect(text).toContain("Universum-Preflight");
    expect(text).toContain("RELEASE FREIGEGEBEN");
  });

  it("meldet gesperrten Release", () => {
    const text = formatPreflightReport(runOmniversePreflight({}));
    expect(text).toContain("RELEASE GESPERRT");
  });

  it("formatiert das Archiv-Manifest", () => {
    const text = formatArchiveManifest(buildOmniverseArchive(HEALTHY));
    expect(text).toContain("omniverse-4.0.0.aiwsomni");
    expect(text).toContain("print-x1a.pdf");
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(formatPreflightReport(null)).toBe("");
    expect(formatArchiveManifest(undefined)).toBe("");
  });
});
