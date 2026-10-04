// TableReadDirector (WP 45.1): Drehbuch-Table-Read & Regie-Teleprompter.
//
// Weist Figuren Sprecher + Farben zu, baut ein lineares Sprech-Skript und
// führt Zeile für Zeile durch den Table-Read — mit Szenenwechsel-Cues und
// hervorgehobenen Regieanweisungen.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  assignRoles,
  buildTableReadScript,
  getCurrentSpeaker,
  getSceneChangeCue,
  formatDirectorMarkup,
  type RoleAssignment,
} from "@/services/screenplay/tableReadDirector";
import type { ScreenplayDocument } from "@/services/screenplay/screenplayTransmuter";

export interface TableReadDirectorProps {
  doc: ScreenplayDocument;
  speakers?: string[];
  className?: string;
  onLineChange?: (index: number) => void;
}

const DEFAULT_SPEAKERS = ["Sprecher 1", "Sprecher 2", "Sprecher 3", "Sprecher 4"];

export function TableReadDirector({
  doc,
  speakers = DEFAULT_SPEAKERS,
  className,
  onLineChange,
}: TableReadDirectorProps) {
  const roles: RoleAssignment = useMemo(() => assignRoles(doc, speakers), [doc, speakers]);
  const script = useMemo(() => buildTableReadScript(doc, roles), [doc, roles]);
  const [index, setIndex] = useState(0);

  // Aktuelle Zeile (jeder Typ) — getCurrentSpeaker liefert nur Dialogzeilen.
  const current = script.lines[index] ?? null;
  const isSceneChange = getSceneChangeCue(script, index);
  const speaker = getCurrentSpeaker(script, index);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, script.lines.length - 1));
      setIndex(clamped);
      onLineChange?.(clamped);
    },
    [script.lines.length, onLineChange],
  );

  return (
    <div
      className={className}
      data-testid="table-read-director"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Table-Read Regie
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {script.sceneCount} Szenen · {script.characterCount} Figuren · {script.lines.length} Zeilen
      </div>

      {script.lines.length === 0 && (
        <div data-testid="table-read-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Kein Drehbuch-Inhalt vorhanden.
        </div>
      )}

      {/* Rollen-Zuweisung */}
      {roles.assignments.length > 0 && (
        <div data-testid="table-read-roles" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ROLLEN</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roles.assignments.map((a) => (
              <div
                key={a.character}
                data-testid={`table-read-role-${a.character}`}
                style={{
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${a.color}`,
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11,
                }}
              >
                <strong style={{ color: a.color }}>{a.character}</strong>
                <span style={{ color: "var(--muted)" }}> · {a.speaker}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aktuelle Zeile */}
      {current && (
        <div
          data-testid="table-read-current"
          style={{
            background: "var(--card, transparent)",
            border: `1px solid ${isSceneChange ? "var(--warn)" : "var(--border)"}`,
            borderRadius: 4,
            padding: 14,
            marginBottom: 14,
          }}
        >
          {isSceneChange && (
            <div
              data-testid="table-read-scene-cue"
              style={{ fontSize: 11, color: "var(--warn)", marginBottom: 8 }}
            >
              🔔 Szenenwechsel
            </div>
          )}
          {current.character && (
            <div
              data-testid="table-read-speaker"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: current.color ?? "var(--accent)",
                marginBottom: 6,
              }}
            >
              {current.character}
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
                {" "}
                ({current.speaker})
              </span>
            </div>
          )}
          {current.parenthetical && (
            <div
              data-testid="table-read-parenthetical"
              style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginBottom: 4 }}
            >
              ({current.parenthetical})
            </div>
          )}
          <div data-testid="table-read-text" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {current.text}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
            Zeile {current.index + 1} / {script.lines.length} · {formatDirectorMarkup(current)}
            {speaker ? "" : " · (keine Dialogzeile)"}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          data-testid="table-read-prev"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          style={{
            background: "transparent",
            color: index === 0 ? "var(--muted)" : "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 12,
            cursor: index === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Zurück
        </button>
        <button
          data-testid="table-read-next"
          onClick={() => go(index + 1)}
          disabled={index >= script.lines.length - 1}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: index >= script.lines.length - 1 ? "not-allowed" : "pointer",
          }}
        >
          Weiter →
        </button>
      </div>

      {/* Skript-Liste */}
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SKRIPT</div>
      <div data-testid="table-read-script" style={{ maxHeight: 320, overflow: "auto" }}>
        {script.lines.map((line) => (
          <div
            key={line.index}
            data-testid={`table-read-line-${line.index}`}
            onClick={() => go(line.index)}
            style={{
              padding: "5px 8px",
              borderLeft: `3px solid ${
                line.kind === "scene"
                  ? "var(--warn)"
                  : line.color ?? "transparent"
              }`,
              background: line.index === index ? "var(--card, transparent)" : "transparent",
              cursor: "pointer",
              fontSize: 11,
              marginBottom: 2,
            }}
          >
            {line.kind === "dialogue" && line.character ? (
              <>
                <strong style={{ color: line.color ?? "var(--accent)" }}>{line.character}: </strong>
                {line.parenthetical && (
                  <em style={{ color: "var(--muted)" }}>({line.parenthetical}) </em>
                )}
                {line.text}
              </>
            ) : (
              <span style={{ color: line.kind === "scene" ? "var(--warn)" : "var(--muted)" }}>
                {line.text}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
