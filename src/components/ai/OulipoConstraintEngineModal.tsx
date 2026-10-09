// OulipoConstraintEngineModal (WP 124.1 UI / Meilenstein 60.0 / v7.2.0)
//
// UI für die Oulipo-Zwangs- & Regeldichtungs-Engine:
// Methoden-Auswahl, Echtzeit-Regel-Prüfer und deterministischer Synthesizer.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  CONSTRAINT_METHODS,
  checkConstraint,
  generateConstrainedText,
  createSampleConstraint,
  createSampleConstrainedText,
} from "@/services/ai/oulipoConstraintEngine";

export interface OulipoConstraintEngineModalProps {
  className?: string;
}

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
} as const;

export function OulipoConstraintEngineModal({ className }: OulipoConstraintEngineModalProps) {
  const [methodId, setMethodId] = useState<string>(CONSTRAINT_METHODS[0].id);
  const [seed, setSeed] = useState<number>(42);
  const [length, setLength] = useState<number>(8);
  const [excludedChar, setExcludedChar] = useState<string>("e");
  const [vowel, setVowel] = useState<string>("e");
  const [checkText, setCheckText] = useState<string>(
    "Wind und Sturm tragen den kalten Atem über das Tal.",
  );

  const method = useMemo(
    () => CONSTRAINT_METHODS.find((m) => m.id === methodId) ?? CONSTRAINT_METHODS[0],
    [methodId],
  );

  const options = useMemo(
    () => ({ excludedChar, vowel }),
    [excludedChar, vowel],
  );

  const checkResult = useMemo(
    () => checkConstraint(checkText, methodId, options),
    [checkText, methodId, options],
  );

  const generated = useMemo(
    () => generateConstrainedText(methodId, seed, length),
    [methodId, seed, length],
  );

  const generatedCheck = useMemo(
    () => checkConstraint(generated.text, methodId, options),
    [generated.text, methodId, options],
  );

  const loadSample = () => {
    const sample = createSampleConstraint();
    setMethodId(sample.id);
  };

  const loadSampleText = () => {
    const sample = createSampleConstrainedText();
    setMethodId(sample.method);
    setSeed(42);
    setCheckText(sample.text);
  };

  return (
    <div
      className={className}
      data-testid="oulipo-constraint-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📐 Oulipo-Zwangs- & Regeldichtungs-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {method.name} · Schwierigkeit {method.difficulty}/10 — {method.description}
      </div>

      {/* Parameter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 160 }}>
          Zwangsmethode
          <select
            data-testid="oulipo-method-select"
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            style={inputStyle}
          >
            {CONSTRAINT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (Schwierigkeit {m.difficulty})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input
            data-testid="oulipo-seed-input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Länge (Wörter)
          <input
            data-testid="oulipo-length-input"
            type="number"
            value={length}
            onChange={(e) => setLength(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Verbotener Buchstabe (Lipogramm)
          <input
            data-testid="oulipo-excluded-input"
            type="text"
            maxLength={1}
            value={excludedChar}
            onChange={(e) => setExcludedChar(e.target.value.toLowerCase())}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Erlaubter Vokal (Univokalismus)
          <input
            data-testid="oulipo-vowel-input"
            type="text"
            maxLength={1}
            value={vowel}
            onChange={(e) => setVowel(e.target.value.toLowerCase())}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Beispiel */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          🎲 BEISPIEL LADEN
        </summary>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button
            data-testid="oulipo-load-sample-method"
            onClick={loadSample}
            style={{
              padding: "6px 12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            Beispiel-Methode: {createSampleConstraint().name}
          </button>
          <button
            data-testid="oulipo-load-sample-text"
            onClick={loadSampleText}
            style={{
              padding: "6px 12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            Beispiel-Text (Schneeball, Seed 42)
          </button>
        </div>
      </details>

      {/* REGEL-PRÜFER */}
      <section
        data-testid="oulipo-checker-section"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          ✅ REGEL-PRÜFER
        </h4>
        <textarea
          data-testid="oulipo-check-input"
          value={checkText}
          onChange={(e) => setCheckText(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <div
          data-testid="oulipo-check-result"
          style={{
            marginTop: 10,
            border: `1px solid ${checkResult.valid ? "var(--success)" : "var(--error)"}`,
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
          }}
        >
          <div
            data-testid="oulipo-check-status"
            style={{
              fontWeight: 700,
              color: checkResult.valid ? "var(--success)" : "var(--error)",
              marginBottom: 4,
            }}
          >
            {checkResult.valid ? "✓ ZWANG EINGEHALTEN" : "✗ ZWANG VERLETZT"}
          </div>
          <div data-testid="oulipo-check-score" style={{ color: "var(--muted)" }}>
            Score: {checkResult.score}/100
          </div>
          <div data-testid="oulipo-check-description" style={{ marginTop: 4 }}>
            {checkResult.description}
          </div>

          {checkResult.violations.length > 0 && (
            <ul
              data-testid="oulipo-check-violations"
              style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--muted)" }}
            >
              {checkResult.violations.slice(0, 10).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
              {checkResult.violations.length > 10 && (
                <li>… und {checkResult.violations.length - 10} weitere</li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* SYNTHESIZER */}
      <section
        data-testid="oulipo-synthesizer-section"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
          🧪 SYNTHESIZER
        </h4>

        <div
          data-testid="oulipo-generated-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {generated.text || "— kein Text erzeugt —"}
        </div>

        <div style={{ marginTop: 8, fontSize: 11 }}>
          <div
            data-testid="oulipo-generated-status"
            style={{
              fontWeight: 700,
              color: generatedCheck.valid ? "var(--success)" : "var(--warn)",
            }}
          >
            {generated.valid ? "✓ Zwang eingehalten" : "⚠ Zwang verletzt"} · Score{" "}
            {generatedCheck.score}/100
          </div>
          <div data-testid="oulipo-generated-description" style={{ color: "var(--muted)", marginTop: 4 }}>
            {generated.description}
          </div>
        </div>

        <button
          data-testid="oulipo-use-generated"
          onClick={() => setCheckText(generated.text)}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          → In den Regel-Prüfer übernehmen
        </button>
      </section>

      {/* Methoden-Übersicht */}
      <details data-testid="oulipo-methods-overview">
        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
          📚 FÜNF ZWANGSMETHODEN ({CONSTRAINT_METHODS.length})
        </summary>
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 6,
          }}
        >
          {CONSTRAINT_METHODS.map((m) => (
            <div
              key={m.id}
              data-testid={`oulipo-method-card-${m.id}`}
              style={{
                padding: 8,
                background: "var(--panel)",
                border: `1px solid ${m.id === methodId ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>
                {m.name} · {m.difficulty}/10
              </div>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>{m.description}</div>
              <div style={{ color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>
                {m.example}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>
        Aktiv: {method.name} · {CONSTRAINT_METHODS.length} Methoden · deterministisch (Seed {seed})
      </div>
    </div>
  );
}
