// MarkdownViewerPanel: Markdown anzeigen, bearbeiten und als Datei speichern.
import { useState, useCallback, useEffect, useRef } from "react";

export function MarkdownViewerPanel() {
  const [markdown, setMarkdown] = useState<string>(localStorage.getItem("md-viewer-content") || "# Willkommen\n\nSchreibe hier dein Markdown...");
  const [mode, setMode] = useState<"preview" | "edit" | "split">("split");
  const [fileName, setFileName] = useState("dokument.md");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("md-viewer-content", markdown);
    }, 1000);
    return () => clearTimeout(timer);
  }, [markdown]);

  const handleSaveFile = useCallback(async () => {
    try {
      // Nutze Tauri FS falls verfügbar, sonst Blob-Download
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: anzeigen
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;padding:20px">${markdown.replace(/</g, "&lt;")}</pre>`);
      }
    }
  }, [markdown, fileName]);

  const renderPreview = () => (
    <div
      className="md-preview"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
    />
  );

  return (
    <div className="md-viewer-panel">
      <div className="md-toolbar">
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="md-filename"
          placeholder="datei.md"
        />
        <div className="md-modes">
          <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>✏️ Edit</button>
          <button className={mode === "split" ? "active" : ""} onClick={() => setMode("split")}>👁️ Split</button>
          <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>📖 Vorschau</button>
        </div>
        <button onClick={handleSaveFile} className="md-save">💾 Speichern</button>
      </div>

      {mode === "edit" && (
        <textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="md-editor"
          spellCheck={false}
        />
      )}

      {mode === "preview" && renderPreview()}

      {mode === "split" && (
        <div className="md-split">
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="md-editor-split"
            spellCheck={false}
          />
          <div className="md-preview-split">
            {renderPreview()}
          </div>
        </div>
      )}
    </div>
  );
}

// Einfache Markdown→HTML Konvertierung
function markdownToHtml(md: string): string {
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
    } else if (trimmed.startsWith("```")) {
      const code = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      html.push(`<pre><code>${esc(code)}</code></pre>`);
    } else {
      html.push(`<p>${inlineFmt(trimmed.replace(/\n+/g, " "))}</p>`);
    }
  }
  return html.join("\n");
}

function inlineFmt(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
