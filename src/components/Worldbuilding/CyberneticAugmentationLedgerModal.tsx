// CyberneticAugmentationLedgerModal (WP 112.2 UI)
import { useState, useMemo } from "react";
import {
  calculateAugmentationProfile,
  generateGlitchProse,
  analyzeCyberware,
  AUGMENTATION_SLOTS,
  type AugmentationSlotId,
} from "@/services/worldbuilding/cyberneticAugmentationLedger";

export interface CyberneticAugmentationLedgerModalProps {
  className?: string;
}

export function CyberneticAugmentationLedgerModal({ className }: CyberneticAugmentationLedgerModalProps) {
  const [selectedSlots, setSelectedSlots] = useState<AugmentationSlotId[]>(["neural", "optics", "limbs"]);
  const [seed, setSeed] = useState(42);

  const profile = useMemo(() => calculateAugmentationProfile(selectedSlots, seed), [selectedSlots, seed]);
  const glitchProse = useMemo(() => generateGlitchProse(3, seed), [seed]);
  const report = useMemo(() => analyzeCyberware(selectedSlots, seed), [selectedSlots, seed]);

  const toggleSlot = (id: AugmentationSlotId) => {
    setSelectedSlots((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div
      className={className}
      data-testid="cybernetic-augmentation-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🦾 Cyberware- &amp; Transhumanismus-Hauptbuch
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {profile.installed.length} Slots · {profile.totalPowerDraw} W · Dissipation {profile.dissociationIndex}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
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
          🔧 AUGMENTIERUNGS-SLOTS
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {AUGMENTATION_SLOTS.map((slot) => (
            <label
              key={slot.id}
              style={{
                padding: 8,
                border: `1px solid ${selectedSlots.includes(slot.id) ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                background: "var(--panel)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={selectedSlots.includes(slot.id)}
                onChange={() => toggleSlot(slot.id)}
                style={{ accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontWeight: 700, color: selectedSlots.includes(slot.id) ? "var(--accent)" : "var(--fg)" }}>
                  {slot.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{slot.description}</div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                  {slot.powerDraw} W · Bio-Kompatibilität {slot.bioCompatibility} · Menschlichkeitsverlust {slot.humanityLoss}
                </div>
              </div>
            </label>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 MENSCHLICHKEITSVERLUST- &amp; DISSOCIATIONS-INDEX
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Gesamtenergieverbrauch:</strong> {profile.totalPowerDraw} W</div>
          <div><strong>Ø Bio-Kompatibilität:</strong> {profile.avgBioCompatibility}</div>
          <div><strong>Kumulierter Menschlichkeitsverlust:</strong> {profile.totalHumanityLoss}</div>
          <div><strong>Ø Phantomschmerz:</strong> {profile.avgPhantomPain}</div>
          <div><strong>Ø Medikamentenabhängigkeit:</strong> {profile.avgDrugDependency}</div>
          <div style={{ marginTop: 4, fontWeight: 700, color: profile.dissociationIndex > 0.5 ? "var(--error)" : "var(--accent)" }}>
            Dissoziations-Index: {profile.dissociationIndex}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{report.medicationSchedule}</div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👁️ GLITCH- &amp; HUD-PROSA
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.7 }}>
          {glitchProse}
        </pre>
      </details>
    </div>
  );
}
