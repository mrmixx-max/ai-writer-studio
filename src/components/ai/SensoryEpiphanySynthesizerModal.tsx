// SensoryEpiphanySynthesizerModal (WP 96.2 UI)
import { useState, useMemo } from "react";
import {
  createSensoryEpiphanyProfile,
  createSampleProfile,
} from "@/services/ai/sensoryEpiphanySynthesizer";

export interface SensoryEpiphanySynthesizerModalProps {
  className?: string;
}

export function SensoryEpiphanySynthesizerModal({ className }: SensoryEpiphanySynthesizerModalProps) {
  const [triggerSense, setTriggerSense] = useState<"visual" | "auditory" | "olfactory" | "tactile" | "gustatory">("visual");
  const [characterName, setCharacterName] = useState("Elara");
  const [seed, setSeed] = useState(999);

  const profile = useMemo(
    () => createSensoryEpiphanyProfile(triggerSense, characterName, seed),
    [triggerSense, characterName, seed]
  );

  const SENSE_LABELS: Record<string, string> = {
    visual: "👁️ Visuell (Sehen)",
    auditory: "👂 Auditiv (Hören)",
    olfactory: "👃 Olfaktorisch (Riechen)",
    tactile: "✋ Taktile (Fühlen)",
    gustatory: "👅 Gustatorisch (Schmecken)",
  };

  const SENSE_EMOJIS: Record<string, string> = {
    visual: "👁️",
    auditory: "👂",
    olfactory: "👃",
    tactile: "✋",
    gustatory: "👅",
  };

  return (
    <div className={className} data-testid="sensory-epiphany-modal" style={{ padding: 16, maxWidth: 720, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        ✨ Transzendentale Epiphanie- & Gnadenmoment-Synthesizer
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Auslösender Sinn</label>
          <select
            value={triggerSense}
            onChange={(e) => setTriggerSense(e.target.value as typeof triggerSense)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          >
            {Object.entries(SENSE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Figurenname</label>
          <input
            type="text"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
        </div>
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const sample = createSampleProfile();
            setTriggerSense(sample.triggerSense);
            setCharacterName(sample.characterName);
            setSeed(sample.seed);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Elaras auditive Epiphanie laden
        </button>
      </details>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          Generierte Epiphanie (ID: {profile.id})
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
              {SENSE_EMOJIS[profile.triggerSense]} PHASE 1: STILLSTAND
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{profile.phase1_stillness}</div>
          </div>
          <div style={{ padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
              💥 PHASE 2: EINSTURZ
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{profile.phase2_collapse}</div>
          </div>
          <div style={{ padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
              🕊️ PHASE 3: KATHARSIS
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{profile.phase3_catharsis}</div>
          </div>
        </div>

        <details>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            📖 VOLLSTÄNDIGER FLIESSTEXT ANZEIGEN
          </summary>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, maxHeight: 300, overflow: "auto", padding: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
            {profile.fullEpiphanyText}
          </pre>
        </details>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          📚 THEORETISCHER HINTERGRUND: DIE DREI-PHASEN-EPIPHANIE
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "var(--muted)" }}>
          <p><strong>Nach James Joyce & Virginia Woolf</strong> ist eine Epiphanie ein Moment plötzlicher seelischer Klarheit, ausgelöst durch einen scheinbar belanglosen Sinnesreiz.</p>
          <p><strong>Drei Phasen:</strong></p>
          <ol style={{ margin: "4px 0", paddingLeft: 16 }}>
            <li><strong>Stillstand der Zeit:</strong> Mikroskopische Fixierung auf ein unscheinbares Sinnesdetail — die Welt verdichtet sich auf einen Punkt.</li>
            <li><strong>Einsturz der Lebenslüge:</strong> Plötzliche Erkenntnis über das eigene Scheitern, die verpasste Liebe, die verlogene Existenz.</li>
            <li><strong>Tiefer Friede / Katharsis:</strong> Wehmütige, aber versöhnliche Akzeptanz des Schicksals. Nicht Vergebung — Loslassen.</li>
          </ol>
          <p><strong>Literarische Vorbilder:</strong> Joyce (Die Toten — Schnee als Epiphanie), Woolf (Zur Leuchte — der Blick auf das Leuchtturmlicht), Proust (Auf der Suche nach der verlorenen Zeit — Madeleine & Tee).</p>
        </div>
      </details>
    </div>
  );
}