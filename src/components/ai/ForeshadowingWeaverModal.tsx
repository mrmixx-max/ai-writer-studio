// ForeshadowingWeaverModal (WP 56.1)
//
// Legt Hinweise auf einen späteren Twist in bestehende Szenen — in drei
// Subtilitätsstufen, mit Live-Audit der Abdeckung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  mapTwistToClues,
  injectForeshadowing,
  auditForeshadowing,
  LEVEL_LABELS,
  type SubtletyLevel,
} from "@/services/ai/foreshadowingWeaver";

export interface ForeshadowingWeaverModalProps {
  /** Vorbefüllte Szene. */
  initialScene?: string;
  className?: string;
}

const SAMPLE_SCENE =
  "Der Saal war voll. Der König hob den Becher. Die Musik spielte weiter. Niemand sah den Leibarzt an.";

const LEVEL_COLORS: Record<SubtletyLevel, string> = {
  1: "var(--muted)",
  2: "var(--warn)",
  3: "var(--error)",
};

export function ForeshadowingWeaverModal({
  initialScene = SAMPLE_SCENE,
  className,
}: ForeshadowingWeaverModalProps) {
  const [scene, setScene] = useState(initialScene);
  const [twist, setTwist] = useState(
    "Der Leibarzt vergiftet den König langsam mit gemahlenem Nachtschattengewächs.",
  );
  const [chapter, setChapter] = useState(6);
  const [count, setCount] = useState(3);

  const plan = useMemo(() => mapTwistToClues(twist, 20), [twist]);
  const injected = useMemo(
    () => injectForeshadowing(scene, twist, { chapter, count }),
    [scene, twist, chapter, count],
  );
  const audit = useMemo(() => auditForeshadowing(injected.text), [injected.text]);

  return (
    <div
      className={className}
      data-testid="foreshadowing-weaver-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎯 Foreshadowing-Weaver
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Tschechows Gewehr: Hinweise in drei Subtilitätsstufen, bevor der Twist kommt.
      </div>

      {/* Twist-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        Spätere Enthüllung (Twist)
        <textarea
          data-testid="foreshadowing-twist-input"
          value={twist}
          onChange={(e) => setTwist(e.target.value)}
          rows={2}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
      </label>

      {/* Szenen-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        Bestehende Szene
        <textarea
          data-testid="foreshadowing-scene-input"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
      </label>

      {/* Regler */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "10px 0" }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Zielkapitel
          <input
            data-testid="foreshadowing-chapter-input"
            type="number"
            min={1}
            max={20}
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value) || 1)}
            style={{
              width: 55,
              marginLeft: 6,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Hinweise
          <input
            data-testid="foreshadowing-count-input"
            type="number"
            min={1}
            max={3}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            style={{
              width: 55,
              marginLeft: 6,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
      </div>

      {/* Hinweis-Plan */}
      {plan.clues.length > 0 && (
        <div data-testid="foreshadowing-plan" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            HINWEIS-PLAN ({plan.totalClues} Stufen)
          </div>
          {plan.keywords.length > 0 && (
            <div
              data-testid="foreshadowing-keywords"
              style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}
            >
              Erkannte Begriffe: {plan.keywords.join(", ")}
            </div>
          )}
          {plan.clues.map((clue) => (
            <div
              key={clue.id}
              data-testid={`foreshadowing-clue-${clue.level}`}
              style={{
                border: `1px solid ${LEVEL_COLORS[clue.level]}`,
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              <div style={{ color: LEVEL_COLORS[clue.level], fontWeight: 700, fontSize: 10 }}>
                STUFE {clue.level} — {clue.levelLabel} · Kapitel {clue.suggestedChapter}
              </div>
              <div style={{ marginTop: 3 }}>{clue.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Eingeflochtene Szene */}
      <div data-testid="foreshadowing-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SZENE MIT HINWEISEN ({injected.insertedCount} eingeflochten)
        </div>
        <div
          data-testid="foreshadowing-output-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {injected.text || "—"}
        </div>
      </div>

      {/* Audit */}
      <div
        data-testid="foreshadowing-audit"
        style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 10, fontSize: 11 }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          HINWEIS-AUDIT
        </div>
        <div>
          Gefundene Hinweise:{" "}
          <strong data-testid="foreshadowing-audit-total">{audit.total}</strong>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          {([1, 2, 3] as SubtletyLevel[]).map((level) => (
            <span
              key={level}
              data-testid={`foreshadowing-audit-level-${level}`}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 10,
                border: `1px solid ${audit.levelCounts[level] > 0 ? LEVEL_COLORS[level] : "var(--border)"}`,
                color: audit.levelCounts[level] > 0 ? LEVEL_COLORS[level] : "var(--muted)",
              }}
            >
              {LEVEL_LABELS[level]}: {audit.levelCounts[level]}
            </span>
          ))}
        </div>
        <div
          data-testid="foreshadowing-coverage"
          style={{
            marginTop: 8,
            color: audit.coverage === 1 ? "var(--success)" : "var(--warn)",
            fontWeight: 700,
          }}
        >
          Stufen-Abdeckung: {Math.round(audit.coverage * 100)}%
        </div>
      </div>
    </div>
  );
}
