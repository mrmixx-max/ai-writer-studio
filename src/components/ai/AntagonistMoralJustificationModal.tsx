// AntagonistMoralJustificationModal (Meilenstein 63.0 / v7.5.0)
//
// UI für den Schurken-Selbstgerechtigkeits-Synthesizer: vier Antagonisten-
// Philosophien, Monolog-Synthesizer und Verführungs-Regler. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  ANTAGONIST_PHILOSOPHIES,
  synthesizeJustificationMonologue,
  calibrateSeduction,
  createSampleAntagonist,
} from "@/services/ai/antagonistMoralJustification";

export interface AntagonistMoralJustificationModalProps {
  className?: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

export function AntagonistMoralJustificationModal({
  className,
}: AntagonistMoralJustificationModalProps) {
  const sample = useMemo(() => createSampleAntagonist(), []);

  const [seed, setSeed] = useState(42);
  const [villainName, setVillainName] = useState("Ozymandias");
  const [philosophyId, setPhilosophyId] = useState(sample.id);
  const [victimCount, setVictimCount] = useState(5000000);
  const [seductionLevel, setSeductionLevel] = useState(50);

  const monologue = useMemo(
    () => synthesizeJustificationMonologue({ philosophyId, villainName, victimCount }, seed),
    [philosophyId, villainName, victimCount, seed],
  );

  const seduction = useMemo(
    () => calibrateSeduction(philosophyId, seductionLevel, seed),
    [philosophyId, seductionLevel, seed],
  );

  return (
    <div
      data-testid="antagonist-moral-modal"
      className={className}
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
      <h2 style={{ margin: "0 0 12px" }}>🎭 Schurken-Selbstgerechtigkeits-Synthesizer</h2>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Name{" "}
          <input
            type="text"
            value={villainName}
            onChange={(e) => setVillainName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Philosophie{" "}
          <select
            value={philosophyId}
            onChange={(e) => setPhilosophyId(e.target.value)}
            style={inputStyle}
          >
            {ANTAGONIST_PHILOSOPHIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginRight: 12 }}>
          Opferzahl{" "}
          <input
            type="number"
            value={victimCount}
            onChange={(e) => setVictimCount(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label>
          Verführungs-Regler {seductionLevel}%{" "}
          <input
            type="range"
            min={0}
            max={100}
            value={seductionLevel}
            onChange={(e) => setSeductionLevel(Number(e.target.value))}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>PHILOSOPHIEN</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {ANTAGONIST_PHILOSOPHIES.map((p) => (
            <li
              key={p.id}
              style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}
            >
              <strong>{p.name}</strong>
              <div style={{ color: "var(--muted)" }}>{p.description}</div>
              <div style={{ color: "var(--muted)" }}>Glaubenssatz: {p.coreBelief}</div>
              <div style={{ color: "var(--muted)" }}>Vorbilder: {p.examples.join(", ")}</div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>MONOLOG</h3>
        <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
          {monologue.philosophy} · {monologue.wordCount} Wörter
        </p>
        <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{monologue.monologue}</p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Rhetorische Mittel:</strong> {monologue.rhetoricalDevices.join(", ")}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Kälteste Zeile:</strong> {monologue.chillingLine}
        </p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>VERFÜHRUNGS-REGLER</h3>
        <p style={{ margin: "0 0 6px" }}>
          Level {seduction.level} — <strong>{seduction.label}</strong>
        </p>
        <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>{seduction.toneGuidance}</p>
        <p style={{ margin: "0 0 6px" }}>{seduction.sampleLine}</p>
        <p style={{ margin: 0, color: "var(--muted)" }}>{seduction.readerEffect}</p>
      </section>
    </div>
  );
}
