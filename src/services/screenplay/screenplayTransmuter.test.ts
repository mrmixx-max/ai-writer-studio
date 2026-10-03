// Tests: Screenplay-Transmuter (WP 38.1).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  proseToScreenplay,
  exportToFdx,
  exportToFountain,
  normalizeQuotes,
  normalizeSlugline,
  isSlugline,
  splitIntoBlocks,
  emptyDocument,
} from "./screenplayTransmuter";
import type { ScreenplayDocument } from "./screenplayTransmuter";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

// Uneinheitliche Anführungszeichen als benannte Konstanten.
const DE_OPEN = "\u201E"; // „
const DE_CLOSE = "\u201C"; // "
const DE_CLOSE2 = "\u201D"; // "
const EN_OPEN = "\u201C"; // "
const EN_CLOSE = "\u201D"; // "
const GU_OPEN = "\u00AB"; // «
const GU_CLOSE = "\u00BB"; // »
const SN_OPEN = "\u2039"; // ›
const SN_CLOSE = "\u203A"; // ‹

/** Minimales Dokument für Export-Tests. */
const sampleDoc = (): ScreenplayDocument => ({
  title: "Mein Film",
  scenes: [
    {
      slugline: "INT. KÜCHE - TAG",
      action: ["Mara steht am Herd."],
      dialogue: [
        { character: "MARA", parenthetical: "flüsternd", lines: ["Ich habe es satt."] },
        { character: "JONAS", lines: ["Dann geh doch.", "Niemand hält dich."] },
      ],
    },
    {
      slugline: "EXT. STRAND - NACHT",
      action: ["Mara läuft am Wasser entlang."],
      dialogue: [{ character: "MARA", lines: ["Es ist vorbei."] }],
    },
  ],
});

// ---------------------------------------------------------------------------
// normalizeQuotes
// ---------------------------------------------------------------------------

describe("normalizeQuotes", () => {
  it("normalisiert deutsche „…\" zu geraden Anführungszeichen", () => {
    expect(normalizeQuotes(`${DE_OPEN}Hallo${DE_CLOSE}`)).toBe('"Hallo"');
    expect(normalizeQuotes(`${DE_OPEN}Hallo${DE_CLOSE2}`)).toBe('"Hallo"');
  });

  it("normalisiert französische »…« und ›…‹", () => {
    expect(normalizeQuotes(`${GU_OPEN}Hallo${GU_CLOSE}`)).toBe('"Hallo"');
    expect(normalizeQuotes(`${SN_OPEN}Hallo${SN_CLOSE}`)).toBe('"Hallo"');
  });

  it("normalisiert englische „smart quotes\"", () => {
    expect(normalizeQuotes(`${EN_OPEN}Hallo${EN_CLOSE}`)).toBe('"Hallo"');
  });

  it("lässt gerade Anführungszeichen und Text ohne Quotes unverändert", () => {
    expect(normalizeQuotes('"Hallo"')).toBe('"Hallo"');
    expect(normalizeQuotes("Hallo Welt")).toBe("Hallo Welt");
    expect(normalizeQuotes("")).toBe("");
  });

  it("biegt einzelne, unpaarige typografische Quotes gerade", () => {
    expect(normalizeQuotes(`a ${DE_OPEN} b`)).toBe('a " b');
    expect(normalizeQuotes(`${GU_CLOSE}`)).toBe('"');
  });
});

// ---------------------------------------------------------------------------
// isSlugline
// ---------------------------------------------------------------------------

describe("isSlugline", () => {
  it("erkennt INT./EXT.-Sluglines", () => {
    expect(isSlugline("INT. KÜCHE - TAG")).toBe(true);
    expect(isSlugline("EXT. STRAND – NACHT")).toBe(true);
    expect(isSlugline("int. küche - tag")).toBe(true);
  });

  it("erkennt Szenen-Nummern und I/E-Varianten", () => {
    expect(isSlugline("Szene 1: INT. AUTO - TAG")).toBe(true);
    expect(isSlugline("1. EXT. PARK - TAG")).toBe(true);
    expect(isSlugline("I/E. WAGEN - TAG")).toBe(true);
  });

  it("verwirft normale Prosa und Leerstrings", () => {
    expect(isSlugline("Mara geht nach Hause.")).toBe(false);
    expect(isSlugline("Er starrt ins Leere")).toBe(false);
    expect(isSlugline("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeSlugline
// ---------------------------------------------------------------------------

describe("normalizeSlugline", () => {
  it("normalisiert eine vollständige Slugline in kanonische Form", () => {
    expect(normalizeSlugline("ext. strand – nacht")).toBe("EXT. STRAND - NACHT");
    expect(normalizeSlugline("INT. KÜCHE - Tag")).toBe("INT. KÜCHE - TAG");
  });

  it("ergänzt fehlende Tageszeit mit Fallback TAG", () => {
    expect(normalizeSlugline("INT. KÜCHE")).toBe("INT. KÜCHE - TAG");
  });

  it("entfernt Szenen-Nummern-Präfixe", () => {
    expect(normalizeSlugline("1. INT. AUTO - TAG")).toBe("INT. AUTO - TAG");
    expect(normalizeSlugline("SZENE 12: EXT. PARK - NACHT")).toBe("EXT. PARK - NACHT");
  });

  it("mappt Varianten auf INT./EXT. ab", () => {
    expect(normalizeSlugline("I/E. WAGEN - TAG")).toBe("INT./EXT. WAGEN - TAG");
    expect(normalizeSlugline("EST. STRAND - TAG")).toBe("EXT. STRAND - TAG");
  });

  it("fällt bei unbekanntem Präfix defensiv auf INT. zurück", () => {
    expect(normalizeSlugline("KÜCHE - TAG")).toBe("INT. KÜCHE - TAG");
  });
});

// ---------------------------------------------------------------------------
// splitIntoBlocks
// ---------------------------------------------------------------------------

describe("splitIntoBlocks", () => {
  it("trennt Absätze an Leerzeilen", () => {
    expect(splitIntoBlocks("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
  });

  it("behält Zeilenumbrüche innerhalb eines Absatzes und liefert [] bei leer", () => {
    expect(splitIntoBlocks("zeile1\nzeile2")).toEqual(["zeile1\nzeile2"]);
    expect(splitIntoBlocks("")).toEqual([]);
    expect(splitIntoBlocks("   \n  ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// proseToScreenplay — Kern
// ---------------------------------------------------------------------------

describe("proseToScreenplay", () => {
  it("erkennt Titel, Slugline, Action und Dialogblöcke", () => {
    const text = [
      "Der letzte Zug",
      "INT. KÜCHE - TAG",
      "Mara steht am Herd.",
      "",
      "MARA: Ich habe es satt.",
      "JONAS: Dann geh doch.",
    ].join("\n");

    const doc = proseToScreenplay(text);
    expect(doc.title).toBe("Der letzte Zug");
    expect(doc.scenes).toHaveLength(1);

    const scene = doc.scenes[0];
    expect(scene.slugline).toBe("INT. KÜCHE - TAG");
    expect(scene.action).toEqual(["Mara steht am Herd."]);
    expect(scene.dialogue).toHaveLength(2);
    expect(scene.dialogue[0].character).toBe("MARA");
    expect(scene.dialogue[0].lines).toEqual(["Ich habe es satt."]);
    expect(scene.dialogue[1].character).toBe("JONAS");
    expect(scene.dialogue[1].lines).toEqual(["Dann geh doch."]);
  });

  it("ist robust gegen uneinheitliche Anführungszeichen im Dialog", () => {
    const text = [
      "Title: Quoten-Test",
      "INT. KÜCHE - TAG",
      `MARA: ${DE_OPEN}Ich habe es satt.${DE_CLOSE}`,
      `JONAS: ${GU_OPEN}Nein.${GU_CLOSE}`,
      `MARA: ${EN_OPEN}Doch.${EN_CLOSE}`,
    ].join("\n");

    const doc = proseToScreenplay(text);
    expect(doc.title).toBe("Quoten-Test");
    expect(doc.scenes[0].dialogue[0].lines).toEqual(["Ich habe es satt."]);
    expect(doc.scenes[0].dialogue[1].lines).toEqual(["Nein."]);
    expect(doc.scenes[0].dialogue[2].lines).toEqual(["Doch."]);
  });

  it("erkennt Parentheticals und Mehrzeilen-Dialog", () => {
    const text = [
      "INT. AUTO - TAG",
      "MARA: (flüsternd) Ich fahre los.",
      "Und ich komme nicht zurück.",
    ].join("\n");

    const doc = proseToScreenplay(text);
    const block = doc.scenes[0].dialogue[0];
    expect(block.character).toBe("MARA");
    expect(block.parenthetical).toBe("flüsternd");
    expect(block.lines).toEqual(["Ich fahre los.", "Und ich komme nicht zurück."]);
  });

  it("erkennt alleinstehende Großbuchstaben-Figurenzeilen (All-Caps-Cue)", () => {
    const text = ["INT. AUTO - TAG", "MARA", "Ich fahre los."].join("\n");

    const doc = proseToScreenplay(text);
    const block = doc.scenes[0].dialogue[0];
    expect(block.character).toBe("MARA");
    expect(block.lines).toEqual(["Ich fahre los."]);
  });

  it("legt mehrere Szenen korrekt an", () => {
    const text = [
      "Mein Film",
      "INT. KÜCHE - TAG",
      "Mara kocht.",
      "",
      "EXT. STRAND – NACHT",
      "Mara läuft.",
    ].join("\n");

    const doc = proseToScreenplay(text);
    expect(doc.title).toBe("Mein Film");
    expect(doc.scenes).toHaveLength(2);
    expect(doc.scenes[0].slugline).toBe("INT. KÜCHE - TAG");
    expect(doc.scenes[0].action).toEqual(["Mara kocht."]);
    expect(doc.scenes[1].slugline).toBe("EXT. STRAND - NACHT");
    expect(doc.scenes[1].action).toEqual(["Mara läuft."]);
  });

  it("behandelt eine mehrzeilig umbrochene Slugline", () => {
    const text = ["INT. KÜCHE", "- TAG", "Mara kocht."].join("\n");

    const doc = proseToScreenplay(text);
    expect(doc.scenes[0].slugline).toBe("INT. KÜCHE - TAG");
    expect(doc.scenes[0].action).toEqual(["Mara kocht."]);
  });

  it("liefert bei leerem/ungültigem Input ein leeres Dokument", () => {
    expect(proseToScreenplay("")).toEqual({ title: "Ohne Titel", scenes: [] });
    expect(proseToScreenplay("   \n  \n")).toEqual({ title: "Ohne Titel", scenes: [] });
    // Defensiv gegen Nicht-String (Laufzeit-Härtung).
    expect(proseToScreenplay(null as unknown as string)).toEqual({
      title: "Ohne Titel",
      scenes: [],
    });
  });

  it("mutiert den Eingabetext nicht", () => {
    const text = "INT. KÜCHE - TAG\nMara kocht.";
    const copy = String(text);
    proseToScreenplay(text);
    expect(text).toBe(copy);
  });
});

// ---------------------------------------------------------------------------
// emptyDocument
// ---------------------------------------------------------------------------

describe("emptyDocument", () => {
  it("liefert eine gültige leere Struktur mit Fallback-Titel", () => {
    expect(emptyDocument()).toEqual({ title: "Ohne Titel", scenes: [] });
    expect(emptyDocument("")).toEqual({ title: "Ohne Titel", scenes: [] });
    expect(emptyDocument("Mein Film")).toEqual({ title: "Mein Film", scenes: [] });
  });
});

// ---------------------------------------------------------------------------
// exportToFdx
// ---------------------------------------------------------------------------

describe("exportToFdx", () => {
  it("erzeugt wohlgeformtes Final-Draft-XML mit allen Absatztypen", () => {
    const fdx = exportToFdx(sampleDoc());
    expect(fdx.startsWith("<?xml")).toBe(true);
    expect(fdx).toContain("<FinalDraft");
    expect(fdx).toContain("</FinalDraft>");
    expect(fdx).toContain('Type="Title"');
    expect(fdx).toContain('Type="Scene Heading"');
    expect(fdx).toContain('Type="Action"');
    expect(fdx).toContain('Type="Character"');
    expect(fdx).toContain('Type="Parenthetical"');
    expect(fdx).toContain('Type="Dialogue"');
    expect(fdx).toContain("Mein Film");
    expect(fdx).toContain("INT. KÜCHE - TAG");
    expect(fdx).toContain("(flüsternd)");
  });

  it("escaped XML-Sonderzeichen in Inhalten", () => {
    const doc: ScreenplayDocument = {
      title: "A & B",
      scenes: [
        {
          slugline: "INT. KÜCHE - TAG",
          action: ["Tom & Jerry <3"],
          dialogue: [{ character: "MARA", lines: ['Er sagte "Nein" & ging.'] }],
        },
      ],
    };
    const fdx = exportToFdx(doc);
    expect(fdx).toContain("A &amp; B");
    expect(fdx).toContain("Tom &amp; Jerry &lt;3");
    expect(fdx).toContain("&quot;Nein&quot; &amp; ging.");
    // Keine rohen Sonderzeichen aus Inhalten:
    expect(fdx).not.toContain("Tom & Jerry");
  });

  it("bleibt bei leerem Dokument defensiv gültig", () => {
    const fdx = exportToFdx(emptyDocument());
    expect(fdx).toContain("<FinalDraft");
    expect(fdx).toContain("Ohne Titel");
    expect(fdx).toContain("</FinalDraft>");
  });
});

// ---------------------------------------------------------------------------
// exportToFountain
// ---------------------------------------------------------------------------

describe("exportToFountain", () => {
  it("erzeugt Fountain mit Titel, Slugline, Figur, Parenthetical und Dialog", () => {
    const fountain = exportToFountain(sampleDoc());
    expect(fountain).toContain("Title: Mein Film");
    expect(fountain).toContain("INT. KÜCHE - TAG");
    expect(fountain).toContain("EXT. STRAND - NACHT");
    expect(fountain).toContain("MARA");
    expect(fountain).toContain("(flüsternd)");
    expect(fountain).toContain("Ich habe es satt.");
    expect(fountain).toContain("Dann geh doch.");
    // Reihenfolge: Charakterzeile vor der Parenthetical.
    const idxChar = fountain.indexOf("MARA");
    const idxParen = fountain.indexOf("(flüsternd)");
    const idxLine = fountain.indexOf("Ich habe es satt.");
    expect(idxChar).toBeGreaterThanOrEqual(0);
    expect(idxParen).toBeGreaterThan(idxChar);
    expect(idxLine).toBeGreaterThan(idxParen);
  });

  it("bleibt bei leerem Dokument defensiv gültig", () => {
    const fountain = exportToFountain(emptyDocument());
    expect(fountain).toContain("Title: Ohne Titel");
    expect(typeof fountain).toBe("string");
  });
});
