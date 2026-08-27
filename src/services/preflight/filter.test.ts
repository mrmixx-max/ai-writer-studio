// Tests: Filterlogik, Aggregation und Export-Gate.
//
// Die Filterlogik entscheidet, welche Befunde ein Autor überhaupt sieht.
// Ein Fehler hier lässt Befunde lautlos verschwinden — deshalb ausführlich
// geprüft, insbesondere die Sonderfälle.

import { describe, it, expect } from "vitest";
import {
  applyFilter,
  computeStats,
  countByCategory,
  sortFindings,
  exportGate,
} from "@/services/preflight/filter";
import type { PreflightFinding, ExportFormat } from "@/types/preflight";

let counter = 0;

function fnd(over: Partial<PreflightFinding> = {}): PreflightFinding {
  counter++;
  return {
    id: `f${counter}`,
    reportId: "r1",
    projectId: "p1",
    chapterId: null,
    chapterTitle: null,
    category: "structure",
    severity: "warning",
    kind: "possible",
    status: "open",
    ruleId: "test.rule",
    title: `Befund ${counter}`,
    explanation: "Erklärung",
    recommendation: null,
    excerpt: null,
    structureHint: null,
    affectedFormats: [],
    charStart: null,
    charEnd: null,
    fingerprint: `fp${counter}`,
    createdAt: 0,
    ...over,
  };
}

describe("Filter: Kategorie", () => {
  it("filtert nach Kategorie", () => {
    const list = [fnd({ category: "structure" }), fnd({ category: "frontmatter" })];
    expect(applyFilter(list, { category: "structure" })).toHaveLength(1);
  });

  it("liefert ohne Kategoriefilter alles", () => {
    const list = [fnd({ category: "structure" }), fnd({ category: "format" })];
    expect(applyFilter(list, {})).toHaveLength(2);
  });
});

describe("Filter: Schweregrad", () => {
  it("zeigt mit onlyBlockers nur Blocker", () => {
    const list = [
      fnd({ severity: "blocker" }),
      fnd({ severity: "warning" }),
      fnd({ severity: "hint" }),
    ];
    const f = applyFilter(list, { onlyBlockers: true });
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("blocker");
  });
});

describe("Filter: Kapitel", () => {
  it("filtert auf ein Kapitel", () => {
    const list = [fnd({ chapterId: "a" }), fnd({ chapterId: "b" }), fnd({ chapterId: null })];
    const f = applyFilter(list, { chapterId: "a" });
    expect(f).toHaveLength(1);
    expect(f[0].chapterId).toBe("a");
  });

  it("zeigt mit chapterId null nur projektweite Befunde", () => {
    // Wichtiger Unterschied: null heißt ausdrücklich "nur projektweit",
    // undefined heißt "kein Kapitelfilter".
    const list = [fnd({ chapterId: "a" }), fnd({ chapterId: null })];
    const f = applyFilter(list, { chapterId: null });
    expect(f).toHaveLength(1);
    expect(f[0].chapterId).toBeNull();
  });

  it("ignoriert einen fehlenden Kapitelfilter", () => {
    const list = [fnd({ chapterId: "a" }), fnd({ chapterId: null })];
    expect(applyFilter(list, {})).toHaveLength(2);
  });
});

describe("Filter: Format", () => {
  it("filtert auf ein Format", () => {
    const list = [
      fnd({ affectedFormats: ["docx"] }),
      fnd({ affectedFormats: ["epub"] }),
    ];
    const f = applyFilter(list, { format: "docx" });
    expect(f).toHaveLength(1);
  });

  it("zeigt formatunabhängige Befunde bei jedem Formatfilter", () => {
    // Entscheidend: Ein Strukturbefund ohne Formatbindung gilt für alle
    // Formate. Würde er beim Filtern auf DOCX verschwinden, fehlten dem
    // Autor genau die wichtigsten Befunde.
    const list = [
      fnd({ affectedFormats: [] }),
      fnd({ affectedFormats: ["epub"] }),
    ];
    const f = applyFilter(list, { format: "docx" });
    expect(f).toHaveLength(1);
    expect(f[0].affectedFormats).toEqual([]);
  });

  it("berücksichtigt Befunde mit mehreren Formaten", () => {
    const list = [fnd({ affectedFormats: ["docx", "epub", "pdf"] })];
    expect(applyFilter(list, { format: "epub" })).toHaveLength(1);
    expect(applyFilter(list, { format: "md" })).toHaveLength(0);
  });
});

describe("Filter: erledigte Befunde", () => {
  it("blendet erledigte standardmäßig aus", () => {
    const list = [
      fnd({ status: "open" }),
      fnd({ status: "ignored" }),
      fnd({ status: "accepted" }),
    ];
    expect(applyFilter(list, {})).toHaveLength(1);
  });

  it("zeigt sie mit includeResolved", () => {
    const list = [fnd({ status: "open" }), fnd({ status: "ignored" })];
    expect(applyFilter(list, { includeResolved: true })).toHaveLength(2);
  });
});

describe("Filter: Kombination", () => {
  it("verknüpft alle Bedingungen mit UND", () => {
    const list = [
      fnd({ category: "format", severity: "blocker", chapterId: "a", affectedFormats: ["docx"] }),
      fnd({ category: "format", severity: "warning", chapterId: "a", affectedFormats: ["docx"] }),
      fnd({ category: "structure", severity: "blocker", chapterId: "a", affectedFormats: ["docx"] }),
      fnd({ category: "format", severity: "blocker", chapterId: "b", affectedFormats: ["docx"] }),
    ];
    const f = applyFilter(list, {
      category: "format",
      onlyBlockers: true,
      chapterId: "a",
      format: "docx",
    });
    expect(f).toHaveLength(1);
  });

  it("kann auf null Treffer filtern, ohne zu werfen", () => {
    const list = [fnd({ severity: "hint" })];
    expect(applyFilter(list, { onlyBlockers: true })).toHaveLength(0);
  });
});

describe("Aggregation", () => {
  it("zählt nach Schweregrad", () => {
    const list = [
      fnd({ severity: "blocker" }),
      fnd({ severity: "blocker" }),
      fnd({ severity: "warning" }),
      fnd({ severity: "hint" }),
    ];
    const s = computeStats(list);
    expect(s.blocker).toBe(2);
    expect(s.warning).toBe(1);
    expect(s.hint).toBe(1);
    expect(s.total).toBe(4);
  });

  it("zählt erledigte Befunde nicht mit", () => {
    // Sonst wirkt das Manuskript schlechter als es ist.
    const list = [fnd({ status: "open" }), fnd({ status: "ignored" })];
    expect(computeStats(list).total).toBe(1);
  });

  it("zählt nach Kategorie", () => {
    const list = [
      fnd({ category: "structure" }),
      fnd({ category: "structure" }),
      fnd({ category: "frontmatter" }),
    ];
    const s = computeStats(list);
    expect(s.byCategory.structure).toBe(2);
    expect(s.byCategory.frontmatter).toBe(1);
  });

  it("rechnet formatunabhängige Befunde auf jedes Format", () => {
    // Die Formatübersicht darf nicht lügen: Ein Strukturbefund betrifft
    // jeden Export.
    const s = computeStats([fnd({ affectedFormats: [] })]);
    for (const fmt of ["docx", "pdf", "epub", "md", "txt"] as ExportFormat[]) {
      expect(s.byFormat[fmt]).toBe(1);
    }
  });

  it("übernimmt den Zeitpunkt des letzten Laufs", () => {
    expect(computeStats([], 1234).lastRun).toBe(1234);
  });

  it("liefert bei leerer Liste Nullen ohne NaN", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(Object.keys(s.byCategory)).toHaveLength(0);
  });

  it("zählt offene Befunde je Kategorie", () => {
    const list = [
      fnd({ category: "structure", status: "open" }),
      fnd({ category: "structure", status: "ignored" }),
      fnd({ category: "format", status: "open" }),
    ];
    expect(countByCategory(list, "structure")).toBe(1);
    expect(countByCategory(list, "format")).toBe(1);
  });
});

describe("Sortierung", () => {
  it("stellt Blocker nach vorn", () => {
    const list = [
      fnd({ severity: "hint" }),
      fnd({ severity: "blocker" }),
      fnd({ severity: "warning" }),
    ];
    const s = sortFindings(list);
    expect(s.map((f) => f.severity)).toEqual(["blocker", "warning", "hint"]);
  });

  it("ist stabil zwischen Läufen", () => {
    // Sonst springt die Liste bei jedem Prüflauf durcheinander.
    const list = [
      fnd({ severity: "warning", category: "structure", title: "B" }),
      fnd({ severity: "warning", category: "structure", title: "A" }),
      fnd({ severity: "warning", category: "format", title: "C" }),
    ];
    const first = sortFindings(list).map((f) => f.title);
    const second = sortFindings([...list].reverse()).map((f) => f.title);
    expect(first).toEqual(second);
  });

  it("verändert die Eingabeliste nicht", () => {
    const list = [fnd({ severity: "hint" }), fnd({ severity: "blocker" })];
    const before = list.map((f) => f.id);
    sortFindings(list);
    expect(list.map((f) => f.id)).toEqual(before);
  });
});

describe("Export-Gate", () => {
  it("verlangt Bestätigung bei Blockern", () => {
    const list = [fnd({ severity: "blocker", affectedFormats: ["docx"] })];
    const g = exportGate(list, "docx");
    expect(g.needsConfirm).toBe(true);
    expect(g.blockers).toHaveLength(1);
  });

  it("erlaubt den Export immer", () => {
    // Deine Anforderung: Export trotzdem erlauben, aber mit Bestätigung.
    // Ein Werkzeug, das den Nutzer aussperrt, wird umgangen statt benutzt.
    const list = [fnd({ severity: "blocker" })];
    expect(exportGate(list, "docx").allowed).toBe(true);
  });

  it("verlangt bei Warnungen keine Bestätigung", () => {
    const list = [fnd({ severity: "warning" }), fnd({ severity: "hint" })];
    const g = exportGate(list, "docx");
    expect(g.needsConfirm).toBe(false);
    expect(g.warnings).toBe(1);
  });

  it("ignoriert entschiedene Befunde", () => {
    // Der Autor hat entschieden — kein erneutes Nachfragen.
    const list = [
      fnd({ severity: "blocker", status: "accepted" }),
      fnd({ severity: "blocker", status: "ignored" }),
    ];
    expect(exportGate(list, "docx").needsConfirm).toBe(false);
  });

  it("berücksichtigt nur Befunde des Zielformats", () => {
    const list = [fnd({ severity: "blocker", affectedFormats: ["epub"] })];
    expect(exportGate(list, "docx").needsConfirm).toBe(false);
    expect(exportGate(list, "epub").needsConfirm).toBe(true);
  });

  it("zählt formatunabhängige Blocker für jedes Format", () => {
    const list = [fnd({ severity: "blocker", affectedFormats: [] })];
    for (const fmt of ["docx", "pdf", "epub", "md", "txt"] as ExportFormat[]) {
      expect(exportGate(list, fmt).needsConfirm).toBe(true);
    }
  });
});
