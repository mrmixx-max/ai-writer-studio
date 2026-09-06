// Agent1 Security Hardening — TDD tests (FIRST).
// Covers: XSS sanitizer, markdown-link injection, path traversal (plain/encoded/absolute),
// Windows reserved names, control chars, secret redaction, overflow bounds.
import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  sanitizeMarkdown,
  validateFilename,
  detectPathTraversal,
  redactSecrets,
  containsXSS,
} from "@/utils/validation";

describe("sanitizeHtml — XSS prevention", () => {
  it("entfernt <script>-Tags inkl. Inhalt", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("ok");
  });

  it("entfernt iframe/object/embed/form/style/link/meta/base", () => {
    const out = sanitizeHtml(
      '<iframe src="x"></iframe><object></object><embed src=x><form></form><style>x</style><link href=x><meta charset=x><base href=x><p>safe</p>',
    );
    for (const tag of ["iframe", "object", "embed", "form", "style", "link", "meta", "base"]) {
      expect(out.toLowerCase()).not.toContain(`<${tag}`);
    }
    expect(out).toContain("safe");
  });

  it("entfernt Event-Handler (quoted, unquoted, mixed case)", () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).not.toMatch(/onerror/i);
    expect(sanitizeHtml("<img src=x onerror=alert(1)>")).not.toMatch(/onerror/i);
    expect(sanitizeHtml('<div OnClick="evil()">t</div>')).not.toMatch(/onclick/i);
    expect(sanitizeHtml('<svg><animate onbegin=alert(1) /></svg>')).not.toMatch(/onbegin/i);
  });

  it("neutralisiert javascript:/vbscript:/data:text/html-URLs", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
    expect(sanitizeHtml('<a href="VbScript:msgbox(1)">x</a>')).not.toMatch(/vbscript:/i);
    expect(sanitizeHtml('<a href="data:text/html,<h1>x</h1>">x</a>')).not.toMatch(/data:text\/html/i);
    expect(sanitizeHtml('<img src="JaVaScRiPt:alert(1)">')).not.toMatch(/javascript:/i);
  });

  it("entfernt svg/math mit Script-Potenzial, behält Text", () => {
    const out = sanitizeHtml('<svg onload=alert(1)><circle/>evil</svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/<svg/i);
  });

  it("behält harmlose Formatierung", () => {
    const out = sanitizeHtml("<p>Hallo <strong>Welt</strong></p><ul><li>a</li></ul>");
    expect(out).toContain("<strong>Welt</strong>");
    expect(out).toContain("<li>a</li>");
  });

  it("escapet rohes < > in Textknoten nicht doppelt, entfernt aber Tags", () => {
    const out = sanitizeHtml("a < b und c > d");
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("a");
  });
});

describe("sanitizeMarkdown — Link-/HTML-Injection", () => {
  it("entfernt javascript:-Links in Markdown", () => {
    const out = sanitizeMarkdown("[klick](javascript:alert(1))");
    expect(out).not.toMatch(/javascript:/i);
  });

  it("entfernt vbscript:- und data:text/html-Links", () => {
    expect(sanitizeMarkdown("[x](vbscript:msgbox(1))")).not.toMatch(/vbscript:/i);
    expect(sanitizeMarkdown("[x](data:text/html;base64,PGgxPmgp)")).not.toMatch(/data:text\/html/i);
  });

  it("entfernt eingebettete iframes/scripts via HTML-Sanitizer", () => {
    const out = sanitizeMarkdown('# Titel\n\n<iframe src="evil"></iframe>\n\nText');
    expect(out).not.toMatch(/<iframe/i);
    expect(out).toContain("Titel");
  });

  it("lässt normales Markdown unberührt", () => {
    const out = sanitizeMarkdown("# Kapitel\n\nEin **fetter** Satz mit [Link](https://example.com).");
    expect(out).toContain("**fetter**");
    expect(out).toContain("https://example.com");
  });
});

describe("detectPathTraversal / validateFilename — Traversal-Härtung", () => {
  it("erkennt klassische Traversals", () => {
    expect(detectPathTraversal("../../etc/passwd")).toBe(true);
    expect(detectPathTraversal("foo/../../../bar")).toBe(true);
    expect(detectPathTraversal("..\\windows\\system32")).toBe(true);
  });

  it("erkennt URL-/doppelt-kodierte Traversals", () => {
    expect(detectPathTraversal("%2e%2e%2fsecret")).toBe(true);
    expect(detectPathTraversal("%252e%252e%2fsecret")).toBe(true);
    expect(detectPathTraversal("..%2fsecret")).toBe(true);
    expect(detectPathTraversal("..%c0%afsecret")).toBe(true);
  });

  it("erkennt absolute Pfade und Null-Bytes", () => {
    expect(detectPathTraversal("/etc/passwd")).toBe(true);
    expect(detectPathTraversal("C:\\Windows\\secret")).toBe(true);
    expect(detectPathTraversal("C:/Windows/secret")).toBe(true);
    expect(detectPathTraversal("file\0name")).toBe(true);
  });

  it("akzeptiert harmlose Namen", () => {
    expect(detectPathTraversal("mein-buch.docx")).toBe(false);
    expect(detectPathTraversal("Kapitel 1 — Anfang")).toBe(false);
    expect(detectPathTraversal("a...b")).toBe(false);
  });

  it("validateFilename wirft bei kodiertem Traversal", () => {
    expect(() => validateFilename("%2e%2e/secret")).toThrow();
    expect(() => validateFilename("..\\secret")).toThrow();
    expect(() => validateFilename("/etc/passwd")).toThrow();
  });

  it("validateFilename wirft bei Windows-reservierten Namen", () => {
    for (const n of ["CON", "NUL", "COM1", "LPT1", "con.txt", "nul.md"]) {
      expect(() => validateFilename(n)).toThrow(/reserviert/i);
    }
  });

  it("validateFilename wirft bei Kontrollzeichen/Null-Byte", () => {
    expect(() => validateFilename("file\0name")).toThrow();
    expect(() => validateFilename("file\x01name")).toThrow();
  });
});

describe("redactSecrets — Credential-Leak-Prevention", () => {
  it("maskiert API-Keys und Bearer-Tokens in Logs", () => {
    const out = redactSecrets('key="sk-abc123XYZ456789" und Bearer ghp_secrettoken123456');
    expect(out).not.toContain("sk-abc123XYZ456789");
    expect(out).not.toContain("ghp_secrettoken123456");
    expect(out).toMatch(/\[REDACTED/);
  });

  it("maskiert openrouter/openai-Keys", () => {
    expect(redactSecrets("Authorization: Bearer sk-or-v1-SECRETKEY1234567890")).not.toContain("SECRETKEY1234567890");
  });

  it("lässt normale Texte unverändert", () => {
    expect(redactSecrets("Kapitel 1: Der Anfang")).toBe("Kapitel 1: Der Anfang");
  });
});

describe("containsXSS — erweiterte Erkennung", () => {
  it("erkennt iframe/svg/event-handler", () => {
    expect(containsXSS('<iframe src="x">')).toBe(true);
    expect(containsXSS("<svg onload=alert(1)>")).toBe(true);
    expect(containsXSS('<img src=x onerror=alert(1)>')).toBe(true);
  });
});

describe("Overflow-Bounds", () => {
  it("sanitizeHtml begrenzt überlange Inputs", () => {
    const big = "a".repeat(500_000);
    const out = sanitizeHtml(big);
    expect(out.length).toBeLessThanOrEqual(200_000);
  });

  it("sanitizeMarkdown terminiert bei Nested-Tag-Angriff", () => {
    const nested = "<scr<script>ipt>".repeat(5_000);
    const t0 = Date.now();
    sanitizeMarkdown(nested);
    expect(Date.now() - t0).toBeLessThan(5_000);
  });
});
