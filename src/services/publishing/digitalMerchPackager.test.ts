// Tests: Digital-Merch- & Lesezeichen-Studio-Service (WP 47.2)
import { describe, it, expect } from "vitest";
import {
  generateBookmark,
  generateWallpaper,
  selectQuotes,
  packageFanBundle,
  BOOKMARK_WIDTH_MM,
  BOOKMARK_HEIGHT_MM,
  BOOKMARK_DPI,
  BOOKMARK_WIDTH_PX,
  BOOKMARK_HEIGHT_PX,
  WALLPAPER_WIDTH_PX,
  WALLPAPER_HEIGHT_PX,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT,
  DEFAULT_QUOTE,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_THANK_YOU_MESSAGE,
  FAN_BUNDLE_VERSION,
} from "./digitalMerchPackager";
import type { BookmarkOptions, FanBundleItem, FanBundleItemKind } from "./digitalMerchPackager";

/** Extrahiert den sichtbaren Text eines SVG (tspan-Inhalte, mit Leerzeichen verbunden). */
function visibleText(svg: string): string {
  return [...svg.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map((m) => m[1]).join(" ");
}

const FULL_OPTIONS: BookmarkOptions = {
  font: "Georgia, serif",
  frameStyle: "minimal",
  backgroundColor: "#101020",
  textColor: "#f0e0c0",
};

// ---------------------------------------------------------------------------
// generateBookmark
// ---------------------------------------------------------------------------

describe("generateBookmark", () => {
  it("liefert 50×200mm bei 300 DPI", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", FULL_OPTIONS);
    expect(d.widthMm).toBe(BOOKMARK_WIDTH_MM);
    expect(d.heightMm).toBe(BOOKMARK_HEIGHT_MM);
    expect(d.dpi).toBe(BOOKMARK_DPI);
    expect(d.widthMm).toBe(50);
    expect(d.heightMm).toBe(200);
    expect(d.dpi).toBe(300);
  });

  it("rechnet 50×200mm@300DPI korrekt in Pixel um (591×2362)", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", FULL_OPTIONS);
    expect(BOOKMARK_WIDTH_PX).toBe(591);
    expect(BOOKMARK_HEIGHT_PX).toBe(2362);
    expect(d.svg).toContain('width="591"');
    expect(d.svg).toContain('height="2362"');
  });

  it("enthält valides SVG-Grundgerüst", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", FULL_OPTIONS);
    expect(d.svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(d.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(d.svg).toContain('viewBox="0 0 591 2362"');
    expect(d.svg).toContain("</svg>");
  });

  it("übernimmt das Zitat", () => {
    const d = generateBookmark("Mut ist Angst plus ein Schritt", FULL_OPTIONS);
    expect(d.quote).toBe("Mut ist Angst plus ein Schritt");
    expect(visibleText(d.svg)).toBe("Mut ist Angst plus ein Schritt");
  });

  it("nutzt Default-Schrift bei leerer Options", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {} as BookmarkOptions);
    expect(d.font).toBe(DEFAULT_FONT);
  });

  it("nutzt Default-Rahmenstil (minimal) bei unbekanntem Wert", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {} as BookmarkOptions);
    expect(d.frameStyle).toBe("minimal");
  });

  it("ornate-Rahmen enthält doppelten Rahmen und Eckornamente", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {
      ...FULL_OPTIONS,
      frameStyle: "ornate",
    });
    expect(d.frameStyle).toBe("ornate");
    expect(d.svg).toContain('stroke-width="6"');
    expect(d.svg).toContain("<circle");
  });

  it("none-Rahmen enthält keine Rahmenkontur", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {
      ...FULL_OPTIONS,
      frameStyle: "none",
    });
    expect(d.frameStyle).toBe("none");
    expect(d.svg).not.toContain("stroke=");
  });

  it("ungültige Farben fallen auf Defaults zurück", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {
      ...FULL_OPTIONS,
      backgroundColor: "javascript:alert(1)",
      textColor: "url(#evil)",
    });
    expect(d.svg).toContain(DEFAULT_BACKGROUND_COLOR);
    expect(d.svg).toContain(DEFAULT_TEXT_COLOR);
  });

  it("leeres Zitat ergibt Default-Zitat", () => {
    const d = generateBookmark("   ", FULL_OPTIONS);
    expect(d.quote).toBe(DEFAULT_QUOTE);
    expect(visibleText(d.svg)).toBe(DEFAULT_QUOTE);
  });

  it("null-Options wird defensiv behandelt", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", null);
    expect(d.widthMm).toBe(50);
    expect(d.font).toBe(DEFAULT_FONT);
    expect(d.frameStyle).toBe("minimal");
  });

  it("escapet XML-Sonderzeichen im Zitat", () => {
    const d = generateBookmark('Er rief: "Halt!"', FULL_OPTIONS);
    expect(d.svg).toContain("&quot;Halt!&quot;");
    expect(d.svg).not.toContain('"Halt!"');
  });

  it("escapet Ampersand im Zitat", () => {
    const d = generateBookmark("Salz & Pfeffer und Liebe", FULL_OPTIONS);
    expect(visibleText(d.svg)).toBe("Salz &amp; Pfeffer und Liebe");
  });

  it("sanitisiert die Schriftfamilie (keine Markup-Injektion)", () => {
    const d = generateBookmark("Ein gutes Zitat über die Liebe", {
      ...FULL_OPTIONS,
      font: "<script>alert(1)</script>",
    });
    expect(d.font).toBe("scriptalert1script");
    expect(d.svg).not.toContain("<script");
  });

  it("ist deterministisch", () => {
    const a = generateBookmark("Ein gutes Zitat über die Liebe", FULL_OPTIONS);
    const b = generateBookmark("Ein gutes Zitat über die Liebe", FULL_OPTIONS);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// generateWallpaper
// ---------------------------------------------------------------------------

describe("generateWallpaper", () => {
  it("liefert Default-Maße 1080×2400", () => {
    const d = generateWallpaper("Ein gutes Zitat über die Liebe", {
      width: 1080,
      height: 2400,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      fontSize: 72,
    });
    expect(WALLPAPER_WIDTH_PX).toBe(1080);
    expect(WALLPAPER_HEIGHT_PX).toBe(2400);
    expect(d.width).toBe(1080);
    expect(d.height).toBe(2400);
  });

  it("übernimmt benutzerdefinierte Maße", () => {
    const d = generateWallpaper("Ein gutes Zitat über die Liebe", {
      width: 1440,
      height: 3120,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      fontSize: 90,
    });
    expect(d.width).toBe(1440);
    expect(d.height).toBe(3120);
    expect(d.svg).toContain('width="1440"');
    expect(d.svg).toContain('height="3120"');
  });

  it("ungültige Maße (NaN/Infinity) fallen auf Defaults zurück", () => {
    const d = generateWallpaper("Ein gutes Zitat über die Liebe", {
      width: NaN,
      height: Infinity,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      fontSize: NaN,
    });
    expect(d.width).toBe(1080);
    expect(d.height).toBe(2400);
  });

  it("zu kleine Breite wird auf Minimum 200 begrenzt", () => {
    const d = generateWallpaper("Ein gutes Zitat über die Liebe", {
      width: 50,
      height: 2400,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      fontSize: 72,
    });
    expect(d.width).toBe(200);
  });

  it("leeres Zitat ergibt Default-Zitat", () => {
    const d = generateWallpaper("", {
      width: 1080,
      height: 2400,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      fontSize: 72,
    });
    expect(d.quote).toBe(DEFAULT_QUOTE);
  });

  it("null-Options wird defensiv behandelt", () => {
    const d = generateWallpaper("Ein gutes Zitat über die Liebe", null);
    expect(d.width).toBe(1080);
    expect(d.height).toBe(2400);
  });

  it("enthält valides SVG-Grundgerüst und ist deterministisch", () => {
    const opts = {
      width: 1080,
      height: 2400,
      backgroundColor: "#123456",
      textColor: "#abcdef",
      fontSize: 72,
    };
    const a = generateWallpaper("Ein gutes Zitat über die Liebe", opts);
    const b = generateWallpaper("Ein gutes Zitat über die Liebe", opts);
    expect(a.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(a.svg).toContain("</svg>");
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// selectQuotes
// ---------------------------------------------------------------------------

const MANUSCRIPT = [
  "Der Himmel war heute wirklich sehr blau.",
  "„Ich liebe dich!“, flüsterte sie.",
  "Kurz.",
  "Die Sonne schien über dem alten Dorf.",
  "Ein zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn.",
].join(" ");

describe("selectQuotes", () => {
  it("liefert höchstens count Zitate", () => {
    expect(selectQuotes(MANUSCRIPT, 3)).toHaveLength(3);
    expect(selectQuotes(MANUSCRIPT, 2)).toHaveLength(2);
  });

  it("schließt zu kurze Sätze (<5 Wörter) aus", () => {
    const result = selectQuotes(MANUSCRIPT, 10);
    expect(result).not.toContain("Kurz.");
  });

  it("schließt zu lange Sätze (>15 Wörter) aus", () => {
    const result = selectQuotes(MANUSCRIPT, 10);
    expect(result.some((q) => q.split(/\s+/).length > 15)).toBe(false);
  });

  it("bevorzugt Dialog bzw. leidenschaftliche Aussagen", () => {
    const result = selectQuotes(MANUSCRIPT, 1);
    expect(result[0]).toContain("Ich liebe dich");
  });

  it("nimmt Sätze mit genau 5 Wörtern auf", () => {
    const result = selectQuotes("Ich liebe dich für immer.", 5);
    expect(result).toContain("Ich liebe dich für immer.");
  });

  it("nimmt Sätze mit genau 15 Wörtern auf", () => {
    const result = selectQuotes(
      "Ein zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn.",
      5,
    );
    expect(result).toHaveLength(1);
  });

  it("entfernt Duplikate (case-insensitiv)", () => {
    const text =
      "Der Himmel war heute wirklich sehr blau. der himmel war heute wirklich sehr blau.";
    expect(selectQuotes(text, 5)).toHaveLength(1);
  });

  it("respektiert die Reihenfolge bei gleichem Rang", () => {
    const text = "Der Himmel war heute wirklich sehr blau. Die Sonne schien über dem alten Dorf.";
    const result = selectQuotes(text, 1);
    expect(result[0]).toBe("Der Himmel war heute wirklich sehr blau.");
  });

  it("gibt bei count > Kandidaten alle Kandidaten zurück", () => {
    const result = selectQuotes(MANUSCRIPT, 50);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("Nicht-String-Manuskript ergibt leeres Array", () => {
    expect(selectQuotes(null as unknown as string, 5)).toEqual([]);
    expect(selectQuotes(undefined as unknown as string, 5)).toEqual([]);
  });

  it("count 0 ergibt leeres Array", () => {
    expect(selectQuotes(MANUSCRIPT, 0)).toEqual([]);
  });

  it("count NaN/Infinity ergibt leeres Array", () => {
    expect(selectQuotes(MANUSCRIPT, NaN)).toEqual([]);
    expect(selectQuotes(MANUSCRIPT, Infinity)).toEqual([]);
  });

  it("ist deterministisch", () => {
    expect(selectQuotes(MANUSCRIPT, 4)).toEqual(selectQuotes(MANUSCRIPT, 4));
  });
});

// ---------------------------------------------------------------------------
// packageFanBundle
// ---------------------------------------------------------------------------

const ITEMS: FanBundleItem[] = [
  { id: "bm-1", kind: "bookmark", name: "Lesezeichen 1", data: "<svg>bm</svg>" },
  { id: "wp-1", kind: "wallpaper", name: "Wallpaper 1", data: "<svg>wp</svg>" },
];

describe("packageFanBundle", () => {
  it("ergänzt immer eine Dankeskarte", () => {
    const bundle = packageFanBundle(ITEMS, "Autorin", "Danke für alles!");
    const card = bundle.items.find((i) => i.id === "dankeskarte");
    expect(card).toBeDefined();
    expect(card?.kind).toBe("quote-card");
    expect(card?.name).toBe("Dankeskarte");
  });

  it("übernimmt die übergebenen Artikel in Reihenfolge", () => {
    const bundle = packageFanBundle(ITEMS, "Autorin", "Danke für alles!");
    expect(bundle.items[0].id).toBe("bm-1");
    expect(bundle.items[1].id).toBe("wp-1");
    expect(bundle.items).toHaveLength(3);
  });

  it("erzeugt ein valides JSON-Manifest", () => {
    const bundle = packageFanBundle(ITEMS, "Autorin", "Danke für alles!");
    const manifest = JSON.parse(bundle.manifest);
    expect(manifest.version).toBe(FAN_BUNDLE_VERSION);
    expect(manifest.kind).toBe("fan-bundle");
    expect(manifest.id).toBe(bundle.id);
    expect(manifest.itemCount).toBe(bundle.items.length);
    expect(Array.isArray(manifest.items)).toBe(true);
    expect(manifest.items).toHaveLength(bundle.items.length);
  });

  it("nutzt Defaults für leeren Autor und leere Nachricht", () => {
    const bundle = packageFanBundle([], "", "");
    expect(bundle.authorName).toBe(DEFAULT_AUTHOR_NAME);
    expect(bundle.thankYouMessage).toBe(DEFAULT_THANK_YOU_MESSAGE);
  });

  it("macht doppelte IDs eindeutig", () => {
    const dup: FanBundleItem[] = [
      { id: "x", kind: "bookmark", name: "A", data: "a" },
      { id: "x", kind: "wallpaper", name: "B", data: "b" },
    ];
    const bundle = packageFanBundle(dup, "Autor", "Danke");
    expect(bundle.items.map((i) => i.id)).toEqual(["x", "x-1", "dankeskarte"]);
  });

  it("vergibt Fallback-ID bei fehlender ID", () => {
    const bundle = packageFanBundle(
      [{ id: "", kind: "bookmark", name: "A", data: "a" }],
      "Autor",
      "Danke",
    );
    expect(bundle.items[0].id).toBe("item-0");
  });

  it("unbekannte Artikel-Art wird zu quote-card", () => {
    const bundle = packageFanBundle(
      [{ id: "k", kind: "poster" as unknown as FanBundleItemKind, name: "P", data: "d" }],
      "Autor",
      "Danke",
    );
    expect(bundle.items[0].kind).toBe("quote-card");
  });

  it("behält die Artikeldaten unverändert", () => {
    const bundle = packageFanBundle(ITEMS, "Autor", "Danke");
    expect(bundle.items[0].data).toBe("<svg>bm</svg>");
  });

  it("vergibt eine deterministische Bundle-ID", () => {
    const a = packageFanBundle(ITEMS, "Autorin", "Danke für alles!");
    const b = packageFanBundle(ITEMS, "Autorin", "Danke für alles!");
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith("fanbundle-")).toBe(true);
  });

  it("unterschiedliche Autoren ergeben unterschiedliche Bundle-IDs", () => {
    const a = packageFanBundle(ITEMS, "Autorin A", "Danke");
    const b = packageFanBundle(ITEMS, "Autorin B", "Danke");
    expect(a.id).not.toBe(b.id);
  });

  it("Nicht-Array items ergibt nur die Dankeskarte", () => {
    const bundle = packageFanBundle(null as unknown as FanBundleItem[], "Autor", "Danke");
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].id).toBe("dankeskarte");
  });

  it("vorhandene dankeskarte-ID wird nicht überschrieben", () => {
    const bundle = packageFanBundle(
      [{ id: "dankeskarte", kind: "quote-card", name: "Eigene", data: "x" }],
      "Autor",
      "Danke",
    );
    expect(bundle.items.map((i) => i.id)).toEqual(["dankeskarte", "dankeskarte-1"]);
  });
});
