// Sprint 16, Agent 4 — Zeitungs-Layout.
// Baut aus Artikeln eine mehrseitige Zeitung: Headline-Platzierung
// (Lead-Story pro Seite), Bild-Slots, Spalten-Layout, Inhaltsverzeichnis
// und Markdown-Export mit Bild-Platzhaltern.
//
// Lesekonvention aus src/services/export/index.ts (read-only):
// Bilder werden dort als `[Bild: <src>]`-Bloecke abgebildet; der
// Markdown-Export hier nutzt analog `![Bild: <alt>](<src>)` bzw. einen
// textuellen Platzhalter, wenn der Artikel keine Bild-URL hat.

export interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  category?: string;
  /** Optionale Bild-URL — steuert die Bild-Slot-Vergabe. */
  imageUrl?: string;
  imageCaption?: string;
  /** "lead" sortiert vor; Default "normal". */
  priority?: "lead" | "normal";
  author?: string;
}

export interface NewspaperLayoutOptions {
  /** Artikel pro Seite (Default 4, min 1). */
  articlesPerPage?: number;
  /** Spalten pro Seite (Default 2, min 1). */
  columnsPerPage?: number;
  /** Max. Bild-Slots pro Seite (Default 2, min 0). */
  maxImagesPerPage?: number;
  /** Max. Seiten (Default unbegrenzt). */
  maxPages?: number;
  /** Zeitungstitel fuer den Markdown-Export (Default "Tageszeitung"). */
  masthead?: string;
}

export type ArticleRole = "lead" | "secondary" | "brief";

export interface ImageSlot {
  articleId: string;
  /** Lead-Bild oben, sonst inline im Spaltenfluss. */
  position: "top" | "inline";
  /** Markdown-faehiger Platzhalter, z. B. `![Bild: ..](url)`. */
  placeholder: string;
}

export interface PlacedArticle {
  articleId: string;
  headline: string;
  /** Headline-Groesse: Lead groesser als Rest. */
  headlineSize: "xl" | "lg" | "md";
  role: ArticleRole;
  /** 1..columnsPerPage — Lead spannt ggf. alle Spalten. */
  columnSpan: number;
  imageSlot: ImageSlot | null;
}

export interface PageColumn {
  index: number;
  /** Artikel-IDs in Lesereihenfolge dieser Spalte. */
  articleIds: string[];
}

export interface Page {
  pageNumber: number;
  /** Lead-Story dieser Seite (erster Artikel), null nur bei leerer Seite (kommt nicht vor). */
  lead: PlacedArticle | null;
  articles: PlacedArticle[];
  columns: PageColumn[];
  imageSlots: ImageSlot[];
}

export interface TocEntry {
  title: string;
  page: number;
  category?: string;
  articleId: string;
}

export interface Newspaper {
  pages: Page[];
  toc: TocEntry[];
}

const DEFAULTS = {
  articlesPerPage: 4,
  columnsPerPage: 2,
  maxImagesPerPage: 2,
  masthead: "Tageszeitung",
} as const;

function normalizeOptions(options: NewspaperLayoutOptions = {}): {
  articlesPerPage: number;
  columnsPerPage: number;
  maxImagesPerPage: number;
  maxPages: number;
  masthead: string;
} {
  const articlesPerPage = Math.max(
    1,
    Math.floor(options.articlesPerPage ?? DEFAULTS.articlesPerPage) || 1
  );
  const columnsPerPage = Math.max(
    1,
    Math.floor(options.columnsPerPage ?? DEFAULTS.columnsPerPage) || 1
  );
  const maxImagesPerPage = Math.max(
    0,
    Math.floor(options.maxImagesPerPage ?? DEFAULTS.maxImagesPerPage)
  );
  const maxPages =
    options.maxPages !== undefined ? Math.max(1, Math.floor(options.maxPages) || 1) : Infinity;
  return {
    articlesPerPage,
    columnsPerPage,
    maxImagesPerPage,
    maxPages,
    masthead: options.masthead ?? DEFAULTS.masthead,
  };
}

/** Sortiert Leads vor, sonst stabile Eingabereihenfolge. */
function sortArticles(articles: NewsArticle[]): NewsArticle[] {
  return [...articles].sort((a, b) => {
    const pa = a.priority === "lead" ? 0 : 1;
    const pb = b.priority === "lead" ? 0 : 1;
    return pa - pb;
  });
}

function imagePlaceholder(article: NewsArticle): string {
  const alt = article.imageCaption || article.headline || article.id;
  if (article.imageUrl) return `![Bild: ${alt}](${article.imageUrl})`;
  return `[Bild-Platzhalter: ${alt}]`;
}

/**
 * Baut die Zeitung: paginiert, setzt pro Seite die Lead-Headline,
 * vergibt Bild-Slots (Lead bevorzugt, max. maxImagesPerPage/Seite)
 * und verteilt Artikel round-robin auf Spalten.
 */
export function buildNewspaper(
  articles: NewsArticle[],
  options: NewspaperLayoutOptions = {}
): Newspaper {
  const opts = normalizeOptions(options);
  if (!articles || articles.length === 0) return { pages: [], toc: [] };

  const sorted = sortArticles(articles);
  const totalPages = Math.min(
    Math.ceil(sorted.length / opts.articlesPerPage),
    opts.maxPages
  );

  const pages: Page[] = [];
  const toc: TocEntry[] = [];
  let cursor = 0;

  for (let p = 1; p <= totalPages; p++) {
    const slice = sorted.slice(cursor, cursor + opts.articlesPerPage);
    cursor += opts.articlesPerPage;
    if (slice.length === 0) break;

    // Bild-Slot-Vergabe: Lead zuerst, dann Artikel mit imageUrl.
    const withImage = slice.filter((a) => a.imageUrl);
    const imageOrder = [
      ...withImage.filter((a) => a.priority === "lead"),
      ...withImage.filter((a) => a.priority !== "lead"),
    ].slice(0, opts.maxImagesPerPage);
    const imageIds = new Set(imageOrder.map((a) => a.id));

    const placed: PlacedArticle[] = slice.map((article, idx) => {
      const isLead = idx === 0;
      const role: ArticleRole = isLead ? "lead" : idx <= 2 ? "secondary" : "brief";
      const headlineSize = isLead ? "xl" : idx === 1 ? "lg" : "md";
      const hasSlot = imageIds.has(article.id);
      const imageSlot: ImageSlot | null = hasSlot
        ? {
            articleId: article.id,
            position: isLead ? "top" : "inline",
            placeholder: imagePlaceholder(article),
          }
        : null;
      return {
        articleId: article.id,
        headline: article.headline,
        headlineSize,
        role,
        columnSpan: isLead && opts.columnsPerPage > 1 ? opts.columnsPerPage : 1,
        imageSlot,
      };
    });

    // Spalten-Layout: Lead ueberspannt konzeptionell alle Spalten und steht
    // zusaetzlich in Spalte 0 an erster Stelle; Rest round-robin.
    const columns: PageColumn[] = Array.from({ length: opts.columnsPerPage }, (_, i) => ({
      index: i,
      articleIds: [],
    }));
    placed.forEach((pl, idx) => {
      const col = idx === 0 ? 0 : idx % opts.columnsPerPage;
      columns[col].articleIds.push(pl.articleId);
    });

    const imageSlots = placed
      .map((pl) => pl.imageSlot)
      .filter((s): s is ImageSlot => s !== null);

    pages.push({
      pageNumber: p,
      lead: placed[0] ?? null,
      articles: placed,
      columns,
      imageSlots,
    });

    for (const article of slice) {
      toc.push({
        title: article.headline,
        page: p,
        category: article.category,
        articleId: article.id,
      });
    }
  }

  return { pages, toc };
}

/** Findet den Originalartikel zu einer platzierten ID (Export-Hilfe). */
function articleById(articles: NewsArticle[], id: string): NewsArticle | undefined {
  return articles.find((a) => a.id === id);
}

/**
 * Exportiert die Zeitung als Markdown: Masthead, Inhaltsverzeichnis,
 * Seiten mit Headlines, Bild-Platzhaltern und Spalten-Markierung.
 */
export function newspaperToMarkdown(
  newspaper: Newspaper,
  articles: NewsArticle[],
  options: NewspaperLayoutOptions = {}
): string {
  const masthead = options.masthead ?? DEFAULTS.masthead;
  const lines: string[] = [`# ${masthead}`, ""];
  if (newspaper.pages.length === 0) {
    lines.push("_Keine Artikel vorhanden._", "");
    return lines.join("\n");
  }
  lines.push("## Inhaltsverzeichnis", "");
  for (const entry of newspaper.toc) {
    const cat = entry.category ? ` (${entry.category})` : "";
    lines.push(`- ${entry.title}${cat} … S. ${entry.page}`);
  }
  lines.push("");
  for (const page of newspaper.pages) {
    lines.push(`---`, "", `## Seite ${page.pageNumber}`, "");
    for (const placed of page.articles) {
      const article = articleById(articles, placed.articleId);
      const prefix = placed.role === "lead" ? "# " : placed.role === "secondary" ? "### " : "#### ";
      lines.push(`${prefix}${placed.headline}`);
      if (article?.author) lines.push(`*Von ${article.author}*`);
      if (article?.category) lines.push(`_Rubrik: ${article.category}_`);
      lines.push("");
      if (placed.imageSlot) lines.push(placed.imageSlot.placeholder, "");
      const body = article?.body?.trim();
      lines.push(body ? body : "_[Kein Text]_", "");
    }
  }
  return lines.join("\n");
}

/** Alias-Namen fuer ergonomische Imports. */
export const exportNewspaperMarkdown = newspaperToMarkdown;
export type { NewspaperLayoutOptions as LayoutOptions };
