// Wasserzeichen-Entferner Panel
import { useState } from "react";
import {
  analyzeText,
  generateAntiWatermarkPrompt,
  stripInvisibleUnicode,
  formatReport,
  type WatermarkReport,
} from "@/services/writing/watermark";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { completeOnce } from "@/services/llm";
import "@/components/KIPanel/ki.css";

interface WashResult {
  cleaned: string;
  preReport: WatermarkReport;
  postReport: WatermarkReport;
}

export function WatermarkPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<WashResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [temperature, setTemperature] = useState(0.85);
  const { settings } = useActiveModel();

  function handleAnalyze() {
    if (!input.trim()) return;
    const report = analyzeText(input);
    setResult({
      cleaned: "",
      preReport: report,
      postReport: report,
    });
  }

  async function handleWash() {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const preReport = analyzeText(input);
      const prompt = generateAntiWatermarkPrompt(input, preReport);
      
      // LLM-Call mit angepasster Temperature
      const customSettings = { ...settings, temperature };
      const cleaned = await completeOnce(customSettings, prompt);
      
      const postReport = analyzeText(cleaned);
      setResult({ cleaned, preReport, postReport });
    } finally {
      setBusy(false);
    }
  }

  function handleCleanUnicode() {
    if (!input.trim()) return;
    const cleaned = stripInvisibleUnicode(input);
    setInput(cleaned);
    handleAnalyze();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="watermark-panel">
      <div className="watermark-header">
        <h2>💧 Wasserzeichen-Entferner</h2>
        <p className="watermark-subtitle">Statistische KI-Marker erkennen und entfernen</p>
      </div>

      <div className="watermark-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="KI-Text hier einfügen..."
          rows={8}
        />
        <div className="watermark-actions">
          <button className="btn-analyze" onClick={handleAnalyze} disabled={!input.trim()}>
            Analysieren
          </button>
          <button className="btn-wash" onClick={handleWash} disabled={busy || !input.trim()}>
            {busy ? "Wird gewaschen..." : "Waschen"}
          </button>
          <button className="btn-unicode" onClick={handleCleanUnicode} disabled={!input.trim()}>
            Unicode bereinigen
          </button>
        </div>
      </div>

      <div className="watermark-settings">
        <div className="input-group">
          <label>Temperature: {temperature.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {result && !result.cleaned && (
        <div className="watermark-report">
          <h3>📊 Analyse</h3>
          <pre className="report-output">{formatReport(result.preReport)}</pre>
          <div className="ai-score-bar">
            <div
              className="ai-score-fill"
              style={{ width: `${result.preReport.aiScore}%` }}
            />
          </div>
          <p className="score-label">
            KI-Wahrscheinlichkeit: {result.preReport.aiScore.toFixed(1)}%
          </p>
        </div>
      )}

      {result?.cleaned && (
        <div className="watermark-result">
          <div className="result-tabs">
            <button className="active">Gewaschen</button>
          </div>
          
          <div className="comparison">
            <div className="comparison-side">
              <h4>Vorher</h4>
              <pre>{formatReport(result.preReport)}</pre>
              <div className="ai-score-bar">
                <div className="ai-score-fill" style={{ width: `${result.preReport.aiScore}%` }} />
              </div>
            </div>
            <div className="comparison-side">
              <h4>Nachher</h4>
              <pre>{formatReport(result.postReport)}</pre>
              <div className="ai-score-bar">
                <div className="ai-score-fill improved" style={{ width: `${result.postReport.aiScore}%` }} />
              </div>
            </div>
          </div>

          <div className="cleaned-output">
            <h4>Bereinigter Text</h4>
            <textarea value={result.cleaned} readOnly rows={8} />
            <button onClick={() => copyToClipboard(result.cleaned)}>
              📋 Kopieren
            </button>
          </div>

          {showPrompt && (
            <div className="prompt-output">
              <h4>Verwendeter Prompt</h4>
              <pre>{generateAntiWatermarkPrompt(input, result.preReport)}</pre>
            </div>
          )}
          <button className="btn-toggle" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? "Prompt ausblenden" : "Prompt anzeigen"}
          </button>
        </div>
      )}
    </div>
  );
}
