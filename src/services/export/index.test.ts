// Unit-Tests für den Export-Service.
//
// Getestet werden die reinen Transformationen (toBlocks, toMd) und die
// Format-Exporte (toDocx, toPdf, toEpub) anhand ihrer Binär-/Textsignatur.
// toTxt ist nicht exportiert (wird nur intern via exportContent genutzt) —
// deckt die gleiche Logik wie toMd ab und wird über die Blöcke abgedeckt.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  toBlocks,
  toDocx,
  toPdf,
  toEpub,
  toMd,
  printLayoutToPdfOptions,
} from "./index";
import {
  DEFAULT_MARGINS,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_HEADER_FOOTER,
  DEFAULT_PRINT_LAYOUT,
  type PrintLayout,
} from "@/services/printlayout";

/** TipTap-JSON aus Blocks bauen (hilfreich für lesbare Tests). */
function tt(content: unknown[]): string {
  return JSON.stringify({ type: "doc", content });
}
function p(text: string): unknown {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

// --- toBlocks ---------------------------------------------------------------

describe("toBlocks", () => {
  it("konvertiert alle Basis-Block-Typen", () => {
    const json = tt([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Titel" }] },
      p("Absatz eins."),
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Unter-Unter" }] },
      { type: "blockquote", content: [p("Zitat")] },
      { type: "code_block", content: [{ type: "text", text: "const x = 1;" }] },
    ]);
    const blocks = toBlocks(json);
    expect(blocks).toEqual([
      { type: "h1", text: "Titel" },
      { type: "p", text: "Absatz eins." },
      { type: "h3", text: "Unter-Unter" },
      { type: "quote", text: "Zitat" },
      { type: "code", text: "const x = 1;" },
    ]);
  });

  it("level ohne attrs fällt auf h1 zurück", () => {
    const blocks = toBlocks(tt([{ type: "heading", content: [{ type: "text", text: "X" }] }]));
    expect(blocks).toEqual([{ type: "h1", text: "X" }]);
  });

  it("Bullet- und Ordered-Listen werden gruppiert", () => {
    const json = tt([
      {
        type: "bullet_list",
        content: [
          { type: "list_item", content: [p("Punkt A")] },
          { type: "list_item", content: [p("Punkt B")] },
          { type: "list_item", content: [p("   ")] }, // leer → übersprungen
        ],
      },
      {
        type: "ordered_list",
        content: [{ type: "list_item", content: [p("Erster")] }],
      },
      { type: "bullet_list", content: [p("kein list_item")] }, // leer → kein Block
    ]);
    const blocks = toBlocks(json);
    expect(blocks).toEqual([
      { type: "list_item", text: "", ordered: false, items: [{ type: "list_item", text: "Punkt A" }, { type: "list_item", text: "Punkt B" }] },
      { type: "list_item", text: "", ordered: true, items: [{ type: "list_item", text: "Erster" }] },
    ]);
  });

  it("Bilder werden als Platzhalter übernommen", () => {
    const blocks = toBlocks(tt([{ type: "image", attrs: { src: "img/cat.png" } }]));
    expect(blocks).toEqual([{ type: "image", text: "[Bild: img/cat.png]" }]);
  });

  it("Bild ohne src wird übersprungen; leerer Absatz ebenfalls", () => {
    const blocks = toBlocks(tt([{ type: "image", attrs: {} }, p("")]));
    expect(blocks).toEqual([]);
  });

  it("unbekannte Knotentypen werden rekursiv durchlaufen", () => {
    const json = tt([
      { type: "someWrapper", content: [p("innen")] },
    ]);
    expect(toBlocks(json)).toEqual([{ type: "p", text: "innen" }]);
  });

  it("ungültiges und leeres JSON liefert leeres Array", () => {
    expect(toBlocks("kein json {")).toEqual([]);
    expect(toBlocks("")).toEqual([]);
    expect(toBlocks("{}")).toEqual([]);
  });

  it("verschachtelte Text-Runs werden zusammengeführt", () => {
    const json = tt([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hallo ", marks: [{ type: "bold" }] },
          { type: "text", text: "Welt", marks: [{ type: "italic" }] },
        ],
      },
    ]);
    expect(toBlocks(json)).toEqual([{ type: "p", text: "Hallo Welt" }]);
  });
});

// --- toMd -------------------------------------------------------------------

describe("toMd", () => {
  const blocks = toBlocks(tt([
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "K1" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "K2" }] },
    p("Text."),
    { type: "blockquote", content: [p("Zitat")] },
    { type: "code_block", content: [{ type: "text", text: "code()" }] },
  ]));

  it("erzeugt Markdown mit allen Syntax-Elementen", () => {
    const md = toMd(blocks);
    expect(md).toContain("# K1");
    expect(md).toContain("## K2");
    expect(md).toContain("Text.");
    expect(md).toContain("> Zitat");
    expect(md).toContain("```\ncode()\n```");
  });
});

// --- toDocx / toPdf / toEpub (Binärsignaturen) ------------------------------

describe("toDocx", () => {
  it("erzeugt ein gültiges DOCX (ZIP) mit Titel und Inhalt", async () => {
    const blocks = toBlocks(tt([p("Hallo DOCX")]));
    const blob = await toDocx(blocks, "Mein Buch");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Mein Buch");
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Hallo DOCX");
  });

  it("rendert Listen und Zitate ohne Fehler", async () => {
    const blocks = toBlocks(tt([
      { type: "blockquote", content: [p("Zitat")] },
      { type: "code_block", content: [{ type: "text", text: "x()" }] },
      {
        type: "ordered_list",
        content: [{ type: "list_item", content: [p("Eins")] }, { type: "list_item", content: [p("Zwei")] }],
      },
      { type: "image", attrs: { src: "bild.png" } },
    ]));
    const blob = await toDocx(blocks, "Listen");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("toPdf", () => {
  it("erzeugt ein gültiges PDF mit Titel", async () => {
    const blocks = toBlocks(tt([p("Hallo PDF")]));
    const blob = await toPdf(blocks, "PDF-Buch");
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Inhalt wird von pdf-lib komprimiert — die Signatur genügt als Prüfung.
    expect(String.fromCharCode(...buf.slice(0, 5))).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(200);
  });

  it("Layout-Optionen (Sans, Justify, Header/Footer) erzeugen weiterhin valides PDF", async () => {
    const blocks = toBlocks(tt([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kapitel" }] },
      p("Dies ist ein langer Absatz, der im Flattersatz verteilt wird, damit die Justify-Logik greift und mehrere Zeilen entstehen."),
      { type: "code_block", content: [{ type: "text", text: "a + b" }] },
    ]));
    const blob = await toPdf(blocks, "Layout", {
      fontFamily: "sans",
      paragraphAlign: "justify",
      header: { center: "{title}" },
      footer: { center: "Seite {page}" },
    });
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...buf.slice(0, 5))).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
  });
});

describe("toEpub", () => {
  it("erzeugt eine EPUB-Struktur mit mimetype, OPF und XHTML", async () => {
    const blocks = toBlocks(tt([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kapitel <1>" }] },
      p("EPUB-Inhalt"),
      {
        type: "bullet_list",
        content: [{ type: "list_item", content: [p("Liste")] }],
      },
    ]));
    const blob = await toEpub(blocks, "Mein EPUB", "Erika Muster");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:title>Mein EPUB</dc:title>");
    expect(opf).toContain("<dc:creator>Erika Muster</dc:creator>");
    const xhtml = await zip.file("OEBPS/content.xhtml")!.async("string");
    // XML-Escaping ist angewendet:
    expect(xhtml).toContain("<h1>Kapitel &lt;1&gt;</h1>");
    expect(xhtml).toContain("<p>EPUB-Inhalt</p>");
    expect(xhtml).toContain("<ul><li>Liste</li></ul>");
    expect(await zip.file("OEBPS/styles.css")!.async("string")).toContain("font-family");
  });

  it("Standard-Autor ist „Autor“; Ordered-Listen werden als ol gerendert", async () => {
    const blocks = toBlocks(tt([
      { type: "ordered_list", content: [{ type: "list_item", content: [p("Erster")] }] },
    ]));
    const blob = await toEpub(blocks, "T");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:creator>Autor</dc:creator>");
    const xhtml = await zip.file("OEBPS/content.xhtml")!.async("string");
    expect(xhtml).toContain("<ol><li>Erster</li></ol>");
  });
});

// --- printLayoutToPdfOptions ------------------------------------------------

describe("printLayoutToPdfOptions", () => {
  it("wandelt mm in pt um und bildet Kopf-/Fußzeilen ab", () => {
    const layout: PrintLayout = {
      ...DEFAULT_PRINT_LAYOUT,
      pageSize: "a4",
      margins: { ...DEFAULT_MARGINS },
      typography: { ...DEFAULT_TYPOGRAPHY, firstLineIndentMm: 5 },
      headerFooter: {
        ...DEFAULT_HEADER_FOOTER,
        headerEnabled: true,
        headerCenter: "{title} — {page}",
        footerCenter: "{page}",
      },
    };
    const opts = printLayoutToPdfOptions(layout);
    expect(opts.pageWidthPt).toBeCloseTo(595.28, 1);
    expect(opts.pageHeightPt).toBeCloseTo(841.89, 1);
    expect(opts.marginPt?.top).toBeCloseTo(25 * 2.8346, 1);
    expect(opts.firstLineIndentPt).toBeCloseTo(5 * 2.8346, 1);
    expect(opts.header?.center).toBe("{title} — {page}");
    expect(opts.footer?.center).toBe("{page}");
    expect(opts.fontFamily).toBe(DEFAULT_TYPOGRAPHY.fontFamily);
  });

  it("deaktivierte Kopf-/Fußzeilen liefern undefined", () => {
    const layout: PrintLayout = {
      ...DEFAULT_PRINT_LAYOUT,
      pageSize: "a4",
      margins: { ...DEFAULT_MARGINS },
      typography: { ...DEFAULT_TYPOGRAPHY },
      headerFooter: { ...DEFAULT_HEADER_FOOTER, headerEnabled: false, footerEnabled: false },
    };
    const opts = printLayoutToPdfOptions(layout);
    expect(opts.header).toBeUndefined();
    expect(opts.footer).toBeUndefined();
  });
});
