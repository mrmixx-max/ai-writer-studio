// Zeitungs-UI (Sprint 16, Agent 5): standalone Panel für den Zeitungsgenerator.
//
// Struktur angelehnt an `src/components/Images/ImageGenPanel.tsx`
// (Sections mit Label + Feld, Generate-Button mit Loading-State,
// Fehler-Box, Ergebnis-Vorschau) — aber bewusst entkoppelt:
// kein Settings-Store, kein Provider-Import. Die eigentliche
// Artikel-Erzeugung kommt über die injizierbare `generateArticles`-Prop,
// der Zeitungs-Export über `onExportNewspaper`.
// So ist das Panel ohne Backend test- und wiederverwendbar.

import { useState, useCallback } from "react";

export type NewsLanguage = "de" | "en";

export interface GeneratedNewsArticle {
  id: string;
  headline: string;
  teaser: string;
  imageUrl?: string;
  source?: string;
}

export interface NewsGeneratorPanelProps {
  /** Erzeugt Artikelvorschauen aus Thema + Sprache. Falls nicht injiziert,
   *  meldet ein eingebauter Fallback, dass kein Generator konfiguriert ist. */
  generateArticles?: (topic: string, language: NewsLanguage) => Promise<GeneratedNewsArticle[]>;
  /** Wird beim Klick auf "Export Newspaper" mit den Artikeln aufgerufen. */
  onExportNewspaper?: (articles: GeneratedNewsArticle[], language: NewsLanguage) => void;
  initialTopic?: string;
  initialLanguage?: NewsLanguage;
}

export const NEWS_LANGUAGES: NewsLanguage[] = ["de", "en"];

export const NEWS_LANGUAGE_LABELS: Record<NewsLanguage, string> = {
  de: "Deutsch",
  en: "English",
};

async function defaultGenerateArticles(): Promise<GeneratedNewsArticle[]> {
  throw new Error(
    "Kein Artikel-Generator konfiguriert — bitte eine generateArticles-Funktion injizieren.",
  );
}

export function NewsGeneratorPanel({
  generateArticles = defaultGenerateArticles,
  onExportNewspaper,
  initialTopic = "",
  initialLanguage = "de",
}: NewsGeneratorPanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [language, setLanguage] = useState<NewsLanguage>(initialLanguage);
  const [busy, setBusy] = useState(false);
  const [articles, setArticles] = useState<GeneratedNewsArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      setError("Bitte ein Thema eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    setArticles([]);
    setExported(false);
    try {
      const result = await generateArticles(topic.trim(), language);
      setArticles(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [topic, language, generateArticles]);

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

      <button
        type="button"
        data-testid="news-gen-generate"
        className="news-gen-button"
        onClick={generate}
        disabled={busy}
      >
        {busy ? "Sucht & Generiert …" : "Search & Generate"}
      </button>

      {error && (
        <div className="news-gen-error" data-testid="news-gen-error" role="alert">
          {error}
        </div>
      )}

      {articles.length > 0 && (
        <div className="news-gen-results" data-testid="news-gen-preview">
          {articles.map((a) => (
            <article key={a.id} className="news-gen-card" data-testid={`news-gen-article-${a.id}`}>
              {a.imageUrl && (
                <img src={a.imageUrl} alt={a.headline} className="news-gen-img" />
              )}
              <h3 className="news-gen-headline">{a.headline}</h3>
              <p className="news-gen-teaser">{a.teaser}</p>
              {a.source && <div className="news-gen-source">{a.source}</div>}
            </article>
          ))}
          <button
            type="button"
            data-testid="news-gen-export"
            className="news-gen-button"
            onClick={exportNewspaper}
            disabled={busy}
          >
            {exported ? "Newspaper exportiert ✓" : "Export Newspaper"}
          </button>
        </div>
      )}
    </div>
  );
}
