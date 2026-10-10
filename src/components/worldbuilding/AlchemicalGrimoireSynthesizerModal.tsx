// AlchemicalGrimoireSynthesizerModal (WP 98.1 UI)
import { useState, useMemo } from "react";
import {
  createGrimoirePage,
  createSampleGrimoirePage,
  MAGIC_AXIOMS,
  REAGENTS,
  analyzeReagentGrid,
  type MagicAxiomId,
} from "@/services/worldbuilding/alchemicalGrimoireSynthesizer";

export interface AlchemicalGrimoireSynthesizerModalProps {
  className?: string;
}

export function AlchemicalGrimoireSynthesizerModal({ className }: AlchemicalGrimoireSynthesizerModalProps) {
  const [axiom, setAxiom] = useState<MagicAxiomId>("elemental");
  const [selected, setSelected] = useState<string[]>(["Drachenblut", "Salamanderasche", "Mondwasser"]);
  const [seed, setSeed] = useState(42);

  const page = useMemo(() => createGrimoirePage(axiom, selected, seed), [axiom, selected, seed]);
  const grid = useMemo(() => analyzeReagentGrid(selected), [selected]);

  function toggleReagent(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  return (
    <div
      className={className}
      data-testid="alchemical-grimoire-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚗️ Alchemistisches Grimoire- &amp; Zauber-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seite {page.id} · Seed {seed}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Magie-Axiom
          <select
            value={axiom}
            onChange={(e) => setAxiom(e.target.value as MagicAxiomId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {MAGIC_AXIOMS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
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
          📖 MAGIE-AXIOM: {page.axiom.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.6 }}>
          <div><strong>Prinzip:</strong> {page.axiom.principle}</div>
          <div><strong>Kosten:</strong> {page.axiom.cost}</div>
          <div><strong>Risiko:</strong> {page.axiom.risk}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧪 REAGENZIEN-GITTER ({selected.length} gewählt)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {REAGENTS.map((r) => {
            const active = selected.includes(r.name);
            return (
              <button
                key={r.name}
                onClick={() => toggleReagent(r.name)}
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
                {r.name} ({r.essence})
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <span>Explosionsgefahr</span>
            <span style={{ color: grid.overallExplosionRisk >= 60 ? "var(--error)" : "var(--success)", fontWeight: 700 }}>
              {grid.overallExplosionRisk}%
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 6, marginTop: 4, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <span>Rückschlaggefahr</span>
            <span style={{ color: grid.overallBacklashRisk >= 60 ? "var(--error)" : "var(--success)", fontWeight: 700 }}>
              {grid.overallBacklashRisk}%
            </span>
          </div>
          <div style={{ marginTop: 4, padding: 6, border: `1px solid ${grid.stable ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)", fontWeight: 700 }}>
            {grid.stable ? "✓ STABILE MISCHUNG" : "✗ INSTABIL — RÜCKSCHLAG WAHRSCHEINLICH"}
          </div>
        </div>
        {grid.pairs.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
            {grid.pairs.map((p, i) => (
              <div key={i} style={{ padding: 6, border: `1px solid ${p.compatible ? "var(--border)" : "var(--error)"}`, borderRadius: 4, background: "var(--panel)" }}>
                {p.reagentA} + {p.reagentB} → {p.reaction}
              </div>
            ))}
          </div>
        )}
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌀 ILLUMINIERTE ZAUBERKREIS-SEITE
        </summary>
        <div style={{ marginTop: 8, padding: 12, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", display: "flex", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: page.circle.svg }}
        />
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
          {page.circle.ringCount} Ringe · Runen: {page.circle.runes.join(" · ")}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗣️ INKANTATION
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {page.incantation.formula}
        </pre>
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
          {page.incantation.meter}
        </div>
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 10, color: "var(--accent)", cursor: "pointer" }}>Phonetische Sprechhilfe</summary>
          <pre style={{ marginTop: 4, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
            {page.incantation.phonetic}
          </pre>
        </details>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const s = createSampleGrimoirePage();
            setAxiom(s.axiom.id);
            setSelected(s.reagents.map((r) => r.name));
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Elementar-Bindung mit Drachenblut laden
        </button>
      </details>
    </div>
  );
}
