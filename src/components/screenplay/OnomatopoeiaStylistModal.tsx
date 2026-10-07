// OnomatopoeiaStylistModal (WP 91.1 UI)
import { useState, useMemo } from "react";
import {
  createSFXProfile,
  formatSFXProfile,
  translateSFX,
  createSampleProfile as _createSampleProfile,
  createSampleTranslation as _createSampleTranslation,
  type SFXProfile as _SFXProfile,
  type SFXEntry as _SFXEntry,
  type SFXCategory as _SFXCategory,
} from "@/services/screenplay/onomatopoeiaStylist";

export interface OnomatopoeiaStylistModalProps {
  className?: string;
}

export function OnomatopoeiaStylistModal({ className }: OnomatopoeiaStylistModalProps) {
  const [comicName, setComicName] = useState("Action-Comic");
  const [seed, setSeed] = useState(42);
  const [showSVG, setShowSVG] = useState(false);

  const profile = useMemo(() => createSFXProfile(comicName, seed), [comicName, seed]);

  const CATEGORY_LABELS: Record<_SFXCategory, string> = {
    impact: "💥 Aufprall",
    explosion: "💣 Explosion",
    weapon: "⚔️ Waffe",
    movement: "🏃 Bewegung",
    environment: "🌍 Umgebung",
    biological: "🫀 Biologisch",
    mechanical: "⚙️ Mechanisch",
    magical: "✨ Magisch",
    ui: "🖥️ UI",
    emotional: "💓 Emotional",
  };

  return (
    <div
      className={className}
      data-testid="onomatopoeia-stylist-modal"
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
        🎭 Comic-Soundeffekt- & Onomatopoesie-Stylist
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id} · Kategorien: {profile.entries.length}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Comic / Projekt Name
          <input value={comicName} onChange={e => setComicName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          <input
            type="checkbox"
            checked={showSVG}
            onChange={e => setShowSVG(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          SVG-Pfade anzeigen
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-onomatopoeia-profil" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 ONOMATOPOESIE-PROFIL
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {formatSFXProfile(profile)}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-sfx-tabelle" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 SFX-TABELLE ({profile.entries.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          {profile.entries.map((entry, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: 140 }}>
                  {CATEGORY_LABELS[entry.category]}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", background: "var(--bg)", padding: "2px 6px", borderRadius: 3, minWidth: 80, textAlign: "center" }}>
                  {entry.western}
                </span>
                <span style={{ color: "var(--muted)", minWidth: 20 }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", background: "var(--bg)", padding: "2px 6px", borderRadius: 3, minWidth: 80, textAlign: "center" }}>
                  {entry.manga}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>
                  Intensität: {"★".repeat(entry.intensity)}{"☆".repeat(5 - entry.intensity)}
                </span>
              </div>
              {showSVG && entry.svgPath && (
                <div style={{ marginTop: 6, padding: 6, background: "var(--bg)", borderRadius: 3, fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", overflowX: "auto" }}>
                  SVG Path: {entry.svgPath}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-sfx-uebersetzung" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔄 SFX-ÜBERSETZUNG (Westlich ↔ Manga)
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
            Westliches SFX
            <input
              type="text"
              value={profile.entries[0]?.western || ""}
              onChange={e => {
                const _translated = translateSFX(e.target.value, "manga");
                // Just for demo display
              }}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
              placeholder="z.B. BAM"
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
            Manga SFX (Giongo/Gitaigo)
            <input
              type="text"
              value={profile.entries[0]?.manga || ""}
              readOnly
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)" }}
            />
          </label>
          <button
            onClick={() => {
              const t = translateSFX(profile.entries[0]?.western || "BAM", "manga");
              alert(`Manga: ${t}`);
            }}
            style={{ padding: "6px 12px", background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
          >
            Übersetzen →
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          Beispiel: <strong>BAM</strong> → <strong>ドーン (Doon)</strong> | 
          <strong>Thump-thump</strong> → <strong>ドキドキ (Doki-doki)</strong> | 
          <strong>SHING</strong> → <strong>シャキン (Shakin)</strong>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel-comics" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-COMICS
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "Action-Comic",
            "Manga-Shonen",
            "Western-Graphic-Novel",
            "Sci-Fi-Space-Opera",
            "Fantasy-Epic",
            "Horror-Mystery",
            "Slice-of-Life",
            "Superhero-Team-Up",
          ].map((name, i) => (
            <button
              key={i}
              onClick={() => { setComicName(name); setSeed(i + 10); }}
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
              {name}
            </button>
          ))}
        </div>
      </details>

      <details>
        <summary data-testid="summary-kategorien" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 KATEGORIEN & INTENSITÄTS-SKALA
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>10 Kategorien:</strong>
          </div>
          <div style={{ marginLeft: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <div>💥 Aufprall (Impact)</div>
            <div>💣 Explosion</div>
            <div>⚔️ Waffe</div>
            <div>🏃 Bewegung</div>
            <div>🌍 Umgebung</div>
            <div>🫀 Biologisch</div>
            <div>⚙️ Mechanisch</div>
            <div>✨ Magisch</div>
            <div>🖥️ UI</div>
            <div>💓 Emotional</div>
          </div>
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <strong>Intensität 1–5:</strong> 1=flüsterleise ... 5=Subwoofer-Schockwelle
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Westlich vs. Manga:</strong> Giongo (Geräusche) & Gitaigo (Zustände) für japanische Stimmigkeit.
          </div>
          <div>
            <strong>SVG-Schriftzug:</strong> Vektor-Pfade für dynamisch verzerrte Comic-Lettern.
          </div>
        </div>
      </details>
    </div>
  );
}