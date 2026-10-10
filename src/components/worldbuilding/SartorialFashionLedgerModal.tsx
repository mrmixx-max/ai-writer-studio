// SartorialFashionLedgerModal (Meilenstein 59.0 / v7.1.0 UI)
// Kleiderordnungs- & Textil-Semiotik-Hauptbuch.
import { useState, useMemo } from "react";
import {
  TEXTILES,
  DYES,
  checkSumptuaryLaw,
  generateTextileProse,
  createSampleTextile,
  createSampleDye,
  type FashionSocialClass,
} from "@/services/worldbuilding/sartorialFashionLedger";

export interface SartorialFashionLedgerModalProps {
  className?: string;
}

const SOCIAL_CLASSES: Array<{ value: FashionSocialClass; label: string }> = [
  { value: "peasant", label: "Bauer (peasant)" },
  { value: "burgher", label: "Bürger (burgher)" },
  { value: "noble", label: "Adel (noble)" },
  { value: "royal", label: "Krone (royal)" },
];

export function SartorialFashionLedgerModal({ className }: SartorialFashionLedgerModalProps) {
  const [seed, setSeed] = useState(42);
  const [socialClass, setSocialClass] = useState<FashionSocialClass>("burgher");
  const [textileId, setTextileId] = useState("brokat");
  const [dyeId, setDyeId] = useState("purpur");

  const sampleTextile = useMemo(() => createSampleTextile(), []);
  const sampleDye = useMemo(() => createSampleDye(), []);

  const sumptuary = useMemo(
    () => checkSumptuaryLaw({ socialClass }, textileId, dyeId, "dem Spätmittelalter"),
    [socialClass, textileId, dyeId]
  );

  const prose = useMemo(
    () => generateTextileProse(textileId, dyeId, seed),
    [textileId, dyeId, seed]
  );

  return (
    <div
      className={className}
      data-testid="sartorial-fashion-modal"
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
        👘 Kleiderordnungs- &amp; Textil-Semiotik-Hauptbuch
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Textil: {textileId} · Farbstoff: {dyeId} · Stand: {socialClass}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Sozialer Stand
          <select
            value={socialClass}
            onChange={(e) => setSocialClass(e.target.value as FashionSocialClass)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          >
            {SOCIAL_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Textil
          <select
            value={textileId}
            onChange={(e) => setTextileId(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          >
            {TEXTILES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Farbstoff
          <select
            value={dyeId}
            onChange={(e) => setDyeId(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          >
            {DYES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧵 TEXTIL-TAXONOMIE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {TEXTILES.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>{t.name}</span>
                <span style={{ color: "var(--muted)" }}>
                  Gewicht {t.weight}/10 · Kosten {t.cost}/10
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎨 FARBSTOFF-TAXONOMIE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {DYES.map((d) => (
            <div
              key={d.id}
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>{d.name}</span>
                <span style={{ color: "var(--muted)" }}>
                  Seltenheit {d.rarity}/10 · Kosten {d.cost}/10
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{d.description}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⚖️ KLEIDERORDNUNGS-PRÜFER
        </summary>
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 8,
              border: `1px solid ${sumptuary.violated ? "var(--error)" : "var(--success)"}`,
              borderRadius: 4,
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{sumptuary.violated ? "✗ VERSTOSS" : "✓ KONFORM"}</span>
              <span style={{ color: sumptuary.violated ? "var(--error)" : "var(--success)" }}>
                {sumptuary.law}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sumptuary.description}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Strafe: {sumptuary.penalty}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✍️ STOFF-PROSA
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            background: "var(--panel)",
          }}
        >
          {prose}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-DATENSÄTZE
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            Beispiel-Textil: <strong style={{ color: "var(--fg)" }}>{sampleTextile.name}</strong> —{" "}
            {sampleTextile.description}
          </div>
          <div>
            Beispiel-Farbstoff: <strong style={{ color: "var(--fg)" }}>{sampleDye.name}</strong> —{" "}
            {sampleDye.description}
          </div>
        </div>
      </details>
    </div>
  );
}
