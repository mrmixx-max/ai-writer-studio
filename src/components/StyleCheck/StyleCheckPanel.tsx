// Stil-Analyse: UI-Panel.
import { useState, useCallback } from "react";
import { analyzeStyle, type StyleAnalysis } from "@/services/stylecheck/analyzer";

export function StyleCheckPanel({ text }: { text: string }) {
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);

  const runAnalysis = useCallback(() => {
    if (!text.trim()) return;
    setAnalysis(analyzeStyle(text));
  }, [text]);

  return (
    <div className="stylecheck">
      <h2 className="stylecheck-title">Stil-Analyse</h2>

      {!analysis ? (
        <button className="stylecheck-button" onClick={runAnalysis}>
          Analysieren
        </button>
      ) : (
        <div className="stylecheck-results">
          <div className="stylecheck-score">
            Lesbarkeit: {analysis.readabilityScore}/100
          </div>
          <div className="stylecheck-stats">
            <span>Füllwörter: {analysis.fillerCount}</span>
            <span>Adverbien: {analysis.adverbCount}</span>
            <span>Passiv: {analysis.passiveCount}</span>
            <span>Wiederholungen: {analysis.repetitionCount}</span>
          </div>
          <ul className="stylecheck-issues">
            {analysis.issues.slice(0, 50).map((issue, i) => (
              <li key={i} className={`stylecheck-issue ${issue.type}`}>
                <code>{issue.text}</code> — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
