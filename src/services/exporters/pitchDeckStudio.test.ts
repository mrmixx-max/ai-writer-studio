// Unit-Tests für den Pitch-Deck-Studio-Service (WP 25.1).
// Exposé-Labor & Normseiten-Maschine — lokal, deterministisch, ohne LLM.

import { describe, it, expect } from "vitest";
import {
  generateExposé,
  generateExpose,
  generateNormPage,
  generateNormPages,
  countNormPages,
  extractPlainText,
  NORM_LINES_PER_PAGE,
  NORM_CHARS_PER_LINE,
  NORM_CHARS_PER_PAGE,
  type ManuscriptProject,
} from "./pitchDeckStudio";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<ManuscriptProject> = {}): ManuscriptProject {
  return {
    title: "Der stille Fluss",
    author: "Erika Muster",
    premise: "Eine Ermittlerin kehrt in ihr Heimatdorf zurück und stößt auf ein altes Geheimnis.",
    logline: "Eine Ermittlerin deckt ein jahrzehntealtes Verbrechen in ihrem Heimatdorf auf.",
    chapters: [
      { id: "c1", title: "Ankunft", content: "Der Zug hielt im Nebel. Mara stieg aus. Nichts war wie früher." },
      { id: "c2", title: "Der Fund", content: "Am Ufer lag ein Brief. Sie erkannte die Handschrift sofort." },
      { id: "c3", title: "Das Geständnis", content: "Der alte Mann schwieg lange. Dann begann er zu erzählen." },
    ],
    characters: [
      { name: "Mara Voss", role: "Protagonistin", description: "Ermittlerin, kühl und beobachtend. Sie lernt zu vertrauen." },
      { name: "Hendrik", role: "Antagonist", description: "Der Dorfvorsteher hütet ein Geheimnis." },
    ],
    ...overrides,
  };
}

/** Erzeugt einen langen Absatz, der zuverlässig über mehrere Normseiten läuft. */
function longParagraph(words = 400): string {
  return Array.from({ length: words }, (_, i) => `wort${i % 100}`).join(" ");
}

// ---------------------------------------------------------------------------
// generateExposé — Exposé-Labor
// ---------------------------------------------------------------------------

describe("generateExposé", () => {
  it("verwendet eine vorhandene Logline unverändert", () => {
    const ex = generateExposé(makeProject());
    expect(ex.logline).toBe(
      "Eine Ermittlerin deckt ein jahrzehntealtes Verbrechen in ihrem Heimatdorf auf.",
    );
  });

  it("leitet die Logline aus der Prämisse ab, wenn keine Logline gesetzt ist", () => {
    const ex = generateExposé(makeProject({ logline: undefined }));
    expect(ex.logline).toBe(
      "Eine Ermittlerin kehrt in ihr Heimatdorf zurück und stößt auf ein altes Geheimnis.",
    );
  });

  it("leitet die Logline aus dem ersten Kapitelsatz ab, wenn Prämisse und Logline fehlen", () => {
    const ex = generateExposé(makeProject({ logline: undefined, premise: undefined }));
    expect(ex.logline).toBe("Der Zug hielt im Nebel.");
  });

  it("leitet die Prämisse aus den Kapiteln ab, wenn keine Prämisse gesetzt ist", () => {
    const ex = generateExposé(makeProject({ premise: undefined }));
    expect(ex.premise).toContain("Der Zug hielt im Nebel.");
    expect(ex.premise).toContain("Am Ufer lag ein Brief.");
  });

  it("kombiniert Logline und Prämisse zum Pitch", () => {
    const ex = generateExposé(makeProject());
    expect(ex.pitch).toContain(ex.logline);
    expect(ex.pitch).toContain(ex.premise);
  });

  it("erzeugt eine Kurzbiografie je Figur mit Name, Rolle und Bogen", () => {
    const ex = generateExposé(makeProject());
    expect(ex.characters).toHaveLength(2);
    expect(ex.characters[0]).toEqual({
      name: "Mara Voss",
      role: "Protagonistin",
      arc: "Ermittlerin, kühl und beobachtend.",
    });
    expect(ex.characters[1].name).toBe("Hendrik");
    expect(ex.characters[1].arc).toBe("Der Dorfvorsteher hütet ein Geheimnis.");
  });

  it("erzeugt eine Handlungsübersicht mit einem Eintrag pro Kapitel", () => {
    const ex = generateExposé(makeProject());
    expect(ex.actionOutline).toHaveLength(3);
    expect(ex.actionOutline[0]).toBe("Ankunft — Der Zug hielt im Nebel.");
    expect(ex.actionOutline[2]).toBe("Das Geständnis — Der alte Mann schwieg lange.");
  });

  it("enthält alle Kapitel in der Synopse", () => {
    const ex = generateExposé(makeProject());
    expect(ex.synopsis).toContain("Ankunft:");
    expect(ex.synopsis).toContain("Der Fund:");
    expect(ex.synopsis).toContain("Das Geständnis:");
  });

  it("ist defensiv bei einem null-Projekt (kein Throw, sinnvolle Fallbacks)", () => {
    const ex = generateExposé(null);
    expect(ex.logline).toBeTruthy();
    expect(ex.pitch).toBeTruthy();
    expect(ex.premise).toBeTruthy();
    expect(ex.characters).toEqual([]);
    expect(ex.actionOutline).toEqual([]);
  });

  it("ist defensiv bei fehlenden Kapiteln und Figuren", () => {
    const ex = generateExposé(
      makeProject({ chapters: [], characters: [], logline: undefined, premise: undefined }),
    );
    expect(ex.actionOutline).toEqual([]);
    expect(ex.characters).toEqual([]);
    expect(ex.logline).toContain("Der stille Fluss");
  });

  it("extrahiert Text aus TipTap-JSON-Kapitelinhalten", () => {
    const tiptap = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Es war einmal ein Dorf." }],
        },
      ],
    });
    const ex = generateExposé(
      makeProject({
        logline: undefined,
        premise: undefined,
        chapters: [{ id: "c1", title: "Start", content: tiptap }],
      }),
    );
    expect(ex.logline).toBe("Es war einmal ein Dorf.");
    expect(ex.actionOutline[0]).toBe("Start — Es war einmal ein Dorf.");
  });

  it("generateExpose ist ein Alias für generateExposé", () => {
    expect(generateExpose).toBe(generateExposé);
  });
});

// ---------------------------------------------------------------------------
// generateNormPage — Normseiten-Maschine
// ---------------------------------------------------------------------------

describe("generateNormPage", () => {
  it("begrenzt die Seite auf 30 Zeilen und jede Zeile auf 60 Anschläge", () => {
    const page = generateNormPage(longParagraph());
    expect(page.pageNumber).toBe(1);
    expect(page.lines.length).toBeLessThanOrEqual(NORM_LINES_PER_PAGE);
    for (const line of page.lines) {
      expect(line.charCount).toBe(line.text.length);
      expect(line.charCount).toBeLessThanOrEqual(NORM_CHARS_PER_LINE);
    }
  });

  it("zerschneidet niemals Wörter mitten im Zeichen", () => {
    const text = longParagraph();
    const allLines = generateNormPages(text).flatMap((p) => p.lines);
    for (const line of allLines) {
      // Keine führenden/abschließenden Leerzeichen; Wörter bleiben intakt.
      expect(line.text).toBe(line.text.trim());
      expect(line.text).not.toMatch(/\s{2,}/);
    }
    // Über alle Seiten hinweg bleibt der Wortlaut vollständig erhalten.
    const reconstructed = allLines.map((l) => l.text).join(" ");
    expect(reconstructed).toBe(text);
  });

  it("stellt ein überlanges Wort allein auf eine (überlange) Zeile", () => {
    const monster = "Wort".padEnd(65, "x");
    const page = generateNormPage(`${monster} und weiter`);
    expect(page.lines[0].text).toBe(monster);
    expect(page.lines[0].charCount).toBe(65);
    expect(page.lines[0].charCount).toBeGreaterThan(NORM_CHARS_PER_LINE);
    expect(page.lines[1].text).toBe("und weiter");
  });

  it("gibt bei leerem Text eine leere Seite 1 zurück", () => {
    const page = generateNormPage("");
    expect(page.pageNumber).toBe(1);
    expect(page.lines).toEqual([]);
  });

  it("behandelt Nicht-String-Eingaben defensiv", () => {
    const page = generateNormPage(undefined as unknown as string);
    expect(page.pageNumber).toBe(1);
    expect(page.lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateNormPages — vollständige Paginierung
// ---------------------------------------------------------------------------

describe("generateNormPages", () => {
  it("paginiert einen langen Text in mehrere Normseiten mit fortlaufender Nummer", () => {
    const pages = generateNormPages(longParagraph());
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page, i) => {
      expect(page.pageNumber).toBe(i + 1);
      expect(page.lines.length).toBeLessThanOrEqual(NORM_LINES_PER_PAGE);
    });
  });

  it("gibt bei leerem Text keine Seiten zurück", () => {
    expect(generateNormPages("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// countNormPages — Normseiten-Zähler
// ---------------------------------------------------------------------------

describe("countNormPages", () => {
  it("zählt 0 bei leerem oder whitespace-only Text", () => {
    expect(countNormPages("")).toBe(0);
    expect(countNormPages("   \n\t  ")).toBe(0);
  });

  it("zählt 1 für kurzen Text (weniger als eine Seite)", () => {
    expect(countNormPages("Ein einzelner Satz.")).toBe(1);
  });

  it("zählt genau 1 bei exakt 30 Zeilen und 2 bei 31 Zeilen", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => `Zeile ${i + 1}`).join("\n");
    const thirtyOne = Array.from({ length: 31 }, (_, i) => `Zeile ${i + 1}`).join("\n");
    expect(countNormPages(thirty)).toBe(1);
    expect(countNormPages(thirtyOne)).toBe(2);
  });

  it("stimmt mit der Länge von generateNormPages überein", () => {
    const text = longParagraph();
    expect(countNormPages(text)).toBe(generateNormPages(text).length);
  });

  it("NORM_CHARS_PER_PAGE entspricht 30 Zeilen à 60 Anschlägen", () => {
    expect(NORM_CHARS_PER_PAGE).toBe(1800);
    expect(NORM_CHARS_PER_PAGE).toBe(NORM_LINES_PER_PAGE * NORM_CHARS_PER_LINE);
  });
});

// ---------------------------------------------------------------------------
// extractPlainText — defensive Inhalts-Extraktion
// ---------------------------------------------------------------------------

describe("extractPlainText", () => {
  it("gibt Klartext unverändert (getrimmt) zurück", () => {
    expect(extractPlainText("  Hallo Welt  ")).toBe("Hallo Welt");
  });

  it("fällt bei ungültigem JSON auf den Rohstring zurück", () => {
    expect(extractPlainText("{kein json")).toBe("{kein json");
  });

  it("extrahiert Text rekursiv aus verschachteltem TipTap-JSON", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Erster Teil." }] },
        { type: "paragraph", content: [{ type: "text", text: "Zweiter Teil." }] },
      ],
    });
    expect(extractPlainText(json)).toBe("Erster Teil. Zweiter Teil.");
  });

  it("gibt bei leerem oder fehlendem Inhalt einen leeren String zurück", () => {
    expect(extractPlainText("")).toBe("");
    expect(extractPlainText(undefined as unknown as string)).toBe("");
  });
});
