// FreudianSlipDialogueSynthesizerModal (WP 94.1 UI)
import { useState, useMemo } from "react";
import {
  createFreudianSlipProfile,
} from "@/services/ai/freudianSlipDialogueSynthesizer";

export interface FreudianSlipDialogueSynthesizerModalProps {
  className?: string;
}

export function FreudianSlipDialogueSynthesizerModal({ className }: FreudianSlipDialogueSynthesizerModalProps) {
  const [surfaceTopic, setSurfaceTopic] = useState("Der Unfall");
  const [repressedContent, setRepressedContent] = useState("Ich habe den Bremszug absichtlich durchgeschnitten, weil er mich erpresst hat. Mord aus Notwehr.");
  const [characterName, setCharacterName] = useState("Thomas");
  const [seed, setSeed] = useState(42);

  const profile = useMemo(
    () => createFreudianSlipProfile(surfaceTopic, repressedContent, characterName, seed),
    [surfaceTopic, repressedContent, characterName, seed]
  );

  return (
    <div
      className={className}
      data-testid="freudian-slip-modal"
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
        🧠 Freudscher Fehlleistungs- & Vermeidungs-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Zeilen: {profile.dialogueLines.length} · Leakages: {profile.leakageMarkers.length}
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-eingabe" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 EINGABE-PARAMETER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            Oberflächen-Thema
            <input value={surfaceTopic} onChange={e => setSurfaceTopic(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>
            Figuren-Name
            <input value={characterName} onChange={e => setCharacterName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            Seed
            <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Verdrängter Inhalt / Trauma
          <textarea
            value={repressedContent}
            onChange={e => setRepressedContent(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "8px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--fg)",
            }}
          />
        </label>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-dialog" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💬 GENERIERTER DIALOG ({profile.dialogueLines.length} Zeilen)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {profile.dialogueLines.map((line, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                border: `1px solid ${line.hasLeakage ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                background: line.hasLeakage ? "rgba(var(--accent-rgb),0.1)" : "var(--panel)",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <strong style={{ color: "var(--accent)" }}>{line.speaker}:</strong>
                <span>{line.text}</span>
              </div>
              {line.hasLeakage && (
                <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>
                  ⚡ LEAKAGE: {line.leakageType}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>

      {profile.leakageMarkers.length > 0 && (
        <details style={{ marginBottom: 12 }} open>
          <summary data-testid="summary-leakage" style={{ fontSize: 11, color: "var(--error)", cursor: "pointer", fontWeight: 700 }}>
            ⚡ UNBEWUSSTE DURCHBRÜCHE (LEAKAGE MARKER)
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
            {profile.leakageMarkers.map((leak, i) => (
              <div key={i} style={{ padding: 8, border: "1px solid var(--error)", borderRadius: 4, background: "rgba(255,0,0,0.05)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>Zeile {leak.index}:</span>
                  <span>"{leak.leakedWord}" → <strong>"{leak.originalWord}"</strong></span>
                  <span style={{ color: "var(--muted)" }}>({leak.type})</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  Kontext: {leak.context}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-SZENARIEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["Die Affäre", "Ich habe das Geld aus der gemeinsamen Kasse genommen. Verrat an ihrem Vertrauen.", "Marie"],
            ["Der verschwundene Schlüssel", "Ich habe ihn absichtlich verloren, damit sie nicht gehen kann. Kontrolle.", "David"],
            ["Die Prüfung", "Ich habe die Antworten gestohlen. Angst vor Versagen.", "Lisa"],
            ["Der Brand", "Ich habe die Kerze nicht gelöscht. Wut auf das Haus.", "Thomas"],
          ].map(([topic, content, name], i) => (
            <button
              key={i}
              onClick={() => { setSurfaceTopic(topic); setRepressedContent(content); setCharacterName(name); setSeed(i + 10); }}
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
              {topic} – {name}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-vermeidung" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ VERMEIDUNGS-STRATEGIEN
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <strong>Typische Vermeidungsphrasen:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            <li>"Ich möchte nicht darüber reden"</li>
            <li>"Das geht Sie nichts an"</li>
            <li>"Können wir das Thema wechseln?"</li>
            <li>"Ich erinnere mich nicht genau"</li>
            <li>"Es ist kompliziert"</li>
          </ul>
          <strong style={{ marginTop: 8 }}>Fehlleistungs-Typen:</strong>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            <li><strong>Slip:</strong> Tabuwort rutscht heraus ("nie... nie Mord... Mord getan")</li>
            <li><strong>Substitution:</strong> Klangverwandtes Wort ("reiner Tor... äh, Tod")</li>
            <li><strong>Stutter:</strong> Stocken bei Konfrontation ("Ich... ich meinte...")</li>
            <li><strong>Avoidance:</strong> Thematischer Ausweichmanöver</li>
          </ul>
        </div>
      </details>

      <details>
        <summary data-testid="summary-theorie" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 THEORETISCHER HINTERGRUND
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          Basiert auf Freuds Theorie der Fehlleistungen (1901): Das Unbewusste drückt sich durch
          scheinbar zufällige Fehler aus – Versprecher, Vergessensleistungen, Symptome.
          In der Literatur (Dostojewski, Henry James, Woolf) sind dies zentrale Charakterisierungswerkzeuge.
          Der Synthesizer kombiniert Vermeidungsrhetorik mit phonetischer Substitution
          (Mord→Tod, Verrat→Bruch, Liebe→Leid, Angst→Enge).
        </div>
      </details>
    </div>
  );
}