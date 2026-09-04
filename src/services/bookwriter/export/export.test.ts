// Roundtrip-Tests (C4): 8-Kapitel-Testbuch → Markdown, DOCX, EPUB.
// Struktur-Checks je Format + EPUB-Strukturvalidierung (container/OPF/NCX/nav).

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportBook, normalizeTypography, xmlEscape } from "./index";
import { checkExportGate } from "./gate";
import { makeTestBook, CHAPTER_TITLES } from "../testbook";

const book = makeTestBook();

async function readZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

// --- Markdown ---------------------------------------------------------------

describe("exportBook markdown", () => {
  it("erzeugt Markdown mit Titelblatt, Impressum, TOC und 8 Kapiteln", async () => {
    const res = await exportBook(book, "markdown");
    expect(res.format).toBe("markdown");
    expect(res.filename).toMatch(/\.md$/);
    const text = await res.blob.text();

    expect(text).toContain("# Testbuch: KI verstehen");
    expect(text).toContain("von Testautor");
    expect(text).toContain("© ");
    expect(text).toContain("Alle Rechte vorbehalten.");
    expect(text).toContain("## Inhaltsverzeichnis");
    for (const t of CHAPTER_TITLES) {
      expect(text).toContain(`## Kapitel`);
      expect(text).toContain(t);
    }
    // TOC-Links: klickbare Anker
    expect(text).toMatch(/\[Kapitel 1: Grundlagen der KI\]\(#kapitel-1-grundlagen-der-ki\)/);
    // Keine doppelten Leerzeichen
    expect(text).not.toMatch(/[^\n] {2,}[^\n]/);
  });

  it("normalisiert Typografie im Markdown", async () => {
    const res = await exportBook(book, "markdown");
    const text = await res.blob.text();
    expect(text).toContain("„praxisnahen“");
    expect(text).toContain(" – ");
    expect(text).not.toContain('"praxisnahen"');
    expect(text).not.toContain(" - ");
  });
});

// --- DOCX -------------------------------------------------------------------

describe("exportBook docx", () => {
  it("erzeugt eine gültige DOCX-Datei mit Titelei und 8 Kapiteln", async () => {
    const res = await exportBook(book, "docx");
    expect(res.format).toBe("docx");
    expect(res.filename).toMatch(/\.docx$/);
    expect(res.blob.size).toBeGreaterThan(5000);

    const zip = await readZip(res.blob);
    // DOCX-Signaturstruktur
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    const docXml = await zip.file("word/document.xml")!.async("string");

    // Titelei: Titel + Autor + Impressum
    expect(docXml).toContain("Testbuch: KI verstehen");
    expect(docXml).toContain("Testautor");
    expect(docXml).toContain("Impressum");
    expect(docXml).toContain("Alle Rechte vorbehalten.");
    expect(docXml).toContain("Inhaltsverzeichnis");
    // Kapitel als Heading1-Styles
    expect(docXml).toContain('w:val="Heading1"');
    // Seitenumbrüche (pageBreakBefore) — mind. 8 Kapitelanfänge
    const breaks = docXml.match(/<w:pageBreakBefore\s*\/>/g) ?? [];
    expect(breaks.length).toBeGreaterThanOrEqual(8);
    // Bookmarks + Hyperlinks für das klickbare TOC
    expect(docXml).toContain('w:bookmarkStart w:name="_kapitel_1"');
    expect(docXml).toContain('w:anchor="_kapitel_1"');
    // Alle 8 Kapitelüberschriften
    for (let i = 1; i <= 8; i++) {
      expect(docXml).toContain(`Kapitel ${i}`);
    }
  });

  it("normalisiert Typografie im DOCX-Text", async () => {
    const res = await exportBook(book, "docx");
    const zip = await readZip(res.blob);
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("„praxisnahen“");
    expect(docXml).not.toContain("&quot;praxisnahen&quot;");
    expect(docXml).not.toMatch(/\w - \w/);
  });
});

// --- EPUB -------------------------------------------------------------------

describe("exportBook epub", () => {
  it("erzeugt eine EPUB-Datei mit sauberem OPF/NCX, Kapitel-XHTMLs und nav", async () => {
    const res = await exportBook(book, "epub");
    expect(res.format).toBe("epub");
    expect(res.filename).toMatch(/\.epub$/);
    expect(res.blob.size).toBeGreaterThan(3000);

    const zip = await readZip(res.blob);

    // mimetype: erster Eintrag, unkomprimiert, exakter Inhalt
    const mimetype = zip.file("mimetype");
    expect(mimetype).not.toBeNull();
    expect(await mimetype!.async("string")).toBe("application/epub+zip");
    // erster Eintrag im Zip-Archiv (EPUB-Spec)
    expect(Object.keys(zip.files)[0]).toBe("mimetype");

    // container.xml verweist auf content.opf
    const container = await zip.file("META-INF/container.xml")!.async("string");
    expect(container).toContain('full-path="OEBPS/content.opf"');

    // OPF: Metadaten + Manifest mit allen Kapiteln
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain('version="3.0"');
    expect(opf).toContain("urn:uuid:");
    expect(opf).toContain("<dc:title>Testbuch: KI verstehen</dc:title>");
    expect(opf).toContain("<dc:creator>Testautor</dc:creator>");
    expect(opf).toContain("<dc:language>de</dc:language>");
    for (let i = 1; i <= 8; i++) {
      expect(opf).toContain(`href="kapitel-${i}.xhtml"`);
    }
    // dcterms:modified Pflichtfeld für EPUB3-Validatoren
    expect(opf).toContain("dcterms:modified");

    // NCX mit allen Kapiteln
    const ncx = await zip.file("OEBPS/toc.ncx")!.async("string");
    expect(ncx).toContain("dtb:uid");
    for (let i = 1; i <= 8; i++) {
      expect(ncx).toContain(`src="kapitel-${i}.xhtml"`);
    }

    // nav.xhtml (klickbares Inhaltsverzeichnis, EPUB3)
    const nav = await zip.file("OEBPS/nav.xhtml")!.async("string");
    expect(nav).toContain('epub:type="toc"');
    expect(nav).toMatch(/<a href="kapitel-1\.xhtml">Kapitel 1: Grundlagen der KI<\/a>/);

    // Kapitel-Dateien: UTF-8-Deklaration, eindeutige Anker-Ids
    for (let i = 1; i <= 8; i++) {
      const xhtml = await zip.file(`OEBPS/kapitel-${i}.xhtml`)!.async("string");
      expect(xhtml).toContain('encoding="UTF-8"');
      expect(xhtml).toContain(`id="kapitel-${i}"`);
      expect(xhtml).toContain("http://www.w3.org/1999/xhtml");
    }

    // CSS eingebunden
    expect(zip.file("OEBPS/styles.css")).not.toBeNull();
  });

  it("normalisiert Typografie in EPUB-Kapiteln", async () => {
    const res = await exportBook(book, "epub");
    const zip = await readZip(res.blob);
    const xhtml = await zip.file("OEBPS/kapitel-1.xhtml")!.async("string");
    expect(xhtml).toContain("„praxisnahen“");
    expect(xhtml).toContain(" – ");
    expect(xhtml).toContain(" – ");
    // XML-Escape: xmlEscape maskiert <, >, &, ", '
    expect(xmlEscape('<a href="x">&\'')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  });
});

// --- Roundtrip alle 3 Formate + Gate -----------------------------------------

describe("exportBook Roundtrip 8-Kapitel-Testbuch", () => {
  it("exportiert alle 3 Formate erfolgreich", async () => {
    const md = await exportBook(book, "markdown");
    const docx = await exportBook(book, "docx");
    const epub = await exportBook(book, "epub");

    expect(md.blob.size).toBeGreaterThan(1000);
    expect(docx.blob.size).toBeGreaterThan(5000);
    expect(epub.blob.size).toBeGreaterThan(3000);
    expect(md.filename).toBe("Testbuch_ KI verstehen.md");
    expect(docx.filename).toBe("Testbuch_ KI verstehen.docx");
    expect(epub.filename).toBe("Testbuch_ KI verstehen.epub");
  });

  it("needs_revision-Kapitel werden exportiert (Gate erlaubt)", async () => {
    const gate = checkExportGate(book.chapters);
    expect(gate.allowed).toBe(true);
    expect(gate.needsRevision.length).toBe(2);
    // Alle 8 Kapitel landen im Export
    const res = await exportBook(book, "epub");
    const zip = await readZip(res.blob);
    const ncx = await zip.file("OEBPS/toc.ncx")!.async("string");
    for (let i = 1; i <= 8; i++) {
      expect(ncx).toContain(`kapitel-${i}.xhtml`);
    }
  });
});

// --- normalizeTypography Re-Export ------------------------------------------

describe("normalizeTypography (Re-Export)", () => {
  it("ist über index exportiert", () => {
    expect(typeof normalizeTypography).toBe("function");
  });
});