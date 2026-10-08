// SurrealDreamLogicSynthesizerModal (WP 99.1 UI)
import { useState, useMemo } from "react";
import {
  createDreamSequence,
  createSampleDreamSequence,
  DREAM_DIMENSIONS,
  type DreamDimensionId,
} from "@/services/ai/surrealDreamLogicSynthesizer";

export interface SurrealDreamLogicSynthesizerModalProps {
  className?: string;
}

export function SurrealDreamLogicSynthesizerModal({ className }: SurrealDreamLogicSynthesizerModalProps) {
  const [dimensions, setDimensions] = useState<DreamDimensionId[]>([
    "nonEuclidean",
    "identityFusion",
    "emotionalDisplacement",
  ]);
  const [seed, setSeed] = useState(42);
  const [prophecyCount, setProphecyCount] = useState(3);

  const seq = useMemo(
    () => createDreamSequence(dimensions, seed, prophecyCount),
    [dimensions, seed, prophecyCount]
  );

  function toggleDimension(id: DreamDimensionId) {
    setDimensions((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  return (
    <div
      className={className}
      data-testid="surreal-dream-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌙 Surrealer Traumlogik- &amp; Visions-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Sequenz {seq.id} · Seed {seed} · Traum-Kohärenz {seq.coherence}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Prophezeiungen
          <input
            type="number"
            min={1}
            max={8}
            value={prophecyCount}
            onChange={(e) => setProphecyCount(Number(e.target.value) || 1)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧩 TRAUM-DIMENSIONEN ({dimensions.length} aktiv)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DREAM_DIMENSIONS.map((d) => {
            const active = dimensions.includes(d.id);
            return (
              <button
                key={d.id}
                onClick={() => toggleDimension(d.id)}
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
                {d.name}
              </button>
            );
          })}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌀 TRAUM-EIGENE GESETZE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {seq.images.map((img, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>
                {seq.dimensions[i]?.name}
              </div>
              <div style={{ marginTop: 4 }}>{img.image}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                Gesetz: {img.lawDemonstrated}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔮 PROPHETISCHE SYMBOLIK ({seq.prophecies.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {seq.prophecies.map((p, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.symbol}</strong>
                <span style={{ color: "var(--accent)", fontSize: 10 }}>Gewicht {p.weight}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{p.omen}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 TRAUM-PROSA
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.7 }}>
          {seq.prose}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const s = createSampleDreamSequence();
            setDimensions(s.dimensions.map((d) => d.id));
            setSeed(42);
            setProphecyCount(s.prophecies.length);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Nicht-euklidischer Traum laden
        </button>
      </details>
    </div>
  );
}
