// OlfactoryAromaWeaverModal (WP 90.1 UI)
import { useState, useMemo } from "react";
import {
  createAromaProfile,
  formatAromaProfile,
  createSampleProfile as _createSampleProfile,
  type AromaProfile as _AromaProfile,
} from "@/services/linguistics/olfactoryAromaWeaver";

export interface OlfactoryAromaWeaverModalProps {
  className?: string;
}

export function OlfactoryAromaWeaverModal({ className }: OlfactoryAromaWeaverModalProps) {
  const [location, setLocation] = useState("mittelalterliche Apotheke");
  const [seed, setSeed] = useState(42);

  const profile = useMemo(() => createAromaProfile(location, seed), [location, seed]);

  return (
    <div
      className={className}
      data-testid="olfactory-aroma-modal"
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
        👃 Olfaktorischer Aroma- & Duft-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {profile.id}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Ort / Schauplatz
          <input value={location} onChange={e => setLocation(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary data-testid="summary-aroma-profil" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👃 AROMA-PROFIL
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {formatAromaProfile(profile)}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-beispiel-orte" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-ORTE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "mittelalterliche Apotheke",
            "Schmiede bei Nacht",
            "verlassener Kerker",
            "blühender Kräutergarten",
            "Küstendorf bei Ebbe",
            "Taverne am Hafen",
            "königliche Bibliothek",
            "Schlachtfeld nach dem Regen",
            "Hexenhütte im Moor",
            "Weinkeller unter der Stadt",
          ].map((loc, i) => (
            <button
              key={i}
              onClick={() => { setLocation(loc); setSeed(i + 1); }}
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
              {loc}
            </button>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary data-testid="summary-duft-oktaven" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 8 DUFT-OKTAVEN ERKLÄRUNG
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div><strong>🌲 Harzig/Balsamisch:</strong> Harz, Weihrauch, Myrrhe, Balsam, Kiefernnadeln</div>
          <div><strong>⚡ Metallisch/Ozon:</strong> Ozon, Blut, Eisen, Kupfer, Gewitterluft, Schmiedefeuer</div>
          <div><strong>💀 Verwesung/Fäulnis:</strong> Moder, Fäulnis, Schwefel, Kadaver, Schimmel, Sumpf</div>
          <div><strong>🌍 Erde/Petrichor:</strong> Petrichor, feuchte Erde, Moos, Pilze, Wurzeln, Torf</div>
          <div><strong>🦌 Animalisch/Moschus:</strong> Moschus, Zibet, Ambra, Leder, Schweiß, Fell, Stall</div>
          <div><strong>🌶️ Scharf/Gewürzt:</strong> Zimt, Nelke, Pfeffer, Kardamom, Safran, Ingwer</div>
          <div><strong>🔥 Rauchig/Asche:</strong> Rauch, Asche, Teer, Holzkohle, verbranntes Haar, Pech</div>
          <div><strong>🍺 Gärung/Hefe:</strong> Hefe, Bier, Essig, Sauerkraut, Käse, überreife Früchte</div>
        </div>
      </details>

      <details>
        <summary data-testid="summary-proust" style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧠 ERINNERUNGS-ANKER (PROUST-PHÄNOMEN)
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          Der Geruchssinn hat die stärkste neuronale Verbindung zum limbischen System.
          Ein Duft kann augenblicklich lebhafte Kindheitserinnerungen triggern –
          ideal für Charaktertiefe und emotionale Szenen.
        </div>
      </details>
    </div>
  );
}