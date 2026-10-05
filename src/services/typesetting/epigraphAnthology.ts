/**
 * Kapitel-Epigraph- & Motto-Studio-Service — WP 52.2
 *
 * Lokaler, deterministischer Service zur Verwaltung, rechtlichen Prüfung
 * und zum Pracht-Satz von Kapitel-Epigraphen und Motti.
 *
 * - Keine LLM-Aufrufe.
 * - Keine Zeit-/Zufallsabhängigkeit: IDs und Copyright-Urteile sind über
 *   eine feste Referenz (PUBLIC_DOMAIN_DEATH_YEAR = 1955) deterministisch.
 * - Durchgehend defensive Fallbacks: ungültige Eingaben ergeben leere,
 *   typkorrekte Ergebnisse statt Exceptions.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type EpigraphKind = 'historical' | 'fictional';

export interface EpigraphOptions {
  kind?: EpigraphKind;
  chapter?: number;
  fleuron?: boolean;
}

export interface Epigraph {
  id: string;
  text: string;
  source: string;
  author: string;
  kind: EpigraphKind;
  chapter?: number;
  fleuron: boolean;
}

export type CopyrightVerdict =
  | 'public-domain'
  | 'fair-use'
  | 'copyrighted'
  | 'unknown';

export interface CopyrightStatus {
  status: CopyrightVerdict;
  message: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

/**
 * Todesjahr-Grenze für die Public-Domain-Annahme.
 * Fixe Referenz (2025 − 70 Jahre Schutzfrist) → deterministisch, kein Date.now().
 */
export const PUBLIC_DOMAIN_DEATH_YEAR = 1955;

/** Schutzfrist nach dem Tod (70 Jahre) — nur zur Dokumentation/Message. */
export const COPYRIGHT_TERM_YEARS = 70;

/** Vignette für den Pracht-Satz (fleuron). */
export const FLEURON_GLYPH = '❦';

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Marker, die als "Autor unbekannt" gewertet werden. */
const UNKNOWN_AUTHOR_MARKERS = new Set([
  '',
  'unbekannt',
  'unknown',
  'unbekannt.',
  'n/a',
  'n.a.',
  '—',
  '-',
  '–',
]);

/** Marker, die eine ausdrückliche Fair-Use-Kennzeichnung signalisieren. */
const FAIR_USE_MARKERS = [
  'fair use',
  'fair-use',
  'fairuse',
  'lebender autor',
  'zeitgenössisch',
  'zeitgenosse',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}

/** Koerziert einen beliebigen Wert defensiv zu einem String. */
function toSafeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/** Deterministischer djb2-Hash → stabile, kollisionsarme ID-Basis. */
function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + c, in 32-Bit-Arithmetik gehalten.
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Vorzeichenlose Hex-Darstellung, damit die ID plattformstabil ist.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Akzeptiert nur endliche, positive Ganzzahlen als Kapitelnummer. */
function normalizeChapter(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.trunc(value);
  if (rounded < 1) return undefined;
  return rounded;
}

function normalizeKind(value: unknown): EpigraphKind {
  return value === 'fictional' ? 'fictional' : 'historical';
}

/**
 * Leitet einen Autor aus der Quellenangabe ab.
 * Konvention: "Autor, Werk" bzw. "Autor — Werk" → Autor vor dem Trenner.
 * Fällt defensiv auf die vollständige Quelle zurück.
 */
function deriveAuthor(source: string): string {
  const trimmed = source.trim();
  if (trimmed === '') return '';
  const match = trimmed.split(/\s*[,;—–]\s*/)[0];
  const author = (match ?? trimmed).trim();
  return author === '' ? trimmed : author;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Erzeugt eine verwaltete Epigraph-Entität.
 *
 * @param text    Der Epigraph-Text.
 * @param source  Quellenangabe, z. B. "Goethe, Faust I".
 * @param options Optional: kind, chapter, fleuron.
 */
export function createEpigraph(
  text: string,
  source: string,
  options?: EpigraphOptions,
): Epigraph {
  const safeText = toSafeString(text);
  const safeSource = toSafeString(source);
  const opts: EpigraphOptions =
    options && typeof options === 'object' ? options : {};

  const kind = normalizeKind(opts.kind);
  const chapter = normalizeChapter(opts.chapter);
  const fleuron = opts.fleuron === true;
  const author = deriveAuthor(safeSource);

  // Deterministische ID aus allen inhaltlich relevanten Feldern.
  const idBasis = [
    kind,
    safeText,
    safeSource,
    author,
    chapter === undefined ? '' : String(chapter),
    fleuron ? '1' : '0',
  ].join('\u0000');
  const id = `epi-${stableHash(idBasis)}`;

  const epigraph: Epigraph = {
    id,
    text: safeText,
    source: safeSource,
    author,
    kind,
    fleuron,
  };
  if (chapter !== undefined) {
    epigraph.chapter = chapter;
  }
  return epigraph;
}

/**
 * Public-Domain- & Fair-Use-Wächter.
 *
 * Regeln (fixe Referenz PUBLIC_DOMAIN_DEATH_YEAR = 1955):
 * - Autor vor 1955 gestorben            → public-domain
 * - Autor vor 1955 lebend (kein Todesjahr, aber bekannt) → copyrighted
 * - Autor nach 1955 gestorben           → copyrighted (70 Jahre Schutzfrist)
 * - Autor unbekannt/leer                → unknown
 * - Ausdrückliche Fair-Use-Kennzeichnung → fair-use
 *
 * @param author    Autorname (oder Quelle).
 * @param deathYear Optionales Todesjahr.
 */
export function checkCopyrightStatus(
  author: string,
  deathYear?: number,
): CopyrightStatus {
  const safeAuthor = toSafeString(author).trim();

  // 1) Autor unbekannt → unknown (höchste Priorität, keine belastbare Aussage).
  if (
    safeAuthor === '' ||
    UNKNOWN_AUTHOR_MARKERS.has(safeAuthor.toLowerCase())
  ) {
    return {
      status: 'unknown',
      message:
        'Autor unbekannt — Urheberstatus nicht bestimmbar. Vor Veröffentlichung manuell prüfen.',
    };
  }

  // 2) Ausdrückliche Fair-Use-Kennzeichnung.
  const lower = safeAuthor.toLowerCase();
  if (FAIR_USE_MARKERS.some((marker) => lower.includes(marker))) {
    return {
      status: 'fair-use',
      message:
        'Als Fair-Use gekennzeichnet — Nutzung als kurzes Motto zulässig, Quellenangabe beibehalten.',
    };
  }

  // 3) Todesjahr bekannt → 1955-Grenze entscheidet.
  if (typeof deathYear === 'number' && Number.isFinite(deathYear)) {
    const year = Math.trunc(deathYear);
    if (year < PUBLIC_DOMAIN_DEATH_YEAR) {
      return {
        status: 'public-domain',
        message: `Autor ${safeAuthor} starb ${year} (vor ${PUBLIC_DOMAIN_DEATH_YEAR}) — Werk gemeinfrei.`,
      };
    }
    return {
      status: 'copyrighted',
      message: `Autor ${safeAuthor} starb ${year} — Schutzfrist von ${COPYRIGHT_TERM_YEARS} Jahren greift, Werk noch urheberrechtlich geschützt.`,
    };
  }

  // 4) Autor bekannt, aber kein Todesjahr → konservativ geschützt.
  return {
    status: 'copyrighted',
    message: `Autor ${safeAuthor} lebt bzw. Todesjahr unbekannt — vorsorglich urheberrechtlich geschützt.`,
  };
}

/**
 * Pracht-Satz: Kapitälchen, hängende Attribution, Vignetten.
 * Liefert deterministisches HTML (kein Zufall, keine Zeitabhängigkeit).
 */
export function formatEpigraph(epigraph: Epigraph): string {
  if (!epigraph || typeof epigraph !== 'object') return '';

  const text = toSafeString(epigraph.text);
  const source = toSafeString(epigraph.source);
  const author = toSafeString(epigraph.author) || deriveAuthor(source);
  const kind = normalizeKind(epigraph.kind);
  const fleuron = epigraph.fleuron === true;
  const chapter = normalizeChapter(epigraph.chapter);

  const classes = ['epigraph', `epigraph--${kind}`];
  if (chapter !== undefined) classes.push(`epigraph--chapter-${chapter}`);

  const textHtml = `<blockquote class="epigraph__text">${escapeHtml(text)}</blockquote>`;

  // Hängende Attribution: Autor in Kapitälchen, Werk kursiv/kleiner.
  const attributionParts: string[] = [];
  if (author !== '') {
    attributionParts.push(
      `<span class="epigraph__author">${escapeHtml(author)}</span>`,
    );
  }
  if (source !== '') {
    attributionParts.push(
      `<span class="epigraph__source">${escapeHtml(source)}</span>`,
    );
  }
  const attribution =
    attributionParts.length > 0
      ? `<figcaption class="epigraph__attribution">— ${attributionParts.join(
          ', ',
        )}</figcaption>`
      : '';

  const vignette = fleuron
    ? `<span class="epigraph__fleuron" aria-hidden="true">${FLEURON_GLYPH}</span>`
    : '';

  const chapterLabel =
    chapter !== undefined
      ? `<span class="epigraph__chapter" aria-hidden="true">Kapitel ${chapter}</span>`
      : '';

  return (
    `<figure class="${classes.join(' ')}">` +
    chapterLabel +
    textHtml +
    attribution +
    vignette +
    `</figure>`
  );
}
