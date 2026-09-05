// Sprint 3, Agent 3 — Advanced Publishing & Workflow-Integration.
// Akzeptanzkriterien:
//   1. DOCX mit standardisierten Formatvorlagen (H1, H2, Standard, Einzug)
//      + Dokument-Metadaten (Core Properties).
//   2. OPML-Export für Scrivener-Import (exportBook, "opml").
//   3. EPUB ohne Inline-Styles, semantisches HTML mit CSS-Klassen (Jutoh).
//   4. DOCX mit Custom XML Parts + Custom Properties für VBA-Makros
//      ("AI Text Refinement Suites") inkl. versteckter Tags.
//
// Nur Struktur-Assertions auf ZIP-Ebene — kein Word/LibreOffice nötig.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportBook } from "./index";
import { buildBookOpml } from "./opml";
import { makeTestBook, CHAPTER_TITLES } from "../testbook";

const book = makeTestBook();

async function readZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

// --- 1+4: DOCX — Formatvorlagen, Metadaten, Custom XML für VBA ---------------

describe("exportBook docx: standardisierte Formatvorlagen (Sprint 3)", () => {
  it("definiert die Style-Ids Standard, Einzug, Heading1, Heading2 in styles.xml", async () => {
    const res = await exportBook(book, "docx");
    const zip = await readZip(res.blob);
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    for (const styleId of ["Standard", "Einzug", "Heading1", "Heading2"]) {
      expect(stylesXml).toContain(`w:styleId="${styleId}"`);
    }
    // Deutsche Namen sichtbar (Word/LibreOffice Style-Galerie)
    expect(stylesXml).toContain('w:val="Standard"');
    expect(stylesXml).toContain('w:val="Einzug"');
    // Einzug: erster-Zeilen-Einzug definiert (Standard-KDP-Prosa)
    expect(stylesXml).toMatch(/w:styleId="Einzug"[\s\S]*?w:firstLine="\d+"/);
  });

  it("verwendet die Formatvorlagen im Dokument (pStyle-Verweise)", async () => {
    // Eigenes Buch mit Zitat + Liste, damit der Einzug-Style referenziert wird
    const quoteDoc = JSON.stringify({
      type: "doc",
      content: [
        { type: "blockquote", content: [{ type: "text", text: "Ein Zitat mit Gewicht." }] },
        { type: "bullet_list", content: [{ type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Punkt eins" }] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Zwischenüberschrift" }] },
      ],
    });
    const res = await exportBook(
      {
        title: "Style-Probe",
        author: "Testautor",
        chapters: [{ number: 1, title: "Prolog", content: quoteDoc }],
      },
      "docx",
    );
    const zip = await readZip(res.blob);
    const docXml = await zip.file("word/document.xml")!.async("string");

    // Fließtext über Standard-Style statt Inline-Formatierung
    expect(docXml).toContain('<w:pStyle w:val="Standard"/>');
    // Zitat/Listen über Einzug-Style
    expect(docXml).toContain('<w:pStyle w:val="Einzug"/>');
    // Kapitel als echte Überschriften
    expect(docXml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(docXml).toContain('<w:pStyle w:val="Heading2"/>');
  });

  it("schreibt Dokument-Metadaten (Core Properties)", async () => {
    const res = await exportBook(book, "docx");
    const zip = await readZip(res.blob);
    const coreXml = await zip.file("docProps/core.xml")!.async("string");

    expect(coreXml).toContain("Testbuch: KI verstehen");
    expect(coreXml).toContain("Testautor");
    expect(coreXml).toContain("AI Writer Studio");
  });

  it("hängt Custom Properties für die AI Text Refinement Suites an", async () => {
    const res = await exportBook(book, "docx");
    const zip = await readZip(res.blob);
    const customProps = await zip.file("docProps/custom.xml")!.async("string");

    expect(customProps).toContain("AIWS_AISuite");
    expect(customProps).toContain("AI Text Refinement Suites");
    expect(customProps).toContain("AIWS_Version");
    expect(customProps).toContain("AIWS_ChapterCount");
  });

  it("bettet eine Custom XML Part (customXml/item1.xml) mit VBA-Metadaten ein", async () => {
    const res = await exportBook(book, "docx");
    const zip = await readZip(res.blob);

    const item = await zip.file("customXml/item1.xml")!.async("string");
    // Namensraum für ActiveDocument.CustomXMLParts.SelectNodes(...)
    expect(item).toContain("urn:ai-writer-studio:ai-text-refinement");
    expect(item).toContain("AI Text Refinement Suites");
    // Buch- + Kapitel-Metadaten je Kapitel
    expect(item).toContain("Testbuch: KI verstehen");
    for (let i = 1; i <= 8; i++) {
      expect(item).toContain(`index="${i}"`);
    }
    // Versteckte Tags (Zero-Width-Marker) für das VBA-Greifen
    expect(item).toContain("\u200B");

    // itemProps (datastoreItem) gehört zur standardkonformen Registration
    const itemProps = await zip.file("customXml/itemProps1.xml")!.async("string");
    expect(itemProps).toContain("customXml\"");
    expect(itemProps).toMatch(/ds:itemID="\{[0-9a-f-]+\}"/i);

    // Content-Types: Overrides für beide Parts
    const contentTypes = await zip.file("[Content_Types].xml")!.async("string");
    expect(contentTypes).toContain('PartName="/customXml/item1.xml"');
    expect(contentTypes).toContain(
      'PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"',
    );
  });
});

// --- 2: OPML-Export für Scrivener --------------------------------------------

describe("exportBook opml: Scrivener-Import", () => {
  it("erzeugt valides OPML 2.0 mit Buch-Outline und allen Kapiteln", async () => {
    const res = await exportBook(book, "opml");
    expect(res.format).toBe("opml");
    expect(res.filename).toBe("Testbuch_ KI verstehen.opml");
    const opml = await res.blob.text();

    expect(opml.startsWith("<?xml")).toBe(true);
    expect(opml).toContain('<opml version="2.0">');
    expect(opml).toContain("<title>Testbuch: KI verstehen</title>");
    expect(opml).toContain("<ownerName>Testautor</ownerName>");
    // Buch als Wurzel-Outline, Kapitel als Kinder
    expect(opml).toContain(`<outline text="Testbuch: KI verstehen">`);
    for (const t of CHAPTER_TITLES) {
      expect(opml).toContain(t);
    }
    for (let i = 1; i <= 8; i++) {
      expect(opml).toContain(`_chapterNumber="${i}"`);
    }
  });

  it("maskiert XML-Sonderzeichen in Titeln und liefert Kapitel-Metadaten", () => {
    const opml = buildBookOpml(
      { title: "Forschung & Development \"2026\" <Draft>", author: "A & B" },
      [{ number: 1, title: "Pfad <C:\\temp>", content: "", status: "draft" }],
    );
    expect(opml).toContain("Forschung &amp; Development &quot;2026&quot; &lt;Draft&gt;");
    expect(opml).toContain("<ownerName>A &amp; B</ownerName>");
    expect(opml).toContain("Pfad &lt;C:\\temp&gt;");
    expect(opml).toContain('_status="draft"');
  });
});

// --- 3: EPUB — Jutoh-optimiert, semantisch, ohne Inline-Styles ---------------

describe("exportBook epub: Jutoh-optimiertes semantisches HTML", () => {
  it("enthält keine Inline-Styles in irgendeiner XHTML-Datei", async () => {
    const res = await exportBook(book, "epub");
    const zip = await readZip(res.blob);

    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith(".xhtml")) continue;
      const xhtml = await zip.file(name)!.async("string");
      expect(xhtml, name).not.toContain('style="');
    }
  });

  it("nutzt semantische Tags + CSS-Klassen statt Inline-Formatierung", async () => {
    const res = await exportBook(book, "epub");
    const zip = await readZip(res.blob);

    const kapitel = await zip.file("OEBPS/kapitel-1.xhtml")!.async("string");
    expect(kapitel).toContain('class="chapter-title"');
    expect(kapitel).toContain('class="noindent"');
    // Semantische Struktur bleibt erhalten
    expect(kapitel).toMatch(/<h1 [^>]*class="chapter-title"/);

    const titel = await zip.file("OEBPS/kapitel-titel.xhtml")!.async("string");
    expect(titel).toContain('class="center"');

    // CSS liefert die Klassen im Stylesheet (einmalig zentral)
    const css = await zip.file("OEBPS/styles.css")!.async("string");
    for (const cls of [".chapter-title", ".noindent", ".center"]) {
      expect(css).toContain(cls);
    }
  });

  it("Jutoh-Hinweis über OPF-Metadaten (pur: true kompatibel, Generator vermerkt)", async () => {
    const res = await exportBook(book, "epub");
    const zip = await readZip(res.blob);
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("AI Writer Studio");
  });
});
