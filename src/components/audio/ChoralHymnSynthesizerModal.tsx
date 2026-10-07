// ChoralHymnSynthesizerModal (WP 92.2 UI)
import { useState, useMemo } from "react";
import {
  createHymnProfile,
  formatHymnProfile,
  generateAudioPreview,
  createSampleProfile as _createSampleProfile,
  createSampleAntiphonal as _createSampleAntiphonal,
  type HymnProfile as _HymnProfile,
  type HymnType,
} from "@/services/audio/choralHymnSynthesizer";

export interface ChoralHymnSynthesizerModalProps {
  className?: string;
}

export function ChoralHymnSynthesizerModal({ className }: ChoralHymnSynthesizerModalProps) {
  const [hymnName, setHymnName] = useState("Eiserner Marsch");
  const [hymnType, setHymnType] = useState<HymnType>("march");
  const [seed, setSeed] = useState(42);
  const [showAudio, setShowAudio] = useState(false);

  const profile = useMemo(() => createHymnProfile(hymnName, hymnType, seed), [hymnName, hymnType, seed]);
  const audioPreview = useMemo(() => generateAudioPreview(profile), [profile]);

  const TYPE_LABELS: Record<HymnType, string> = {
    battle: "⚔️ Schlachthymne",
    march: "🥁 Marschlied",
    funeral: "⚰️ Trauergesang",
    victory: "🏆 Siegeshymne",
    antiphonal: "🎵 Antiphonaler Wechselgesang",
    liturgical: "⛪ Liturgischer Choral",
  };

  return (
    <div
      className={className}
      data-testid="choral-hymn-modal"
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
        🎵 Schlachtruf-, Choral- & Hymnen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · {profile.lines.length} Zeilen
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Hymnen-Name
          <input value={hymnName} onChange={e => setHymnName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Typ
          <select value={hymnType} onChange={e => setHymnType(e.target.value as HymnType)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="battle">⚔️ Schlachthymne</option>
            <option value="march">🥁 Marschlied</option>
            <option value="funeral">⚰️ Trauergesang</option>
            <option value="victory">🏆 Siegeshymne</option>
            <option value="antiphonal">🎵 Antiphonaler Wechselgesang</option>
            <option value="liturgical">⛪ Liturgischer Choral</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          <input
            type="checkbox"
            checked={showAudio}
            onChange={e => setShowAudio(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Audio-Vorschau
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-hymn-profil" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎵 HYMNEN-PROFIL
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {formatHymnProfile(profile)}
        </pre>
      </details>

      {showAudio && (
        <details style={{ marginBottom: 12 }}>
          <summary data-testid="summary-audio-vorschau" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🎵 AUDIO-VORSCHAU (WEB AUDIO)
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Soloist Frequenzen:</strong> {audioPreview.soloistFreq.map(f => f.toFixed(1)).join(", ")} Hz
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Chor Frequenzen:</strong> {audioPreview.choirFreq.map(f => f.toFixed(1)).join(", ")} Hz
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Dauer:</strong> {audioPreview.duration.toFixed(1)}s | BPM: {profile.bpm} | Modus: {profile.mode}
            </div>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 10, color: "var(--muted)" }}>
              Hinweis: Frequenzen basieren auf Kirchenmodus ({profile.mode}) und BPM. Echte WebAudio-Synthese im Produktivmodus.
            </div>
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-hymnen-typen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 HYMNEN-TYPEN & BPM-BEREICHE
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10 }}>
          {[
            ["⚔️ Schlachthymne", "100-140 BPM", "4/4", "dorian/aeolian"],
            ["🥁 Marschlied", "110-130 BPM", "2/4", "mixolydian/ionian"],
            ["⚰️ Trauergesang", "50-70 BPM", "3/4", "aeolian/phrygian"],
            ["🏆 Siegeshymne", "90-120 BPM", "4/4", "ionian/mixolydian"],
            ["🎵 Antiphonaler Wechsel", "70-100 BPM", "4/4", "dorian/mixolydian"],
            ["⛪ Liturgischer Choral", "60-80 BPM", "3/4", "phrygian/aeolian"],
          ].map(([name, bpm, sig, mode], i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{name}</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>{bpm} | {sig} | {mode}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel-hymnen" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-HYMNEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["Eiserner Marsch", "march"],
            ["Blut & Eisen", "battle"],
            ["Letzter Gang", "funeral"],
            ["Sieg der Könige", "victory"],
            ["Wache der Ewigkeit", "antiphonal"],
            ["Morgengrauen-Messe", "liturgical"],
          ].map(([name, type], i) => (
            <button
              key={i}
              onClick={() => { setHymnName(name); setHymnType(type as any); setSeed(i + 10); }}
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
              {name} ({TYPE_LABELS[type as HymnType]})
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-kirchenmodi" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎼 KIRCHENMODI & FREQUENZEN
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <div>🎵 Dorisch (D) - 293.66 Hz - heroisch, ernst</div>
            <div>🎵 Äolisch (E) - 329.63 Hz - melancholisch, weich</div>
            <div>🎵 Phrigisch (C) - 261.63 Hz - exotisch, spannungsvoll</div>
            <div>🎵 Mixolydisch (F) - 349.23 Hz - hell, volkstümlich</div>
            <div>🎵 Ionisch (G) - 392.00 Hz - strahlend, triumphierend</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: "var(--muted)" }}>
            Basisfrequenz wird für Soloist/Chor-Töne verwendet. Modus wählbar pro Hymne.
          </div>
        </div>
      </details>

      <details>
        <summary data-testid="summary-antiphonal" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎵 ANTIPHONALER WECHSELGESANG
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Struktur:</strong> Vorsänger (Solo) → Chor (Tutti) → Vorsänger → Chor ...
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Beispiel:</strong>
          </div>
          <div style={{ marginLeft: 16, fontFamily: "var(--font-mono)", fontSize: 9, lineHeight: 1.8 }}>
            🎤 "Wer hält die Furt, wenn der Wall zerbricht?"<br/>
            🎭 "Unser Stahl und das ewige Licht!"<br/>
            🎤 "Wer steht im Feuer, wenn der Stahl erklingt?"<br/>
            🎭 "Unser Blut für das heilige Recht!"
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: "var(--muted)" }}>
            Ideal für Schlachtfeld-Chöre, Ordens-Rituale, Freiheitsgesänge.
          </div>
        </div>
      </details>
    </div>
  );
}