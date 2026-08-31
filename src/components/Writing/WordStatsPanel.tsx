// WordStatsPanel: Wort-Statistiken für den aktuellen Text.
import { useState, useEffect } from "react";
import { computeWordStats, type WordStats } from "@/services/writing/wordstats";

export function WordStatsPanel() {
  const [stats, setStats] = useState<WordStats | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    // Text aus dem Editor holen (via CustomEvent oder localStorage)
    const saved = localStorage.getItem("editor-text-preview") || "";
    setText(saved);
    setStats(computeWordStats(saved));
  }, []);

  const handleAnalyze = () => {
    setStats(computeWordStats(text));
  };

  if (!stats) return <div className="plugin-panel">Lade Statistiken...</div>;

  return (
    <div className="plugin-panel wordstats-panel">
      <h3>📊 Wort-Statistiken</h3>

      <div className="ws-grid">
        <div className="ws-stat"><span className="ws-num">{stats.totalWords.toLocaleString()}</span><span className="ws-label">Wörter</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.totalChars.toLocaleString()}</span><span className="ws-label">Zeichen</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.totalSentences}</span><span className="ws-label">Sätze</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.totalParagraphs}</span><span className="ws-label">Absätze</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.readingTimeMin} min</span><span className="ws-label">Lesezeit</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.uniqueWords}</span><span className="ws-label">Einzigartige Wörter</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.avgWordsPerSentence}</span><span className="ws-label">Wörter/Satz</span></div>
        <div className="ws-stat"><span className="ws-num">{stats.avgSentencesPerParagraph}</span><span className="ws-label">Sätze/Absatz</span></div>
      </div>

      <div className="ws-richness">
        <label>Vokabular-Reichtum</label>
        <div className="ws-bar"><div className="ws-bar-fill" style={{ width: `${stats.vocabularyRichness}%` }} /></div>
        <span className="ws-pct">{stats.vocabularyRichness}%</span>
      </div>

      <details className="ws-topwords">
        <summary>Top 20 Wörter</summary>
        <ul>
          {stats.topWords.map((w) => (
            <li key={w.word}>
              <span className="ws-word">{w.word}</span>
              <span className="ws-count">{w.count}×</span>
            </li>
          ))}
        </ul>
      </details>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text hier einfügen oder aus Editor laden..."
        className="ws-input"
      />
      <button onClick={handleAnalyze} className="ws-btn">Analysieren</button>
    </div>
  );
}
