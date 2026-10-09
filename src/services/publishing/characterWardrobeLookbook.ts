// CharacterWardrobeLookbook (WP 123.2, Meilenstein 59.0 / v7.1.0)
//
// Garderoben- & Kostüm-Lookbook für Film- und Kostümdesign.
// Verfolgt Figuren-Kleidung über Kapitel, prüft Kontinuität und
// erzeugt deterministische Lookbook-Exporte mit SVG-Cover.
//
// Drei deterministische Werkzeuge:
//
//   1. checkWardrobeContinuity — Kontinuitäts-Wächter für Kleidungs-Zustände
//   2. buildLookbook          — Lookbook-Export mit SVG-Cover
//   3. createSampleWardrobeEntry / createSampleLookbook — Factory-Funktionen
//
// Design-Regeln (analog vectorCartographer / characterVoiceEvolution):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Deterministische Zufalls-Werkzeuge (FNV-1a + mulberry32)
// ---------------------------------------------------------------------------

/** FNV-1a Hash — liefert einen unsigned 32-bit Integer. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — liefert eine deterministische Zufallszahl im Intervall [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Private Hilfsfunktion: wählt ein zufälliges Element aus einem Array.
 * Wirft einen Fehler bei leerem Array.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error('pick() kann nicht aus leerem Array wählen');
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Zustand eines Kleidungsstücks. */
export type GarmentCondition = 'pristine' | 'worn' | 'damaged' | 'torn';

/** Ein Kleidungsstück mit Name, Farbe und Zustand. */
export interface GarmentItem {
  name: string;
  color: string;
  condition: GarmentCondition;
}

/** Ein Garderoben-Eintrag für eine Figur in einem Kapitel. */
export interface WardrobeEntry {
  characterId: string;
  chapter: number;
  category: string;
  items: GarmentItem[];
}

/** Ergebnis der Kontinuitäts-Prüfung. */
export interface ContinuityReport {
  violations: string[];
  warnings: string[];
  brokenAt: number | null;
}

/** Ein vereinfachter Lookbook-Eintrag. */
export interface LookbookEntry {
  chapter: number;
  category: string;
  items: string[];
}

/** Ergebnis des Lookbook-Exports. */
export interface LookbookResult {
  title: string;
  pages: number;
  entries: LookbookEntry[];
  coverSvg: string;
}

/** Eine Garderoben-Kategorie. */
export interface OutfitCategory {
  id: string;
  name: string;
  description: string;
  typicalItems: string[];
}

// ---------------------------------------------------------------------------
// Garderoben-Kategorien (WP 123.2.1)
// ---------------------------------------------------------------------------

export const OUTFIT_CATEGORIES: readonly OutfitCategory[] = [
  {
    id: 'travel',
    name: 'Reise',
    description: 'Praktische Kleidung für unterwegs: strapazierfähige Stoffe, wetterfest, vielseitig kombinierbar.',
    typicalItems: ['Wanderrock', 'Lederstiefel', 'Reisemantel', 'Gürteltasche', 'Wollmütze'],
  },
  {
    id: 'banquet',
    name: 'Bankett',
    description: 'Formelle Kleidung für festliche Anlässe: Edelstoffe, Verzierungen, repräsentativ.',
    typicalItems: ['Seidenrock', 'Samttlage', 'Goldkette', 'Federhut', 'Spitzenschuhe'],
  },
  {
    id: 'battle',
    name: 'Schlacht',
    description: 'Kampf- und Schutzausrüstung: Rüstung, Waffen, helle Farben für Sichtbarkeit.',
    typicalItems: ['Kettenhemd', 'Stahlhelm', 'Panzerhandschuhe', 'Waffenrock', 'Verbeugschutz'],
  },
  {
    id: 'ceremony',
    name: 'Zeremonie',
    description: 'Ritual- und Zeremonialkleidung: Symbolträchtig, traditionell, oft weiß oder in Kultfarben.',
    typicalItems: ['Prachtgewand', 'Stola', 'Kronenreif', 'Seidenschleier', 'Ritualstab'],
  },
] as const;

// ---------------------------------------------------------------------------
// Kontinuitäts-Wächter (WP 123.2.2)
// ---------------------------------------------------------------------------

/** Rangordnung der Zustände für Sprung-Erkennung. */
const CONDITION_RANK: Record<GarmentCondition, number> = {
  pristine: 3,
  worn: 2,
  damaged: 1,
  torn: 0,
};

/**
 * Prüft die Kontinuität von Kleidungs-Zuständen über Kapitel hinweg.
 *
 * Warnen wird, wenn eine Figur in Kapitel 8 einen zerrissenen Umhang trägt,
 * in Kapitel 9 aber einen makellosen Doppelrock ohne Kleidungswechsel erscheint.
 * Kleidung heilt sich nicht von selbst — Sprünge ohne Zwischenstufen sind
 * ein Kontinuitäts-Fehler.
 *
 * Gibt ein ContinuityReport mit violations, warnings und brokenAt zurück.
 * brokenAt ist das früheste Kapitel mit einem Fehler, oder null bei Fehlerfreiheit.
 */
export function checkWardrobeContinuity(entries: WardrobeEntry[]): ContinuityReport {
  const violations: string[] = [];
  const warnings: string[] = [];
  let brokenAt: number | null = null;

  if (!entries || entries.length === 0) {
    return { violations, warnings, brokenAt };
  }

  // Nach Figur gruppieren
  const byCharacter = new Map<string, WardrobeEntry[]>();
  for (const entry of entries) {
    const list = byCharacter.get(entry.characterId) ?? [];
    list.push(entry);
    byCharacter.set(entry.characterId, list);
  }

  for (const [characterId, charEntries] of byCharacter) {
    // Kapitel aufsteigend sortieren
    charEntries.sort((a, b) => a.chapter - b.chapter);

    // Verfolge jedes Kleidungsstück über Kapitel
    const itemHistory = new Map<string, { chapter: number; condition: GarmentCondition }[]>();

    for (const entry of charEntries) {
      for (const item of entry.items) {
        const history = itemHistory.get(item.name) ?? [];
        history.push({ chapter: entry.chapter, condition: item.condition });
        itemHistory.set(item.name, history);
      }
    }

    // Prüfe Sprünge im Zustand — pro Kleidungsstück und gesamt pro Figur
    for (const [itemName, history] of itemHistory) {
      if (history.length < 2) continue;

      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        const rankDiff = CONDITION_RANK[curr.condition] - CONDITION_RANK[prev.condition];

        // Dramatischer Verfall ohne Zwischenstufen → Violation
        if (rankDiff <= -3) {
          const msg = `${characterId}: "${itemName}" von '${prev.condition}' (Kap. ${prev.chapter}) zu '${curr.condition}' (Kap. ${curr.chapter}) — dramatischer Verfall ohne Zwischenstufen`;
          violations.push(msg);
          if (brokenAt === null || curr.chapter < brokenAt) {
            brokenAt = curr.chapter;
          }
        }
        // Unrealistische Verbesserung ohne Reparatur → Warning
        else if (rankDiff >= 3) {
          const msg = `${characterId}: "${itemName}" von '${prev.condition}' (Kap. ${prev.chapter}) zu '${curr.condition}' (Kap. ${curr.chapter}) — Kleidung heilt sich nicht von selbst`;
          warnings.push(msg);
          if (brokenAt === null || curr.chapter < brokenAt) {
            brokenAt = curr.chapter;
          }
        }
        // Ungewöhnlicher Zustandswechsel (2 Sprünge) → Warning
        else if (Math.abs(rankDiff) === 2) {
          const msg = `${characterId}: "${itemName}" von '${prev.condition}' (Kap. ${prev.chapter}) zu '${curr.condition}' (Kap. ${curr.chapter}) — ungewöhnlicher Zustandswechsel`;
          warnings.push(msg);
          if (brokenAt === null || curr.chapter < brokenAt) {
            brokenAt = curr.chapter;
          }
        }
      }
    }

    // Figur-Ebene: Sprünge im schlechtesten/besten Zustand zwischen Kapiteln
    const chapterStates = new Map<number, { worst: GarmentCondition; best: GarmentCondition }>();
    for (const entry of charEntries) {
      let worst: GarmentCondition = 'pristine';
      let best: GarmentCondition = 'pristine';
      for (const item of entry.items) {
        if (CONDITION_RANK[item.condition] < CONDITION_RANK[worst]) worst = item.condition;
        if (CONDITION_RANK[item.condition] > CONDITION_RANK[best]) best = item.condition;
      }
      chapterStates.set(entry.chapter, { worst, best });
    }

    const sortedChapters = [...chapterStates.keys()].sort((a, b) => a - b);
    for (let i = 1; i < sortedChapters.length; i++) {
      const prevChapter = sortedChapters[i - 1];
      const currChapter = sortedChapters[i];
      const prev = chapterStates.get(prevChapter)!;
      const curr = chapterStates.get(currChapter)!;

      // Figur erscheint zerrissen, danach wieder makellos → Kontinuitäts-Warnung
      const worstJump = CONDITION_RANK[curr.worst] - CONDITION_RANK[prev.worst];
      if (worstJump >= 3) {
        const msg = `${characterId}: schlechteste Kleidung von '${prev.worst}' (Kap. ${prevChapter}) zu '${curr.worst}' (Kap. ${currChapter}) — Kleidungswechsel ohne Zwischenstufen`;
        warnings.push(msg);
        if (brokenAt === null || currChapter < brokenAt) {
          brokenAt = currChapter;
        }
      }
    }
  }

  return { violations, warnings, brokenAt };
}

// ---------------------------------------------------------------------------
// Lookbook-Export (WP 123.2.3)
// ---------------------------------------------------------------------------

/** Anzahl der Einträge pro Lookbook-Seite. */
const LOOKBOOK_ENTRIES_PER_PAGE = 6;

/**
 * Baut ein deterministisches Lookbook für eine Figur.
 *
 * Gibt Titel, Seitenzahl, vereinfachte Einträge und ein SVG-Cover zurück.
 * Das Cover enthält den Figurnamen und ein Garderoben-Raster.
 */
export function buildLookbook(
  characterId: string,
  entries: WardrobeEntry[],
  seed: number,
): LookbookResult {
  const rng = createSeededRandom(hashString(`${characterId}::${seed}`));
  const safeEntries = entries ?? [];
  const title = `${characterId} — Garderoben-Lookbook`;

  // Einträge vereinfachen
  const lookbookEntries: LookbookEntry[] = safeEntries.map((e) => ({
    chapter: e.chapter,
    category: e.category,
    items: e.items.map((item) => `${item.name} (${item.color}, ${item.condition})`),
  }));

  // Seiten berechnen (mindestens 1 für das Cover)
  const pages = Math.max(1, Math.ceil(lookbookEntries.length / LOOKBOOK_ENTRIES_PER_PAGE));

  // Cover SVG generieren
  const coverSvg = generateCoverSvg(characterId, safeEntries, rng);

  return { title, pages, entries: lookbookEntries, coverSvg };
}

/**
 * Generiert das SVG-Cover für das Lookbook.
 * Deterministisch: gleiche Eingabe → gleiches SVG.
 */
function generateCoverSvg(
  characterId: string,
  entries: WardrobeEntry[],
  rng: () => number,
): string {
  const width = 400;
  const height = 600;
  const colors = ['var(--bg)', 'var(--muted)', 'var(--accent)', 'var(--bg)', 'var(--accent)', 'var(--muted)'];

  const gridCols = 4;
  const gridRows = Math.max(1, Math.ceil(entries.length / gridCols));
  const cellW = width / gridCols;
  const cellH = Math.min(80, (height - 160) / gridRows);

  let gridSvg = '';
  for (let i = 0; i < entries.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const x = col * cellW;
    const y = 120 + row * cellH;
    const color = pick(colors, rng);
    const entry = entries[i];
    const label = `Kap. ${entry.chapter} · ${entry.category}`;

    gridSvg += `<rect x="${x + 4}" y="${y}" width="${cellW - 8}" height="${cellH - 8}" fill="${color}" rx="6" opacity="0.85"/>`;
    gridSvg += `<text x="${x + cellW / 2}" y="${y + cellH / 2}" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="var(--fg)">${escapeXml(label)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="var(--bg)"/>`
    + `<rect x="10" y="10" width="${width - 20}" height="${height - 20}" fill="none" stroke="var(--accent)" stroke-width="3" rx="12"/>`
    + `<text x="${width / 2}" y="50" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="var(--accent)">${escapeXml(characterId)}</text>`
    + `<text x="${width / 2}" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="var(--muted)">Garderoben-Lookbook</text>`
    + `<text x="${width / 2}" y="95" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="var(--muted)">${entries.length} Einträge</text>`
    + gridSvg
    + `</svg>`;
}

/** Escaped XML-Sonderzeichen für SVG-Texte. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Erstellt einen Beispiel-Garderoben-Eintrag.
 * Deterministisch — immer identisch.
 */
export function createSampleWardrobeEntry(): WardrobeEntry {
  return {
    characterId: 'isolde',
    chapter: 1,
    category: 'travel',
    items: [
      { name: 'Umhang', color: 'grau', condition: 'pristine' },
      { name: 'Wanderrock', color: 'braun', condition: 'worn' },
      { name: 'Lederstiefel', color: 'dunkelbraun', condition: 'pristine' },
    ],
  };
}

/**
 * Erstellt ein komplettes Beispiel-Lookbook.
 * Nutzt createSeededRandom + hashString für deterministische Farben.
 */
export function createSampleLookbook(): LookbookResult {
  const seed = 42;

  const characterId = 'isolde';
  const entries: WardrobeEntry[] = [
    {
      characterId,
      chapter: 1,
      category: 'travel',
      items: [
        { name: 'Umhang', color: 'grau', condition: 'pristine' },
        { name: 'Wanderrock', color: 'braun', condition: 'worn' },
      ],
    },
    {
      characterId,
      chapter: 3,
      category: 'battle',
      items: [
        { name: 'Kettenhemd', color: 'stahl', condition: 'worn' },
        { name: 'Stahlhelm', color: 'grau', condition: 'damaged' },
      ],
    },
    {
      characterId,
      chapter: 5,
      category: 'banquet',
      items: [
        { name: 'Seidenrock', color: 'burgunder', condition: 'pristine' },
        { name: 'Goldkette', color: 'gold', condition: 'pristine' },
      ],
    },
    {
      characterId,
      chapter: 7,
      category: 'ceremony',
      items: [
        { name: 'Prachtgewand', color: 'weiß', condition: 'pristine' },
        { name: 'Kronenreif', color: 'gold', condition: 'pristine' },
      ],
    },
  ];

  return buildLookbook(characterId, entries, seed);
}
