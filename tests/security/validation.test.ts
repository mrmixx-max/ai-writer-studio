// Tests: Input-Validation (Security Hardening)
import { describe, it, expect } from "vitest";
import {
  validatePrompt,
  validateFilename,
  validateProjectName,
  sanitizeMarkdown,
  validateKeywords,
  containsXSS,
  LIMITS,
} from "@/utils/validation";

describe("validatePrompt", () => {
  it("akzeptiert einen gültigen Prompt", () => {
    expect(validatePrompt("Schreibe ein Kapitel über KI")).toBe(
      "Schreibe ein Kapitel über KI",
    );
  });

  it("entfernt führende/nachfolgende Leerzeichen", () => {
    expect(validatePrompt("  Hallo  ")).toBe("Hallo");
  });

  it("wirft bei leerem Prompt", () => {
    expect(() => validatePrompt("")).toThrow(/nicht leer/);
    expect(() => validatePrompt("   ")).toThrow(/nicht leer/);
  });

  it("wirft bei zu langem Prompt", () => {
    const long = "a".repeat(LIMITS.PROMPT_MAX_CHARS + 1);
    expect(() => validatePrompt(long)).toThrow(/zu lang/);
  });

  it("wirft bei Pfad-Traversal", () => {
    expect(() => validatePrompt("../../etc/passwd")).toThrow(/Pfad/);
    expect(() => validatePrompt("/../secret")).toThrow(/Pfad/);
  });
});

describe("validateFilename", () => {
  it("akzeptiert gültige Dateinamen", () => {
    expect(validateFilename("mein-buch.docx")).toBe("mein-buch.docx");
    expect(validateFilename("Kapitel 1")).toBe("Kapitel 1");
  });

  it("wirft bei leerem Dateinamen", () => {
    expect(() => validateFilename("")).toThrow(/nicht leer/);
  });

  it("wirft bei illegalen Zeichen", () => {
    expect(() => validateFilename("file<name")).toThrow(/ungültige Zeichen/);
    expect(() => validateFilename('file"name')).toThrow(/ungültige Zeichen/);
    expect(() => validateFilename("file|name")).toThrow(/ungültige Zeichen/);
  });

  it("wirft bei Pfad-Traversal", () => {
    expect(() => validateFilename("../secret")).toThrow(/Traversal/);
    expect(() => validateFilename("..\\windows")).toThrow(/Traversal/);
  });

  it("wirft bei nur Punkten", () => {
    expect(() => validateFilename("...")).toThrow(/Punkte/);
  });

  it("wirft bei zu langem Dateinamen", () => {
    const long = "a".repeat(LIMITS.FILENAME_MAX_CHARS + 1);
    expect(() => validateFilename(long)).toThrow(/zu lang/);
  });
});

describe("validateProjectName", () => {
  it("akzeptiert gültige Projektnamen", () => {
    expect(validateProjectName("Mein Roman")).toBe("Mein Roman");
  });

  it("wirft bei leerem Namen", () => {
    expect(() => validateProjectName("")).toThrow(/nicht leer/);
  });

  it("wirft bei zu langem Namen", () => {
    const long = "a".repeat(LIMITS.PROJECT_NAME_MAX_CHARS + 1);
    expect(() => validateProjectName(long)).toThrow(/zu lang/);
  });

  it("wirft bei Pfad-Traversal", () => {
    expect(() => validateProjectName("../hack")).toThrow(/Pfad/);
  });
});

describe("sanitizeMarkdown", () => {
  it("entfernt script-Tags", () => {
    const dirty = "Hallo<script>alert('xss')</script>Welt";
    expect(sanitizeMarkdown(dirty)).toBe("HalloWelt");
  });

  it("entfernt javascript: URLs", () => {
    const dirty = "[Link](javascript:alert('xss'))";
    expect(sanitizeMarkdown(dirty)).not.toContain("javascript:");
  });

  it("entfernt Event-Handler", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    expect(sanitizeMarkdown(dirty)).not.toContain("onerror");
  });

  it("erlaubt normalen Markdown", () => {
    const safe = "# Titel\n\nAbsatz mit **Fett** und *Kursiv*.";
    expect(sanitizeMarkdown(safe)).toBe(safe);
  });
});

describe("validateKeywords", () => {
  it("akzeptiert gültige Keywords", () => {
    expect(validateKeywords(["KI", "Roman", "Thriller"])).toEqual([
      "KI",
      "Roman",
      "Thriller",
    ]);
  });

  it("entfernt leere Strings und Duplikate", () => {
    expect(validateKeywords(["KI", "", "ki", "Roman"])).toEqual(["KI", "Roman"]);
  });

  it("wirft bei zu vielen Keywords", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(() => validateKeywords(many)).toThrow(/Zu viele/);
  });

  it("wirft bei zu langem Keyword", () => {
    const long = "a".repeat(LIMITS.KEYWORD_MAX_CHARS + 1);
    expect(() => validateKeywords([long])).toThrow(/zu lang/);
  });
});

describe("containsXSS", () => {
  it("erkennt script-Tags", () => {
    expect(containsXSS("<script>alert(1)</script>")).toBe(true);
  });

  it("erkennt javascript: URLs", () => {
    expect(containsXSS("javascript:alert(1)")).toBe(true);
  });

  it("erkennt Event-Handler", () => {
    expect(containsXSS('<img onerror="alert(1)">')).toBe(true);
  });

  it("erkennt data:text/html", () => {
    expect(containsXSS("data:text/html,<script>alert(1)</script>")).toBe(true);
  });

  it("erlaubt normalen Text", () => {
    expect(containsXSS("Ein ganz normaler Text über KI.")).toBe(false);
  });
});
