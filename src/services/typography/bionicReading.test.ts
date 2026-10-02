// Tests: Bionic Reading & Typewriter-Center (WP 17.2)
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyBionicReading,
  generateTypewriterScroll,
  getAccessibilitySettings,
  type AccessibilitySettings,
} from "./bionicReading";

// ---------------------------------------------------------------------------
// Test-Texte
// ---------------------------------------------------------------------------

const SIMPLE_TEXT = "Die Katze sitzt auf dem Tisch.";
const EMPTY_TEXT = "";
const WHITESPACE_TEXT = "   \n\t  ";
const SINGLE_WORD = "Hallo";
const LONG_WORD = "unvorstellbar";
const TEXT_WITH_UMLAUTS = "Die schöne Überraschung ist größer.";
const TEXT_WITH_NUMBERS = "Es gibt 42 Antworten auf alles.";
const TEXT_WITH_HTML = "<script>alert('xss')</script> Hallo";

const MULTI_WORD_TEXT = "Der schnelle braune Fuchs springt über den faulen Hund.";

// ---------------------------------------------------------------------------
// applyBionicReading
// ---------------------------------------------------------------------------

describe("applyBionicReading", () => {
  it("hebt die ersten 30-50% jedes Wortes fett hervor", () => {
    const result = applyBionicReading(SIMPLE_TEXT);
    expect(result).toContain("<strong>");
    expect(result).toContain("</strong>");
    // "Die" → 3 Zeichen, 40% = 1.2 → round = 1 → "D" fett
    expect(result).toContain("<strong>D</strong>ie");
  });

  it("leerer Text gibt leeren String zurück", () => {
    expect(applyBionicReading(EMPTY_TEXT)).toBe("");
  });

  it("Whitespace-only Text bleibt unverändert", () => {
    expect(applyBionicReading(WHITESPACE_TEXT)).toBe(WHITESPACE_TEXT);
  });

  it("undefined als Text gibt leeren String zurück", () => {
    expect(applyBionicReading(undefined as unknown as string)).toBe("");
  });

  it("null als Text gibt leeren String zurück", () => {
    expect(applyBionicReading(null as unknown as string)).toBe("");
  });

  it("einzelnes Wort wird korrekt fett hervorgehoben", () => {
    const result = applyBionicReading(SINGLE_WORD);
    // "Hallo" → 5 Zeichen, 40% = 2 → "Ha" fett
    expect(result).toBe("<strong>Ha</strong>llo");
  });

  it("langes Wort wird korrekt fett hervorgehoben", () => {
    const result = applyBionicReading(LONG_WORD);
    // "unvorstellbar" → 13 Zeichen, 40% = 5.2 → round = 5 → "unvor" fett
    expect(result).toBe("<strong>unvor</strong>stellbar");
  });

  it("custom intensity wird angewendet", () => {
    const result = applyBionicReading(SINGLE_WORD, 0.5);
    // "Hallo" → 5 Zeichen, 50% = 2.5 → round = 3 → "Hal" fett
    expect(result).toBe("<strong>Hal</strong>lo");
  });

  it("intensity unter Minimum wird auf Minimum geclamppt", () => {
    const result = applyBionicReading(SINGLE_WORD, 0.1);
    // 0.1 → clamp auf 0.3 → "Hallo" 5 Zeichen, 30% = 1.5 → round = 2 → "Ha" fett
    expect(result).toBe("<strong>Ha</strong>llo");
  });

  it("intensity über Maximum wird auf Maximum geclamppt", () => {
    const result = applyBionicReading(SINGLE_WORD, 0.9);
    // 0.9 → clamp auf 0.5 → "Hallo" 5 Zeichen, 50% = 2.5 → round = 3 → "Hal" fett
    expect(result).toBe("<strong>Hal</strong>lo");
  });

  it("HTML-Sonderzeichen werden escaped (XSS-Schutz)", () => {
    const result = applyBionicReading(TEXT_WITH_HTML);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("Umlaute werden korrekt behandelt", () => {
    const result = applyBionicReading(TEXT_WITH_UMLAUTS);
    expect(result).toContain("<strong>");
    expect(result).toContain("ö");
    expect(result).toContain("Ü");
  });

  it("Zahlen werden korrekt behandelt", () => {
    const result = applyBionicReading(TEXT_WITH_NUMBERS);
    expect(result).toContain("<strong>");
    // "42" → 2 Zeichen, 40% = 0.8 → round = 1 → "4" fett, "2" normal
    expect(result).toContain("<strong>4</strong>2");
  });

  it("Mehrwort-Text wird vollständig verarbeitet", () => {
    const result = applyBionicReading(MULTI_WORD_TEXT);
    const strongCount = (result.match(/<strong>/g) || []).length;
    // 9 Wörter im Text
    expect(strongCount).toBe(9);
  });

  it("Whitespace zwischen Wörtern bleibt erhalten", () => {
    const result = applyBionicReading("Hallo Welt");
    expect(result).toContain(" ");
    // "Hallo" → "Ha" fett + "llo" normal, dann Space, dann "Welt" → "We" fett + "lt" normal
    expect(result).toBe("<strong>Ha</strong>llo <strong>We</strong>lt");
  });

  it("Textinhalte werden nicht verfälscht", () => {
    const result = applyBionicReading(SIMPLE_TEXT);
    // Alle Buchstaben des Originaltextes müssen im Result enthalten sein
    const stripped = result.replace(/<[^>]+>/g, "");
    expect(stripped).toBe(SIMPLE_TEXT);
  });
});

// ---------------------------------------------------------------------------
// generateTypewriterScroll
// ---------------------------------------------------------------------------

describe("generateTypewriterScroll", () => {
  it("null editor — kein Fehler", () => {
    expect(() => generateTypewriterScroll(null)).not.toThrow();
  });

  it("undefined editor — kein Fehler", () => {
    expect(() => generateTypewriterScroll(undefined)).not.toThrow();
  });

  it("leeres Objekt als editor — kein Fehler", () => {
    expect(() => generateTypewriterScroll({})).not.toThrow();
  });

  it("editor ohne state — kein Fehler", () => {
    expect(() => generateTypewriterScroll({ view: {} })).not.toThrow();
  });

  it("gültiger Editor mit scrollIntoView wird aufgerufen", () => {
    const mockScrollIntoView = vi.fn();
    const mockElement = {
      scrollIntoView: mockScrollIntoView,
    };
    const mockEditor = {
      view: {
        state: {
          doc: { content: { size: 100 } },
          selection: {
            $from: {
              pos: 10,
              depth: 1,
              node: () => ({ type: { name: "paragraph" } }),
            },
          },
        },
        domAtPos: () => ({ node: mockElement, offset: 0 }),
        dom: {},
      },
    };

    generateTypewriterScroll(mockEditor);
    expect(mockScrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" }),
    );
  });

  it("editor mit fehlendem domAtPos — kein Fehler", () => {
    const mockEditor = {
      view: {
        state: {
          doc: { content: { size: 100 } },
          selection: {
            $from: {
              pos: 10,
              depth: 1,
              node: () => ({ type: { name: "paragraph" } }),
            },
          },
        },
        dom: {},
      },
    };

    expect(() => generateTypewriterScroll(mockEditor)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAccessibilitySettings
// ---------------------------------------------------------------------------

describe("getAccessibilitySettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Default-Einstellungen wenn localStorage leer", () => {
    const settings = getAccessibilitySettings();
    expect(settings.fontFamily).toBe("Georgia, serif");
    expect(settings.lineHeight).toBe(1.6);
    expect(settings.letterSpacing).toBe(0.5);
    expect(settings.bionicIntensity).toBe(0.4);
  });

  it("Gespeicherte Einstellungen werden geladen", () => {
    const stored: AccessibilitySettings = {
      fontFamily: "Arial, sans-serif",
      lineHeight: 1.8,
      letterSpacing: 1.2,
      bionicIntensity: 0.45,
    };
    localStorage.setItem("accessibilitySettings", JSON.stringify(stored));

    const settings = getAccessibilitySettings();
    expect(settings.fontFamily).toBe("Arial, sans-serif");
    expect(settings.lineHeight).toBe(1.8);
    expect(settings.letterSpacing).toBe(1.2);
    expect(settings.bionicIntensity).toBe(0.45);
  });

  it("Ungültiger JSON — Fallback zu Defaults", () => {
    localStorage.setItem("accessibilitySettings", "not valid json{");
    const settings = getAccessibilitySettings();
    expect(settings.fontFamily).toBe("Georgia, serif");
  });

  it("Fehlende Felder werden mit Defaults gefüllt", () => {
    localStorage.setItem(
      "accessibilitySettings",
      JSON.stringify({ fontFamily: "Verdana" }),
    );
    const settings = getAccessibilitySettings();
    expect(settings.fontFamily).toBe("Verdana");
    expect(settings.lineHeight).toBe(1.6);
    expect(settings.letterSpacing).toBe(0.5);
    expect(settings.bionicIntensity).toBe(0.4);
  });

  it("bionicIntensity unter Minimum wird geclamppt", () => {
    localStorage.setItem(
      "accessibilitySettings",
      JSON.stringify({ bionicIntensity: 0.1 }),
    );
    const settings = getAccessibilitySettings();
    expect(settings.bionicIntensity).toBeGreaterThanOrEqual(0.3);
  });

  it("bionicIntensity über Maximum wird geclamppt", () => {
    localStorage.setItem(
      "accessibilitySettings",
      JSON.stringify({ bionicIntensity: 0.9 }),
    );
    const settings = getAccessibilitySettings();
    expect(settings.bionicIntensity).toBeLessThanOrEqual(0.5);
  });

  it("lineHeight 0 oder negativ — Fallback zu Default", () => {
    localStorage.setItem(
      "accessibilitySettings",
      JSON.stringify({ lineHeight: 0 }),
    );
    const settings = getAccessibilitySettings();
    expect(settings.lineHeight).toBe(1.6);
  });
});
