// CulinaryFeastSynthesizerModal (WP 78.1)
//
// Interaktiver kulinarischer Gastronomie- & Gelage-Synthesizer.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateFeast,
  formatFeast,
  BIOME_LABELS,
  CLASS_LABELS,
  type Biome,
  type SocialClass,
} from "@/services/worldbuilding/culinaryFeastSynthesizer";

export interface CulinaryFeastSynthesizerModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function CulinaryFeastSynthesizerModal({ className }: CulinaryFeastSynthesizerModalProps) {
  const [name, setName] = useState("Das Bankett von Falkenstein");
  const [biome, setBiome] = useState<Biome>("forest");
  const [socialClass, setSocialClass] = useState<SocialClass>("royal");
  const [seed] = useState(42);

  const feast = useMemo(
    () => generateFeast(name, biome, socialClass, seed),
    [name, biome, socialClass, seed],
  );

  return (
    <div
      className={className}
      data-testid="culinary-feast-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🍽️ Kulinarischer Gastronomie- & Gelage-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {feast.totalCourses} Gänge · {BIOME_LABELS[feast.biome]} · {CLASS_LABELS[feast.socialClass]}
      </div>

      {/* Eingabe */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Name
          <input
            data-testid="feast-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Biom
          <select
            data-testid="feast-biome-select"
            value={biome}
            onChange={(e) => setBiome(e.target.value as Biome)}
            style={inputStyle}
          >
            {(Object.keys(BIOME_LABELS) as Biome[]).map((b) => (
              <option key={b} value={b}>
                {BIOME_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Stand
          <select
            data-testid="feast-class-select"
            value={socialClass}
            onChange={(e) => setSocialClass(e.target.value as SocialClass)}
            style={inputStyle}
          >
            {(Object.keys(CLASS_LABELS) as SocialClass[]).map((c) => (
              <option key={c} value={c}>
                {CLASS_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Festmahl */}
      <div
        data-testid="feast-output"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>FESTMAHL</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{feast.name}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>{feast.description}</div>
        {feast.dishes.map((dish, i) => (
          <div key={i} data-testid={`feast-dish-${i}`} style={{ marginTop: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{dish.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Zutaten: {dish.ingredients.join(", ")}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Geschmack: {dish.flavors.join(", ")}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Textur: {dish.textures.join(", ")}
            </div>
          </div>
        ))}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="feast-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="feast-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatFeast(feast)}
        </pre>
      </details>
    </div>
  );
}
