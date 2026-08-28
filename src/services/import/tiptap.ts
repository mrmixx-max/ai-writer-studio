// TipTap-Helfer für den Import: Blöcke → TipTap-JSON (Editor-kompatibel).
// Umkehrung der toBlocks()-Logik aus src/services/export.

export type ImportBlockType = "h1" | "h2" | "h3" | "p" | "quote" | "code" | "list_item";

export interface ImportBlock {
  type: ImportBlockType;
  text: string;
  ordered?: boolean;
}

/** Erzeugt leeres TipTap-Dokument-JSON. */
export function emptyDoc(): object {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** Wandelt importierte Blöcke in TipTap-JSON-String um. */
export function blocksToTipTap(blocks: ImportBlock[]): string {
  const content: object[] = [];
  for (const b of blocks) {
    const textNode = b.text ? [{ type: "text", text: b.text }] : [];
    switch (b.type) {
      case "h1":
      case "h2":
      case "h3":
        content.push({
          type: "heading",
          attrs: { level: Number(b.type[1]) },
          content: textNode,
        });
        break;
      case "quote":
        content.push({ type: "blockquote", content: textNode });
        break;
      case "code":
        content.push({ type: "code_block", content: textNode });
        break;
      case "list_item": {
        content.push({
          type: b.ordered ? "orderedList" : "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: textNode }] }],
        });
        break;
      }
      default:
        content.push({ type: "paragraph", content: textNode });
    }
  }
  if (content.length === 0) content.push({ type: "paragraph" });
  return JSON.stringify({ type: "doc", content });
}

/** Flacher Text aus beliebigem Text (Platzhalter für spätere Inline-Formatierung). */
export function plainParagraph(text: string): ImportBlock {
  return { type: "p", text };
}
