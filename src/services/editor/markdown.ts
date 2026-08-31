// Markdown → HTML Konvertierung für den Editor.
import type { JSONContent } from "@tiptap/react";

export function markdownToHtml(md: string): string {
  const blocks = md.split(/\n\s*\n/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${inlineFmt(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2>${inlineFmt(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      html.push(`<h1>${inlineFmt(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("---")) {
      html.push("<hr/>");
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote><p>${inlineFmt(trimmed.slice(2))}</p></blockquote>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split("\n").map((l) => `<li>${inlineFmt(l.replace(/^[-*]\s/, ""))}</li>`);
      html.push(`<ul>${items.join("")}</ul>`);
    } else {
      html.push(`<p>${inlineFmt(trimmed.replace(/\n+/g, " "))}</p>`);
    }
  }
  return html.join("\n");
}

/** Markdown → TipTap JSON (für createChapter). */
export function markdownToTipTap(md: string): string {
  const blocks = md.split(/\n\s*\n/);
  const content: JSONContent[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ")) {
      content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: trimmed.slice(4) }] });
    } else if (trimmed.startsWith("## ")) {
      content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: trimmed.slice(3) }] });
    } else if (trimmed.startsWith("# ")) {
      content.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: trimmed.slice(2) }] });
    } else if (trimmed.startsWith("---")) {
      content.push({ type: "horizontalRule" });
    } else if (trimmed.startsWith("> ")) {
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: trimmed.slice(2) }] }] });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split("\n").map((l) => ({
        type: "listItem" as const,
        content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: l.replace(/^[-*]\s/, "") }] }],
      }));
      content.push({ type: "bulletList", content: items });
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text: trimmed.replace(/\n+/g, " ") }] });
    }
  }

  return JSON.stringify({ type: "doc", content });
}

function inlineFmt(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
