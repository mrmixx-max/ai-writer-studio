// Unit-Tests: Export-Gate (C3) — Export nur bei draft/completed,
// needs_revision-Warnung listet betroffene Kapitel.
import { describe, it, expect } from "vitest";
import { checkExportGate, formatNeedsRevisionWarning } from "./gate";
import { makeTestBook } from "../testbook";

describe("checkExportGate", () => {
  it("Testbuch: erlaubt Export, warnt vor Kapitel 4 und 7", () => {
    const book = makeTestBook();
    const gate = checkExportGate(book.chapters);
    expect(gate.allowed).toBe(true);
    expect(gate.needsRevision.map((c) => c.number)).toEqual([4, 7]);
    expect(gate.needsRevision.map((c) => c.title)).toEqual([
      "Sprachmodelle",
      "Ethik und Gesellschaft",
    ]);
    expect(gate.blocking).toEqual([]);
  });

  it("planned/generating blockieren den Export", () => {
    const gate = checkExportGate([
      { number: 1, title: "A", content: "{}", status: "draft" },
      { number: 2, title: "B", content: "{}", status: "planned" },
      { number: 3, title: "C", content: "{}", status: "generating" },
    ]);
    expect(gate.allowed).toBe(false);
    expect(gate.blocking.map((c) => c.number)).toEqual([2, 3]);
  });

  it("nur completed/draft → kein Hinweis", () => {
    const gate = checkExportGate([
      { number: 1, title: "A", content: "{}", status: "completed" },
      { number: 2, title: "B", content: "{}", status: "draft" },
    ]);
    expect(gate.allowed).toBe(true);
    expect(gate.needsRevision).toEqual([]);
  });

  it("Warnung listet Kapitel mit Nummer und Titel", () => {
    const warn = formatNeedsRevisionWarning([
      { number: 4, title: "Sprachmodelle" },
      { number: 7, title: "Ethik und Gesellschaft" },
    ]);
    expect(warn).toContain("Kapitel 4: Sprachmodelle");
    expect(warn).toContain("Kapitel 7: Ethik und Gesellschaft");
    expect(warn).toContain("2");
  });
});