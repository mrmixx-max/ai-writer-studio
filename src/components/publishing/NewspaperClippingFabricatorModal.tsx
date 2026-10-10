// NewspaperClippingFabricatorModal (Meilenstein 62.0 / v7.4.0)
//
// UI für das Vintage-Zeitungsausschnitt-Studio: mehrspaltiger Zeitungssatz,
// Vintage-Druck-Artefakte (Rasterpunkte, Knicke, Risskanten) und
// druckfertiger PDF-Export. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  NEWSPAPER_MASTHEADS,
  buildNewspaperClipping,
  applyVintageArtifacts,
  generateHalftoneDots,
  exportClippingPdf,
  createSampleClipping,
} from "@/services/publishing/newspaperClippingFabricator";

export interface NewspaperClippingFabricatorModalProps {
  className?: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

const SAMPLE_BODY =
  "In den frühen Morgenstunden des gestrigen Tages ereignete sich am Hafen " +
  "ein Vorfall, der die Stadt seitdem in Atem hält. Zeugen berichten von " +
  "einem Mann in dunklem Mantel, der ohne ein Wort zu sprechen verschwand. " +
  "Die Ermittlungen dauern an, weitere Einzelheiten wurden nicht bekannt.";

export function NewspaperClippingFabricatorModal({
  className,
}: NewspaperClippingFabricatorModalProps) {
  const sample = useMemo(() => createSampleClipping(), []);

  const [seed, setSeed] = useState(42);
  const [headline, setHeadline] = useState("DER FALL AM HAFEN");
  const [subheadline, setSubheadline] = useState("Zeugen schweigen, Ermittler ratlos");
  const [body, setBody] = useState(SAMPLE_BODY);
  const [mastheadId, setMastheadId] = useState(NEWSPAPER_MASTHEADS[0].id);
  const [date, setDate] = useState("14. Oktober 1928");

  const input = useMemo(
    () => ({ headline, subheadline, body, mastheadId, date }),
    [headline, subheadline, body, mastheadId, date],
  );

  const clipping = useMemo(() => buildNewspaperClipping(input, seed), [input, seed]);
  const artifacts = useMemo(() => applyVintageArtifacts(seed), [seed]);
  const halftone = useMemo(() => generateHalftoneDots(120, 90, seed), [seed]);
  const pdf = useMemo(() => exportClippingPdf(input, seed), [input, seed]);

  return (
    <div
      data-testid="newspaper-clipping-modal"
      className={className}
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
      <h2 style={{ margin: "0 0 4px" }}>📰 Vintage-Zeitungsausschnitt-Studio</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
        Beispiel: {sample.masthead} · {sample.columnCount} Spalten
      </p>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Zeitung{" "}
          <select
            value={mastheadId}
            onChange={(e) => setMastheadId(e.target.value)}
            style={inputStyle}
          >
            {NEWSPAPER_MASTHEADS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.typeface})
              </option>
            ))}
          </select>
        </label>
        <label>
          Datum{" "}
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Schlagzeile{" "}
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            Unterzeile{" "}
            <input
              type="text"
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
          <label style={{ display: "block" }}>
            Fließtext{" "}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              style={{ ...inputStyle, width: "100%" }}
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>ZEITUNGSSATZ</h3>
        <p style={{ margin: "0 0 6px" }}>
          <strong>{clipping.masthead}</strong> — {clipping.date} · {clipping.columnCount} Spalten
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {clipping.columns.map((col, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                border: "1px solid var(--border)",
                padding: 6,
                color: "var(--muted)",
                textAlign: "justify",
                fontSize: 10,
              }}
            >
              {col.map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>VINTAGE-ARTEFAKTE</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Rasterpunkt-Dithering: {artifacts.dithering ? "aktiv" : "inaktiv"}</li>
          <li>Farbausbleichung: {artifacts.fadeAmount.toFixed(2)}</li>
          <li>Knicke: {artifacts.creaseCount}</li>
          <li>Gerissene Kanten: {artifacts.tornEdges ? "ja" : "nein"}</li>
          <li>Rasterpunkte: {halftone.count}</li>
        </ul>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{artifacts.description}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>PDF-EXPORT</h3>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          {pdf.width} × {pdf.height} mm · {pdf.dpi} dpi ·{" "}
          {pdf.printReady ? "druckfertig" : "nicht druckfertig"}
        </p>
      </section>
    </div>
  );
}
