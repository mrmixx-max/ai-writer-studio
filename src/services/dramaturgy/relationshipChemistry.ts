// Beziehungs-Chemie & Funken-Matrix (WP 52.1).
//
// Werkzeuge, um die „Chemie" zwischen zwei Figuren aus Dialog und Kapitel-
// struktur zu messen:
//
//   1. analyzeRelationshipChemistry — liest einen Dialogabschnitt und liefert
//                                     Banter-Index, Schlagabtausch-Quote,
//                                     Unterbrechungen, Neckereien sowie die
//                                     aktuelle Beziehungsphase samt Ausprägung.
//   2. detectTensionDrop            — warnt, wenn eine Figuren-Beziehung über
//                                     viele Kapitel hinweg keine geladene Szene
//                                     mehr bekommt (> 6 Kapitel).
//   3. trackPhaseProgression        — schätzt anhand der Zahl geladener Szenen,
//                                     wie weit die Beziehung durch die Phasen
//                                     hostility → reluctant-respect →
//                                     vulnerability → devotion fortgeschritten
//                                     ist.
//
// Design-Regeln (analog zu dialogueSubtext / neuroPacing / subplotWeaver):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern ein definiertes
//     Null-Ergebnis (bzw. `null`) statt zu werfen.
//   - Keine Zufallswerte, keine Zeitabhängigkeit: identische Eingabe ⇒
//     identische Ausgabe.
//
// Textabgleich: case-insensitiv und umlautbewusst. Marker werden als Teilstring
// im kleingeschriebenen Zeilentext gesucht (fängt deutsche Beugungen/Komposita
// wie „hassen", „hassenswert" ein). Pro Zeile und Phase zählt die Zeile höchstens
// einmal, auch wenn mehrere Marker passen.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Die vier Beziehungsphasen in aufsteigender Reihenfolge (fest sortiert). */
export const PHASES = [
  "hostility",
  "reluctant-respect",
  "vulnerability",
  "devotion",
] as const;

/** Typ einer Beziehungsphase. */
export type ChemistryPhase = (typeof PHASES)[number];

/** Eine einzelne Dialogzeile des Chemie-Service. */
export interface DialogueLine {
  /** Sprechername. */
  speaker: string;
  /** Gesprochener Text. */
  text: string;
  /** Kapitelnummer (1-basiert), in dem die Zeile steht. */
  chapter: number;
}

/** Ergebnis der Beziehungs-Chemie-Analyse eines Dialogs. */
export interface RelationshipChemistry {
  /** Banter-Index (0–100): Dichte schlagfertiger Erwiderungen und Witz-Marker. */
  banterIndex: number;
  /** Schlagabtausch-Quote (0–1): Erwiderungen geteilt durch Aussagen. */
  banterRatio: number;
  /** Anzahl der als Unterbrechung erkannten Zeilen. */
  interruptions: number;
  /** Anzahl der Zeilen mit mindestens einem Neckerei-Marker. */
  teasingCount: number;
  /** Dominante Beziehungsphase des Dialogabschnitts. */
  phase: ChemistryPhase;
  /** Ausprägungsgrad der aktuellen Phase (0–1, saturiert bei 3 Marker-Zeilen). */
  phaseProgress: number;
}

/** Eine Kapitel-Szene eines Figuren-Paares. */
export interface ChapterScene {
  /** Kapitelnummer (1-basiert). */
  chapter: number;
  /** Erste Figur des Paares. */
  characterA: string;
  /** Zweite Figur des Paares. */
  characterB: string;
  /** Liegt in diesem Kapitel eine geladene (gemeinsame) Szene vor? */
  hasLoadedScene: boolean;
}

/** Warnung vor einem Spannungs-Abfall in der Figuren-Beziehung. */
export interface TensionDropWarning {
  /** Erste Kapitelnummer des betroffenen Laufs (1-basiert). */
  startChapter: number;
  /** Letzte Kapitelnummer des betroffenen Laufs (1-basiert). */
  endChapter: number;
  /** Menschenlesbare Begründung. */
  reason: string;
}

/** Ergebnis der Phasen-Fortschritts-Schätzung über die Kapitel. */
export interface PhaseProgression {
  /** Aktuelle Beziehungsphase. */
  currentPhase: string;
  /** Fortschritt innerhalb der aktuellen Phase (0–1). */
  progress: number;
  /** Nächste Phase, oder `null` in der Endphase (devotion). */
  nextPhase: string | null;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Standardname für Zeilen ohne (oder mit leerem) Sprecher. */
export const UNKNOWN_SPEAKER = "Unbekannt";

/** Maximale Wortzahl, ab der eine Erwiderung noch als „kurz" (Banter) gilt. */
export const BANTER_MAX_WORDS = 8;

/** Marker-Zeilen einer Phase bis zur Sättigung von `phaseProgress` (1.0). */
export const PHASE_SATURATION_LINES = 3;

/** Zahl geladener Szenen je Beziehungsphase (für den Phasen-Tracker). */
export const SCENES_PER_PHASE = 3;

/** Ab wie vielen aufeinanderfolgenden Kapiteln ohne geladene Szene gewarnt wird. */
export const TENSION_DROP_THRESHOLD = 6;

/** Zeilenende-Marker, die auf eine Unterbrechung hindeuten (Gedankenstrich). */
const INTERRUPTION_SUFFIX = /(?:—|–|-)$/;

/** Witz-/Ironie-Marker für den Banter-Index. */
const WIT_MARKERS: readonly string[] = [
  "haha", "hehe", "hihi", "pff", "tzz", "pah", "ätsch", "huch",
  "witzig", "witz", "ironie", "ironisch", "sarkasmus", "sarkastisch",
  "spöttisch", "stichel", "neck", "frotzel",
  "na klar", "ja klar", "ach ja", "ach so", "ach nein",
  "ernsthaft", "im ernst", "ehrlich gesagt", "ganz ehrlich",
  "natürlich", "logisch", "offensichtlich", "selbstverständlich",
  "ausgerechnet", "typisch",
];

/** Neckerei-Marker für `teasingCount`. */
const TEASING_MARKERS: readonly string[] = [
  "neck", "necken", "neckt", "neckerei",
  "aufzieh", "aufziehen", "aufgezogen",
  "spott", "spotten", "spöttisch", "spötteln",
  "stichel", "sticheln", "stichelei",
  "hänsel", "hänseln",
  "frotzel", "frotzeln",
  "ironisch", "ironie", "sarkastisch", "sarkasmus",
  "witzig", "witzeln", "witz",
  "scherz", "scherzen", "scherzhaft", "spaß", "spass",
  "haha", "hehe", "hihi", "ätsch", "pff", "tzz", "pah",
  "zum spaß", "im spaß", "auf den arm", "zwinker", "grins",
];

/** Lokales, deterministisches Marker-Lexikon je Beziehungsphase (Deutsch). */
const PHASE_MARKERS: Record<ChemistryPhase, readonly string[]> = {
  hostility: [
    "hasse", "hass", "verachte", "verachtung", "idiot", "dummkopf",
    "dumm", "blöd", "schweig", "halt die", "halt den", "verschwinde",
    "hau ab", "verpiss", "wütend", "wut", "feindselig", "feind",
    "bedroh", "droh", "elend", "widerlich", "abscheu", "verräter",
    "lügner", "verrat", "gleichgültig", "lass mich", "geh weg",
  ],
  "reluctant-respect": [
    "respekt", "zugegeben", "nicht schlecht", "nicht übel", "vielleicht",
    "stimmt", "hast recht", "hast du recht", "in ordnung", "okay", "fair",
    "gerecht", "anerkenn", "bewunder", "gut gemacht", "vorsichtig",
    "könnte sein",
  ],
  vulnerability: [
    "angst", "ängst", "fürchte", "furcht", "schwach", "schwäche",
    "allein", "einsam", "verletz", "schmerz", "tränen", "weint",
    "weinen", "schluchz", "vertrau", "es tut mir leid", "entschuldig",
    "verzeih", "hilfe", "brauche dich", "schäme", "beschämt",
  ],
  devotion: [
    "liebe dich", "ich liebe", "liebe", "liebling", "verliebt",
    "für immer", "immer bei dir", "bleib bei mir", "beschütz",
    "beschützen", "zusammen", "herz", "mein leben", "unser leben",
    "vermiss", "treue", "kuss", "küsse", "zärtlich", "umarm",
    "nie verlassen", "ich bin da", "fürchte dich nicht",
  ],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zahl auf 1 Nachkommastelle runden (deterministisch). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Zahl auf 3 Nachkommastellen runden (deterministisch). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Zahl auf [0, 1] begrenzen. */
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Wortzahl eines Textes (umlautbewusst, deterministisch). */
function wordCount(text: string): number {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((token) => token.length > 0).length;
}

/** Enthält der (kleingeschriebene) Text irgendeinen der Marker als Teilstring? */
function containsMarker(lowerText: string, markers: readonly string[]): boolean {
  for (const marker of markers) {
    if (lowerText.includes(marker)) return true;
  }
  return false;
}

/** Normalisierte, garantierte Dialogzeile. */
interface NormalizedLine {
  speaker: string;
  text: string;
  chapter: number;
}

/** Dialogzeilen defensiv normalisieren (ungültige/leere Zeilen verwerfen). */
function normalizeLines(input: unknown): NormalizedLine[] {
  if (!Array.isArray(input)) return [];
  const out: NormalizedLine[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const text = typeof raw.text === "string" ? raw.text : "";
    if (text.trim().length === 0) continue;
    const speaker =
      typeof raw.speaker === "string" && raw.speaker.trim().length > 0
        ? raw.speaker.trim()
        : UNKNOWN_SPEAKER;
    const chapter =
      typeof raw.chapter === "number" && Number.isFinite(raw.chapter)
        ? raw.chapter
        : 0;
    out.push({ speaker, text, chapter });
  }
  return out;
}

/** Normalisierte, garantierte Kapitel-Szene. */
interface NormalizedScene {
  chapter: number;
  hasLoadedScene: boolean;
}

/** Kapitel-Szenen defensiv normalisieren (ungültige Einträge verwerfen). */
function normalizeScenes(input: unknown): NormalizedScene[] {
  if (!Array.isArray(input)) return [];
  const out: NormalizedScene[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.chapter !== "number" || !Number.isFinite(raw.chapter)) continue;
    out.push({ chapter: raw.chapter, hasLoadedScene: raw.hasLoadedScene === true });
  }
  return out;
}

/** Null-Ergebnis der Chemie-Analyse. */
function emptyChemistry(): RelationshipChemistry {
  return {
    banterIndex: 0,
    banterRatio: 0,
    interruptions: 0,
    teasingCount: 0,
    phase: "hostility",
    phaseProgress: 0,
  };
}

// ---------------------------------------------------------------------------
// 1) Beziehungs-Chemie eines Dialogs
// ---------------------------------------------------------------------------

/**
 * Analysiert die Chemie eines Dialogabschnitts.
 *
 * Definitionen (deterministisch):
 *   - **Aussage**: jede nicht-leere Dialogzeile.
 *   - **Erwiderung (Retort)**: eine Zeile, die (a) auf eine Zeile eines *anderen*
 *     Sprechers folgt und (b) als schlagfertig gilt — sie ist kurz
 *     (≤ `BANTER_MAX_WORDS` Wörter) oder enthält einen Witz-/Ironie-Marker.
 *   - **banterRatio** = Erwiderungen / Aussagen (0–1).
 *   - **banterIndex** = 0–100, gewichtete Dichte aus Erwiderungen (60 %) und
 *     Zeilen mit Witz-Marker (40 %).
 *   - **interruptions** = Zeilen, deren Text auf einen Gedankenstrich endet.
 *   - **teasingCount** = Zeilen mit mindestens einem Neckerei-Marker.
 *   - **phase** = Phase mit den meisten Marker-Zeilen; bei Gleichstand gewinnt
 *     die *spätere* Phase (eine Beziehung ist durch ihre fortgeschrittenste
 *     Evidenz definiert). Ohne Evidenz gilt `hostility`.
 *   - **phaseProgress** = Ausprägung der aktuellen Phase, saturiert bei
 *     `PHASE_SATURATION_LINES` Marker-Zeilen.
 *
 * Leere/ungültige Eingaben liefern ein Null-Ergebnis (kein Throw).
 */
export function analyzeRelationshipChemistry(
  dialogue: DialogueLine[],
): RelationshipChemistry {
  const lines = normalizeLines(dialogue);
  const total = lines.length;
  if (total === 0) return emptyChemistry();

  let retorts = 0;
  let witLines = 0;
  let interruptions = 0;
  let teasingCount = 0;

  const phaseCounts: Record<ChemistryPhase, number> = {
    hostility: 0,
    "reluctant-respect": 0,
    vulnerability: 0,
    devotion: 0,
  };

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    const lower = line.text.toLowerCase();

    if (INTERRUPTION_SUFFIX.test(line.text.trim())) interruptions += 1;

    const hasWit = containsMarker(lower, WIT_MARKERS);
    if (hasWit) witLines += 1;

    const prev = i > 0 ? lines[i - 1] : null;
    const isReply = prev !== null && prev.speaker !== line.speaker;
    const isShort = wordCount(line.text) <= BANTER_MAX_WORDS;
    if (isReply && (isShort || hasWit)) retorts += 1;

    if (containsMarker(lower, TEASING_MARKERS)) teasingCount += 1;

    for (const phase of PHASES) {
      if (containsMarker(lower, PHASE_MARKERS[phase])) phaseCounts[phase] += 1;
    }
  }

  const retortDensity = retorts / total;
  const witDensity = witLines / total;
  const banterIndex = round1(clamp01(0.6 * retortDensity + 0.4 * witDensity) * 100);
  const banterRatio = round3(retortDensity);

  let phase: ChemistryPhase = "hostility";
  let best = 0;
  for (const candidate of PHASES) {
    const count = phaseCounts[candidate];
    if (count > 0 && count >= best) {
      best = count;
      phase = candidate;
    }
  }

  const phaseProgress = round3(
    clamp01(phaseCounts[phase] / PHASE_SATURATION_LINES),
  );

  return {
    banterIndex,
    banterRatio,
    interruptions,
    teasingCount,
    phase,
    phaseProgress,
  };
}

// ---------------------------------------------------------------------------
// 2) Spannungs-Abfall
// ---------------------------------------------------------------------------

/**
 * Warnt, wenn eine Figuren-Beziehung zu lange keine geladene Szene mehr hat.
 *
 * Die Szenen werden stabil nach Kapitelnummer sortiert; gesucht wird der
 * längste Lauf aufeinanderfolgender Kapitel ohne geladene Szene
 * (`hasLoadedScene !== true`). Überschreitet dieser Lauf
 * `TENSION_DROP_THRESHOLD` (> 6) Kapitel, wird eine Warnung mit Start- und
 * Endkapitel zurückgegeben; bei mehreren gleich langen Läufen gewinnt der
 * früheste. Sonst `null`. Ungültige/leere Eingaben liefern `null` (kein Throw).
 */
export function detectTensionDrop(
  chapters: ChapterScene[],
): TensionDropWarning | null {
  const scenes = normalizeScenes(chapters);
  if (scenes.length === 0) return null;

  const sorted = [...scenes].sort((a, b) => a.chapter - b.chapter);

  let bestStart = -1;
  let bestEnd = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;

  for (const scene of sorted) {
    if (scene.hasLoadedScene) {
      runStart = -1;
      runLen = 0;
      continue;
    }
    if (runStart === -1) runStart = scene.chapter;
    runLen += 1;
    if (runLen > bestLen) {
      bestLen = runLen;
      bestStart = runStart;
      bestEnd = scene.chapter;
    }
  }

  if (bestLen <= TENSION_DROP_THRESHOLD) return null;

  return {
    startChapter: bestStart,
    endChapter: bestEnd,
    reason:
      `Spannungs-Abfall: ${bestLen} aufeinanderfolgende Kapitel ` +
      `(${bestStart}–${bestEnd}) ohne geladene Szene zwischen den Figuren.`,
  };
}

// ---------------------------------------------------------------------------
// 3) Phasen-Fortschritt
// ---------------------------------------------------------------------------

/**
 * Schätzt den Beziehungs-Phasenfortschritt aus der Kapitelstruktur.
 *
 * Maßgeblich ist die Anzahl *geladener* Szenen: Je `SCENES_PER_PHASE` (3)
 * geladener Szenen steigt die Beziehung eine Phase weiter
 * (hostility → reluctant-respect → vulnerability → devotion). `progress` ist
 * der Fortschritt innerhalb der aktuellen Phase; in der Endphase (`devotion`)
 * beträgt er 1 und `nextPhase` ist `null`. Leere/ungültige Eingaben liefern
 * die Startphase `hostility` mit Fortschritt 0.
 */
export function trackPhaseProgression(chapters: ChapterScene[]): PhaseProgression {
  const scenes = normalizeScenes(chapters);
  const loaded = scenes.filter((scene) => scene.hasLoadedScene).length;

  const lastIndex = PHASES.length - 1;
  const index = Math.min(lastIndex, Math.floor(loaded / SCENES_PER_PHASE));
  const currentPhase = PHASES[index];
  const nextPhase = index < lastIndex ? PHASES[index + 1] : null;
  const progress =
    index >= lastIndex
      ? 1
      : round3((loaded % SCENES_PER_PHASE) / SCENES_PER_PHASE);

  return { currentPhase, progress, nextPhase };
}
