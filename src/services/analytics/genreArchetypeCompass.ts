// Genre-Tropen- & Archetypen-Kompass (WP 53.2).
//
// Drei deterministische Werkzeuge, die einem Manuskript den Genre-Konventionen
// gegenüberstellen:
//
//   1. getGenreTropes        — die Tropen-Checkliste eines Genres (Kern- und
//                              optionale Tropen, `coreCount` als Zähler).
//   2. checkTropeFulfillment — welche Tropen das Manuskript tatsächlich
//                              bedient (fulfilled) und welche fehlen (missing).
//   3. calculateSubversionScore — wie stark das Manuskript die Genre-
//                              Erwartungen unterläuft (1 = maximal subversiv,
//                              0 = vollständig konventionell).
//
// Design-Regeln (analog zu plotForensics / readabilityMetrics):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert; Rückgaben sind frische
//     Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Checklisten
//     bzw. „alles fehlt“ statt zu werfen.
//   - Kapitelnummern sind 1-basiert; fehlt eine gültige Nummer, greift die
//     Array-Position (Index + 1).

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Unterstützte Genres. */
export type Genre =
  | "whodunit"
  | "heist"
  | "enemies-to-lovers"
  | "first-contact"
  | "coming-of-age";

/** Eine einzelne Genre-Trope. */
export interface Trope {
  /** Stabile, genre-lokale ID (z. B. "red-herring"). */
  id: string;
  /** Menschenlesbarer Name. */
  name: string;
  /** Kurzbeschreibung der Trope. */
  description: string;
  /** Kern-Trope (genre-definierend) vs. optionale Trope. */
  isCore: boolean;
}

/** Tropen-Checkliste eines Genres. */
export interface GenreTropes {
  genre: Genre;
  tropes: Trope[];
  /** Anzahl der Kern-Tropen (deterministisch aus `tropes` abgeleitet). */
  coreCount: number;
}

/** Ein Manuskript-Kapitel mit den ihm zugeordneten Trope-IDs. */
export interface Chapter {
  /** 1-basierte Kapitelnummer. */
  number: number;
  /** IDs (oder Namen) der in diesem Kapitel bedienten Tropen. */
  tropes: string[];
}

/** Minimales Manuskript-Input. */
export interface Manuscript {
  chapters: Chapter[];
}

/** Ergebnis der Tropen-Erfüllungsprüfung. */
export interface TropeFulfillment {
  genre: Genre;
  /** IDs der erfüllten Tropen (in Checklisten-Reihenfolge). */
  fulfilled: string[];
  /** IDs der fehlenden Tropen (in Checklisten-Reihenfolge). */
  missing: string[];
  /** fulfilled / (fulfilled + missing), 0 bei leerer Checkliste. */
  fulfillmentRate: number;
}

// ---------------------------------------------------------------------------
// Tropen-Katalog
// ---------------------------------------------------------------------------

const GENRE_TROPE_TABLE: Record<Genre, Trope[]> = {
  whodunit: [
    {
      id: "corpse-early",
      name: "Leiche früh im Buch",
      description:
        "Eine Leiche taucht in den Kapiteln 1–3 auf und stößt die Ermittlung an.",
      isCore: true,
    },
    {
      id: "closed-circle",
      name: "Geschlossener Verdächtigenkreis",
      description:
        "Eine begrenzte, klar umrissene Gruppe möglicher Täter steht im Zentrum.",
      isCore: true,
    },
    {
      id: "false-alibi",
      name: "Falsches Alibi",
      description:
        "Ein Verdächtiger hat ein Alibi, das sich als falsch oder konstruiert erweist.",
      isCore: true,
    },
    {
      id: "red-herring",
      name: "Red Herring",
      description:
        "Ein bewusst gesetzter falscher Hinweis führt die Ermittlung in die Irre.",
      isCore: false,
    },
    {
      id: "finale-reconstruction",
      name: "Rekonstruktion im Finale",
      description:
        "Im Finale werden alle Hinweise zur lückenlosen Lösung rekonstruiert.",
      isCore: true,
    },
  ],
  heist: [
    {
      id: "planning",
      name: "Planung",
      description: "Die Crew entwickelt einen detaillierten Plan für den Coup.",
      isCore: true,
    },
    {
      id: "crew-assembly",
      name: "Crew-Zusammenstellung",
      description:
        "Spezialisten mit je eigener Rolle werden rekrutiert und zusammengeführt.",
      isCore: true,
    },
    {
      id: "the-heist",
      name: "Der Coup",
      description: "Die Ausführung des Raubs bzw. Einbruchs bildet den Kern.",
      isCore: true,
    },
    {
      id: "something-goes-wrong",
      name: "Etwas geht schief",
      description:
        "Ein unerwarteter Zwischenfall bringt den Plan ins Wanken.",
      isCore: false,
    },
    {
      id: "showdown",
      name: "Showdown",
      description:
        "Ein finaler, eskalierender Höhepunkt entscheidet über Erfolg oder Scheitern.",
      isCore: true,
    },
  ],
  "enemies-to-lovers": [
    {
      id: "first-meeting",
      name: "Erste Begegnung",
      description: "Die beiden Figuren treffen erstmals aufeinander.",
      isCore: true,
    },
    {
      id: "conflict",
      name: "Konflikt",
      description:
        "Eine offene Feindschaft oder Reibung prägt die frühe Beziehung.",
      isCore: true,
    },
    {
      id: "turning-point",
      name: "Wendepunkt",
      description:
        "Ein Ereignis kippt die Feindschaft in unerwartete Anziehung.",
      isCore: true,
    },
    {
      id: "getting-closer",
      name: "Annäherung",
      description:
        "Die Figuren bauen Vertrauen und Nähe auf, gegen ihren eigenen Widerstand.",
      isCore: false,
    },
    {
      id: "devotion",
      name: "Hingabe",
      description:
        "Eine bewusste Entscheidung füreinander besiegelt die Verbindung.",
      isCore: true,
    },
  ],
  "first-contact": [
    {
      id: "first-signal",
      name: "Erstes Signal",
      description:
        "Ein Signal oder Artefakt kündigt die Existenz des Fremden an.",
      isCore: true,
    },
    {
      id: "first-meeting",
      name: "Erste Begegnung",
      description: "Der erste direkte Kontakt zwischen den Spezies findet statt.",
      isCore: true,
    },
    {
      id: "misunderstanding",
      name: "Missverständnis",
      description:
        "Kulturelle oder sprachliche Barrieren erzeugen Konflikt und Gefahr.",
      isCore: false,
    },
    {
      id: "cooperation",
      name: "Kooperation",
      description:
        "Beide Seiten überwinden die Barriere und arbeiten gemeinsam.",
      isCore: true,
    },
    {
      id: "peace",
      name: "Frieden",
      description:
        "Ein dauerhaftes Einvernehmen oder Bündnis wird geschlossen.",
      isCore: true,
    },
  ],
  "coming-of-age": [
    {
      id: "trigger",
      name: "Auslöser",
      description:
        "Ein Ereignis reißt die Hauptfigur aus ihrer kindlichen Unschuld.",
      isCore: true,
    },
    {
      id: "mentor",
      name: "Mentor",
      description:
        "Eine erfahrene Figur begleitet und fordert die Entwicklung.",
      isCore: true,
    },
    {
      id: "trial",
      name: "Prüfung",
      description:
        "Eine herausfordernde Bewährung erzwingt die innere Reifung.",
      isCore: true,
    },
    {
      id: "transformation",
      name: "Transformation",
      description:
        "Die Figur verändert ihre Haltung, Werte und Identität spürbar.",
      isCore: true,
    },
    {
      id: "new-self",
      name: "Neues Ich",
      description:
        "Am Ende steht eine gereifte, veränderte Identität der Hauptfigur.",
      isCore: true,
    },
  ],
};

/** Optionale Kapitel-Fenster für Tropen, die an einen frühen Auftritt gebunden sind. */
const CHAPTER_CONSTRAINTS: Partial<
  Record<Genre, Record<string, { min: number; max: number }>>
> = {
  whodunit: {
    "corpse-early": { min: 1, max: 3 },
  },
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zahl auf `digits` Nachkommastellen runden (deterministisch). */
function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Auf das Intervall [0, 1] begrenzen. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Token für den Vergleich normalisieren (trimmen, Kleinschreibung). */
function normalizeToken(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Tropen eines Genres (intern, ohne Kopie). */
function lookupTropes(genre: unknown): Trope[] {
  if (typeof genre !== "string") return [];
  return GENRE_TROPE_TABLE[genre as Genre] ?? [];
}

/** Kopie einer Trope (verhindert, dass Aufrufer den Katalog mutieren). */
function copyTrope(trope: Trope): Trope {
  return {
    id: trope.id,
    name: trope.name,
    description: trope.description,
    isCore: trope.isCore,
  };
}

/** Kapitelnummer defensiv bestimmen (ungültige Zahl → Array-Position). */
function resolveChapterNumber(chapter: Chapter, index: number): number {
  const n = chapter && typeof chapter === "object" ? chapter.number : undefined;
  return typeof n === "number" && Number.isFinite(n) ? n : index + 1;
}

/**
 * Abbildung normalisierter Token (ID oder Name) → kanonische Trope-ID.
 * Bei Kollisionen gewinnt die ID.
 */
function buildTokenIndex(tropes: Trope[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const trope of tropes) {
    const name = normalizeToken(trope.name);
    if (name && !index.has(name)) index.set(name, trope.id);
  }
  for (const trope of tropes) {
    const id = normalizeToken(trope.id);
    if (id) index.set(id, trope.id);
  }
  return index;
}

// ---------------------------------------------------------------------------
// 1) Tropen-Checkliste
// ---------------------------------------------------------------------------

/**
 * Liefert die Tropen-Checkliste eines Genres.
 *
 * Für ein unbekanntes Genre wird eine leere Checkliste zurückgegeben
 * (`coreCount` = 0) statt zu werfen. Die zurückgegebenen Tropen sind frische
 * Kopien und folgen der festen Katalogreihenfolge (deterministisch).
 */
export function getGenreTropes(genre: Genre): GenreTropes {
  const tropes = lookupTropes(genre).map(copyTrope);
  const coreCount = tropes.filter((t) => t.isCore).length;
  return { genre, tropes, coreCount };
}

// ---------------------------------------------------------------------------
// 2) Tropen-Erfüllung
// ---------------------------------------------------------------------------

/**
 * Prüft, welche Tropen eines Genres das Manuskript bedient.
 *
 * Ein Kapitel „erfüllt“ eine Trope, wenn ihre ID (oder ihr Name,
 * Groß-/Kleinschreibung egal) in `chapter.tropes` steht. Tropen mit
 * Kapitel-Fenster (z. B. die frühe Leiche) zählen nur, wenn sie innerhalb des
 * erlaubten Fensters auftreten. `fulfilled`/`missing` folgen der
 * Checklisten-Reihenfolge; `fulfillmentRate` ist der Anteil erfüllter Tropen.
 *
 * Defensiv: fehlende/ungültige Manuskripte gelten als „alles fehlt“.
 */
export function checkTropeFulfillment(
  genre: Genre,
  manuscript: Manuscript,
): TropeFulfillment {
  const tropes = lookupTropes(genre);
  const constraints = CHAPTER_CONSTRAINTS[genre as Genre] ?? {};
  const tokenIndex = buildTokenIndex(tropes);
  const fulfilledSet = new Set<string>();

  const chapters =
    manuscript && typeof manuscript === "object" && Array.isArray(manuscript.chapters)
      ? manuscript.chapters
      : [];

  chapters.forEach((chapter, index) => {
    if (!chapter || typeof chapter !== "object" || !Array.isArray(chapter.tropes)) {
      return;
    }
    const chapterNumber = resolveChapterNumber(chapter, index);
    for (const raw of chapter.tropes) {
      const token = normalizeToken(raw);
      if (!token) continue;
      const tropeId = tokenIndex.get(token);
      if (!tropeId) continue;
      const window = constraints[tropeId];
      if (window && (chapterNumber < window.min || chapterNumber > window.max)) {
        continue;
      }
      fulfilledSet.add(tropeId);
    }
  });

  const fulfilled: string[] = [];
  const missing: string[] = [];
  for (const trope of tropes) {
    if (fulfilledSet.has(trope.id)) fulfilled.push(trope.id);
    else missing.push(trope.id);
  }

  const total = tropes.length;
  const fulfillmentRate = total > 0 ? round(fulfilled.length / total, 4) : 0;

  return { genre, fulfilled, missing, fulfillmentRate };
}

// ---------------------------------------------------------------------------
// 3) Subversions-Score
// ---------------------------------------------------------------------------

/**
 * Berechnet, wie stark ein Manuskript die Genre-Erwartungen unterläuft.
 *
 * Kern-Tropen wiegen doppelt so schwer wie optionale. Der Score ist
 * `1 - (erfülltes Gewicht / Gesamtgewicht)`:
 *   - 0   = alle Tropen erfüllt (vollständig konventionell),
 *   - 1   = keine Trope erfüllt (maximal subversiv).
 *
 * Für ein unbekanntes Genre ohne Checkliste ist nichts zu unterlaufen → 0.
 * Defensiv: ungültige Eingaben liefern 1 (nichts belegt = maximal subversiv)?
 * Nein — ohne gültige Checkliste gibt es keine Erwartung → 0.
 */
export function calculateSubversionScore(fulfillment: TropeFulfillment): number {
  if (!fulfillment || typeof fulfillment !== "object") return 0;

  const tropes = lookupTropes(fulfillment.genre);
  if (tropes.length === 0) return 0;

  const fulfilled = new Set<string>(
    Array.isArray(fulfillment.fulfilled)
      ? fulfillment.fulfilled.filter((id): id is string => typeof id === "string")
      : [],
  );

  let totalWeight = 0;
  let fulfilledWeight = 0;
  for (const trope of tropes) {
    const weight = trope.isCore ? 2 : 1;
    totalWeight += weight;
    if (fulfilled.has(trope.id)) fulfilledWeight += weight;
  }

  if (totalWeight === 0) return 0;
  const score = clamp01(1 - fulfilledWeight / totalWeight);
  return round(score, 4);
}
