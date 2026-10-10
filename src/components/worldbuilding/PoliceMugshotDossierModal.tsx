// PoliceMugshotDossierModal (WP 128.2 UI, Meilenstein 62.0, v7.4.0)
import { useState, useMemo } from "react";
import {
  buildMugshotPlate,
  buildFingerprintCard,
  buildSignalement,
  FINGERPRINT_PATTERNS,
  type UnitSystem,
} from "@/services/worldbuilding/policeMugshotDossier";

export interface PoliceMugshotDossierModalProps {
  className?: string;
}

const PRECINCTS = ["1. Bezirk", "2. Bezirk", "3. Bezirk", "4. Bezirk", "5. Bezirk"] as const;
const PLATE_DATE = "14.10.2026";

const inputStyle = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
} as const;

const labelStyle = { fontSize: 11, color: "var(--muted)", minWidth: 110 } as const;

const panelStyle = {
  marginTop: 8,
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--panel)",
} as const;

function embedSvg(svg: string): string {
  return svg.replace("<svg ", '<svg style="width: 100%; height: auto; display: block;" ');
}

export function PoliceMugshotDossierModal({ className }: PoliceMugshotDossierModalProps) {
  const [seed, setSeed] = useState(42);
  const [prisonerNumber, setPrisonerNumber] = useState("X-00427");
  const [name, setName] = useState("Maximilian Graf");
  const [precinct, setPrecinct] = useState<string>("1. Bezirk");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");

  const mugshot = useMemo(
    () =>
      buildMugshotPlate(
        { prisonerNumber, name, precinct, date: PLATE_DATE, unitSystem },
        seed
      ),
    [prisonerNumber, name, precinct, unitSystem, seed]
  );
  const fingerprint = useMemo(() => buildFingerprintCard(seed), [seed]);
  const signalement = useMemo(() => buildSignalement(seed), [seed]);

  return (
    <div
      className={className}
      data-testid="mugshot-dossier-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--accent)" }}>
        🪪 Erkennungsdienst- &amp; Mugshot-Dossier
      </h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={labelStyle}>
          Gefangenen-Nr.
          <input
            value={prisonerNumber}
            onChange={(e) => setPrisonerNumber(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, minWidth: 140 }}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Revier
          <select
            value={precinct}
            onChange={(e) => setPrecinct(e.target.value)}
            style={inputStyle}
          >
            {PRECINCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Maßeinheit
          <select
            value={unitSystem}
            onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
            style={inputStyle}
          >
            <option value="metric">Zentimeter</option>
            <option value="imperial">Fuß/Zoll</option>
          </select>
        </label>
        <label style={{ ...labelStyle, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📸 MUGSHOT-SCHILD
        </summary>
        <div style={panelStyle}>
          <div dangerouslySetInnerHTML={{ __html: embedSvg(mugshot.svg) }} />
          <pre
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {mugshot.plateText}
          </pre>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Höhenmarken: {mugshot.heightMarks.length} · Maßeinheit:{" "}
            {mugshot.unitSystem === "metric" ? "Zentimeter" : "Fuß/Zoll"}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🖐️ FINGERABDRUCK-KARTE
        </summary>
        <div style={panelStyle}>
          <div dangerouslySetInnerHTML={{ __html: embedSvg(fingerprint.svg) }} />
          <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.7 }}>
            {fingerprint.prints.map((p) => (
              <div key={p.finger}>
                {p.finger}: {p.patternName} · {p.ridges} Linien
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>
            MUSTER:
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6, marginTop: 2 }}>
            {FINGERPRINT_PATTERNS.map((p) => (
              <div key={p.id}>
                <span style={{ color: "var(--fg)" }}>{p.name}:</span> {p.description}
              </div>
            ))}
          </div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 SIGNALEMENT
        </summary>
        <div style={{ ...panelStyle, fontSize: 11, lineHeight: 1.7 }}>
          <div>
            <strong>Augenfarbe:</strong> {signalement.eyeColor}
          </div>
          <div>
            <strong>Körpergröße:</strong> {signalement.height}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Narben:</strong>
          </div>
          {signalement.scars.map((s) => (
            <div key={s}>· {s}</div>
          ))}
          <div style={{ marginTop: 4 }}>
            <strong>Tätowierungen:</strong>
          </div>
          {signalement.tattoos.map((t) => (
            <div key={t}>· {t}</div>
          ))}
          <div style={{ marginTop: 4 }}>
            <strong>Decknamen:</strong>
          </div>
          {signalement.aliases.map((a) => (
            <div key={a}>· {a}</div>
          ))}
          <div style={{ marginTop: 4 }}>
            <strong>Vorstrafen:</strong>
          </div>
          {signalement.priorConvictions.map((c) => (
            <div key={c}>· {c}</div>
          ))}
        </div>
        <pre
          style={{
            marginTop: 8,
            marginBottom: 0,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            background: "var(--panel)",
            lineHeight: 1.5,
          }}
        >
          {signalement.description}
        </pre>
      </details>
    </div>
  );
}
