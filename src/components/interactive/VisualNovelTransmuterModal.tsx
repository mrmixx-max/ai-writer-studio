// VisualNovelTransmuterModal (WP 68.1)
//
// Prosa-zu-Game-Wandler mit spielbarer Live-Vorschau (Dialogbox, Porträt,
// Klick-Buttons) und Export nach Ren'Py und Twine.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  parseVisualNovelScript,
  generateRenPy,
  generateTwine,
  validateScript,
  averageLinesPerScene,
  resolveSceneTarget,
} from "@/services/interactive/visualNovelTransmuter";

export interface VisualNovelTransmuterModalProps {
  initialProse?: string;
  className?: string;
}

const SAMPLE = `[bg: forest]
# Der Wald

Mira: "Ich gehe jetzt."
[emotion: angry]
Halden: "Das wagst du nicht."
> Fliehen -> Lichtung
> Bleiben -> Kampf

---

[bg: clearing]
# Die Lichtung

Mira: "Endlich frei."
> Weiter -> Ende

---

# Der Kampf

[emotion: panic]
Halden: "Du hättest fliehen sollen."
> Weiter -> Ende

---

# Ende

Mira: "Es ist vorbei."`;

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function VisualNovelTransmuterModal({
  initialProse = SAMPLE,
  className,
}: VisualNovelTransmuterModalProps) {
  const [prose, setProse] = useState(initialProse);
  const [title, setTitle] = useState("Mein Visual Novel");
  const [playScene, setPlayScene] = useState(0);
  const [playLine, setPlayLine] = useState(0);
  const [exportKind, setExportKind] = useState<"renpy" | "twine">("renpy");

  const script = useMemo(() => parseVisualNovelScript(prose, title), [prose, title]);
  const validation = useMemo(() => validateScript(script), [script]);
  const avg = useMemo(() => averageLinesPerScene(script), [script]);

  const exported = useMemo(
    () => (exportKind === "renpy" ? generateRenPy(script) : generateTwine(script)),
    [script, exportKind],
  );

  const currentScene = script.scenes[playScene];
  const currentLine = currentScene?.lines[playLine];

  /** Klick im Live-Player: erst alle Zeilen, dann die Entscheidungen. */
  const advance = () => {
    if (!currentScene) return;
    if (playLine + 1 < currentScene.lines.length) {
      setPlayLine(playLine + 1);
      return;
    }
    // Szene zu Ende → nichts weiter (Entscheidungen werden geklickt).
  };

  const goToScene = (targetTitle: string) => {
    const target = resolveSceneTarget(targetTitle, script.scenes);
    if (target) {
      setPlayScene(script.scenes.indexOf(target));
      setPlayLine(0);
    }
  };

  return (
    <div
      className={className}
      data-testid="visual-novel-transmuter-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎮 Visual Novel Transmuter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {script.sceneCount} Szenen · {script.lineCount} Zeilen · {script.choiceCount} Entscheidungen · Ø {avg} Zeilen
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Titel
        <input
          data-testid="vn-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Manuskript
        <textarea
          data-testid="vn-prose-input"
          value={prose}
          onChange={(e) => {
            setProse(e.target.value);
            setPlayScene(0);
            setPlayLine(0);
          }}
          rows={7}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Prüfung */}
      <div
        data-testid="vn-validation"
        style={{
          border: `1px solid ${validation.valid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SKRIPT-PRÜFUNG</div>
        <div
          data-testid="vn-valid"
          style={{ fontWeight: 700, color: validation.valid ? "var(--success)" : "var(--error)" }}
        >
          {validation.valid ? "✓ Skript gültig" : `✗ ${validation.errors.length} Fehler`}
        </div>
        {validation.brokenJumps.length > 0 && (
          <div data-testid="vn-broken-jumps" style={{ marginTop: 4, color: "var(--error)" }}>
            Kaputte Sprünge: {validation.brokenJumps.join("; ")}
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div data-testid="vn-warnings" style={{ marginTop: 4, color: "var(--warn)" }}>
            {validation.warnings.join("; ")}
          </div>
        )}
      </div>

      {/* Live-Player */}
      <div
        data-testid="vn-player"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 6,
          padding: 14,
          marginBottom: 14,
          minHeight: 160,
          background: "var(--panel)",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
          LIVE-PLAYER — Szene {playScene + 1} von {script.sceneCount}
        </div>

        {currentScene ? (
          <>
            <div data-testid="vn-player-title" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
              {currentScene.title}
            </div>
            {currentScene.background && (
              <div data-testid="vn-player-bg" style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
                Hintergrund: {currentScene.background}
              </div>
            )}

            {currentLine ? (
              <div
                data-testid="vn-player-dialogue"
                onClick={advance}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: 12,
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
                  {currentLine.speaker}
                  {currentLine.emotion && (
                    <span data-testid="vn-player-emotion" style={{ fontWeight: 400, color: "var(--muted)" }}>
                      {" "}[{currentLine.emotion}]
                    </span>
                  )}
                </div>
                <div>„{currentLine.text}"</div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>
                  Klicken für die nächste Zeile ({playLine + 1}/{currentScene.lines.length})
                </div>
              </div>
            ) : (
              <div data-testid="vn-player-end" style={{ fontSize: 12, color: "var(--muted)" }}>
                (Keine Dialogzeilen in dieser Szene.)
              </div>
            )}

            {/* Entscheidungen */}
            {currentScene.choices.length > 0 && playLine + 1 >= currentScene.lines.length && (
              <div data-testid="vn-player-choices" style={{ marginTop: 10 }}>
                {currentScene.choices.map((choice, i) => (
                  <button
                    key={i}
                    data-testid={`vn-choice-${i}`}
                    onClick={() => goToScene(choice.target)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      margin: "4px 0",
                      padding: "8px 12px",
                      background: "var(--bg)",
                      color: "var(--fg)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {choice.label} →
                  </button>
                ))}
              </div>
            )}

            <button
              data-testid="vn-player-reset"
              onClick={() => {
                setPlayScene(0);
                setPlayLine(0);
              }}
              style={{
                marginTop: 10,
                fontSize: 10,
                padding: "3px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: "var(--bg)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              ↺ Von vorn
            </button>
          </>
        ) : (
          <div data-testid="vn-player-empty" style={{ fontSize: 12, color: "var(--muted)" }}>
            Kein Skript vorhanden.
          </div>
        )}
      </div>

      {/* Export */}
      <div data-testid="vn-export" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["renpy", "twine"] as const).map((k) => (
            <button
              key={k}
              data-testid={`vn-export-${k}`}
              onClick={() => setExportKind(k)}
              aria-pressed={exportKind === k}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
                background: exportKind === k ? "var(--accent)" : "var(--panel)",
                color: exportKind === k ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {k === "renpy" ? "Ren'Py (.rpy)" : "Twine 2 (HTML)"}
            </button>
          ))}
        </div>
        <pre
          data-testid="vn-export-output"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            maxHeight: 220,
            overflow: "auto",
          }}
        >
          {exported}
        </pre>
      </div>
    </div>
  );
}
