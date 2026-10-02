// codexService.ts — Lokaler, deterministischer Recherche-Codex (Evidence Locker).
// Kein LLM, keine Netzwerkaufrufe. Speichert Codex-Einträge im Speicher
// (in-memory Store) und bietet Suche, Backlinks und Zitierung.

export type CodexType = 'location' | 'technology' | 'history' | 'medicine' | 'culture';

export interface CodexEntry {
  id: string;
  title: string;
  type: CodexType;
  tags: string[];
  content: string;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// In-memory Store
// ---------------------------------------------------------------------------

const codexStore: Map<string, CodexEntry> = new Map();

// Seed-Daten für den initialen Codex (können später durch UI ersetzt werden).
const SEED_ENTRIES: CodexEntry[] = [
  {
    id: 'loc-001',
    title: 'Berlin',
    type: 'location',
    tags: ['stadt', 'deutschland', 'hauptstadt'],
    content: 'Berlin ist die Hauptstadt Deutschlands und mit über 3,7 Millionen Einwohnern die bevölkerungsreichste Stadt des Landes.',
  },
  {
    id: 'loc-002',
    title: 'Tokio',
    type: 'location',
    tags: ['stadt', 'japan', 'hauptstadt'],
    content: 'Tokio ist die Hauptstadt Japans und eine der größten Metropolregionen der Welt mit über 37 Millionen Einwohnern.',
  },
  {
    id: 'tech-001',
    title: 'Dampfmaschine',
    type: 'technology',
    tags: ['industrialisierung', 'energie', 'maschine'],
    content: 'Die Dampfmaschine war die treibende Kraft der Industriellen Revolution und ermöglichte die Mechanisierung der Produktion.',
  },
  {
    id: 'tech-002',
    title: 'Internet',
    type: 'technology',
    tags: ['kommunikation', 'netzwerk', 'digital'],
    content: 'Internet ist ein globales Netzwerk aus vernetzten Computern, das den Informationsaustausch weltweit revolutioniert hat.',
  },
  {
    id: 'hist-001',
    title: 'Erster Weltkrieg',
    type: 'history',
    tags: ['krieg', '1914', '1918', 'europa'],
    content: 'Der Erste Weltkrieg (1914–1918) war ein globaler Konflikt, der die politische Landkarte Europas nachhaltig veränderte.',
  },
  {
    id: 'hist-002',
    title: 'Französische Revolution',
    type: 'history',
    tags: ['revolution', '1789', 'frankreich'],
    content: 'Die Französische Revolution von 1789 stürzte die Monarchie und legte den Grundstein für moderne Demokratie.',
  },
  {
    id: 'med-001',
    title: 'Penicillin',
    type: 'medicine',
    tags: ['antibiotikum', 'medizin', 'entdeckung'],
    content: 'Penicillin, entdeckt von Alexander Fleming 1928, war das erste Antibiotikum und revolutionierte die Behandlung bakterieller Infektionen.',
  },
  {
    id: 'med-002',
    title: 'Impfung',
    type: 'medicine',
    tags: ['prävention', 'immunität', 'medizin'],
    content: 'Impfungen schützen vor Infektionskrankheiten, indem sie das Immunsystem auf spezifische Erreger vorbereiten.',
  },
  {
    id: 'cul-001',
    title: 'Renaissance',
    type: 'culture',
    tags: ['kunst', 'kultur', 'europa', '15. jahrhundert'],
    content: 'Die Renaissance war eine kulturelle Bewegung vom 14. bis 17. Jahrhundert, die Kunst, Wissenschaft und Philosophie neu prägte.',
  },
  {
    id: 'cul-002',
    title: 'Kabarett',
    type: 'culture',
    tags: ['theater', 'satire', 'deutschland'],
    content: 'Kabarett ist eine Form des politischen und gesellschaftlichen Satiretheaters, die besonders im deutschsprachigen Raum populär ist.',
  },
];

// Initialisiere den Store mit Seed-Daten (nur wenn leer).
function ensureSeeded(): void {
  if (codexStore.size === 0) {
    for (const entry of SEED_ENTRIES) {
      codexStore.set(entry.id, entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function generateId(): string {
  return `codex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function isValidCodexType(type: unknown): type is CodexType {
  return type === 'location' || type === 'technology' || type === 'history' || type === 'medicine' || type === 'culture';
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Erstellt einen neuen Codex-Eintrag.
 * Validiert die Eingabe und generiert eine ID falls nicht vorhanden.
 * Wirft bei ungültigen Daten.
 */
export function createCodexEntry(entry: CodexEntry): CodexEntry {
  // Defensive Fallbacks bei fehlenden Daten
  if (!entry || typeof entry !== 'object') {
    throw new Error('CodexEntry ist erforderlich');
  }

  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (!title) {
    throw new Error('Titel ist erforderlich');
  }

  if (!isValidCodexType(entry.type)) {
    throw new Error(`Ungültiger Typ: ${String(entry.type)}. Erlaubt: location, technology, history, medicine, culture`);
  }

  const tags = Array.isArray(entry.tags) ? entry.tags.filter((t): t is string => typeof t === 'string') : [];
  const content = typeof entry.content === 'string' ? entry.content.trim() : '';
  const imageUrl = typeof entry.imageUrl === 'string' && entry.imageUrl.trim() ? entry.imageUrl.trim() : undefined;

  const newEntry: CodexEntry = {
    id: entry.id && typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateId(),
    title,
    type: entry.type,
    tags,
    content,
    imageUrl,
  };

  ensureSeeded();
  codexStore.set(newEntry.id, newEntry);
  return newEntry;
}

/**
 * Durchsucht den Codex anhand eines Suchbegriffs.
 * Sucht in Titel, Inhalt und Tags (case-insensitive).
 * Gibt alle Einträge zurück, wenn der Suchbegriff leer ist.
 */
export function searchCodex(query: string): CodexEntry[] {
  ensureSeeded();

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return Array.from(codexStore.values());
  }

  const results: CodexEntry[] = [];
  for (const entry of codexStore.values()) {
    const titleMatch = normalize(entry.title).includes(normalizedQuery);
    const contentMatch = normalize(entry.content).includes(normalizedQuery);
    const tagMatch = entry.tags.some((tag) => normalize(tag).includes(normalizedQuery));

    if (titleMatch || contentMatch || tagMatch) {
      results.push(entry);
    }
  }

  return results;
}

/**
 * Findet im Fließtext erwähnte Codex-Begriffe (Backlinks).
 * Gibt die IDs der Einträge zurück, deren Titel im Text vorkommen.
 */
export function getBacklinks(term: string): string[] {
  ensureSeeded();

  const normalizedTerm = normalize(term);
  if (!normalizedTerm) {
    return [];
  }

  const backlinks: string[] = [];
  for (const entry of codexStore.values()) {
    if (normalize(entry.title).includes(normalizedTerm)) {
      backlinks.push(entry.id);
    }
  }

  return backlinks;
}

/**
 * Formatiert eine Zitierung für den Editor.
 * Erzeugt eine lesbare Referenz mit Titel, Typ und Tags.
 */
export function formatCitation(entry: CodexEntry): string {
  if (!entry || typeof entry !== 'object') {
    return '[Ungültiger Codex-Eintrag]';
  }

  const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : '[Ohne Titel]';
  const typeLabel = isValidCodexType(entry.type) ? entry.type : 'unknown';
  const tags = Array.isArray(entry.tags) && entry.tags.length > 0
    ? ` [${entry.tags.join(', ')}]`
    : '';

  return `${title} (${typeLabel})${tags}`;
}

/**
 * Gibt alle Codex-Einträge zurück (nützlich für UI und Tests).
 */
export function getAllEntries(): CodexEntry[] {
  ensureSeeded();
  return Array.from(codexStore.values());
}

/**
 * Löscht einen Codex-Eintrag nach ID.
 */
export function deleteCodexEntry(id: string): boolean {
  return codexStore.delete(id);
}

/**
 * Setzt den Codex-Store zurück (nützlich für Tests).
 */
export function clearCodexStore(): void {
  codexStore.clear();
}
