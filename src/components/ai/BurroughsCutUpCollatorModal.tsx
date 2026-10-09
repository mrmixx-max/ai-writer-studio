// BurroughsCutUpCollatorModal (WP 125.2 UI, Meilenstein 60.0 / v7.2.0)
import { useMemo, useState } from "react";
import {
  CUT_PATTERNS,
  cutUpText,
  polishCutUp,
  buildCollage,
  createSampleCutPattern,
  createSampleCollage,
} from "@/services/ai/burroughsCutUpCollator";

export interface BurroughsCutUpCollatorModalProps {
  className?: string;
}

const SAMPLE_SOURCE =
  "Der Traum öffnet seine Augen über der Stadt und die Uhr im Nebel " +
  "schlägt dreizehnmal gegen das Fenster während die Vögel schweigen.";

const SAMPLE_FOREIGN =
  "Ein Spiegel zerbricht in der Hand des Fremden und der Schatten " +
  "liest eine Nachricht die niemand geschrieben hat im Sturm.";

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontFamily: "var(--font-mono)",
};

const summaryStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 700,
};

const preStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre-wrap",
  background: "var(--panel)",
  lineHeight: 1.7,
};

export function BurroughsCutUpCollatorModal({ className }: BurroughsCutUpCollatorModalProps) {
  const [patternId, setPatternId] = useState<string>(CUT_PATTERNS[0].id);
  const [seed, setSeed] = useState(1252);
  const [sourceText, setSourceText] = useState(SAMPLE_SOURCE);
  const [foreignText, setForeignText] = useState(SAMPLE_FOREIGN);

  const cut = useMemo(
    () => cutUpText(sourceText, foreignText, patternId, seed),
    [sourceText, foreignText, patternId, seed]
  );

  const polish = useMemo(() => polishCutUp(cut.segments, seed), [cut.segments, seed]);

  const collage = useMemo(
    () => buildCollage(sourceText, foreignText, patternId, seed),
    [sourceText, foreignText, patternId, seed]
  );

  const activePattern = CUT_PATTERNS.find((p) => p.id === patternId) ?? CUT_PATTERNS[0];

  function loadSample() {
    const pattern = createSampleCutPattern();
    const sample = createSampleCollage();
    setPatternId(pattern.id);
    setSourceText(SAMPLE_SOURCE);
    setForeignText(SAMPLE_FOREIGN);
    setSeed(1252);
    void sample;
  }

  return (
    <div
      className={className}
      data-testid="burroughs-cutup-modal"
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
        ✂️ Burroughs Cut-Up-Montage &amp; Kollagen-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Muster {activePattern.name} · Seed {seed} · {cut.segments.length} Segmente ·
        Glätte {polish.smoothness}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Schnittmuster
          <select
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            style={inputStyle}
          >
            {CUT_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>🧵 QUELLEN</summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
            Eigenquelle
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
            Fremdquelle
            <textarea
              value={foreignText}
              onChange={(e) => setForeignText(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </label>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>✂️ SCHNITT ({cut.segments.length} Segmente)</summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {cut.segments.map((seg, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--accent)", fontSize: 10, marginRight: 6 }}>
                #{i + 1}
              </span>
              {seg}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
          Eigenquelle {cut.sourceLength} Zeichen · Fremdquelle {cut.foreignLength} Zeichen
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>🪄 POLITUR</summary>
        <pre style={preStyle}>{polish.text || "(leer)"}</pre>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
          Glätte {polish.smoothness}% · {polish.breathless ? "atemlos" : "atmend"}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={summaryStyle}>🎨 KOLLAGE</summary>
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>{collage.title}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            {collage.segments.length} Segmente · Glätte {collage.smoothness}%
          </div>
        </div>
        <pre style={preStyle}>{collage.polishedText || "(leer)"}</pre>
        <div
          style={{
            marginTop: 8,
            border: "1px solid var(--border)",
            borderRadius: 4,
            overflow: "hidden",
            background: "var(--panel)",
          }}
          dangerouslySetInnerHTML={{ __html: collage.coverSvg }}
        />
      </details>

      <details>
        <summary style={summaryStyle}>🎲 BEISPIEL LADEN</summary>
        <button
          onClick={loadSample}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          Beispiel: 4-Quadranten-Collage laden
        </button>
      </details>
    </div>
  );
}

export default BurroughsCutUpCollatorModal;
