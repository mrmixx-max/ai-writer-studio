/**
 * Auto-Glossar-Service — WP 29.1 (Dynamisches Lore-Wiki & Pop-Up-Glossar)
 *
 * Lokaler, deterministischer Service zur Extraktion von Entitäten,
 * Generierung von EPUB3-Pop-Up-Fußnoten und Spoiler-Filterung.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type EntityType = 'character' | 'deity' | 'faction' | 'weapon' | 'place';

export interface GlossaryEntry {
  term: string;
  type: EntityType;
  definition: string;
  firstMentionChapter: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const DEITY_PATTERN = /\b(gott|göttin|götter|zeus|athena|apollo|artemis|ares|aphrodite|hermes|hestia|demeter|poseidon|hades|dionysus|hephaestus|heras)\b/i;
const FACTION_PATTERN = /\b(orden|gilde|clan|stamm|liga|bund|verein|gruppe|fraktion|partei|armee|legion|flotte)\b/i;
const WEAPON_PATTERN = /\b(schwert|dolch|axt|streitkolben|lanze|bogen|pfeil|speer|schild|helm|rüstung|knüppel|peitsche)\b/i;
const PLACE_PATTERN = /\b(burg|schloss|festung|tempel|markt|dorf|stadt|tal|berg|wald|see|fluss|insel|höhle|brücke|tor|mauer)\b/i;


// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extrahiert Entitäten aus einem Text.
 */
export function extractEntities(text: string): GlossaryEntry[] {
  if (!text || typeof text !== 'string') return [];

  const entries: GlossaryEntry[] = [];
  const seen = new Set<string>();

  // Götter
  const deityMatches = text.match(DEITY_PATTERN);
  if (deityMatches) {
    for (const match of deityMatches) {
      const term = match.toLowerCase();
      if (!seen.has(term)) {
        seen.add(term);
        entries.push({
          term: match,
          type: 'deity',
          definition: `Gottheit: ${match}`,
          firstMentionChapter: 1,
        });
      }
    }
  }

  // Fraktionen
  const factionMatches = text.match(FACTION_PATTERN);
  if (factionMatches) {
    for (const match of factionMatches) {
      const term = match.toLowerCase();
      if (!seen.has(term)) {
        seen.add(term);
        entries.push({
          term: match,
          type: 'faction',
          definition: `Fraktion: ${match}`,
          firstMentionChapter: 1,
        });
      }
    }
  }

  // Waffen
  const weaponMatches = text.match(WEAPON_PATTERN);
  if (weaponMatches) {
    for (const match of weaponMatches) {
      const term = match.toLowerCase();
      if (!seen.has(term)) {
        seen.add(term);
        entries.push({
          term: match,
          type: 'weapon',
          definition: `Waffe: ${match}`,
          firstMentionChapter: 1,
        });
      }
    }
  }

  // Orte
  const placeMatches = text.match(PLACE_PATTERN);
  if (placeMatches) {
    for (const match of placeMatches) {
      const term = match.toLowerCase();
      if (!seen.has(term)) {
        seen.add(term);
        entries.push({
          term: match,
          type: 'place',
          definition: `Ort: ${match}`,
          firstMentionChapter: 1,
        });
      }
    }
  }

  // Charaktere (Eigennamen — alle Großbuchstaben-Wörter, die nicht bereits als Götter/Fraktionen/Waffen/Orte erkannt wurden)
  const charMatches = text.matchAll(/\b([A-ZÄÖÜ][a-zäöüß]+)\b/g);
  for (const match of charMatches) {
    const term = match[1];
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      entries.push({
        term,
        type: 'character',
        definition: `Charakter: ${term}`,
        firstMentionChapter: 1,
      });
    }
  }

  return entries.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Wandelt Glossar-Referenzen in EPUB3-Pop-Up-Fußnoten um.
 */
export function generatePopUpFootnotes(text: string, entries: GlossaryEntry[]): string {
  if (!text || typeof text !== 'string') return '';
  if (!entries || entries.length === 0) return text;

  let result = text;

  for (const entry of entries) {
    const pattern = new RegExp(`\\b${entry.term}\\b`, 'gi');
    result = result.replace(pattern, (match) => {
      return `<a epub:type="noteref" href="#glossar-${entry.term.toLowerCase().replace(/\s+/g, '-')}">${match}</a>`;
    });
  }

  return result;
}

/**
 * Filtert Spoiler aus Glossar-Definitionen.
 */
export function applySpoilerFilter(entries: GlossaryEntry[], currentChapter: number): GlossaryEntry[] {
  if (!entries || entries.length === 0) return [];
  const safeChapter = Math.max(1, currentChapter || 1);

  return entries.filter((entry) => {
    // Zeige nur Einträge, die bereits erwähnt wurden
    return entry.firstMentionChapter <= safeChapter;
  });
}
