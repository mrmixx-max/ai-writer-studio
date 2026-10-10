// MythicBeastAnatomyModal (WP 98.2 UI)
import { useState, useMemo } from "react";
import {
  createMythicBeast,
  createSampleMythicBeast,
  HABITATS,
  type HabitatId,
} from "@/services/worldbuilding/mythicBeastAnatomy";

export interface MythicBeastAnatomyModalProps {
  className?: string;
}

export function MythicBeastAnatomyModal({ className }: MythicBeastAnatomyModalProps) {
  const [name, setName] = useState("Nachtgreif");
  const [habitat, setHabitat] = useState<HabitatId>("highMountain");
  const [seed, setSeed] = useState(42);

  const beast = useMemo(() => createMythicBeast(name, habitat, seed), [name, habitat, seed]);

  return (
    <div
      className={className}
      data-testid="mythic-beast-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🐉 Mythologisches Bestiarium &amp; Anatomie-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Bestie {beast.id} · Seed {seed}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Kreaturname
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Lebensraum
          <select
            value={habitat}
            onChange={(e) => setHabitat(e.target.value as HabitatId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {HABITATS.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
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
          🦴 BIOLOGISCHE ADAPTION — {beast.habitat.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Umgebung:</strong> Druck {beast.habitat.pressure} · Licht {beast.habitat.light} · {beast.habitat.temperature}</div>
          <div><strong>Knochenbau:</strong> {beast.skeletal.boneStructure}</div>
          <div><strong>Sinnesmerkmal:</strong> {beast.skeletal.sense}</div>
          <div><strong>Nahrung:</strong> {beast.skeletal.diet}</div>
          <div><strong>Anpassung:</strong> {beast.skeletal.adaptation}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🕯️ MITTELALTERLICHER VOLKSGLAUBE ({beast.folkBeliefs.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {beast.folkBeliefs.map((b, i) => (
            <div key={i} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ fontStyle: "italic" }}>„{b.claim}“</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>— {b.region}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📓 NATURFORSCHER-TAGEBUCH ({beast.fieldJournal.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {beast.fieldJournal.map((e) => (
            <div key={e.entryNo} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent)", fontWeight: 700 }}>
                <span>Eintrag {e.entryNo}</span>
                <span>{e.date}</span>
              </div>
              <div style={{ marginTop: 4 }}>{e.observation}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{e.measurement}</div>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <button
          onClick={() => {
            const b = createSampleMythicBeast();
            setName(b.name);
            setHabitat(b.habitat.id);
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          Beispiel: Nachtgreif im Hochgebirge laden
        </button>
      </details>
    </div>
  );
}
