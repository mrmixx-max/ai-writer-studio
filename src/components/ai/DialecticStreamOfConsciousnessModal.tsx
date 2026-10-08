// DialecticStreamOfConsciousnessModal (WP 97.2 UI)
import { useState, useMemo } from "react";
import {
  createDialecticStreamProfile,
  createSampleProfile,
} from "@/services/ai/dialecticStreamOfConsciousness";

export interface DialecticStreamOfConsciousnessModalProps {
  className?: string;
}

export function DialecticStreamOfConsciousnessModal({ className }: DialecticStreamOfConsciousnessModalProps) {
  const [characterName, setCharacterName] = useState("K");
  const [setting, setSetting] = useState("Küche um 3 Uhr morgens");
  const [punctuationLevel, setPunctuationLevel] = useState(0.25);
  const [seed, setSeed] = useState(888);

  const profile = useMemo(
    () => createDialecticStreamProfile(characterName, setting, punctuationLevel, seed),
    [characterName, setting, punctuationLevel, seed]
  );

  const PUNCTUATION_LABELS: Record<number, string> = {
    0: "🌊 Fluss (keine Satzzeichen)",
    0.25: "🫁 Atmend (nur Kommas)",
    0.5: "💔 Fragmentiert (Punkte + Kommas)",
    0.75: "📝 Strukturiert (volle Interpunktion)",
    1: "🎯 Klar (innere Monologe)",
  };

  return (
    <div className={className} data-testid="dialectic-stream-modal" style={{ padding: 16, maxWidth: 720, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        🧠 Zweigleisiger Bewusstseinsstrom-Synthesizer
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
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
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Setting</label>
          <input
            type="text"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Interpunktions-Level</label>
          <select
            value={punctuationLevel}
            onChange={(e) => setPunctuationLevel(parseFloat(e.target.value))}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          >
            {Object.entries(PUNCTUATION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
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
            setCharacterName(sample.characterName);
            setSetting(sample.setting);
            setPunctuationLevel(sample.punctuationLevel);
            setSeed(sample.seed);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: K's nächtlicher Küchenstrom laden
        </button>
      </details>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          Generierter Bewusstseinsstrom (ID: {profile.id})
        </h3>

        <details open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            👁️ SPUR A: SENSORISCHE WAHRNEHMUNG ({profile.sensoryTrack.length})
          </summary>
          <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto" }}>
            {profile.sensoryTrack.map((seg, i) => (
              <div key={i} style={{ marginBottom: 6, padding: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 10 }}>
                <div style={{ color: "var(--accent)", fontSize: 9, marginBottom: 2 }}>Trigger: {seg.trigger}</div>
                <div style={{ lineHeight: 1.5 }}>{seg.text}</div>
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            🧠 SPUR B: UNWILLKÜRLICHE ERINNERUNGEN ({profile.memoryTrack.length})
          </summary>
          <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto" }}>
            {profile.memoryTrack.map((seg, i) => (
              <div key={i} style={{ marginBottom: 6, padding: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 10 }}>
                <div style={{ color: "var(--accent)", fontSize: 9, marginBottom: 2 }}>Assoziation: {seg.association}</div>
                <div style={{ lineHeight: 1.5 }}>{seg.text}</div>
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            🔀 VERSCHMOLZENER STROM ({profile.mergedStream.length})
          </summary>
          <div style={{ marginTop: 8, maxHeight: 250, overflow: "auto" }}>
            {profile.mergedStream.map((seg, i) => (
              <div key={i} style={{ marginBottom: 6, padding: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 10 }}>
                <div style={{ lineHeight: 1.5 }}>
                  {seg.memoryText}
                  {seg.interruption && <span style={{ color: "var(--accent)", fontWeight: 700 }}>{" "}{seg.interruption}{" "}</span>}
                  {seg.sensoryText && <span style={{ color: "var(--muted)" }}> — {seg.sensoryText}</span>}
                </div>
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            📖 KOMPLETTER FLIESSTEXT
          </summary>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, maxHeight: 300, overflow: "auto", padding: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
            {profile.mergedStream.map(s => s.combinedText).join(" ")}
          </pre>
        </details>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          📚 THEORETISCHER HINTERGRUND: ZWEIGLEISIGER BEWUSSTSEINSSTROM
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "var(--muted)" }}>
          <p><strong>Echter moderner Bewusstseinsstrom</strong> (Faulkner, Toni Morrison, Joyce) ist zweigleisig: Spur A (unmittelbare Sinnesreize der Umwelt) kollidiert unaufhörlich mit Spur B (rasender Strom unwillkürlicher Erinnerungen, Ängste, Traumen).</p>
          <p><strong>Sensorische Interruption:</strong> Ein plötzliches Geräusch (quietschende Reifen, tropfender Wasserhahn) zerschneidet den Gedankengang und lenkt ihn in neue Assoziationen — genau wie im echten Geist.</p>
          <p><strong>Satzzeichen-Modulator:</strong> Von <em>klarer innerer Monolog</em> (Level 1) bis zu <em>atemlos unpunktierter, fließender Gedankenstrom</em> (Level 0). Faulkner nutzte oft Level 0-0.25, Woolf Level 0.5-0.75.</p>
          <p><strong>Viszerale Psychologie:</strong> Erzeugt Prosa, die den Leser unmittelbar in die feuernden Synapsen der Figur versetzt — keine Beschreibung, sondern Erleben.</p>
          <p><strong>Literarische Vorbilder:</strong> Faulkner (Schall und Wahn — Benjy-Quentin-Sektionen), Morrison (Menschenkind — fragmentierte Mutter-Erinnerungen), Joyce (Ulysses — Molly Blooms Monolog), Woolf (Mrs Dalloway — tunneling technique).</p>
        </div>
      </details>
    </div>
  );
}