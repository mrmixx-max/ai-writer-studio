// MetaphorAlchemySynthesizerModal (WP 95.1 UI)
import { useState, useMemo } from "react";
import {
  createMetaphorProfile,
  createSampleClicheCheck,
} from "@/services/ai/metaphorAlchemySynthesizer";

export interface MetaphorAlchemySynthesizerModalProps {
  className?: string;
}

export function MetaphorAlchemySynthesizerModal({ className }: MetaphorAlchemySynthesizerModalProps) {
  const [targetConcept, setTargetConcept] = useState("Trauer");
  const [sourceDomain, setSourceDomain] = useState("Architektur");
  const [seed, setSeed] = useState(42);

  const profile = useMemo(
    () => createMetaphorProfile(targetConcept, sourceDomain, seed),
    [targetConcept, sourceDomain, seed]
  );

  const DOMAIN_OPTIONS = [
    "Architektur", "Astronomie", "Botanik", "Chemie", "Geologie",
    "Mechanik", "Medizin", "Meteorologie", "Musik", "Navigation",
    "Optik", "Physik", "Schifffahrt", "Statik", "Thermodynamik",
    "Vulkanologie", "Weberei", "Zoologie",
  ];

  const TYPE_LABELS: Record<string, string> = {
    structural: "🏗️ STRUKTURELL",
    orientational: "🧭 ORIENTATIONAL",
    ontological: "👤 ONTOLOGISCH",
    compound: "⚗️ KOMPOUND (Cross-Domain)",
  };

  return (
    <div
      className={className}
      data-testid="metaphor-alchemy-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚗️ Metaphern-Alchemie & Cross-Domain-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Metaphern: {profile.metaphors.length} · Klischee-Score: {(profile.clicheScore * 100).toFixed(0)}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Zielbegriff (z. B. Trauer, Liebe, Angst)
          <input value={targetConcept} onChange={e => setTargetConcept(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Quelldomäne
          <select value={sourceDomain} onChange={e => setSourceDomain(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-metaphern" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✨ GENERIERTE METAPHERN ({profile.metaphors.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          {profile.metaphors.map((m, i) => (
            <div
              key={i}
              style={{
                padding: 10,
                border: `1px solid ${m.isCliche ? "var(--error)" : "var(--border)"}`,
                borderRadius: 4,
                background: m.isCliche ? "rgba(255,0,0,0.05)" : "var(--panel)",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>{TYPE_LABELS[m.mappingType] || m.mappingType}</span>
                <span style={{ color: "var(--muted)" }}>Domäne: {m.sourceDomain}</span>
                <span style={{ color: "var(--muted)" }}>Neuartigkeit: {(m.novelty * 100).toFixed(0)}%</span>
                {m.isCliche && <span style={{ color: "var(--error)", fontWeight: 700 }}>⚠️ KLISCHEE</span>}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                "{m.text}"
              </div>
              <div style={{ marginTop: 4, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${m.novelty * 100}%`,
                    height: "100%",
                    background: m.isCliche ? "var(--error)" : "var(--accent)",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-statistik" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 STATISTIK
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Ø Neuartigkeit</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
              {(profile.metaphors.reduce((sum, m) => sum + m.novelty, 0) / profile.metaphors.length * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Klischee-Rate</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: profile.clicheScore > 0 ? "var(--error)" : "var(--success)" }}>
              {(profile.clicheScore * 100).toFixed(0)}%
            </div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Mapping-Typen</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
              {new Set(profile.metaphors.map(m => m.mappingType)).size}
            </div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Einzigartige Domänen</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
              {new Set(profile.metaphors.map(m => m.sourceDomain.split(" × ")[0])).size}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-klischee-check" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ KLISCHEE-VERNICHTER TEST
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {createSampleClicheCheck().map((check, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                border: `1px solid ${check.isCliche ? "var(--error)" : "var(--success)"}`,
                borderRadius: 4,
                background: check.isCliche ? "rgba(255,0,0,0.05)" : "rgba(0,255,0,0.05)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>"{check.text}"</span>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  background: check.isCliche ? "var(--error)" : "var(--success)",
                  color: "var(--bg)",
                }}>
                  {check.isCliche ? "KLISCHEE" : "FRISCH"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-KOMBINATIONEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["Trauer", "Architektur"],
            ["Liebe", "Botanik"],
            ["Angst", "Vulkanologie"],
            ["Hoffnung", "Navigation"],
            ["Wut", "Mechanik"],
            ["Einsamkeit", "Astronomie"],
            ["Freude", "Musik"],
            ["Scham", "Medizin"],
          ].map(([concept, domain], i) => (
            <button
              key={i}
              onClick={() => { setTargetConcept(concept); setSourceDomain(domain); setSeed(i + 30); }}
              style={{
                padding: "6px 10px",
                textAlign: "left",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              {concept} × {domain}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-mapping-typen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔬 MAPPING-TYPEN ERKLÄRT
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <strong>Strukturell:</strong> Überträgt innere Struktur (Fundament→Halt, Gerüst→Form).<br/>
          <strong>Orientational:</strong> Räumliche Metaphern (auf/ab, innen/aussen, nah/fern).<br/>
          <strong>Ontologisch:</strong> Personifikation, Verdinglichung abstrakter Konzepte.<br/>
          <strong>Compound (Cross-Domain):</strong> Verschmelzung zweier fremder Domänen
          (z. B. Architektur × Botanik → "Das Trauergewölbe rankt sich mit Efeu der Erinnerung").<br/>
          <br/>
          <strong>Lakoff/Johnson (1980):</strong> Metaphern sind nicht nur sprachlicher Schmuck,
          sondern kognitive Grundoperationen: ARGUMENT IS WAR, TIME IS MONEY, LOVE IS A JOURNEY.
          Der Synthesizer bricht Klischees (TOP 5000), indem er ungewöhnliche Domänenpaare wählt.
        </div>
      </details>

      <details>
        <summary data-testid="summary-domänen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 VERFÜGBARE QUELL-DOMÄNEN
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 4, fontSize: 10 }}>
          {DOMAIN_OPTIONS.map(d => (
            <div key={d} style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}