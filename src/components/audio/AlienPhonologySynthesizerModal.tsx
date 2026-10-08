// AlienPhonologySynthesizerModal (WP 103.1 UI)
import { useState, useMemo } from "react";
import {
  analyzePhonology,
  createSamplePhonologyReport,
  VOCAL_APPARATUS,
  type VocalApparatusId,
} from "@/services/audio/alienPhonologySynthesizer";

export interface AlienPhonologySynthesizerModalProps {
  className?: string;
}

export function AlienPhonologySynthesizerModal({ className }: AlienPhonologySynthesizerModalProps) {
  const [apparatus, setApparatus] = useState<VocalApparatusId>("insectoid");
  const [seed, setSeed] = useState(42);

  const report = useMemo(() => analyzePhonology(apparatus, [0, 3, 9, 5], seed), [apparatus, seed]);

  return (
    <div
      className={className}
      data-testid="alien-phonology-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🛸 Nicht-menschliche Alien-Phonologie-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Bericht {report.id} · {report.apparatus.name} · {report.utterance.wordCount} Wörter
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Biomechanischer Lautapparat
          <select
            value={apparatus}
            onChange={(e) => setApparatus(e.target.value as VocalApparatusId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {VOCAL_APPARATUS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
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
          🦗 LAUTAPPARAT: {report.apparatus.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Mechanismus:</strong> {report.apparatus.mechanism}</div>
          <div><strong>Beschreibung:</strong> {report.apparatus.description}</div>
          <div><strong>Grundfrequenz:</strong> {report.apparatus.baseFrequencyHz} Hz · Klickrate {report.apparatus.clickRate}/s</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔤 CONLANG-ÜBERSETZUNGS-MATRIX ({report.lexicon.words.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {report.lexicon.words.map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>{w.stress}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>„{w.translation}“</span>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗣️ ÄUSSERUNG &amp; SINNTRANSLATION
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, marginBottom: 6 }}>{report.utterance.nativeText}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{report.utterance.translation}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 3, alignItems: "flex-end", height: 30 }}>
            {report.utterance.prosody.map((p, i) => (
              <div key={i} title={`Prosodie ${p}`} style={{ width: 12, height: `${Math.round(p * 100)}%`, background: "var(--accent)", borderRadius: 2 }} />
            ))}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔊 WEBAUDIO-SYNTHESE-PARAMETER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Oszillator:</strong> {report.patch.oscillator}</div>
          <div><strong>Grundfrequenz:</strong> {report.patch.baseFrequencyHz} Hz</div>
          <div><strong>FM-Index:</strong> {report.patch.fmIndex}</div>
          <div><strong>Klickrate:</strong> {report.patch.clickRate}/s</div>
          <div><strong>Infraschall:</strong> {Math.round(report.patch.infrasoundMix * 100)}%</div>
          <div><strong>Nachhall:</strong> {report.patch.reverbSeconds}s · Dauer {report.patch.durationSeconds}s</div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>{report.patch.instruction}</div>
        </div>
        <button
          onClick={() => {
            const s = createSamplePhonologyReport();
            setApparatus(s.apparatus.id);
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </details>
    </div>
  );
}
