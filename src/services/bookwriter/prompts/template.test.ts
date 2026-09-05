// Tests: Minimale Handlebars-Template-Engine (Sprint 6, Agent 2).
//
// Deckt ab: Variablen, Pfad-Zugriff, this/@index/@index1/@first/@last,
// #if/#else/#unless/#each, Fehlfälle (offene Blöcke), Truthiness-Regeln
// und Handlebars-Konformität (fehlende Variablen → leerer String, 0 ist
// truthy, kein HTML-Escaping).

import { describe, it, expect } from "vitest";
import { renderTemplate, isTruthy } from "./template";

describe("renderTemplate — Variablen", () => {
  it("substituiert einfache Variablen", () => {
    expect(renderTemplate("Hallo {{name}}!", { name: "Welt" })).toBe("Hallo Welt!");
  });

  it("rendert fehlende Variablen als leeren String (Handlebars-Verhalten)", () => {
    expect(renderTemplate("a{{missing}}b")).toBe("ab");
  });

  it("rendert null/undefined als leer, 0 als \"0\", false als \"false\"", () => {
    expect(renderTemplate("[{{n}}]", { n: 0 })).toBe("[0]");
    expect(renderTemplate("[{{b}}]", { b: false })).toBe("[false]");
    expect(renderTemplate("[{{n}}]", { n: null })).toBe("[]");
  });

  it("unterstuetzt Pfad-Zugriff", () => {
    expect(
      renderTemplate("{{briefing.targetAudience}}", { briefing: { targetAudience: "DevOps" } }),
    ).toBe("DevOps");
    const res = renderTemplate("{{a.b.c}}", { a: { b: { c: "tief" } } });
    expect(res).toBe("tief");
  });

  it("bricht bei null im Pfad nicht", () => {
    expect(renderTemplate("{{a.b}}", { a: null })).toBe("");
    expect(renderTemplate("{{a.b}}", {})).toBe("");
  });
});

describe("renderTemplate — Handlebars-Blöcke", () => {
  it("{{#each}} mit {{this}}", () => {
    expect(
      renderTemplate("{{#each xs}}- {{this}}\n{{/each}}", { xs: ["a", "b"] }),
    ).toBe("- a\n- b\n");
  });

  it("{{#each}} Metadaten @index (0-basiert) und @index1 (1-basiert)", () => {
    const res = renderTemplate(
      "{{#each xs}}{{@index}}:{{@index1}} {{/each}}",
      { xs: ["a", "b", "c"] },
    );
    expect(res).toBe("0:1 1:2 2:3 ");
  });

  it("{{#each}} @first/@last (Komma-Separierung via unless)", () => {
    const res = renderTemplate(
      "[{{#each xs}}{{#unless @first}},{{/unless}}{{this}}{{/each}}]",
      { xs: ["a", "b", "c"] },
    );
    expect(res).toBe("[a,b,c]");
  });

  it("{{#each}} über leere Liste rendert nichts", () => {
    expect(renderTemplate("x{{#each xs}}y{{/each}}z", { xs: [] })).toBe("xz");
    expect(renderTemplate("x{{#each xs}}y{{/each}}z", {})).toBe("xz");
  });

  it("{{#if}} mit {{else}}", () => {
    expect(renderTemplate("{{#if ja}}an{{else}}aus{{/if}}", { ja: true })).toBe("an");
    expect(renderTemplate("{{#if ja}}an{{else}}aus{{/if}}", { ja: false })).toBe("aus");
    expect(renderTemplate("{{#if ja}}an{{else}}aus{{/if}}", {})).toBe("aus");
  });

  it("{{#unless}} rendert nur bei Falsy", () => {
    expect(renderTemplate("{{#unless nein}}sichtbar{{/unless}}", { nein: false })).toBe("sichtbar");
    expect(renderTemplate("{{#unless nein}}sichtbar{{/unless}}", { nein: "x" })).toBe("");
  });

  it("geschachtelte each/if-Kombination", () => {
    const res = renderTemplate(
      "{{#each xs}}{{#if this}}J{{else}}N{{/if}}{{/each}}",
      { xs: ["a", "", "c"] },
    );
    expect(res).toBe("JNJ");
  });

  it("innerer each-Scope verdeckt äußere Variablen nicht", () => {
    expect(
      renderTemplate("{{#each xs}}{{g}}:{{this}};{{/each}}", { xs: [1, 2], g: "N" }),
    ).toBe("N:1;N:2;");
  });
});

describe("renderTemplate — Truthiness", () => {
  it("isTruthy folgt Handlebars: 0 truthy, '' falsy, [] falsy", () => {
    expect(isTruthy(0)).toBe(true);
    expect(isTruthy("0")).toBe(true);
    expect(isTruthy("")).toBe(false);
    expect(isTruthy([])).toBe(false);
    expect(isTruthy([1])).toBe(true);
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy("false")).toBe(true);
  });

  it("{{#if 0}} ist truthy (Handlebars-Konvention)", () => {
    expect(renderTemplate("{{#if n}}ja{{/if}}", { n: 0 })).toBe("ja");
  });
});

describe("renderTemplate — kein HTML-Escaping", () => {
  it("rendert Werte roh (Prompts sind Klartext)", () => {
    expect(renderTemplate("{{x}}", { x: '<b>&"' })).toBe('<b>&"');
  });
});

describe("renderTemplate — Fehlerfälle", () => {
  it("{{#if}} ohne {{/if}} wirft", () => {
    expect(() => renderTemplate("{{#if x}}offen")).toThrow();
  });

  it("{{else}} ohne {{#if}} wirft", () => {
    expect(() => renderTemplate("{{else}}")).toThrow();
  });

  it("{{/each}} ohne {{#each}} wirft", () => {
    expect(() => renderTemplate("{{/each}}")).toThrow();
  });
});

describe("isTruthy — Export", () => {
  it("ist exportiert und stabil", () => {
    expect(typeof isTruthy).toBe("function");
  });
});
