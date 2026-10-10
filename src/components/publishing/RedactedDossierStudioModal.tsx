// RedactedDossierStudioModal (Meilenstein 57.0 / v6.9.0)
import { useState, useMemo } from "react";
import {
  redactText,
  generateOfficialStamp,
  buildDossierExport,
  createSampleRedactedText,
  createSampleDossierExport,
} from "@/services/publishing/redactedDossierStudio";

export interface RedactedDossierStudioModalProps {
  className?: string;
}

const CLASSIFICATION_OPTIONS = [
  "TOP SECRET / EYES ONLY",
  "BND STRENG GEHEIM",
  "KGB СОВЕРШЕННО СЕКРЕТНО",
  "DECLASSIFIED",
] as const;

const SAMPLE_TEXT =
  "Der Informant, Codename NACHTFALCON, traf sich am 14. März mit einem " +
  "unkontaktierten Offizier der regulären Streitkräfte in einem Parkhaus " +
  "nahe der Hauptverkehrsader. Übergeben wurde ein Mikrofilm, der Aufnahmen " +
  "von Waffenlieferungen an eine nicht genannte Organisation enthielt.";

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "4px 8px",
  fontSize: 11,
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  flex: 1,
  minWidth: 120,
};

export function RedactedDossierStudioModal({ className }: RedactedDossierStudioModalProps) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [redactionRatio, setRedactionRatio] = useState(0.35);
  const [classification, setClassification] = useState<string>("BND STRENG GEHEIM");
  const [title, setTitle] = useState("AKTE NACHTFALCON — Lagebericht");
  const [content, setContent] = useState(SAMPLE_TEXT);
  const [seed, setSeed] = useState(42);

  const redaction = useMemo(
    () => redactText(text, redactionRatio, seed),
    [text, redactionRatio, seed]
  );

  const stamp = useMemo(
    () => generateOfficialStamp(classification, seed),
    [classification, seed]
  );

  const dossier = useMemo(
    () => buildDossierExport(title, content, classification, seed),
    [title, content, classification, seed]
  );

  const sampleText = useMemo(() => createSampleRedactedText(), []);
  const sampleDossier = useMemo(() => createSampleDossierExport(), []);

  return (
    <div
      className={className}
      data-testid="redacted-dossier-modal"
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
        🔒 Streng-Geheim-Dossier &amp; Schwärzungs-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {redaction.redactionCount} Schwärzungen · {Math.round(redaction.redactionRatio * 100)} % ·
        Klassifizierung: {redaction.classification}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={labelStyle}>
          Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Klassifizierung
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            style={inputStyle}
          >
            {CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...labelStyle, minWidth: 110 }}>
          Schwärzungsquote
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={redactionRatio}
            onChange={(e) => setRedactionRatio(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          ██ SCHWÄRZUNG
        </summary>
        <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Originaltext
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </label>
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--bg)",
            fontSize: 11,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {redaction.redactedText}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          🛡️ DIENST-STEMPEL
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{ width: 200, height: 200, flex: "0 0 auto" }}
            dangerouslySetInnerHTML={{ __html: stamp.svg }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            <div>
              <strong style={{ color: "var(--text)" }}>Behörde:</strong> {stamp.agency}
            </div>
            <div>
              <strong style={{ color: "var(--text)" }}>Klassifizierung:</strong>{" "}
              {stamp.classification}
            </div>
            <div>
              <strong style={{ color: "var(--text)" }}>Datum:</strong> {stamp.date}
            </div>
            <div style={{ marginTop: 4, color: "var(--muted)" }}>{stamp.description}</div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          📄 DOSSIER-EXPORT
        </summary>
        <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Dossier-Inhalt
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </label>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          Seiten: {dossier.metadata.pages} · Exemplare: {dossier.metadata.copies} · Datum:{" "}
          {dossier.metadata.date}
        </div>
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "var(--bg)",
            lineHeight: 1.4,
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          {dossier.markdown}
        </pre>
        {dossier.notes.length > 0 && (
          <ul
            style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}
          >
            {dossier.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
      </details>

      <details>
        <summary
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          🗂️ BEISPIEL-DOSSIER
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          {sampleText.redactionCount} Schwärzungen im Beispieltext ·{" "}
          {sampleDossier.metadata.pages} Seiten · {sampleDossier.metadata.copies} Exemplare
        </div>
      </details>
    </div>
  );
}
