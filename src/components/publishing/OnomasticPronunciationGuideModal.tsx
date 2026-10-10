// OnomasticPronunciationGuideModal — Lautschrift- & IPA-Leitfaden für Hörbücher.
//
// Meilenstein 64.0 (v7.6.0)
//
// Vier Bausteine:
//   1. Namens-Extraktor (extractProperNames)
//   2. Lautschrift-Generator (generatePronunciation)
//   3. Aussprache-Lexikon (buildPronunciationGuide)
//   4. Anhang-Export (exportGlossaryAppendix)

import { useMemo, useState } from "react";

import {
  buildPronunciationGuide,
  createSampleAppendix,
  createSamplePronunciationGuide,
  exportGlossaryAppendix,
  extractProperNames,
  generatePronunciation,
  type GlossaryAppendix,
  type ProperNamesResult,
  type PronunciationEntry,
  type PronunciationGuide,
} from "../../services/publishing/onomasticPronunciationGuide";

export interface OnomasticPronunciationGuideModalProps {
  className?: string;
}

const DEFAULT_TEXT =
  "Kailen verließ die Stadt Thornwall, wo König Balthasar den Ring der " +
  "Aurelia hütete. Elowen folgte dem Fluss bis zur Festung Mordred, " +
  "und Tharion trug das Schwert Ysolda über das Gebirge.";

const DEFAULT_NAMES = "Kailen\nAurelia\nMordred\nElowen\nTharion\nYsolda\nBalthasar";

export function OnomasticPronunciationGuideModal({ className }: OnomasticPronunciationGuideModalProps) {
  const [seed, setSeed] = useState<number>(42);
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [names, setNames] = useState<string>(DEFAULT_NAMES);
  const [singleName, setSingleName] = useState<string>("Kailen");

  const rootStyle = {
    background: "var(--bg)",
    color: "var(--fg)",
    padding: 16,
    height: "100%",
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  } as const;

  const sectionStyle = {
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    background: "var(--panel)",
  } as const;

  const headingStyle = {
    margin: "0 0 8px",
    fontSize: 13,
    letterSpacing: 1,
    color: "var(--accent)",
  } as const;

  const labelStyle = { display: "block", margin: "8px 0 4px", color: "var(--muted)" } as const;

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  } as const;

  const textareaStyle = { ...inputStyle, minHeight: 72, resize: "vertical" } as const;

  const monoLine = { color: "var(--fg)", whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const };
  const mutedLine = { color: "var(--muted)" } as const;

  const nameList = useMemo<string[]>(
    () =>
      names
        .split(/\r?\n/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    [names]
  );

  const extracted: ProperNamesResult = useMemo(() => extractProperNames(text), [text]);
  const single: PronunciationEntry = useMemo(() => generatePronunciation(singleName, seed), [singleName, seed]);
  const guide: PronunciationGuide = useMemo(() => buildPronunciationGuide(nameList, seed), [nameList, seed]);
  const appendix: GlossaryAppendix = useMemo(() => exportGlossaryAppendix(guide, seed), [guide, seed]);

  const sampleGuide = useMemo(() => createSamplePronunciationGuide(), []);
  const sampleAppendix = useMemo(() => createSampleAppendix(), []);

  return (
    <div className={className} data-testid="onomastic-pronunciation-modal" style={rootStyle}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--accent)" }}>
        🔊 Aussprache-Lexikon &amp; IPA-Guide für Hörbücher
      </h2>

      <div style={sectionStyle}>
        <label style={labelStyle} htmlFor="onomastic-seed">
          Seed
        </label>
        <input
          id="onomastic-seed"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>NAMENS-EXTRAKTOR</h3>
        <label style={labelStyle} htmlFor="onomastic-text">
          Manuskript-Ausschnitt
        </label>
        <textarea
          id="onomastic-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={textareaStyle}
        />
        <div style={{ marginTop: 8 }}>
          <span style={monoLine}>Erkannte Eigennamen: {extracted.count}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={mutedLine}>Charaktere: {extracted.byType.characters.join(", ") || "—"}</span>
        </div>
        <div style={{ marginTop: 2 }}>
          <span style={mutedLine}>Orte: {extracted.byType.places.join(", ") || "—"}</span>
        </div>
        <div style={{ marginTop: 2 }}>
          <span style={mutedLine}>Artefakte: {extracted.byType.artifacts.join(", ") || "—"}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>LAUTSCHRIFT</h3>
        <label style={labelStyle} htmlFor="onomastic-single">
          Einzelner Eigenname
        </label>
        <input
          id="onomastic-single"
          type="text"
          value={singleName}
          onChange={(e) => setSingleName(e.target.value)}
          style={inputStyle}
        />
        <div style={{ marginTop: 8 }}>
          <span style={monoLine}>IPA: {single.ipa}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={monoLine}>Einfach: {single.simple}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={mutedLine}>Silben: {single.syllables.join(" · ")}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={mutedLine}>Hinweis: {single.notes}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>AUSSPRACHE-LEXIKON</h3>
        <label style={labelStyle} htmlFor="onomastic-names">
          Eigennamen (eine pro Zeile)
        </label>
        <textarea
          id="onomastic-names"
          value={names}
          onChange={(e) => setNames(e.target.value)}
          style={textareaStyle}
        />
        <div style={{ marginTop: 8 }}>
          <span style={mutedLine}>{guide.description}</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)", padding: 4 }}>
                Name
              </th>
              <th style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)", padding: 4 }}>
                IPA
              </th>
              <th style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)", padding: 4 }}>
                Einfache Lautschrift
              </th>
            </tr>
          </thead>
          <tbody>
            {guide.entries.map((entry, idx) => (
              <tr key={`${entry.name}-${idx}`}>
                <td style={{ ...monoLine, borderBottom: "1px solid var(--border)", padding: 4 }}>{entry.name}</td>
                <td style={{ ...monoLine, borderBottom: "1px solid var(--border)", padding: 4 }}>{entry.ipa}</td>
                <td style={{ ...mutedLine, borderBottom: "1px solid var(--border)", padding: 4 }}>{entry.simple}</td>
              </tr>
            ))}
            {guide.entries.length === 0 ? (
              <tr>
                <td style={{ ...mutedLine, padding: 4 }} colSpan={3}>
                  Keine Eigennamen erfasst.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>ANHANG-EXPORT</h3>
        <div>
          <span style={monoLine}>{appendix.title}</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={mutedLine}>
            Seiten: {appendix.pageCount} · Druckfertig: {appendix.printReady ? "ja" : "nein"}
          </span>
        </div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {appendix.sections.map((section) => (
            <div
              key={section.heading}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                flex: "1 1 200px",
              }}
            >
              <div style={{ color: "var(--accent)", marginBottom: 4 }}>{section.heading}</div>
              <div style={mutedLine}>{section.body}</div>
            </div>
          ))}
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>SVG-Vorschau</summary>
          <pre style={{ ...monoLine, marginTop: 8, maxHeight: 200, overflow: "auto" }}>{appendix.svgPreview}</pre>
        </details>
      </div>

      <div style={sectionStyle}>
        <h3 style={headingStyle}>BEISPIEL (DEMO)</h3>
        <div style={mutedLine}>
          Beispieleinträge: {sampleGuide.count} · Anhang-Seiten: {sampleAppendix.pageCount}
        </div>
      </div>
    </div>
  );
}

export default OnomasticPronunciationGuideModal;
