// Research-Verwaltung — Typen für Quellen, Zitate, Notizen und Web-Clips.

/** Art einer bibliografischen Quelle. */
export type ResearchSourceKind = "book" | "article" | "website";

export const RESEARCH_SOURCE_KIND_LABELS: Record<ResearchSourceKind, string> = {
  book: "Buch",
  article: "Artikel",
  website: "Website",
};

/** Eine bibliografische Quelle (Buch, Artikel oder Website). */
export interface ResearchSource {
  id: string;
  projectId: string;
  kind: ResearchSourceKind;
  title: string;
  author: string;
  year: string;
  publisher: string;
  url: string;
  isbn: string;
  notes: string;
  /** Komma-separierte Tags. */
  tags: string;
  createdAt: number;
  updatedAt: number;
}

/** Ein Zitat mit Quellenangabe. */
export interface ResearchQuote {
  id: string;
  projectId: string;
  /** Verweis auf research_sources.id — null bei Zitaten ohne erfasste Quelle. */
  sourceId: string | null;
  text: string;
  /** Seitenzahl, Auflage o. Ä. — freies Textfeld. */
  page: string;
  comment: string;
  tags: string;
  createdAt: number;
  updatedAt: number;
}

/** Eine Forschungsnotiz. */
export interface ResearchNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  tags: string;
  createdAt: number;
  updatedAt: number;
}

/** Ein gespeicherter Web-Ausschnitt (Clip). */
export interface ResearchClip {
  id: string;
  projectId: string;
  url: string;
  title: string;
  /** Extrahierter Haupttext der Seite. */
  content: string;
  /** Vom Nutzer markierter/angegebener Ausschnitt. */
  selectedText: string;
  notes: string;
  clippedAt: number;
  updatedAt: number;
}

/** Ergebnis des Web-Inhalts-Extrahierens. */
export interface ExtractedPage {
  title: string;
  content: string;
  url: string;
}
