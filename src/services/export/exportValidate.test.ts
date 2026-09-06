// Export-Roundtrip-Härtung (Sprint 10, Agent 2, Retry #2):
// generate → validate → assert. DOCX/EPUB/PDF-Roundtrips über
// bookwriter/export (8-Kapitel-Testbuch) und services/export (toDocx/toEpub/
// toPdf/toWinAnsiSafe), Negativfälle, checkXmlWellFormed-Units, WinAnsi-
// Char-Code-Assertions (alle Sonderzeichen als \u-Escapes — nie literale
// Unicode-Zeichen durch die Shell schleusen).

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportBook } from "../bookwriter/export/index";
import { makeTestBook } from "../bookwriter/testbook";
import { toDocx, toPdf, toEpub, toWinAnsiSafe, type Block } from "./index";
import {
  validateDocxBlob,
  validateEpubBlob,
  validatePdfBlob,
  validateExportBlob,
  checkXmlWellFormed,
} from "./exportValidate";

const book = makeTestBook();
const TOC_ANCHORS = Array.from({ length: 8 }, (_, i) => `_kapitel_${i + 1}`);

async function rezip(blob: Blob, mutate: (zip: JSZip) => Promise<void> | void): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  await mutate(zip);
  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Blob([buf as BlobPart], { type: "application/zip" });
}

// --- DOCX -------------------------------------------------------------------

describe("DOCX-Validator (Roundtrip)", () => {
  it("validiert einen generierten DOCX-Export (8 Kapitel, TOC-Anker)", async () => {
    const res = await exportBook(book, "docx");
    const v = await validateDocxBlob(res.blob, { expectTocAnchors: TOC_ANCHORS, minChapters: 8 });
    expect(v.ok).toBe(true);
    expect(v.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(v.details.files).toBeGreaterThan(5);
  });

  it("erkennt korrupte DOCX-Bytes (ZIP-Integrität)", async () => {
    const res = await exportBook(book, "docx");
    const bytes = new Uint8Array(await res.blob.arrayBuffer());
    const broken = new Blob([bytes.slice(0, Math.min(200, bytes.length))]);
    const v = await validateDocxBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "DOCX_ZIP_INVALID")).toBe(true);
  });

  it("erkennt fehlendes word/document.xml", async () => {
    const res = await exportBook(book, "docx");
    const broken = await rezip(res.blob, (zip) => {
      zip.remove("word/document.xml");
    });
    const v = await validateDocxBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "DOCX_NO_DOCUMENT")).toBe(true);
  });

  it("services/export toDocx: Umlaute/ß-Titel rendern und validieren", async () => {
    const blocks: Block[] = [
      { type: "h1", text: "Gr\u00F6\u00DFe und G\u00FCte" },
      { type: "p", text: "Absatz mit Umlauten: \u00E4\u00F6\u00FC \u00C4\u00D6\u00DC \u00DF" },
    ];
    const blob = await toDocx(blocks, "Gr\u00F6\u00DFe & G\u00FCte");
    const v = await validateDocxBlob(blob);
    expect(v.ok).toBe(true);
    expect(v.details.files).toBeGreaterThan(5);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("Gr\u00F6\u00DFe");
    expect(checkXmlWellFormed(docXml).ok).toBe(true);
  });
});

// --- EPUB -------------------------------------------------------------------

describe("EPUB-Validator (Roundtrip)", () => {
  it("validiert einen generierten EPUB-Export (Manifest/Spine/NCX/nav)", async () => {
    const res = await exportBook(book, "epub");
    const v = await validateEpubBlob(res.blob, { minChapters: 8 });
    expect(v.ok).toBe(true);
    expect(v.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(v.details.manifestItems).toBeGreaterThanOrEqual(11);
  });

  it("erkennt Manifest-Bruch (fehlende Kapitel-Datei)", async () => {
    const res = await exportBook(book, "epub");
    const broken = await rezip(res.blob, (zip) => {
      zip.remove("OEBPS/kapitel-3.xhtml");
    });
    const v = await validateEpubBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EPUB_MANIFEST_DANGLING")).toBe(true);
  });

  it("erkennt falschen mimetype-Inhalt", async () => {
    const res = await exportBook(book, "epub");
    const broken = await rezip(res.blob, async (zip) => {
      zip.file("mimetype", "text/plain");
    });
    const v = await validateEpubBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EPUB_MIMETYPE_CONTENT")).toBe(true);
  });

  it("services/export toEpub: Umlaute/\u00DF + &<> in Metadaten bleiben valide", async () => {
    const blocks: Block[] = [
      { type: "h1", text: "Anfang & Ende" },
      { type: "p", text: "Text mit Umlauten: \u00E4\u00F6\u00FC \u00C4\u00D6\u00DC \u00DF \u201EZitat\u201C \u2013 Strich." },
    ];
    const blob = await toEpub(
      blocks,
      "Gr\u00F6\u00DFe & G\u00FCte <Test>",
      "J\u00FCrgen Stra\u00DFer & S\u00F6hne",
    );
    const v = await validateEpubBlob(blob);
    expect(v.ok).toBe(true);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("Gr\u00F6\u00DFe &amp; G\u00FCte");
    expect(opf).toContain("J\u00FCrgen Stra\u00DFer &amp; S\u00F6hne");
    expect(checkXmlWellFormed(opf).ok).toBe(true);
    const xhtml = await zip.file("OEBPS/content.xhtml")!.async("string");
    expect(checkXmlWellFormed(xhtml).ok).toBe(true);
  });

  it("erkennt fehlende META-INF/container.xml", async () => {
    const res = await exportBook(book, "epub");
    const broken = await rezip(res.blob, (zip) => {
      zip.remove("META-INF/container.xml");
    });
    const v = await validateEpubBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EPUB_NO_CONTAINER")).toBe(true);
  });

  it("erkennt korrupte EPUB-Bytes (ZIP-Integrität)", async () => {
    const res = await exportBook(book, "epub");
    const bytes = new Uint8Array(await res.blob.arrayBuffer());
    const broken = new Blob([bytes.slice(0, Math.min(200, bytes.length))]);
    const v = await validateEpubBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EPUB_ZIP_INVALID")).toBe(true);
  });

  it("erkennt Spine-Verweis auf unbekannte Manifest-Id", async () => {
    const res = await exportBook(book, "epub");
    const broken = await rezip(res.blob, async (zip) => {
      const opfFile = zip.file("OEBPS/content.opf")!;
      const opf = await opfFile.async("string");
      zip.file("OEBPS/content.opf", opf.replace("</spine>", '<itemref idref="gibt_es_nicht"/></spine>'));
    });
    const v = await validateEpubBlob(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EPUB_SPINE_DANGLING")).toBe(true);
  });
});

// --- XML-Wohlgeformtheit (Unit) ----------------------------------------------

describe("checkXmlWellFormed (Unit)", () => {
  it("akzeptiert valides XML mit Umlauten/\u00DF und Entities", () => {
    expect(checkXmlWellFormed('<?xml version="1.0"?><a title="x &amp; y">Gr\u00F6\u00DFe \u00E4\u00F6\u00FC</a>').ok).toBe(true);
    expect(checkXmlWellFormed("<a><b/><c>t</c></a>").ok).toBe(true);
  });

  it("lehnt rohes &, Tag-Mismatch und ungeschlossene Tags ab", () => {
    expect(checkXmlWellFormed("<a>Fisch & Chips</a>").ok).toBe(false);
    expect(checkXmlWellFormed("<a><b></a></b>").ok).toBe(false);
    expect(checkXmlWellFormed("<a><b></b>").ok).toBe(false);
    expect(checkXmlWellFormed("<a>Text").ok).toBe(false);
  });
});

// --- WinAnsi-Fallback (Char-Code-Assertions) ----------------------------------

describe("toWinAnsiSafe (WinAnsi-H\u00E4rtung, Char-Codes)", () => {
  it("entfernt ZWSP (U+200B), erhält SHY (U+00AD = valides WinAnsi/cp1252)", () => {
    expect(toWinAnsiSafe("A\u200BB")).toBe("AB");
    // SHY ist in WinAnsi enthalten (0xAD, deutsche Trennhilfe) → erhalten.
    expect(toWinAnsiSafe("A\u00ADB")).toBe("A\u00ADB");
    expect(toWinAnsiSafe("\u200B\u00AD")).toBe("\u00AD");
  });

  it("ersetzt Pfeile deterministisch (U+2192/2190/2194)", () => {
    expect(toWinAnsiSafe("Pfeil \u2192")).toBe("Pfeil ->");
    expect(toWinAnsiSafe("\u2190 links")).toBe("<- links");
    expect(toWinAnsiSafe("A \u2194 B")).toBe("A <-> B");
  });

  it("beh\u00E4lt Deutsch + WinAnsi-Typografie (Umlaute/\u00DF/\u20AC/\u2026/\u2013/\u2014/\u201E/\u201C)", () => {
    const de = "Gr\u00F6\u00DFe \u00E4\u00F6\u00FC \u00C4\u00D6\u00DC \u00DF \u20AC \u2026 \u201EZitat\u201C \u2013 \u2014";
    expect(toWinAnsiSafe(de)).toBe(de);
  });

  it("ersetzt Emoji/Check/CJK durch ? (UTF-16-Surrogatpaare \u2192 ??)", () => {
    expect(toWinAnsiSafe("A\u2713B")).toBe("A?B");
    expect(toWinAnsiSafe("Emoji \uD83D\uDE80")).toBe("Emoji ??");
    expect(toWinAnsiSafe("\u6F22\u5B57")).toBe("??");
  });

  it("strippt Steuerzeichen, beh\u00E4lt \\n und \\t", () => {
    expect(toWinAnsiSafe("A\u0001\u0002B\u007FC")).toBe("ABC");
    expect(toWinAnsiSafe("A\nB\tC")).toBe("A\nB\tC");
  });
});

// --- PDF --------------------------------------------------------------------

describe("PDF-Validator (Roundtrip)", () => {
  const blocks: Block[] = [
    { type: "h1", text: "Gr\u00F6\u00DFe und G\u00FCte \u2014 ein \u201ETest\u201C" },
    { type: "p", text: "Absatz mit Umlauten: \u00E4\u00F6\u00FC \u00C4\u00D6\u00DC \u00DF und Gedankenstrich \u2013 sowie Auslassung \u2026" },
    { type: "p", text: "Emoji und CJK d\u00FCrfen nicht crashen: \uD83D\uDE80 \u6F22\u5B57 \u2192 ersetzt." },
    { type: "quote", text: "Zitat von J\u00FCrgen Stra\u00DFer" },
  ];

  it("validiert ein generiertes PDF (Header, Seiten, Titel-Metadaten)", async () => {
    const blob = await toPdf(blocks, "Gr\u00F6\u00DFe & G\u00FCte", { author: "J\u00FCrgen Stra\u00DFer" });
    const v = await validatePdfBlob(blob, { expectTitle: "Gr\u00F6\u00DFe & G\u00FCte" });
    expect(v.ok).toBe(true);
    expect(v.details.pageCount).toBeGreaterThanOrEqual(1);
    expect(v.details.title).toBe("Gr\u00F6\u00DFe & G\u00FCte");
  });

  it("toWinAnsiSafe erh\u00E4lt Deutsch, ersetzt Nicht-WinAnsi deterministisch", () => {
    expect(toWinAnsiSafe("Gr\u00F6\u00DFe \u2026 \u201EZitat\u201C \u2013 \u20AC")).toBe("Gr\u00F6\u00DFe \u2026 \u201EZitat\u201C \u2013 \u20AC");
    expect(toWinAnsiSafe("A\u2713B")).toBe("A?B");
    expect(toWinAnsiSafe("Pfeil \u2192")).toBe("Pfeil ->");
    expect(toWinAnsiSafe("Emoji \uD83D\uDE80")).toBe("Emoji ??");
  });

  it("erkennt ung\u00FCltigen PDF-Header", async () => {
    const fake = new Blob(["kein pdf", { type: "application/pdf" }] as unknown as BlobPart[]);
    const v = await validatePdfBlob(fake);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "PDF_BAD_HEADER")).toBe(true);
  });

  it("validateExportBlob routet alle drei Formate", async () => {
    const docx = await exportBook(book, "docx");
    const epub = await exportBook(book, "epub");
    const pdf = await toPdf(blocks, "Titel");
    expect((await validateExportBlob(docx.blob, "docx", { minChapters: 8 })).ok).toBe(true);
    expect((await validateExportBlob(epub.blob, "epub", { minChapters: 8 })).ok).toBe(true);
    expect((await validateExportBlob(pdf, "pdf")).ok).toBe(true);
  });
});

// --- Generischer EPUB-Export --------------------------------------------------

describe("Generischer EPUB-Export (services/export)", () => {
  it("mimetype zuerst/STORE, OPF-Manifest stimmt mit ZIP \u00FCberein", async () => {
    const genBlocks: Block[] = [
      { type: "h1", text: "Kapitel Eins" },
      { type: "p", text: "Text mit Umlauten: \u00E4\u00F6\u00FC \u00DF." },
    ];
    const blob = await toEpub(genBlocks, "Generischer Titel", "Autor");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)[0]).toBe("mimetype");
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
    const v = await validateEpubBlob(blob);
    expect(v.ok).toBe(true);
  });
});
