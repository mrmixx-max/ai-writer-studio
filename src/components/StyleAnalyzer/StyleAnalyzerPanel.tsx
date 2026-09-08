// StyleAnalyzerPanel (Sprint 22, Agent 6): Stil-Profil + Autoren-Vergleich.
//
// Standalone-Panel ohne Kapitel-Abhaengigkeit: Text-Eingabe, Profil-Karten,
// Autoren-Vergleichs-Balkendiagramm (Multi-Select), Ähnlichster-Autor-Highlight
// und Stil-Fingerprint (Radar-Chart als SVG).
//
// Bloomberg-Terminal-Stil: bg #000, accent #ffa028, border #333,
// monospace (IBM Plex Mono). Keine neuen Dependencies.

import { useMemo, useState } from "react";
import {
  compareToAllAuthors,
  getAvailableAuthors,
  type StyleProfile,
} from "@/services/style/styleAnalyzer";

export interface StyleAnalyzerPanelProps {
  /** Optionaler Start-Text (z. B. aus dem Editor). */
  text?: string;
  className?: string;
}

const ACCENT = "#ffa028";

const PANEL_STYLE: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const CARD_STYLE: React.CSSProperties = {
  border: "1px solid #333",
  background: "#0a0a0a",
  padding: 8,
  minWidth: 0,
};

function Bar({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 8,
        background: "#1a1a1a",
        border: "1px solid #333",
        flex: "0 0 120px",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: highlight ? ACCENT : "#8a6a2f",
        }}
      />
    </div>
  );
}

/** Radar-Chart (Fingerprint) über 5 normierte Stil-Dimensionen. */
export function StyleFingerprint({ profile }: { profile: StyleProfile }) {
  const dims = useMemo(
    () =>
      [
        { label: "Satz", value: Math.min(1, profile.avgSentenceLength / 30) },
        { label: "Wort", value: profile.vocabularyRichness },
        { label: "Dialog", value: profile.dialogueRatio },
        { label: "Beschr.", value: profile.descriptionRatio },
        {
          label: "Tempo",
          value: profile.pacing === "fast" ? 0.9 : profile.pacing === "medium" ? 0.55 : 0.25,
        },
      ] as const,
    [profile],
  );
  const cx = 100;
  const cy = 90;
  const r = 70;
  const pt = (i: number, v: number): string => {
    const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
    return `${cx + Math.cos(angle) * r * v},${cy + Math.sin(angle) * r * v}`;
  };
  const polygon = dims.map((d, i) => pt(i, d.value)).join(" ");
  const grid = [0.33, 0.66, 1].map((g) => dims.map((_, i) => pt(i, g)).join(" "));
  return (
    <svg
      role="img"
      aria-label={`Stil-Fingerprint: ${profile.author}`}
      viewBox="0 0 200 170"
      style={{ width: "100%", maxWidth: 240, background: "#0a0a0a", border: "1px solid #333" }}
    >
      {grid.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="#333" strokeWidth={1} />
      ))}
      {dims.map((d, i) => {
        const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
        const lx = cx + Math.cos(angle) * (r + 16);
        const ly = cy + Math.sin(angle) * (r + 12);
        return (
          <g key={d.label}>
            <line x1={cx} y1={cy} x2={pt(i, 1)} stroke="#333" strokeWidth={1} />
            <text x={lx} y={ly} fill="#888" fontSize={9} textAnchor="middle" dominantBaseline="middle">
              {d.label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill="rgba(255,160,40,0.25)" stroke={ACCENT} strokeWidth={2} />
    </svg>
  );
}

export function StyleAnalyzerPanel({ text = "", className }: StyleAnalyzerPanelProps) {
  const [input, setInput] = useState(text);
  const [submitted, setSubmitted] = useState<string | null>(text ? text : null);
  const [selected, setSelected] = useState<string[]>(() => getAvailableAuthors());

  const result = useMemo(
    () => (submitted === null || submitted.trim() === "" ? null : compareToAllAuthors(submitted)),
    [submitted],
  );

  const visible = useMemo(() => {
    if (!result) return [];
    const set = new Set(selected.map((s) => s.toLowerCase()));
    return result.comparisons.filter((c) => set.has(c.author.toLowerCase()));
  }, [result, selected]);

  const best = visible[0] ?? null;

  const toggle = (author: string) => {
    setSelected((prev) =>
      prev.includes(author) ? prev.filter((a) => a !== author) : [...prev, author],
    );
  };

  const profile = result?.textProfile ?? null;

  return (
    <div className={className} style={PANEL_STYLE} data-testid="style-analyzer-panel">
      <h2 style={{ color: ACCENT, fontSize: 13, margin: 0 }}>
        🎨 STIL-ANALYSE <span style={{ color: "#666" }}>// Autoren-Vergleich</span>
      </h2>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ color: "#888" }}>TEXT</span>
        <textarea
          aria-label="Zu analysierender Text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder="Text einfügen …"
          style={{
            background: "#0a0a0a",
            color: "#e8e8e8",
            border: "1px solid #333",
            fontFamily: "inherit",
            fontSize: 12,
            padding: 8,
            resize: "vertical",
          }}
        />
      </label>
      <button
        onClick={() => setSubmitted(input)}
        disabled={input.trim() === ""}
        style={{
          background: ACCENT,
          color: "#000",
          border: "none",
          padding: "8px 12px",
          fontFamily: "inherit",
          fontWeight: "bold",
          cursor: input.trim() === "" ? "not-allowed" : "pointer",
          opacity: input.trim() === "" ? 0.4 : 1,
        }}
      >
        ▶ Aktuellen Text analysieren
      </button>

      {result && profile && (
        <>
          <section aria-label="Stil-Profil" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <div style={CARD_STYLE}>
              <div style={{ color: "#888" }}>SATZLÄNGE</div>
              <div style={{ color: ACCENT, fontSize: 18, fontWeight: "bold" }}>
                {profile.avgSentenceLength}
              </div>
              <div style={{ color: "#666" }}>Wörter/Satz</div>
            </div>
            <div style={CARD_STYLE}>
              <div style={{ color: "#888" }}>WORTSCHATZ</div>
              <div style={{ color: ACCENT, fontSize: 18, fontWeight: "bold" }}>
                {(profile.vocabularyRichness * 100).toFixed(1)} %
              </div>
              <div style={{ color: "#666" }}>Type-Token-Ratio</div>
            </div>
            <div style={CARD_STYLE}>
              <div style={{ color: "#888" }}>DIALOG</div>
              <div style={{ color: ACCENT, fontSize: 18, fontWeight: "bold" }}>
                {(profile.dialogueRatio * 100).toFixed(1)} %
              </div>
              <div style={{ color: "#666" }}>Dialog-Anteil</div>
            </div>
            <div style={CARD_STYLE}>
              <div style={{ color: "#888" }}>TEMPO</div>
              <div style={{ color: ACCENT, fontSize: 18, fontWeight: "bold" }}>
                {profile.pacing === "fast" ? "Schnell" : profile.pacing === "medium" ? "Mittel" : "Langsam"}
              </div>
              <div style={{ color: "#666" }}>Erzähltempo</div>
            </div>
          </section>

          {best && (
            <div
              data-testid="style-best-match"
              style={{ ...CARD_STYLE, borderColor: ACCENT }}
            >
              <span style={{ color: "#888" }}>ÄHNLICHSTER AUTOR: </span>
              <strong style={{ color: ACCENT }}>
                {best.author} ({best.similarity} %)
              </strong>
              <div style={{ color: "#666", marginTop: 4 }}>{result.verdict}</div>
            </div>
          )}

          <section aria-label="Autoren-Vergleich">
            <h3 style={{ color: ACCENT, fontSize: 12, margin: "0 0 8px" }}>
              AUTOREN-VERGLEICH
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visible.map((c) => (
                <div
                  key={c.author}
                  data-testid={`style-comparison-${c.author}`}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.author}
                  </span>
                  <Bar value={c.similarity} highlight={best?.author === c.author} />
                  <span style={{ flex: "0 0 56px", textAlign: "right", color: best?.author === c.author ? ACCENT : "#aaa" }}>
                    {c.similarity} %
                  </span>
                </div>
              ))}
              {visible.length === 0 && (
                <div style={{ color: "#666" }}>Keine Autoren ausgewählt.</div>
              )}
            </div>
          </section>

          <section aria-label="Autoren-Auswahl">
            <h3 style={{ color: ACCENT, fontSize: 12, margin: "0 0 8px" }}>
              AUTOREN-AUSWAHL
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {getAvailableAuthors().map((a) => {
                const active = selected.includes(a);
                return (
                  <button
                    key={a}
                    aria-pressed={active}
                    onClick={() => toggle(a)}
                    style={{
                      background: active ? ACCENT : "#0a0a0a",
                      color: active ? "#000" : "#aaa",
                      border: "1px solid #333",
                      padding: "4px 8px",
                      fontFamily: "inherit",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Stil-Fingerprint">
            <h3 style={{ color: ACCENT, fontSize: 12, margin: "0 0 8px" }}>
              STIL-FINGERPRINT
            </h3>
            <StyleFingerprint profile={profile} />
          </section>
        </>
      )}
    </div>
  );
}
