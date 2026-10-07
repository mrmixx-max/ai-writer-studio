// SomaticBiomechanicsEngineModal (WP 92.1 UI)
import { useState, useMemo } from "react";
import {
  createSomaticProfile,
  injectSomaticProse,
  formatSomaticProfile,
  createSampleProfile as _createSampleProfile,
  type SomaticProfile as _SomaticProfile,
  type AutonomicState as _AutonomicState,
} from "@/services/ai/somaticBiomechanicsEngine";

export interface SomaticBiomechanicsEngineModalProps {
  className?: string;
}

export function SomaticBiomechanicsEngineModal({ className }: SomaticBiomechanicsEngineModalProps) {
  const [trigger, setTrigger] = useState("Duell bei Sonnenaufgang");
  const [seed, setSeed] = useState(42);
  const [mentalProse, setMentalProse] = useState("Er dachte an den morgigen Tag.");

  const profile = useMemo(() => createSomaticProfile(trigger, seed), [trigger, seed]);
  const injected = useMemo(() => injectSomaticProse(mentalProse, profile), [mentalProse, profile]);

  const STATE_LABELS: Record<_AutonomicState, { label: string; description: string }> = {
    sympathetic_fight: { label: "⚔️ Sympathischer Kampf", description: "Adrenalin-Tunnel, offensive Aggression" },
    sympathetic_flight: { label: "🏃 Sympathische Flucht", description: "Panik-getriebene Flucht, maximaler Output" },
    parasympathetic_freeze: { label: "🧊 Parasympathisches Erstarren", description: "Totenstarre, Dissoziation, Schock" },
    cold_flow: { label: "🧠 Kaltblütiger Flow", description: "Kontrollierte Erregung, präzise Execution" },
  };

  return (
    <div
      className={className}
      data-testid="somatic-biomechanics-modal"
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
        🧬 Somatische Biomechanik & Nervensystem-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Auslöser / Szene
          <input value={trigger} onChange={e => setTrigger(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 300 }}>
          Mentale Prosa (Eingabe)
          <textarea value={mentalProse} onChange={e => setMentalProse(e.target.value)} rows={3} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-somatic-profil" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧬 SOMATISCHES PROFIL
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {formatSomaticProfile(profile)}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-injektion" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✍️ INJEKTION: MENTAL → SOMATISCH
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--accent)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "rgba(var(--accent-rgb),0.1)" }}>
          {injected}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel-szenen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-SZENEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "Duell bei Sonnenaufgang",
            "Flucht durch brennendes Haus",
            "Verhör in dunklem Keller",
            "Chirurgische OP unter Zeitdruck",
            "Erster Kuss nach Jahren",
            "Sniper auf dem Dach",
            "Kind im Krieg",
            "Letzter Atemzug",
          ].map((scene, i) => (
            <button
              key={i}
              onClick={() => { setTrigger(scene); setSeed(i + 1); }}
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
              {scene}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-vegetative-zustaende" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 4 VEGETATIVE ZUSTÄNDE
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          {Object.entries(STATE_LABELS).map(([key, info]) => (
            <div key={key} style={{ marginBottom: 8, padding: 8, background: "var(--panel)", borderRadius: 4 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{info.label}</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>{info.description}</div>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary data-testid="summary-kaskaden-matrix" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 SOMATISCHE KASKADEN-MATRIX
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Vasokonstriktion (3 Komponenten):</strong> Eiskalte Fingerspitzen, aschfahles Gesicht, kalte Schweißperlen
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Sensorische Verengung (3 Komponenten):</strong> Tunnelblick, Pulsrauschen, Zeitdehnung
          </div>
          <div>
            <strong>Viszerale Reflexe (3 Komponenten):</strong> Trockener Schlund, Magenkrampf, Daumenzittern
          </div>
        </div>
      </details>
    </div>
  );
}