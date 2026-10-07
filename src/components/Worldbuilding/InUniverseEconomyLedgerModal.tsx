// InUniverseEconomyLedgerModal (WP 90.2 UI)
import { useState, useMemo } from "react";
import {
  createEconomyLedger,
  formatLedger,
  createSampleLedger as _createSampleLedger,
  createSampleInflationLedger as _createSampleInflationLedger,
  type EconomyLedger as _EconomyLedger,
} from "@/services/worldbuilding/inUniverseEconomyLedger";

export interface InUniverseEconomyLedgerModalProps {
  className?: string;
}

export function InUniverseEconomyLedgerModal({ className }: InUniverseEconomyLedgerModalProps) {
  const [currencyType, setCurrencyType] = useState<"fantasy" | "scifi" | "historical">("fantasy");
  const [seed, setSeed] = useState(42);
  const [inflationRate, setInflationRate] = useState(0);

  const ledger = useMemo(() => createEconomyLedger(currencyType, seed, inflationRate), [currencyType, seed, inflationRate]);

  return (
    <div
      className={className}
      data-testid="economy-ledger-modal"
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
        💰 In-Universe Währungs- & Kaufkraft-Hauptbuch
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Währung: {ledger.currency.name} · Inflation: {ledger.inflationRate}%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Währungssystem
          <select value={currencyType} onChange={e => setCurrencyType(e.target.value as "fantasy" | "scifi" | "historical")} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="fantasy">🏰 Fantasy (Gold/Silber/Kupfer)</option>
            <option value="scifi">🚀 Sci-Fi (Credits)</option>
            <option value="historical">📜 Historisch (Gulden/Kreuzer/Pfennig)</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Inflation (%)
          <input type="number" value={inflationRate} onChange={e => setInflationRate(Math.max(0, Number(e.target.value) || 0))} min="0" max="1000" step="10" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => { setCurrencyType("fantasy"); setSeed(42); setInflationRate(0); }} style={{ padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontSize: 10 }}>Normal</button>
        <button onClick={() => { setCurrencyType("fantasy"); setSeed(1); setInflationRate(150); }} style={{ padding: "6px 12px", background: "var(--warn)", border: "1px solid var(--warn)", borderRadius: 4, cursor: "pointer", color: "var(--bg)", fontSize: 10 }}>Belagerung (150% Inflation)</button>
        <button onClick={() => { setCurrencyType("scifi"); setSeed(2); setInflationRate(0); }} style={{ padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontSize: 10 }}>Sci-Fi</button>
        <button onClick={() => { setCurrencyType("historical"); setSeed(3); setInflationRate(0); }} style={{ padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontSize: 10 }}>Historisch</button>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          💰 VOLLSTÄNDIGES HAUPBUCH
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 500, overflow: "auto" }}>
          {formatLedger(ledger)}
        </pre>
      </details>

      {!ledger.plausibility.valid && (
        <details style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--error)", cursor: "pointer", fontWeight: 700 }}>
            ⚠️ PLAUSIBILITÄTS-WARNUNGEN ({ledger.plausibility.issues.length})
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {ledger.plausibility.issues.map((issue, i) => (
              <div key={i} style={{ padding: 8, border: "1px solid var(--error)", borderRadius: 4, background: "rgba(255,0,0,0.05)", fontSize: 10 }}>
                {issue}
              </div>
            ))}
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 PREIS-ÜBERSICHT
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
          {["food", "lodging", "wages", "equipment", "transport"].map(cat => {
            const items = ledger.prices.filter(p => p.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
                <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase" }}>
                  {cat}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {items.slice(0, 8).map(item => {
                    const gold = ledger.currency.tiers[0];
                    const inGold = (item.price / gold.valueInBase).toFixed(2);
                    return (
                      <span key={item.item} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{item.item} ({item.unit})</span>
                        <span>{item.price} {ledger.currency.baseUnit} (~{inGold} {gold.name})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 ANWENDUNG & PLAUSIBILITÄTS-REGELN
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Plausibilitäts-Prüfungen:</strong>
          </div>
          <div style={{ marginLeft: 16, marginBottom: 4 }}>{"• Brot < 1/3 Tageslohn"}</div>
          <div style={{ marginLeft: 16, marginBottom: 4 }}>{"• Einfaches Gasthof < 1/2 Tageslohn"}</div>
          <div style={{ marginLeft: 16, marginBottom: 4 }}>{"• Reitpferd < 5 Jahre Lohn"}</div>
          <div style={{ marginLeft: 16, marginBottom: 8 }}>{"• Plattenrüstung < 10 Jahre Lohn"}</div>
          <div style={{ marginBottom: 8 }}>
            <strong>Inflation:</strong> Simuliert Belagerungs-/Kriegswirtschaft. Preise steigen exponentiell.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Währungssysteme:</strong> Fantasy (Gold/Silber/Kupfer), Sci-Fi (Credits), Historisch (Gulden/Kreuzer/Pfennig).
          </div>
          <div>
            <strong>Export:</strong> Hauptbuch als Text für Worldbuilding-Dokumentation kopierbar.
          </div>
        </div>
      </details>
    </div>
  );
}