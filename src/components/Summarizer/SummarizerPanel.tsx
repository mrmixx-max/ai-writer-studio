// SummarizerPanel (Sprint 25, Agent 3): Zusammenfassung mit Länge-Stufen,
// Fokus-Eingabe, Kernpunkte, Vorher/Nachher-Vergleich.
// Bloomberg-Terminal-Stil (Inline-Styles, keine neuen Dependencies).
import { useState, useCallback } from "react";
import {
  summarize,
  getKeyPoints,
  type SummaryLength,
  type SummaryStyle,
  type SummaryResult,
} from "@/services/summarizer/summarizer";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";

const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

const LENGTHS: { id: SummaryLength; label: string }[] = [
  { id: "short", label: "KURZ" },
  { id: "medium", label: "MITTEL" },
  { id: "long", label: "LANG" },
];

const STYLES: { id: SummaryStyle; label: string }[] = [
  { id: "paragraph", label: "TEXT" },
  { id: "bullet", label: "LISTE" },
  { id: "key-points", label: "KERNPUNKTE" },
];

export function SummarizerPanel() {
  const [text, setText] = useState("");
  const [length, setLength] = useState<SummaryLength>("medium");
  const [style, setStyle] = useState<SummaryStyle>("paragraph");
  const [focus, setFocus] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = useCallback(async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await summarize({ text, length, style, focus: focus || undefined, language });
      setResult(res);
      const kp = await getKeyPoints(text);
      setKeyPoints(kp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [text, length, style, focus, language]);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'IBM Plex Mono', monospace", height: "100%", padding: 16, overflowY: "auto" }}>
      <h2 style={{ color: AMBER, margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
        📝 ZUSAMMENFASSER
      </h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <label style={{ color: DIM, fontSize: 11 }}>LÄNGE</label>
          <div style={{ display: "flex", gap: 4 }}>
            {LENGTHS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLength(l.id)}
                style={{
                  padding: "4px 10px",
                  background: length === l.id ? AMBER : PANEL,
                  color: length === l.id ? "#000" : TEXT,
                  border: `1px solid ${length === l.id ? AMBER : BORDER}`,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ color: DIM, fontSize: 11 }}>STIL</label>
          <div style={{ display: "flex", gap: 4 }}>
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                style={{
                  padding: "4px 10px",
                  background: style === s.id ? AMBER : PANEL,
                  color: style === s.id ? "#000" : TEXT,
                  border: `1px solid ${style === s.id ? AMBER : BORDER}`,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ color: DIM, fontSize: 11 }}>SPRACHE</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                style={{
                  padding: "4px 10px",
                  background: language === l ? AMBER : PANEL,
                  color: language === l ? "#000" : TEXT,
                  border: `1px solid ${language === l ? AMBER : BORDER}`,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Focus */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: DIM, fontSize: 11 }}>FOKUS (OPTIONAL)</label>
        <input
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="z.B. Handlung, Charaktere, Dialoge..."
          style={{
            width: "100%",
            padding: "6px 10px",
            background: PANEL,
            border: `1px solid ${BORDER}`,
            color: TEXT,
            fontSize: 13,
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Input */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: DIM, fontSize: 11 }}>EINGABE</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Text hier einfügen..."
          style={{
            width: "100%",
            padding: "8px 10px",
            background: PANEL,
            border: `1px solid ${BORDER}`,
            color: TEXT,
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Summarize Button */}
      <button
        onClick={handleSummarize}
        disabled={busy || !text.trim()}
        style={{
          padding: "8px 20px",
          background: busy || !text.trim() ? DIM : AMBER,
          color: "#000",
          border: "none",
          cursor: busy || !text.trim() ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {busy ? "LÄUFT..." : "ZUSAMMENFASSEN"}
      </button>

      {error && (
        <div style={{ color: "#ff4444", fontSize: 12, marginBottom: 12 }}>FEHLER: {error}</div>
      )}

      {/* Result */}
      {result && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12, marginBottom: 12 }}>
          <div style={{ color: AMBER, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            ZUSAMMENFASSUNG
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {result.summary}
          </div>
          <div style={{ color: DIM, fontSize: 11, marginTop: 8 }}>
            {result.originalLength} → {result.summaryLength} Zeichen ({Math.round(result.compressionRatio * 100)}%)
          </div>
        </div>
      )}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: 12 }}>
          <div style={{ color: AMBER, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            KERNPUNKTE
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
            {keyPoints.map((kp, i) => (
              <li key={i}>{kp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
