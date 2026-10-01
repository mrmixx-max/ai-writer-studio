// Tests für den Typografie-Preflight (WP 8.1).
//
// Kernaussage: Die Typografie-Prüfung ist lokal, deterministisch und defensiv.
// Sie findet gemischte Anführungszeichen, falsche Striche und mögliche
// Schusterjungen/Hurenkinder.

import { describe, it, expect } from "vitest";
import {
  ruleQuotationMarks,
  ruleDashes,
  ruleWidowsAndOrphans,
  TYPOGRAPHY_RULES,
} from "./rules-typography";
import type { PreflightInput } from "./rules-base";

function makeInput(chapters: { id: string; title: string; text: string }[]): PreflightInput {
  return {
    projectId: "p1",
    projectName: "Test",
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.title,
      text: c.text,
      raw: "",
      orderIndex: 0,
      wordCount: c.text.split(/\s+/).filter(Boolean).length,
    })),
    formats: ["docx"],
    checkFrontmatter: false,
    checkBackmatter: false,
  };
}

describe("ruleQuotationMarks", () => {
  it("findet gemischte Anführungszeichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: 'Er sagte „Hallo" und dann "Wie geht es?"',
      },
    ]);
    const findings = ruleQuotationMarks(input);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("typography.mixed-quotes");
  });

  it("findet keine Befunde bei konsistenten deutschen Anführungszeichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: 'Er sagte „Hallo" und sie antwortete „Wie geht es?"',
      },
    ]);
    const findings = ruleQuotationMarks(input);
    expect(findings).toHaveLength(0);
  });

  it("findet keine Befunde bei konsistenten englischen Anführungszeichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: 'Er sagte "Hallo" und sie antwortete "Wie geht es?"',
      },
    ]);
    const findings = ruleQuotationMarks(input);
    expect(findings).toHaveLength(0);
  });

  it("ignoriert Kapitel mit weniger als 2 Anführungszeichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: 'Er sagte „Hallo".',
      },
    ]);
    const findings = ruleQuotationMarks(input);
    expect(findings).toHaveLength(0);
  });

  it("ignoriert leere Kapitel", () => {
    const input = makeInput([{ id: "ch1", title: "Kapitel 1", text: "" }]);
    const findings = ruleQuotationMarks(input);
    expect(findings).toHaveLength(0);
  });
});

describe("ruleDashes", () => {
  it("findet gemischte Striche", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "Er kam – und ging wieder. Sie sagte - und schwieg.",
      },
    ]);
    const findings = ruleDashes(input);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("typography.mixed-dashes");
  });

  it("findet keine Befunde bei konsistenten Gedankenstrichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "Er kam – und ging wieder. Sie sagte – und schwieg.",
      },
    ]);
    const findings = ruleDashes(input);
    expect(findings).toHaveLength(0);
  });

  it("findet keine Befunde bei nur einfachen Bindestrichen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "E-Mail ist wichtig. zurück-kommen ist falsch.",
      },
    ]);
    const findings = ruleDashes(input);
    expect(findings).toHaveLength(0);
  });
});

describe("ruleWidowsAndOrphans", () => {
  it("findet möglichen Schusterjungen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "Dies ist ein längerer Absatz mit vielen Worten.\n\nDies ist auch ein längerer Absatz.\n\nNur",
      },
    ]);
    const findings = ruleWidowsAndOrphans(input);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].ruleId).toBe("typography.possible-widow");
  });

  it("findet mögliches Hurenkind", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "Nur\n\nDies ist ein längerer Absatz mit vielen Worten.\n\nDies ist auch ein längerer Absatz.",
      },
    ]);
    const findings = ruleWidowsAndOrphans(input);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].ruleId).toBe("typography.possible-orphan");
  });

  it("findet keine Befunde bei ausgewogenen Absätzen", () => {
    const input = makeInput([
      {
        id: "ch1",
        title: "Kapitel 1",
        text: "Dies ist ein längerer Absatz mit vielen Worten.\n\nDies ist auch ein längerer Absatz mit vielen Worten.\n\nUnd noch ein längerer Absatz.",
      },
    ]);
    const findings = ruleWidowsAndOrphans(input);
    expect(findings).toHaveLength(0);
  });

  it("ignoriert kurze Texte", () => {
    const input = makeInput([{ id: "ch1", title: "Kapitel 1", text: "Kurz." }]);
    const findings = ruleWidowsAndOrphans(input);
    expect(findings).toHaveLength(0);
  });
});

describe("TYPOGRAPHY_RULES", () => {
  it("enthält alle Typografie-Regeln", () => {
    expect(TYPOGRAPHY_RULES).toHaveLength(3);
    expect(TYPOGRAPHY_RULES.map((r) => r.name)).toContain("ruleQuotationMarks");
    expect(TYPOGRAPHY_RULES.map((r) => r.name)).toContain("ruleDashes");
    expect(TYPOGRAPHY_RULES.map((r) => r.name)).toContain("ruleWidowsAndOrphans");
  });
});
