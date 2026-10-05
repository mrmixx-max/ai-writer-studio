// Literatur-Stipendien- & Jury-Dossier-Service (WP 51.2).
//
// Zweck: Jury-Leseprobe mit Zeilennummern, Bewerbungsmappen-Builder und
//   Norm-Profile für Literaturstiftungen.
// Keine LLM-Aufrufe.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReadingSampleOptions {
  title: string;
  author: string;
  lineNumbers?: boolean;
}

export interface ReadingSample {
  title: string;
  author: string;
  lines: { lineNumber: number; text: string }[];
  pageCount: number;
}

export interface DossierConfig {
  title: string;
  author: string;
  expose: string;
  motivation: string;
  timeline: string;
  budget: string;
  biography: string;
}

export interface DossierSection {
  id: string;
  title: string;
  content: string;
  pageNumber: number;
}

export interface ApplicationDossier {
  id: string;
  title: string;
  author: string;
  sections: DossierSection[];
  pageCount: number;
}

export interface GrantProfile {
  id: string;
  name: string;
  organization: string;
  deadline: string;
  requirements: string[];
  maxPages: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const LINES_PER_PAGE = 40;

// ─── Interne Helfer ──────────────────────────────────────────────────────────

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateReadingSample(
  text: string,
  options?: ReadingSampleOptions,
): ReadingSample {
  const title = safeString(options?.title, 'Ohne Titel');
  const author = safeString(options?.author, 'Unbekannt');
  const lineNumbers = options?.lineNumbers !== false;

  const rawLines = text.split('\n').filter((l) => l.trim().length > 0);
  const lines = rawLines.map((text, index) => ({
    lineNumber: lineNumbers ? (index + 1) * 5 : 0,
    text: text.trim(),
  }));

  const pageCount = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));

  return { title, author, lines, pageCount };
}

export function buildApplicationDossier(config: DossierConfig): ApplicationDossier {
  const title = safeString(config?.title, 'Ohne Titel');
  const author = safeString(config?.author, 'Unbekannt');

  const sections: DossierSection[] = [
    { id: 'expose', title: 'Exposé', content: safeString(config?.expose), pageNumber: 1 },
    { id: 'motivation', title: 'Motivationsschreiben', content: safeString(config?.motivation), pageNumber: 2 },
    { id: 'timeline', title: 'Projektzeitplan', content: safeString(config?.timeline), pageNumber: 3 },
    { id: 'budget', title: 'Kostenkalkulation', content: safeString(config?.budget), pageNumber: 4 },
    { id: 'biography', title: 'Biografie', content: safeString(config?.biography), pageNumber: 5 },
  ];

  return {
    id: `dossier-${Date.now()}`,
    title,
    author,
    sections,
    pageCount: sections.length,
  };
}

export function listGrantProfiles(): GrantProfile[] {
  return [
    {
      id: 'dlf',
      name: 'Deutscher Literaturfonds',
      organization: 'Deutscher Literaturfonds e.V.',
      deadline: '31.03.2027',
      requirements: ['Exposé (max. 5 Seiten)', 'Motivationsschreiben', 'Biografie'],
      maxPages: 30,
    },
    {
      id: 'kuk',
      name: 'Stiftung Kunst und Kultur',
      organization: 'Stiftung Kunst und Kultur NRW',
      deadline: '15.06.2027',
      requirements: ['Projektbeschreibung', 'Kostenkalkulation', 'Zeitplan'],
      maxPages: 25,
    },
    {
      id: 'hbs',
      name: 'Heinrich-Böll-Stiftung',
      organization: 'Heinrich-Böll-Stiftung e.V.',
      deadline: '01.09.2027',
      requirements: ['Exposé', 'Motivation', 'Biografie', 'Zeitplan'],
      maxPages: 20,
    },
  ];
}
