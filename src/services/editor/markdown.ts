// Markdown → HTML Konvertierung für den Editor.
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inParagraph = false;

  for (const line of lines) {
    // Überschriften
    if (line.startsWith("### ")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.trim() === "") {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
    } else if (line.startsWith("---")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push("<hr/>");
    } else if (line.startsWith("> ")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push(`<blockquote><p>${escapeHtml(line.slice(2))}</p></blockquote>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (inParagraph) { html.push("</p>"); inParagraph = false; }
      html.push(`<ul><li>${escapeHtml(line.slice(2))}</li></ul>`);
    } else {
      // Absatz
      if (!inParagraph) { html.push("<p>"); inParagraph = true; }
      html.push(escapeHtml(line) + " ");
    }
  }
  if (inParagraph) html.push("</p>");
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
