// Unit-Tests: strukturorientiertes Chunking.
import { describe, it, expect } from "vitest";
import {
  estimateTokens, splitSentences, blocksFromTiptap, blocksFromPlainText,
  chunkBlocks, chunkTiptap, chunkPlainText, MAX_TOKENS,
} from "@/services/knowledge/chunking";

function tiptap(nodes: any[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}
function para(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function heading(level: number, text: string) {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

describe("estimateTokens", () => {
  it("liefert 0 für leeren Text", () => {
    expect(estimateTokens("")).toBe(0);
  });
  it("skaliert mit der Textlänge", () => {
    expect(estimateTokens("a".repeat(34))).toBe(10);
  });
});

describe("splitSentences", () => {
  it("trennt an Satzzeichen", () => {
    const s = splitSentences("Er ging. Sie blieb. Warum?");
    expect(s).toHaveLength(3);
  });

  it("zerschneidet deutsche Abkürzungen nicht", () => {
    const s = splitSentences("Er nahm z. B. das Buch. Dann ging er.");
    expect(s).toHaveLength(2);
    expect(s[0]).toContain("z. B.");
  });

  it("zerschneidet Ordinalzahlen nicht", () => {
    const s = splitSentences("Im 3. Kapitel geschah es. Danach nichts.");
    expect(s).toHaveLength(2);
    expect(s[0]).toContain("3. Kapitel");
  });

  it("behandelt Text ohne Satzzeichen als einen Satz", () => {
    expect(splitSentences("kein satzzeichen hier")).toHaveLength(1);
  });
});

describe("blocksFromTiptap", () => {
  it("öffnet pro Überschrift einen Block mit Heading-Pfad", () => {
    const json = tiptap([
      heading(1, "Kapitel 1"),
      para("Erster Absatz."),
      heading(2, "Szene A"),
      para("Zweiter Absatz."),
    ]);
    const blocks = blocksFromTiptap(json);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].headingPath).toBe("Kapitel 1");
    expect(blocks[1].headingPath).toBe("Kapitel 1 › Szene A");
  });

  it("stellt rootLabel vor den Pfad", () => {
    const json = tiptap([heading(1, "Szene"), para("Text.")]);
    const blocks = blocksFromTiptap(json, "Kapitel 7");
    expect(blocks[0].headingPath).toBe("Kapitel 7 › Szene");
  });

  it("verlässt tiefere Ebenen beim Zurückspringen", () => {
    const json = tiptap([
      heading(1, "A"), para("a"),
      heading(2, "A1"), para("a1"),
      heading(1, "B"), para("b"),
    ]);
    const blocks = blocksFromTiptap(json);
    expect(blocks[2].headingPath).toBe("B");
  });

  it("markiert Zitate erkennbar", () => {
    const json = tiptap([
      { type: "blockquote", content: [para("Zitierter Satz.")] },
    ]);
    const blocks = blocksFromTiptap(json);
    expect(blocks[0].paragraphs[0]).toMatch(/^»/);
  });

  it("gibt bei ungültigem JSON ein leeres Ergebnis zurück statt zu werfen", () => {
    expect(blocksFromTiptap("{kaputt")).toEqual([]);
  });

  it("ignoriert leere Absätze", () => {
    const json = tiptap([para(""), para("   "), para("Echt.")]);
    const blocks = blocksFromTiptap(json);
    expect(blocks[0].paragraphs).toEqual(["Echt."]);
  });
});

describe("blocksFromPlainText", () => {
  it("interpretiert Markdown-Überschriften", () => {
    const blocks = blocksFromPlainText("# Titel\n\nAbsatz eins.\n\n## Unter\n\nAbsatz zwei.");
    expect(blocks).toHaveLength(2);
    expect(blocks[1].headingPath).toBe("Titel › Unter");
  });

  it("trennt Absätze an Leerzeilen", () => {
    const blocks = blocksFromPlainText("Erster Teil.\n\nZweiter Teil.");
    expect(blocks[0].paragraphs).toHaveLength(2);
  });

  it("fasst Zeilenumbrüche innerhalb eines Absatzes zusammen", () => {
    const blocks = blocksFromPlainText("Ein Satz\nwird fortgesetzt.");
    expect(blocks[0].paragraphs).toHaveLength(1);
    expect(blocks[0].paragraphs[0]).toBe("Ein Satz wird fortgesetzt.");
  });
});

describe("chunkBlocks", () => {
  it("hält MAX_TOKENS ein", () => {
    const long = "Ein mittellanger deutscher Satz mit Substanz. ".repeat(200);
    const chunks = chunkBlocks([{ headingPath: "K1", paragraphs: [long] }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(MAX_TOKENS + 60); // + Overlap-Toleranz
    }
  });

  it("zerschneidet keine Sätze", () => {
    const long = "Der Satz endet hier. ".repeat(400);
    const chunks = chunkBlocks([{ headingPath: "", paragraphs: [long] }]);
    for (const c of chunks) {
      // Jeder Chunk endet auf einem Satzzeichen (Overlap eingeschlossen)
      expect(c.text.trim()).toMatch(/[.!?…]$/);
    }
  });

  it("vergibt den Heading-Pfad an jeden Chunk", () => {
    const long = "Text. ".repeat(500);
    const chunks = chunkBlocks([{ headingPath: "Kapitel 2 › Szene 1", paragraphs: [long] }]);
    for (const c of chunks) {
      expect(c.headingPath).toBe("Kapitel 2 › Szene 1");
    }
  });

  it("nummeriert Chunks lückenlos", () => {
    const chunks = chunkBlocks([
      { headingPath: "A", paragraphs: ["Text. ".repeat(300)] },
      { headingPath: "B", paragraphs: ["Text. ".repeat(300)] },
    ]);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("verschmilzt winzige Chunks mit gleichem Heading-Pfad", () => {
    const chunks = chunkBlocks([{ headingPath: "A", paragraphs: ["Kurz.", "Auch kurz."] }]);
    expect(chunks).toHaveLength(1);
  });

  it("verschmilzt NICHT über Heading-Grenzen hinweg", () => {
    const chunks = chunkBlocks([
      { headingPath: "A", paragraphs: ["Kurz."] },
      { headingPath: "B", paragraphs: ["Auch kurz."] },
    ]);
    expect(chunks).toHaveLength(2);
  });

  it("liefert für leere Eingabe ein leeres Ergebnis", () => {
    expect(chunkBlocks([])).toEqual([]);
    expect(chunkBlocks([{ headingPath: "A", paragraphs: [] }])).toEqual([]);
  });

  it("verliert keinen Inhalt, auch nicht bei sehr kurzen Absätzen", () => {
    // Regressionstest: früher wurde der Restpuffer verworfen, wenn er
    // OVERLAP_TOKENS nicht überschritt — kurze Absätze verschwanden lautlos.
    const chunks = chunkBlocks([{ headingPath: "A", paragraphs: ["Nur ein kurzer Satz."] }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("kurzer Satz");
  });

  it("übernimmt jeden Absatz in mindestens einen Chunk", () => {
    const paragraphs = ["Absatz eins ist hier.", "Absatz zwei folgt.", "Absatz drei schließt ab."];
    const chunks = chunkBlocks([{ headingPath: "A", paragraphs }]);
    const joined = chunks.map((c) => c.text).join("\n");
    for (const p of paragraphs) {
      expect(joined).toContain(p);
    }
  });
});

describe("Komfort-Einstiege", () => {
  it("chunkTiptap verarbeitet ein Dokument end-to-end", () => {
    const json = tiptap([heading(1, "Kapitel 1"), para("Ein Absatz mit genug Text für einen Chunk.")]);
    const chunks = chunkTiptap(json, "Roman");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe("Roman › Kapitel 1");
  });

  it("chunkPlainText verarbeitet Markdown end-to-end", () => {
    const chunks = chunkPlainText("# Figur: Anna\n\nAnna ist 34 Jahre alt und Ärztin.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Anna ist 34");
  });
});
