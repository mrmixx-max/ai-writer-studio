// ArmorMetallurgySimulatorModal (WP 122.1 UI / Meilenstein 59.0, v7.1.0)
import { useState, useMemo } from "react";
import {
  ARMOR_LAYERS,
  WEAPON_TYPES,
  simulateHit,
  generateCombatProse,
  createSampleArmorLayer,
  createSampleWeapon,
  type ArmorLayerId,
  type WeaponTypeId,
} from "@/services/worldbuilding/armorMetallurgySimulator";

export interface ArmorMetallurgySimulatorModalProps {
  className?: string;
}

export function ArmorMetallurgySimulatorModal({ className }: ArmorMetallurgySimulatorModalProps) {
  const [armorId, setArmorId] = useState<ArmorLayerId>(() => createSampleArmorLayer().id as ArmorLayerId);
  const [weaponId, setWeaponId] = useState<WeaponTypeId>(() => createSampleWeapon().id as WeaponTypeId);
  const [seed, setSeed] = useState(42);

  const hit = useMemo(() => simulateHit(weaponId, armorId, seed), [weaponId, armorId, seed]);
  const prose = useMemo(() => generateCombatProse(weaponId, armorId, seed), [weaponId, armorId, seed]);

  const armor = useMemo(() => ARMOR_LAYERS.find((a) => a.id === armorId) ?? createSampleArmorLayer(), [armorId]);
  const weapon = useMemo(() => WEAPON_TYPES.find((w) => w.id === weaponId) ?? createSampleWeapon(), [weaponId]);

  const selectStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 4,
    padding: "4px 8px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 };

  const panelStyle: React.CSSProperties = {
    padding: 10,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--bg)",
    fontSize: 11,
    lineHeight: 1.7,
  };

  return (
    <div
      className={className}
      data-testid="armor-metallurgy-modal"
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
        ⚔️ Rüstungs-Metallurgie &amp; Penetrations-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {weapon.name} gegen {armor.name} · Seed {seed} · {hit.penetrated ? "Durchschlag" : "Abgewehrt"}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={labelStyle}>
          Rüstungsschicht
          <select
            value={armorId}
            onChange={(e) => setArmorId(e.target.value as ArmorLayerId)}
            style={selectStyle}
          >
            {ARMOR_LAYERS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (Härte {a.hardness})
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Waffe
          <select
            value={weaponId}
            onChange={(e) => setWeaponId(e.target.value as WeaponTypeId)}
            style={selectStyle}
          >
            {WEAPON_TYPES.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} (Pen {w.penetration} / Wucht {w.force})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 90 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={selectStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ TREFFER-MATRIX
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={panelStyle}>
            <div style={{ fontWeight: 700, color: hit.penetrated ? "var(--accent)" : "var(--fg)" }}>
              {hit.penetrated ? "DURCHSCHLAG" : "ABGEWEHRT"}
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Schaden:</strong> {hit.damage}/10 · <strong>Wirksamkeit:</strong>{" "}
              {Math.round(hit.effectiveness * 100)} %
            </div>
            <div style={{ marginTop: 4 }}>{hit.description}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ color: "var(--muted)" }}>
              <strong style={{ color: "var(--fg)" }}>{weapon.name}:</strong> {weapon.description}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>
              <strong style={{ color: "var(--fg)" }}>{armor.name}:</strong> {armor.description}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>
              <strong style={{ color: "var(--fg)" }}>Zielzone:</strong> {weapon.targetArea} ·{" "}
              <strong style={{ color: "var(--fg)" }}>Abdeckung:</strong>{" "}
              {Math.round(armor.coverage * 100)} % ·{" "}
              <strong style={{ color: "var(--fg)" }}>Gewicht:</strong> {armor.weight}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🩸 KAMPF-PROSA
        </summary>
        <div style={{ ...panelStyle, marginTop: 8, whiteSpace: "pre-wrap" }}>{prose}</div>
      </details>
    </div>
  );
}

export default ArmorMetallurgySimulatorModal;
