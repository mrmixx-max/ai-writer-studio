// ImporterPanel (Sprint 22, Agent 1): Drag-and-Drop-Import von
// DOCX/EPUB/PDF/TXT mit Kapitel-Split und Projekt-Erstellung.
// Bloomberg-Terminal-Stil (bg #000, accent #ffa028, border #333, monospace).
import { useRef, useState } from "react";
import {
  importFromFile,
  DEFAULT_CHAPTER_PATTERN,
  ImportError,
  type ImportOptions,
  type ImportResult,
} from "@/services/importer/importer";
import { createProject, createChapter } from "@/services/project";

export interface ImporterPanelProps {
  onProjectCreated?: (projectId: string) => void;
}

const ACCEPT = ".docx,.epub,.pdf,.txt,.md";

const panelStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 4,
  padding: 16,
  fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
};

const accent = "#ffa028";

export function ImporterPanel({ onProjectCreated }: ImporterPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [format, setFormat] = useState("auto");
  const [splitChapters, setSplitChapters] = useState(true);
  const [chapterPattern, setChapterPattern] = useState(DEFAULT_CHAPTER_PATTERN);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const options: ImportOptions = {
    splitChapters,
    chapterPattern: chapterPattern.trim() || DEFAULT_CHAPTER_PATTERN,
    language: "auto",
  };

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError(null);
    setStatus(null);
    setResult(null);
    setCreatedId(null);
    setProgress(10);
    setStatus(`Lese ${file.name} …`);
    try {
      // Kleiner Fortschritts-Takt während des Parsens (Parser melden keinen Fortschritt).
      const tick = window.setInterval(() => {
        setProgress((p) => (p === null || p >= 90 ? p : (p ?? 0) + 15));
      }, 120);
      try {
        const res = await importFromFile(file, options);
        setResult(res);
        setStatus(`${res.wordCount} Wörter, ${res.chapters.length} Kapitel erkannt.`);
      } finally {
        window.clearInterval(tick);
      }
      setProgress(100);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `Import fehlgeschlagen: ${String(e)}`);
      setProgress(null);
    }
  }

  async function handleCreateProject() {
    if (!result || creating) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(result.title);
      for (const ch of result.chapters) {
        await createChapter(project.id, ch.title, ch.content || " ", undefined, "draft");
      }
      setCreatedId(project.id);
      setStatus(`Projekt „${result.title}“ mit ${result.chapters.length} Kapiteln erstellt.`);
      onProjectCreated?.(project.id);
    } catch (e) {
      setError(`Projekt konnte nicht erstellt werden: ${String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="importer-panel" style={panelStyle} data-testid="importer-panel">
      <h3 style={{ color: accent, margin: "0 0 12px", fontSize: 14 }}>📥 Dokument importieren</h3>

      {/* Drag-and-Drop-Zone */}
      <div
        data-testid="importer-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-label="Datei hierher ziehen oder klicken zum Auswählen"
        style={{
          border: `2px dashed ${dragOver ? accent : "#333"}`,
          borderRadius: 4,
          padding: "28px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "#1a1206" : "#0a0a0a",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>📥</div>
        <div>Datei hierher ziehen oder klicken zum Auswählen</div>
        <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>DOCX · EPUB · PDF · TXT</div>
      </div>
      <input
        ref={fileInput}
        data-testid="importer-file-input"
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Datei-Picker + Format-Auswahl */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          style={{
            background: accent,
            color: "#000",
            border: "none",
            borderRadius: 3,
            padding: "8px 14px",
            fontFamily: "inherit",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          📁 Datei wählen
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa" }}>
          Format
          <select
            data-testid="importer-format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={{ background: "#0a0a0a", color: "#e8e8e8", border: "1px solid #333", borderRadius: 3, padding: "7px 8px", fontFamily: "inherit" }}
          >
            <option value="auto">Auto</option>
            <option value="docx">DOCX</option>
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
            <option value="txt">TXT</option>
          </select>
        </label>
      </div>

      {/* Kapitel-Split */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
        <input
          data-testid="importer-split-toggle"
          type="checkbox"
          checked={splitChapters}
          onChange={(e) => setSplitChapters(e.target.checked)}
        />
        Kapitel automatisch trennen
      </label>
      {splitChapters && (
        <label style={{ display: "block", marginBottom: 12, color: "#aaa" }}>
          Kapitel-Pattern (Regex)
          <input
            data-testid="importer-pattern-input"
            type="text"
            value={chapterPattern}
            onChange={(e) => setChapterPattern(e.target.value)}
            placeholder={DEFAULT_CHAPTER_PATTERN}
            spellCheck={false}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              background: "#0a0a0a",
              color: "#e8e8e8",
              border: "1px solid #333",
              borderRadius: 3,
              padding: "8px 10px",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </label>
      )}

      {/* Fortschritt */}
      {progress !== null && (
        <div data-testid="importer-progress" style={{ marginBottom: 12 }}>
          <div style={{ height: 8, background: "#1a1a1a", border: "1px solid #333", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, progress)}%`, background: accent, transition: "width 0.15s" }} />
          </div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{progress}%</div>
        </div>
      )}
      {status && <div style={{ color: accent, marginBottom: 8 }}>{status}</div>}
      {error && (
        <div data-testid="importer-error" role="alert" style={{ color: "#ff5c5c", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Vorschau + Erstellen */}
      {result && (
        <div style={{ marginTop: 4 }}>
          <div style={{ color: "#aaa", marginBottom: 4 }}>
            Vorschau: <strong style={{ color: "#e8e8e8" }}>{result.title}</strong> ({result.wordCount} Wörter)
          </div>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, color: "#aaa" }}>
            {result.chapters.slice(0, 10).map((c, i) => (
              <li key={i}>
                <span style={{ color: "#e8e8e8" }}>{c.title}</span>
                <span style={{ color: "#666" }}> — {c.content.split(/\s+/).filter(Boolean).length} Wörter</span>
              </li>
            ))}
            {result.chapters.length > 10 && <li>… {result.chapters.length - 10} weitere</li>}
          </ul>
          <pre
            data-testid="importer-preview"
            style={{
              maxHeight: 180,
              overflow: "auto",
              background: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: 3,
              padding: 10,
              whiteSpace: "pre-wrap",
              color: "#ccc",
              margin: "0 0 12px",
            }}
          >
            {result.content.slice(0, 2000)}
          </pre>
          <button
            type="button"
            data-testid="importer-create-button"
            onClick={() => void handleCreateProject()}
            disabled={creating || createdId !== null}
            style={{
              background: createdId ? "#1a3a1a" : accent,
              color: createdId ? "#8f8" : "#000",
              border: "none",
              borderRadius: 3,
              padding: "10px 16px",
              fontFamily: "inherit",
              fontWeight: 700,
              cursor: creating || createdId ? "default" : "pointer",
              opacity: creating ? 0.6 : 1,
            }}
          >
            {createdId ? "✓ Projekt erstellt" : creating ? "Erstelle Projekt…" : "📚 Als Projekt erstellen"}
          </button>
        </div>
      )}
    </div>
  );
}
