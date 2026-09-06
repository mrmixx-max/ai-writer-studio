// Sprint 12, Agent 3: Tests fuer die Prompt-Template-Library (NEUE Datei).
// Deckt ab: Rendering, Validierungsfehler, Registry-Vollstaendigkeit
// (alle 23 Genres: eigenes Basis-Template oder expliziter Fallback),
// Fallback-Verhalten, Strict-Modus und die injizierbare Complete-Funktion.
// Keine LLM-Calls: runTemplateTask bekommt eine stub-complete-Funktion.

import { describe, it, expect } from "vitest";
import {
  CHAPTER_TEMPLATE,
  FALLBACK_SYSTEM_TEMPLATE,
  GENRE_FOCUS,
  OUTLINE_TEMPLATE,
  REVISE_TEMPLATE,
  SYSTEM_TEMPLATES,
  TEMPLATE_REGISTRY,
  extractVariables,
  genreCoverage,
  getTemplate,
  hasGenreTemplate,
  listTemplateIds,
  renderPromptTemplate,
  renderTask,
  resolveTemplate,
  runTemplateTask,
  validateVars,
} from "./templates";
import { listGenres } from "../bookwriter/prompts/library";

describe("extractVariables", () => {
  it("findet einfache Variablen", () => {
    expect(extractVariables("Hallo {{name}}, {{count}}x!")).toEqual(["count", "name"]);
  });

  it("ignoriert Block-Helper, this und @-Metadaten", () => {
    const vars = extractVariables(
      "{{#if cond}}ja{{else}}nein{{/if}}{{#each xs}}{{this}}{{@index}}{{/each}}",
    );
    expect(vars).toEqual([]);
  });

  it("nimmt bei Pfaden den Kopf", () => {
    expect(extractVariables("{{briefing.tone}}")).toEqual(["briefing"]);
  });
});

describe("renderPromptTemplate", () => {
  it("substituiert Chapter-Variablen", () => {
    const out = renderPromptTemplate(CHAPTER_TEMPLATE, {
      chapterTitle: "Ankunft",
      bookTitle: "Testbuch",
      chapterGoal: "Einfuehrung",
      tone: "spannend",
      wordCount: 1200,
    });
    expect(out).toContain("Ankunft");
    expect(out).toContain("Testbuch");
    expect(out).toContain("1200");
    expect(out).not.toContain("{{");
  });

  it("nicht-strict: fehlende Vars rendern leer (Handlebars-Verhalten)", () => {
    const out = renderPromptTemplate(CHAPTER_TEMPLATE, {
      chapterTitle: "X",
      bookTitle: "Y",
      chapterGoal: "Z",
      tone: "neutral",
      wordCount: 500,
    });
    expect(out).not.toContain("{{");
    expect(out).not.toContain("previousSummary");
  });

  it("optionale Vars werden bei Belegung eingesetzt", () => {
    const out = renderPromptTemplate(CHAPTER_TEMPLATE, {
      chapterTitle: "X",
      bookTitle: "Y",
      chapterGoal: "Z",
      tone: "neutral",
      wordCount: 500,
      previousSummary: "Held reist ab",
    });
    expect(out).toContain("Held reist ab");
  });

  it("strict: fehlende requiredVars werfen", () => {
    expect(() =>
      renderPromptTemplate(CHAPTER_TEMPLATE, { chapterTitle: "X" }, { strict: true }),
    ).toThrow(/Fehlende Variablen/);
  });
});

describe("validateVars", () => {
  it("meldet fehlende requiredVars", () => {
    const check = validateVars(OUTLINE_TEMPLATE, { genre: "krimi" });
    expect(check.valid).toBe(false);
    expect(check.missing).toContain("idea");
    expect(check.missing).toContain("targetAudience");
  });

  it("meldet unbekannte Variablen", () => {
    const check = validateVars(REVISE_TEMPLATE, {
      draftText: "d",
      instructions: "i",
      tone: "t",
      humbugVariable: 1,
    });
    expect(check.missing).toEqual([]);
    expect(check.unknown).toEqual(["humbugVariable"]);
    expect(check.valid).toBe(false);
  });

  it("vollstaendige Belegung ist valide", () => {
    const check = validateVars(REVISE_TEMPLATE, {
      draftText: "d",
      instructions: "i",
      tone: "t",
      keepPassages: "k",
    });
    expect(check).toEqual({ missing: [], unknown: [], valid: true });
  });
});

describe("Registry und Genre-Abdeckung", () => {
  it("alle 23 Genres haben ein Basis-Template oder expliziten Fallback", () => {
    const genres = listGenres();
    expect(genres.length).toBe(23);
    for (const genre of genres) {
      const tpl = resolveTemplate("system", genre);
      expect(tpl.task).toBe("system");
      expect([`system:${genre}`, FALLBACK_SYSTEM_TEMPLATE.id]).toContain(tpl.id);
    }
  });

  it("genreCoverage meldet alle Genres als abgedeckt", () => {
    const coverage = genreCoverage();
    expect(coverage.length).toBe(23);
    expect(coverage.every((c) => c.covered)).toBe(true);
  });

  it("GENRE_FOCUS deckt exakt die Library-Genres ab", () => {
    expect(new Set(Object.keys(GENRE_FOCUS))).toEqual(new Set(listGenres()));
  });

  it("unbekanntes Genre faellt auf Fallback zurueck (kein Throw)", () => {
    const tpl = resolveTemplate("system", "gibt-es-nicht");
    expect(tpl.id).toBe(FALLBACK_SYSTEM_TEMPLATE.id);
  });

  it("System-Templates unterscheiden sich je Genre", () => {
    const a = renderTask("system", { tone: "x", language: "de" }, "krimi");
    const b = renderTask("system", { tone: "x", language: "de" }, "lyrik");
    expect(a).not.toBe(b);
  });

  it("Template-IDs sind eindeutig", () => {
    const ids = listTemplateIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(TEMPLATE_REGISTRY.length);
  });

  it("getTemplate wirft bei unbekannter ID", () => {
    expect(() => getTemplate("nonsense:id")).toThrow(/Unbekanntes Prompt-Template/);
  });

  it("hasGenreTemplate: bekannt true, unbekannt false", () => {
    expect(hasGenreTemplate("horror")).toBe(true);
    expect(hasGenreTemplate("unbekannt")).toBe(false);
  });
});

describe("Task-Templates", () => {
  it("outline enthaelt Kapitelzahl-Variablen", () => {
    const out = renderTask(
      "outline",
      {
        genre: "scifi",
        idea: "Marsstation",
        targetAudience: "Jugendliche",
        tone: "spannend",
        chapterCount: 12,
        wordsPerChapter: 2000,
      },
    );
    expect(out).toContain("12");
    expect(out).toContain("2000");
    expect(out).toContain("Marsstation");
  });

  it("revise enthaelt Entwurf und Anweisungen", () => {
    const out = renderTask("revise", {
      draftText: "Rohentwurf hier",
      instructions: "kuerzen",
      tone: "sachlich",
    });
    expect(out).toContain("Rohentwurf hier");
    expect(out).toContain("kuerzen");
  });

  it("chapter ist genre-unabhaengig (Fallback pro Task)", () => {
    expect(resolveTemplate("chapter", "krimi").id).toBe(CHAPTER_TEMPLATE.id);
    expect(resolveTemplate("outline", null).id).toBe(OUTLINE_TEMPLATE.id);
    expect(resolveTemplate("revise", undefined).id).toBe(REVISE_TEMPLATE.id);
    expect(SYSTEM_TEMPLATES.length).toBe(23);
  });
});

describe("runTemplateTask (injizierte Complete-Funktion, kein LLM-Call)", () => {
  it("ruft complete mit gerendertem Prompt auf", async () => {
    let seen = "";
    const result = await runTemplateTask(
      "revise",
      { draftText: "d", instructions: "i", tone: "t" },
      async (prompt: string) => {
        seen = prompt;
        return `done:${prompt.length > 10}`;
      },
    );
    expect(seen).toContain("d");
    expect(result).toBe("done:true");
  });

  it("wirft bei fehlenden Vars (strict), ohne complete aufzurufen", async () => {
    let called = false;
    await expect(
      runTemplateTask("chapter", {}, async () => {
        called = true;
        return "";
      }),
    ).rejects.toThrow(/Fehlende Variablen/);
    expect(called).toBe(false);
  });
});
