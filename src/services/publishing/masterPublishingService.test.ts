// Tests: Master-Publishing-Service (WP 43.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  runMasterPreflight,
  buildPublishingBundle,
  describeBundle,
  PREFLIGHT_CHECKS,
} from "./masterPublishingService";
import type {
  PublishingProject,
  PreflightResult,
  PublishingBundle,
} from "./masterPublishingService";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Gültige ISBN-13 (Prüfziffer korrekt): 978-3-16-148410-0.
const VALID_ISBN = "9783161484100";
// Dieselbe ISBN mit falscher Prüfziffer.
const INVALID_ISBN = "9783161484101";

const CLEAN: PublishingProject = {
  title: "Der stille Zeuge",
  author: "Anna Beispiel",
  isbn: VALID_ISBN,
  price: 12.99,
  language: "de",
  colorModel: "CMYK",
  chapters: [
    { id: "c1", title: "Kapitel 1", content: "Es war ein ruhiger Morgen. Die Stadt schlief noch." },
    { id: "c2", title: "Kapitel 2", content: "Später kam der Regen. Sie blieb am Fenster stehen." },
  ],
};

const BAD_ISBN: PublishingProject = { ...CLEAN, isbn: INVALID_ISBN };

const RGB: PublishingProject = { ...CLEAN, colorModel: "RGB" };

const NO_PRICE: PublishingProject = { ...CLEAN, price: undefined };

const NO_ISBN: PublishingProject = { ...CLEAN, isbn: undefined };

// Zwei widersprüchliche Ereignisse zum selben Zeitstempel, ohne Auflösung.
const TIMESTAMP_COLLISION: PublishingProject = {
  ...CLEAN,
  chapters: [
    {
      id: "c1",
      title: "Kapitel 1",
      content: "Um 22:00 Uhr betrat er das Haus. Um 22:00 Uhr verließ sie die Stadt.",
    },
  ],
};

// Absatz mit zweiter Zeile aus einem Wort → Schusterjunge (widow).
const WIDOW: PublishingProject = {
  ...CLEAN,
  chapters: [{ id: "c1", title: "Kapitel 1", content: "Der Mann ging leise\nfort." }],
};

// Enthält Abkürzung (NBSP), mehrfache Trennstriche und gerade Anführungszeichen.
const TYPO: PublishingProject = {
  ...CLEAN,
  chapters: [
    {
      id: "c1",
      title: "Kapitel 1",
      content: 'Dr. Müller sagte "Hallo" und schwieg ---- lange.',
    },
  ],
};

const EMPTY_PROJECT: PublishingProject = {
  title: "",
  author: "",
  chapters: [],
};

// ---------------------------------------------------------------------------
// 1) runMasterPreflight
// ---------------------------------------------------------------------------

describe("runMasterPreflight", () => {
  it("führt genau vier Checks aus", () => {
    const result = runMasterPreflight(CLEAN);
    expect(result.checksRun).toBe(4);
    expect(result.checksRun).toBe(PREFLIGHT_CHECKS.length);
  });

  it("sauberes Projekt: passed=true, keine Blocker/Warnungen, Reife 100", () => {
    const result = runMasterPreflight(CLEAN);
    expect(result.passed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.readinessScore).toBe(100);
  });

  it("ungültige ISBN ist ein P0-Blocker → passed=false", () => {
    const result = runMasterPreflight(BAD_ISBN);
    expect(result.passed).toBe(false);
    const isbnBlocker = result.blockers.find((b) => b.message.includes("Ungültige ISBN"));
    expect(isbnBlocker).toBeDefined();
    expect(isbnBlocker?.severity).toBe("P0");
    expect(isbnBlocker?.check).toBe("farbmodell");
  });

  it("Zeitstempel-Kollision erzeugt P0-Blocker über master-health", () => {
    const result = runMasterPreflight(TIMESTAMP_COLLISION);
    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.check === "master-health")).toBe(true);
  });

  it("alle Blocker sind P0, alle Warnungen sind P1/P2", () => {
    const result = runMasterPreflight(BAD_ISBN);
    expect(result.blockers.every((b) => b.severity === "P0")).toBe(true);
    expect(result.warnings.every((w) => w.severity === "P1" || w.severity === "P2")).toBe(true);
  });

  it("RGB-Farbmodell erzeugt P1-Warnung im Check farbmodell", () => {
    const result = runMasterPreflight(RGB);
    expect(result.passed).toBe(true);
    const rgb = result.warnings.find(
      (w) => w.check === "farbmodell" && w.message.includes("RGB"),
    );
    expect(rgb?.severity).toBe("P1");
  });

  it("fehlender Listenpreis erzeugt P1-Warnung", () => {
    const result = runMasterPreflight(NO_PRICE);
    expect(result.passed).toBe(true);
    expect(
      result.warnings.some((w) => w.check === "farbmodell" && w.message.includes("Listenpreis")),
    ).toBe(true);
  });

  it("fehlende ISBN erzeugt P1-Warnung (nicht P0)", () => {
    const result = runMasterPreflight(NO_ISBN);
    expect(result.passed).toBe(true);
    expect(
      result.warnings.some((w) => w.check === "farbmodell" && w.message.includes("ISBN")),
    ).toBe(true);
  });

  it("erkennt Hurenkind/Schusterjunge im Check hurenkinder", () => {
    const result = runMasterPreflight(WIDOW);
    const widow = result.warnings.find((w) => w.check === "hurenkinder");
    expect(widow).toBeDefined();
    expect(widow?.severity).toBe("P1");
    expect(widow?.message).toContain("Schusterjunge");
  });

  it("meldet Typografie-Mängel (NBSP, Trennstriche, gerade Anführungszeichen)", () => {
    const result = runMasterPreflight(TYPO);
    const typo = result.warnings.filter((w) => w.check === "typografie");
    expect(typo.length).toBeGreaterThanOrEqual(2);
    expect(typo.every((w) => w.severity === "P2")).toBe(true);
  });

  it("ist deterministisch (zwei Aufrufe sind gleich)", () => {
    expect(runMasterPreflight(CLEAN)).toEqual(runMasterPreflight(CLEAN));
    expect(runMasterPreflight(TYPO)).toEqual(runMasterPreflight(TYPO));
  });

  it("defensiv: leeres Projekt wirft nicht und liefert ein Ergebnis", () => {
    const result = runMasterPreflight(EMPTY_PROJECT);
    expect(result.checksRun).toBe(4);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("defensiv: null-Projekt wirft nicht", () => {
    const result = runMasterPreflight(null as unknown as PublishingProject);
    expect(result.checksRun).toBe(4);
    expect(typeof result.passed).toBe("boolean");
  });

  it("defensiv: kaputte Kapitel-Struktur wird toleriert", () => {
    const broken = {
      title: "X",
      author: "Y",
      chapters: [null, 42, { id: 1, title: 2, content: null }],
    } as unknown as PublishingProject;
    const result = runMasterPreflight(broken);
    expect(result.checksRun).toBe(4);
  });

  it("P0-Blocker erzwingen passed=false auch bei sonst sauberem Projekt", () => {
    const result = runMasterPreflight(BAD_ISBN);
    // Reife kann > 0 sein, aber passed muss false sein.
    expect(result.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2) buildPublishingBundle
// ---------------------------------------------------------------------------

describe("buildPublishingBundle", () => {
  const preflight = runMasterPreflight(CLEAN);
  const bundle = buildPublishingBundle(CLEAN, preflight, { now: 1_700_000_000_000 });

  it("enthält die sechs erwarteten Dateien mit korrekten Kinds", () => {
    const byName = Object.fromEntries(bundle.files.map((f) => [f.name, f.kind]));
    expect(bundle.files).toHaveLength(6);
    expect(byName["manuskript-druck.html"]).toBe("pdf");
    expect(byName["buch.epub"]).toBe("epub");
    expect(byName["hoerprobe.mp3.json"]).toBe("mp3");
    expect(byName["onix-3.0.xml"]).toBe("xml");
    expect(byName["expose.html"]).toBe("html");
    expect(byName["bundle-manifest.json"]).toBe("json");
  });

  it("setzt generatedAt aus options.now (deterministisch)", () => {
    expect(bundle.generatedAt).toBe(1_700_000_000_000);
  });

  it("totalSizeBytes ist die Summe der Dateigrößen", () => {
    const sum = bundle.files.reduce((s, f) => s + f.sizeBytes, 0);
    expect(bundle.totalSizeBytes).toBe(sum);
  });

  it("jede Datei hat nicht-leeren Inhalt und positive sizeBytes", () => {
    for (const file of bundle.files) {
      expect(file.content.length).toBeGreaterThan(0);
      expect(file.sizeBytes).toBeGreaterThan(0);
    }
  });

  it("Druck-PDF-Markup enthält @page/CSS und PDF/X-1a-Hinweis", () => {
    const pdf = bundle.files.find((f) => f.kind === "pdf")!;
    expect(pdf.content).toContain("@page");
    expect(pdf.content).toContain("PDF/X-1a");
    expect(pdf.content).toContain("cmyk".toUpperCase());
    expect(pdf.content).toContain("<html");
  });

  it("EPUB-Inhalt ist XHTML mit Inhaltsverzeichnis und Glossar", () => {
    const epub = bundle.files.find((f) => f.kind === "epub")!;
    expect(epub.content).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(epub.content).toContain('epub:type="toc"');
    expect(epub.content).toContain('id="glossar"');
  });

  it("MP3-Teaser-Metadaten sind gültiges JSON mit SMIL", () => {
    const mp3 = bundle.files.find((f) => f.kind === "mp3")!;
    const parsed = JSON.parse(mp3.content);
    expect(parsed.kind).toBe("audio-teaser");
    expect(parsed.codec).toBe("mp3");
    expect(parsed.smil).toContain("<smil");
  });

  it("ONIX-XML ist wohlgeformt und enthält Titel/Autor", () => {
    const onix = bundle.files.find((f) => f.kind === "xml")!;
    expect(onix.content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(onix.content).toContain('<ONIXMessage release="3.0"');
    expect(onix.content).toContain("Der stille Zeuge");
    expect(onix.content).toContain("Anna Beispiel");
  });

  it("Exposé-HTML enthält Logline/Pitch/Synopse", () => {
    const expose = bundle.files.find((f) => f.kind === "html")!;
    expect(expose.content).toContain("Logline");
    expect(expose.content).toContain("Synopse");
    expect(expose.content).toContain("<html");
  });

  it("Manifest-JSON listet die Inhaltdateien und den Preflight-Status", () => {
    const manifest = bundle.files.find((f) => f.kind === "json")!;
    const parsed = JSON.parse(manifest.content);
    // Das Manifest beschreibt die fünf Inhaltdateien (ohne sich selbst).
    expect(parsed.fileCount).toBe(5);
    expect(parsed.files).toHaveLength(5);
    expect(parsed.preflight.passed).toBe(true);
    expect(parsed.preflight.checksRun).toBe(4);
  });

  it("ist deterministisch bei fixiertem now", () => {
    const a = buildPublishingBundle(CLEAN, preflight, { now: 42 });
    const b = buildPublishingBundle(CLEAN, preflight, { now: 42 });
    expect(a).toEqual(b);
  });

  it("defensiv: null-Projekt und null-Preflight werfen nicht", () => {
    const result = buildPublishingBundle(
      null as unknown as PublishingProject,
      null as unknown as PreflightResult,
      { now: 1 },
    );
    expect(result.files).toHaveLength(6);
    expect(result.generatedAt).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3) describeBundle
// ---------------------------------------------------------------------------

describe("describeBundle", () => {
  it("liefert eine Kopfzeile plus eine Zeile je Datei", () => {
    const preflight = runMasterPreflight(CLEAN);
    const bundle = buildPublishingBundle(CLEAN, preflight, { now: 1 });
    const lines = describeBundle(bundle);
    expect(lines).toHaveLength(bundle.files.length + 1);
    expect(lines[0]).toContain("6 Datei(en)");
    expect(lines.some((l) => l.includes("buch.epub"))).toBe(true);
  });

  it("ist deterministisch", () => {
    const bundle = buildPublishingBundle(CLEAN, runMasterPreflight(CLEAN), { now: 7 });
    expect(describeBundle(bundle)).toEqual(describeBundle(bundle));
  });

  it("defensiv: null-Bundle liefert eine Hinweiszeile", () => {
    const lines = describeBundle(null as unknown as PublishingBundle);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Kein Publishing-Bundle");
  });
});
