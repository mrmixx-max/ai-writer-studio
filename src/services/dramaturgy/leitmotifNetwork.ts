// Leitmotiv-Network (WP 39.1).
//
// Werkzeuge, um wiederkehrende Symbole eines Manuskripts zu katalogisieren und
// ihre Bedeutungs-Wandlung über die drei Akte zu prüfen:
//
//   1. trackSymbols              — katalogisiert wiederkehrende Gegenstände,
//                                 Wetterlagen, Farben und Tiere über die Kapitel.
//   2. analyzeMetamorphosis      — prüft, wie sich die Präsenz/Bedeutung eines
//                                 Symbols über die Akte wandelt.
//   3. generateResonanceHeatmap  — zeigt die Kapitel-Abdeckung mehrerer Symbole
//                                 als Matrix und markiert Auftrittslücken.
//
// Design-Regeln (analog zu dialogueSubtext / subplotWeaver / neuroPacing):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Arrays
//     bzw. ein definiertes Null-Ergebnis statt zu werfen.
//   - Keine Zufallswerte, keine Zeitabhängigkeit: identische Eingabe ⇒
//     identische Ausgabe.
//
// Kapitel sind 1-basiert: der Index `i` des übergebenen `chapters`-Arrays
// entspricht Kapitel `i + 1`.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Symbol-Kategorien des Leitmotiv-Netzwerks. */
export const SYMBOL_CATEGORIES = ["object", "weather", "color", "animal"] as const;

/** Typ einer gültigen Symbol-Kategorie. */
export type SymbolCategory = (typeof SYMBOL_CATEGORIES)[number];

/** Ein einzelnes Symbol-Vorkommen in einem Kapitel (1-basiert). */
export interface SymbolOccurrence {
  /** Kapitelnummer (1-basiert). */
  chapter: number;
  /** Anzahl der Treffer des Symbols in diesem Kapitel (≥ 1). */
  count: number;
}

/** Katalogisierter Verlauf eines Symbols über die Kapitel. */
export interface SymbolTrack {
  /** Kanonischer Symbolname (lowercase). */
  symbol: string;
  /** Symbol-Kategorie. */
  category: SymbolCategory;
  /** Auftritte, aufsteigend nach Kapitel sortiert. */
  occurrences: SymbolOccurrence[];
}

/** Bedeutung eines Symbols innerhalb eines Akts. */
export interface ActMeaning {
  /** Aktnummer (1-basiert, 1–3). */
  act: number;
  /** Deterministisch abgeleitete Bedeutung im Akt. */
  meaning: string;
  /** Summe der Auftritte im Akt. */
  occurrences: number;
}

/** Bedeutungs-Wandlung eines Symbols über die drei Akte. */
export interface MetamorphosisCurve {
  /** Kanonischer Symbolname. */
  symbol: string;
  /** Drei Akte (immer nummeriert 1–3). */
  acts: ActMeaning[];
  /** Wandelt sich die Bedeutung über die Akte? */
  evolves: boolean;
}

/** Kapitel-Abdeckung mehrerer Symbole als Matrix. */
export interface ResonanceHeatmap {
  /** Symbolnamen (alphabetisch, entspricht den Matrix-Zeilen). */
  symbols: string[];
  /** Anzahl der Kapitel (höchste vorkommende Kapitelnummer). */
  chapters: number;
  /** Matrix: Zeile je Symbol, Spalte je Kapitel (1-basiert), Wert = Auftritte. */
  matrix: number[][];
  /** Symbole mit Auftrittslücke zwischen erstem und letztem Auftreten. */
  gaps: string[];
}

/** Eine kuratierte Symbol-Definition (Symbolname + zugehörige Schlüsselwörter). */
export interface SymbolDefinition {
  /** Kanonischer Symbolname (lowercase). */
  symbol: string;
  /** Symbol-Kategorie. */
  category: SymbolCategory;
  /** Lowercase-Schlüsselwörter, die als Auftritt des Symbols zählen. */
  keywords: readonly string[];
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Anzahl der Akte für die Metamorphose-Analyse. */
export const ACT_COUNT = 3;

/**
 * Obergrenze der Kapitelanzahl in der Heatmap. Schützt vor speichersprengenden
 * Eingaben mit absurden Kapitelnummern; Auftritte jenseits dieser Grenze werden
 * in der Matrix ignoriert.
 */
export const MAX_HEATMAP_CHAPTERS = 5000;

/** Reihenfolge der Kategorien für die deterministische Sortierung. */
const CATEGORY_RANK: Record<SymbolCategory, number> = {
  object: 0,
  weather: 1,
  color: 2,
  animal: 3,
};

/**
 * Kuratierter Symbol-Katalog (deutsch). Schlüsselwörter sind lowercase und
 * werden als ganze Tokens gematcht (kein Substring-Matching, damit z. B. „Brot"
 * nicht als Farbe „rot" zählt). Plural-/Umlautschreibweisen sind als eigene
 * Schlüsselwörter hinterlegt.
 */
export const SYMBOL_CATALOG: readonly SymbolDefinition[] = [
  // --- Gegenstände -------------------------------------------------------
  { symbol: "spiegel", category: "object", keywords: ["spiegel", "spiegels", "spiegelbild", "spiegelbilder"] },
  { symbol: "schlüssel", category: "object", keywords: ["schlüssel", "schlüssels", "schluessel", "schluessels"] },
  { symbol: "messer", category: "object", keywords: ["messer", "messers", "dolch", "dolche", "dolches", "klinge", "klingen"] },
  { symbol: "uhr", category: "object", keywords: ["uhr", "uhren"] },
  { symbol: "ring", category: "object", keywords: ["ring", "ringe", "ringes"] },
  { symbol: "brief", category: "object", keywords: ["brief", "briefe", "briefes", "briefumschlag"] },
  { symbol: "koffer", category: "object", keywords: ["koffer", "koffers"] },
  { symbol: "krone", category: "object", keywords: ["krone", "kronen"] },
  { symbol: "kerze", category: "object", keywords: ["kerze", "kerzen", "kerzenschein", "kerzenlicht"] },
  { symbol: "tür", category: "object", keywords: ["tür", "türen", "tuer", "tueren"] },
  { symbol: "fenster", category: "object", keywords: ["fenster", "fensters"] },
  { symbol: "schwert", category: "object", keywords: ["schwert", "schwerter", "schwertes"] },
  { symbol: "brille", category: "object", keywords: ["brille", "brillen"] },
  { symbol: "foto", category: "object", keywords: ["foto", "fotos", "photographie", "photographien"] },
  { symbol: "buch", category: "object", keywords: ["buch", "bücher", "buecher", "buches"] },
  { symbol: "karte", category: "object", keywords: ["karte", "karten", "landkarte", "landkarten"] },
  { symbol: "truhe", category: "object", keywords: ["truhe", "truhen", "schatulle", "schatullen"] },
  { symbol: "amulett", category: "object", keywords: ["amulett", "amulette", "talisman", "talismane"] },
  { symbol: "puppe", category: "object", keywords: ["puppe", "puppen"] },
  { symbol: "blume", category: "object", keywords: ["blume", "blumen", "rose", "rosen"] },
  { symbol: "medaillon", category: "object", keywords: ["medaillon", "medaillons"] },
  { symbol: "schreibmaschine", category: "object", keywords: ["schreibmaschine", "schreibmaschinen"] },
  { symbol: "gitarre", category: "object", keywords: ["gitarre", "gitarren"] },
  { symbol: "geige", category: "object", keywords: ["geige", "geigen", "violine", "violinen"] },

  // --- Wetterlagen -------------------------------------------------------
  { symbol: "regen", category: "weather", keywords: ["regen", "regnet", "regenschauer", "regentropfen", "platzregen", "nieselregen"] },
  { symbol: "sturm", category: "weather", keywords: ["sturm", "stürme", "stuerme", "sturmes", "stürmisch", "stuermisch"] },
  { symbol: "gewitter", category: "weather", keywords: ["gewitter", "gewitters", "blitz", "blitze", "donner", "donnert", "donnergrollen"] },
  { symbol: "nebel", category: "weather", keywords: ["nebel", "nebels", "neblig", "nebelschwaden"] },
  { symbol: "schnee", category: "weather", keywords: ["schnee", "schnees", "schneit", "schneefall", "schneesturm", "schneeflocken"] },
  { symbol: "sonne", category: "weather", keywords: ["sonne", "sonnenschein", "sonnig", "sonnenlicht"] },
  { symbol: "wolke", category: "weather", keywords: ["wolke", "wolken", "wolkig", "wolkenbruch"] },
  { symbol: "wind", category: "weather", keywords: ["wind", "winde", "windes", "windig", "windböen", "windboeen"] },
  { symbol: "frost", category: "weather", keywords: ["frost", "frostig", "fröste", "froeste", "eis", "eisig"] },
  { symbol: "hitze", category: "weather", keywords: ["hitze", "heiß", "heiss", "hitzewelle"] },
  { symbol: "dunkelheit", category: "weather", keywords: ["dunkelheit", "dunkel", "finsternis", "düster", "duester"] },
  { symbol: "kälte", category: "weather", keywords: ["kälte", "kaelte", "kalt"] },
  { symbol: "regenbogen", category: "weather", keywords: ["regenbogen"] },

  // --- Farben ------------------------------------------------------------
  { symbol: "rot", category: "color", keywords: ["rot", "rote", "roten", "roter", "rotes", "blutrot", "feuerrot", "weinrot"] },
  { symbol: "blau", category: "color", keywords: ["blau", "blaue", "blauen", "blauer", "blaues", "dunkelblau", "hellblau", "azurblau"] },
  { symbol: "grün", category: "color", keywords: ["grün", "grüne", "grünen", "grüner", "grünes", "gruen", "smaragdgrün", "smaragdgruen"] },
  { symbol: "gelb", category: "color", keywords: ["gelb", "gelbe", "gelben", "gelber", "gelbes", "goldgelb"] },
  { symbol: "schwarz", category: "color", keywords: ["schwarz", "schwarze", "schwarzen", "schwarzer", "schwarzes", "pechschwarz", "nachtschwarz"] },
  { symbol: "weiß", category: "color", keywords: ["weiß", "weiße", "weißen", "weißer", "weißes", "weiss", "weisse", "weissen", "schneeweiß", "schneeweiss"] },
  { symbol: "grau", category: "color", keywords: ["grau", "graue", "grauen", "grauer", "graues", "aschgrau", "silbergrau"] },
  { symbol: "silber", category: "color", keywords: ["silber", "silbern", "silberne", "silbernen"] },
  { symbol: "gold", category: "color", keywords: ["gold", "golden", "goldene", "goldenen", "goldenes"] },
  { symbol: "violett", category: "color", keywords: ["violett", "violette", "lila", "purpur", "purpurn", "purpurrot"] },
  { symbol: "braun", category: "color", keywords: ["braun", "braune", "braunen", "brauner", "braunes"] },
  { symbol: "orange", category: "color", keywords: ["orange", "orangen", "orangefarben"] },

  // --- Tiere -------------------------------------------------------------
  { symbol: "wolf", category: "animal", keywords: ["wolf", "wölfe", "woelfe", "wolfes", "wölfin", "woelfin"] },
  { symbol: "rabe", category: "animal", keywords: ["rabe", "raben", "krähe", "krähen", "kraehe", "kraehen"] },
  { symbol: "schlange", category: "animal", keywords: ["schlange", "schlangen", "viper", "vipern", "natter", "nattern"] },
  { symbol: "katze", category: "animal", keywords: ["katze", "katzen", "kater"] },
  { symbol: "hund", category: "animal", keywords: ["hund", "hunde", "hundes", "hündin", "huendin", "welpe", "welpen"] },
  { symbol: "pferd", category: "animal", keywords: ["pferd", "pferde", "pferdes", "hengst", "stute", "rappe"] },
  { symbol: "vogel", category: "animal", keywords: ["vogel", "vögel", "voegel", "vogels"] },
  { symbol: "motte", category: "animal", keywords: ["motte", "motten", "schmetterling", "schmetterlinge", "falter"] },
  { symbol: "spinne", category: "animal", keywords: ["spinne", "spinnen", "spinnennetz"] },
  { symbol: "ratte", category: "animal", keywords: ["ratte", "ratten"] },
  { symbol: "maus", category: "animal", keywords: ["maus", "mäuse", "maeuse"] },
  { symbol: "bär", category: "animal", keywords: ["bär", "bären", "baer", "baeren"] },
  { symbol: "hirsch", category: "animal", keywords: ["hirsch", "hirsche", "reh", "rehe"] },
  { symbol: "schwan", category: "animal", keywords: ["schwan", "schwäne", "schwaene"] },
  { symbol: "eule", category: "animal", keywords: ["eule", "eulen"] },
  { symbol: "fuchs", category: "animal", keywords: ["fuchs", "füchse", "fuechse"] },
  { symbol: "biene", category: "animal", keywords: ["biene", "bienen"] },
  { symbol: "taube", category: "animal", keywords: ["taube", "tauben"] },
];

// ---------------------------------------------------------------------------
// Interne Indizes / Helfer
// ---------------------------------------------------------------------------

/** Schlüsselwort → Symbol-Definition (für Token-Matching). */
const KEYWORD_INDEX: ReadonlyMap<string, SymbolDefinition> = (() => {
  const index = new Map<string, SymbolDefinition>();
  for (const def of SYMBOL_CATALOG) {
    for (const keyword of def.keywords) {
      if (!index.has(keyword)) index.set(keyword, def);
    }
  }
  return index;
})();

/** Symbolname → Definition. */
const SYMBOL_BY_NAME: ReadonlyMap<string, SymbolDefinition> = (() => {
  const map = new Map<string, SymbolDefinition>();
  for (const def of SYMBOL_CATALOG) map.set(def.symbol, def);
  return map;
})();

/** Locale-unabhängiger String-Vergleich (deterministisch). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Text in umlautbewusste Lowercase-Tokens zerlegen (deterministisch). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((token) => token.length > 0);
}

/** Ist `value` eine gültige Symbol-Kategorie? */
function isSymbolCategory(value: unknown): value is SymbolCategory {
  return typeof value === "string" && (SYMBOL_CATEGORIES as readonly string[]).includes(value);
}

/** Kategorie defensiv normalisieren (Fallback: „object"). */
function normalizeCategory(raw: unknown): SymbolCategory {
  return isSymbolCategory(raw) ? raw : "object";
}

/** Zahl defensiv nach endlicher Ganzzahl ≥ `min` normalisieren (sonst null). */
function toInt(raw: unknown, min: number): number | null {
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(num) || num < min) return null;
  return Math.trunc(num);
}

/** Ein Symbol-Vorkommen defensiv normalisieren (ungültige Einträge → null). */
function normalizeOccurrence(raw: unknown): SymbolOccurrence | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const chapter = toInt(obj.chapter, 1);
  const count = toInt(obj.count, 1);
  if (chapter === null || count === null) return null;
  return { chapter, count };
}

/** Einen SymbolTrack defensiv normalisieren (ungültig → null). */
function normalizeTrack(raw: unknown): SymbolTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const symbol = typeof obj.symbol === "string" ? obj.symbol.trim() : "";
  if (!symbol) return null;

  const occurrences: SymbolOccurrence[] = [];
  if (Array.isArray(obj.occurrences)) {
    for (const entry of obj.occurrences) {
      const occ = normalizeOccurrence(entry);
      if (occ) occurrences.push(occ);
    }
  }
  occurrences.sort((a, b) => a.chapter - b.chapter);

  return { symbol, category: normalizeCategory(obj.category), occurrences };
}

/**
 * Bestimmt den Akt einer Kapitelnummer bei gegebener Gesamtkapitelzahl
 * (gleichmäßige Drittelung; Kapitel 1-basiert).
 */
function actOfChapter(chapter: number, maxChapter: number): number {
  if (maxChapter <= 0) return 1;
  const act1End = Math.ceil(maxChapter / 3);
  const act2End = Math.ceil((2 * maxChapter) / 3);
  if (chapter <= act1End) return 1;
  if (chapter <= act2End) return 2;
  return 3;
}

/**
 * Leitet die deterministische Bedeutung eines Akts aus der Auftrittsmenge ab:
 * Intensitätsstufe (relativ zum Maximum) kombiniert mit der Richtung gegenüber
 * dem vorherigen Akt.
 */
function meaningForAct(
  occurrences: number,
  maxOccurrences: number,
  prevOccurrences: number | null,
): string {
  if (occurrences <= 0) return "abwesend";
  const ratio = maxOccurrences > 0 ? occurrences / maxOccurrences : 0;
  const level = ratio >= 0.75 ? "dominant" : ratio >= 0.4 ? "präsent" : "schwach";

  let direction: string;
  if (prevOccurrences === null || prevOccurrences === occurrences) {
    direction = "gleichbleibend";
  } else if (prevOccurrences === 0) {
    direction = "neu einsetzend";
  } else if (occurrences > prevOccurrences) {
    direction = "aufsteigend";
  } else {
    direction = "abfallend";
  }

  return `${level} (${direction})`;
}

// ---------------------------------------------------------------------------
// 1) Symbol-Katalogisierung
// ---------------------------------------------------------------------------

/**
 * Katalogisiert wiederkehrende Symbole (Gegenstände, Wetterlagen, Farben,
 * Tiere) über die Kapitel eines Manuskripts.
 *
 * Der Text wird in Lowercase-Tokens zerlegt und gegen einen kuratierten
 * Schlüsselwort-Katalog gematcht (ganze Tokens — kein Substring-Matching).
 * Kapitelnummern sind 1-basiert (`chapters[i]` ⇒ Kapitel `i + 1`). Jedes
 * gefundene Symbol liefert die Auftrittszahlen je Kapitel, aufsteigend sortiert.
 *
 * Nicht-String-/leere Kapitel werden übersprungen; die Ergebnisse sind
 * deterministisch: zuerst nach Kategorie (object → weather → color → animal),
 * dann alphabetisch nach Symbolname. Nicht-Array-Eingaben liefern `[]` (kein
 * Throw). Die Eingabe wird nicht mutiert.
 */
export function trackSymbols(chapters: string[]): SymbolTrack[] {
  if (!Array.isArray(chapters)) return [];

  const perSymbol = new Map<string, Map<number, number>>();

  for (let i = 0; i < chapters.length; i++) {
    const text = chapters[i];
    if (typeof text !== "string" || text.length === 0) continue;
    const chapterNumber = i + 1;

    // Treffer des Kapitels sammeln (Symbol → Anzahl).
    const chapterCounts = new Map<string, number>();
    for (const token of tokenize(text)) {
      const def = KEYWORD_INDEX.get(token);
      if (!def) continue;
      chapterCounts.set(def.symbol, (chapterCounts.get(def.symbol) ?? 0) + 1);
    }

    for (const [symbol, count] of chapterCounts) {
      let chapterMap = perSymbol.get(symbol);
      if (!chapterMap) {
        chapterMap = new Map<number, number>();
        perSymbol.set(symbol, chapterMap);
      }
      chapterMap.set(chapterNumber, count);
    }
  }

  const tracks: SymbolTrack[] = [];
  for (const [symbol, chapterMap] of perSymbol) {
    const def = SYMBOL_BY_NAME.get(symbol);
    const occurrences: SymbolOccurrence[] = Array.from(chapterMap.entries())
      .map(([chapter, count]) => ({ chapter, count }))
      .sort((a, b) => a.chapter - b.chapter);
    tracks.push({
      symbol,
      category: def ? def.category : "object",
      occurrences,
    });
  }

  return tracks.sort(
    (a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || cmpStr(a.symbol, b.symbol),
  );
}

// ---------------------------------------------------------------------------
// 2) Metamorphose (Bedeutungs-Wandlung über Akte)
// ---------------------------------------------------------------------------

/**
 * Prüft die Bedeutungs-Wandlung eines Symbols über die drei Akte.
 *
 * Die Gesamtkapitelzahl ergibt sich aus der höchsten Auftritts-Kapitelnummer;
 * die Kapitel werden gleichmäßig in drei Akte gedrittelt. Je Akt wird die Summe
 * der Auftritte bestimmt und daraus eine deterministische Bedeutung abgeleitet
 * (Intensitätsstufe relativ zum Maximum + Richtung gegenüber dem Vorakt).
 *
 * `evolves` ist `true`, wenn das Symbol in mindestens zwei Akten auftritt und
 * die Bedeutungen über die Akte nicht konstant sind (Auftauchen, Intensivierung,
 * Abschwächung oder Verschwinden). Ein Symbol, das nur in einem Akt vorkommt,
 * evolviert nicht.
 *
 * Ungültige Tracks liefern `{ symbol: "", acts: [], evolves: false }`; ein
 * gültiger Track ohne Auftritte liefert drei „abwesend"-Akte. Kein Throw, keine
 * Mutation.
 */
export function analyzeMetamorphosis(track: SymbolTrack): MetamorphosisCurve {
  const normalized = normalizeTrack(track);
  if (!normalized) return { symbol: "", acts: [], evolves: false };

  let maxChapter = 0;
  for (const occ of normalized.occurrences) {
    if (occ.chapter > maxChapter) maxChapter = occ.chapter;
  }

  const perAct = new Array<number>(ACT_COUNT).fill(0);
  for (const occ of normalized.occurrences) {
    const act = actOfChapter(occ.chapter, maxChapter);
    perAct[act - 1] += occ.count;
  }

  const maxOccurrences = Math.max(0, ...perAct);
  const acts: ActMeaning[] = [];
  for (let i = 0; i < ACT_COUNT; i++) {
    const prev = i === 0 ? null : perAct[i - 1];
    acts.push({
      act: i + 1,
      meaning: meaningForAct(perAct[i], maxOccurrences, prev),
      occurrences: perAct[i],
    });
  }

  const presentActs = acts.filter((a) => a.occurrences > 0);
  const distinctMeanings = new Set(acts.map((a) => a.meaning));
  const evolves = presentActs.length >= 2 && distinctMeanings.size > 1;

  return { symbol: normalized.symbol, acts, evolves };
}

// ---------------------------------------------------------------------------
// 3) Resonanz-Heatmap (Kapitel-Abdeckung)
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Kapitel-Abdeckungs-Matrix für mehrere Symbol-Tracks.
 *
 * `symbols` ist alphabetisch sortiert und entspricht den Zeilen der `matrix`;
 * die Spalten sind die Kapitel 1..`chapters` (höchste vorkommende
 * Kapitelnummer). Zellwerte sind die Auftrittszahlen. Tracks mit gleichem
 * Symbolnamen werden zusammengeführt (Auftritte je Kapitel addiert). Ein Symbol
 * wird in `gaps` gemeldet, wenn zwischen seinem ersten und letzten Auftreten
 * mindestens ein Kapitel ohne Auftritt liegt (Auftrittslücke).
 *
 * Fehlende/ungültige Eingaben liefern
 * `{ symbols: [], chapters: 0, matrix: [], gaps: [] }` (kein Throw). Auftritte
 * jenseits von `MAX_HEATMAP_CHAPTERS` werden in der Matrix ignoriert. Die
 * Eingabe wird nicht mutiert.
 */
export function generateResonanceHeatmap(tracks: SymbolTrack[]): ResonanceHeatmap {
  const empty: ResonanceHeatmap = { symbols: [], chapters: 0, matrix: [], gaps: [] };
  if (!Array.isArray(tracks)) return empty;

  // Symbole zusammenführen: Name → (Kapitel → Summe der Auftritte).
  const merged = new Map<string, Map<number, number>>();
  for (const raw of tracks) {
    const track = normalizeTrack(raw);
    if (!track) continue;
    let chapterMap = merged.get(track.symbol);
    if (!chapterMap) {
      chapterMap = new Map<number, number>();
      merged.set(track.symbol, chapterMap);
    }
    for (const occ of track.occurrences) {
      chapterMap.set(occ.chapter, (chapterMap.get(occ.chapter) ?? 0) + occ.count);
    }
  }

  if (merged.size === 0) return empty;

  // Kapitelanzahl aus allen Auftritten (gedeckelt).
  let maxChapter = 0;
  for (const chapterMap of merged.values()) {
    for (const chapter of chapterMap.keys()) {
      if (chapter > maxChapter) maxChapter = chapter;
    }
  }
  const chapters = Math.min(maxChapter, MAX_HEATMAP_CHAPTERS);
  if (chapters <= 0) return empty;

  const symbols = Array.from(merged.keys()).sort(cmpStr);
  const matrix: number[][] = [];
  const gaps: string[] = [];

  for (const symbol of symbols) {
    const chapterMap = merged.get(symbol)!;
    const row = new Array<number>(chapters).fill(0);
    for (const [chapter, count] of chapterMap) {
      if (chapter >= 1 && chapter <= chapters) row[chapter - 1] = count;
    }
    matrix.push(row);

    const present = Array.from(chapterMap.keys())
      .filter((chapter) => chapter >= 1 && chapter <= chapters)
      .sort((a, b) => a - b);
    if (present.length >= 2) {
      const span = present[present.length - 1] - present[0] + 1;
      if (span > present.length) gaps.push(symbol);
    }
  }

  gaps.sort(cmpStr);
  return { symbols, chapters, matrix, gaps };
}
