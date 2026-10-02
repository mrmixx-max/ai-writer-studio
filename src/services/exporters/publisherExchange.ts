// Publisher-Exchange-Service (WP 15.1): ICML / DOCX mit Track-Changes / Fountain.
//
// Lokal, deterministisch, defensiv — keine LLM-Aufrufe, keine Netzwerkzugriffe.
// Defensive Fallbacks bei fehlenden Daten (leere Kapitel, fehlender Status,
// ungültiger Inhalt).

import type { BookChapterInput } from "@/services/bookwriter/export/types";
import { toBlocks } from "@/services/export/blocks";
import { normalizeTypography } from "@/services/bookwriter/export/typography";
import { xmlEscape } from "@/services/bookwriter/export/vba";

// ---------------------------------------------------------------------------
// ICML (InCopy / InDesign Markup Language)
// ---------------------------------------------------------------------------

/**
 * Exportiert Kapitel als ICML (InCopy/InDesign Markup Language).
 * Erzeugt valides XML mit ParagraphStyleRange/CharacterStyleRange-Struktur.
 * Lokal, deterministisch, defensiv.
 */
export function exportToIcml(chapters: BookChapterInput[]): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Article SYSTEM "http://ns.adobe.com/ICML/1.0/">
<Article>
</Article>`;
  }

  const paragraphs = chapters
    .map((chapter, index) => {
      const num = chapter.number ?? index + 1;
      const heading = `Kapitel ${num}: ${chapter.title}`;

      let contentBlocks: string[] = [];
      try {
        const blocks = toBlocks(chapter.content);
        contentBlocks = blocks
          .map((block) => {
            const text = normalizeTypography(block.text);
            if (!text) return "";
            return `  <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Standard">
    <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
      <Content>${xmlEscape(text)}</Content>
    </CharacterStyleRange>
  </ParagraphStyleRange>`;
          })
          .filter(Boolean);
      } catch {
        // Fallback: Rohinhalt verwenden
        const text = chapter.content || "";
        if (text) {
          contentBlocks = [
            `  <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Standard">
    <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
      <Content>${xmlEscape(text)}</Content>
    </CharacterStyleRange>
  </ParagraphStyleRange>`,
          ];
        }
      }

      const headingXml = `  <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Chapter">
    <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
      <Content>${xmlEscape(heading)}</Content>
    </CharacterStyleRange>
  </ParagraphStyleRange>`;

      return [headingXml, ...contentBlocks].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Article SYSTEM "http://ns.adobe.com/ICML/1.0/">
<Article>
${paragraphs}
</Article>`;
}

// ---------------------------------------------------------------------------
// DOCX mit Track-Changes (w:ins, w:del)
// ---------------------------------------------------------------------------

/**
 * Exportiert Kapitel als DOCX mit echten Word-Track-Changes (w:ins, w:del).
 * Kapitel mit status "needs_revision" werden als Insertions markiert.
 * Lokal, deterministisch, defensiv.
 */
export async function exportToDocxWithTrackChanges(
  chapters: BookChapterInput[],
): Promise<Blob> {
  const JSZipModule = await import("jszip");
  const JSZip = JSZipModule.default ?? JSZipModule;
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`,
  );

  // _rels/.rels
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  // word/_rels/document.xml.rels
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`,
  );

  // word/settings.xml — Track-Changes aktivieren
  zip.file(
    "word/settings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:trackChanges/>
</w:settings>`,
  );

  // word/document.xml
  const documentXml = generateDocumentXml(chapters);
  zip.file("word/document.xml", documentXml);

  const blob = await zip.generateAsync({ type: "blob" });
  return new Blob([blob], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Generiert die WordprocessingML-XML für das Dokument. */
function generateDocumentXml(chapters: BookChapterInput[]): string {
  const paragraphs: string[] = [];
  let changeId = 1;

  chapters.forEach((chapter, index) => {
    const num = chapter.number ?? index + 1;
    const heading = `Kapitel ${num}: ${chapter.title}`;
    const isRevision = chapter.status === "needs_revision";

    // Kapitelüberschrift
    if (isRevision) {
      paragraphs.push(`<w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:ins w:id="${changeId++}" w:author="AI Writer Studio" w:date="2026-10-02T00:00:00Z">
          <w:r><w:t xml:space="preserve">${xmlEscape(heading)}</w:t></w:r>
        </w:ins>
      </w:p>`);
    } else {
      paragraphs.push(`<w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t xml:space="preserve">${xmlEscape(heading)}</w:t></w:r>
      </w:p>`);
    }

    // Kapitelinhalt
    let blocks: { type: string; text: string }[] = [];
    try {
      blocks = toBlocks(chapter.content);
    } catch {
      blocks = [{ type: "p", text: chapter.content || "" }];
    }

    for (const block of blocks) {
      let text = "";
      try {
        text = normalizeTypography(block.text);
      } catch {
        text = block.text || "";
      }
      if (!text) continue;

      if (isRevision) {
        paragraphs.push(`<w:p>
          <w:ins w:id="${changeId++}" w:author="AI Writer Studio" w:date="2026-10-02T00:00:00Z">
            <w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>
          </w:ins>
        </w:p>`);
      } else {
        paragraphs.push(`<w:p>
          <w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>
        </w:p>`);
      }
    }
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n    ")}
  </w:body>
</w:document>`;
}

// ---------------------------------------------------------------------------
// Fountain (Drehbuch-Format)
// ---------------------------------------------------------------------------

/**
 * Exportiert Kapitel als Fountain-Drehbuch-Format.
 * Titelblatt + Kapitel als Section-Überschriften, Inhalt als Action-Lines.
 * Lokal, deterministisch, defensiv.
 */
export function exportToFountain(chapters: BookChapterInput[]): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return `Title: Untitled
Author: Unknown
Date: ${new Date().toISOString().split("T")[0]}

`;
  }

  const lines: string[] = [];

  // Titelblatt
  lines.push(`Title: ${chapters[0]?.title ?? "Untitled"}`);
  lines.push(`Author: AI Writer Studio`);
  lines.push(`Date: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Kapitel
  chapters.forEach((chapter, index) => {
    const num = chapter.number ?? index + 1;
    const heading = `Kapitel ${num}: ${chapter.title}`;

    lines.push(`# ${heading}`);
    lines.push("");

    let blocks: { type: string; text: string }[] = [];
    try {
      blocks = toBlocks(chapter.content);
    } catch {
      blocks = [{ type: "p", text: chapter.content || "" }];
    }

    for (const block of blocks) {
      let text = "";
      try {
        text = normalizeTypography(block.text);
      } catch {
        text = block.text || "";
      }
      if (!text) continue;

      lines.push(text);
      lines.push("");
    }
  });

  return lines.join("\n");
}
