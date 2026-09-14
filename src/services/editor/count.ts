// Hilfsfunktionen für den Editor: TipTap-JSON → reiner Text → Zählung.

interface TipTapNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

function isNode(v: unknown): v is TipTapNode {
  return typeof v === "object" && v !== null;
}

/** Extrahiert allen Text aus einem TipTap-Dokument (JSON-Objekt oder String). */
export function tiptapToText(doc: unknown): string {
  let parsed: unknown = doc;
  if (typeof doc === "string") {
    try {
      parsed = JSON.parse(doc);
    } catch {
      return doc; // kein JSON → als Plaintext behandeln
    }
  }
  if (!isNode(parsed) || !("content" in parsed)) return "";
  const parts: string[] = [];
  walk(parsed, parts);
  return parts.join("\n");
}

function walk(node: unknown, out: string[]): void {
  if (!isNode(node)) return;
  if (node.type === "text" && typeof node.text === "string") {
    out.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, out);
  }
  // Absatzumbruch nach Block-Elementen
  if (["paragraph", "heading", "blockquote", "listItem"].includes(node.type as string)) {
    out.push("");
  }
}

/** Zählt Wörter (Unicode-aware, deutsche Umlaute korrekt). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // \b ist nicht unicode-safe; nutze Unicode-Property-Escape
  const matches = trimmed.match(/[\p{L}\p{N}'’]+/gu);
  return matches ? matches.length : 0;
}

export function countChars(text: string): number {
  return text.length;
}
