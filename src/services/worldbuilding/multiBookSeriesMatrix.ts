/**
 * Multi-Book-Serien-Matrix — WP 44.2
 *
 * Deterministischer, lokaler Service, der mehrere Manuskripte (Bände) zu
 * einer Reihe verknüpft und die Figuren-/Fraktionen-Entwicklung über
 * Buchgrenzen hinweg prüft.
 *
 * Kernregeln:
 *  - Ein toter Charakter darf in späteren Bänden NICHT wieder lebendig sein.
 *  - Einmal erlittene Verletzungen sind irreversibel — „verlorene Gliedmaßen
 *    dürfen nicht zurückkehren". Eine Verletzung, die in einem späteren Band
 *    fehlt, ist ein Widerspruch.
 *  - Ein Rang/Bündnis, das nach einem Wechsel/Verlust später wiederkehrt, ist
 *    ein Widerspruch (Rang-/Bündnis-Oszillation).
 *
 * Keine LLM-Aufrufe, keine Netzwerkzugriffe. Alle Funktionen sind defensiv:
 * ungültige/fehlende Eingaben liefern leere, wohldefinierte Ergebnisse.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookCharacter {
  name: string;
  alive: boolean;
  injuries: string[];
  alliances: string[];
  rank?: string;
}

export interface SeriesBook {
  id: string;
  title: string;
  bookNumber: number;
  yearsAfterPrevious: number;
  characters: BookCharacter[];
  factions: string[];
}

export interface SeriesUniverse {
  id: string;
  title: string;
  books: SeriesBook[];
}

export interface CharacterAppearance {
  bookNumber: number;
  alive: boolean;
  injuries: string[];
  rank?: string;
}

export interface CharacterStatusAudit {
  character: string;
  appearances: CharacterAppearance[];
  contradictions: string[];
}

/** Intern: Erscheinung inkl. Bündnissen für die Widerspruchs-Engine. */
interface AuditAppearance extends CharacterAppearance {
  alliances: string[];
}

export interface UniverseDiff {
  fromBook: number;
  toBook: number;
  characterChanges: string[];
  factionChanges: string[];
  yearsElapsed: number;
}

export interface Contradiction {
  kind: 'death' | 'injury' | 'rank' | 'alliance';
  character: string;
  fromBook: number;
  toBook: number;
  message: string;
}

// ─── Defensive Helpers ──────────────────────────────────────────────────────

function ensureString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function ensureNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ensureBool(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Normalisiert ein beliebiges Array zu einem Array eindeutiger, nicht-leerer Strings. */
function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const s = ensureString(v);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function slug(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'x';
}

function normalizeCharacter(raw: unknown): BookCharacter | null {
  if (raw === null || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const name = ensureString(c.name);
  if (!name) return null;
  const rank = ensureString(c.rank);
  const normalized: BookCharacter = {
    name,
    alive: ensureBool(c.alive, true),
    injuries: ensureStringArray(c.injuries),
    alliances: ensureStringArray(c.alliances),
  };
  if (rank) normalized.rank = rank;
  return normalized;
}

function normalizeBook(raw: unknown, index: number): SeriesBook | null {
  if (raw === null || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const charactersRaw = Array.isArray(b.characters) ? b.characters : [];
  const characters: BookCharacter[] = [];
  for (const cr of charactersRaw) {
    const c = normalizeCharacter(cr);
    if (c) characters.push(c);
  }
  return {
    id: ensureString(b.id, `book_${index + 1}`),
    title: ensureString(b.title, `Band ${index + 1}`),
    bookNumber: Math.max(1, Math.trunc(ensureNumber(b.bookNumber, index + 1))),
    yearsAfterPrevious: Math.max(0, ensureNumber(b.yearsAfterPrevious, 0)),
    characters,
    factions: ensureStringArray(b.factions),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Verknüpft mehrere Manuskripte (Bände) zu einer Reihe.
 * Bände werden aufsteigend nach `bookNumber` sortiert; alle Felder werden
 * defensiv normalisiert. Deterministisch — gleiche Eingabe, gleiches Ergebnis.
 */
export function createSeriesUniverse(books: SeriesBook[], title?: string): SeriesUniverse {
  const raw = Array.isArray(books) ? books : [];
  const normalized: SeriesBook[] = [];
  raw.forEach((b, i) => {
    const nb = normalizeBook(b, i);
    if (nb) normalized.push(nb);
  });
  // Stabile Sortierung nach Bandnummer (Determinismus).
  normalized.sort((a, b) => a.bookNumber - b.bookNumber);

  const first = normalized[0];
  const resolvedTitle = ensureString(title) || (first ? `${first.title} — Serie` : 'Unbenannte Serie');
  const id = first ? `universe:${slug(first.id)}` : 'universe:empty';

  return { id, title: resolvedTitle, books: normalized };
}

/**
 * Status-Audit einer Figur über alle Buchgrenzen hinweg.
 * Sammelt alle Erscheinungen (nach Bandnummer sortiert) und meldet
 * Widersprüche als lesbare Meldungen.
 */
export function auditCharacterAcrossBooks(
  character: string,
  universe: SeriesUniverse,
): CharacterStatusAudit {
  const name = ensureString(character);
  const result: CharacterStatusAudit = { character: name, appearances: [], contradictions: [] };
  if (!name || !universe || !Array.isArray(universe.books)) return result;

  const appearances = buildAppearances(name, universe);

  result.appearances = appearances.map((a) => ({
    bookNumber: a.bookNumber,
    alive: a.alive,
    injuries: [...a.injuries],
    ...(a.rank !== undefined ? { rank: a.rank } : {}),
  }));
  result.contradictions = collectContradictions(name, appearances).map((c) => c.message);
  return result;
}

/**
 * Interner Builder: sammelt die (erste) Erscheinung einer Figur pro Band,
 * angereichert um Bündnisse (für die Oszillations-Prüfung), sortiert nach
 * Bandnummer. Deterministisch.
 */
function buildAppearances(name: string, universe: SeriesUniverse): AuditAppearance[] {
  const seenBooks = new Set<number>();
  const appearances: AuditAppearance[] = [];
  for (const book of universe.books) {
    if (!book || !Array.isArray(book.characters)) continue;
    if (seenBooks.has(book.bookNumber)) continue;
    for (const c of book.characters) {
      if (c && c.name === name) {
        seenBooks.add(book.bookNumber);
        const appearance: AuditAppearance = {
          bookNumber: book.bookNumber,
          alive: c.alive,
          injuries: [...c.injuries],
          alliances: [...c.alliances],
        };
        if (c.rank) appearance.rank = c.rank;
        appearances.push(appearance);
        break;
      }
    }
  }
  appearances.sort((a, b) => a.bookNumber - b.bookNumber);
  return appearances;
}

/**
 * Universums-Diff zwischen zwei Bänden: vergleicht den Zustand am Ende von
 * `fromBook` mit dem von `toBook` (Endpunkt-Vergleich). `yearsElapsed` summiert
 * `yearsAfterPrevious` aller Bände im Intervall (fromBook, toBook].
 */
export function diffUniverse(
  universe: SeriesUniverse,
  fromBook: number,
  toBook: number,
): UniverseDiff {
  const from = Math.trunc(ensureNumber(fromBook, 1));
  const to = Math.trunc(ensureNumber(toBook, from));
  const empty: UniverseDiff = {
    fromBook: from,
    toBook: to,
    characterChanges: [],
    factionChanges: [],
    yearsElapsed: 0,
  };
  if (!universe || !Array.isArray(universe.books)) return empty;
  if (to <= from) return empty;

  let yearsElapsed = 0;
  for (const book of universe.books) {
    if (book.bookNumber > from && book.bookNumber <= to) {
      yearsElapsed += Math.max(0, ensureNumber(book.yearsAfterPrevious, 0));
    }
  }

  const fromB = universe.books.find((b) => b.bookNumber === from);
  const toB = universe.books.find((b) => b.bookNumber === to);
  const characterChanges: string[] = [];
  const factionChanges: string[] = [];

  if (fromB && toB) {
    const fromChars = new Map<string, BookCharacter>();
    for (const c of fromB.characters) fromChars.set(c.name, c);
    const toChars = new Map<string, BookCharacter>();
    for (const c of toB.characters) toChars.set(c.name, c);

    const names = [...new Set([...fromChars.keys(), ...toChars.keys()])].sort();
    for (const name of names) {
      const a = fromChars.get(name);
      const b = toChars.get(name);
      if (a && !b) {
        characterChanges.push(`"${name}" tritt in Band ${to} nicht mehr auf.`);
        continue;
      }
      if (!a && b) {
        characterChanges.push(`"${name}" tritt neu in Band ${to} auf.`);
        continue;
      }
      if (!a || !b) continue;

      if (a.alive !== b.alive) {
        characterChanges.push(
          `"${name}": ${a.alive ? 'lebendig' : 'tot'} → ${b.alive ? 'lebendig' : 'tot'}.`,
        );
      }
      const newInjuries = b.injuries.filter((i) => !a.injuries.includes(i));
      const lostInjuries = a.injuries.filter((i) => !b.injuries.includes(i));
      if (newInjuries.length) {
        characterChanges.push(`"${name}": neue Verletzung(en): ${newInjuries.join(', ')}.`);
      }
      if (lostInjuries.length) {
        characterChanges.push(`"${name}": verschwundene Verletzung(en): ${lostInjuries.join(', ')}.`);
      }
      const rankA = a.rank ?? '';
      const rankB = b.rank ?? '';
      if (rankA !== rankB) {
        characterChanges.push(`"${name}": Rang ${rankA || '—'} → ${rankB || '—'}.`);
      }
      const newAlliances = b.alliances.filter((x) => !a.alliances.includes(x));
      const endedAlliances = a.alliances.filter((x) => !b.alliances.includes(x));
      if (newAlliances.length) {
        characterChanges.push(`"${name}": neue Bündnisse: ${newAlliances.join(', ')}.`);
      }
      if (endedAlliances.length) {
        characterChanges.push(`"${name}": beendete Bündnisse: ${endedAlliances.join(', ')}.`);
      }
    }

    const fromFactions = new Set(fromB.factions);
    const toFactions = new Set(toB.factions);
    for (const f of [...toFactions].sort()) {
      if (!fromFactions.has(f)) factionChanges.push(`Neue Fraktion: "${f}".`);
    }
    for (const f of [...fromFactions].sort()) {
      if (!toFactions.has(f)) factionChanges.push(`Fraktion entfernt: "${f}".`);
    }
  }

  return { fromBook: from, toBook: to, characterChanges, factionChanges, yearsElapsed };
}

/**
 * Erkennt alle Widersprüche über alle Figuren des Universums.
 * Deterministisch: Figuren werden alphabetisch abgearbeitet.
 */
export function detectContradictions(universe: SeriesUniverse): Contradiction[] {
  if (!universe || !Array.isArray(universe.books)) return [];

  const names = new Set<string>();
  for (const book of universe.books) {
    if (!book || !Array.isArray(book.characters)) continue;
    for (const c of book.characters) {
      if (c && ensureString(c.name)) names.add(c.name);
    }
  }

  const out: Contradiction[] = [];
  for (const name of [...names].sort()) {
    out.push(...collectContradictions(name, buildAppearances(name, universe)));
  }
  return out;
}

// ─── Contradiction Engine ───────────────────────────────────────────────────

/**
 * Kernprüfung über die (bereits sortierten) Erscheinungen einer Figur.
 * Liefert strukturierte Widersprüche — wird von `auditCharacterAcrossBooks`
 * (als Meldungsstrings) und `detectContradictions` (strukturiert) genutzt.
 */
function collectContradictions(
  character: string,
  appearances: AuditAppearance[],
): Contradiction[] {
  const out: Contradiction[] = [];
  if (!Array.isArray(appearances) || appearances.length === 0) return out;
  const sorted = [...appearances].sort((a, b) => a.bookNumber - b.bookNumber);

  // 1) Tod ist irreversibel: tot in Band X, lebendig in Band Y > X.
  let deathBook: number | null = null;
  for (const app of sorted) {
    if (deathBook !== null && app.alive) {
      out.push({
        kind: 'death',
        character,
        fromBook: deathBook,
        toBook: app.bookNumber,
        message:
          `"${character}" ist in Band ${deathBook} gestorben, in Band ${app.bookNumber} ` +
          `aber wieder lebendig.`,
      });
      break; // Ein Revival-Widerspruch genügt.
    }
    if (deathBook === null && !app.alive) deathBook = app.bookNumber;
  }

  // 2) Verletzungen sind irreversibel (verlorene Gliedmaßen kehren nicht zurück):
  //    eine in Band X etablierte Verletzung darf in keinem späteren Band fehlen.
  const injuryFirstBook = new Map<string, number>();
  const reportedInjuries = new Set<string>();
  for (const app of sorted) {
    for (const injury of app.injuries) {
      if (!injuryFirstBook.has(injury)) injuryFirstBook.set(injury, app.bookNumber);
    }
    for (const [injury, firstBook] of [...injuryFirstBook]) {
      if (
        firstBook < app.bookNumber &&
        !app.injuries.includes(injury) &&
        !reportedInjuries.has(injury)
      ) {
        out.push({
          kind: 'injury',
          character,
          fromBook: firstBook,
          toBook: app.bookNumber,
          message:
            `Verletzung "${injury}" von "${character}" (seit Band ${firstBook}) fehlt in ` +
            `Band ${app.bookNumber} — verlorene Gliedmaßen dürfen nicht zurückkehren.`,
        });
        reportedInjuries.add(injury);
        injuryFirstBook.delete(injury);
      }
    }
  }

  // 3) Rang-Oszillation: ein Rang, der nach einem Wechsel/Verlust wiederkehrt.
  const rankHistory = sorted
    .filter((a): a is AuditAppearance & { rank: string } => typeof a.rank === 'string' && a.rank.length > 0)
    .map((a) => ({ book: a.bookNumber, rank: a.rank }));

  const rankValues = [...new Set(rankHistory.map((r) => r.rank))];
  for (const value of rankValues) {
    const positions: number[] = [];
    rankHistory.forEach((r, idx) => {
      if (r.rank === value) positions.push(idx);
    });
    for (let p = 0; p + 1 < positions.length; p++) {
      const a = positions[p];
      const b = positions[p + 1];
      let interleaved = false;
      for (let m = a + 1; m < b; m++) {
        if (rankHistory[m].rank !== value) {
          interleaved = true;
          break;
        }
      }
      if (interleaved) {
        out.push({
          kind: 'rank',
          character,
          fromBook: rankHistory[a].book,
          toBook: rankHistory[b].book,
          message:
            `Rang "${value}" von "${character}" kehrt in Band ${rankHistory[b].book} zurück, ` +
            `nachdem er zuvor abgelegt/gewechselt wurde.`,
        });
        break;
      }
    }
  }

  // 4) Bündnis-Oszillation: ein Bündnis, das nach einem Bruch wiederkehrt.
  const allAlliances = new Set<string>();
  sorted.forEach((a) => a.alliances.forEach((x) => allAlliances.add(x)));
  for (const alliance of [...allAlliances].sort()) {
    const positions: number[] = [];
    sorted.forEach((app, idx) => {
      if (app.alliances.includes(alliance)) positions.push(idx);
    });
    for (let p = 0; p + 1 < positions.length; p++) {
      const a = positions[p];
      const b = positions[p + 1];
      let absentBook: number | null = null;
      for (let m = a + 1; m < b; m++) {
        if (!sorted[m].alliances.includes(alliance)) {
          absentBook = sorted[m].bookNumber;
          break;
        }
      }
      if (absentBook !== null) {
        out.push({
          kind: 'alliance',
          character,
          fromBook: sorted[a].bookNumber,
          toBook: sorted[b].bookNumber,
          message:
            `Bündnis "${alliance}" von "${character}" kehrt in Band ${sorted[b].bookNumber} ` +
            `zurück, obwohl es in Band ${absentBook} nicht bestand.`,
        });
        break;
      }
    }
  }

  return out;
}
