// PolyphonicDialogueGenerator (WP 54.2)
//
// Erzeugt Schlagabtausch zwischen 2–4 Figuren mit individuellen Sprechmustern,
// Konflikt-Vorgabe und Subtext-Erkennung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateDialogue,
  analyzePolyphony,
  type DialogueCharacter,
} from "@/services/ai/polyphonicDialogueGenerator";

export interface PolyphonicDialogueGeneratorProps {
  /** Vorbelegte Figuren. */
  initialCharacters?: DialogueCharacter[];
  className?: string;
}

/** Standardbesetzung für den ersten Aufruf. */
const DEFAULT_CAST: DialogueCharacter[] = [
  {
    name: "Detective",
    role: "Ermittler",
    pattern: { formality: 0.2, tempo: 0.3, slang: 0.3 },
    intent: "sucht ein Geständnis",
  },
  {
    name: "Verdächtige",
    role: "Zeugin",
    pattern: { formality: 0.8, tempo: 0.5, slang: 0.1 },
    intent: "blufft und lenkt den Verdacht",
  },
];

export function PolyphonicDialogueGenerator({
  initialCharacters,
  className,
}: PolyphonicDialogueGeneratorProps) {
  const [cast] = useState<DialogueCharacter[]>(initialCharacters ?? DEFAULT_CAST);
  const [conflict, setConflict] = useState("Detective sucht ein Geständnis");
  const [turns, setTurns] = useState(8);
  const [includeActions, setIncludeActions] = useState(true);

  const dialogue = useMemo(
    () => generateDialogue(cast, { conflict, turns, includeActions }),
    [cast, conflict, turns, includeActions],
  );
  const polyphony = useMemo(() => analyzePolyphony(dialogue.turns), [dialogue.turns]);

  return (
    <div
      className={className}
      data-testid="polyphonic-dialogue-generator"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💬 Polyphoner Dialog-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {cast.length} Figuren · {dialogue.turnCount} Beiträge ·{" "}
        {dialogue.actionCount} Körpersprache-Aktionen
      </div>

      {/* Konflikt-Vorgabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
        Gesprächsziel
        <input
          data-testid="dialogue-conflict-input"
          type="text"
          value={conflict}
          onChange={(e) => setConflict(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 12,
          }}
        />
      </label>

      {/* Regler */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Beiträge
          <input
            data-testid="dialogue-turns-input"
            type="number"
            min={4}
            max={24}
            value={turns}
            onChange={(e) => setTurns(Number(e.target.value) || 8)}
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
          <input
            data-testid="dialogue-actions-toggle"
            type="checkbox"
            checked={includeActions}
            onChange={(e) => setIncludeActions(e.target.checked)}
            style={{ marginRight: 5 }}
          />
          Körpersprache
        </label>
      </div>

      {/* Figuren */}
      <div data-testid="dialogue-cast" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>BESETZUNG</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {dialogue.characters.map((name) => (
            <span
              key={name}
              data-testid={`dialogue-character-${name}`}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--accent)",
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Polyphonie-Analyse */}
      <div
        data-testid="dialogue-polyphony"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          POLYPHONIE-ANALYSE
        </div>
        <div>
          Rhythmus-Index:{" "}
          <strong data-testid="dialogue-rhythm-index">
            {polyphony.rhythmIndex.toFixed(2)}
          </strong>
        </div>
        <div>
          Ø Beitragslänge:{" "}
          <strong data-testid="dialogue-avg-length">{polyphony.avgTurnLength}</strong> Wörter
        </div>
        <div style={{ marginTop: 6 }}>
          {polyphony.shares.map((s) => (
            <div
              key={s.speaker}
              data-testid={`dialogue-share-${s.speaker}`}
              style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
            >
              <span style={{ width: 90, color: "var(--muted)" }}>{s.speaker}</span>
              <span
                style={{
                  flex: 1,
                  height: 6,
                  background: "var(--border)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${Math.round(s.share * 100)}%`,
                    background: "var(--accent)",
                  }}
                />
              </span>
              <span style={{ width: 38, textAlign: "right" }}>{Math.round(s.share * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drehbuch */}
      {dialogue.turns.length > 0 ? (
        <div data-testid="dialogue-script">
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>DREHBUCH</div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            {dialogue.turns.map((t) => (
              <div
                key={t.index}
                data-testid={`dialogue-turn-${t.index}`}
                style={{ marginBottom: 8 }}
              >
                <div>
                  <strong style={{ color: "var(--accent)" }}>{t.speaker}:</strong> {t.text}
                </div>
                {t.action && (
                  <div
                    data-testid={`dialogue-action-${t.index}`}
                    style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 11 }}
                  >
                    ({t.action}.)
                  </div>
                )}
                {t.subtext && (
                  <div
                    data-testid={`dialogue-subtext-${t.index}`}
                    style={{ color: "var(--warn)", fontSize: 10 }}
                  >
                    ▸ Subtext: {t.subtext}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div data-testid="dialogue-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Mindestens zwei Figuren erforderlich.
        </div>
      )}
    </div>
  );
}
