// AlliterativeKenningWeaverModal (WP 97.1 UI)
import { useState, useMemo } from "react";
import {
  createAlliterativeKenningProfile,
  createSampleProfile,
} from "@/services/ai/alliterativeKenningWeaver";

export interface AlliterativeKenningWeaverModalProps {
  className?: string;
}

export function AlliterativeKenningWeaverModal({ className }: AlliterativeKenningWeaverModalProps) {
  const [theme, setTheme] = useState<"war" | "kingship" | "ships" | "death" | "love" | "nature" | "fate">("war");
  const [seed, setSeed] = useState(777);

  const profile = useMemo(
    () => createAlliterativeKenningProfile(theme, seed),
    [theme, seed]
  );

  const THEME_LABELS: Record<string, string> = {
    war: "⚔️ Krieg & Schlacht",
    kingship: "👑 Königtum & Thron",
    ships: "⛵ Schiffe & Meer",
    death: "💀 Tod & Jenseits",
    love: "💘 Liebe & Treue",
    nature: "🌲 Natur & Elemente",
    fate: "🧵 Schicksal & Nornen",
  };

  const THEME_EMOJIS: Record<string, string> = {
    war: "⚔️",
    kingship: "👑",
    ships: "⛵",
    death: "💀",
    love: "💘",
    nature: "🌲",
    fate: "🧵",
  };

  return (
    <div className={className} data-testid="alliterative-kenning-modal" style={{ padding: 16, maxWidth: 720, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        {THEME_EMOJIS[theme]} Stabreim- & Altnordischer Kenning-Weaver
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>Thema</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            style={{ width: "100%", padding: "6px 8px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
          >
            {Object.entries(THEME_LABELS).map(([key, label]) => (
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
            setTheme(sample.theme);
            setSeed(sample.seed);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Kriegs-Kenningar laden
        </button>
      </details>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          Generierte Kenningar & Verse (ID: {profile.id})
        </h3>

        <details open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            📜 KENNINGAR ({profile.kennings.length})
          </summary>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {profile.kennings.map((kenning, i) => (
              <div key={i} style={{ padding: 6, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 10 }}>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>{kenning.kenning}</div>
                <div style={{ color: "var(--muted)" }}>für: {kenning.baseConcept}</div>
                <div style={{ color: "var(--muted)" }}>Alliteration: {kenning.alliteration}</div>
                <div style={{ color: "var(--muted)" }}>Bestandteile: {kenning.components.join(" + ")}</div>
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            📝 STABREIM-VERSE ({profile.alliterativeVerses.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            {profile.alliterativeVerses.map((verse, i) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg)" }}>
                  {verse.firstHalf} <span style={{ color: "var(--accent)" }}>||</span> {verse.secondHalf}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)" }}>
                  Alliteration: {verse.alliteration} | Metrum: {verse.stressPattern}
                </div>
              </div>
            ))}
          </div>
        </details>

        <details style={{ marginTop: 12 }} open>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            🗣️ REDEN & SCHWÜRE ({profile.speeches.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            {profile.speeches.map((speech, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
                  {speech.title} ({speech.type})
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                  {speech.lines.map((line, li) => (
                    <div key={li}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          📚 THEORETISCHER HINTERGRUND: STABREIM & KENNINGAR
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "var(--muted)" }}>
          <p><strong>Stabreim (Alliteration)</strong> ist das zentrale Strukturprinzip altgermanischer Dichtung (Beowulf, Edda, Hildebrandslied). Jede Zeile hat eine Zäsur (Schnitt), mit zwei alliterierenden Hebungen vor und einer tragenden nach der Zäsur.</p>
          <p><strong>Kenningar</strong> sind bildhafte Umschreibungen aus zwei Begriffen (Basis + Bestimmung): "Walfisch-Straße" = Meer, "Wunden-Tau" = Blut, "Schlacht-Schweiß" = Blut. Sie verdichten Bedeutung und erzeugen mythische Tiefe.</p>
          <p><strong>Vier Redetypen:</strong> Grabrede (Ehrung), Kriegereid (Bindung), Weissagung (Nornen-Weisheit), Lobpreis (Ruhm).</p>
          <p><strong>Literarische Vorbilder:</strong> Beowulf, Snorri Sturluson (Edda), Tolkien (Rohirrim-Lieder), Wagner (Ring des Nibelungen).</p>
        </div>
      </details>
    </div>
  );
}