// PantheonCreationMythModal (WP 99.2 UI)
import { useState, useMemo } from "react";
import {
  createPantheon,
  createSamplePantheon,
  generateSacredVerse,
  COSMOGONIES,
  describeGeneration,
  type CosmogonyId,
} from "@/services/worldbuilding/pantheonCreationMyth";

export interface PantheonCreationMythModalProps {
  className?: string;
}

export function PantheonCreationMythModal({ className }: PantheonCreationMythModalProps) {
  const [name, setName] = useState("Das Zwölfgestirn");
  const [cosmogony, setCosmogony] = useState<CosmogonyId>("slainTitan");
  const [seed, setSeed] = useState(42);

  const pantheon = useMemo(() => createPantheon(name, cosmogony, seed), [name, cosmogony, seed]);
  const verse = useMemo(() => generateSacredVerse(cosmogony, seed, 5), [cosmogony, seed]);

  const generations = [0, 1, 2];

  return (
    <div
      className={className}
      data-testid="pantheon-myth-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏛️ Götter-Theogonie- &amp; Schöpfungsmythos-Weaver
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Pantheon {pantheon.id} · Seed {seed} · {pantheon.deities.length} Gottheiten
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Pantheon-Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Kosmogonie
          <select
            value={cosmogony}
            onChange={(e) => setCosmogony(e.target.value as CosmogonyId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {COSMOGONIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
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
          🌌 KOSMOGONIE: {pantheon.cosmogony.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ fontStyle: "italic" }}>{pantheon.cosmogony.firstLine}</div>
          <div style={{ marginTop: 6 }}><strong>Mechanismus:</strong> {pantheon.cosmogony.mechanism}</div>
          <div style={{ marginTop: 4 }}><strong>Echo:</strong> {pantheon.cosmogony.echo}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌳 GÖTTER-STAMMBAUM ({pantheon.deities.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          {generations.map((g) => {
            const genDeities = pantheon.deities.filter((d) =>
              g === 0 ? d.parentIds.length === 0 : d.parentIds.length > 0
            );
            if (genDeities.length === 0) return null;
            return (
              <div key={g}>
                <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
                  {describeGeneration(pantheon, g)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {genDeities.map((d) => (
                    <div key={d.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>{d.name}</strong>
                        <span style={{ color: "var(--muted)", fontSize: 10 }}>{d.domain}</span>
                      </div>
                      <div style={{ fontSize: 10, marginTop: 4 }}>
                        <div>Heiliges Tier: {d.sacredAnimal}</div>
                        <div>Sakrament: {d.sacrament}</div>
                        <div style={{ color: "var(--muted)" }}>Fluch: {d.curse}</div>
                      </div>
                      {d.attributes.length > 0 && (
                        <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10 }}>
                          {d.attributes.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 SAKRALTEXT — GENESIS-VERSE
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.8 }}>
          {verse.lines.map((line, i) => (
            <div key={i} style={{ marginBottom: 4 }}>{line}</div>
          ))}
        </div>
        <div style={{ marginTop: 6, padding: 8, border: "1px solid var(--accent)", borderRadius: 4, background: "var(--panel)", fontSize: 10, fontStyle: "italic" }}>
          {verse.inscription}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const p = createSamplePantheon();
            setName(p.name);
            setCosmogony(p.cosmogony.id);
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Das Zwölfgestirn laden
        </button>
      </details>
    </div>
  );
}
