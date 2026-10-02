// WP 10.1 — Tests für den EPUB3-/PDF-Print-Master-Service.
// Prüft: EPUB3-Struktur (mimetype/container/OPF/toc), Determinismus,
// defensive Fallbacks, Bundsteg-Tabelle und das Druck-PDF (Seitenzahl,
// Metadaten, Seitenformat).

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  buildEpub3,
  buildPrintPdf,
  calculateGutter,
  normalizeChapters,
  stableUuid,
  type Epub3Options,
  type PdfOptions,
} from "./printMaster";
import type { BookChapterInput } from "./types";

// ---------------------------------------------------------------------------
// Fixtures & Helfer
// ---------------------------------------------------------------------------

const FIXED_NOW = Date.UTC(2026, 0, 2, 12, 0, 0);

function tipTap(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((t) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    })),
  });
}

function makeChapters(n: number): BookChapterInput[] {
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    title: `Kapitelthema ${i + 1}`,
    content: tipTap([
      `Das ist der erste Absatz von Kapitel ${i + 1} mit einem "Zitat" - und mehr.`,
      `Ein zweiter Absatz zu Kapitel ${i + 1}, damit die Seite gefüllt ist.`,
    ]),
  }));
}

const EPUB_OPTS: Epub3Options = {
  title: "Testbuch: Print Master",
  author: "Testautorin",
  language: "de",
  now: FIXED_NOW,
};

const PDF_OPTS: PdfOptions = {
  title: "Testbuch: Print Master",
  author: "Testautorin",
  now: FIXED_NOW,
};

async function readZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Liest Name + Kompressionsmethode des ersten Zip-Local-File-Headers. */
function firstZipEntry(b: Uint8Array): { name: string; method: number } {
  // 0–3 Signatur, 8–9 Kompressionsmethode, 26–27 Namenslänge, 30+ Name.
  const method = b[8] | (b[9] << 8);
  const nameLen = b[26] | (b[27] << 8);
  const name = new TextDecoder().decode(b.slice(30, 30 + nameLen));
  return { name, method };
}

// ---------------------------------------------------------------------------
// 1. buildEpub3 — Struktur
// ---------------------------------------------------------------------------

describe("buildEpub3", () => {
  it("setzt mimetype als ersten, unkomprimierten Zip-Eintrag", async () => {
    const blob = await buildEpub3(makeChapters(3), EPUB_OPTS);
    expect(blob.type).toBe("application/epub+zip");
    const b = await bytes(blob);
    const entry = firstZipEntry(b);
    expect(entry.name).toBe("mimetype");
    expect(entry.method).toBe(0); // 0 = STORE (keine Kompression)

    const zip = await readZip(blob);
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
  });

  it("enthält META-INF/container.xml mit Verweis auf content.opf", async () => {
    const zip = await readZip(await buildEpub3(makeChapters(2), EPUB_OPTS));
    const container = await zip.file("META-INF/container.xml")!.async("string");
    expect(container).toContain('full-path="OEBPS/content.opf"');
    expect(container).toContain("urn:oasis:names:tc:opendocument:xmlns:container");
  });

  it("erzeugt ein EPUB3-OPF mit Metadaten und je Kapitel einem Manifest-Eintrag", async () => {
    const chapters = makeChapters(5);
    const zip = await readZip(await buildEpub3(chapters, EPUB_OPTS));
    const opf = await zip.file("OEBPS/content.opf")!.async("string");

    expect(opf).toContain('version="3.0"');
    expect(opf).toContain("urn:uuid:");
    expect(opf).toContain("<dc:title>Testbuch: Print Master</dc:title>");
    expect(opf).toContain("<dc:creator>Testautorin</dc:creator>");
    expect(opf).toContain("<dc:language>de</dc:language>");
    expect(opf).toContain("dcterms:modified"); // Pflichtfeld für EPUB3-Validatoren
    for (let i = 1; i <= 5; i++) {
      expect(opf).toContain(`href="kapitel-${i}.xhtml"`);
      expect(opf).toContain(`idref="chap-${i}"`);
    }
  });

  it("deklariert toc.xhtml als EPUB3-nav mit klickbaren Kapitel-Links", async () => {
    const zip = await readZip(await buildEpub3(makeChapters(2), EPUB_OPTS));
    const toc = await zip.file("OEBPS/toc.xhtml")!.async("string");
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(toc).toContain('epub:type="toc"');
    expect(opf).toContain('properties="nav"'); // OPF-Manifest-Property
    expect(toc).toMatch(/<a href="kapitel-1\.xhtml">Kapitel 1: Kapitelthema 1<\/a>/);
    expect(toc).toMatch(/<a href="kapitel-2\.xhtml">Kapitel 2: Kapitelthema 2<\/a>/);
  });

  it("schreibt je Kapitel ein XHTML mit Anker und normalisierter Typografie", async () => {
    const zip = await readZip(await buildEpub3(makeChapters(2), EPUB_OPTS));
    const xhtml = await zip.file("OEBPS/kapitel-1.xhtml")!.async("string");
    expect(xhtml).toContain('encoding="UTF-8"');
    expect(xhtml).toContain('id="kapitel-1"');
    expect(xhtml).toContain("http://www.w3.org/1999/xhtml");
    expect(xhtml).toContain("„Zitat“"); // gerade → deutsche Anführungszeichen
    expect(xhtml).toContain(" – "); // " - " → Halbgeviertstrich
    expect(xhtml).not.toContain('"Zitat"');
  });

  it("ist deterministisch: gleicher Input + now → identische Bytes", async () => {
    const chapters = makeChapters(3);
    const a = await bytes(await buildEpub3(chapters, EPUB_OPTS));
    const b = await bytes(await buildEpub3(chapters, EPUB_OPTS));
    expect(a.length).toBe(b.length);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(EPUB_OPTS.now).toBe(FIXED_NOW); // Fixture unverändert
  });

  it("nutzt ein eigenes CSS, wenn übergeben — sonst das Standard-CSS", async () => {
    const withCss = await readZip(
      await buildEpub3(makeChapters(1), { ...EPUB_OPTS, css: ".x{color:red}" }),
    );
    expect(await withCss.file("OEBPS/styles.css")!.async("string")).toBe(".x{color:red}");

    const withoutCss = await readZip(await buildEpub3(makeChapters(1), EPUB_OPTS));
    expect(await withoutCss.file("OEBPS/styles.css")!.async("string")).toContain("body {");
  });

  it("fällt defensiv zurück: leere Kapitel und fehlende Titel/Autor", async () => {
    const blob = await buildEpub3([], { title: "", author: "" } as Epub3Options);
    expect(blob.size).toBeGreaterThan(500);
    const zip = await readZip(blob);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:title>Unbenanntes Buch</dc:title>");
    expect(opf).toContain("<dc:creator>Unbekannter Autor</dc:creator>");
    expect(opf).toContain("<dc:language>de</dc:language>");
    // Titelblatt existiert auch ohne Kapitel.
    expect(zip.file("OEBPS/titlepage.xhtml")).not.toBeNull();
  });

  it("verträgt null/undefined-Kapitel ohne zu werfen", async () => {
    const blob = await buildEpub3(
      // @ts-expect-error — absichtlich ungültige Eingabe
      null,
      EPUB_OPTS,
    );
    expect(blob.size).toBeGreaterThan(0);
    const zip = await readZip(blob);
    expect(zip.file("OEBPS/content.opf")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. calculateGutter
// ---------------------------------------------------------------------------

describe("calculateGutter", () => {
  it("liefert die KDP-Bundsteg-Bänder nach Seitenzahl", () => {
    expect(calculateGutter(100, "white")).toBeCloseTo(9.5, 1); // 0.375″
    expect(calculateGutter(150, "white")).toBeCloseTo(9.5, 1);
    expect(calculateGutter(151, "white")).toBeCloseTo(12.7, 1); // 0.5″
    expect(calculateGutter(300, "white")).toBeCloseTo(12.7, 1);
    expect(calculateGutter(500, "white")).toBeCloseTo(15.9, 1); // 0.625″
    expect(calculateGutter(700, "white")).toBeCloseTo(19.0, 1); // 0.75″ → 19,05 mm
    expect(calculateGutter(900, "white")).toBeCloseTo(22.2, 1); // 0.875″
  });

  it("ist monoton: mehr Seiten → nie kleinerer Bundsteg", () => {
    const samples = [1, 100, 200, 400, 600, 800, 2000];
    for (let i = 1; i < samples.length; i++) {
      expect(calculateGutter(samples[i], "white")).toBeGreaterThanOrEqual(
        calculateGutter(samples[i - 1], "white"),
      );
    }
  });

  it("addiert bei Farbdruck einen Papierzuschlag, nicht bei Cream/White", () => {
    const white = calculateGutter(200, "white");
    const cream = calculateGutter(200, "cream");
    expect(cream).toBe(white);
    expect(calculateGutter(200, "color")).toBeCloseTo(white + 1.5, 1);
    expect(calculateGutter(200, "premium-color")).toBeCloseTo(white + 1.5, 1);
    // Unbekannter Papiertyp → kein Zuschlag.
    expect(calculateGutter(200, "unbekannt")).toBe(white);
  });

  it("klemmt ungültige Eingaben defensiv", () => {
    expect(calculateGutter(0, "white")).toBeGreaterThan(0);
    expect(calculateGutter(-50, "white")).toBeGreaterThan(0);
    expect(calculateGutter(NaN, "white")).toBeGreaterThan(0);
    // @ts-expect-error — absichtlich ungültig
    expect(calculateGutter(undefined, undefined)).toBeGreaterThan(0);
    // Immer auf 0,1 mm gerundet.
    for (const n of [1, 42, 199, 501, 1000]) {
      expect(Math.round(calculateGutter(n, "white") * 10)).toBe(
        calculateGutter(n, "white") * 10,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. buildPrintPdf
// ---------------------------------------------------------------------------

describe("buildPrintPdf", () => {
  it("erzeugt ein valides PDF mit mindestens einer Seite je Kapitel", async () => {
    const chapters = makeChapters(4);
    const blob = await buildPrintPdf(chapters, PDF_OPTS);
    expect(blob.type).toBe("application/pdf");

    const b = await bytes(blob);
    // %PDF-Header
    expect(String.fromCharCode(...b.slice(0, 5))).toBe("%PDF-");

    const doc = await PDFDocument.load(await blob.arrayBuffer());
    // Titelblatt + mindestens 1 Seite pro Kapitel.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(chapters.length + 1);
  });

  it("setzt Titel und Autor in die PDF-Metadaten", async () => {
    const blob = await buildPrintPdf(makeChapters(2), PDF_OPTS);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getTitle()).toBe("Testbuch: Print Master");
    expect(doc.getAuthor()).toBe("Testautorin");
  });

  it("respektiert das Seitenformat 6×9″ (152,4 × 228,6 mm)", async () => {
    const blob = await buildPrintPdf(makeChapters(1), PDF_OPTS);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    const p = doc.getPage(0);
    expect(p.getWidth()).toBeCloseTo((152.4 / 25.4) * 72, 1);
    expect(p.getHeight()).toBeCloseTo((228.6 / 25.4) * 72, 1);
  });

  it("unterstützt explizite Seitenmaße und Ränder", async () => {
    const blob = await buildPrintPdf(makeChapters(1), {
      ...PDF_OPTS,
      pageSize: { widthMm: 210, heightMm: 297 },
      margins: { top: 25, right: 25, bottom: 25, left: 25 },
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    const p = doc.getPage(0);
    expect(p.getWidth()).toBeCloseTo((210 / 25.4) * 72, 1);
    expect(p.getHeight()).toBeCloseTo((297 / 25.4) * 72, 1);
  });

  it("akzeptiert einen expliziten Bundsteg, ohne zu werfen", async () => {
    const blob = await buildPrintPdf(makeChapters(3), { ...PDF_OPTS, gutterMm: 20 });
    expect(blob.size).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });

  it("fällt defensiv zurück: leere Kapitelliste erzeugt trotzdem ein PDF", async () => {
    const blob = await buildPrintPdf([], { title: "", author: "" } as PdfOptions);
    expect(blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("Unbenanntes Buch");
    expect(doc.getAuthor()).toBe("Unbekannter Autor");
  });

  it("verträgt Kapitel ohne Inhalt (leerer TipTap-String)", async () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "Leer", content: "" },
      { number: 2, title: "Kaputt", content: "{nicht json" },
    ];
    const blob = await buildPrintPdf(chapters, PDF_OPTS);
    expect(blob.size).toBeGreaterThan(500);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Gemeinsame Helfer
// ---------------------------------------------------------------------------

describe("normalizeChapters / stableUuid", () => {
  it("normalizeChapters füllt Nummern/Titel und filtert Müll", () => {
    const out = normalizeChapters([
      { title: "", content: "" },
      { number: 7, title: "Sieben", content: "x" },
      // @ts-expect-error — absichtlich ungültig
      null,
      // @ts-expect-error — absichtlich ungültig
      undefined,
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].number).toBe(1);
    expect(out[0].title).toBe("Kapitel 1");
    expect(out[0].content).toBe("");
    expect(out[1].number).toBe(7);
    expect(out[1].title).toBe("Sieben");
  });

  it("normalizeChapters liefert [] für Nicht-Arrays", () => {
    expect(normalizeChapters(null)).toEqual([]);
    expect(normalizeChapters(undefined)).toEqual([]);
    // @ts-expect-error — absichtlich ungültig
    expect(normalizeChapters("nope")).toEqual([]);
  });

  it("stableUuid ist deterministisch und UUID-v4-förmig", () => {
    const a = stableUuid("buch|autor|de|3");
    const b = stableUuid("buch|autor|de|3");
    const c = stableUuid("anderes");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
