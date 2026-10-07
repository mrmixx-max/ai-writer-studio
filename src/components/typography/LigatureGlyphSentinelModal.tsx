// LigatureGlyphSentinelModal (WP 89.2 UI)
import { useState, useMemo } from "react";
import {
  scanAndReport,
  applyZWNJAtBoundaries as _applyZWNJAtBoundaries,
  createSampleReport as _createSampleReport,
  createSampleText,
  type LigatureReport as _LigatureReport,
} from "@/services/typography/ligatureGlyphSentinel";

export interface LigatureGlyphSentinelModalProps {
  className?: string;
}

export function LigatureGlyphSentinelModal({ className }: LigatureGlyphSentinelModalProps) {
  const [inputText, setInputText] = useState(createSampleText());
  const [autoCorrect, setAutoCorrect] = useState(true);

  const report = useMemo(() => scanAndReport(inputText), [inputText]);
  const correctedText = autoCorrect ? report.correctedText : inputText;

  return (
    <div
      className={className}
      data-testid="ligature-sentinel-modal"
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
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔤 Ligaturen- & Morphemgrenzen-Wächter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Zeichen: {inputText.length} · Verletzungen: {report.violations.length} · ZWNJ eingefügt: {report.zwNJInserted}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          <input
            type="checkbox"
            checked={autoCorrect}
            onChange={e => setAutoCorrect(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Auto-Korrektur (ZWNJ einfügen)
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
            Originaltext
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              style={{
                width: "100%",
                minHeight: 200,
                padding: 8,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--fg)",
              }}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
            {autoCorrect ? "Korrigierter Text (mit ZWNJ)" : "Originaltext (unverändert)"}
            <textarea
              value={correctedText}
              readOnly
              style={{
                width: "100%",
                minHeight: 200,
                padding: 8,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--fg)",
              }}
            />
          </label>
        </div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 STATISTIKEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Gesamte Ligaturen:</strong> {report.stats.totalLigatures}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Korrigiert:</strong> {report.stats.violationsFixed}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--success)", borderRadius: 4, background: "rgba(0,255,0,0.1)" }}>
            <strong>ZWNJ eingefügt:</strong> {report.stats.zwNJInserted}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Morphemgrenzen:</strong> {report.morphemeBoundaries.length}
          </div>
        </div>
      </details>

      {report.violations.length > 0 && (
        <details style={{ marginBottom: 12 }} open>
          <summary style={{ fontSize: 11, color: "var(--error)", cursor: "pointer", fontWeight: 700 }}>
            ⚠️ LIGATUR-VERLETZUNGEN ({report.violations.length})
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
            {report.violations.map((v, i) => (
              <div key={i} style={{ padding: 8, border: "1px solid var(--error)", borderRadius: 4, background: "rgba(255,0,0,0.05)" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    Position: {v.position}
                  </span>
                  <span style={{ color: "var(--error)" }}>
                    {v.severity.toUpperCase()}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                  <span style={{ color: "var(--error)" }}>Original:</span> <code>{v.original}</code>
                </div>
                <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                  <span style={{ color: "var(--success)" }}>Korrigiert:</span> <code>{v.corrected}</code>
                </div>
                <div style={{ marginTop: 2, color: "var(--muted)", fontSize: 10 }}>
                  Regel: {v.rule}
                </div>
                <div style={{ marginTop: 2, color: "var(--muted)", fontSize: 9 }}>
                  Kontext: {v.context}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔍 MORPHEMGRENZEN-DETAILS ({report.morphemeBoundaries.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
          {report.morphemeBoundaries.map((b, i) => (
            <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>Pos: {b.position}</span>
                <span>{b.leftMorpheme}</span>
                <span style={{ color: "var(--accent)" }}>|</span>
                <span>{b.rightMorpheme}</span>
                <span style={{ color: b.needsZWNJ ? "var(--success)" : "var(--muted)" }}>
                  {b.needsZWNJ ? "✓ ZWNJ nötig" : "—"}
                </span>
              </div>
              <div style={{ marginTop: 2, color: "var(--muted)", fontSize: 9 }}>{b.reason}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 UNTERSTÜTZTE LIGATUR-REGELN
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.8, color: "var(--fg)" }}>
          <div style={{ marginBottom: 4 }}>
            <strong>Standard-Ligaturen (an Morphemgrenzen vermeiden):</strong>
          </div>
          <div style={{ marginLeft: 16, color: "var(--muted)" }}>
            fi, fl, ff, ffi, ffl, ft, st
          </div>
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <strong>Fraktur / Lang-s Ligaturen:</strong>
          </div>
          <div style={{ marginLeft: 16, color: "var(--muted)" }}>
            ſs, ſt, ſl, ſh, ch, ck
          </div>
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <strong>Technik:</strong> Zero Width Non-Joiner (ZWNJ, U+200C) wird an erkannten
            Morphemgrenzen eingefügt, um falsche Ligaturen im Satz zu verhindern.
          </div>
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <strong>Export:</strong> Text mit ZWNJ ist kompatibel mit InDesign, PDF-Engines,
            EPUB-Renderern und modernen Browsern.
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📖 BEISPIEL-TEXTE ZUM TESTEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
          {[
            "Auf-fahrt schlaf-los Schiff-fahrt Auf-trag Ein-stieg",
            "Zu-cker Dach-decker Haus-meis-ter Brief-träger",
            "An-fang Auf-hören Mit-arbeiter Zusammen-arbeit",
            "Un-ter-stütz-ung Über-haupt Be-deut-sam-keit",
          ].map((text, i) => (
            <button
              key={i}
              onClick={() => setInputText(text)}
              style={{
                padding: "6px 10px",
                textAlign: "left",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}