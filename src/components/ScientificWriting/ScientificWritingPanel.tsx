// Wissenschaftliches Schreiben: Panel für akademische Texte.
import { useState, useCallback } from "react";
import {
  generateScientificOutline,
  generateScientificText,
  rewriteAcademic,
  type ScientificWritingInput,
  type ScientificWorkType,
  type ScientificLevel,
  type ScientificTone,
  type ScientificSection,
  type CitationStyle,
} from "@/services/writing/scientificwriting";

export function ScientificWritingPanel() {
  const [workType, setWorkType] = useState<ScientificWorkType>("hausarbeit");
  const [topic, setTopic] = useState("");
  const [field, setField] = useState("");
  const [level, setLevel] = useState<ScientificLevel>("bachelor");
  const [tone, setTone] = useState<ScientificTone>("sachlich");
  const [section, setSection] = useState<ScientificSection>("einleitung");
  const [rawText, setRawText] = useState("");
  const [sources, setSources] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [result, setResult] = useState<ReturnType<typeof generateScientificText> | null>(null);
  const [outline, setOutline] = useState<ReturnType<typeof generateScientificOutline> | null>(null);
  const [rewriteResult, setRewriteResult] = useState<ReturnType<typeof rewriteAcademic> | null>(null);

  const input: ScientificWritingInput = {
    workType,
    topic,
    field: field || undefined,
    level,
    tone,
    section,
    rawText: rawText || undefined,
    sources: sources.split("\n").filter((s) => s.trim()),
    citationStyle,
  };

  const handleGenerateOutline = useCallback(() => {
    setOutline(generateScientificOutline(input));
  }, [input]);

  const handleGenerateText = useCallback(() => {
    setResult(generateScientificText(input));
  }, [input]);

  const handleRewrite = useCallback(() => {
    setRewriteResult(rewriteAcademic({ inputText: rawText, tone }));
  }, [rawText, tone]);

  return (
    <div className="scientific">
      <h2 className="scientific-title">Wissenschaftliches Schreiben</h2>

      <div className="scientific-grid">
        <div className="scientific-field">
          <label>Arbeitstyp</label>
          <select value={workType} onChange={(e) => setWorkType(e.target.value as ScientificWorkType)}>
            <option value="hausarbeit">Hausarbeit</option>
            <option value="seminararbeit">Seminararbeit</option>
            <option value="essay">Essay</option>
            <option value="expose">Exposé</option>
            <option value="bachelorarbeit">Bachelorarbeit</option>
            <option value="masterarbeit">Masterarbeit</option>
            <option value="abstract">Abstract</option>
            <option value="kapitelentwurf">Kapitelentwurf</option>
          </select>
        </div>

        <div className="scientific-field">
          <label>Thema / Forschungsfrage</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. Auswirkungen von KI auf..." />
        </div>

        <div className="scientific-field">
          <label>Fachgebiet</label>
          <input type="text" value={field} onChange={(e) => setField(e.target.value)} placeholder="z.B. Medienwissenschaft" />
        </div>

        <div className="scientific-field">
          <label>Zielniveau</label>
          <select value={level} onChange={(e) => setLevel(e.target.value as ScientificLevel)}>
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
            <option value="promotion">Promotion</option>
            <option value="allgemein">Allgemein</option>
          </select>
        </div>

        <div className="scientific-field">
          <label>Ton</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as ScientificTone)}>
            <option value="sachlich">Sachlich</option>
            <option value="analytisch">Analytisch</option>
            <option value="kritisch">Kritisch</option>
            <option value="neutral">Neutral</option>
            <option value="akademisch-formal">Akademisch-formal</option>
          </select>
        </div>

        <div className="scientific-field">
          <label>Zielabschnitt</label>
          <select value={section} onChange={(e) => setSection(e.target.value as ScientificSection)}>
            <option value="einleitung">Einleitung</option>
            <option value="theoretischer_rahmen">Theoretischer Rahmen</option>
            <option value="methodik">Methodik</option>
            <option value="analyse">Analyse</option>
            <option value="diskussion">Diskussion</option>
            <option value="schluss">Schluss</option>
          </select>
        </div>

        <div className="scientific-field">
          <label>Zitationsstil</label>
          <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}>
            <option value="APA">APA</option>
            <option value="MLA">MLA</option>
            <option value="Chicago">Chicago</option>
            <option value="Harvard">Harvard</option>
            <option value="IEEE">IEEE</option>
            <option value="deutsch">Deutsch</option>
          </select>
        </div>

        <div className="scientific-field full">
          <label>Stichpunkte / Rohtext</label>
          <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={4} placeholder="Rohtext oder Stichpunkte..." />
        </div>

        <div className="scientific-field full">
          <label>Quellen (eine pro Zeile)</label>
          <textarea value={sources} onChange={(e) => setSources(e.target.value)} rows={3} placeholder="Müller (2023)&#10;Schmidt et al. (2022)" />
        </div>
      </div>

      <div className="scientific-actions">
        <button className="scientific-button" onClick={handleGenerateOutline} disabled={!topic.trim()}>
          Gliederung erzeugen
        </button>
        <button className="scientific-button" onClick={handleGenerateText} disabled={!topic.trim()}>
          Text erzeugen
        </button>
        <button className="scientific-button secondary" onClick={handleRewrite} disabled={!rawText.trim()}>
          Umformulieren
        </button>
      </div>

      {outline && (
        <div className="scientific-result">
          <h3>Gliederung</h3>
          <ul className="scientific-outline">
            {outline.outline.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="scientific-rationale">{outline.rationale}</p>
        </div>
      )}

      {result && (
        <div className="scientific-result">
          <h3>Text</h3>
          <p className="scientific-text">{result.text}</p>

          {result.warnings.length > 0 && (
            <div className="scientific-warnings">
              <h4>Warnungen</h4>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {result.citationHints.length > 0 && (
            <div className="scientific-citations">
              <h4>Zitation-Hinweise</h4>
              <ul>
                {result.citationHints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {rewriteResult && (
        <div className="scientific-result">
          <h3>Umformuliert</h3>
          <p className="scientific-text">{rewriteResult.rewritten}</p>
          <h4>Änderungen</h4>
          <ul>
            {rewriteResult.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
