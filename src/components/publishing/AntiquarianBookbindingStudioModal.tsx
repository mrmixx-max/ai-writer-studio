// AntiquarianBookbindingStudioModal (WP 117.2 UI, Meilenstein 56.0 / v6.8.0)
import { useState, useMemo } from "react";
import {
  MARBLE_PATTERNS,
  getMarblePattern,
  generateMarbledPaper,
  generateSpineMockup,
  buildPrintExport,
} from "@/services/publishing/antiquarianBookbindingStudio";

export interface AntiquarianBookbindingStudioModalProps {
  className?: string;
}

export function AntiquarianBookbindingStudioModal({ className }: AntiquarianBookbindingStudioModalProps) {
  const [patternId, setPatternId] = useState<string>(MARBLE_PATTERNS[0].id);
  const [seed, setSeed] = useState(42);
  const [title, setTitle] = useState("Der Schatten über Innsmouth");
  const [author, setAuthor] = useState("H. P. Lovecraft");
  const [bands, setBands] = useState(5);

  const pattern = useMemo(() => getMarblePattern(patternId) ?? MARBLE_PATTERNS[0], [patternId]);

  const marbledPaper = useMemo(
    () => generateMarbledPaper(pattern.id, 300, 400, seed),
    [pattern.id, seed]
  );

  const spine = useMemo(
    () => generateSpineMockup(title, author, bands),
    [title, author, bands]
  );

  const printExport = useMemo(
    () => buildPrintExport(marbledPaper, spine),
    [marbledPaper, spine]
  );

  const fieldStyle = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
  } as const;

  const labelStyle = { fontSize: 11, color: "var(--muted)" } as const;

  const sectionStyle = {
    marginTop: 8,
    padding: 8,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
  } as const;

  const summaryStyle = {
    fontSize: 11,
    color: "var(--accent)",
    cursor: "pointer",
    fontWeight: 700,
  } as const;

  return (
    <div
      className={className}
      data-testid="antiquarian-bookbinding-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📚 Antiquarisches Marmorpapier- &amp; Bünde-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {pattern.name} · {marbledPaper.width}×{marbledPaper.height} px · {marbledPaper.dpi} DPI · {spine.bands} Bünde
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...labelStyle, flex: 1, minWidth: 180 }}>
          Marmormuster
          <select
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            style={fieldStyle}
          >
            {MARBLE_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={fieldStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
          Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 140 }}>
          Autor
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label style={{ ...labelStyle, minWidth: 80 }}>
          Bünde
          <input
            type="number"
            min={1}
            max={9}
            value={bands}
            onChange={(e) => setBands(Math.max(1, Math.min(9, Number(e.target.value) || 1)))}
            style={fieldStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>🎨 MARMORPAPIER</summary>
        <div style={{ ...sectionStyle, border: "2px solid var(--accent)", overflow: "auto" }}>
          <div
            style={{ maxWidth: "100%" }}
            dangerouslySetInnerHTML={{ __html: marbledPaper.svg }}
          />
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            {marbledPaper.description}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>📖 BUCHRÜCKEN-MOCKUP</summary>
        <div style={{ ...sectionStyle, overflow: "auto" }}>
          <div
            style={{ display: "flex", justifyContent: "center" }}
            dangerouslySetInnerHTML={{ __html: spine.svg }}
          />
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            {spine.description}
          </div>
        </div>
      </details>

      <details open>
        <summary style={summaryStyle}>🖨️ DRUCK-EXPORT</summary>
        <div style={{ ...sectionStyle, fontSize: 11, lineHeight: 1.7 }}>
          <div>
            <strong>Format:</strong> {printExport.format.toUpperCase()} · {printExport.dpi} DPI
          </div>
          <div>
            <strong>Größe:</strong> {printExport.width} × {printExport.height} px
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>Druckhinweise:</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}>
            {printExport.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
