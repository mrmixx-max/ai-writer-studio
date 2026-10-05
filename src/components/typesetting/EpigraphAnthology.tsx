// EpigraphAnthology (WP 52.2): Kapitel-Epigraph- & Motto-Studio.
//
// Epigraph-Verwaltung, Public-Domain-Wächter und Pracht-Satz-Formatierung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useMemo, useState } from "react";
import {
  createEpigraph,
  checkCopyrightStatus,
  formatEpigraph,
  type Epigraph,
} from "@/services/typesetting/epigraphAnthology";

export interface EpigraphAnthologyProps {
  className?: string;
}

export function EpigraphAnthology({ className }: EpigraphAnthologyProps) {
  const [text, setText] = useState("Die Wahrheit ist selten rein und niemals einfach.");
  const [source, setSource] = useState("1984");
  const [author, setAuthor] = useState("George Orwell");
  const [kind, setKind] = useState<"historical" | "fictional">("historical");
  const [chapter, setChapter] = useState(1);
  const [fleuron, setFleuron] = useState(true);

  const epigraph: Epigraph = useMemo(
    () =>
      createEpigraph(text, source, {
        kind,
        chapter,
        fleuron,
      }),
    [text, source, kind, chapter, fleuron],
  );

  const copyright = useMemo(() => checkCopyrightStatus(author), [author]);
  const formatted = useMemo(() => formatEpigraph(epigraph), [epigraph]);

  return (
    <div
      className={className}
      data-testid="epigraph-anthology"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📜 Epigraph-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {epigraph.kind === "historical" ? "Historisch" : "Fiktiv"} · Kapitel {epigraph.chapter}
      </div>

      {/* Eingaben */}
      <div style={{ display: "grid", gap: 8, marginBottom: 14, maxWidth: 520 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Zitat
          <textarea
            data-testid="epigraph-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            style={{
              display: "block",
              width: "100%",
              marginTop: 3,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 12,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>
            Quelle
            <input
              data-testid="epigraph-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>
            Autor
            <input
              data-testid="epigraph-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 3,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "5px 7px",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}>
            <input
              data-testid="epigraph-kind-historical"
              type="radio"
              checked={kind === "historical"}
              onChange={() => setKind("historical")}
            />
            Historisch
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}>
            <input
              data-testid="epigraph-kind-fictional"
              type="radio"
              checked={kind === "fictional"}
              onChange={() => setKind("fictional")}
            />
            Fiktiv
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 4, alignItems: "center" }}>
            <input
              data-testid="epigraph-fleuron"
              type="checkbox"
              checked={fleuron}
              onChange={(e) => setFleuron(e.target.checked)}
            />
            Fleuron
          </label>
        </div>

        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Kapitel
          <input
            data-testid="epigraph-chapter"
            type="number"
            min={1}
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value) || 1)}
            style={{
              width: 60,
              marginLeft: 5,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
      </div>

      {/* Copyright-Status */}
      <div
        data-testid="epigraph-copyright"
        style={{
          border: `1px solid ${copyright.status === "public-domain" ? "var(--success)" : copyright.status === "copyrighted" ? "var(--error)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <strong style={{ color: copyright.status === "public-domain" ? "var(--success)" : copyright.status === "copyrighted" ? "var(--error)" : "var(--warn)" }}>
          {copyright.status}
        </strong>
        <span style={{ color: "var(--muted)", marginLeft: 8 }}>{copyright.message}</span>
      </div>

      {/* Formatierte Vorschau */}
      <div data-testid="epigraph-preview" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>PRACHT-SATZ</div>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 16,
            textAlign: "center",
            fontSize: 14,
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {fleuron && <div style={{ fontSize: 18, marginBottom: 8, color: "var(--accent)" }}>❦</div>}
          <div style={{ fontFamily: "var(--font-serif, serif)" }}>{formatted}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, fontStyle: "normal" }}>
            — {author}, {source}
          </div>
          {fleuron && <div style={{ fontSize: 18, marginTop: 8, color: "var(--accent)" }}>❦</div>}
        </div>
      </div>
    </div>
  );
}
