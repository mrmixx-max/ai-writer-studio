// Plot-Analyzer-Panel (Sprint 25, Agent 5): Freier Text, Analyse-Start,
// Spannungskurve (SVG-Linie), Act-Struktur, Plot-Points, Charakter-Boegen,
// Verbesserungsvorschlaege. Bloomberg-Terminal-Stil (Inline-Styles).
// Der Analyse-Client ist per Prop injizierbar (Tests/Storybook), Default: analyzePlot.
import { useMemo, useRef, useState } from "react";
import {
  analyzePlot,
  generateTensionCurve,
  identifyClimax,
  type PlotAnalysis,
  type PlotPoint,
} from "@/services/plot/plotAnalyzer";

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

const GREEN = "#5fff87";
const RED = "#ff5555";
const DIM = "#8a94a6";

const PHASES = [
  { key: "exposition", label: "I · Exposition", range: "0–20%" },
  { key: "risingAction", label: "II · Steigende Handlung", range: "20–60%" },
  { key: "climax", label: "III · Höhepunkt", range: "60–85%" },
  { key: "fallingAction", label: "IV · Fallende Handlung", range: "85–95%" },
  { key: "resolution", label: "V · Auflösung", range: "95–100%" },
] as const;

export interface PlotAnalyzerPanelProps {
  initialText?: string;
  analyze?: (text: string, opts?: { signal?: AbortSignal }) => Promise<PlotAnalysis>;
}

function TensionChart({ curve }: { curve: { position: number; tension: number }[] }) {
  const W = 560;
  const H = 160;
  const PAD = 24;
  const x = (p: number) => PAD + (p / 100) * (W - PAD * 2);
  const y = (t: number) => H - PAD - (t / 10) * (H - PAD * 2);
  const line = curve.map((c) => `${x(c.position).toFixed(1)},${y(c.tension).toFixed(1)}`).join(" ");
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;
  return (
    <svg
      data-testid="plot-tension-curve"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Spannungskurve"
      style={{ background: "#06090f", border: "1px solid #2a3340", borderRadius: 4 }}
    >
      {[0, 2, 4, 6, 8, 10].map((t) => (
        <g key={t}>
          <line x1={PAD} x2={W - PAD} y1={y(t)} y2={y(t)} stroke="#1c2530" strokeWidth={1} />
          <text x={4} y={y(t) + 3} fill={DIM} fontSize={9}>{t}</text>
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((p) => (
        <text key={p} x={x(p) - 8} y={H - 8} fill={DIM} fontSize={9}>{p}%</text>
      ))}
      <polygon points={area} fill="#ffb00022" />
      <polyline
        points={line}
        fill="none"
        stroke="#ffb000"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {curve.map((c, i) => (
        <circle key={i} cx={x(c.position)} cy={y(c.tension)} r={3} fill={GREEN} />
      ))}
    </svg>
  );
}

/** Gruppiert Plot-Points je Figur (Charakter-Bogen: Positionen + Tensionen). */
export function characterArcs(points: PlotPoint[]): { name: string; points: PlotPoint[] }[] {
  const map = new Map<string, PlotPoint[]>();
  for (const p of [...points].sort((a, b) => a.position - b.position)) {
    for (const c of p.characters) {
      const list = map.get(c) ?? [];
      list.push(p);
      map.set(c, list);
    }
  }
  return [...map.entries()]
    .map(([name, pts]) => ({ name, points: pts }))
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}

export function PlotAnalyzerPanel({ initialText = "", analyze = analyzePlot }: PlotAnalyzerPanelProps) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<PlotAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  async function start() {
    if (busy || !text.trim()) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    try {
      const res = await analyze(text, { signal: ctrl.signal });
      setResult(res);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Plot-Analyse fehlgeschlagen.");
      }
    } finally {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      abortRef.current = null;
      setBusy(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const allPoints: PlotPoint[] = useMemo(() => {
    if (!result) return [];
    const pts = [
      ...result.arc.exposition,
      ...result.arc.risingAction,
      ...result.arc.climax,
      ...result.arc.fallingAction,
      ...result.arc.resolution,
    ];
    return generateTensionCurve(pts).length >= 0
      ? pts.sort((a, b) => a.position - b.position)
      : pts;
  }, [result]);

  const climax = useMemo(() => (result ? identifyClimax(allPoints) : undefined), [result, allPoints]);
  const arcs = useMemo(() => characterArcs(allPoints), [allPoints]);

  return (
    <div data-testid="plot-analyzer-panel" style={TERM}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>📈 PLOT ANALYSE ▸ Story-Arc + Spannungskurve</div>

      <label htmlFor="plot-text" style={{ display: "block", marginBottom: 4, color: GREEN }}>
        TEXT
      </label>
      <textarea
        id="plot-text"
        data-testid="plot-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Erzaehltext einfuegen …"
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#06090f",
          color: "#ffb000",
          border: "1px solid #2a3340",
          borderRadius: 4,
          padding: 8,
          fontFamily: "inherit",
          fontSize: 12,
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button
          data-testid="plot-start"
          onClick={start}
          disabled={busy || !text.trim()}
          style={{
            background: busy ? "#2a3340" : "#ffb000",
            color: "#0a0e14",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontWeight: "bold",
            cursor: busy || !text.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {busy ? `ANALYSIERE … (${elapsed}s)` : "▸ ANALYSIEREN"}
        </button>
        {busy && (
          <button
            data-testid="plot-cancel"
            onClick={cancel}
            style={{
              background: "transparent",
              color: RED,
              border: `1px solid ${RED}`,
              borderRadius: 4,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ABBRECHEN
          </button>
        )}
      </div>

      {error && (
        <div data-testid="plot-error" style={{ color: RED, marginTop: 8 }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <div data-testid="plot-result" style={{ marginTop: 12 }}>
          <div data-testid="plot-pacing" style={{ marginBottom: 8 }}>
            TEMPO: <strong style={{ color: GREEN }}>{result.pacing.toUpperCase()}</strong>
            {climax && (
              <span data-testid="plot-climax" style={{ marginLeft: 12, color: DIM }}>
                KLIMAX: „{climax.title}" @ {climax.position}% (Tension {climax.tension}/10)
              </span>
            )}
          </div>

          <div style={{ color: GREEN, marginBottom: 4 }}>SPANNUNGSKURVE</div>
          {result.tensionCurve.length > 0 ? (
            <TensionChart curve={result.tensionCurve} />
          ) : (
            <div data-testid="plot-tension-empty" style={{ color: DIM }}>
              Keine Spannungsdaten.
            </div>
          )}

          <div style={{ color: GREEN, margin: "12px 0 4px" }}>ACT-STRUKTUR</div>
          <div data-testid="plot-act-structure" style={{ display: "flex", gap: 4 }}>
            {PHASES.map((ph) => {
              const pts = result.arc[ph.key];
              const active = pts.length > 0;
              return (
                <div
                  key={ph.key}
                  data-testid={`plot-act-${ph.key}`}
                  title={`${pts.length} Plot-Points`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "6px 2px",
                    borderRadius: 4,
                    border: `1px solid ${active ? GREEN : "#2a3340"}`,
                    background: active ? "#5fff8718" : "#06090f",
                    color: active ? GREEN : DIM,
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>{ph.label}</div>
                  <div style={{ fontSize: 10, color: DIM }}>{ph.range}</div>
                  <div data-testid={`plot-act-${ph.key}-count`} style={{ fontSize: 16 }}>
                    {pts.length}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ color: GREEN, margin: "12px 0 4px" }}>
            PLOT-POINTS ({allPoints.length})
          </div>
          <ul data-testid="plot-points-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {allPoints.map((p) => (
              <li
                key={p.id}
                data-testid={`plot-point-${p.id}`}
                style={{ borderBottom: "1px solid #1c2530", padding: "4px 0" }}
              >
                <span style={{ color: DIM }}>{p.position}% · {p.type} · ⚡{p.tension}</span>
                {" — "}
                <strong>{p.title}</strong>
                {p.characters.length > 0 && (
                  <span style={{ color: DIM }}> [{p.characters.join(", ")}]</span>
                )}
                {p.description && p.description !== p.title && (
                  <div style={{ color: DIM, fontSize: 12 }}>{p.description}</div>
                )}
              </li>
            ))}
          </ul>

          {arcs.length > 0 && (
            <>
              <div style={{ color: GREEN, margin: "12px 0 4px" }}>CHARAKTER-BÖGEN</div>
              <ul data-testid="plot-character-arcs" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {arcs.map((a) => (
                  <li key={a.name} data-testid={`plot-character-${a.name}`} style={{ padding: "2px 0" }}>
                    <strong>{a.name}</strong>
                    <span style={{ color: DIM }}>
                      {" "}
                      · {a.points.length} Stationen · {a.points[0].position}% →{" "}
                      {a.points[a.points.length - 1].position}% · max ⚡
                      {Math.max(...a.points.map((p) => p.tension))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.suggestions.length > 0 && (
            <>
              <div style={{ color: GREEN, margin: "12px 0 4px" }}>VERBESSERUNGSVORSCHLÄGE</div>
              <ul data-testid="plot-suggestions" style={{ paddingLeft: 18, margin: 0 }}>
                {result.suggestions.map((s, i) => (
                  <li key={i} data-testid={`plot-suggestion-${i}`} style={{ marginBottom: 2 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
