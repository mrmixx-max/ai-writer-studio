// Zeitungs-UI (Sprint 29): Vollautomatischer Zeitungsgenerator.
// Demo + optional LLM via Ollama.
import { useState, useCallback, useEffect } from "react";
import {
  generateNewsArticles,
  isOllamaAvailable,
  type GenerateOptions,
} from "@/services/news/newsGenerator";

export type NewsLanguage = "de" | "en";

export interface GeneratedNewsArticle {
  id: string;
  headline: string;
  teaser: string;
  body?: string;
  imageUrl?: string;
  source?: string;
}

export type GenerationMode = "demo" | "llm" | "hybrid";

export interface NewsGeneratorPanelProps {
  onExportNewspaper?: (articles: GeneratedNewsArticle[], language: NewsLanguage) => void;
  initialTopic?: string;
  initialLanguage?: NewsLanguage;
}

export const NEWS_LANGUAGES: NewsLanguage[] = ["de", "en"];
export const NEWS_LANGUAGE_LABELS: Record<NewsLanguage, string> = {
  de: "Deutsch",
  en: "English",
};

export function NewsGeneratorPanel({
  onExportNewspaper,
  initialTopic = "",
  initialLanguage = "de",
}: NewsGeneratorPanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [language, setLanguage] = useState<NewsLanguage>(initialLanguage);
  const [mode, setMode] = useState<GenerationMode>("demo");
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [articles, setArticles] = useState<GeneratedNewsArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  useEffect(() => {
    isOllamaAvailable().then(setOllamaAvailable);
  }, []);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      setError("Bitte ein Thema eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    setArticles([]);
    setExported(false);

    const opts: GenerateOptions = {
      topic: topic.trim(),
      language,
      count,
      useLLM: mode !== "demo",
      llmModel: "llama3.2",
    };

    try {
      const result = await generateNewsArticles(opts);
      setArticles(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [topic, language, count, mode]);

  const generateRandom = useCallback(async () => {
    const topics = [
      "Künstliche Intelligenz",
      "Klimawandel",
      "Wirtschaft",
      "Gesundheit",
      "Technologie",
      "Sport",
      "Politik",
      "Kultur",
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    setTopic(randomTopic);
    setBusy(true);
    setError(null);
    setArticles([]);
    setExported(false);

    try {
      const result = await generateNewsArticles({
        topic: randomTopic,
        language,
        count,
        useLLM: mode !== "demo",
        llmModel: "llama3.2",
      });
      setArticles(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [language, count, mode]);

  const exportNewspaper = useCallback(() => {
    if (articles.length === 0) return;
    onExportNewspaper?.(articles, language);
    setExported(true);
  }, [articles, language, onExportNewspaper]);

  return (
    <div className="news-gen" data-testid="news-gen-panel">
      <h2 className="news-gen-title">Zeitungsgenerator</h2>

      <div className="news-gen-section">
        <label className="news-gen-label" htmlFor="news-gen-topic">
          Thema
        </label>
        <input
          id="news-gen-topic"
          data-testid="news-gen-topic"
          className="news-gen-input"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="z. B. Künstliche Intelligenz in Europa …"
          disabled={busy}
        />
      </div>

      <div className="news-gen-section">
        <label className="news-gen-label" htmlFor="news-gen-language">
          Sprache
        </label>
        <select
          id="news-gen-language"
          data-testid="news-gen-language"
          className="news-gen-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as NewsLanguage)}
          disabled={busy}
        >
          {NEWS_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {NEWS_LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      <div className="news-gen-section">
        <label className="news-gen-label" htmlFor="news-gen-count">
          Artikelanzahl
        </label>
        <input
          id="news-gen-count"
          data-testid="news-gen-count"
          className="news-gen-input"
          type="number"
          min={1}
          max={12}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
          disabled={busy}
        />
      </div>

      <div className="news-gen-section">
        <label className="news-gen-label">Modus</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["demo", "llm", "hybrid"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={busy || (m !== "demo" && !ollamaAvailable)}
              style={{
                padding: "6px 12px",
                background: mode === m ? "#ffa028" : "#111",
                color: mode === m ? "#000" : "#aaa",
                border: `1px solid ${mode === m ? "#ffa028" : "#333"}`,
                cursor: busy || (m !== "demo" && !ollamaAvailable) ? "not-allowed" : "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        {!ollamaAvailable && (
          <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
            Ollama nicht erreichbar — nur Demo-Modus verfügbar.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          data-testid="news-gen-generate"
          className="news-gen-button"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Generiert …" : "Generieren"}
        </button>
        <button
          type="button"
          data-testid="news-gen-auto"
          className="news-gen-button"
          onClick={generateRandom}
          disabled={busy}
          style={{ background: "#44ff88" }}
        >
          🎲 Vollautomatisch
        </button>
      </div>

      {error && (
        <div className="news-gen-error" data-testid="news-gen-error" role="alert">
          {error}
        </div>
      )}

      {articles.length > 0 && (
        <div data-testid="news-gen-results">
          <h3 style={{ color: "#ffa028", fontSize: 14, margin: "12px 0 8px" }}>
            {articles.length} Artikel generiert
          </h3>
          {articles.map((a) => (
            <div
              key={a.id}
              data-testid={`news-article-${a.id}`}
              style={{
                background: "#111",
                border: "1px solid #333",
                padding: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{a.headline}</div>
              <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>{a.teaser}</div>
              {a.body && (
                <div style={{ color: "#888", fontSize: 11, marginTop: 6 }}>{a.body}</div>
              )}
              <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>{a.source}</div>
            </div>
          ))}
          <button
            type="button"
            data-testid="news-gen-export"
            className="news-gen-button"
            onClick={exportNewspaper}
            style={{ marginTop: 8 }}
          >
            {exported ? "✓ Exportiert" : "Exportieren"}
          </button>
        </div>
      )}
    </div>
  );
}
