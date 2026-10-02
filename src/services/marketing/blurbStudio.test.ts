// blurbStudio.test.ts — Tests für den Marketing-Studio-Service.
import { describe, it, expect } from "vitest";
import {
  generateBlurb,
  analyzeKdpKeywords,
  generateQuoteCard,
  type BlurbFormula,
  type BlurbInput,
  type QuoteCardOptions,
} from "./blurbStudio";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function sampleInput(overrides: Partial<BlurbInput> = {}): BlurbInput {
  return {
    title: "Die letzte Zukunft",
    genre: "Krimi",
    protagonist: "Eine Ermittlerin mit dunkler Vergangenheit",
    conflict: "Ein Mord, der nicht aufzuklären scheint",
    stakes: "Die Wahrheit könnte sie alles kosten",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateBlurb
// ---------------------------------------------------------------------------

describe("generateBlurb", () => {
  describe("hook-trouble-choice", () => {
    it("generiert einen Klappentext mit allen Feldern", () => {
      const result = generateBlurb("hook-trouble-choice", sampleInput());
      expect(result).toContain("Die letzte Zukunft");
      expect(result).toContain("Eine Ermittlerin mit dunkler Vergangenheit");
      expect(result).toContain("Ein Mord, der nicht aufzuklären scheint");
      expect(result).toContain("Die Wahrheit könnte sie alles kosten");
      expect(result.length).toBeGreaterThan(50);
    });

    it("verwendet Genre-spezifischen Hook für Krimi", () => {
      const result = generateBlurb("hook-trouble-choice", sampleInput({ genre: "Krimi" }));
      expect(result).toContain("Ein Mord. Ein Verdächtiger.");
    });

    it("verwendet Fallback für unbekanntes Genre", () => {
      const result = generateBlurb("hook-trouble-choice", sampleInput({ genre: "Western" }));
      expect(result).toContain("Eine Geschichte, die unter die Haut geht");
    });

    it("verwendet Fallbacks bei fehlenden Feldern", () => {
      const result = generateBlurb("hook-trouble-choice", {
        title: "",
        genre: "",
        protagonist: "",
        conflict: "",
        stakes: "",
      });
      expect(result).toContain("Unbekannter Titel");
      expect(result).toContain("Eine unvergessliche Hauptfigur");
      expect(result).toContain("Ein Konflikt, der keine Gnade kennt");
      expect(result).toContain("Alles steht auf dem Spiel");
    });
  });

  describe("meet-cute-obstacle-climax", () => {
    it("generiert einen Klappentext mit allen Feldern", () => {
      const result = generateBlurb("meet-cute-obstacle-climax", sampleInput());
      expect(result).toContain("Die letzte Zukunft");
      expect(result).toContain("Eine Ermittlerin mit dunkler Vergangenheit");
      expect(result).toContain("Ein Mord, der nicht aufzuklären scheint");
      expect(result).toContain("Die Wahrheit könnte sie alles kosten");
    });

    it("verwendet Genre-spezifischen Meet-Cute für Romantik", () => {
      const result = generateBlurb("meet-cute-obstacle-climax", sampleInput({ genre: "Romantik" }));
      expect(result).toContain("Ein verlorener Brief");
    });

    it("verwendet Fallback für unbekanntes Genre", () => {
      const result = generateBlurb("meet-cute-obstacle-climax", sampleInput({ genre: "Western" }));
      expect(result).toContain("Ein Zufall. Ein Blick.");
    });
  });

  describe("world-threat-hero", () => {
    it("generiert einen Klappentext mit allen Feldern", () => {
      const result = generateBlurb("world-threat-hero", sampleInput());
      expect(result).toContain("Die letzte Zukunft");
      expect(result).toContain("Eine Ermittlerin mit dunkler Vergangenheit");
      expect(result).toContain("Ein Mord, der nicht aufzuklären scheint");
      expect(result).toContain("Die Wahrheit könnte sie alles kosten");
    });

    it("beginnt mit Welt-Bedrohung", () => {
      const result = generateBlurb("world-threat-hero", sampleInput());
      expect(result).toContain("Die Welt, wie wir sie kennen, ist bedroht");
    });

    it("verwendet Fallback für unbekanntes Genre", () => {
      const result = generateBlurb("world-threat-hero", sampleInput({ genre: "Western" }));
      expect(result).toContain("Der Höhepunkt ist erreicht");
    });
  });

  describe("Defensive Fallbacks", () => {
    it("verwendet Fallback bei unbekannter Formel", () => {
      const result = generateBlurb("unknown-formula" as BlurbFormula, sampleInput());
      expect(result).toContain("Die letzte Zukunft");
      expect(result.length).toBeGreaterThan(50);
    });

    it("verwendet Fallback bei leerem Input", () => {
      const result = generateBlurb("hook-trouble-choice", {
        title: "",
        genre: "",
        protagonist: "",
        conflict: "",
        stakes: "",
      });
      expect(result).toContain("Unbekannter Titel");
      expect(result).toContain("Eine unvergessliche Hauptfigur");
    });
  });
});

// ---------------------------------------------------------------------------
// analyzeKdpKeywords
// ---------------------------------------------------------------------------

describe("analyzeKdpKeywords", () => {
  it("extrahiert 7 Keywords aus einem Text", () => {
    const text = "Ein Mord in der Nacht. Ein Mord, der keine Spuren hinterlässt. Ein Mord, der die Stadt in Angst versetzt.";
    const keywords = analyzeKdpKeywords(text);
    expect(keywords).toHaveLength(7);
    expect(keywords).toContain("mord");
  });

  it("entfernt Stopwörter", () => {
    const text = "Der Die Das Ein Eine Und Oder Aber Denn Weil Wenn Als Wie";
    const keywords = analyzeKdpKeywords(text);
    expect(keywords).not.toContain("der");
    expect(keywords).not.toContain("die");
    expect(keywords).not.toContain("das");
    expect(keywords).not.toContain("ein");
    expect(keywords).not.toContain("eine");
    expect(keywords).not.toContain("und");
    expect(keywords).not.toContain("oder");
  });

  it("verwendet Fallback bei leerem Text", () => {
    const keywords = analyzeKdpKeywords("");
    expect(keywords).toHaveLength(7);
    expect(keywords).toContain("bestseller");
    expect(keywords).toContain("buch");
  });

  it("verwendet Fallback bei nur Stopwörtern", () => {
    const keywords = analyzeKdpKeywords("der die das und oder");
    expect(keywords).toHaveLength(7);
    expect(keywords).toContain("bestseller");
  });

  it("sortiert Keywords nach Häufigkeit", () => {
    const text = "Mord Mord Mord Nacht Nacht Tatort";
    const keywords = analyzeKdpKeywords(text);
    expect(keywords[0]).toBe("mord");
    expect(keywords[1]).toBe("nacht");
  });

  it("verarbeitet Umlaube korrekt", () => {
    const text = "Über den Wolken muss die Freiheit wohl grenzenlos sein";
    const keywords = analyzeKdpKeywords(text);
    expect(keywords).toContain("ueber");
    expect(keywords).toContain("wolken");
    expect(keywords).toContain("freiheit");
  });

  it("verwendet Fallback bei weniger als 7 Keywords", () => {
    const text = "Mord Nacht";
    const keywords = analyzeKdpKeywords(text);
    expect(keywords).toHaveLength(7);
    expect(keywords).toContain("mord");
    expect(keywords).toContain("nacht");
    // Fallbacks werden aufgefüllt
    expect(keywords).toContain("bestseller");
  });
});

// ---------------------------------------------------------------------------
// generateQuoteCard
// ---------------------------------------------------------------------------

describe("generateQuoteCard", () => {
  it("generiert ein SVG mit Standard-Optionen", () => {
    const svg = generateQuoteCard("Ein gutes Buch ist ein Freund.", {});
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("width=\"800\"");
    expect(svg).toContain("height=\"400\"");
    expect(svg).toContain("Ein gutes Buch ist ein Freund.");
  });

  it("verwendet benutzerdefinierte Optionen", () => {
    const options: QuoteCardOptions = {
      width: 1200,
      height: 630,
      backgroundColor: "#ff0000",
      textColor: "#00ff00",
      font: "Arial, sans-serif",
    };
    const svg = generateQuoteCard("Test", options);
    expect(svg).toContain("width=\"1200\"");
    expect(svg).toContain("height=\"630\"");
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#00ff00");
    expect(svg).toContain("Arial, sans-serif");
  });

  it("escaped SVG-spezielle Zeichen", () => {
    const svg = generateQuoteCard("5 < 10 & 10 > 5", {});
    expect(svg).toContain("5 &lt; 10 &amp; 10 &gt; 5");
    expect(svg).not.toContain("5 < 10");
  });

  it("verwendet Fallback bei leerem Text", () => {
    const svg = generateQuoteCard("", {});
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("verwendet Fallback bei ungültigen Dimensionen", () => {
    const svg = generateQuoteCard("Test", { width: -100, height: 0 });
    expect(svg).toContain("width=\"800\"");
    expect(svg).toContain("height=\"400\"");
  });

  it("bricht langen Text in mehrere Zeilen um", () => {
    const longText = "Dies ist ein sehr langer Text, der in mehrere Zeilen umgebrochen werden sollte, um auf die Quote-Card zu passen.";
    const svg = generateQuoteCard(longText, {});
    const textMatches = svg.match(/<text /g);
    expect(textMatches!.length).toBeGreaterThan(1);
  });
});
