// CombatChoreographyGenerator (WP 56.2)
//
// Erzeugt Beat-für-Beat-Kampf-Choreografien mit Tempo-Regler, Hindernissen
// und Anatomie-Wächter.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  choreographCombat,
  analyzeCombatPacing,
  validateCombatBeat,
  WEAPON_LABELS,
  OBSTACLE_LABELS,
  type Combatant,
  type Obstacle,
  type WeaponKind,
} from "@/services/ai/combatChoreographyGenerator";

export interface CombatChoreographyGeneratorProps {
  /** Vorbesetzung. */
  initialCombatants?: Combatant[];
  className?: string;
}

const DEFAULT_DUEL: Combatant[] = [
  { name: "Raven", weapon: "longsword", grip: "two-handed", condition: "fresh" },
  { name: "Kessler", weapon: "dagger", grip: "one-handed", condition: "wounded" },
];

const ALL_OBSTACLES: Obstacle[] = [
  "overturned-table",
  "wet-cobblestones",
  "rain",
  "staircase",
  "smoke",
  "darkness",
];

const TEMPOS: { value: "measured" | "kinetic" | "frantic"; label: string }[] = [
  { value: "measured", label: "Gemessen" },
  { value: "kinetic", label: "Kinetisch" },
  { value: "frantic", label: "Rasend" },
];

const KIND_LABELS: Record<string, string> = {
  attack: "Angriff",
  defend: "Verteidigung",
  move: "Bewegung",
  impact: "Treffer",
  pause: "Pause",
  finish: "Abschluss",
};

export function CombatChoreographyGenerator({
  initialCombatants,
  className,
}: CombatChoreographyGeneratorProps) {
  const [cast] = useState<Combatant[]>(initialCombatants ?? DEFAULT_DUEL);
  const [tempo, setTempo] = useState<"measured" | "kinetic" | "frantic">("kinetic");
  const [selectedObstacles, setSelectedObstacles] = useState<Obstacle[]>([
    "rain",
    "overturned-table",
  ]);

  const choreo = useMemo(
    () => choreographCombat({ combatants: cast, obstacles: selectedObstacles, tempo }),
    [cast, selectedObstacles, tempo],
  );
  const pacing = useMemo(() => analyzeCombatPacing(choreo.text), [choreo.text]);

  // Wächter-Demo: unmögliche Kombination prüfen.
  const guardDemo = useMemo(
    () =>
      validateCombatBeat(
        { name: "Beispiel", weapon: "longsword", grip: "one-handed" },
        { attack: true, reload: true },
      ),
    [],
  );

  const toggleObstacle = (o: Obstacle) => {
    setSelectedObstacles((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );
  };

  const invalidCount = choreo.beats.filter((b) => b.invalid).length;

  return (
    <div
      className={className}
      data-testid="combat-choreography-generator"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚔️ Kampf-Choreograf
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {choreo.beatCount} Beats · {choreo.sentenceCount} Sätze · Ø{" "}
        {choreo.avgSentenceLength} Wörter
      </div>

      {/* Besetzung */}
      <div data-testid="combat-cast" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>KÄMPFER</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cast.map((c) => (
            <span
              key={c.name}
              data-testid={`combat-fighter-${c.name}`}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--accent)",
              }}
            >
              {c.name} ({WEAPON_LABELS[(c.weapon ?? "fists") as WeaponKind]})
            </span>
          ))}
        </div>
      </div>

      {/* Tempo */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TEMPO</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TEMPOS.map((t) => (
            <button
              key={t.value}
              data-testid={`combat-tempo-${t.value}`}
              onClick={() => setTempo(t.value)}
              aria-pressed={tempo === t.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: tempo === t.value ? "var(--accent)" : "var(--panel)",
                color: tempo === t.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hindernisse */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          GELÄNDE-HINDERNISSE
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ALL_OBSTACLES.map((o) => {
            const active = selectedObstacles.includes(o);
            return (
              <button
                key={o}
                data-testid={`combat-obstacle-${o}`}
                onClick={() => toggleObstacle(o)}
                aria-pressed={active}
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: "var(--panel)",
                  color: active ? "var(--accent)" : "var(--muted)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {OBSTACLE_LABELS[o]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Anatomie-Wächter */}
      <div
        data-testid="combat-guard"
        style={{
          border: `1px solid ${guardDemo.valid ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          ANATOMIE- & HANDLUNGS-WÄCHTER
        </div>
        <div
          data-testid="combat-guard-status"
          style={{ color: guardDemo.valid ? "var(--success)" : "var(--warn)", fontWeight: 700 }}
        >
          {guardDemo.valid
            ? "✓ Beispiel-Beat plausibel"
            : `✗ ${guardDemo.violations.length} Verstoß/Verstöße erkannt`}
        </div>
        {guardDemo.violations.length > 0 && (
          <div data-testid="combat-guard-violations" style={{ marginTop: 4 }}>
            {guardDemo.violations.map((v, i) => (
              <div key={i} style={{ fontSize: 10, color: "var(--muted)" }}>
                • {v}
              </div>
            ))}
          </div>
        )}
        {invalidCount > 0 && (
          <div
            data-testid="combat-invalid-beats"
            style={{ marginTop: 6, fontSize: 10, color: "var(--error)" }}
          >
            {invalidCount} Beat(s) der Choreografie sind markiert.
          </div>
        )}
      </div>

      {/* Pacing-Analyse */}
      <div
        data-testid="combat-pacing"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          RHYTHMUS-ANALYSE
        </div>
        <div>
          Ø Satzlänge:{" "}
          <strong data-testid="combat-avg-length">{pacing.avgSentenceLength}</strong> Wörter
        </div>
        <div>
          Stakkato-Anteil:{" "}
          <strong data-testid="combat-staccato">{Math.round(pacing.staccatoRatio * 100)}%</strong>
        </div>
        <div>
          Längster Satz:{" "}
          <strong data-testid="combat-longest">{pacing.longestSentence}</strong> Wörter
        </div>
        <div
          data-testid="combat-rhythm-score"
          style={{ marginTop: 6, color: "var(--accent)", fontWeight: 700 }}
        >
          Rhythmus-Score: {pacing.rhythmScore.toFixed(2)}
        </div>
      </div>

      {/* Choreografie */}
      {choreo.beats.length > 0 ? (
        <div data-testid="combat-choreography">
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>CHOREOGRAFIE</div>
          {choreo.beats.map((b) => (
            <div
              key={b.index}
              data-testid={`combat-beat-${b.index}`}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 6,
                fontSize: 12,
                paddingLeft: 8,
                borderLeft: `2px solid ${b.invalid ? "var(--error)" : "var(--border)"}`,
              }}
            >
              <span style={{ color: "var(--muted)", fontSize: 10, minWidth: 54 }}>
                {KIND_LABELS[b.kind] ?? b.kind}
              </span>
              <span>
                <strong style={{ color: "var(--accent)" }}>{b.actor}</strong>
                {b.target ? ` → ${b.target}` : ""}: {b.text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="combat-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Mindestens zwei Kämpfer erforderlich.
        </div>
      )}
    </div>
  );
}
