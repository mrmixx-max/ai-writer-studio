// LootRarityMatrixModal (WP 135.1 UI / Meilenstein 65.0, v7.7.0)
import { useState, useMemo } from "react";
import {
  RARITIES,
  ITEM_TEMPLATES,
  SET_BONUSES,
  rollRarity,
  generateLoot,
  calculateSetBonuses,
  generateItemTooltip,
  createSeededRandom,
  type Item,
  type RarityId,
} from "@/services/worldbuilding/lootRarityMatrix";

export interface LootRarityMatrixModalProps {
  className?: string;
}

export function LootRarityMatrixModal({ className }: LootRarityMatrixModalProps) {
  const [level, setLevel] = useState(10);
  const [seed, setSeed] = useState(42);
  const [lootResults, setLootResults] = useState(() => {
    const rng = createSeededRandom(42);
    return Array.from({ length: 5 }, () => generateLoot(10, rng));
  });
  const [equippedItems, setEquippedItems] = useState<Item[]>([]);

  const rng = useMemo(() => createSeededRandom(seed), [seed]);

  const handleRoll = () => {
    const newRng = createSeededRandom(seed);
    setLootResults(Array.from({ length: 5 }, () => generateLoot(level, newRng)));
  };

  const handleEquip = (item: Item) => {
    setEquippedItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.filter((i) => i.id !== item.id);
      return [...prev, item];
    });
  };

  const setBonuses = useMemo(() => calculateSetBonuses(equippedItems), [equippedItems]);

  const selectStyle: React.CSSProperties = {
    width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11,
    fontFamily: "var(--font-mono)", background: "var(--bg)", color: "var(--fg)",
    border: "1px solid var(--border)", borderRadius: 4,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 };
  const panelStyle: React.CSSProperties = {
    padding: 10, border: "1px solid var(--border)", borderRadius: 4,
    background: "var(--bg)", fontSize: 11, lineHeight: 1.7,
  };

  return (
    <div
      className={className}
      data-testid="loot-rarity-matrix-modal"
      style={{
        background: "var(--bg)", color: "var(--fg)", padding: 16,
        height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💎 Loot-Raritäts- & Artefakt-Ausrüstungs-Matrix
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Level {level} · Seed {seed} · {equippedItems.length} Items ausgerüstet
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Level: {level}
          <input type="range" min={1} max={100} value={level} onChange={(e) => setLevel(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Seed: {seed}
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={selectStyle} />
        </label>
        <button
          onClick={handleRoll}
          style={{
            padding: "6px 16px", fontSize: 11, fontFamily: "var(--font-mono)",
            background: "var(--accent)", color: "var(--bg)", border: "none",
            borderRadius: 4, cursor: "pointer", fontWeight: 700,
          }}
        >
          🎲 Roll Loot
        </button>
      </div>

      {/* Loot Results */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 LOOT-ERGEBNISSE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {lootResults.map((loot, i) => {
            const rarity = RARITIES.find((r) => r.id === loot.rolledRarity) ?? RARITIES[0];
            const tooltip = generateItemTooltip(loot.item);
            return (
              <div
                key={i}
                style={{
                  ...panelStyle,
                  border: `2px solid ${rarity.color}`,
                  boxShadow: `0 0 8px ${rarity.glowColor}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, color: rarity.color }}>
                    {loot.item.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {rarity.name} · Lv.{loot.item.level}
                  </div>
                </div>
                <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(loot.rolledStats).map(([stat, value]) => (
                    <span key={stat} style={{ fontSize: 10, color: "var(--muted)" }}>
                      {stat}: <strong style={{ color: "var(--fg)" }}>{value}</strong>
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                  {loot.item.flavorText}
                </div>
                <div style={{ marginTop: 4 }}>
                  <button
                    onClick={() => handleEquip(loot.item)}
                    style={{
                      padding: "2px 8px", fontSize: 10, fontFamily: "var(--font-mono)",
                      background: equippedItems.some((i) => i.id === loot.item.id) ? "var(--accent)" : "var(--bg)",
                      color: equippedItems.some((i) => i.id === loot.item.id) ? "var(--bg)" : "var(--fg)",
                      border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                    }}
                  >
                    {equippedItems.some((i) => i.id === loot.item.id) ? "✓ Ausgerüstet" : "Ausrüsten"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Equipped Items & Set Bonuses */}
      <details open style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ AUSRÜSTUNG & SET-BONI
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          {equippedItems.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>Keine Items ausgerüstet. Klicke auf "Ausrüsten" bei einem Loot-Ergebnis.</div>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Ausgerüstet:</div>
              {equippedItems.map((item) => {
                const rarity = RARITIES.find((r) => r.id === item.rarity) ?? RARITIES[0];
                return (
                  <div key={item.id} style={{ color: rarity.color, fontSize: 10 }}>
                    {item.name} ({rarity.name})
                  </div>
                );
              })}
              <div style={{ fontWeight: 700, margin: "8px 0 4px" }}>Set-Boni:</div>
              {setBonuses.filter((s) => s.piecesWorn > 0).map((s) => (
                <div key={s.setName} style={{ fontSize: 10, color: s.bonusActive ? "var(--accent)" : "var(--muted)" }}>
                  {s.setName}: {s.piecesWorn}/2 {s.bonusActive ? "✅" : ""}
                </div>
              ))}
            </>
          )}
        </div>
      </details>

      {/* Rarity Overview */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💎 RARITÄTSSTUFEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {RARITIES.map((rarity) => (
            <div
              key={rarity.id}
              style={{
                ...panelStyle,
                border: `2px solid ${rarity.color}`,
                boxShadow: `0 0 6px ${rarity.glowColor}`,
              }}
            >
              <div style={{ fontWeight: 700, color: rarity.color }}>{rarity.name}</div>
              <div style={{ color: "var(--muted)" }}>Drop Chance: {(rarity.dropChance * 100).toFixed(0)}% · Stat Multiplier: {rarity.statMultiplier}x</div>
              <div style={{ color: "var(--muted)" }}>{rarity.description}</div>
            </div>
          ))}
        </div>
      </details>

      {/* Item Templates */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📦 ITEM-TEMPLATES
        </summary>
        <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto", ...panelStyle }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "var(--muted)" }}>
                <th style={{ textAlign: "left", padding: "2px 8px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "2px 8px" }}>Slot</th>
                <th style={{ textAlign: "left", padding: "2px 8px" }}>Rarität</th>
                <th style={{ textAlign: "right", padding: "2px 8px" }}>Level</th>
              </tr>
            </thead>
            <tbody>
              {ITEM_TEMPLATES.map((item) => {
                const rarity = RARITIES.find((r) => r.id === item.rarity) ?? RARITIES[0];
                return (
                  <tr key={item.id}>
                    <td style={{ padding: "2px 8px" }}>{item.name}</td>
                    <td style={{ padding: "2px 8px", color: "var(--muted)" }}>{item.slot}</td>
                    <td style={{ padding: "2px 8px", color: rarity.color }}>{rarity.name}</td>
                    <td style={{ padding: "2px 8px", textAlign: "right" }}>{item.level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default LootRarityMatrixModal;
