// CipherWheelPropStudioModal (Meilenstein 62.0 UI, v7.4.0)
import { useState, useMemo } from "react";
import {
  buildCipherWheel,
  buildCardanGrille,
  buildAssemblyInstructions,
  createSampleCipherWheel,
  createSampleCardanGrille,
} from "@/services/security/cipherWheelPropStudio";

export interface CipherWheelPropStudioModalProps {
  className?: string;
}

type CipherWheelResult = ReturnType<typeof buildCipherWheel>;
type CardanGrilleResult = ReturnType<typeof buildCardanGrille>;
type AssemblyResult = ReturnType<typeof buildAssemblyInstructions>;

const sectionStyle = {
  marginBottom: 12,
} as const;

const summaryStyle = {
  fontSize: 11,
  color: "var(--accent)",
  cursor: "pointer",
  fontWeight: 700,
} as const;

const inputStyle = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--fg)",
} as const;

const textareaStyle = {
  width: "100%",
  marginTop: 4,
  padding: "8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--fg)",
} as const;

const preStyle = {
  marginTop: 8,
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 9,
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre-wrap",
  background: "var(--panel)",
  color: "var(--fg)",
  maxHeight: 260,
  overflow: "auto",
} as const;

const buttonStyle = {
  padding: "8px 16px",
  background: "var(--accent)",
  color: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
} as const;

const svgContainerStyle = {
  marginTop: 8,
  padding: 8,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--panel)",
  display: "flex",
  justifyContent: "center",
} as const;

export function CipherWheelPropStudioModal({
  className,
}: CipherWheelPropStudioModalProps) {
  // Gemeinsame Eingaben
  const [seed, setSeed] = useState(42);
  const [alphabet, setAlphabet] = useState("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ");
  const [ringCount, setRingCount] = useState(3);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState("KARTE");
  const [gridSize, setGridSize] = useState(8);
  const [coverText, setCoverText] = useState(
    "DIE ALTE KARTE LIEGT VERBORGEN UNTER DEM LOSEN BRETT IM KAMINSTOCK"
  );

  // Ergebnisse
  const [wheel, setWheel] = useState<CipherWheelResult | null>(null);
  const [grille, setGrille] = useState<CardanGrilleResult | null>(null);
  const [assembly, setAssembly] = useState<AssemblyResult | null>(null);
  const [error, setError] = useState<string>("");

  const sampleWheel = useMemo(() => createSampleCipherWheel(), []);
  const sampleGrille = useMemo(() => createSampleCardanGrille(), []);

  // ----- Chiffrier-Drehscheibe -----
  const handleBuildWheel = () => {
    setError("");
    try {
      const result = buildCipherWheel(
        { alphabet, ringCount, offset },
        seed
      );
      setWheel(result);
    } catch (e) {
      setError(String(e));
    }
  };

  // ----- Cardan-Gitter -----
  const handleBuildGrille = () => {
    setError("");
    try {
      const result = buildCardanGrille(
        { text: coverText, message, gridSize },
        seed
      );
      setGrille(result);
    } catch (e) {
      setError(String(e));
    }
  };

  // ----- Bastel-Anleitung -----
  const handleBuildAssembly = () => {
    setError("");
    try {
      const result = buildAssemblyInstructions(seed);
      setAssembly(result);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className={className}
      data-testid="cipher-wheel-modal"
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
        🔐 Drehscheiben-Chiffre & Cardan-Lochmaske
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Konzentrische Chiffrier-Drehscheibe · Cardan-Gitter-Lochmaske · Bastel-Anleitung · 100% lokal
      </div>

      {error && (
        <div
          data-testid="cipher-wheel-error"
          style={{
            marginBottom: 12,
            padding: 8,
            border: "1px solid var(--accent)",
            borderRadius: 4,
            color: "var(--fg)",
            fontSize: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Gemeinsame Eingaben                                               */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-eingaben" style={summaryStyle}>
          📝 EINGABEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Seed
            <input
              data-testid="input-seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Ring-Anzahl
            <input
              data-testid="input-ringcount"
              type="number"
              min="2"
              max="6"
              value={ringCount}
              onChange={(e) => setRingCount(Math.max(2, Math.min(6, Number(e.target.value) || 2)))}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Offset
            <input
              data-testid="input-offset"
              type="number"
              min="0"
              value={offset}
              onChange={(e) => setOffset(Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
            Gitter-Größe
            <input
              data-testid="input-gridsize"
              type="number"
              min="3"
              max="16"
              value={gridSize}
              onChange={(e) => setGridSize(Math.max(3, Math.min(16, Number(e.target.value) || 3)))}
              style={inputStyle}
            />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Alphabet
          <input
            data-testid="input-alphabet"
            type="text"
            value={alphabet}
            onChange={(e) => setAlphabet(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Geheime Nachricht
          <input
            data-testid="input-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Cover-Text
          <textarea
            data-testid="input-covertext"
            value={coverText}
            onChange={(e) => setCoverText(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
        </label>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* CHIFFRIER-DREHSCHEIBE                                             */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-wheel" style={summaryStyle}>
          🎡 CHIFFRIER-DREHSCHEIBE
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-build-wheel"
            onClick={handleBuildWheel}
            style={buttonStyle}
          >
            🔧 Drehscheibe bauen
          </button>
        </div>

        {wheel && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {wheel.ringCount} Ringe · Mittelloch r={wheel.centerHoleRadius}
            </div>
            <div data-testid="wheel-svg" style={svgContainerStyle}>
              <div dangerouslySetInnerHTML={{ __html: wheel.svg }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Ringe (Alphabet pro Ring)
            </div>
            <pre data-testid="wheel-rings" style={preStyle}>
              {wheel.rings
                .map((r) => `Ring ${r.index}: ${r.alphabet} (Drehung ${r.rotation}°)`)
                .join("\n")}
            </pre>
          </div>
        )}

        <details style={{ marginTop: 8 }}>
          <summary data-testid="summary-wheel-sample" style={summaryStyle}>
            🎁 Beispiel-Drehscheibe
          </summary>
          <div data-testid="wheel-sample" style={svgContainerStyle}>
            <div dangerouslySetInnerHTML={{ __html: sampleWheel.svg }} />
          </div>
        </details>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* CARDAN-GITTER                                                     */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-grille" style={summaryStyle}>
          🕵️ CARDAN-GITTER
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-build-grille"
            onClick={handleBuildGrille}
            style={buttonStyle}
          >
            🔧 Gitter bauen
          </button>
        </div>

        {grille && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {grille.gridSize}×{grille.gridSize} Raster · {grille.holes.length} Löcher
            </div>
            <div data-testid="grille-svg" style={svgContainerStyle}>
              <div dangerouslySetInnerHTML={{ __html: grille.maskSvg }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Freigelegter Text
            </div>
            <pre data-testid="grille-reveal" style={preStyle}>
              {grille.revealText}
            </pre>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Koordinaten
            </div>
            <pre data-testid="grille-coords" style={preStyle}>
              {grille.coordinates.join(", ")}
            </pre>
          </div>
        )}

        <details style={{ marginTop: 8 }}>
          <summary data-testid="summary-grille-sample" style={summaryStyle}>
            🎁 Beispiel-Gitter
          </summary>
          <div data-testid="grille-sample" style={svgContainerStyle}>
            <div dangerouslySetInnerHTML={{ __html: sampleGrille.maskSvg }} />
          </div>
        </details>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* BASTELANLEITUNG                                                   */}
      {/* ----------------------------------------------------------------- */}
      <details style={sectionStyle} open>
        <summary data-testid="summary-assembly" style={summaryStyle}>
          ✂️ BASTELANLEITUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            data-testid="btn-build-assembly"
            onClick={handleBuildAssembly}
            style={buttonStyle}
          >
            🔧 Anleitung bauen
          </button>
        </div>

        {assembly && (
          <div style={{ marginTop: 8 }}>
            <div data-testid="assembly-svg" style={svgContainerStyle}>
              <div dangerouslySetInnerHTML={{ __html: assembly.svg }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Schritte
            </div>
            <pre data-testid="assembly-steps" style={preStyle}>
              {assembly.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
            </pre>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
              Lösungsschlüssel
            </div>
            <pre data-testid="assembly-key" style={preStyle}>
              {assembly.solutionKey}
            </pre>
          </div>
        )}
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* ERKLÄRUNG                                                         */}
      {/* ----------------------------------------------------------------- */}
      <details>
        <summary data-testid="summary-architektur" style={summaryStyle}>
          📚 VERFAHREN & HINTERGRUND
        </summary>
        <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "var(--fg)" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Chiffrier-Drehscheibe:</strong> Konzentrische Ringe mit Caesar-verschobenen
            Alphabeten. Jeder Ring ist eine feste Buchstabenfolge; die Ringe werden
            übereinander gelegt und mit einer Messingklammer verbunden.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Cardan-Gitter:</strong> Eine Lochmaske mit gezielten Öffnungen. Über einen
            Cover-Text gelegt, legen die Löcher die geheime Botschaft frei.
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Bastel-Anleitung:</strong> Schritt-für-Schritt-Anleitung mit Schnittmarken,
            Falzlinien und Lösungsschlüssel für den Selbstbau.
          </div>
          <div>
            <strong>Hinweis:</strong> Klassische Verfahren – lehrreich für Spionageromane,
            nicht für echte Kryptografie.
          </div>
        </div>
      </details>
    </div>
  );
}
