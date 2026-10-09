// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  NEWSPAPER_MASTHEADS,
  buildNewspaperClipping,
  applyVintageArtifacts,
  generateHalftoneDots,
  exportClippingPdf,
  createSampleClipping,
  createSampleMasthead,
} from "./newspaperClippingFabricator";

// ---------------------------------------------------------------------------
// Gemeinsame Testdaten
// ---------------------------------------------------------------------------

const BODY =
  "Die Bewohner der Küstenstadt berichten von ungewöhnlichen Lichtern, " +
  "die in den vergangenen Nächten über dem Hafen gesichtet wurden. " +
  "Der Hafenmeister bestätigte die Vorfälle, konnte jedoch keine " +
  "Erklärung liefern. Einige Fischer behaupten, die Lichter seien in " +
  "regelmäßigen Abständen aufgetaucht, andere sprechen von einem " +
  "einzigen, stetig wachsenden Schein.";

const BASE_INPUT = {
  headline: "Hafenstadt in Aufruhr",
  subheadline: "Seltsame Lichter über dem Wasser",
  body: BODY,
  mastheadId: "arkhamAdvertiser",
  date: "12. Oktober 1926",
};

const LONG_BODY = Array.from({ length: 500 }, (_, i) => `wort${i + 1}`).join(
  " ",
);

const MASTHEAD_BODY =
  "Ein ausführlicher Bericht über Handel, Wetter und die " +
  "Ereignisse der vergangenen Woche, verfasst von der Redaktion " +
  "und mit Sorgfalt auf die Spalten verteilt.";

const MASTHEAD_CASES: Array<{ id: string; name: string }> = [
  { id: "arkhamAdvertiser", name: "Arkham Advertiser" },
  { id: "theTimes", name: "The Times" },
  { id: "newYorkGazette", name: "New York Gazette" },
  { id: "voelkischer", name: "Völkischer Beobachter" },
];

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("arkham:1926:62000")).toBe(
      hashString("arkham:1926:62000"),
    );
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("arkhamAdvertiser")).not.toBe(hashString("theTimes"));
    expect(hashString("newYorkGazette")).not.toBe(hashString("voelkischer"));
  });

  it("liefert 32-bit unsigned Integer", () => {
    const h = hashString("Zeitungsschnitt");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("leerer String liefert einen gültigen Hash", () => {
    expect(typeof hashString("")).toBe("number");
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });

  it("bleibt über viele Aufrufe stabil", () => {
    const first = hashString("Stabilität");
    for (let i = 0; i < 50; i++) {
      expect(hashString("Stabilität")).toBe(first);
    }
  });

  it("liefert für Umlaute einen gültigen Hash", () => {
    const h = hashString("Über die Brücke – Völkischer Beobachter");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("liefert für Sonderzeichen einen gültigen Hash", () => {
    const h = hashString("!\"§$%&/()=?„“");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it("ähnliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("Seed")).not.toBe(hashString("Seed "));
    expect(hashString("1926")).not.toBe(hashString("1927"));
  });

  it("ist unabhängig von der Aufrufreihenfolge", () => {
    const a = hashString("eins");
    const b = hashString("zwei");
    expect(hashString("zwei")).toBe(b);
    expect(hashString("eins")).toBe(a);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    for (let i = 0; i < 5; i++) expect(r1()).not.toBe(r2());
  });

  it("liefert 500 Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(11);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("Seed 0 liefert gültige Werte", () => {
    const r = createSeededRandom(0);
    for (let i = 0; i < 20; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });

  it("negative Seeds liefern gültige Werte", () => {
    const r = createSeededRandom(-1);
    for (let i = 0; i < 20; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("sehr große Seeds liefern gültige Werte", () => {
    const r = createSeededRandom(0xffffffff);
    for (let i = 0; i < 20; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("erzeugt keine konstante Sequenz", () => {
    const r = createSeededRandom(7);
    const werte = new Set<number>();
    for (let i = 0; i < 50; i++) werte.add(r());
    expect(werte.size).toBeGreaterThan(1);
  });

  it("reproduziert die erste Sequenz exakt", () => {
    const a = createSeededRandom(123456);
    const erste = [a(), a(), a()];
    const b = createSeededRandom(123456);
    expect([b(), b(), b()]).toEqual(erste);
  });

  it("unterschiedliche Seeds erzeugen andere erste Werte", () => {
    expect(createSeededRandom(100)()).not.toBe(createSeededRandom(101)());
  });
});

// ---------------------------------------------------------------------------
// NEWSPAPER_MASTHEADS
// ---------------------------------------------------------------------------

describe("NEWSPAPER_MASTHEADS", () => {
  it("enthält genau 4 Einträge", () => {
    expect(NEWSPAPER_MASTHEADS).toHaveLength(4);
  });

  it("hat die erwarteten IDs", () => {
    const ids = NEWSPAPER_MASTHEADS.map((m) => m.id);
    expect(ids).toContain("arkhamAdvertiser");
    expect(ids).toContain("theTimes");
    expect(ids).toContain("newYorkGazette");
    expect(ids).toContain("voelkischer");
  });

  it("jeder Eintrag hat gültige id, name, description und typeface", () => {
    for (const m of NEWSPAPER_MASTHEADS) {
      expect(typeof m.id).toBe("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe("string");
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
      expect(["antiqua", "fraktur"]).toContain(m.typeface);
    }
  });

  it("typeface ist entweder antiqua oder fraktur", () => {
    for (const m of NEWSPAPER_MASTHEADS) {
      expect(["antiqua", "fraktur"]).toContain(m.typeface);
    }
  });

  it("die IDs sind eindeutig", () => {
    const ids = NEWSPAPER_MASTHEADS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("die Namen sind eindeutig", () => {
    const namen = NEWSPAPER_MASTHEADS.map((m) => m.name);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("enthält genau ein Fraktur-Blatt", () => {
    const fraktur = NEWSPAPER_MASTHEADS.filter((m) => m.typeface === "fraktur");
    expect(fraktur).toHaveLength(1);
    expect(fraktur[0].id).toBe("voelkischer");
  });

  it("enthält genau drei Antiqua-Blätter", () => {
    const antiqua = NEWSPAPER_MASTHEADS.filter((m) => m.typeface === "antiqua");
    expect(antiqua).toHaveLength(3);
  });

  it("arkhamAdvertiser ist ein Antiqua-Blatt", () => {
    const m = NEWSPAPER_MASTHEADS.find((x) => x.id === "arkhamAdvertiser");
    expect(m?.typeface).toBe("antiqua");
    expect(m?.name).toBe("Arkham Advertiser");
  });

  it("theTimes ist ein Antiqua-Blatt", () => {
    const m = NEWSPAPER_MASTHEADS.find((x) => x.id === "theTimes");
    expect(m?.typeface).toBe("antiqua");
    expect(m?.name).toBe("The Times");
  });

  it("newYorkGazette ist ein Antiqua-Blatt", () => {
    const m = NEWSPAPER_MASTHEADS.find((x) => x.id === "newYorkGazette");
    expect(m?.typeface).toBe("antiqua");
    expect(m?.name).toBe("New York Gazette");
  });

  it("voelkischer ist das Fraktur-Blatt", () => {
    const m = NEWSPAPER_MASTHEADS.find((x) => x.id === "voelkischer");
    expect(m?.typeface).toBe("fraktur");
    expect(m?.name).toBe("Völkischer Beobachter");
  });

  it("der erste Eintrag ist arkhamAdvertiser", () => {
    expect(NEWSPAPER_MASTHEADS[0].id).toBe("arkhamAdvertiser");
  });
});

// ---------------------------------------------------------------------------
// buildNewspaperClipping – allgemein
// ---------------------------------------------------------------------------

describe("buildNewspaperClipping", () => {
  it("liefert masthead, date, columns, columnCount und svg", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.masthead).toBe("Arkham Advertiser");
    expect(c.date).toBe("12. Oktober 1926");
    expect(Array.isArray(c.columns)).toBe(true);
    expect(typeof c.columnCount).toBe("number");
    expect(typeof c.svg).toBe("string");
    expect(c.svg).toContain("<svg");
  });

  it("columnCount liegt zwischen 3 und 5", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.columnCount).toBeGreaterThanOrEqual(3);
    expect(c.columnCount).toBeLessThanOrEqual(5);
  });

  it("columnCount ist eine ganze Zahl", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(Number.isInteger(c.columnCount)).toBe(true);
  });

  it("columns hat so viele Einträge wie columnCount", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.columns).toHaveLength(c.columnCount);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const c1 = buildNewspaperClipping(BASE_INPUT, 62000);
    const c2 = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c1.columnCount).toBe(c2.columnCount);
    expect(c1.svg).toBe(c2.svg);
    expect(c1.columns).toEqual(c2.columns);
  });

  it("unterschiedliche Seeds können unterschiedliche Spaltenzahlen erzeugen", () => {
    const counts = new Set<number>();
    for (let s = 0; s < 20; s++) {
      counts.add(buildNewspaperClipping(BASE_INPUT, s).columnCount);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it("jede Spalte ist ein nicht-leeres Array", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    for (const col of c.columns) {
      expect(Array.isArray(col)).toBe(true);
      expect(col.length).toBeGreaterThan(0);
    }
  });

  it("jede Zeile ist ein nicht-leerer String", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    for (const col of c.columns) {
      for (const line of col) {
        expect(typeof line).toBe("string");
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it("alle Spaltenzeilen haben die Blocksatz-Breite 42", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    for (const col of c.columns) {
      for (const line of col) {
        expect(line.length).toBe(42);
      }
    }
  });

  it("kein Wort des Fließtexts geht verloren", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    const inSpalten = c.columns
      .flatMap((col) => col.join(" ").split(/\s+/))
      .filter((w) => w.length > 0);
    const ausBody = BODY.split(/\s+/).filter((w) => w.length > 0);
    expect(inSpalten).toEqual(ausBody);
  });

  it("svg beginnt mit '<svg'", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg.startsWith("<svg")).toBe(true);
  });

  it("svg endet mit '</svg>'", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg.endsWith("</svg>")).toBe(true);
  });

  it("svg enthält genau einen schließenden Wurzel-Tag", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    const treffer = c.svg.match(/<\/svg>/g) ?? [];
    expect(treffer).toHaveLength(1);
  });

  it("svg enthält den Masthead-Namen", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("Arkham Advertiser");
  });

  it("svg enthält das Datum", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("12. Oktober 1926");
  });

  it("svg enthält die Schlagzeile in Großbuchstaben", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("HAFENSTADT IN AUFRUHR");
  });

  it("svg enthält die Unterzeile", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("Seltsame Lichter über dem Wasser");
  });

  it("svg enthält keine rgba()-Farben", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).not.toContain("rgba(");
  });

  it("svg verwendet die erwartete Vintage-Palette", () => {
    // Der Dienst setzt den Farbklang bewusst über Hex-Werte
    // (Papier #f5f0e1, Tinte #2b2b2b) statt über rgba().
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("#f5f0e1");
    expect(c.svg).toContain("#2b2b2b");
  });

  it("svg verwendet für den Fließtext eine Monospace-Schrift", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("Courier New");
  });

  it("svg enthält text-Elemente", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("<text");
  });

  it("svg enthält den Hintergrund-Rechteckrahmen", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("<rect");
  });

  it("der Antiqua-Masthead nutzt eine Serifen-Schrift", () => {
    const c = buildNewspaperClipping(BASE_INPUT, 62000);
    expect(c.svg).toContain("Georgia");
  });

  it("der Fraktur-Masthead nutzt eine Fraktur-Schrift", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, mastheadId: "voelkischer" },
      62000,
    );
    expect(c.svg).toContain("UnifrakturMaguntia");
  });

  it("übernimmt deutsche Anführungszeichen unverändert", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, headline: "„Sturm“ über dem Hafen" },
      62000,
    );
    expect(c.svg).toContain("„STURM“ ÜBER DEM HAFEN");
  });
});

// ---------------------------------------------------------------------------
// buildNewspaperClipping – je Masthead
// ---------------------------------------------------------------------------

for (const fall of MASTHEAD_CASES) {
  describe(`buildNewspaperClipping – ${fall.id}`, () => {
    const input = {
      headline: "Neues aus der Stadt",
      subheadline: "Ein Bericht der Redaktion",
      body: MASTHEAD_BODY,
      mastheadId: fall.id,
      date: "5. Mai 1927",
    };
    const c = buildNewspaperClipping(input, 12345);

    it("wählt den passenden Masthead", () => {
      expect(c.masthead).toBe(fall.name);
    });

    it("übernimmt das Datum", () => {
      expect(c.date).toBe("5. Mai 1927");
      expect(c.svg).toContain("5. Mai 1927");
    });

    it("columnCount liegt zwischen 3 und 5", () => {
      expect(c.columnCount).toBeGreaterThanOrEqual(3);
      expect(c.columnCount).toBeLessThanOrEqual(5);
    });

    it("columns.length entspricht columnCount", () => {
      expect(c.columns).toHaveLength(c.columnCount);
    });

    it("jede Spalte ist nicht-leer und enthält nicht-leere Strings", () => {
      for (const col of c.columns) {
        expect(col.length).toBeGreaterThan(0);
        for (const line of col) {
          expect(typeof line).toBe("string");
          expect(line.length).toBeGreaterThan(0);
        }
      }
    });

    it("svg ist wohlgeformt und enthält den Masthead-Namen", () => {
      expect(c.svg.startsWith("<svg")).toBe(true);
      expect(c.svg.endsWith("</svg>")).toBe(true);
      expect(c.svg).toContain(fall.name);
    });
  });
}

// ---------------------------------------------------------------------------
// generateHalftoneDots
// ---------------------------------------------------------------------------

describe("generateHalftoneDots", () => {
  it("liefert dots-Array mit passender count", () => {
    const r = generateHalftoneDots(120, 80, 7);
    expect(Array.isArray(r.dots)).toBe(true);
    expect(r.count).toBe(r.dots.length);
    expect(r.count).toBeGreaterThan(0);
  });

  it("Punkte haben x, y und r", () => {
    const r = generateHalftoneDots(60, 40, 3);
    for (const d of r.dots) {
      expect(typeof d.x).toBe("number");
      expect(typeof d.y).toBe("number");
      expect(typeof d.r).toBe("number");
      expect(d.r).toBeGreaterThan(0);
    }
  });

  it("ist deterministisch für gleichen Seed", () => {
    const r1 = generateHalftoneDots(100, 100, 99);
    const r2 = generateHalftoneDots(100, 100, 99);
    expect(r1.dots).toEqual(r2.dots);
    expect(r1.count).toBe(r2.count);
  });

  it("count entspricht dots.length für ein großes Feld", () => {
    const r = generateHalftoneDots(240, 180, 12);
    expect(r.count).toBe(r.dots.length);
  });

  it("größere Fläche erzeugt mehr Punkte", () => {
    const klein = generateHalftoneDots(30, 30, 5);
    const groß = generateHalftoneDots(300, 300, 5);
    expect(groß.count).toBeGreaterThan(klein.count);
  });

  it("größere Breite erzeugt mehr Punkte", () => {
    const schmal = generateHalftoneDots(60, 60, 5);
    const breit = generateHalftoneDots(240, 60, 5);
    expect(breit.count).toBeGreaterThan(schmal.count);
  });

  it("größere Höhe erzeugt mehr Punkte", () => {
    const flach = generateHalftoneDots(60, 60, 5);
    const hoch = generateHalftoneDots(60, 240, 5);
    expect(hoch.count).toBeGreaterThan(flach.count);
  });

  it("Breite 0 erzeugt keine Punkte", () => {
    expect(generateHalftoneDots(0, 100, 1).count).toBe(0);
  });

  it("Höhe 0 erzeugt keine Punkte", () => {
    expect(generateHalftoneDots(100, 0, 1).count).toBe(0);
  });

  it("negative Breite erzeugt keine Punkte", () => {
    expect(generateHalftoneDots(-50, 100, 1).count).toBe(0);
  });

  it("negative Höhe erzeugt keine Punkte", () => {
    expect(generateHalftoneDots(100, -50, 1).count).toBe(0);
  });

  it("beide Maße 0 erzeugen keine Punkte", () => {
    const r = generateHalftoneDots(0, 0, 1);
    expect(r.count).toBe(0);
    expect(r.dots).toHaveLength(0);
  });

  it("Maße kleiner als der Rasterabstand erzeugen keine Punkte", () => {
    expect(generateHalftoneDots(6, 6, 1).count).toBe(0);
  });

  it("Maße knapp über dem Rasterabstand erzeugen höchstens einen Punkt", () => {
    const r = generateHalftoneDots(7, 7, 1);
    expect(r.count).toBeLessThanOrEqual(1);
  });

  it("alle x-Werte liegen innerhalb der Breite", () => {
    const r = generateHalftoneDots(120, 80, 7);
    for (const d of r.dots) {
      expect(d.x).toBeGreaterThan(0);
      expect(d.x).toBeLessThan(120);
    }
  });

  it("alle y-Werte liegen innerhalb der Höhe", () => {
    const r = generateHalftoneDots(120, 80, 7);
    for (const d of r.dots) {
      expect(d.y).toBeGreaterThan(0);
      expect(d.y).toBeLessThan(80);
    }
  });

  it("x- und y-Werte liegen auf dem 6-Pixel-Raster", () => {
    const r = generateHalftoneDots(120, 120, 7);
    for (const d of r.dots) {
      expect(d.x % 6).toBe(0);
      expect(d.y % 6).toBe(0);
    }
  });

  it("Radien liegen zwischen 0.5 und 2.5", () => {
    const r = generateHalftoneDots(120, 120, 7);
    for (const d of r.dots) {
      expect(d.r).toBeGreaterThanOrEqual(0.5);
      expect(d.r).toBeLessThanOrEqual(2.5);
    }
  });

  it("count ist eine ganze Zahl", () => {
    const r = generateHalftoneDots(120, 80, 7);
    expect(Number.isInteger(r.count)).toBe(true);
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Muster", () => {
    const a = generateHalftoneDots(120, 120, 1);
    const b = generateHalftoneDots(120, 120, 2);
    expect(a.dots).not.toEqual(b.dots);
  });

  it("ist für mehrere Seeds reproduzierbar", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(generateHalftoneDots(90, 90, seed).dots).toEqual(
        generateHalftoneDots(90, 90, seed).dots,
      );
    }
  });

  it("sehr großes Feld erzeugt viele Punkte", () => {
    const r = generateHalftoneDots(600, 600, 42);
    expect(r.count).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// applyVintageArtifacts
// ---------------------------------------------------------------------------

describe("applyVintageArtifacts", () => {
  it("liefert dithering, fadeAmount, creaseCount, tornEdges und description", () => {
    const a = applyVintageArtifacts(42);
    expect(typeof a.dithering).toBe("boolean");
    expect(typeof a.fadeAmount).toBe("number");
    expect(a.fadeAmount).toBeGreaterThanOrEqual(0);
    expect(a.fadeAmount).toBeLessThanOrEqual(1);
    expect(typeof a.creaseCount).toBe("number");
    expect(a.creaseCount).toBeGreaterThanOrEqual(0);
    expect(typeof a.tornEdges).toBe("boolean");
    expect(typeof a.description).toBe("string");
    expect(a.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a1 = applyVintageArtifacts(42);
    const a2 = applyVintageArtifacts(42);
    expect(a1.dithering).toBe(a2.dithering);
    expect(a1.fadeAmount).toBe(a2.fadeAmount);
    expect(a1.creaseCount).toBe(a2.creaseCount);
    expect(a1.tornEdges).toBe(a2.tornEdges);
    expect(a1.description).toBe(a2.description);
  });

  it("fadeAmount liegt zwischen 0 und 1", () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = applyVintageArtifacts(seed);
      expect(a.fadeAmount).toBeGreaterThanOrEqual(0);
      expect(a.fadeAmount).toBeLessThanOrEqual(1);
    }
  });

  it("creaseCount liegt zwischen 0 und 5", () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = applyVintageArtifacts(seed);
      expect(a.creaseCount).toBeGreaterThanOrEqual(0);
      expect(a.creaseCount).toBeLessThanOrEqual(5);
      expect(Number.isInteger(a.creaseCount)).toBe(true);
    }
  });

  it("description ist nicht leer und endet mit einem Punkt", () => {
    const a = applyVintageArtifacts(42);
    expect(a.description.trim().length).toBeGreaterThan(0);
    expect(a.description.endsWith(".")).toBe(true);
  });

  it("description erwähnt das Raster (Dithering)", () => {
    const a = applyVintageArtifacts(42);
    expect(a.description).toContain("Raster");
    expect(a.description).toContain("Dithering");
  });

  it("description erwähnt die Ränder", () => {
    const a = applyVintageArtifacts(42);
    expect(a.description).toContain("Ränder");
  });

  it("unterschiedliche Seeds können unterschiedliche Ergebnisse liefern", () => {
    const beschreibungen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      beschreibungen.add(applyVintageArtifacts(seed).description);
    }
    expect(beschreibungen.size).toBeGreaterThan(1);
  });

  for (let seed = 1; seed <= 10; seed++) {
    it(`Seed ${seed} liefert gültige Artefakte`, () => {
      const a = applyVintageArtifacts(seed);
      expect(typeof a.dithering).toBe("boolean");
      expect(a.fadeAmount).toBeGreaterThanOrEqual(0);
      expect(a.fadeAmount).toBeLessThanOrEqual(1);
      expect(a.creaseCount).toBeGreaterThanOrEqual(0);
      expect(a.creaseCount).toBeLessThanOrEqual(5);
      expect(typeof a.tornEdges).toBe("boolean");
      expect(a.description.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// exportClippingPdf
// ---------------------------------------------------------------------------

describe("exportClippingPdf", () => {
  const input = {
    headline: "Sturm über dem Hafen",
    body:
      "Ein heftiger Sturm hat die Küstenstadt erschüttert. " +
      "Mehrere Fischerboote mussten den Hafen aufsuchen.",
    mastheadId: "theTimes",
    date: "3. November 1926",
  };

  it("liefert dpi=300 und printReady=true", () => {
    const p = exportClippingPdf(input, 62000);
    expect(p.dpi).toBe(300);
    expect(p.printReady).toBe(true);
  });

  it("liefert A4-Maße und SVG", () => {
    const p = exportClippingPdf(input, 62000);
    expect(p.width).toBe(210);
    expect(p.height).toBe(297);
    expect(typeof p.svg).toBe("string");
    expect(p.svg).toContain("<svg");
  });

  it("width und height sind A4 in Millimetern", () => {
    const p = exportClippingPdf(input, 62000);
    expect(p.width).toBe(210);
    expect(p.height).toBe(297);
    expect(typeof p.width).toBe("number");
    expect(typeof p.height).toBe("number");
  });

  it("svg beginnt mit '<svg' und endet mit '</svg>'", () => {
    const p = exportClippingPdf(input, 62000);
    expect(p.svg.startsWith("<svg")).toBe(true);
    expect(p.svg.endsWith("</svg>")).toBe(true);
  });

  it("svg entspricht dem des Zeitungsschnitts", () => {
    const p = exportClippingPdf(input, 62000);
    const c = buildNewspaperClipping(input, 62000);
    expect(p.svg).toBe(c.svg);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const p1 = exportClippingPdf(input, 62000);
    const p2 = exportClippingPdf(input, 62000);
    expect(p1).toEqual(p2);
  });

  it("übernimmt den Masthead in das SVG", () => {
    const p = exportClippingPdf(input, 62000);
    expect(p.svg).toContain("The Times");
  });

  it("funktioniert für jeden Masthead", () => {
    for (const fall of MASTHEAD_CASES) {
      const p = exportClippingPdf({ ...input, mastheadId: fall.id }, 12345);
      expect(p.dpi).toBe(300);
      expect(p.printReady).toBe(true);
      expect(p.svg).toContain(fall.name);
    }
  });
});

// ---------------------------------------------------------------------------
// Grenzfälle
// ---------------------------------------------------------------------------

describe("buildNewspaperClipping – Grenzfälle", () => {
  it("leere Schlagzeile ist erlaubt", () => {
    const c = buildNewspaperClipping({ ...BASE_INPUT, headline: "" }, 62000);
    expect(c.svg.startsWith("<svg")).toBe(true);
    expect(c.svg.endsWith("</svg>")).toBe(true);
  });

  it("leerer Fließtext erzeugt leere Spalten", () => {
    const c = buildNewspaperClipping({ ...BASE_INPUT, body: "" }, 62000);
    expect(c.columns).toHaveLength(c.columnCount);
    for (const col of c.columns) {
      expect(Array.isArray(col)).toBe(true);
    }
    expect(c.svg).toContain("<svg");
  });

  it("nur-Leerzeichen-Fließtext wird wie leer behandelt", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, body: "   \n\t  " },
      62000,
    );
    expect(c.columns).toHaveLength(c.columnCount);
    expect(c.columnCount).toBeGreaterThanOrEqual(3);
  });

  it("sehr langer Fließtext (500 Wörter) wird korrekt gesetzt", () => {
    const c = buildNewspaperClipping({ ...BASE_INPUT, body: LONG_BODY }, 62000);
    expect(c.columnCount).toBeGreaterThanOrEqual(3);
    expect(c.columnCount).toBeLessThanOrEqual(5);
    expect(c.columns).toHaveLength(c.columnCount);
    for (const col of c.columns) {
      expect(col.length).toBeGreaterThan(0);
    }
    expect(c.svg.endsWith("</svg>")).toBe(true);
  });

  it("langer Fließtext erzeugt mehr Zeilen als ein kurzer", () => {
    const kurz = buildNewspaperClipping({ ...BASE_INPUT, body: BODY }, 62000);
    const lang = buildNewspaperClipping(
      { ...BASE_INPUT, body: LONG_BODY },
      62000,
    );
    const kurzZeilen = kurz.columns.reduce((s, c) => s + c.length, 0);
    const langZeilen = lang.columns.reduce((s, c) => s + c.length, 0);
    expect(langZeilen).toBeGreaterThan(kurzZeilen);
  });

  it("Umlaute in Schlagzeile und Text bleiben erhalten", () => {
    const c = buildNewspaperClipping(
      {
        ...BASE_INPUT,
        headline: "Über die Brücke",
        body: "Grüße aus München über die schöne Isar.",
      },
      62000,
    );
    expect(c.svg).toContain("ÜBER DIE BRÜCKE");
    expect(c.svg).toContain("München");
  });

  it("unbekannte mastheadId fällt auf den ersten Masthead zurück", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, mastheadId: "gibtEsNicht" },
      62000,
    );
    expect(c.masthead).toBe(NEWSPAPER_MASTHEADS[0].name);
  });

  it("leere mastheadId fällt auf den ersten Masthead zurück", () => {
    const c = buildNewspaperClipping({ ...BASE_INPUT, mastheadId: "" }, 62000);
    expect(c.masthead).toBe(NEWSPAPER_MASTHEADS[0].name);
  });

  it("optionale Unterzeile darf fehlen", () => {
    const c = buildNewspaperClipping(
      {
        headline: BASE_INPUT.headline,
        body: BASE_INPUT.body,
        mastheadId: BASE_INPUT.mastheadId,
        date: BASE_INPUT.date,
      },
      62000,
    );
    expect(c.svg.startsWith("<svg")).toBe(true);
    expect(c.svg.endsWith("</svg>")).toBe(true);
  });

  it("leere Unterzeile ist erlaubt", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, subheadline: "" },
      62000,
    );
    expect(c.svg).toContain("<svg");
  });

  it("leeres Datum ist erlaubt", () => {
    const c = buildNewspaperClipping({ ...BASE_INPUT, date: "" }, 62000);
    expect(c.date).toBe("");
    expect(c.svg.endsWith("</svg>")).toBe(true);
  });

  it("Schlagzeile mit XML-Sonderzeichen wird escapt", () => {
    const c = buildNewspaperClipping(
      { ...BASE_INPUT, headline: "Angst & Schreck <Hafen>" },
      62000,
    );
    expect(c.svg).toContain("&amp;");
    expect(c.svg).toContain("&lt;");
    expect(c.svg).not.toContain("<Hafen>");
  });
});

// ---------------------------------------------------------------------------
// createSampleClipping
// ---------------------------------------------------------------------------

describe("createSampleClipping", () => {
  it("liefert einen gültigen Zeitungsschnitt", () => {
    const c = createSampleClipping();
    expect(typeof c.masthead).toBe("string");
    expect(c.masthead.length).toBeGreaterThan(0);
    expect(typeof c.date).toBe("string");
    expect(Array.isArray(c.columns)).toBe(true);
    expect(c.columnCount).toBeGreaterThanOrEqual(3);
    expect(c.columnCount).toBeLessThanOrEqual(5);
    expect(typeof c.svg).toBe("string");
    expect(c.svg).toContain("<svg");
  });

  it("ist deterministisch", () => {
    const a = createSampleClipping();
    const b = createSampleClipping();
    expect(a.svg).toBe(b.svg);
    expect(a.columnCount).toBe(b.columnCount);
  });

  it("verwendet den Arkham Advertiser", () => {
    expect(createSampleClipping().masthead).toBe("Arkham Advertiser");
  });

  it("enthält die Beispiel-Schlagzeile", () => {
    expect(createSampleClipping().svg).toContain("HAFENSTADT IN AUFRUHR");
  });

  it("columns.length entspricht columnCount", () => {
    const c = createSampleClipping();
    expect(c.columns).toHaveLength(c.columnCount);
  });

  it("svg endet mit '</svg>'", () => {
    expect(createSampleClipping().svg.endsWith("</svg>")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createSampleMasthead
// ---------------------------------------------------------------------------

describe("createSampleMasthead", () => {
  it("liefert einen gültigen Masthead", () => {
    const m = createSampleMasthead();
    expect(typeof m.id).toBe("string");
    expect(m.id.length).toBeGreaterThan(0);
    expect(typeof m.name).toBe("string");
    expect(m.name.length).toBeGreaterThan(0);
    expect(typeof m.description).toBe("string");
    expect(m.description.length).toBeGreaterThan(0);
    expect(["antiqua", "fraktur"]).toContain(m.typeface);
  });

  it("entspricht dem ersten Masthead", () => {
    const m = createSampleMasthead();
    expect(m.id).toBe(NEWSPAPER_MASTHEADS[0].id);
    expect(m.name).toBe(NEWSPAPER_MASTHEADS[0].name);
    expect(m.typeface).toBe(NEWSPAPER_MASTHEADS[0].typeface);
  });

  it("liefert eine Kopie, die das Original nicht verändert", () => {
    const m = createSampleMasthead();
    m.name = "Verändert";
    expect(NEWSPAPER_MASTHEADS[0].name).toBe("Arkham Advertiser");
  });
});
