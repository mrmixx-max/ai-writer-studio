// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ASPECT_RATIOS,
  getAspectRatio,
  THEMES,
  getTheme,
  createQuoteCard,
  createCarouselTemplate,
  buildExportSpec,
  createSampleQuoteCard,
  createSampleCarouselTemplate,
} from "./quoteCardGraphicStudio";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(13);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("ASPECT_RATIOS", () => {
  it("enthält drei Seitenverhältnisse", () => {
    expect(ASPECT_RATIOS).toHaveLength(3);
  });
  it("Quadrat ist 1080×1080", () => {
    expect(getAspectRatio("square")!.width).toBe(1080);
    expect(getAspectRatio("square")!.height).toBe(1080);
  });
  it("Porträt ist 1080×1350", () => {
    expect(getAspectRatio("portrait")!.height).toBe(1350);
  });
  it("Story ist 1080×1920", () => {
    expect(getAspectRatio("story")!.height).toBe(1920);
  });
  it("getAspectRatio liefert undefined für unbekannt", () => {
    expect(getAspectRatio("xyz" as never)).toBeUndefined();
  });
});

describe("THEMES", () => {
  it("enthält vier Stil-Themes", () => {
    expect(THEMES).toHaveLength(4);
  });
  it("jedes Theme hat Tokens und Vignette", () => {
    for (const t of THEMES) {
      expect(t.bgToken).toContain("var(--");
      expect(t.fgToken).toContain("var(--");
      expect(t.accentToken).toContain("var(--");
      expect(t.vignette.length).toBeGreaterThan(10);
    }
  });
  it("keine Hex-Farben in den Themes", () => {
    for (const t of THEMES) {
      expect(t.vignette.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
    }
  });
  it("getTheme liefert undefined für unbekannt", () => {
    expect(getTheme("xyz" as never)).toBeUndefined();
  });
});

describe("createQuoteCard", () => {
  it("ist deterministisch", () => {
    const a = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", seed: 42 });
    const b = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", seed: 42 });
    expect(a.id).toBe(b.id);
  });
  it("erzeugt SVG mit Zitat und Autor", () => {
    const c = createQuoteCard({ quote: "Hallo Welt", author: "Erik", bookTitle: "Buch", seed: 42 });
    expect(c.svg).toContain("Hallo Welt");
    expect(c.svg).toContain("Erik");
    expect(c.svg).toContain("Buch");
  });
  it("nutzt Design-Tokens, keine Hex-Farben", () => {
    const c = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", seed: 42 });
    expect(c.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("bricht Text in Zeilen um", () => {
    const c = createQuoteCard({
      quote: "Dies ist ein sehr langes Zitat, das über mehrere Zeilen umbrochen werden muss, um in die Karte zu passen",
      author: "A",
      bookTitle: "B",
      seed: 42,
    });
    expect(c.lineCount).toBeGreaterThan(1);
  });
  it("respektiert das Seitenverhältnis", () => {
    const c = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", aspectRatioId: "story", seed: 42 });
    expect(c.svg).toContain('width="1080"');
    expect(c.svg).toContain('height="1920"');
  });
  it("wendet das Theme an", () => {
    const c = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", themeId: "gothicRomance", seed: 42 });
    expect(c.theme.id).toBe("gothicRomance");
    expect(c.svg).toContain("Playfair Display");
  });
  it("unbekanntes Seitenverhältnis fällt auf Quadrat zurück", () => {
    const c = createQuoteCard({ quote: "Test", author: "A", bookTitle: "B", aspectRatioId: "xyz" as never, seed: 42 });
    expect(c.aspectRatio.id).toBe("square");
  });
});

describe("createCarouselTemplate", () => {
  it("ist deterministisch", () => {
    const a = createCarouselTemplate(["A", "B"], "Autor", "Buch", "square", "cozyFantasy", 42);
    const b = createCarouselTemplate(["A", "B"], "Autor", "Buch", "square", "cozyFantasy", 42);
    expect(a.id).toBe(b.id);
  });
  it("erzeugt eine Folie je Zitat", () => {
    const t = createCarouselTemplate(["Eins", "Zwei", "Drei"], "A", "B", "portrait", "minimalModern", 42);
    expect(t.slides).toHaveLength(3);
  });
  it("Folien teilen Theme und Seitenverhältnis", () => {
    const t = createCarouselTemplate(["A", "B"], "A", "B", "story", "darkAcademia", 42);
    for (const s of t.slides) {
      expect(s.theme.id).toBe("darkAcademia");
      expect(s.aspectRatio.id).toBe("story");
    }
  });
});

describe("buildExportSpec", () => {
  it("liefert SVG-Export mit 300 DPI", () => {
    const spec = buildExportSpec(createSampleQuoteCard(), "svg", 300);
    expect(spec.format).toBe("svg");
    expect(spec.dpi).toBe(300);
    expect(spec.width).toBe(1080);
  });
  it("PNG-Export hat dieselbe Auflösung", () => {
    const spec = buildExportSpec(createSampleQuoteCard(), "png", 300);
    expect(spec.format).toBe("png");
    expect(spec.height).toBe(1080);
  });
  it("Export-Hinweise sind gesetzt", () => {
    expect(buildExportSpec(createSampleQuoteCard()).notes.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleQuoteCard liefert eine Dark-Academia-Karte", () => {
    expect(createSampleQuoteCard().theme.id).toBe("darkAcademia");
  });
  it("createSampleCarouselTemplate liefert ein Gothic-Romance-Karussell", () => {
    expect(createSampleCarouselTemplate().theme.id).toBe("gothicRomance");
  });
});
