// ForensicPathologyEngineModal (WP 114.1 UI)
import { useState, useMemo } from "react";
import {
  calculateTimeOfDeath,
  calculateRigorMortis,
  calculateLivorMortis,
  transportCheck,
  generateAutopsyReport,
  type ClothingType,
} from "@/services/worldbuilding/forensicPathologyEngine";

export interface ForensicPathologyEngineModalProps {
  className?: string;
}

export function ForensicPathologyEngineModal({ className }: ForensicPathologyEngineModalProps) {
  const [rectalTemp, setRectalTemp] = useState(32.0);
  const [ambientTemp, setAmbientTemp] = useState(20.0);
  const [bodyWeight, setBodyWeight] = useState(75);
  const [clothing, setClothing] = useState<ClothingType>("normal");
  const [isInWater, setIsInWater] = useState(false);
  const [causeOfDeath, setCauseOfDeath] = useState("Schussverletzung");
  const [findings, setFindings] = useState("Keine äußerlichen Verletzungen");
  const [seed, setSeed] = useState(42);

  const timeOfDeath = useMemo(
    () => calculateTimeOfDeath({ rectalTempC: rectalTemp, ambientTempC: ambientTemp, bodyWeightKg: bodyWeight, clothing, isInWater }),
    [rectalTemp, ambientTemp, bodyWeight, clothing, isInWater]
  );
  const rigor = useMemo(() => calculateRigorMortis(timeOfDeath.hoursSinceDeath), [timeOfDeath.hoursSinceDeath]);
  const livor = useMemo(() => calculateLivorMortis(timeOfDeath.hoursSinceDeath), [timeOfDeath.hoursSinceDeath]);
  const transport = useMemo(() => transportCheck("mixed"), []);
  const autopsyReport = useMemo(() => generateAutopsyReport(causeOfDeath, [findings], seed), [causeOfDeath, findings, seed]);

  return (
    <div
      className={className}
      data-testid="forensic-pathology-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚕️ Rechtsmedizinische Pathologie &amp; Todeszeit-Rechner
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Todeszeit: vor {timeOfDeath.hoursSinceDeath.toFixed(1)} Stunden · {rigor.phase} · {livor.phase}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Rektaltemp. (°C)
          <input type="number" step={0.1} value={rectalTemp} onChange={(e) => setRectalTemp(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Umgebungstemp. (°C)
          <input type="number" step={0.1} value={ambientTemp} onChange={(e) => setAmbientTemp(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Körpergewicht (kg)
          <input type="number" value={bodyWeight} onChange={(e) => setBodyWeight(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Kleidung
          <select value={clothing} onChange={(e) => setClothing(e.target.value as ClothingType)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <option value="none">Keine</option>
            <option value="normal">Normal</option>
            <option value="heavy">Schwer</option>
            <option value="wet">Nass</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
          Im Wasser
          <input type="checkbox" checked={isInWater} onChange={(e) => setIsInWater(e.target.checked)} style={{ marginLeft: 8, accentColor: "var(--accent)" }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ⏱️ TODESZEIT-KALKULATOR (HENSSGE-FORMEL)
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Geschätzte Todeszeit:</strong> vor {timeOfDeath.hoursSinceDeath.toFixed(1)} Stunden</div>
          <div><strong>Zeitfenster:</strong> {timeOfDeath.timeWindowLow.toFixed(1)} – {timeOfDeath.timeWindowHigh.toFixed(1)} Stunden</div>
          <div><strong>Methode:</strong> {timeOfDeath.method}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{timeOfDeath.notes}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧊 TOTENSTARRE &amp; TOTENFLECKE
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Totenstarre:</strong> {rigor.phase} — Kiefer {rigor.jawStiffness.toFixed(0)}%, Gliedmaßen {rigor.limbStiffness.toFixed(0)}%</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{rigor.notes}</div>
          <div style={{ marginTop: 4 }}><strong>Totenflecke:</strong> {livor.phase} — Blanchable: {livor.blanchable ? "Ja" : "Nein"} — Farbe: {livor.color}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{livor.notes}</div>
          <div style={{ marginTop: 4 }}><strong>Transport-Prüfung:</strong> {transport.bodyMoved ? "Leiche wurde bewegt" : "Leiche nicht bewegt"}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{transport.interpretation}</div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 SEKTIONSBERICHT
        </summary>
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Todesursache
            <input value={causeOfDeath} onChange={(e) => setCauseOfDeath(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
            Befunde
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={2} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, resize: "vertical" }} />
          </label>
        </div>
        <pre style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.5 }}>
          {autopsyReport}
        </pre>
      </details>
    </div>
  );
}
