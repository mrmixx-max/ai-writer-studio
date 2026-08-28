// Tests: Adaptive Chunk-Größen-Heuristik in chunking.ts.
//
// Die Heuristik kombiniert Satz- und Absatz-Analyse statt fester Zeichenlimits:
//  - adaptiveTargetTokens passt die Zielgröße an die Satzdichte an
//  - Chunks enden an Satzgrenzen (Sätze werden nie zerschnitten)
//  - Absätze bleiben als Sinneinheiten erhalten, wo möglich
//  - Garantien: MAX_TOKENS nie überschritten, Heading-Pfad bleibt erhalten

import { describe, it, expect } from "vitest";
import {
  TARGET_TOKENS,
  MAX_TOKENS,
  estimateTokens,
  adaptiveTargetTokens,
  splitSentences,
  blocksFromPlainText,
  blocksFromTiptap,
  chunkBlocks,
  chunkPlainText,
} from "@/services/knowledge/chunking";

/** Erzeugt einen Absatz aus n Sätzen à ~30 Zeichen (kurze Sätze). */
function shortSentences(n: number): string {
  return Array.from({ length: n }, (_, i) => `Satz Nummer ${i} endet hier.`).join(" ");
}

/** Erzeugt einen Absatz aus n sehr langen, verschachtelten Sätzen. */
function longSentences(n: number): string {
  return Array.from({ length: n }, (_, i) =>
    `Der ${i}. Satz beschreibt mit vielen Einschüben und langen Nebensatzkonstruktionen, die das Gesamtbild der Handlung sehr detailliert zeichnen, wie sich die Lage langsam aber unaufhaltsam zuspitzt und dabei die Motive aller Beteiligten offengelegt werden.`
  ).join(" ");
}

describe("adaptiveTargetTokens — Satzdichte-Analyse", () => {
  it("liefert TARGET_TOKENS für leeren/kurzen Text", () => {
    expect(adaptiveTargetTokens("")).toBe(TARGET_TOKENS);
    expect(adaptiveTargetTokens("kurz")).toBe(TARGET_TOKENS);
  });

  it("verkleinert die Zielgröße bei vielen kurzen Sätzen (Action-Szenen)", () => {
    const text = shortSentences(30); // viele Sätze < 40 Zeichen
    expect(adaptiveTargetTokens(text)).toBeLessThan(TARGET_TOKENS);
  });

  it("vergrößert die Zielgröße bei langen Sätzen (philosophische Passagen)", () => {
    const text = longSentences(6); // lange Sätze > 120 Zeichen
    expect(adaptiveTargetTokens(text)).toBeGreaterThan(TARGET_TOKENS);
  });

  it("bleibt bei TARGET_TOKENS für durchschnittliche Satzlängen", () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `Dieser Satz hat eine mittlere Länge von etwa siebzig Zeichen, wie in Normalprosa üblich ${i}.`
    ).join(" ");
    expect(adaptiveTargetTokens(text)).toBe(TARGET_TOKENS);
  });

  it("bleibt innerhalb der erlaubten Bandbreite (TARGET/2 … TARGET*1.5)", () => {
    for (const text of [shortSentences(30), longSentences(6), "Normaler Text. Noch einer. Und ein dritter."]) {
      const t = adaptiveTargetTokens(text);
      expect(t).toBeGreaterThanOrEqual(TARGET_TOKENS / 2);
      expect(t).toBeLessThanOrEqual(TARGET_TOKENS * 1.5);
    }
  });
});

describe("chunkBlocks — Satz- und Absatz-Garantien", () => {
  it("zerschneidet keine Sätze: jeder Chunk endet an einer Satzgrenze", () => {
    const blocks = blocksFromPlainText(longSentences(12));
    const chunks = chunkBlocks(blocks);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      const trimmed = c.text.trim();
      // Letztes nicht-leeres Zeichen muss ein Satzzeichen sein (oder der Chunk ist ein Sonderfall)
      expect(trimmed).toMatch(/[.!?…»]$/);
    }
  });

  it("überschreitet MAX_TOKENS nie", () => {
    const blocks = blocksFromPlainText(`${shortSentences(60)}\n\n${longSentences(10)}`);
    const chunks = chunkBlocks(blocks);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });

  it("behält den Heading-Pfad in allen Chunks eines Blocks", () => {
    const md = "# Kapitel 5\n\nErster Absatz mit Inhalt.\n\nZweiter Absatz mit mehr Inhalt als zuvor.\n\nDritter Absatz, ebenfalls ausführlich formuliert für den Index.";
    const chunks = chunkPlainText(md);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.headingPath).toBe("Kapitel 5");
    }
  });

  it("nummeriert Chunks fortlaufend ab 0", () => {
    const md = `${shortSentences(40)}\n\n${shortSentences(40)}\n\n${shortSentences(40)}`;
    const chunks = chunkPlainText(md);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it("respektiert Absatzgrenzen: kurze Absätze werden nicht mitten im Absatz geschnitten", () => {
    // Drei kurze Absätze passen zusammen in einen Chunk → ein Chunk mit allen drei
    const paras = [shortSentences(2), shortSentences(2), shortSentences(2)];
    const chunks = chunkBlocks([{ headingPath: "X", paragraphs: paras }]);
    expect(chunks).toHaveLength(1);
    for (const p of paras) expect(chunks[0].text).toContain(p);
  });

  it("verschiebt Overlap-Kontext in den Folge-Chunk", () => {
    const md = Array.from({ length: 6 }, (_, i) => `Absatz ${i}: ${shortSentences(10)}`).join("\n\n");
    const chunks = chunkPlainText(md);
    if (chunks.length > 1) {
      const prev = chunks[0].text;
      const next = chunks[1].text;
      // Der Overlap besteht aus ganzen Sätzen des Vorgänger-Chunks
      const lastSentence = prev.trim().split(/(?<=[.!?])\s+/).pop()!;
      expect(next).toContain(lastSentence);
    }
  });

  it("verschmilzt winzige Chunks mit dem Vorgänger bei gleichem Heading-Pfad", () => {
    // Kurze Zeile nach einem großen Absatz im SELBEN Block → kein eigenes Fragment
    const md = `${shortSentences(30)}\n\nKurz.`;
    const chunks = chunkPlainText(md);
    const tiny = chunks.filter((c) => c.text.trim() === "Kurz.");
    expect(tiny).toHaveLength(0);
  });

  it("behält einen winzigen Chunk mit eigenem Heading-Pfad (keine Information vernichtet)", () => {
    // Eigene Überschrift = eigene Sinneinheit → wird NICHT in den fremden Block verschmolzen
    const md = `${shortSentences(30)}\n\n# Unterkapitel\n\nKurz.`;
    const chunks = chunkPlainText(md);
    expect(chunks.some((c) => c.headingPath === "Unterkapitel")).toBe(true);
  });
});

describe("splitSentences — Schutz vor Fehlsplits", () => {
  it("behandelt mehrteilige Abkürzungen (z. B., d. h.) als einen Satz", () => {
    const s = splitSentences("Das gilt z. B. hier. Neuer Satz.");
    expect(s).toHaveLength(2);
  });

  it("behandelt Ordinalzahlen (3. Kapitel) nicht als Satzende", () => {
    const s = splitSentences("Im 3. Kapitel passiert viel. Danach Ruhe.");
    expect(s).toHaveLength(2);
  });

  it("liefert bei satzlosem Text einen einzigen Teil", () => {
    expect(splitSentences("Nur Text ohne Punkt")).toHaveLength(1);
    expect(splitSentences("")).toHaveLength(0);
  });
});

describe("estimateTokens", () => {
  it("schätzt konservativ (~1 Token je 3,4 Zeichen)", () => {
    expect(estimateTokens("a".repeat(340))).toBe(100);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("blocksFromTiptap", () => {
  it("extrahiert Heading-Pfade aus verschachtelten Überschriften", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kapitel 3" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Der Brief" }] },
        { type: "paragraph", content: [{ type: "text", text: "Inhalt der Szene." }] },
      ],
    });
    const blocks = blocksFromTiptap(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].headingPath).toBe("Kapitel 3 › Der Brief");
  });

  it("liefert [] bei invalidem JSON", () => {
    expect(blocksFromTiptap("{kaputt")).toEqual([]);
  });
});
