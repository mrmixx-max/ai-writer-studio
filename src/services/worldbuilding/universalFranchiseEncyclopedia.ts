// UniversalFranchiseEncyclopedia (WP 120.2, Meilenstein 58.0 / v7.0.0)
//
// Universelle Franchise-Enzyklopädie im Silmarillion-Stil für epische
// Weltbildung. Ein automatischer Wiki-Verlinker, eine Taxonomie aus
// Epochen und Kategorien sowie ein Begleitband-Export.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

/** FNV-1a-Hash über die UTF-16-Codeeinheiten des Textes. Liefert uint32. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32-Pseudozufallsgenerator. Liefert Werte in [0, 1). */
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

/** Privater Helfer: wählt ein zufälliges Element, wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

/** Minimale Enzyklopädie-Referenz (für Verlinkung). */
export interface EncyclopediaRef {
  id: string;
  name: string;
  category: string;
}

/** Vollständiger Enzyklopädie-Eintrag (mit Beschreibung). */
export interface EncyclopediaEntry extends EncyclopediaRef {
  description: string;
}

/** Ein beim Verlinken erzeugter Wiki-Link. */
export interface WikiLink {
  term: string;
  targetId: string;
  category: string;
}

/** Ergebnis des Wiki-Verlinkers. */
export interface LinkifyResult {
  linkedText: string;
  links: WikiLink[];
}

/** Ein interner Treffer während der Verlinkung. */
interface LinkMatch {
  start: number;
  end: number;
  entry: EncyclopediaRef;
}

/** Maskiert Sonderzeichen für den Einsatz in einer RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prüft, ob ein Zeichenbereich sich mit einem der anderen überlappt. */
function overlaps(start: number, end: number, ranges: Array<[number, number]>): boolean {
  for (const [rs, re] of ranges) {
    if (start < re && end > rs) return true;
  }
  return false;
}

/**
 * Automatischer Wiki-Verlinker.
 *
 * Löst explizite `[[Term]]`-Verweise gegen die Enzyklopädie auf und verlinkt
 * zusätzlich Klartext-Vorkommen von Eintragsnamen (längste Namen zuerst).
 * Ausgabe ist Markdown: `[Name](#id)`.
 */
export function linkifyManuscript(
  text: string,
  encyclopedia: EncyclopediaRef[],
): LinkifyResult {
  const byName = new Map<string, EncyclopediaRef>();
  for (const entry of encyclopedia) {
    byName.set(entry.name.toLowerCase(), entry);
  }

  const matches: LinkMatch[] = [];
  const explicitRanges: Array<[number, number]> = [];

  // 1. Explizite [[Term]]-Verweise auflösen.
  const wikiRe = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRe.exec(text)) !== null) {
    const term = m[1].trim();
    const start = m.index;
    const end = m.index + m[0].length;
    explicitRanges.push([start, end]);
    const entry = byName.get(term.toLowerCase());
    if (entry) {
      matches.push({ start, end, entry });
    }
  }

  // 2. Klartext-Vorkommen von Eintragsnamen verlinken (längste Namen zuerst,
  //    damit "Schlacht von Falkenstein" Vorrang vor "Falkenstein" erhält).
  const names = Array.from(new Set(encyclopedia.map((e) => e.name))).sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    const entry = byName.get(name.toLowerCase());
    if (!entry) continue;
    const escaped = escapeRegExp(name);
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped})(?![\\p{L}\\p{N}_])`, "gu");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) !== null) {
      const start = mm.index;
      const end = start + mm[0].length;
      // Bereits erfasste Bereiche (explizit oder anderer Name) nicht erneut belegen.
      if (overlaps(start, end, explicitRanges)) continue;
      if (overlaps(start, end, matches.map((x) => [x.start, x.end] as [number, number]))) {
        continue;
      }
      matches.push({ start, end, entry });
    }
  }

  // 3. Treffer nach Position ordnen und Text neu aufbauen.
  matches.sort((a, b) => a.start - b.start);

  let linkedText = "";
  let cursor = 0;
  for (const match of matches) {
    linkedText += text.slice(cursor, match.start);
    linkedText += `[${match.entry.name}](#${match.entry.id})`;
    cursor = match.end;
  }
  linkedText += text.slice(cursor);

  // 4. Backlink-Index: ein Eintrag je Ziel, in Reihenfolge des Auftretens.
  const links: WikiLink[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    if (seen.has(match.entry.id)) continue;
    seen.add(match.entry.id);
    links.push({
      term: match.entry.name,
      targetId: match.entry.id,
      category: match.entry.category,
    });
  }

  return { linkedText, links };
}

/** Die Epochen der Franchise. */
export const EPOCHS = [
  "Schöpfungszeitalter",
  "Erstes Zeitalter",
  "Zweites Zeitalter",
  "Drittes Zeitalter",
  "Gegenwart",
] as const;

/** Die Kategorien der Enzyklopädie. */
export const CATEGORIES = [
  "Herrscherhäuser",
  "Geografie",
  "Magie",
  "Religion",
  "Kriege",
  "Artefakte",
] as const;

/** Ein Epochen-Name. */
export type Epoch = (typeof EPOCHS)[number];

/** Ein Kategoriename. */
export type Category = (typeof CATEGORIES)[number];

/** Die aus Epochen und Kategorien gebildete Taxonomie. */
export interface Taxonomy {
  epochs: string[];
  categories: string[];
  crossLinks: string[];
}

/** Baut die Taxonomie aus Epochen und Kategorien samt Querverbindungen. */
export function buildTaxonomy(epochs: string[], categories: string[]): Taxonomy {
  const crossLinks: string[] = [];
  for (const epoch of epochs) {
    for (const category of categories) {
      crossLinks.push(`${epoch} → ${category}`);
    }
  }
  return { epochs: [...epochs], categories: [...categories], crossLinks };
}

/** Ein Abschnitt des Begleitbands. */
export interface CompanionSection {
  heading: string;
  entries: string[];
}

/** Der exportierte Begleitband. */
export interface CompanionBook {
  title: string;
  sections: CompanionSection[];
  index: string[];
  pageCount: number;
}

/** Titel-Pool für den Begleitband. */
const COMPANION_TITLES = [
  "Begleitband der Verlorenen Zeitalter",
  "Das Große Kompendium der Aetherie",
  "Annalen der Nordlande",
  "Buch der Vergessenen Namen",
  "Chronik der Falkenkrone",
] as const;

/** Formatiert einen Enzyklopädie-Eintrag für den Begleitband. */
function formatCompanionEntry(entry: EncyclopediaEntry): string {
  return `${entry.name} (${entry.category}): ${entry.description}`;
}

/**
 * Begleitband-Export.
 *
 * Verteilt die Einträge deterministisch auf die Epochen, sortiert sie je
 * Abschnitt alphabetisch und erzeugt Register sowie eine Seitenzahl-Schätzung.
 */
export function buildCompanionBook(
  encyclopedia: EncyclopediaEntry[],
  seed: number,
): CompanionBook {
  const rng = createSeededRandom(hashString(`companionBook:${seed}`));
  const title = pick(COMPANION_TITLES, rng);

  // Einträge deterministisch auf Epochen verteilen (ordnungunabhängig).
  const groups = new Map<string, EncyclopediaEntry[]>();
  for (const epoch of EPOCHS) groups.set(epoch, []);
  for (const entry of encyclopedia) {
    const epoch = EPOCHS[hashString(`${entry.id}:${seed}`) % EPOCHS.length];
    groups.get(epoch)!.push(entry);
  }

  const sections: CompanionSection[] = EPOCHS.map((epoch) => {
    const list = [...(groups.get(epoch) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, "de"),
    );
    return { heading: epoch, entries: list.map(formatCompanionEntry) };
  });

  const index = encyclopedia
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "de"));

  const totalChars = sections.reduce(
    (sum, s) => sum + s.heading.length + s.entries.reduce((a, e) => a + e.length, 0),
    0,
  );
  const pageCount = Math.max(1, Math.ceil(totalChars / 1600));

  return { title, sections, index, pageCount };
}

/** Beispiel-Enzyklopädie im Silmarillion-Stil. */
export function createSampleEncyclopedia(): EncyclopediaEntry[] {
  return [
    {
      id: "haus-falkenstein",
      name: "Haus Falkenstein",
      category: "Herrscherhäuser",
      description:
        "Das älteste Herrschergeschlecht des Nordens; sein Banner zeigt einen silbernen Falken auf blutrotem Grund.",
    },
    {
      id: "haus-morgentau",
      name: "Haus Morgentau",
      category: "Herrscherhäuser",
      description:
        "Ein Geschlecht von Seefahrern und Sternendeutern, das die Küsten des Westens beherrscht.",
    },
    {
      id: "haus-thornwald",
      name: "Haus Thornwald",
      category: "Herrscherhäuser",
      description:
        "Abkömmlinge der Waldkönige, die ihre Krone aus lebendigem Dornengeflecht tragen.",
    },
    {
      id: "falkenklamm",
      name: "Falkenklamm",
      category: "Geografie",
      description:
        "Eine schmale Schlucht, in der die Nordwinde wie Klagegesänge durch den Fels ziehen.",
    },
    {
      id: "silbermeer",
      name: "Silbermeer",
      category: "Geografie",
      description:
        "Das endlose Meer im Westen, dessen Wellen im Mondlicht wie flüssiges Metall schimmern.",
    },
    {
      id: "aschenmark",
      name: "Die Aschenmark",
      category: "Geografie",
      description:
        "Eine verbrannte Ebene, über der seit dem Fall der Sternenstadt kein Gras mehr wächst.",
    },
    {
      id: "runenkunst",
      name: "Runenkunst",
      category: "Magie",
      description:
        "Die alte Kunst, Worte in Stein zu brennen, sodass sie die Wirklichkeit formen.",
    },
    {
      id: "aetherquell",
      name: "Aetherquell",
      category: "Magie",
      description:
        "Die verborgene Quelle aller Magie, bewacht von Wesen ohne Namen.",
    },
    {
      id: "orden-der-sieben-sterne",
      name: "Orden der Sieben Sterne",
      category: "Religion",
      description:
        "Eine Bruderschaft, die die Namen der Gefallenen Nacht für Nacht in den Himmel schreibt.",
    },
    {
      id: "kirche-des-ersten-lichts",
      name: "Kirche des Ersten Lichts",
      category: "Religion",
      description:
        "Der älteste Glaubensbund, der lehrt, dass alles Sein aus einem einzigen Funken stammt.",
    },
    {
      id: "schlacht-von-falkenstein",
      name: "Schlacht von Falkenstein",
      category: "Kriege",
      description:
        "Die blutige Schlacht, in der das Haus Falkenstein seine letzte Erbin verlor.",
    },
    {
      id: "krieg-der-zwei-kronen",
      name: "Krieg der zwei Kronen",
      category: "Kriege",
      description:
        "Ein jahrzehntelanger Bruderkrieg um den Thron des Nordens, der zwei Häuser entzweite.",
    },
    {
      id: "kronjuwel-von-falkenstein",
      name: "Kronjuwel von Falkenstein",
      category: "Artefakte",
      description:
        "Ein splitterndes Juwel, das dem Träger die Erinnerungen seiner Ahnen zeigt.",
    },
    {
      id: "klinge-der-morgendaemmerung",
      name: "Klinge der Morgendämmerung",
      category: "Artefakte",
      description:
        "Ein Schwert, geschmiedet aus dem letzten Licht der ersten Sonne.",
    },
  ];
}

/** Beispiel-Begleitband aus der Beispiel-Enzyklopädie. */
export function createSampleCompanionBook(): CompanionBook {
  return buildCompanionBook(createSampleEncyclopedia(), 42);
}
