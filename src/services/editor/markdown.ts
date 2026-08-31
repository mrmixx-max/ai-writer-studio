// Markdown → HTML Konvertierung für den Editor.
export function markdownToHtml(md: string): string {
  // Normalize: \n\n → Paragraph break, single \n → space (unless special)
  const blocks = md.split(/\n\s*\n/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Überschriften
    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${inlineFormat(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2>${inlineFormat(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      html.push(`<h1>${inlineFormat(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("---")) {
      html.push("<hr/>");
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote><p>${inlineFormat(trimmed.slice(2))}</p></blockquote>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split("\n").map((l) => `<li>${inlineFormat(l.replace(/^[-*]\s/, ""))}</li>`);
      html.push(`<ul>${items.join("")}</ul>`);
    } else {
      // Absatz (ersetze Zeilenumbrüche durch Leerzeichen)
      html.push(`<p>${inlineFormat(trimmed.replace(/\n+/g, " "))}</p>`);
    }
  }
  return html.join("\n");
}

function inlineFormat(text: string): string {
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
