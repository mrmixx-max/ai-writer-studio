// Zeitungs-Vorschau (Sprint 16, Agent 6): standalone Preview + Drucken.
//
// Struktur angelehnt an `src/components/Images/ImageGenPanel.tsx`
// (Sections mit Label + Feld, Buttons mit data-testid, Fehler-freie
// Darstellung, injizierbare Props statt Store) — aber bewusst entkoppelt:
// kein Zeitungsgenerator-Store, kein Backend-Import. Artikel + Bilder
// kommen über Props rein, Drucken geht über `window.print()`,
// Sprache über internen DE/EN-Toggle. So ist die Vorschau ohne
// Backend test- und wiederverwendbar.

import { useState, useCallback } from "react";
import "./newspaper-preview.css";

export type NewspaperLanguage = "de" | "en";

export interface NewspaperArticle {
  id: string;
  headline: string;
  headlineEn?: string;
  body: string;
  bodyEn?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface NewspaperPreviewProps {
  title?: string;
  titleEn?: string;
  articles?: NewspaperArticle[];
  initialLanguage?: NewspaperLanguage;
  initialPage?: number;
  articlesPerPage?: number;
  onPrint?: () => void;
}

const UI_STRINGS: Record<NewspaperLanguage, Record<string, string>> = {
  de: {
    prev: "← Zurück",
    next: "Weiter →",
    print: "Drucken",
    page: "Seite",
    of: "von",
    empty: "Keine Artikel vorhanden.",
  },
  en: {
    prev: "← Previous",
    next: "Next →",
    print: "Print",
    page: "Page",
    of: "of",
    empty: "No articles available.",
  },
};

export function NewspaperPreview({
  title = "Tageszeitung",
  titleEn = "Daily Newspaper",
  articles = [],
  initialLanguage = "de",
  initialPage = 0,
  articlesPerPage = 2,
  onPrint,
}: NewspaperPreviewProps) {
  const [language, setLanguage] = useState<NewspaperLanguage>(initialLanguage);
  const [page, setPage] = useState(initialPage);

  const perPage = Math.max(1, articlesPerPage);
  const pageCount = Math.max(1, Math.ceil(articles.length / perPage));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const visible = articles.slice(safePage * perPage, safePage * perPage + perPage);
  const t = UI_STRINGS[language];

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setPage((p) => Math.min(pageCount - 1, p + 1));
  }, [pageCount]);

  const toggleLanguage = useCallback(() => {
    setLanguage((l) => (l === "de" ? "en" : "de"));
  }, []);

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  }, [onPrint]);

  return (
    <div className="newspaper-preview" data-testid="newspaper-preview" lang={language}>
      <div className="newspaper-toolbar">
        <div
          className="newspaper-lang-toggle"
          role="group"
          aria-label="Language / Sprache"
        >
          <button
            type="button"
            data-testid="newspaper-lang-de"
            className={language === "de" ? "active" : ""}
            aria-pressed={language === "de"}
            onClick={() => setLanguage("de")}
          >
            DE
          </button>
          <button
            type="button"
            data-testid="newspaper-lang-en"
            className={language === "en" ? "active" : ""}
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
          <button
            type="button"
            data-testid="newspaper-lang-toggle"
            onClick={toggleLanguage}
          >
            {language === "de" ? "EN" : "DE"}
          </button>
        </div>
        <button
          type="button"
          data-testid="newspaper-print"
          className="newspaper-print-button"
          onClick={handlePrint}
        >
          {t.print}
        </button>
      </div>

      <header className="newspaper-masthead">
        <h1 data-testid="newspaper-title">
          {language === "de" ? title : titleEn}
        </h1>
      </header>

      {visible.length === 0 ? (
        <p data-testid="newspaper-empty">{t.empty}</p>
      ) : (
        <div className="newspaper-articles" data-testid="newspaper-articles">
          {visible.map((a) => (
            <article key={a.id} data-testid={`newspaper-article-${a.id}`}>
              <h2 data-testid={`newspaper-headline-${a.id}`}>
                {language === "de" ? a.headline : (a.headlineEn ?? a.headline)}
              </h2>
              {a.imageUrl && (
                <img
                  src={a.imageUrl}
                  alt={a.imageAlt ?? (language === "de" ? a.headline : (a.headlineEn ?? a.headline))}
                  data-testid={`newspaper-image-${a.id}`}
                  className="newspaper-article-image"
                />
              )}
              <p data-testid={`newspaper-body-${a.id}`}>
                {language === "de" ? a.body : (a.bodyEn ?? a.body)}
              </p>
            </article>
          ))}
        </div>
      )}

      <nav className="newspaper-pagination" aria-label="Pagination">
        <button
          type="button"
          data-testid="newspaper-prev"
          onClick={goPrev}
          disabled={safePage === 0}
        >
          {t.prev}
        </button>
        <span data-testid="newspaper-page-indicator">
          {t.page} {safePage + 1} {t.of} {pageCount}
        </span>
        <button
          type="button"
          data-testid="newspaper-next"
          onClick={goNext}
          disabled={safePage >= pageCount - 1}
        >
          {t.next}
        </button>
      </nav>
    </div>
  );
}
