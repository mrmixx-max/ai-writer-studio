// LitRpgCombatLedgerModal (WP 135.2 UI / Meilenstein 65.0, v7.7.0)
import { useState, useMemo } from "react";
import {
  createSampleCombatant,
  createSampleBoss,
  simulateCombat,
  scanCombatForPlausibility,
  generateStatusWindow,
  createSeededRandom,
  type Combatant,
  type CombatResult,
} from "@/services/publishing/litRpgCombatLedger";

export interface LitRpgCombatLedgerModalProps {
  className?: string;
}

export function LitRpgCombatLedgerModal({ className }: LitRpgCombatLedgerModalProps) {
  const [heroLevel, setHeroLevel] = useState(15);
  const [enemyLevel, setEnemyLevel] = useState(12);
  const [isBoss, setIsBoss] = useState(false);
  const [maxRounds, setMaxRounds] = useState(30);
  const [seed, setSeed] = useState(42);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);

  const handleSimulate = () => {
    const hero = createSampleCombatant("hero", "Held", heroLevel);
    const enemy = isBoss
      ? createSampleBoss("enemy", "Boss", enemyLevel)
      : createSampleCombatant("enemy", "Gegner", enemyLevel);
    const rng = createSeededRandom(seed);
    const result = simulateCombat(hero, enemy, maxRounds, rng);
    setCombatResult(result);
    setCombatants([hero, enemy]);
  };

  const plausibility = useMemo(() => {
    if (!combatResult || combatants.length === 0) return null;
    return scanCombatForPlausibility(combatants, combatResult.rounds);
  }, [combatResult, combatants]);

  const heroStatus = useMemo(() => {
    const hero = combatants.find((c) => c.id === "hero");
    return hero ? generateStatusWindow(hero) : null;
  }, [combatants]);

  const enemyStatus = useMemo(() => {
    const enemy = combatants.find((c) => c.id === "enemy");
    return enemy ? generateStatusWindow(enemy) : null;
  }, [combatants]);

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
      data-testid="lit-rpg-combat-ledger-modal"
      style={{
        background: "var(--bg)", color: "var(--fg)", padding: 16,
        height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚔️ LitRPG-Kampfschaden-Ledger & Statusfenster
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Rundenbasierter Schadensrechner · Plausibilitäts-Scanner · Statusfenster
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Held Level: {heroLevel}
          <input type="range" min={1} max={100} value={heroLevel} onChange={(e) => setHeroLevel(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Gegner Level: {enemyLevel}
          <input type="range" min={1} max={100} value={enemyLevel} onChange={(e) => setEnemyLevel(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Runden: {maxRounds}
          <input type="range" min={5} max={100} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90 }}>
          Seed: {seed}
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={selectStyle} />
        </label>
        <label style={{ ...labelStyle, minWidth: 90, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={isBoss} onChange={(e) => setIsBoss(e.target.checked)} />
          Boss-Kampf
        </label>
        <button
          onClick={handleSimulate}
          style={{
            padding: "6px 16px", fontSize: 11, fontFamily: "var(--font-mono)",
            background: "var(--accent)", color: "var(--bg)", border: "none",
            borderRadius: 4, cursor: "pointer", fontWeight: 700,
          }}
        >
          ⚔️ Kampf simulieren
        </button>
      </div>

      {/* Status Windows */}
      {heroStatus && enemyStatus && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            📊 STATUSFENSTER
          </summary>
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[heroStatus, enemyStatus].map((status) => (
              <div key={status.name} style={{ ...panelStyle, flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>{status.name}</div>
                <div style={{ color: "var(--muted)" }}>Level {status.level}</div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span>HP</span>
                    <span>{status.hp}/{status.maxHp}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(status.hp / status.maxHp) * 100}%`, background: status.hpBarColor }} />
                  </div>
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span>MP</span>
                    <span>{status.mp}/{status.maxMp}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(status.mp / status.maxMp) * 100}%`, background: status.mpBarColor }} />
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
                  ATK: {status.attack} · DEF: {status.defense} · SPD: {status.speed}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  Crit: {(status.critChance * 100).toFixed(0)}% · Crit x{status.critMultiplier}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Combat Log */}
      {combatResult && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            📜 KAMPFPROTOKOLL
          </summary>
          <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto", ...panelStyle }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Sieger: {combatResult.winner === "hero" ? "Held" : combatResult.winner === "enemy" ? "Gegner" : "Unentschieden"}
            </div>
            {combatResult.rounds.map((round, i) => (
              <div key={i} style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>
                R{round.round}: {round.damage.description}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Plausibility */}
      {plausibility && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🔍 PLAUSIBILITÄTSSCANNER
          </summary>
          <div style={{ marginTop: 8, ...panelStyle }}>
            <div style={{ fontWeight: 700, color: plausibility.valid ? "var(--accent)" : "var(--fg)" }}>
              {plausibility.valid ? "✅ Kampf plausibel" : "❌ " + plausibility.issues.length + " Problem(e)"}
            </div>
            <div style={{ marginTop: 4 }}>Score: {plausibility.score}/100</div>
            {plausibility.issues.length > 0 && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {plausibility.issues.map((issue, i) => (
                  <li key={i} style={{ color: issue.severity === "error" ? "var(--accent)" : "var(--muted)" }}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default LitRpgCombatLedgerModal;
