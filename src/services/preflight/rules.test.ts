// Tests: Preflight-Regelwerk.
//
// Zwei Prüfrichtungen, beide gleich wichtig:
//   1. Findet die Regel den Mangel?
//   2. Schweigt sie bei einwandfreiem Manuskript?
// Ein Preflight, das bei jedem Kapitel meckert, wird übergangen — und dann
// fällt der eine echte Blocker auch nicht mehr auf.

import { describe, it, expect } from "vitest";
import type { ChapterInput, PreflightInput } from "@/services/preflight/rules-base";
import { fingerprint, describeChar } from "@/services/preflight/rules-base";
import {
  ruleNoChapters,
  ruleEmptyChapters,
  ruleUntitledChapters,
  ruleDuplicateTitles,
  ruleHeadingHierarchy,
  ruleShortChapters,
  ruleLongChapters,
  ruleBlankLines,
  ruleSceneBreaks,
  ruleHardBreaks,
} from "@/services/preflight/rules-structure";
import type { ExportFormat } from "@/types/preflight";

/** Baut ein TipTap-Dokument. */
function doc(nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

function para(text: string): unknown {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function heading(level: number, text: string): unknown {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function chapter(over: Partial<ChapterInput> = {}): ChapterInput {
  const text = over.text ?? "Ein Kapitel mit ausreichend Text darin für die Prüfung.";
  return {
    id: over.id ?? "c1",
    title: over.title ?? "Kapitel 1: Der Fund",
    text,
    raw: over.raw ?? doc([para(text)]),
    orderIndex: over.orderIndex ?? 0,
    wordCount: over.wordCount ?? (text.match(/[\p{L}\p{N}]+/gu) ?? []).length,
    ...over,
  };
}

function input(chapters: ChapterInput[], over: Partial<PreflightInput> = {}): PreflightInput {
  return {
    projectId: "p1",
    projectName: "Testprojekt",
    chapters,
    formats: ["docx", "pdf", "epub", "md", "txt"] as ExportFormat[],
    checkFrontmatter: false,
    checkBackmatter: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------

describe("Grundlagen", () => {
  it("bildet den Fingerabdruck ohne Position", () => {
    // Verschiebt sich der Text, muss der Fingerabdruck gleich bleiben —
    // sonst verliert der Autor seine Entscheidung.
    const base = {
      ruleId: "structure.empty-chapter",
      category: "structure" as const,
      severity: "blocker" as const,
      kind: "error" as const,
      title: "Kapitel leer",
      explanation: "x",
      recommendation: null,
      excerpt: null,
      structureHint: null,
      affectedFormats: [],
      chapterId: "c1",
    };
    const a = fingerprint({ ...base, charStart: 100, charEnd: 110 });
    const b = fingerprint({ ...base, charStart: 5000, charEnd: 5010 });
    expect(a).toBe(b);
  });

  it("unterscheidet Befunde verschiedener Regeln", () => {
    const base = {
      category: "structure" as const,
      severity: "warning" as const,
      kind: "possible" as const,
      explanation: "x",
      recommendation: null,
      excerpt: null,
      structureHint: null,
      affectedFormats: [],
      chapterId: "c1",
      charStart: null,
      charEnd: null,
    };
    const a = fingerprint({ ...base, ruleId: "r1", title: "T" });
    const b = fingerprint({ ...base, ruleId: "r2", title: "T" });
    expect(a).not.toBe(b);
  });

  it("benennt unsichtbare Zeichen verständlich", () => {
    expect(describeChar("\u00a0")).toContain("geschütztes Leerzeichen");
    expect(describeChar("\u200b")).toContain("Nullbreiten");
    // Unbekannte Zeichen bekommen wenigstens den Codepunkt.
    expect(describeChar("\u0001")).toContain("U+0001");
  });
});

describe("Struktur: Kapitel", () => {
  it("meldet ein Projekt ohne Kapitel als Blocker", () => {
    const f = ruleNoChapters(input([]));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("blocker");
    expect(f[0].kind).toBe("error");
  });

  it("schweigt bei vorhandenen Kapiteln", () => {
    expect(ruleNoChapters(input([chapter()]))).toHaveLength(0);
  });

  it("meldet leere Kapitel als Blocker mit Strukturhinweis", () => {
    const f = ruleEmptyChapters(input([chapter({ text: "   ", wordCount: 0 })]));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("blocker");
    expect(f[0].structureHint).toContain("0 Wörter");
    expect(f[0].chapterId).toBe("c1");
  });

  it("meldet Platzhaltertitel", () => {
    const cases = ["Neues Kapitel", "Kapitel 3", "Unbenannt", "ohne Titel", ""];
    for (const title of cases) {
      const f = ruleUntitledChapters(input([chapter({ title })]));
      expect(f, `Titel "${title}" sollte gemeldet werden`).toHaveLength(1);
    }
  });

  it("schweigt bei echten Titeln", () => {
    const f = ruleUntitledChapters(input([chapter({ title: "Der Novemberbrief" })]));
    expect(f).toHaveLength(0);
  });

  it("meldet doppelte Überschriften mit allen betroffenen Kapiteln", () => {
    const f = ruleDuplicateTitles(
      input([
        chapter({ id: "a", title: "Der Fund", orderIndex: 0 }),
        chapter({ id: "b", title: "Der Fund", orderIndex: 4 }),
      ]),
    );
    expect(f).toHaveLength(1);
    expect(f[0].title).toContain("2×");
    expect(f[0].structureHint).toContain("1, 5");
  });

  it("unterscheidet Titel nur nach Inhalt, nicht nach Schreibweise", () => {
    const f = ruleDuplicateTitles(
      input([chapter({ id: "a", title: "Der Fund" }), chapter({ id: "b", title: "DER FUND" })]),
    );
    expect(f).toHaveLength(1);
  });
});

describe("Struktur: Überschriftenhierarchie", () => {
  it("meldet übersprungene Ebenen", () => {
    const raw = doc([heading(2, "Oben"), para("Text"), heading(4, "Zu tief")]);
    const f = ruleHeadingHierarchy(input([chapter({ raw })]));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("2 → 4");
    expect(f[0].affectedFormats).toContain("epub");
  });

  it("schweigt bei korrekter Abfolge", () => {
    const raw = doc([heading(1, "A"), heading(2, "B"), heading(3, "C"), heading(2, "D")]);
    expect(ruleHeadingHierarchy(input([chapter({ raw })]))).toHaveLength(0);
  });

  it("wirft bei ungültigem JSON nicht", () => {
    expect(() => ruleHeadingHierarchy(input([chapter({ raw: "kein json" })]))).not.toThrow();
  });
});

describe("Struktur: Kapitellänge", () => {
  it("meldet sehr kurze Kapitel", () => {
    const f = ruleShortChapters(
      input([chapter({ id: "a", wordCount: 120 }), chapter({ id: "b", wordCount: 3000 })]),
    );
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("hint");
  });

  it("meldet Kürze bei einem Einzelkapitel nicht", () => {
    // Ein Projekt mit einem Kapitel ist kein Roman mit zu kurzem Kapitel.
    expect(ruleShortChapters(input([chapter({ wordCount: 100 })]))).toHaveLength(0);
  });

  it("meldet sehr lange Kapitel für EPUB", () => {
    const f = ruleLongChapters(input([chapter({ wordCount: 20000 })]));
    expect(f).toHaveLength(1);
    expect(f[0].affectedFormats).toEqual(["epub"]);
  });

  it("schweigt bei normaler Länge", () => {
    const f = ruleLongChapters(input([chapter({ wordCount: 4000 })]));
    expect(f).toHaveLength(0);
  });
});

describe("Struktur: Leerzeilen und Trenner", () => {
  it("meldet mehrfache Leerzeilen mit Position", () => {
    const text = "Erster Absatz.\n\n\n\nZweiter Absatz.";
    const f = ruleBlankLines(input([chapter({ text })]));
    expect(f).toHaveLength(1);
    expect(f[0].charStart).toBeTypeOf("number");
    expect(f[0].excerpt).toBeTruthy();
  });

  it("schweigt bei einfacher Absatztrennung", () => {
    const text = "Erster Absatz.\n\nZweiter Absatz.\n\nDritter.";
    expect(ruleBlankLines(input([chapter({ text })]))).toHaveLength(0);
  });

  it("meldet gemischte Szenentrenner", () => {
    const a = chapter({ id: "a", text: "Text.\n\n* * *\n\nMehr Text." });
    const b = chapter({ id: "b", text: "Text.\n\n---\n\nMehr Text." });
    const f = ruleSceneBreaks(input([a, b]));
    expect(f).toHaveLength(1);
    expect(f[0].title).toContain("2 verschiedene");
  });

  it("schweigt bei einheitlichem Trenner", () => {
    const a = chapter({ id: "a", text: "Text.\n\n* * *\n\nMehr." });
    const b = chapter({ id: "b", text: "Text.\n\n* * *\n\nMehr." });
    expect(ruleSceneBreaks(input([a, b]))).toHaveLength(0);
  });

  it("meldet mehrfache harte Umbrüche", () => {
    const raw = doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Zeile" },
          { type: "hardBreak" },
          { type: "text", text: "Zeile" },
          { type: "hardBreak" },
          { type: "text", text: "Zeile" },
        ],
      },
    ]);
    const f = ruleHardBreaks(input([chapter({ raw })]));
    expect(f).toHaveLength(1);
    expect(f[0].affectedFormats).toContain("epub");
  });
});
