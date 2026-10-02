/**
 * Series Bible Service — WP 12.1 (Multi-Volume Series Bible)
 *
 * Deterministischer, lokaler Service zur Verwaltung von Serien-Entitäten
 * (Figuren, Orte, Organisationen) über mehrere Bände hinweg.
 * Keine LLM-Aufrufe, keine Netzwerkzugriffe.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntityType = 'character' | 'location' | 'organization';

export type EntityStatus = 'alive' | 'injured' | 'dead' | 'unknown';

export interface SeriesEntity {
  id: string;
  name: string;
  type: EntityType;
  firstAppearance: number;
  attributes: Record<string, string>;
}

export interface EntityTimelineEntry {
  bookNumber: number;
  status: EntityStatus;
  attributes: Record<string, string>;
  notes: string;
}

export interface SpoilerWarning {
  entityName: string;
  entityBook: number;
  currentBook: number;
  message: string;
}

// ─── Internal State ─────────────────────────────────────────────────────────

/** Alle bekannten Entitäten, indexiert nach ID */
const entities = new Map<string, SeriesEntity>();

/** Status-Updates pro Entität und Band: entityId → bookNumber → EntityStatus */
const statusUpdates = new Map<string, Map<number, EntityStatus>>();

/** Zusätzliche Timeline-Einträge pro Entität und Band */
const timelineEntries = new Map<string, Map<number, EntityTimelineEntry>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function ensureNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ensureRecord(value: unknown): Record<string, string> {
  if (value === null || value === undefined || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = ensureString(v);
  }
  return result;
}

function isValidEntityType(type: unknown): type is EntityType {
  return type === 'character' || type === 'location' || type === 'organization';
}

function isValidEntityStatus(status: unknown): status is EntityStatus {
  return status === 'alive' || status === 'injured' || status === 'dead' || status === 'unknown';
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Erstellt einen Serien-Eintrag (Figur, Ort, Organisation).
 * Gibt die erstellte Entität zurück (mit generierter ID falls nicht vorhanden).
 */
export function createSeriesEntity(entity: SeriesEntity): SeriesEntity {
  const id = ensureString(entity.id) || generateId();
  const name = ensureString(entity.name, 'Unbekannt');
  const type = isValidEntityType(entity.type) ? entity.type : 'character';
  const firstAppearance = ensureNumber(entity.firstAppearance, 1);
  const attributes = ensureRecord(entity.attributes);

  const newEntity: SeriesEntity = {
    id,
    name,
    type,
    firstAppearance: Math.max(1, firstAppearance),
    attributes,
  };

  entities.set(id, newEntity);
  return newEntity;
}

/**
 * Aktualisiert den Status einer Figur pro Band.
 * Erstellt die Entität falls nicht vorhanden (mit Default-Werten).
 */
export function updateEntityStatus(
  entityId: string,
  bookNumber: number,
  status: EntityStatus,
): void {
  const id = ensureString(entityId);
  if (!id) return;

  const book = Math.max(1, ensureNumber(bookNumber, 1));
  const validStatus = isValidEntityStatus(status) ? status : 'unknown';

  // Stelle sicher, dass die Entität existiert
  if (!entities.has(id)) {
    createSeriesEntity({
      id,
      name: 'Unbekannt',
      type: 'character',
      firstAppearance: book,
      attributes: {},
    });
  }

  // Status-Update speichern
  if (!statusUpdates.has(id)) {
    statusUpdates.set(id, new Map());
  }
  statusUpdates.get(id)!.set(book, validStatus);

  // Timeline-Eintrag erstellen/aktualisieren
  if (!timelineEntries.has(id)) {
    timelineEntries.set(id, new Map());
  }
  const existing = timelineEntries.get(id)!.get(book);
  timelineEntries.get(id)!.set(book, {
    bookNumber: book,
    status: validStatus,
    attributes: existing ? { ...existing.attributes } : {},
    notes: existing ? existing.notes : '',
  });
}

/**
 * Gibt den Lebenslauf einer Figur über alle Bände zurück.
 * Sortiert aufsteigend nach Bandnummer.
 */
export function getEntityTimeline(entityId: string): EntityTimelineEntry[] {
  const id = ensureString(entityId);
  if (!id) return [];

  const entries = timelineEntries.get(id);
  if (!entries || entries.size === 0) {
    // Fallback: Erstelle einen Basis-Eintrag aus der Entität
    const entity = entities.get(id);
    if (!entity) return [];

    return [
      {
        bookNumber: entity.firstAppearance,
        status: 'unknown',
        attributes: { ...entity.attributes },
        notes: 'Erster Auftritt',
      },
    ];
  }

  return Array.from(entries.values()).sort((a, b) => a.bookNumber - b.bookNumber);
}

/**
 * Prüft Text auf Spoiler-Elemente aus späteren Bänden.
 * Vergleicht bekannte Entitäten und deren firstAppearance mit dem aktuellen Band.
 */
export function checkSpoilerGuard(text: string, currentBook: number): SpoilerWarning[] {
  const warnings: SpoilerWarning[] = [];
  const book = Math.max(1, ensureNumber(currentBook, 1));
  const textLower = ensureString(text).toLowerCase();

  if (!textLower) return warnings;

  for (const entity of entities.values()) {
    // Prüfe ob der Entitätsname im Text vorkommt
    const entityNameLower = entity.name.toLowerCase();
    if (!entityNameLower || !textLower.includes(entityNameLower)) continue;

    // Spoiler: Entität erscheint erst in einem späteren Band
    if (entity.firstAppearance > book) {
      warnings.push({
        entityName: entity.name,
        entityBook: entity.firstAppearance,
        currentBook: book,
        message: `Achtung: "${entity.name}" erscheint erst in Band ${entity.firstAppearance}, aber wird in Band ${book} erwähnt.`,
      });
    }

    // Prüfe Status-Updates aus späteren Bänden
    const updates = statusUpdates.get(entity.id);
    if (updates) {
      for (const [updateBook, status] of updates) {
        if (updateBook > book && status === 'dead') {
          warnings.push({
            entityName: entity.name,
            entityBook: updateBook,
            currentBook: book,
            message: `Achtung: "${entity.name}" stirbt in Band ${updateBook}, wird aber in Band ${book} erwähnt.`,
          });
        }
      }
    }
  }

  return warnings;
}

// ─── Utility ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `entity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Setzt den gesamten Service-Zustand zurück (nützlich für Tests).
 */
export function resetSeriesBible(): void {
  entities.clear();
  statusUpdates.clear();
  timelineEntries.clear();
}

/**
 * Gibt alle bekannten Entitäten zurück.
 */
export function getAllEntities(): SeriesEntity[] {
  return Array.from(entities.values());
}

/**
 * Gibt eine einzelne Entität zurück.
 */
export function getEntity(entityId: string): SeriesEntity | undefined {
  return entities.get(ensureString(entityId));
}
