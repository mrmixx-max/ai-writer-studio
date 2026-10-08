// CognitiveReaderTwinModal (WP 102.1 UI)
import { useState, useMemo } from "react";
import {
  analyzeReaderTwin,
  READER_ARCHETYPES,
  SAMPLE_TEXT,
  type ReaderArchetypeId,
} from "@/services/ai/cognitiveReaderTwin";

export interface CognitiveReaderTwinModalProps {
  className?: string;
}

export function CognitiveReaderTwinModal({ className }: CognitiveReaderTwinModalProps) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [seed, setSeed] = useState(42);
  const [selected, setSelected] = useState<ReaderArchetypeId[]>([
    "skimmer",
    "contemplator",
    "dopamineSeeker",
    "plotHacker",
  ]);

  const report = useMemo(() => analyzeReaderTwin(text, selected, seed), [text, selected, seed]);

  function toggle(id: ReaderArchetypeId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const intensityColor = (v: number) =>
    v > 0.7 ? "var(--error)" : v > 0.4 ? "var(--warn)" : "var(--muted)";

  return (
    <div
      className={className}
      data-testid="cognitive-reader-twin-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        👁️ Kognitiver Reader-Twin &amp; Blick-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Bericht {report.id} · {report.sentenceCount} Sätze · Gesamt-Retention {report.overallRetention}%
      </div>

      <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Manuskript-Text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "var(--font-mono)", resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧠 READER-TWIN-ARCHETYPEN ({selected.length} aktiv)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {READER_ARCHETYPES.map((a) => {
            const active = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  borderRadius: 4,
                  background: active ? "var(--accent)" : "var(--panel)",
                  color: active ? "var(--bg)" : "var(--fg)",
                  border: "1px solid var(--border)",
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
          {READER_ARCHETYPES.filter((a) => selected.includes(a.id)).map((a) => (
            <div key={a.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong style={{ color: "var(--accent)" }}>{a.name}:</strong> {a.behaviour}
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 LESE-ERFAHRUNG JE ARCHETYP
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {report.experiences.map((e) => (
            <div key={e.archetype} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{READER_ARCHETYPES.find((a) => a.id === e.archetype)?.name ?? e.archetype}</strong>
                <span style={{ color: e.engagementScore >= 70 ? "var(--success)" : "var(--error)", fontWeight: 700 }}>
                  {e.engagementScore}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {e.totalDwellMs} ms Verweildauer · {e.skips} Überspringungen · {e.regressions} Regressionen
              </div>
              {e.abandonedAtSentence !== null && (
                <div style={{ fontSize: 10, color: "var(--error)", marginTop: 2 }}>
                  ✗ Abbruch bei Satz {e.abandonedAtSentence + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔥 SAKKADEN- &amp; REGRESSIONS-HEATMAP
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 3 }}>
          {report.heatmap.map((cell) => (
            <div
              key={cell.sentenceIndex}
              title={`Satz ${cell.sentenceIndex + 1} · Intensität ${(cell.intensity * 100).toFixed(0)}%`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                border: cell.breakPoint ? "2px solid var(--error)" : "1px solid var(--border)",
                background: `color-mix(in srgb, ${intensityColor(cell.intensity)} ${Math.round(cell.intensity * 100)}%, var(--panel))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                color: "var(--fg)",
              }}
            >
              {cell.sentenceIndex + 1}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Rot umrandet = Abbruchpunkt · Helle Zellen = hohe Verweildauer
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 SCHWÄCHSTER ARCHETYP
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          {report.weakestArchetype
            ? `${READER_ARCHETYPES.find((a) => a.id === report.weakestArchetype)?.name ?? report.weakestArchetype} — hier verliert der Text am meisten Leser.`
            : "Keine Archetypen ausgewählt."}
        </div>
      </details>
    </div>
  );
}
