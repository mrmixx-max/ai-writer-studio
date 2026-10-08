// PolyrhythmicSentenceStreamModal (WP 94.2 UI)
import { useState, useMemo } from "react";
import {
  createPolyrhythmicProfile,
  type RhythmArchetype,
} from "@/services/ai/polyrhythmicSentenceStream";

export interface PolyrhythmicSentenceStreamModalProps {
  className?: string;
}

export function PolyrhythmicSentenceStreamModal({ className }: PolyrhythmicSentenceStreamModalProps) {
  const [archetype, setArchetype] = useState<RhythmArchetype>("staccato");
  const [emotion, setEmotion] = useState<string>("Todesangst");
  const [targetWords, setTargetWords] = useState<number>(200);
  const [seed, setSeed] = useState<number>(42);

  const EXAMPLE_CONFIGS: [RhythmArchetype, string, number][] = [
    ["staccato", "Todesangst", 150],
    ["periodic", "Melancholie", 250],
    ["polysyndeton", "Ekstase", 200],
    ["asyndeton", "Panik", 180],
    ["staccato", "Kampfrausch", 120],
    ["periodic", "Abschied", 300],
  ];

  const profile = useMemo(
    () => createPolyrhythmicProfile(archetype, emotion, targetWords, seed),
    [archetype, emotion, targetWords, seed]
  );

  const ARCHETYPE_LABELS: Record<RhythmArchetype, string> = {
    staccato: "🔴 Staccato-Hammer (1-4 Wörter, Todesgefahr)",
    periodic: "🔵 Periodischer Schwellsatz (hinausgezögert, 40+ Wörter)",
    polysyndeton: "🟢 Polysyndeton-Woge (treibende Bindewort-Wiederholung)",
    asyndeton: "🟡 Asyndetischer Rausch (schnelle unverbundene Verbkaskaden)",
  };

  return (
    <div
      className={className}
      data-testid="polyrhythmic-modal"
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
        🎵 Polyrhythmischer Satzmelodie- & Kadenzen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Sätze: {profile.sentences.length} · Ø Wörter: {profile.rhythmAnalysis.avgWordsPerSentence}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 220 }}>
          Rhythmus-Archetyp
          <select value={archetype} onChange={e => setArchetype(e.target.value as RhythmArchetype)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="staccato">🔴 Staccato-Hammer</option>
            <option value="periodic">🔵 Periodischer Schwellsatz</option>
            <option value="polysyndeton">🟢 Polysyndeton-Woge</option>
            <option value="asyndeton">🟡 Asyndetischer Rausch</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Emotion / Kontext
          <input value={emotion} onChange={e => setEmotion(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Ziel-Wortzahl
          <input type="number" value={targetWords} onChange={e => setTargetWords(Math.max(50, Number(e.target.value) || 50))} min="50" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-rhythmus-analyse" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 RHYTHMUS-ANALYSE
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Ø Wörter/Satz</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{profile.rhythmAnalysis.avgWordsPerSentence}</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Satzanzahl</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{profile.rhythmAnalysis.sentenceCount}</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Fragment-Anteil</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{(profile.rhythmAnalysis.fragmentRatio * 100).toFixed(0)}%</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Subordinationstiefe</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{(profile.rhythmAnalysis.subordinationDepth * 100).toFixed(0)}%</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Polysyndeton-Sätze</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{profile.rhythmAnalysis.polysyndetonCount}</div>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Asyndeton-Runs</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{profile.rhythmAnalysis.asyndetonRuns}</div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-generierte-saetze" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 GENERIERTE SÄTZE ({profile.sentences.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, maxHeight: 300, overflow: "auto" }}>
          {profile.sentences.map((s, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
                fontSize: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ minWidth: 60, fontWeight: 700, color: "var(--accent)" }}>{s.rhythmMarker}</span>
                <span style={{ minWidth: 50 }}>{s.wordCount} Wörter</span>
                <span style={{ color: "var(--muted)" }}>{s.sentenceType}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>"{s.text}"</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-volltext" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 VOLLTEXT
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.6 }}>
          {profile.sentences.map(s => s.text).join(" ")}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-archetypen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 RHYTHMUS-ARCHETYPEN IM DETAIL
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 10, lineHeight: 1.6 }}>
          {[
            ["🔴 Staccato-Hammer", "1–4 Wörter pro Satz", "Todesgefahr, Action, Panik", "Fragmentiert, elliptisch", "„Kälte. Eisen. Blut. Er sprang.“"],
            ["🔵 Periodischer Schwellsatz", "20–60+ Wörter", "Melancholie, Erhabenheit, Reflexion", "Verschachtelt, hinausgezögert", "„Während die Welt kreiste, als die Sonne küsste, da fiel die Entscheidung.“"],
            ["🟢 Polysyndeton-Woge", "10–30 Wörter", "Ekstase, Treibende Kraft, Ritual", "Kumulative Bindewort-Ketten", "„Und der Wind heulte und das Seil riss und sie fiel und die Nacht kam.“"],
            ["🟡 Asyndetischer Rausch", "8–25 Wörter", "Hektik, Flucht, Bewusstseinsstrom", "Parataktisch, verbkonzentriert", "„Er rannte, sprang, atmete, blickte, griff, fiel, stieg, sank.“"],
          ].map(([name, length, emotion, structure, example], i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{name}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>
                <strong>Länge:</strong> {length} | <strong>Emotion:</strong> {emotion}
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                <strong>Struktur:</strong> {structure}
              </div>
              <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", marginTop: 4, color: "var(--fg)" }}>
                {example}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-KONFIGURATIONEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {EXAMPLE_CONFIGS.map(([arch, emo, words], i) => (
            <button
              key={i}
              onClick={() => { setArchetype(arch); setEmotion(emo); setTargetWords(words); setSeed(i + 20); }}
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
              {ARCHETYPE_LABELS[arch]} – {emo} ({words} Wörter)
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}