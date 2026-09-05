// OPML-Export für Scrivener 3 (Sprint 3, Agent 3).
//
// Scrivener importiert OPML 2.0-Outlines verlustfrei: Wurzel-Outline = Buch,
// Kinder = Kapitel. Kapitel-Metadaten (Nummer, Status) wandern in
// Unterstrich-Attribute, die Scrivener als Synopsis-Metadaten übernimmt bzw.
// die ein Skript wieder auslesen kann. Titelfeld ist `text` (OPML-Pflicht),
// die Roh-Titel zusätzlich in `_title` (ohne "Kapitel N:"-Präfix).

import { xmlEscape } from "./vba";
import type { BookChapterInput } from "./types";

/** Buch-Outline als OPML 2.0 (Scrivener-kompatibel, UTF-8). */
export function buildBookOpml(
  meta: { title: string; author?: string },
  chapters: BookChapterInput[],
): string {
  const chapterLines = chapters
    .map((c, i) => {
      const num = c.number ?? i + 1;
      const attrs = [
        `text=${q(`Kapitel ${num}: ${c.title}`)}`,
        `_title=${q(c.title)}`,
        `_chapterNumber=${q(String(num))}`,
      ];
      if (c.status) attrs.push(`_status=${q(c.status)}`);
      return `    <outline ${attrs.join(" ")}/>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${xmlEscape(meta.title)}</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
${meta.author ? `    <ownerName>${xmlEscape(meta.author)}</ownerName>\n` : ""}  </head>
  <body>
    <outline text=${q(meta.title)}>
${chapterLines}
    </outline>
  </body>
</opml>`;
}

function q(s: string): string {
  return `"${xmlEscape(s)}"`;
}
