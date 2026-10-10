// HeraldicBlazonStudioModal (WP 88.1 UI)
import { useState, useMemo } from "react";
import {
  createCoatOfArms,
  validateTinctureRule,
  createSampleCoatOfArms as _createSampleCoatOfArms,
  createSampleBlazoning as _createSampleBlazoning,
  type CoatOfArms as _CoatOfArms,
  type Tincture as _Tincture,
} from "@/services/worldbuilding/heraldicBlazonStudio";

export interface HeraldicBlazonStudioModalProps {
  className?: string;
}

export function HeraldicBlazonStudioModal({ className }: HeraldicBlazonStudioModalProps) {
  const [houseName, setHouseName] = useState("Haus Falkenstein");
  const [seed, setSeed] = useState(42);
  const [showValidation, _setShowValidation] = useState(true);

  const coa = useMemo(() => createCoatOfArms(houseName, seed), [houseName, seed]);
  const validation = useMemo(() => {
    const results = [];
    for (const charge of coa.charges) {
      const valid = validateTinctureRule(coa.fieldTincture, charge.tincture);
      results.push({ charge: charge.charge, valid, tincture: charge.tincture });
    }
    return results;
  }, [coa]);

  return (
    <div
      className={className}
      data-testid="heraldic-blazon-modal"
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
        🛡️ Heraldisches Wappen- & Blasonierungs-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {coa.id} · Felder: {coa.fieldTincture}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Hausname
          <input value={houseName} onChange={e => setHouseName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🛡️ WAPPENSCHILD
        </summary>
        <div style={{ marginTop: 8, padding: 12, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", minHeight: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>Feld: {coa.fieldTincture} ({coa.division || "ungeteilt"})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {coa.charges.map((c, i) => (
              <div key={i} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", fontSize: 10 }}>
                {c.charge} in {c.tincture} {c.position ? `(${c.position})` : ""}
              </div>
            ))}
          </div>
          {coa.motto && (
            <div style={{ marginTop: 8, fontStyle: "italic", color: "var(--accent)", fontSize: 10, textAlign: "center" }}>
              „{coa.motto}“
            </div>
          )}
        </div>
      </details>

      {showValidation && (
        <details style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            ✅ TINCTURE-REGEL PRÜFUNG
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
            {validation.map((v, i) => (
              <div key={i} style={{ padding: 6, border: `1px solid ${v.valid ? "var(--success)" : "var(--error)"}`, borderRadius: 4, background: v.valid ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{v.charge} in {v.tincture}</span>
                  <span style={{ color: v.valid ? "var(--success)" : "var(--error)", fontWeight: 700 }}>
                    {v.valid ? "✓ ERLAUBT" : "✗ VERBOTEN"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  Feld: {coa.fieldTincture} → Charge: {v.tincture}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 DEUTSCHER BLASENTEXT
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {coa.blazoningDe}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 FRANZÖSISCHER BLASENTEXT (HERALDISCH)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)" }}>
          {coa.blazoningFr}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎯 TINCTURE-REGEL TESTER
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
          <label style={{ flex: 1, minWidth: 120 }}>
            Tinctur 1 (Feld)
            <select defaultValue="Gold" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
              <option>Gold</option><option>Silber</option><option>Rot</option><option>Blau</option><option>Grün</option><option>Schwarz</option>
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 120 }}>
            Tinctur 2 (Charge)
            <select defaultValue="Rot" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
              <option>Rot</option><option>Blau</option><option>Gold</option><option>Silber</option><option>Grün</option><option>Schwarz</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, background: "var(--panel)" }}>
          <strong>Regel:</strong> Metall (Gold/Silber) nicht auf Metall. Farbe (Rot/Blau/Grün/Schwarz) nicht auf Farbe. Felle (Hermelin/Feh) sind neutral.
        </div>
      </details>
    </div>
  );
}