// AdvancedExportPanel (Sprint 23, Agent 6): Buch-Konfiguration + Sektionen mit
// Reorder (Drag & Drop + Pfeile) + Struktur-Vorschau + Generierung mit Timer,
// Abbrechen und Download. Bloomberg-Terminal-Stil.
import { useMemo, useRef, useState } from "react";
import {
  defaultBookConfig,
  estimatePageCount,
  generateBook,
  SECTION_LABELS,
  type BookConfig,
  type BookSection,
  type BookSectionType,
} from "@/services/export/advancedExport";

const SECTION_TYPES: BookSectionType[] = [
  "title-page",
  "dedication",
  "toc",
  "chapter",
  "appendix",
  "acknowledgments",
  "about-author",
  "colophon",
];

const TERMINAL: React.CSSProperties = {
  background: "#0b0e11",
  color: "#d7dce2",
  border: "1px solid #232a33",
  borderRadius: 6,
  padding: 12,
  fontFamily: "ui-monospace, Consolas, monospace",
  fontSize: 13,
};

export function AdvancedExportPanel() {
  const [config, setConfig] = useState<BookConfig>(() => ({
    ...defaultBookConfig(),
    title: "Mein Buch",
    author: "Unbekannt",
  }));
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  const pages = useMemo(() => estimatePageCount(config), [config]);

  const set = <K extends keyof BookConfig>(key: K, value: BookConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const moveSection = (index: number, dir: -1 | 1) => {
    setConfig((c) => {
      const next = [...c.sections];
      const j = index + dir;
      if (j < 0 || j >= next.length) return c;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...c, sections: next };
    });
  };

  const dropSection = (from: number, to: number) => {
    if (from === to) return;
    setConfig((c) => {
      const next = [...c.sections];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...c, sections: next };
    });
  };

  const updateSection = (index: number, patch: Partial<BookSection>) =>
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));

  const removeSection = (index: number) =>
    setConfig((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== index) }));

  const addSection = (type: BookSectionType) =>
    setConfig((c) => ({
      ...c,
      sections: [
        ...c.sections,
        { type, title: SECTION_LABELS[type], content: "", pageBreak: true },
      ],
    }));

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setDownloadUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    cancelRef.current = false;
    const start = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      250
    );
    try {
      // Kurze künstliche Staffelung, damit Timer + Abbrechen sichtbar bleiben.
      await new Promise((r) => setTimeout(r, 300));
      if (cancelRef.current) return;
      const blob = await generateBook(config);
      if (cancelRef.current) return;
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generierung fehlgeschlagen.");
    } finally {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      setGenerating(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setGenerating(false);
  };

  const ext = config.format === "epub" ? "md" : config.format;

  return (
    <div style={TERMINAL} data-testid="advanced-export-panel">
      <div style={{ color: "#ffb000", fontWeight: 700, marginBottom: 8 }}>
        📖 BUCH EXPORT <span style={{ color: "#5b6470" }}>— ca. {pages} Seiten</span>
        {generating && <span> — ⏱ {elapsed}s</span>}
      </div>

      <fieldset style={{ border: "1px solid #232a33", padding: 8, marginBottom: 8 }}>
        <legend style={{ color: "#ffb000" }}>Konfiguration</legend>
        <label>
          Titel{" "}
          <input
            aria-label="Buchtitel"
            value={config.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>{" "}
        <label>
          Untertitel{" "}
          <input
            aria-label="Untertitel"
            value={config.subtitle ?? ""}
            onChange={(e) => set("subtitle", e.target.value)}
          />
        </label>{" "}
        <label>
          Autor{" "}
          <input
            aria-label="Autor"
            value={config.author}
            onChange={(e) => set("author", e.target.value)}
          />
        </label>{" "}
        <label>
          ISBN{" "}
          <input
            aria-label="ISBN"
            value={config.isbn ?? ""}
            onChange={(e) => set("isbn", e.target.value)}
          />
        </label>
        <div style={{ marginTop: 6 }}>
          <label>
            Format{" "}
            <select
              aria-label="Format"
              value={config.format}
              onChange={(e) => set("format", e.target.value as BookConfig["format"])}
            >
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="epub">EPUB</option>
            </select>
          </label>{" "}
          <label>
            <input
              type="checkbox"
              checked={config.includeTOC}
              onChange={(e) => set("includeTOC", e.target.checked)}
            />{" "}
            Inhaltsverzeichnis
          </label>{" "}
          <label>
            <input
              type="checkbox"
              checked={config.includePageNumbers}
              onChange={(e) => set("includePageNumbers", e.target.checked)}
            />{" "}
            Seitenzahlen
          </label>
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label>
            Widmung{" "}
            <input
              aria-label="Widmung"
              value={config.dedication ?? ""}
              onChange={(e) => set("dedication", e.target.value)}
            />
          </label>
          <label>
            Über den Autor{" "}
            <input
              aria-label="Über den Autor"
              value={config.aboutAuthor ?? ""}
              onChange={(e) => set("aboutAuthor", e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#ffb000", marginBottom: 4 }}>
          SEKTIONEN ({config.sections.length})
        </div>
        <ul aria-label="Sektionen-Liste" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {config.sections.map((s, i) => (
            <li
              key={`${s.type}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) dropSection(dragIndex, i);
                setDragIndex(null);
              }}
              style={{
                border: "1px solid #232a33",
                padding: 4,
                marginBottom: 4,
                background: dragIndex === i ? "#1a2230" : "transparent",
              }}
            >
              <span style={{ color: "#ffb000" }}>{i + 1}.</span> [{SECTION_LABELS[s.type]}]{" "}
              <input
                aria-label={`Sektionstitel ${i + 1}`}
                value={s.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
                style={{ width: 160 }}
              />{" "}
              <button aria-label={`Sektion ${i + 1} nach oben`} onClick={() => moveSection(i, -1)}>
                ↑
              </button>{" "}
              <button aria-label={`Sektion ${i + 1} nach unten`} onClick={() => moveSection(i, 1)}>
                ↓
              </button>{" "}
              <button aria-label={`Sektion ${i + 1} entfernen`} onClick={() => removeSection(i)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 4 }}>
          <select aria-label="Neue Sektion" id="ae-add-type" defaultValue="chapter">
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_LABELS[t]}
              </option>
            ))}
          </select>{" "}
          <button
            onClick={() => {
              const el = document.getElementById("ae-add-type") as HTMLSelectElement | null;
              addSection((el?.value as BookSectionType) ?? "chapter");
            }}
          >
            + Sektion
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#ffb000", marginBottom: 4 }}>VORSCHAU</div>
        <ol data-testid="advanced-export-preview" style={{ margin: 0, paddingLeft: 20 }}>
          {config.sections.map((s, i) => (
            <li key={`p-${i}`}>
              {SECTION_LABELS[s.type]}: {s.title || "—"}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <div role="alert" style={{ color: "#ff5555", marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: "#ffb000",
            color: "#000",
            fontWeight: 700,
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            cursor: generating ? "wait" : "pointer",
          }}
        >
          {generating ? `⏱ Generiere… (${elapsed}s)` : "Generieren"}
        </button>
        {generating && <button onClick={handleCancel}>Abbrechen</button>}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`${config.title || "buch"}.${ext}`}
            style={{ color: "#ffb000", alignSelf: "center" }}
          >
            ⬇ Download
          </a>
        )}
      </div>
    </div>
  );
}
