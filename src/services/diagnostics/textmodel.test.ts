// Tests: Textzerlegung für die Manuskriptprüfung.
import { describe, it, expect } from "vitest";
import {
  analyzeText,
  looksLikeDialogue,
  countWords,
  excerptAt,
} from "@/services/diagnostics/textmodel";

describe("countWords", () => {
  it("zählt einfache Wörter", () => {
    expect(countWords("Der Brief lag dort.")).toBe(4);
  });

  it("zählt Bindestrich-Komposita als ein Wort", () => {
    expect(countWords("Ein Schreib-Tisch stand da.")).toBe(4);
  });

  it("ignoriert Satzzeichen", () => {
    expect(countWords("Ja! Nein? Vielleicht …")).toBe(3);
  });

  it("liefert 0 für leeren Text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ...   ")).toBe(0);
  });
});

describe("looksLikeDialogue", () => {
  it("erkennt deutsche Anführungszeichen", () => {
    expect(looksLikeDialogue('„Komm herein“, sagte sie.')).toBe(true);
  });

  it("erkennt typografische Anführungszeichen", () => {
    expect(looksLikeDialogue('"Komm herein", sagte sie.')).toBe(true);
  });

  it("erkennt Guillemets", () => {
    expect(looksLikeDialogue("»Komm herein«, sagte sie.")).toBe(true);
  });

  it("erkennt Gedankenstrich-Dialog", () => {
    expect(looksLikeDialogue("— Komm herein, sagte sie.")).toBe(true);
  });

  it("erkennt Erzähltext nicht als Dialog", () => {
    expect(looksLikeDialogue("Der Brief lag zwischen den Seiten.")).toBe(false);
  });

  it("behandelt leeren Text ruhig", () => {
    expect(looksLikeDialogue("")).toBe(false);
  });
});

describe("analyzeText", () => {
  const text = [
    "Kapitel 1",
    "",
    "Der Brief lag dort. Marta nahm ihn auf.",
    "",
    '„Was ist das?“, fragte sie.',
  ].join("\n");

  it("erkennt Absätze", () => {
    const a = analyzeText(text);
    expect(a.paragraphs.length).toBe(3);
  });

  it("erkennt die Überschrift", () => {
    const a = analyzeText(text);
    expect(a.paragraphs[0].isHeading).toBe(true);
    expect(a.paragraphs[0].text).toBe("Kapitel 1");
  });

  it("ordnet Absätze ihrer Überschrift zu", () => {
    const a = analyzeText(text);
    const body = a.paragraphs.filter((p) => !p.isHeading);
    expect(body[0].heading).toBe("Kapitel 1");
  });

  it("zerlegt in Sätze", () => {
    const a = analyzeText(text);
    // Überschriften liefern keine Sätze.
    expect(a.sentences.length).toBe(3);
    expect(a.sentences[0].text).toBe("Der Brief lag dort.");
  });

  it("markiert Dialogsätze", () => {
    const a = analyzeText(text);
    const dial = a.sentences.filter((s) => s.isDialogue);
    expect(dial.length).toBe(1);
  });

  it("liefert Positionen, die auf den Originaltext zeigen", () => {
    const a = analyzeText(text);
    for (const s of a.sentences) {
      // Der Ausschnitt an der Position muss den Satzanfang enthalten.
      const at = text.slice(s.start, s.end);
      expect(at.length).toBeGreaterThan(0);
      expect(text.includes(s.text)).toBe(true);
    }
  });

  it("zählt Wörter im Gesamttext", () => {
    const a = analyzeText(text);
    expect(a.wordCount).toBeGreaterThan(10);
  });

  it("behandelt leeren Text ohne zu werfen", () => {
    const a = analyzeText("");
    expect(a.paragraphs).toHaveLength(0);
    expect(a.sentences).toHaveLength(0);
    expect(a.wordCount).toBe(0);
  });

  it("behandelt Text ohne Absatzumbrüche", () => {
    const a = analyzeText("Ein Satz. Noch einer. Und ein dritter.");
    expect(a.paragraphs).toHaveLength(1);
    expect(a.sentences).toHaveLength(3);
  });
});

describe("excerptAt", () => {
  const raw = "Der Brief lag zwischen den Seiten eines Buches, das niemand las.";

  it("schneidet um die Position herum aus", () => {
    const e = excerptAt(raw, 4, 10, 5);
    expect(e).toContain("Brief");
  });

  it("setzt Auslassungszeichen bei abgeschnittenem Text", () => {
    const e = excerptAt(raw, 30, 36, 5);
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
  });

  it("setzt am Textanfang kein führendes Auslassungszeichen", () => {
    const e = excerptAt(raw, 0, 3, 5);
    expect(e.startsWith("…")).toBe(false);
  });

  it("normalisiert Leerraum", () => {
    const e = excerptAt("Ein\n\n  Satz   hier.", 0, 18, 0);
    expect(e).not.toContain("\n");
    expect(e).not.toContain("  ");
  });
});
