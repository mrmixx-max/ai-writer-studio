// @vitest-environment happy-dom
// Tests für die Sprint-22-Importer-Engine (services/importer).
import { describe, it, expect } from "vitest";
import {
  importFromFile,
  parseTxt,
  parseDocx,
  parseEpub,
  parsePdf,
  detectChapters,
  countWords,
  titleFromFileName,
  ImportError,
} from "./importer";

const enc = new TextEncoder();

function txtFile(name: string, text: string): File {
  return new File([enc.encode(text)], name, { type: "text/plain" });
}

describe("parseTxt", () => {
  it("gibt TXT-Inhalt als Text zurück", async () => {
    const buf = enc.encode("Hallo Welt.\nZweite Zeile.").buffer as ArrayBuffer;
    await expect(parseTxt(buf)).resolves.toBe("Hallo Welt.\nZweite Zeile.");
  });

  it("entfernt UTF-8-BOM", async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode("ohne BOM")]);
    await expect(parseTxt(withBom.buffer as ArrayBuffer)).resolves.toBe("ohne BOM");
  });
});

describe("detectChapters", () => {
  it("erkennt Markdown-Header als Kapitel", () => {
    const text = "Intro\n# Erstes Kapitel\nText eins.\n## Zweites Kapitel\nText zwei.";
    const chapters = detectChapters(text, "^#{1,3} .+");
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("# Erstes Kapitel");
    expect(chapters[0].content).toContain("Text eins.");
    expect(chapters[1].title).toBe("## Zweites Kapitel");
    expect(chapters[1].content).toContain("Text zwei.");
  });

  it("erkennt 'Kapitel N'-Titel mit Default-Pattern", () => {
    const text = "Kapitel 1\nEs war einmal.\nKapitel 2\nUnd weiter geht's.";
    const chapters = detectChapters(text, "^Kapitel \\d+");
    expect(chapters).toHaveLength(2);
    expect(chapters[1].title).toBe("Kapitel 2");
  });

  it("liefert ein Fallback-Kapitel ohne Treffer", () => {
    const chapters = detectChapters("Nur Fließtext.", "^Kapitel \\d+");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].content).toBe("Nur Fließtext.");
  });

  it("wirft bei ungültigem Regex einen ImportError", () => {
    expect(() => detectChapters("Text", "(unclosed")).toThrow(ImportError);
  });
});

describe("importFromFile", () => {
  it("importiert TXT und liefert ein ImportResult", async () => {
    const file = txtFile("mein-roman.txt", "Kapitel 1\nEs war einmal.\nKapitel 2\nDas Ende.");
    const result = await importFromFile(file, {
      splitChapters: true,
      chapterPattern: "^Kapitel \\d+",
      language: "de",
    });
    expect(result.title).toBe("mein roman");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.chapters).toHaveLength(2);
    expect(result.projectId).toMatch(/^import_/);
    expect(result.content).toContain("Es war einmal.");
  });

  it("legt ohne Split genau ein Kapitel an", async () => {
    const file = txtFile("notizen.txt", "Kapitel 1\nText.");
    const result = await importFromFile(file, {
      splitChapters: false,
      chapterPattern: "^Kapitel \\d+",
      language: "auto",
    });
    expect(result.chapters).toHaveLength(1);
  });

  it("lehnt unbekannte Formate mit ImportError ab", async () => {
    const file = new File([enc.encode("x")], "bild.png", { type: "image/png" });
    await expect(
      importFromFile(file, { splitChapters: false, chapterPattern: "^Kapitel \\d+", language: "de" }),
    ).rejects.toThrow(ImportError);
  });

  it("lehnt leere Dateien ab", async () => {
    const file = txtFile("leer.txt", "   \n  ");
    await expect(
      importFromFile(file, { splitChapters: false, chapterPattern: "^Kapitel \\d+", language: "de" }),
    ).rejects.toThrow(ImportError);
  });
});

describe("parseDocx", () => {
  it("parst word/document.xml aus einem minimalen DOCX-ZIP", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:body><w:p><w:r><w:t>Hallo DOCX</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>Zweite Zeile</w:t></w:r></w:p></w:body></w:document>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const text = await parseDocx(buf);
    expect(text).toContain("Hallo DOCX");
    expect(text).toContain("Zweite Zeile");
  });

  it("wirft bei fehlendem document.xml", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("other.txt", "x");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(parseDocx(buf)).rejects.toThrow(ImportError);
  });
});

describe("parseEpub", () => {
  it("extrahiert Text entlang des Spine", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">` +
        `<rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0">` +
        `<manifest><item id="c1" href="ch1.xhtml"/></manifest>` +
        `<spine><itemref idref="c1"/></spine></package>`,
    );
    zip.file(
      "OEBPS/ch1.xhtml",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">` +
        `<body><h1>Anfang</h1><p>Es war einmal in einem EPUB.</p></body></html>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const text = await parseEpub(buf);
    expect(text).toContain("Es war einmal in einem EPUB.");
  });
});

describe("parsePdf", () => {
  it("extrahiert Tj-Texte aus einem minimalen PDF", async () => {
    const pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nBT /F1 12 Tf 72 720 Td (Hallo PDF Welt) Tj ET\n";
    const text = await parsePdf(enc.encode(pdf).buffer as ArrayBuffer);
    expect(text).toContain("Hallo PDF Welt");
  });

  it("lehnt Nicht-PDFs ab", async () => {
    await expect(parsePdf(enc.encode("kein pdf").buffer as ArrayBuffer)).rejects.toThrow(ImportError);
  });
});

describe("helpers", () => {
  it("countWords zählt Wörter", () => {
    expect(countWords("eins zwei drei")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("titleFromFileName säubert Dateinamen", () => {
    expect(titleFromFileName("mein_roman-entwurf.docx")).toBe("mein roman entwurf");
  });
});
