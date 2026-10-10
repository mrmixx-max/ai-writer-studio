// LoreArchaeologyEngineModal (WP 86.1 UI)
import { useState, useMemo } from "react";
import {
  createArchaeologicalSite,
  generateArtifact,
  decipherInscription,
  createStratigraphy,
  generateEras,
  type Era,
} from "@/services/worldbuilding/loreArchaeologyEngine";

export interface LoreArchaeologyEngineModalProps {
  className?: string;
}

export function LoreArchaeologyEngineModal({ className }: LoreArchaeologyEngineModalProps) {
  const [siteName, setSiteName] = useState("Ruinen von Aelindor");
  const [seed, setSeed] = useState(42);
  const [x, setX] = useState(1250);
  const [y, setY] = useState(3400);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [inscriptionText, setInscriptionText] = useState("[König] Aelindor errichtete [dies] im Jahr [-2847] zum [Lobe] von [Solaris]");

  const site = useMemo(() => createArchaeologicalSite(siteName, seed, x, y), [siteName, seed, x, y]);
  const artifact = useMemo(() => generateArtifact(siteName, seed, selectedLayer), [siteName, seed, selectedLayer]);
  const deciphering = useMemo(() => decipherInscription(inscriptionText, seed), [inscriptionText, seed]);
  const eras = useMemo(() => generateEras(seed), [seed]);
  const stratigraphy = useMemo(() => createStratigraphy(siteName, seed, eras), [siteName, seed, eras]);

  return (
    <div
      className={className}
      data-testid="lore-archaeology-modal"
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
        🏛️ Narrative Lore-Archäologie & Schichten-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Koordinaten: ({x}, {y}) · Schichten: {stratigraphy.length}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Ort-Name
          <input value={siteName} onChange={e => setSiteName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          X
          <input type="number" value={x} onChange={e => setX(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Y
          <input type="number" value={y} onChange={e => setY(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📍 ARCHÄOLOGISCHE STÄTTE: {site.name}
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
          <div>ID: {site.id}</div>
          <div>Koordinaten: ({site.location.x}, {site.location.y})</div>
          <div>Aktuelle Epoche: {site.currentEra}</div>
          <div>Dominante Kultur: {site.dominantCulture}</div>
          <div>Mysteriums-Level: {site.mysteryLevel}/100</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 STRATIGRAPHIE ({stratigraphy.length} Schichten)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {stratigraphy.map((layer, i) => (
            <details
              key={i}
              open={selectedLayer === i}
              onToggle={() => setSelectedLayer(i)}
              style={{ border: `1px solid ${selectedLayer === i ? "var(--accent)" : "var(--border)"}`, borderRadius: 4, padding: 8, background: selectedLayer === i ? "var(--panel)" : "transparent" }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 700, color: selectedLayer === i ? "var(--accent)" : "var(--fg)" }}>
                Schicht {i + 1}: {layer.era} (Tiefe: {layer.depth.toFixed(1)}m, Dicke: {layer.thickness.toFixed(1)}m) — {layer.preservation}
              </summary>
              <div style={{ marginTop: 6, fontSize: 11 }}>
                <div><strong>Artefakte:</strong> {layer.artifacts.join(", ") || "—"}</div>
                <div><strong>Strukturen:</strong> {layer.structures.join(", ") || "—"}</div>
                <div><strong>Inschriften:</strong></div>
                {layer.inscriptions.map((ins, idx) => (
                  <div key={idx} style={{ marginLeft: 16, fontStyle: "italic", color: "var(--muted)" }}>
                    „{ins}“
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗿 ARTEFAKT AUS SCHICHT {selectedLayer + 1}
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
          <div><strong>Name:</strong> {artifact.name}</div>
          <div><strong>Epoche:</strong> {artifact.era}</div>
          <div><strong>Typ:</strong> {artifact.type}</div>
          <div><strong>Material:</strong> {artifact.material}</div>
          <div><strong>Zustand:</strong> {artifact.condition}</div>
          {artifact.repurposedFrom && (
            <>
              <div><strong>Ursprünglich:</strong> {artifact.repurposedFrom}</div>
              <div><strong>Umgewidmet zu:</strong> {artifact.repurposedTo}</div>
            </>
          )}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔍 INSKRIPTIONS-ENTSCHLÜSSELUNG
        </summary>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
            Rohtext:
            <textarea
              value={inscriptionText}
              onChange={e => setInscriptionText(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, fontFamily: "var(--font-mono)", minHeight: 60 }}
            />
          </label>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
            <div><strong>Rekonstruiert:</strong> {deciphering.reconstructed}</div>
            <div><strong>Konfidenz:</strong> {Math.round(deciphering.confidence * 100)}%</div>
            <div><strong>Sprache:</strong> {deciphering.language} ({deciphering.script})</div>
            {deciphering.gaps.length > 0 && (
              <>
                <div style={{ marginTop: 6 }}><strong>Lücken & Hypothesen:</strong></div>
                {deciphering.gaps.map((gap, idx) => (
                  <div key={idx} style={{ marginLeft: 16, color: "var(--muted)" }}>
                    [{gap.start}–{gap.end}] → „{gap.suggestion}“
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📚 EPOCHEN-ÜBERSICHT
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {eras.map((era: Era) => (
            <div key={era.name} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div><strong>{era.name}</strong> ({era.startYear} – {era.endYear})</div>
              <div>Kultur: {era.culture} | Tech: {era.techLevel}</div>
              <div>Materialien: {era.signatureMaterials.join(", ")}</div>
              <div>Strukturen: {era.typicalStructures.join(", ")}</div>
              <div>Schrift: {era.scriptStyle}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}