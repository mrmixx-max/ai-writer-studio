// NemesisDarkMirrorAnalyzerModal (Meilenstein 63.0 / v7.5.0)
//
// UI für den Nemesis-Dunkelspiegel-Resonanz-Analysator: Trauma-Gegenüberstellung,
// thematischer Resonanz-Score und ideologischer Showdown. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  compareOriginTrauma,
  calculateResonanceScore,
  synthesizeIdeologicalShowdown,
} from "@/services/analytics/nemesisDarkMirrorAnalyzer";

export interface NemesisDarkMirrorAnalyzerModalProps {
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

export function NemesisDarkMirrorAnalyzerModal({
  className,
}: NemesisDarkMirrorAnalyzerModalProps) {
  const [seed, setSeed] = useState(42);
  const [heroName, setHeroName] = useState("Kommissar Bauer");
  const [heroWound, setHeroWound] = useState("Verlor die Familie an das System");
  const [villainName, setVillainName] = useState("Der Schatten");
  const [villainWound, setVillainWound] = useState("Verlor die Familie an das System");
  const [heroWeakness, setHeroWeakness] = useState("Selbstzweifel");
  const [villainChallenge, setVillainChallenge] = useState("Zwingt ihn, seine Selbstzweifel zu beweisen");
  const [heroIdeology, setHeroIdeology] = useState("Gerechtigkeit für alle");
  const [villainIdeology, setVillainIdeology] = useState("Ordnung um jeden Preis");

  const trauma = useMemo(
    () => compareOriginTrauma({ heroName, heroWound, villainName, villainWound }, seed),
    [heroName, heroWound, villainName, villainWound, seed],
  );

  const resonance = useMemo(
    () => calculateResonanceScore({ heroWeakness, villainChallenge }, seed),
    [heroWeakness, villainChallenge, seed],
  );

  const showdown = useMemo(
    () => synthesizeIdeologicalShowdown({ heroName, heroIdeology, villainName, villainIdeology }, seed),
    [heroName, heroIdeology, villainName, villainIdeology, seed],
  );

  return (
    <div
      data-testid="nemesis-dark-mirror-modal"
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
      <h2 style={{ margin: "0 0 12px" }}>🪞 Nemesis-Dunkelspiegel-Resonanz-Analysator</h2>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={inputStyle} />
        </label>
        <label style={{ marginRight: 12 }}>
          Held{" "}
          <input type="text" value={heroName} onChange={(e) => setHeroName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ marginRight: 12 }}>
          Nemesis{" "}
          <input type="text" value={villainName} onChange={(e) => setVillainName(e.target.value)} style={inputStyle} />
        </label>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Wunde des Helden{" "}
            <input type="text" value={heroWound} onChange={(e) => setHeroWound(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            Wunde der Nemesis{" "}
            <input type="text" value={villainWound} onChange={(e) => setVillainWound(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            Schwäche des Helden{" "}
            <input type="text" value={heroWeakness} onChange={(e) => setHeroWeakness(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            Herausforderung der Nemesis{" "}
            <input type="text" value={villainChallenge} onChange={(e) => setVillainChallenge(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            Ideologie des Helden{" "}
            <input type="text" value={heroIdeology} onChange={(e) => setHeroIdeology(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "block" }}>
            Ideologie der Nemesis{" "}
            <input type="text" value={villainIdeology} onChange={(e) => setVillainIdeology(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>TRAUMA-GEGENÜBERSTELLUNG</h3>
        <p style={{ margin: "0 0 6px" }}>
          <strong>{trauma.heroName}</strong> vs. <strong>{trauma.villainName}</strong> · Parallelität {trauma.parallelStrength}%
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Gemeinsame Wunde:</strong> {trauma.sharedWound}
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Weggabelung:</strong> {trauma.divergencePoint}
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <strong>Wahl des Helden:</strong> {trauma.heroChoice}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Wahl der Nemesis:</strong> {trauma.villainChoice}
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>RESONANZ-SCORE</h3>
        <p style={{ margin: "0 0 6px" }}>
          Score: <strong>{resonance.score}</strong> / 100 · stärkster Faktor: {resonance.strongestFactor}
        </p>
        <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
          {resonance.breakdown.map((b, i) => (
            <li key={i}>
              {b.factor}: Gewicht {b.weight} · Beitrag {b.contribution}
            </li>
          ))}
        </ul>
        <p style={{ margin: 0, color: "var(--muted)" }}>{resonance.interpretation}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>IDEOLOGISCHER SHOWDOWN</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {showdown.exchanges.map((x, i) => (
            <li key={i} style={{ border: "1px solid var(--border)", padding: 6, marginBottom: 4 }}>
              <strong>{x.speaker}</strong> ({x.worldView}): {x.line}
            </li>
          ))}
        </ul>
        <p style={{ margin: "6px 0 0" }}>
          <strong>Höhepunkt:</strong> {showdown.climaxLine}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
          Unaufgelöste Spannung: {showdown.unresolvedTension}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{showdown.wordCount} Wörter</p>
      </section>
    </div>
  );
}
