// @vitest-environment happy-dom
// Unit-Tests für die Import-Services (DOMParser-basierte Parser laufen in happy-dom).
import { describe, it, expect } from "vitest";
import { parseMarkdown, parseMarkdownToChapters, importMarkdownFiles, isMarkdownFile } from "./markdown";
import { blocksToTipTap } from "./tiptap";
import { parseScrivx, flattenBinder, importScrivenerWithFiles } from "./scrivener";
import { importDocx } from "./docx";
import JSZip from "jszip";

describe("Markdown-Import", () => {
  it("erkennt Markdown-Dateien", () => {
    expect(isMarkdownFile("kapitel.md")).toBe(true);
    expect(isMarkdownFile("notes.TXT")).toBe(true);
    expect(isMarkdownFile("bild.png")).toBe(false);
  });

  it("parst Überschriften, Listen, Zitate und Code", () => {
    const md = [
      "# Titel",
      "",
      "Absatz eins.",
      "",
      "## Unterabschnitt",
      "- Punkt A",
      "1. Erster",
      "> Zitat",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n");
    const blocks = parseMarkdown(md);
    expect(blocks).toEqual([
      { type: "h1", text: "Titel" },
      { type: "p", text: "Absatz eins." },
      { type: "h2", text: "Unterabschnitt" },
      { type: "list_item", text: "Punkt A" },
      { type: "list_item", text: "Erster", ordered: true },
      { type: "quote", text: "Zitat" },
      { type: "code", text: "const x = 1;" },
    ]);
  });

  it("splitOnH1 erzeugt mehrere Kapitel", () => {
    const chapters = parseMarkdownToChapters("buch.md", "# K1\nText 1\n\n# K2\nText 2", 0, true);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("K1");
    expect(chapters[1].title).toBe("K2");
  });

  it("importiert mehrere Dateien alphabetisch", async () => {
    const doc = await importMarkdownFiles([
      { name: "b-zweites.md", text: "Zweiter Text" },
      { name: "a-erstes.md", text: "# Erstes\nErster Text" },
    ]);
    expect(doc.chapters.map((c) => c.title)).toEqual(["Erstes", "b-zweites"]);
    expect(doc.chapters[0].orderIndex).toBe(0);
    expect(doc.chapters[1].orderIndex).toBe(1);
  });
});

describe("TipTap-Konvertierung", () => {
  it("erzeugt valides Editor-JSON", () => {
    const json = JSON.parse(blocksToTipTap([
      { type: "h1", text: "Kapitel" },
      { type: "p", text: "Hallo" },
      { type: "list_item", text: "X", ordered: true },
    ]));
    expect(json.type).toBe("doc");
    expect(json.content[0].type).toBe("heading");
    expect(json.content[0].attrs.level).toBe(1);
    expect(json.content[2].type).toBe("orderedList");
  });
});

const SCRIVX = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject>
  <ProjectTitle>Mein Roman</ProjectTitle>
  <Binder>
    <BinderChildren>
      <BinderItem Type="Folder" UUID="uuid-root">
        <Title>Manuskript</Title>
        <Children>
          <BinderItem Type="Text" UUID="uuid-ch1">
            <Title>Kapitel Eins</Title>
            <IncludeInCompile>true</IncludeInCompile>
          </BinderItem>
          <BinderItem Type="Text" UUID="uuid-notes">
            <Title>Notizen</Title>
            <IncludeInCompile>false</IncludeInCompile>
          </BinderItem>
          <BinderItem Type="Folder" UUID="uuid-empty">
            <Title>Leerer Ordner</Title>
          </BinderItem>
        </Children>
      </BinderItem>
    </BinderChildren>
  </Binder>
</ScrivenerProject>`;

describe("Scrivener-Import", () => {
  it("parst den Binder korrekt", () => {
    const { title, root } = parseScrivx(SCRIVX);
    expect(title).toBe("Mein Roman");
    const flat = flattenBinder(root, true);
    expect(flat.map((f) => f.title)).toEqual(["Kapitel Eins", "Leerer Ordner"]);
    const flatAll = flattenBinder(root, false);
    expect(flatAll.map((f) => f.title)).toEqual(["Kapitel Eins", "Notizen", "Leerer Ordner"]);
  });

  it("importiert mit Resolver inkl. RTF-Konvertierung", async () => {
    const docs: Record<string, string> = {
      "uuid-ch1.rtf": "{\\rtf1\\ansi Erste \\b Zeile\\b0  hier.\\par Zweite Zeile.\\par}",
    };
    const doc = await importScrivenerWithFiles(SCRIVX, docs);
    expect(doc.title).toBe("Mein Roman");
    expect(doc.chapters[0].title).toBe("Kapitel Eins");
    expect(doc.chapters[0].content).toContain("Erste");
    // RTF-Steuerwörter sind entfernt:
    expect(doc.chapters[0].content).not.toContain("\\rtf1");
    // Notizen (IncludeInCompile=false) sind raus:
    expect(doc.chapters.some((c) => c.title === "Notizen")).toBe(false);
  });
});

async function buildDocx(): Promise<Uint8Array> {
  const documentXml = `<?xml version="1.0"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Testbuch</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Kapitel A</w:t></w:r></w:p>
      <w:p><w:r><w:t>Erster Absatz.</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Kapitel B</w:t></w:r></w:p>
      <w:p><w:r><w:t>Zweiter Absatz.</w:t></w:r></w:p>
    </w:body>
  </w:document>`;
  const coreXml = `<?xml version="1.0"?>
  <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Testbuch</dc:title><dc:creator>Erika Muster</dc:creator>
  </cp:coreProperties>`;
  const zip = new JSZip();
  zip.file("word/document.xml", documentXml);
  zip.file("docProps/core.xml", coreXml);
  return zip.generateAsync({ type: "uint8array" });
}

describe("DOCX-Import", () => {
  it("teilt an Heading1 und liest Metadaten", async () => {
    const data = await buildDocx();
    const doc = await importDocx(data);
    expect(doc.title).toBe("Testbuch");
    expect(doc.meta?.author).toBe("Erika Muster");
    expect(doc.chapters.map((c) => c.title)).toEqual(["Kapitel A", "Kapitel B"]);
    expect(doc.chapters[0].content).toContain("Erster Absatz.");
    expect(doc.chapters[1].content).toContain("Zweiter Absatz.");
  });

  it("wirft bei ungültiger Datei einen ImportError", async () => {
    await expect(importDocx(new TextEncoder().encode("kein zip"))).rejects.toThrow(/ZIP/);
  });
});
