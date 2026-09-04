// Buch-EPUB 3 (KDP-tauglich): mimetype zuerst (stored), container.xml,
// OPF (Paket) mit DC-Metadaten, NCX für ältere Reader, ein XHTML-Kapitel je
// Datei, klickbares Inhaltsverzeichnis (nav.xhtml + NCX), UTF-8, CSS.

import JSZip from "jszip";
import type { Block } from "@/services/export/blocks";
import type { BookChapterInput } from "./types";
import {
  chapterHeading,
  normalizedChapterBlocks,
  buildEpubChapterXhtml,
  buildEpubTitleXhtml,
} from "./structure";

const EPUB_CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; margin: 5%; color: #222; }
h1 { font-size: 1.8em; margin: 1.5em 0 0.5em; page-break-before: always; break-before: page; }
h2 { font-size: 1.4em; margin-top: 1.2em; }
h3 { font-size: 1.2em; margin-top: 1em; }
p { margin: 0.5em 0; text-align: justify; text-indent: 1.2em; }
blockquote { margin: 1em 2em; padding-left: 1em; border-left: 3px solid #ccc; font-style: italic; }
pre { font-family: "Courier New", monospace; background: #f4f4f4; padding: 1em; overflow-x: auto; font-size: 0.9em; }
ul, ol { margin: 0.5em 0; padding-left: 2em; }
.title-page { text-align: center; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.4em 0; }
`;

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

interface ZipInput {
  meta: { title: string; author: string; language?: string };
  chapters: BookChapterInput[];
  blocksPerChapter: Block[][];
  year: number;
  uuid: string;
}

function buildOpf(input: ZipInput): string {
  const lang = input.meta.language ?? "de";
  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
  ];
  const spineItems: string[] = [`<itemref idref="nav" linear="no"/>`];
  const ncxPoints: string[] = [];
  const navLis: string[] = [];

  // Titelblatt (Kapitel 0)
  manifestItems.push(`<item id="chap-titel" href="kapitel-titel.xhtml" media-type="application/xhtml+xml"/>`);
  spineItems.push(`<itemref idref="chap-titel"/>`);
  ncxPoints.push(
    `<navPoint id="np-titel" playOrder="1"><navLabel><text>Titelblatt</text></navLabel><content src="kapitel-titel.xhtml"/></navPoint>`,
  );

  input.chapters.forEach((c, i) => {
    const num = c.number ?? i + 1;
    const id = `chap-${num}`;
    manifestItems.push(`<item id="${id}" href="kapitel-${num}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    const playOrder = i + 2;
    ncxPoints.push(
      `<navPoint id="np-${num}" playOrder="${playOrder}"><navLabel><text>${chapterHeading(c, i)}</text></navLabel><content src="kapitel-${num}.xhtml"/></navPoint>`,
    );
    navLis.push(
      `<li><a href="kapitel-${num}.xhtml">${chapterHeading(c, i)}</a></li>`,
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${input.uuid}</dc:identifier>
    <dc:title>${input.meta.title}</dc:title>
    <dc:creator>${input.meta.author}</dc:creator>
    <dc:language>${lang}</dc:language>
    <dc:date>${new Date().toISOString().slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
${manifestItems.map((i) => `    ${i}`).join("\n")}
  </manifest>
  <spine toc="ncx">
${spineItems.map((s) => `    ${s}`).join("\n")}
  </spine>
</package>`;
}

function buildNcx(input: ZipInput): string {
  const lang = input.meta.language ?? "de";
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${lang}">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${input.uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${input.meta.title}</text></docTitle>
  <navMap>
${input.chapters
  .map((c, i) => {
    const num = c.number ?? i + 1;
    const playOrder = i + 2;
    return `    <navPoint id="np-${num}" playOrder="${playOrder}"><navLabel><text>${chapterHeading(c, i)}</text></navLabel><content src="kapitel-${num}.xhtml"/></navPoint>`;
  })
  .join("\n")}
  </navMap>
</ncx>`;
}

function buildNavXhtml(input: ZipInput): string {
  const lis = [
    `      <li><a href="kapitel-titel.xhtml">Titelblatt</a></li>`,
    ...input.chapters.map((c, i) => {
      const num = c.number ?? i + 1;
      return `      <li><a href="kapitel-${num}.xhtml">${chapterHeading(c, i)}</a></li>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="de" lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Inhaltsverzeichnis</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Inhaltsverzeichnis</h1>
  <ol>
${lis.join("\n")}
  </ol>
</nav>
</body>
</html>`;
}

export async function buildBookEpubBlob(
  meta: { title: string; author: string; language?: string },
  chapters: BookChapterInput[],
  blocksPerChapter: Block[][],
): Promise<Blob> {
  const year = new Date().getFullYear();
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const input: ZipInput = { meta, chapters, blocksPerChapter, year, uuid };

  const zip = new JSZip();
  // mimetype MUSS erster, unkomprimierter Eintrag sein (EPUB-Spec/Calibre).
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", containerXml());

  // Titelblatt
  zip.file(
    "OEBPS/kapitel-titel.xhtml",
    buildEpubTitleXhtml(meta.title, meta.author, year),
  );

  // Kapitel als einzelne XHTML-Dateien
  chapters.forEach((c, i) => {
    const num = c.number ?? i + 1;
    zip.file(
      `OEBPS/kapitel-${num}.xhtml`,
      buildEpubChapterXhtml(c, normalizedChapterBlocks(blocksPerChapter[i] ?? []), meta.title),
    );
  });

  zip.file("OEBPS/nav.xhtml", buildNavXhtml(input));
  zip.file("OEBPS/toc.ncx", buildNcx(input));
  zip.file("OEBPS/content.opf", buildOpf(input));
  zip.file("OEBPS/styles.css", EPUB_CSS);

  const buf = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
  return new Blob([buf as BlobPart], { type: "application/epub+zip" });
}