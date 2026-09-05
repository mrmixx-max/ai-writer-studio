// VBA-Integration (Sprint 3, Agent 3): DOCX-Metadaten + Custom XML Part für
// externe VBA-Makros ("AI Text Refinement Suites") in Microsoft Word.
//
// Die Suites greifen die Datei über zwei Kanäle:
//   1. docProps/custom.xml → ActiveDocument.CustomDocumentProperties
//      (AIWS_AISuite, AIWS_Version, AIWS_ChapterCount, AIWS_ExportedAt)
//   2. customXml/item1.xml → ActiveDocument.CustomXMLParts
//      (Namensraum urn:ai-writer-studio:ai-text-refinement, je Kapitel
//       index/title/status/text + versteckte Tag-Marker U+200B)
//
// Die versteckten Tags (Zero-Width-Marker) erlauben den Makros, Absätze im
// Fließtext zu identifizieren, ohne sichtbare Hilfszeichen einzufügen:
// je Kapitel eine Markierung aus U+200B + Kapitelindex (Base36) + U+200B
// am Kapitelanfang.

const VBA_NS = "urn:ai-writer-studio:ai-text-refinement";
export const AIWS_HIDDEN_TAG = "\u200B";

/** Versteckter Tag für Kapitel N (U+200B + Index Base36 + U+200B). */
export function aiwsHiddenTagFor(index: number): string {
  return `${AIWS_HIDDEN_TAG}${index.toString(36)}${AIWS_HIDDEN_TAG}`;
}

/** Custom Document Properties (docProps/custom.xml). */
export function buildAiwsCustomProperties(chapterCount: number): { name: string; value: string }[] {
  return [
    { name: "AIWS_AISuite", value: "AI Text Refinement Suites" },
    { name: "AIWS_Generator", value: "AI Writer Studio" },
    { name: "AIWS_Version", value: "3.0" },
    { name: "AIWS_ChapterCount", value: String(chapterCount) },
    { name: "AIWS_ExportedAt", value: new Date().toISOString() },
  ];
}

export function xmlEscape(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  }[c]!));
}

/**
 * Custom XML Part (customXml/item1.xml) mit Buch- und Kapitel-Metadaten.
 * VBA: ActiveDocument.CustomXMLParts.SelectNodes("/*[local-name()='aiws']").
 */
export function buildAiwsCustomXml(
  meta: { title: string; author: string; language?: string },
  chapters: { number?: number; title: string; status?: string; text?: string }[],
): string {
  const chapterNodes = chapters
    .map((c, i) => {
      const num = c.number ?? i + 1;
      const attrs = [
        `index="${num}"`,
        `title="${xmlEscape(c.title)}"`,
        `status="${xmlEscape(c.status ?? "draft")}"`,
        `hiddenTag="${xmlEscape(aiwsHiddenTagFor(num))}"`,
      ];
      const text = c.text ? xmlEscape(c.text) : "";
      return `    <chapter ${attrs.join(" ")}>${text}</chapter>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<aiws xmlns="${VBA_NS}" suite="AI Text Refinement Suites" generator="AI Writer Studio" version="3.0">
  <book title="${xmlEscape(meta.title)}" author="${xmlEscape(meta.author)}" language="${xmlEscape(meta.language ?? "de")}">
${chapterNodes}
  </book>
</aiws>`;
}
