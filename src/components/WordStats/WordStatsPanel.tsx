// WordStatsPanel (Sprint 25, Agent 6): erweiterte Wort-Statistiken.
// Bloomberg-Terminal-Stil (Inline-Styles, keine neue CSS-Datei):
// dunkles Terminal-Grün/Schwarz mit Amber-Akzenten, Monospace.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyze,
  compareWordUsage,
  searchKWIC,
  type WordStatsResult,
} from "@/services/wordstats/wordstats";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#2a3342";
const AMBER = "#ffb000";
const GREEN = "#33ff99";
const CYAN = "#4dd0e1";
const DIM = "#8b98a9";
const TEXT = "#e6edf3";

const box: React.CSSProperties = {
  background: BG,
  color: TEXT,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const card: React.CSSProperties = {
  background: PANEL,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  padding: 8,
  flex: "1 1 0",
  minWidth: 100,
};
const btn: React.CSSProperties = {
  background: "#1a2230",
  color: AMBER,
  border: `1px solid ${AMBER}`,
  borderRadius: 4,
  padding: "6px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};
const input: React.CSSProperties = {
  background: "#05070b",
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  padding: 8,
  fontFamily: "inherit",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

function StatCards({ stats, prefix }: { stats: WordStatsResult; prefix: string }) {
  const cards: { key: string; label: string; value: string; color: string }[] = [
    { key: "total", label: "Wörter gesamt", value: String(stats.totalWords), color: GREEN },
    { key: "unique", label: "Einzigartig", value: String(stats.uniqueWords), color: CYAN },
    {
      key: "ttr",
      label: "Type-Token-Ratio",
      value: stats.totalWords > 0 ? stats.typeTokenRatio.toFixed(2) : "–",
      color: AMBER,
    },
    {
      key: "avglen",
      label: "Ø-Wortlänge",
      value: stats.totalWords > 0 ? stats.averageWordLength.toFixed(1) : "–",
      color: GREEN,
    },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Statistiken">
      {cards.map((c) => (
        <div key={c.key} style={card} data-testid={`ws-stat-${prefix}${c.key}`}>
          <div style={{ color: c.color, fontSize: 16, fontWeight: 700 }}>{c.value}</div>
          <div style={{ color: DIM, fontSize: 11 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Wort-Wolke auf Canvas: Top-Wörter, Schriftgröße ∝ Häufigkeit. */
function WordCloud({ stats }: { stats: WordStatsResult | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !stats || stats.topWords.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = 560);
    const H = (canvas.height = 160);
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, W, H);
    const max = stats.topWords[0].count;
    let x = 8;
    let y = 28;
    stats.topWords.slice(0, 20).forEach((w, i) => {
      const size = 10 + Math.round((w.count / max) * 22);
      ctx.font = `700 ${size}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = i % 3 === 0 ? AMBER : i % 3 === 1 ? GREEN : CYAN;
      const tw = ctx.measureText(w.word).width;
      if (x + tw > W - 8) {
        x = 8;
        y += size + 10;
      }
      if (y > H - 4) return;
      ctx.fillText(w.word, x, y);
      x += tw + 12;
    });
  }, [stats]);
  return (
    <canvas
      ref={ref}
      data-testid="ws-wordcloud"
      aria-label="Wort-Wolke"
      style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 4 }}
    />
  );
}

export function WordStatsPanel({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [analyzed, setAnalyzed] = useState<string | null>(null);
  const [kwicTerm, setKwicTerm] = useState("");
  const [kwicHits, setKwicHits] = useState<ReturnType<typeof searchKWIC> | null>(null);
  const [compareText, setCompareText] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

  const stats = useMemo(() => (analyzed === null ? null : analyze(analyzed)), [analyzed]);
  const cmp = useMemo(
    () => (compareOpen && analyzed !== null ? compareWordUsage(analyzed, compareText) : null),
    [compareOpen, analyzed, compareText],
  );

  const doAnalyze = () => {
    const src = text || localStorage.getItem("editor-text-preview") || "";
    setText(src);
    setAnalyzed(src);
    setKwicHits(null);
  };
  const doKwic = () => {
    if (analyzed === null || !kwicTerm.trim()) return;
    setKwicHits(searchKWIC(analyzed, kwicTerm.trim(), 5));
  };

  return (
    <div style={box} data-testid="ws-panel">
      <h3 style={{ color: AMBER, margin: 0 }}>📖 WORTSTATISTIK</h3>

      <textarea
        aria-label="Analysetext"
        placeholder="Text einfügen oder aktuellen Text analysieren…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{ ...input, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn} onClick={doAnalyze}>
          ▸ Analysieren
        </button>
        <button
          type="button"
          style={{ ...btn, color: CYAN, borderColor: CYAN }}
          onClick={() => setCompareOpen((v) => !v)}
          aria-expanded={compareOpen}
        >
          ⇄ Vergleich
        </button>
      </div>

      {stats && (
        <>
          <StatCards stats={stats} prefix="" />

          <details open style={{ ...card, flex: "none" }}>
            <summary style={{ color: AMBER, cursor: "pointer" }}>
              Top-Wörter ({stats.topWords.length})
            </summary>
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {stats.topWords.slice(0, 10).map((w) => (
                <li
                  key={w.word}
                  style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}
                >
                  <span style={{ color: TEXT }}>{w.word}</span>
                  <span style={{ color: DIM }}>
                    {w.count}× · {w.frequency.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <details style={{ ...card, flex: "none" }}>
            <summary style={{ color: AMBER, cursor: "pointer" }}>
              N-Gramme · Bigramme ({stats.bigrams.length}) / Trigramme ({stats.trigrams.length})
            </summary>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
                {stats.bigrams.slice(0, 5).map((g) => (
                  <li key={g.words.join(" ")} style={{ padding: "2px 0" }}>
                    <span style={{ color: GREEN }}>{g.words.join(" ")}</span>{" "}
                    <span style={{ color: DIM }}>×{g.count}</span>
                  </li>
                ))}
              </ul>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
                {stats.trigrams.slice(0, 5).map((g) => (
                  <li key={g.words.join(" ")} style={{ padding: "2px 0" }}>
                    <span style={{ color: CYAN }}>{g.words.join(" ")}</span>{" "}
                    <span style={{ color: DIM }}>×{g.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <div style={{ ...card, flex: "none" }}>
            <label style={{ color: AMBER, display: "block", marginBottom: 6 }} htmlFor="ws-kwic">
              KWIC-Suche
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="ws-kwic"
                aria-label="KWIC-Suchbegriff"
                placeholder="Keyword…"
                value={kwicTerm}
                onChange={(e) => setKwicTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doKwic()}
                style={input}
              />
              <button type="button" style={btn} onClick={doKwic}>
                Suchen
              </button>
            </div>
            {kwicHits !== null && (
              <ul data-testid="ws-kwic-results" style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {kwicHits.length === 0 && (
                  <li style={{ color: DIM }}>Keine Treffer für „{kwicTerm}“.</li>
                )}
                {kwicHits.map((h, i) => (
                  <li key={`${h.position}-${i}`} style={{ padding: "3px 0", color: DIM }}>
                    {h.before}{" "}
                    <strong style={{ color: AMBER }}>{h.keyword}</strong> {h.after}
                    <span style={{ color: "#55606c" }}> #{h.position}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...card, flex: "none" }}>
            <div style={{ color: AMBER, marginBottom: 6 }}>Wort-Wolke</div>
            <WordCloud stats={stats} />
          </div>

          {compareOpen && (
            <div style={{ ...card, flex: "none" }} data-testid="ws-compare">
              <label style={{ color: CYAN, display: "block", marginBottom: 6 }} htmlFor="ws-cmp-text">
                Vergleichstext
              </label>
              <textarea
                id="ws-cmp-text"
                aria-label="Vergleichstext"
                placeholder="Zweiten Text einfügen…"
                value={compareText}
                onChange={(e) => setCompareText(e.target.value)}
                rows={4}
                style={{ ...input, resize: "vertical" }}
              />
              {cmp && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: AMBER, marginBottom: 4 }}>Text 1</div>
                    <StatCards stats={cmp.text1} prefix="cmp1-" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: CYAN, marginBottom: 4 }}>Text 2</div>
                    <StatCards stats={cmp.text2} prefix="cmp2-" />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {stats === null && (
        <div style={{ color: DIM }}>Noch keine Analyse — Text eingeben und „Analysieren“ drücken.</div>
      )}
    </div>
  );
}
