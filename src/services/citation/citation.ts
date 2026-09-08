// Citation Engine (Sprint 23, Agent 1): Quellen-CRUD, 6 Zitierstile, BibTeX Im-/Export.
//
// Eigenstaendiger In-Memory-Store (wie knowledgeBase.ts): kein DB-Zugriff,
// keine neuen Dependencies. Alle Funktionen sind async, damit ein spaeterer
// Wechsel auf persistenten Speicher die API nicht bricht.

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee' | 'bibtex';

export type SourceType = 'book' | 'article' | 'website' | 'chapter' | 'interview' | 'video';

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  authors: string[];
  year: number;
  publisher?: string;
  url?: string;
  accessedAt?: string;
  doi?: string;
  pages?: string;
  volume?: string;
  issue?: string;
}

export interface CitationEntry {
  source: Source;
  inText: string;
  bibliography: string;
  style: CitationStyle;
}

export type NewSource = Omit<Source, 'id'>;

const store = new Map<string, Source>();

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `cit-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Nur fuer Tests: leert den Store. */
export function clearSources(): void {
  store.clear();
  idCounter = 0;
}

function validate(input: NewSource): void {
  if (!input.title || !input.title.trim()) {
    throw new Error('Titel darf nicht leer sein.');
  }
  if (!input.authors || input.authors.length === 0 || input.authors.every((a) => !a.trim())) {
    throw new Error('Mindestens ein Autor ist erforderlich.');
  }
  if (!Number.isInteger(input.year) || input.year <= 0) {
    throw new Error('Jahr muss eine positive ganze Zahl sein.');
  }
}

/** Fuegt eine Quelle hinzu und vergibt eine ID. */
export async function addSource(input: NewSource): Promise<Source> {
  validate(input);
  const source: Source = {
    ...input,
    id: generateId(),
    authors: input.authors.map((a) => a.trim()).filter(Boolean),
  };
  store.set(source.id, source);
  return source;
}

/** Entfernt eine Quelle; wirft bei unbekannter ID. */
export async function removeSource(id: string): Promise<void> {
  if (!store.has(id)) {
    throw new Error(`Unbekannte Quelle: ${id}`);
  }
  store.delete(id);
}

/** Gibt alle Quellen zurueck (Einfgereihenfolge). */
export async function getSources(): Promise<Source[]> {
  return [...store.values()];
}

// ---------------------------------------------------------------------------
// Autoren-Helfer
// ---------------------------------------------------------------------------

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

function lastName(full: string): string {
  return splitName(full).last;
}

/** "Max Mustermann" -> "M." ; "Anna Maria Musterfrau" -> "A. M." */
function initials(first: string): string {
  return first
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}.`)
    .join(' ');
}

/** APA-Langform: "Mustermann, M., & Musterfrau, A. M." */
function apaAuthors(authors: string[]): string {
  const formatted = authors.map((a) => {
    const { first, last } = splitName(a);
    return first ? `${last}, ${initials(first)}` : last;
  });
  if (formatted.length <= 1) return formatted.join('');
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`;
}

/** MLA/Chicago-Langform: "Mustermann, Max, und Anna Musterfrau" / "et al." ab 3. */
function mlaAuthors(authors: string[]): string {
  if (authors.length === 0) return '';
  const first = splitName(authors[0]);
  const head = first.first ? `${first.last}, ${first.first}` : first.last;
  if (authors.length === 1) return head;
  if (authors.length === 2) return `${head}, und ${authors[1].trim()}`;
  return `${head}, et al.`;
}

/** Harvard-Langform: "Mustermann, M. und Musterfrau, A. M." */
function harvardAuthors(authors: string[]): string {
  const formatted = authors.map((a) => {
    const { first, last } = splitName(a);
    return first ? `${last}, ${initials(first)}` : last;
  });
  if (formatted.length <= 1) return formatted.join('');
  if (formatted.length === 2) return `${formatted[0]} und ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')} und ${formatted[formatted.length - 1]}`;
}

/** IEEE-Kurzform: "M. Mustermann" / "M. Mustermann und A. Musterfrau" / "M. Mustermann et al." */
function ieeeAuthors(authors: string[]): string {
  const short = (a: string): string => {
    const { first, last } = splitName(a);
    return first ? `${initials(first)} ${last}` : last;
  };
  if (authors.length <= 1) return authors.map(short).join('');
  if (authors.length === 2) return `${short(authors[0])} und ${short(authors[1])}`;
  return `${short(authors[0])} et al.`;
}

/** In-Text-Zitat: "(Mustermann, 2020)" / "(Mustermann & Musterfrau, 2020)" / "(Mustermann et al., 2020)". */
export function formatInText(source: Source): string {
  const last = source.authors.map(lastName);
  if (last.length === 0) return `(${source.year})`;
  if (last.length === 1) return `(${last[0]}, ${source.year})`;
  if (last.length === 2) return `(${last[0]} & ${last[1]}, ${source.year})`;
  return `(${last[0]} et al., ${source.year})`;
}

// ---------------------------------------------------------------------------
// Stil-Formatierung
// ---------------------------------------------------------------------------

function publisherPart(publisher?: string): string {
  return publisher && publisher.trim() ? ` ${publisher.trim()}.` : '';
}

/**
 * Formatiert eine Quelle im gewuenschten Stil.
 * @param index Listenplatz (nur IEEE sichtbar, Standard 1).
 */
export function formatCitation(source: Source, style: CitationStyle, index = 1): string {
  const { title, year, publisher, doi } = source;
  const doiPart = doi && doi.trim() ? ` https://doi.org/${doi.trim()}` : '';
  switch (style) {
    case 'apa':
      return `${apaAuthors(source.authors)} (${year}). ${title}.${publisherPart(publisher)}${doiPart}`;
    case 'mla':
      return `${mlaAuthors(source.authors)}. ${title}.${publisher ? ` ${publisher},` : ''} ${year}.`.replace('  ', ' ');
    case 'chicago':
      return `${mlaAuthors(source.authors)}. ${title}.${publisher ? ` ${publisher},` : ''} ${year}.`.replace('  ', ' ');
    case 'harvard':
      return `${harvardAuthors(source.authors)} (${year}) ${title}.${publisherPart(publisher)}`;
    case 'ieee': {
      const pub = publisher ? ` ${publisher},` : '';
      return `[${index}] ${ieeeAuthors(source.authors)}, ${title}.${pub} ${year}.`.replace('  ', ' ');
    }
    case 'bibtex':
      return toBibtex(source);
  }
}

/** Baut einen CitationEntry (In-Text + Literaturlisteneintrag) fuer eine Quelle. */
export function makeCitationEntry(source: Source, style: CitationStyle, index = 1): CitationEntry {
  return {
    source,
    inText: formatInText(source),
    bibliography: formatCitation(source, style, index),
    style,
  };
}

function byAuthorThenYear(a: Source, b: Source): number {
  const la = (a.authors[0] ? lastName(a.authors[0]) : '').toLowerCase();
  const lb = (b.authors[0] ? lastName(b.authors[0]) : '').toLowerCase();
  if (la < lb) return -1;
  if (la > lb) return 1;
  if (a.year !== b.year) return a.year - b.year;
  return a.title.localeCompare(b.title);
}

/** Erzeugt die komplette, nach Autor sortierte Literaturliste. */
export function generateBibliography(sources: Source[], style: CitationStyle): string {
  return [...sources]
    .sort(byAuthorThenYear)
    .map((s, i) => formatCitation(s, style, i + 1))
    .join('\n');
}

// ---------------------------------------------------------------------------
// BibTeX
// ---------------------------------------------------------------------------

const SOURCE_TO_BIBTYPE: Record<SourceType, string> = {
  book: 'book',
  article: 'article',
  website: 'online',
  chapter: 'incollection',
  interview: 'unpublished',
  video: 'online',
};

const BIBTYPE_TO_SOURCE: Record<string, SourceType> = {
  book: 'book',
  article: 'article',
  online: 'website',
  website: 'website',
  misc: 'website',
  incollection: 'chapter',
  inbook: 'chapter',
  inproceedings: 'chapter',
  unpublished: 'interview',
};

function bibKey(source: Pick<Source, 'authors' | 'year'>, used: Set<string>): string {
  const base =
    `${(source.authors[0] ? lastName(source.authors[0]) : 'anon').toLowerCase().replace(/[^a-z0-9]/g, '')}${source.year || 'nodate'}`;
  let key = base || 'source';
  let i = 0;
  while (used.has(key)) {
    i += 1;
    key = `${base}${String.fromCharCode(96 + i)}`;
  }
  used.add(key);
  return key;
}

function bibField(name: string, value: string | undefined): string {
  if (value === undefined || value === '') return '';
  return `  ${name} = {${value}},\n`;
}

/** Serialisiert eine Quelle als einzelnen BibTeX-Eintrag. */
export function toBibtex(source: Source, usedKeys?: Set<string>): string {
  const used = usedKeys ?? new Set<string>();
  const key = bibKey(source, used);
  const type = SOURCE_TO_BIBTYPE[source.type] ?? 'misc';
  const author = source.authors.join(' and ');
  let out = `@${type}{${key},\n`;
  out += bibField('author', author);
  out += bibField('title', source.title);
  out += bibField('year', String(source.year));
  out += bibField('publisher', source.publisher);
  out += bibField('url', source.url);
  out += bibField('doi', source.doi);
  out += bibField('pages', source.pages);
  out += bibField('volume', source.volume);
  out += bibField('number', source.issue);
  out += '}';
  return out;
}

/** Exportiert alle Quellen als BibTeX-Dateiinhalt. */
export function exportBibtex(sources: Source[]): string {
  const used = new Set<string>();
  return sources.map((s) => toBibtex(s, used)).join('\n\n');
}

interface ParsedBibtex {
  bibtype: string;
  fields: Record<string, string>;
}

/** Zerlegt BibTeX-Quelltext in Eintraege (eine Klammerebene, ohne Verschachtelung). */
function parseBibtexEntries(bibtex: string): ParsedBibtex[] {
  const entries: ParsedBibtex[] = [];
  const entryRe = /@(\w+)\s*\{\s*[^,{}]+\s*,([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(bibtex)) !== null) {
    const fields: Record<string, string> = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{([^{}]*)\}|"([^"]*)"|([^\s,}]+))\s*,?/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[2])) !== null) {
      fields[f[1].toLowerCase()] = (f[2] ?? f[3] ?? f[4] ?? '').trim();
    }
    entries.push({ bibtype: m[1].toLowerCase(), fields });
  }
  return entries;
}

function toSourceType(bibtype: string): SourceType {
  return BIBTYPE_TO_SOURCE[bibtype] ?? 'book';
}

/** Importiert Quellen aus BibTeX-Quelltext (legt sie im Store ab und gibt sie zurueck). */
export async function importBibtex(bibtex: string): Promise<Source[]> {
  const result: Source[] = [];
  for (const entry of parseBibtexEntries(bibtex)) {
    const f = entry.fields;
    const authors = (f.author || '')
      .split(/\s+and\s+/i)
      .map((a) => a.trim())
      .filter(Boolean);
    const year = parseInt(f.year, 10);
    const created = await addSource({
      type: toSourceType(entry.bibtype),
      title: f.title || 'Ohne Titel',
      authors: authors.length > 0 ? authors : ['Unbekannt'],
      year: Number.isInteger(year) && year > 0 ? year : new Date().getFullYear(),
      publisher: f.publisher || undefined,
      url: f.url || undefined,
      doi: f.doi || undefined,
      pages: f.pages || undefined,
      volume: f.volume || undefined,
      issue: f.number || undefined,
    });
    result.push(created);
  }
  return result;
}
