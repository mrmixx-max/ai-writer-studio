// WP 10.1 — Export- & Artefakt-Integrität: 15 Testfälle.
//
// Deckt die drei Satz-Ausgabepfade aus printMaster.ts ab:
//   buildEpub3      → EPUB3-Archiv (XML-Escaping, Cover optional, Fußnoten)
//   buildPrintPdf   → KDP-Druck-PDF (kurze Kapitel, einziges Kapitel, Titel)
//   calculateGutter → KDP-Bundsteg (Trim-Formate 5×8″, 6×9″, 12×19 cm, 0 Seiten)
//
// Zusätzlich genutzte, im selben Modul exportierte Satz-Helfer:
//   buildFootnoteRef / buildFootnoteBlock, blankPagesBefore / isRecto,
//   gutterForTrim / gutterForPageCount.
// Kein LLM, keine Netzwerk-/Tauri-Aufrufe. `now` ist fixiert → deterministisch.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  buildEpub3,
  buildPrintPdf,
  calculateGutter,
  buildFootnoteRef,
  buildFootnoteBlock,
  blankPagesBefore,
  isRecto,
  gutterForTrim,
  gutterForPageCount,
  type Epub3Options,
  type PdfOptions,
} from "./printMaster";
import { checkXmlWellFormed } from "@/services/export/exportValidate";
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

/** Name + Kompressionsmethode des ersten Zip-Local-File-Headers. */
function firstZipEntry(b: Uint8Array): { name: string; method: number } {
  const method = b[8] | (b[9] << 8);
  const nameLen = b[26] | (b[27] << 8);
  const name = new TextDecoder().decode(b.slice(30, 30 + nameLen));
  return { name, method };
}

/** Minimaler, gültig aussehender JPEG-Header (Inhalt wird nicht dekodiert). */
function fakeJpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

// ===========================================================================
// Export- & Artefakt-Integrität — 15 Fälle
// ===========================================================================

describe("Export- & Artefakt-Integrität", () => {
  // 1 -----------------------------------------------------------------------
  it("1: EPUB3 escapet &, <, > und Umlaute im Inhaltsverzeichnis (toc.xhtml)", async () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: 'Kapitel <A> & "B" – Über', content: tipTap(["Text"]) },
    ];
    const zip = await readZip(await buildEpub3(chapters, EPUB_OPTS));
    const toc = await zip.file("OEBPS/toc.xhtml")!.async("string");

    // Sonderzeichen sind XML-escaped …
    expect(toc).toContain("&lt;A&gt;");
    expect(toc).toContain("&amp;");
    expect(toc).toContain("&quot;B&quot;");
    // … Umlaute bleiben als UTF-8 erhalten …
    expect(toc).toContain("Über");
    // … und es steht kein rohes Markup im Link-Text.
    expect(toc).not.toContain("<A>");
    expect(toc).not.toContain('Kapitel <A>');
    // Das TOC selbst ist wohlgeformtes XHTML.
    expect(checkXmlWellFormed(toc).ok).toBe(true);
  });

  // 2 -----------------------------------------------------------------------
  it("2: EPUB3 ist ohne Cover und mit Cover jeweils valide", async () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "Eins", content: tipTap(["Inhalt eins"]) },
    ];

    // --- Variante A: ohne Cover -------------------------------------------
    const without = await buildEpub3(chapters, EPUB_OPTS);
    const zipA = await readZip(without);
    const opfA = await zipA.file("OEBPS/content.opf")!.async("string");
    expect(firstZipEntry(await bytes(without)).name).toBe("mimetype");
    expect(checkXmlWellFormed(opfA).ok).toBe(true);
    expect(opfA).not.toContain("cover-image");
    expect(zipA.file("OEBPS/cover.xhtml")).toBeNull();

    // --- Variante B: mit Cover --------------------------------------------
    const withCover = await buildEpub3(chapters, {
      ...EPUB_OPTS,
      cover: { data: fakeJpeg(), mediaType: "image/jpeg", fileName: "cover.jpg" },
    });
    const zipB = await readZip(withCover);
    const opfB = await zipB.file("OEBPS/content.opf")!.async("string");
    expect(firstZipEntry(await bytes(withCover)).name).toBe("mimetype");
    expect(checkXmlWellFormed(opfB).ok).toBe(true);
    expect(opfB).toContain('properties="cover-image"');
    expect(opfB).toContain('href="cover.jpg"');
    expect(zipB.file("OEBPS/cover.jpg")).not.toBeNull();
    expect(zipB.file("OEBPS/cover.xhtml")).not.toBeNull();
    const coverXhtml = await zipB.file("OEBPS/cover.xhtml")!.async("string");
    expect(coverXhtml).toContain('epub:type="cover"');
    expect(coverXhtml).toContain('src="cover.jpg"');
  });

  // 3 -----------------------------------------------------------------------
  it("3: Fußnoten-Verlinkung nutzt epub:type=noteref und <aside epub:type=footnote>", () => {
    const ref = buildFootnoteRef(1);
    const block = buildFootnoteBlock([
      { number: 1, text: "Erste Anmerkung mit & Zeichen" },
      { number: 2, text: "Zweite Anmerkung" },
    ]);

    // Inline-Verweis
    expect(ref).toContain('epub:type="noteref"');
    expect(ref).toContain('href="#fn-1"');
    expect(ref).toContain('id="fn-ref-1"');

    // Fußnotenblock
    expect(block).toContain('<aside id="fn-1" epub:type="footnote"');
    expect(block).toContain('epub:type="backlink"');
    expect(block).toContain('href="#fn-ref-1"'); // Rückverweis auf den Verweis
    expect(block).toContain("&amp;"); // Text ist XML-escaped
    expect(block).toContain("Zweite Anmerkung");

    // Kreuzverlinkung: Verweis-Ziel == Fußnoten-Id.
    expect(ref).toContain("#fn-1");
    expect(block).toContain('id="fn-1"');
  });

  // 4 -----------------------------------------------------------------------
  it("4: PDF mit extrem kurzem Kapitel (1 Seite) bleibt valide", async () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "Kurz", content: tipTap(["Nur ein Satz."]) },
    ];
    const blob = await buildPrintPdf(chapters, PDF_OPTS);
    expect(blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    // Titelblatt + genau eine Kapitelseite.
    expect(doc.getPageCount()).toBe(2);
  });

  // 5 -----------------------------------------------------------------------
  it("5: Leere Vakatseite — Kapitel beginnt auf ungerader Seite", () => {
    // Titelblatt ist Seite 1 (recto/ungerade); danach steht der Zähler auf 2.
    expect(isRecto(1)).toBe(true);
    expect(isRecto(2)).toBe(false);

    // Auf gerader Seite muss ein Vakat eingefügt werden, auf ungerader nicht.
    expect(blankPagesBefore(1)).toBe(0); // bereits ungerade
    expect(blankPagesBefore(2)).toBe(1); // Vakat nötig
    expect(blankPagesBefore(3)).toBe(0);
    expect(blankPagesBefore(4)).toBe(1);

    // Ablauf: Titel (1) → Kapitel würde auf 2 starten → +1 Vakat → Start auf 3.
    const startAfterTitle = 2;
    const startPage = startAfterTitle + blankPagesBefore(startAfterTitle);
    expect(startPage).toBe(3);
    expect(isRecto(startPage)).toBe(true);
  });

  // 6 -----------------------------------------------------------------------
  it("6: Bundsteg-Berechnung bei 5×8″ Trim-Size", () => {
    const trim = { widthMm: 127, heightMm: 203.2 }; // 5″ × 8″
    // ~100 Seiten → Band ≤150 → 0,375″ = 9,525 mm → 9,5 mm
    expect(gutterForTrim(trim, 207 * 100)).toBeCloseTo(9.5, 1);
    // ~400 Seiten → Band ≤500 → 0,625″ = 15,875 mm → 15,9 mm
    expect(gutterForTrim(trim, 207 * 400)).toBeCloseTo(15.9, 1);
    expect(gutterForTrim(trim, 1)).toBeGreaterThan(0);
  });

  // 7 -----------------------------------------------------------------------
  it("7: Bundsteg-Berechnung bei 6×9″ Trim-Size", () => {
    // ~100 Seiten → 9,5 mm
    expect(gutterForTrim("6x9", 280 * 100)).toBeCloseTo(9.5, 1);
    // ~400 Seiten → 15,9 mm
    expect(gutterForTrim("6x9", 280 * 400)).toBeCloseTo(15.9, 1);
    // Deckungsgleich mit der direkten Bandberechnung.
    expect(gutterForTrim("6x9", 280 * 100)).toBe(calculateGutter(100, "white"));
  });

  // 8 -----------------------------------------------------------------------
  it("8: Bundsteg-Berechnung bei Taschenbuch 12×19 cm", () => {
    const trim = { widthMm: 120, heightMm: 190 }; // 12 cm × 19 cm
    // ~100 Seiten → 9,5 mm
    expect(gutterForTrim(trim, 183 * 100)).toBeCloseTo(9.5, 1);
    // ~400 Seiten → 15,9 mm
    expect(gutterForTrim(trim, 183 * 400)).toBeCloseTo(15.9, 1);
    // Größere Wortzahl ⇒ nie kleinerer Bundsteg.
    expect(gutterForTrim(trim, 183 * 400)).toBeGreaterThanOrEqual(gutterForTrim(trim, 183 * 100));
  });

  // 9 -----------------------------------------------------------------------
  it("9: EPUB3 mit leerem Kapitel ist valide", async () => {
    const chapters: BookChapterInput[] = [{ number: 1, title: "Leer", content: "" }];
    const blob = await buildEpub3(chapters, EPUB_OPTS);
    expect(blob.size).toBeGreaterThan(0);

    const zip = await readZip(blob);
    const xhtml = await zip.file("OEBPS/kapitel-1.xhtml")!.async("string");
    expect(xhtml).toContain("<h1");
    expect(checkXmlWellFormed(xhtml).ok).toBe(true);

    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain('href="kapitel-1.xhtml"');
    const toc = await zip.file("OEBPS/toc.xhtml")!.async("string");
    expect(toc).toContain('href="kapitel-1.xhtml"');
  });

  // 10 ----------------------------------------------------------------------
  it("10: PDF mit nur einem Kapitel wird korrekt erzeugt", async () => {
    const chapters: BookChapterInput[] = [
      { number: 1, title: "Einziges", content: tipTap(["Absatz eins.", "Absatz zwei."]) },
    ];
    const blob = await buildPrintPdf(chapters, PDF_OPTS);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toBe("Testbuch: Print Master");
  });

  // 11 ----------------------------------------------------------------------
  it("11: EPUB3 mit Umlauten im Titel bleibt korrekt und valide", async () => {
    const title = "Über Ärger & Öl – Ausgabe für Müller";
    const blob = await buildEpub3(
      [{ number: 1, title: "Eins", content: tipTap(["Inhalt"]) }],
      { ...EPUB_OPTS, title },
    );
    const zip = await readZip(blob);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");

    expect(opf).toContain("<dc:title>Über Ärger &amp; Öl – Ausgabe für Müller</dc:title>");
    expect(checkXmlWellFormed(opf).ok).toBe(true);

    const titlepage = await zip.file("OEBPS/titlepage.xhtml")!.async("string");
    expect(titlepage).toContain("Über Ärger");
    expect(titlepage).toContain("Müller");
  });

  // 12 ----------------------------------------------------------------------
  it("12: PDF mit Sonderzeichen im Kapiteltitel stürzt nicht ab", async () => {
    const title = 'Kapitel <&> "Test" – 50%';
    const chapters: BookChapterInput[] = [
      { number: 1, title, content: tipTap(["Sonderzeichen im Titel."]) },
    ];
    const blob = await buildPrintPdf(chapters, { ...PDF_OPTS, title });
    expect(blob.size).toBeGreaterThan(0);

    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    // Metadaten behalten die Sonderzeichen unverfälscht.
    expect(doc.getTitle()).toBe(title);
  });

  // 13 ----------------------------------------------------------------------
  it("13: EPUB3-Artefakt hat eine Größe > 0", async () => {
    const blob = await buildEpub3(
      [{ number: 1, title: "Eins", content: tipTap(["Inhalt"]) }],
      EPUB_OPTS,
    );
    expect(blob.size).toBeGreaterThan(0);
    expect((await bytes(blob)).length).toBe(blob.size);
  });

  // 14 ----------------------------------------------------------------------
  it("14: PDF-Artefakt hat eine Größe > 0", async () => {
    const blob = await buildPrintPdf(
      [{ number: 1, title: "Eins", content: tipTap(["Inhalt"]) }],
      PDF_OPTS,
    );
    expect(blob.size).toBeGreaterThan(0);
    expect((await bytes(blob)).length).toBe(blob.size);
  });

  // 15 ----------------------------------------------------------------------
  it("15: Bundsteg ist bei 0 Seiten 0", () => {
    expect(gutterForPageCount(0, "white")).toBe(0);
    expect(gutterForPageCount(-10, "white")).toBe(0);
    expect(gutterForPageCount(NaN, "white")).toBe(0);
    // Mit echten Seiten bleibt der Bundsteg > 0.
    expect(gutterForPageCount(200, "white")).toBeGreaterThan(0);
  });
});
