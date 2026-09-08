// ReadabilityPanel (Sprint 25, Agent 4): 6 Lesbarkeits-Metriken mit Ampel,
// Radar-Chart (Canvas) und Vergleichs-Modus. Standalone — kein Kapitel nötig.
// Bloomberg-Terminal-Stil (Inline-Styles, keine neuen Dependencies).
import { useEffect, useRef, useState } from "react";
import {
  analyze,
  compareTexts,
  getScoreDescription,
  type ReadabilityResult,
} from "@/services/readability/readability";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

type Ampel = "green" | "yellow" | "red";
const AMPEL_COLOR: Record<Ampel, string> = {
  green: "#00e676",
  yellow: "#ffb000",
  red: "#ff5252",
};

/** Ampel für Grade-Level-Metriken (FK, Fog, Coleman-Liau, ARI, SMOG). */
function gradeAmpel(grade: number): Ampel {
  if (grade <= 8) return "green";
  if (grade <= 12) return "yellow";
  return "red";
}

/** Ampel für Reading Ease (hoch = gut). */
function easeAmpel(ease: number): Ampel {
  if (ease >= 60) return "green";
  if (ease >= 30) return "yellow";
  return "red";
}

interface MetricDef {
  key: string;
  label: string;
  hint: string;
  get: (r: ReadabilityResult) => number;
  ampel: (v: number) => Ampel;
  format: (v: number) => string;
}

const METRICS: MetricDef[] = [
  {
    key: "flesch-kincaid",
    label: "Flesch-Kincaid",
    hint: "US-Klassenstufe",
    get: (r) => r.score.fleschKincaid,
    ampel: gradeAmpel,
    format: (v) => `Klasse ${v.toFixed(1)}`,
  },
  {
    key: "flesch-ease",
    label: "Reading Ease",
    hint: "0 schwer – 100 leicht",
    get: (r) => r.score.fleschReadingEase,
    ampel: easeAmpel,
    format: (v) => v.toFixed(1),
  },
  {
    key: "gunning-fog",
    label: "Gunning Fog",
    hint: "US-Klassenstufe",
    get: (r) => r.score.gunningFog,
    ampel: gradeAmpel,
    format: (v) => `Klasse ${v.toFixed(1)}`,
  },
  {
    key: "coleman-liau",
    label: "Coleman-Liau",
    hint: "Buchstaben-Dichte",
    get: (r) => r.score.colemanLiau,
    ampel: gradeAmpel,
    format: (v) => `Klasse ${v.toFixed(1)}`,
  },
  {
    key: "ari",
    label: "ARI",
    hint: "Automated Index",
    get: (r) => r.score.ari,
    ampel: gradeAmpel,
    format: (v) => `Klasse ${v.toFixed(1)}`,
  },
  {
    key: "smog",
    label: "SMOG",
    hint: "Komplexwort-Dichte",
    get: (r) => r.score.smog,
    ampel: gradeAmpel,
    format: (v) => `Klasse ${v.toFixed(1)}`,
  },
];

/** Radar-Chart: 6 Achsen (FRE invertiert als Schwierigkeit 0..1). Canvas-2D. */
function RadarChart({ result }: { result: ReadabilityResult }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2 + 8;
    const R = Math.min(W, H) / 2 - 34;
    const norm = [
      Math.min(1, result.score.fleschKincaid / 20),
      Math.min(1, (100 - result.score.fleschReadingEase) / 100),
      Math.min(1, result.score.gunningFog / 20),
      Math.min(1, result.score.colemanLiau / 20),
      Math.min(1, result.score.ari / 20),
      Math.min(1, result.score.smog / 20),
    ];
    const labels = ["FK", "FRE*", "FOG", "CL", "ARI", "SMOG"];
    ctx.clearRect(0, 0, W, H);
    // Ringe
    for (const f of [0.33, 0.66, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (Math.PI * 2 * (i % 6)) / 6 - Math.PI / 2;
        const x = cx + Math.cos(a) * R * f;
        const y = cy + Math.sin(a) * R * f;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = BORDER;
      ctx.stroke();
    }
    // Achsen + Labels
    ctx.font = "10px monospace";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = BORDER;
      ctx.stroke();
      ctx.fillStyle = DIM;
      ctx.fillText(labels[i], cx + Math.cos(a) * (R + 14) - 10, cy + Math.sin(a) * (R + 14) + 3);
    }
    // Polygon
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const idx = i % 6;
      const a = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
      const x = cx + Math.cos(a) * R * norm[idx];
      const y = cy + Math.sin(a) * R * norm[idx];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fillStyle = "rgba(0, 229, 255, 0.18)";
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
  }, [result]);

  return <canvas ref={ref} width={260} height={220} data-testid="readability-chart" />;
}

function MetricCards({ result }: { result: ReadabilityResult }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {METRICS.map((m) => {
        const v = m.get(result);
        const color = AMPEL_COLOR[m.ampel(v)];
        return (
          <div
            key={m.key}
            data-testid={`readability-metric-${m.key}`}
            style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderTop: `3px solid ${color}`,
              borderRadius: 4,
              padding: "8px 10px",
            }}
          >
            <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase" }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, fontFamily: "monospace" }}>
              {m.format(v)}
            </div>
            <div style={{ fontSize: 10, color: DIM }}>{m.hint}</div>
            <div
              data-testid={`readability-ampel-${m.key}`}
              style={{ fontSize: 10, color, fontWeight: 700 }}
            >
              ● {m.ampel(v) === "green" ? "LEICHT" : m.ampel(v) === "yellow" ? "MITTEL" : "SCHWER"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReadabilityPanel() {
  const [text, setText] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [text2, setText2] = useState("");
  const [result, setResult] = useState<ReadabilityResult | null>(null);
  const [result2, setResult2] = useState<ReadabilityResult | null>(null);

  const handleLoadCurrent = () => {
    const saved = localStorage.getItem("editor-text-preview") || "";
    setText(saved);
    setResult(saved.trim() ? analyze(saved) : null);
  };

  const handleAnalyze = () => {
    if (!text.trim()) {
      setResult(null);
      setResult2(null);
      return;
    }
    if (compareMode && text2.trim()) {
      const c = compareTexts(text, text2);
      setResult(c.text1);
      setResult2(c.text2);
    } else {
      setResult(analyze(text));
      setResult2(null);
    }
  };

  return (
    <div
      data-testid="readability-panel"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "monospace",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h3 style={{ margin: 0, color: AMBER, fontSize: 15 }}>📊 LESBARKEIT // READABILITY DESK</h3>

      <textarea
        data-testid="readability-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text hier einfügen…"
        rows={6}
        style={{
          background: PANEL,
          color: TEXT,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          padding: 8,
          fontFamily: "monospace",
          fontSize: 12,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          data-testid="readability-load-current"
          onClick={handleLoadCurrent}
          style={{ background: PANEL, color: CYAN, border: `1px solid ${CYAN}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}
        >
          ⤓ Aktuellen Text analysieren
        </button>
        <button
          data-testid="readability-analyze"
          onClick={handleAnalyze}
          style={{ background: AMBER, color: "#000", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: "monospace" }}
        >
          ▶ Analysieren
        </button>
        <label style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            data-testid="readability-compare-toggle"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          Vergleichs-Modus
        </label>
      </div>

      {compareMode && (
        <textarea
          data-testid="readability-input-2"
          value={text2}
          onChange={(e) => setText2(e.target.value)}
          placeholder="Vergleichstext hier einfügen…"
          rows={4}
          style={{
            background: PANEL,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: 8,
            fontFamily: "monospace",
            fontSize: 12,
            resize: "vertical",
          }}
        />
      )}

      {result && (
        <div data-testid="readability-results" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MetricCards result={result} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div data-testid="readability-age" style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "8px 10px", flex: 1 }}>
              <div style={{ fontSize: 11, color: DIM }}>⌀ ZIELGRUPPE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: AMBER }}>{result.score.averageAge.toFixed(1)} Jahre</div>
            </div>
            <div data-testid="readability-level" style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "8px 10px", flex: 1 }}>
              <div style={{ fontSize: 11, color: DIM }}>BILDUNGS-LEVEL</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: CYAN }}>{result.score.educationLevel}</div>
              <div style={{ fontSize: 11, color: DIM }}>{getScoreDescription(result.score.fleschReadingEase)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: DIM }}>
            {result.words} Wörter · {result.sentences} Sätze · {result.syllables} Silben ·{" "}
            {result.complexWords} komplexe Wörter
          </div>
          <div>
            <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>RADAR // 6 METRIKEN (FRE* = Schwierigkeit)</div>
            <RadarChart result={result} />
          </div>
        </div>
      )}

      {result2 && (
        <div data-testid="readability-compare" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h4 style={{ margin: 0, color: AMBER, fontSize: 13 }}>⇄ VERGLEICH // TEXT 2</h4>
          <MetricCards result={result2} />
          <div style={{ fontSize: 11, color: DIM }}>
            {result2.words} Wörter · {result2.sentences} Sätze · {result2.syllables} Silben ·{" "}
            {result2.complexWords} komplexe Wörter
          </div>
        </div>
      )}
    </div>
  );
}
