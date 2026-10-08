// EpistolaryUnreliableSynthesizerModal (WP 96.1 UI)
import { useState, useMemo } from "react";
import {
  createEpistolaryUnreliableProfile,
  formatEpistolaryUnreliableProfile,
  createSampleProfile,
} from "@/services/ai/epistolaryUnreliableSynthesizer";

export interface EpistolaryUnreliableSynthesizerModalProps {
  className?: string;
}

export function EpistolaryUnreliableSynthesizerModal({ className }: EpistolaryUnreliableSynthesizerModalProps) {
  const [documentType, setDocumentType] = useState<"fieldJournal" | "diplomaticLetter" | "interrogationProtocol" | "finalConfession">("fieldJournal");
  const [authorName, setAuthorName] = useState("Dr. Viktor Halsh");
  const [recipientName, setRecipientName] = useState("Zukünftiges Ich");
  const [hiddenTruth, setHiddenTruth] = useState("Das Experiment ist außer Kontrolle geraten. Subjekt 7 ist entkommen.");
  const [seed, setSeed] = useState(12345);

  const profile = useMemo(
    () => createEpistolaryUnreliableProfile(documentType, authorName, recipientName, hiddenTruth, seed),
    [documentType, authorName, recipientName, hiddenTruth, seed]
  );

  const TYPE_LABELS: Record<string, string> = {
    fieldJournal: "📔 Feldtagebuch (Wahnsinn/Paranoia)",
    diplomaticLetter: "📜 Diplomatisches Schreiben (Erpressung/Höflichkeit)",
    interrogationProtocol: "📋 Verhör-Protokoll (Halbwahrheiten/Alibi)",
    finalConfession: "✉️ Letzter Beichtbrief (Selbstrechtfertigung)",
  };

  const IRONY_LABELS: Record<string, string> = {
    wishfulThinking: "Wunschdenken",
    selfDeception: "Selbsttäuschung",
    manipulation: "Manipulation",
    unreliableMemory: "Unzuverlässiges Gedächtnis",
  };

  return (
    <div className={className} data-testid="epistolary-unreliable-modal" style={{ padding: 16, maxWidth: 720, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        📖 Unzuverlässiger Briefroman- & Tagebuch-Synthesizer
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Dokument-Typ</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          >
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
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

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Autor</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Empfänger</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Verborgene Wahrheit (das der Leser zwischen den Zeilen erfährt)</label>
        <textarea
          value={hiddenTruth}
          onChange={(e) => setHiddenTruth(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11, resize: "vertical" }}
        />
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const sample = createSampleProfile();
            setDocumentType(sample.documentType);
            setAuthorName(sample.authorName);
            setRecipientName(sample.recipientName);
            setHiddenTruth(sample.entries[0]?.hiddenTruthHints[0] || "");
            setSeed(sample.seed);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Feldtagebuch von Dr. Halsh laden
        </button>
      </details>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          Generiertes Dokument (ID: {profile.id})
        </h3>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5, maxHeight: 400, overflow: "auto", padding: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
          {formatEpistolaryUnreliableProfile(profile)}
        </pre>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          📚 THEORETISCHER HINTERGRUND: EPISTEMISCHE IRONIE
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "var(--muted)" }}>
          <p><strong>Epistemische Ironie</strong> entsteht, wenn der Erzähler etwas behauptet, der Text aber Details liefert, die das Gegenteil beweisen. Der Leser weiß mehr als der Schreiber zugeben will.</p>
          <p><strong>Vier Haupttypen:</strong></p>
          <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
            {Object.entries(IRONY_LABELS).map(([key, label]) => (
              <li key={key}><strong>{label}:</strong> {IRONY_TEMPLATES[key as keyof typeof IRONY_TEMPLATES]?.[0]?.claim || ""} — aber {IRONY_TEMPLATES[key as keyof typeof IRONY_TEMPLATES]?.[0]?.contradiction || ""}</li>
            ))}
          </ul>
          <p><strong>Literarische Vorbilder:</strong> Bram Stoker (Dracula — Tagebucheinträge, die mehr verraten als die Schreiber ahnen), Pierre Choderlos de Laclos (Gefährliche Liebschaften — Briefe als Waffen), Gillian Flynn (Gone Girl — Tagebuch als Inszenierung).</p>
        </div>
      </details>
    </div>
  );
}

const IRONY_TEMPLATES: Record<string, Array<{claim: string, contradiction: string}>> = {
  wishfulThinking: [
    { claim: "Alles wird gut", contradiction: "Die Risse in der Wand werden breiter" },
  ],
  selfDeception: [
    { claim: "Ich tue das für uns beide", contradiction: "Du hast nie darum gebeten" },
  ],
  manipulation: [
    { claim: "Vertrau mir blind", contradiction: "Meine Finger kreuzen sich hinter dem Rücken" },
  ],
  unreliableMemory: [
    { claim: "Es war ein sonniger Tag", contradiction: "Die Wetteraufzeichnungen zeigen Sturmflut" },
  ],
};