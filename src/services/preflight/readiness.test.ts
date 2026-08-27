// Tests: Exportbereitschaft (Ampel).

import { describe, it, expect } from "vitest";
import {
  assessReadiness,
  assessFormat,
} from "@/services/preflight/readiness";
import { exportGate } from "@/services/preflight/filter";
import type { PreflightFinding } from "@/types/preflight";

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
    ruleId: "x",
    title: `T${counter}`,
    explanation: "x",
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

describe("Ampel", () => {
  it("ist gelb, wenn noch nicht geprueft wurde", () => {
    // Entscheidend: "Nicht geprueft" darf NICHT als "gruen" erscheinen.
    // Sonst wuerde die Ampel eine Luege erzaehlen.
    const r = assessReadiness({ total: 0, blocker: 0, warning: 0, hint: 0, byCategory: {}, byFormat: {}, lastRun: null });
    expect(r.level).toBe("yellow");
    expect(r.title).toContain("gepr\u00fcft");
  });

  it("ist rot bei Blockern", () => {
    const r = assessReadiness({ total: 1, blocker: 1, warning: 0, hint: 0, byCategory: {}, byFormat: {}, lastRun: 1 });
    expect(r.level).toBe("red");
    expect(r.title).toContain("kritisch");
  });

  it("ist gelb bei Warnungen ohne Blocker", () => {
    const r = assessReadiness({ total: 2, blocker: 0, warning: 2, hint: 0, byCategory: {}, byFormat: {}, lastRun: 1 });
    expect(r.level).toBe("yellow");
  });

  it("ist gruen bei nur Hinweisen", () => {
    const r = assessReadiness({ total: 3, blocker: 0, warning: 0, hint: 3, byCategory: {}, byFormat: {}, lastRun: 1 });
    expect(r.level).toBe("green");
  });

  it("ist gruen bei leerem Bericht", () => {
    // Ein leerer Bericht (geprueft, keine Befunde) ist gruen.
    const r = assessReadiness({ total: 0, blocker: 0, warning: 0, hint: 0, byCategory: {}, byFormat: {}, lastRun: 1 });
    expect(r.level).toBe("green");
  });
});

describe("Formatampel", () => {
  it("zaehlt Blocker fuer ein Format", () => {
    const f = fnd({ severity: "blocker", affectedFormats: ["docx"] });
    const a = assessFormat([f], "docx");
    expect(a.blocker).toBe(1);
    expect(a.level).toBe("red");
  });

  it("zaehlt formatunabhaengige Befunde fuer jedes Format", () => {
    const f = fnd({ severity: "blocker", affectedFormats: [] });
    for (const fmt of ["docx", "pdf", "epub", "md", "txt"] as const) {
      expect(assessFormat([f], fmt).blocker).toBe(1);
    }
  });

  it("unterscheidet zwischen Formaten", () => {
    const f = fnd({ severity: "warning", affectedFormats: ["epub"] });
    expect(assessFormat([f], "docx").warning).toBe(0);
    expect(assessFormat([f], "epub").warning).toBe(1);
  });

  it("zaehlt entschiedene Befunde nicht", () => {
    const f = fnd({ severity: "blocker", affectedFormats: ["docx"], status: "accepted" });
    expect(assessFormat([f], "docx").blocker).toBe(0);
  });
});

describe("Export-Gate", () => {
  it("erlaubt den Export immer", () => {
    const f = fnd({ severity: "blocker" });
    expect(exportGate([f], "docx").allowed).toBe(true);
  });

  it("verlangt Bestaetigung bei Blockern", () => {
    const f = fnd({ severity: "blocker", affectedFormats: ["docx"] });
    expect(exportGate([f], "docx").needsConfirm).toBe(true);
  });

  it("verlangt keine Bestaetigung bei Warnungen", () => {
    const f = fnd({ severity: "warning" });
    expect(exportGate([f], "docx").needsConfirm).toBe(false);
  });
});
