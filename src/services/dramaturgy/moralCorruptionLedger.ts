// Moral-Korruptions-Ledger (WP 130.2, Meilenstein 63.0 / v7.5.0).
//
// Deterministische Werkzeuge zur Modellierung eines moralischen Abstiegs über
// sieben Stufen — von der edlen Absicht bis zum totalen moralischen Bankrott:
//
//   1. CORRUPTION_STAGES        — der kanonische Katalog der sieben Stufen.
//   2. buildCorruptionCurve     — verteilt die Stufen über die Kapitel und
//                                 berechnet den fallenden Menschlichkeitswert.
//   3. detectPointOfNoReturn    — findet die Stufe, ab der es kein Zurück mehr
//                                 gibt, und schlägt eine Szene vor.
//
// Design-Regeln (analog zu interrogationDeceptionLab / leitmotifNetwork):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern definierte
//     Null-Ergebnisse statt zu werfen.
//   - Browser-kompatibel, keine node:-Module.
//   - Identischer Seed ⇒ identische Ausgabe.

// ---------------------------------------------------------------------------
// Deterministische Kernfunktionen
// ---------------------------------------------------------------------------

/**
 * FNV-1a-Hash (32-bit, unsigned).
 * Deterministische Hash-Funktion für Strings.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  const text = typeof input === 'string' ? input : '';
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32-Pseudozufallszahlengenerator.
 * Liefert eine Funktion, die Werte im Intervall [0, 1) zurückgibt.
 */
export function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Private Hilfsfunktion: wählt ein zufälliges Element aus einem Array.
 * Wirft einen Fehler, wenn das Array leer ist.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error('pick: Array ist leer');
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// WP 130.2 — Feature 1: Die sieben Stufen des Abstiegs
// ---------------------------------------------------------------------------

/** Eine einzelne Stufe des moralischen Abstiegs. */
export interface CorruptionStage {
  /** Stufennummer (1–7). */
  stage: number;
  /** Eindeutiger Identifier (englisch). */
  id: string;
  /** Anzeigename der Stufe (deutsch). */
  name: string;
  /** Kurzbeschreibung der Stufe. */
  description: string;
  /** Konkretes Beispiel für eine Szene auf dieser Stufe. */
  example: string;
  /** Psychologisches Kennzeichen des Protagonisten auf dieser Stufe. */
  psychologicalMarker: string;
}

/**
 * Der kanonische Katalog der sieben Stufen des Abstiegs, in fester Reihenfolge.
 * Jede Stufe hat `stage` 1–7 und einen englischen `id`.
 */
export const CORRUPTION_STAGES: readonly CorruptionStage[] = [
  {
    stage: 1,
    id: 'nobleIntent',
    name: 'Edle Absicht',
    description:
      'Der Protagonist handelt aus einem aufrichtigen, verteidigbaren Motiv. ' +
      'Das angestrebte Ziel rechtfertigt in seinen Augen jedes Opfer — noch.',
    example:
      'Ein Ermittler fälscht ein einziges Beweisstück, um einen Mörder zu überführen, ' +
      'den er für schuldig hält, und nennt es „Gerechtigkeit“.',
    psychologicalMarker:
      'Selbstgerechtigkeit und moralische Gewissheit — der Zweck heiligt die Mittel.',
  },
  {
    stage: 2,
    id: 'firstCompromise',
    name: 'Erster kleiner Kompromiss',
    description:
      'Eine kleine Grenzüberschreitung wird mit einem guten Grund entschuldigt. ' +
      'Der Verstoß erscheint harmlos und wird sofort verdrängt.',
    example:
      'Der Protagonist verschweigt eine wichtige Information, um einen Verbündeten ' +
      'zu schützen, und redet sich ein, es sei „nur ein Detail“.',
    psychologicalMarker:
      'Rationalisierung und erste Verdrängung — das schlechte Gewissen wird weggedacht.',
  },
  {
    stage: 3,
    id: 'coverUp',
    name: 'Die Vertuschung',
    description:
      'Die erste Übertretung muss verborgen werden. Aus einem Fehler wird eine ' +
      'Kette von Lügen, die sich verselbstständigt.',
    example:
      'Der Protagonist manipuliert Akten und schüchtert einen Zeugen ein, damit ' +
      'die frühere Grenzüberschreitung unentdeckt bleibt.',
    psychologicalMarker:
      'Kontrollzwang und Angst vor Entdeckung — die Lüge diktiert nun das Handeln.',
  },
  {
    stage: 4,
    id: 'firstCollateral',
    name: 'Der erste Kollateralschaden',
    description:
      'Ein Unbeteiligter kommt zu Schaden. Der Protagonist nimmt es in Kauf und ' +
      'verbucht es als bedauerlichen Preis für das größere Ziel.',
    example:
      'Eine unschuldige Person wird fälschlich beschuldigt und ruiniert; der ' +
      'Protagonist schweigt, um sich selbst zu decken.',
    psychologicalMarker:
      'Entkopplung und Empathieverlust — Menschen werden zu Zahlen im Kalkül.',
  },
  {
    stage: 5,
    id: 'rationalizedCruelty',
    name: 'Rationalisierung der Grausamkeit',
    description:
      'Aktive Grausamkeit wird zum Werkzeug und mit Notwendigkeit begründet. ' +
      'Das Leiden anderer wird kühl eingeplant.',
    example:
      'Der Protagonist lässt einen Widersacher gezielt brechen und rechtfertigt es ' +
      'als „notwendige Härte“ im Namen des höheren Ziels.',
    psychologicalMarker:
      'Instrumentalisierung und moralische Neutralisierung — Grausamkeit als Pflicht.',
  },
  {
    stage: 6,
    id: 'paranoidPurge',
    name: 'Die paranoide Säuberung',
    description:
      'Der Protagonist sieht überall Verrat und säubert sein Umfeld. Auch frühere ' +
      'Verbündete werden zu Feinden.',
    example:
      'Der Protagonist lässt langjährige Vertraute beseitigen, weil sie zu viel ' +
      'wissen und ihm gefährlich werden könnten.',
    psychologicalMarker:
      'Paranoia und Isolation — totale Unfähigkeit zu vertrauen.',
  },
  {
    stage: 7,
    id: 'totalBankruptcy',
    name: 'Totaler moralischer Bankrott',
    description:
      'Alle Werte sind verbraucht. Der Protagonist hat sein ursprüngliches Ziel ' +
      'verraten und handelt nur noch um der eigenen Macht willen.',
    example:
      'Der Protagonist opfert genau die Sache, die ihn einst antrieb, und erkennt ' +
      'zu spät, dass er zu dem geworden ist, den er einst bekämpfte.',
    psychologicalMarker:
      'Völlige Leere und Selbstverlust — kein Wert, kein Ziel, keine Bindung bleibt.',
  },
] as const;

/** Anzahl der Stufen des Abstiegs. */
export const CORRUPTION_STAGE_COUNT = CORRUPTION_STAGES.length;

// ---------------------------------------------------------------------------
// WP 130.2 — Feature 2: Abstiegs-Kurve
// ---------------------------------------------------------------------------

/** Eingabe für die Abstiegs-Kurve. */
export interface CorruptionCurveInput {
  /** Name der Figur, deren Abstieg modelliert wird. */
  characterName: string;
  /** Gesamtzahl der Kapitel, über die sich der Abstieg erstreckt. */
  chapters: number;
}

/** Eine einzelne Station der Abstiegs-Kurve. */
export interface CorruptionCurveStage {
  /** Stufennummer (1–7). */
  stage: number;
  /** Kapitel, in dem diese Stufe erreicht wird (1-basiert). */
  chapter: number;
  /** Identifier der Stufe (englisch). */
  stageId: string;
  /** Anzeigename der Stufe (deutsch). */
  stageName: string;
  /** Verbleibender Menschlichkeitswert (100 → nahe 0). */
  humanityLevel: number;
}

/** Ergebnis der Abstiegs-Kurve. */
export interface CorruptionCurve {
  /** Name der Figur. */
  characterName: string;
  /** Die sieben Stationen, aufsteigend nach Stufe. */
  stages: CorruptionCurveStage[];
  /** Menschlichkeitswert am Ende des Abstiegs. */
  humanityAtEnd: number;
  /** Beschreibung des Kurvenverlaufs (deutsch). */
  curveDescription: string;
}

/**
 * Basis-Menschlichkeitswerte je Stufe. Strenge Monotonie ist garantiert, weil
 * der kleinste Abstand zwischen zwei Werten (10) größer ist als die maximale
 * Jitter-Spanne (6).
 */
const BASE_HUMANITY: readonly number[] = [100, 90, 78, 63, 46, 27, 5];

/** Maximale deterministische Abweichung (±) pro Stufe. */
const HUMANITY_JITTER = 3;

/** Kurven-Charakterisierungen für die Beschreibung (deterministisch gewählt). */
const CURVE_DESCRIPTORS: readonly string[] = [
  'Ein leiser, fast unmerklicher Abstieg, bei dem jede Stufe die vorige als selbstverständlich erscheinen lässt.',
  'Ein beschleunigter Abstieg, bei dem der Protagonist die Kontrolle über die eigenen Entscheidungen verliert.',
  'Ein ruckartiger Abstieg mit langen Phasen der Selbsttäuschung und plötzlichen Grenzüberschreitungen.',
  'Ein kalter, methodischer Abstieg, bei dem jede Grausamkeit sauber begründet und protokolliert wird.',
  'Ein tragischer Abstieg, bei dem der Protagonist sein ursprüngliches Ziel Schritt für Schritt verrät.',
] as const;

/** Eine Zahl defensiv nach endlicher Ganzzahl ≥ `min` normalisieren. */
function toInt(raw: unknown, min: number, fallback: number): number {
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(num) || num < min) return fallback;
  return Math.floor(num);
}

/** Eine Zahl defensiv als endliche Zahl lesen (sonst `null`). */
function toFiniteNumber(raw: unknown): number | null {
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(num) ? num : null;
}

/** Menschlichkeitswert in [0, 100] begrenzen. */
function clampHumanity(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Ordnet einer Stufe (1-basiert) ein Kapitel zu (1-basiert). Die Stufen werden
 * gleichmäßig über die Kapitel verteilt; die Zuordnung ist monoton steigend und
 * bleibt innerhalb von [1, totalChapters].
 */
function chapterForStage(stage: number, totalChapters: number): number {
  const span = totalChapters - 1;
  const offset = ((stage - 1) * span) / (CORRUPTION_STAGE_COUNT - 1);
  const chapter = Math.round(1 + offset);
  return Math.min(totalChapters, Math.max(1, chapter));
}

/**
 * Erzeugt die Abstiegs-Kurve einer Figur über sieben Stufen.
 *
 * Der Menschlichkeitswert fällt von 100 auf nahe 0; jede Stufe liegt in einem
 * eigenen Kapitel (gleichmäßig verteilt über `chapters`). Die kleinen
 * deterministischen Abweichungen (±`HUMANITY_JITTER`) aus dem Seed können die
 * strenge Monotonie nicht brechen.
 *
 * Ungültige Eingaben werden defensiv normalisiert: ein fehlender Name wird zu
 * „Unbekannt“, eine ungültige Kapitelzahl zu 7. Kein Throw, keine Mutation.
 */
export function buildCorruptionCurve(input: CorruptionCurveInput, seed: number): CorruptionCurve {
  const safeInput = input && typeof input === 'object' ? input : ({} as CorruptionCurveInput);
  const characterName =
    typeof safeInput.characterName === 'string' && safeInput.characterName.trim().length > 0
      ? safeInput.characterName.trim()
      : 'Unbekannt';
  const totalChapters = toInt(safeInput.chapters, 1, CORRUPTION_STAGE_COUNT);

  const rng = createSeededRandom(seed);
  const stages: CorruptionCurveStage[] = [];

  for (let i = 0; i < CORRUPTION_STAGE_COUNT; i++) {
    const stageDef = CORRUPTION_STAGES[i];
    const base = BASE_HUMANITY[i] ?? 0;
    const jitter = Math.floor(rng() * (HUMANITY_JITTER * 2 + 1)) - HUMANITY_JITTER;
    const humanityLevel = clampHumanity(base + jitter);

    stages.push({
      stage: stageDef.stage,
      chapter: chapterForStage(stageDef.stage, totalChapters),
      stageId: stageDef.id,
      stageName: stageDef.name,
      humanityLevel,
    });
  }

  const humanityAtEnd = stages.length > 0 ? stages[stages.length - 1].humanityLevel : 0;
  const descriptor = pick(CURVE_DESCRIPTORS, rng);
  const curveDescription =
    `Der moralische Abstieg von ${characterName} erstreckt sich über ` +
    `${totalChapters} Kapitel und ${CORRUPTION_STAGE_COUNT} Stufen. ` +
    `Die Menschlichkeit fällt von 100 auf ${humanityAtEnd}. ${descriptor}`;

  return { characterName, stages, humanityAtEnd, curveDescription };
}

// ---------------------------------------------------------------------------
// WP 130.2 — Feature 3: Point-of-No-Return-Erkennung
// ---------------------------------------------------------------------------

/** Minimal-Form der Kurvenstation für die Erkennung. */
export interface PointOfNoReturnStage {
  /** Stufennummer (1–7). */
  stage: number;
  /** Kapitel der Stufe (1-basiert). */
  chapter: number;
  /** Menschlichkeitswert auf dieser Stufe. */
  humanityLevel: number;
}

/** Minimale Kurvenform für die Point-of-No-Return-Erkennung. */
export interface PointOfNoReturnCurve {
  stages: PointOfNoReturnStage[];
}

/** Ergebnis der Point-of-No-Return-Erkennung. */
export interface PointOfNoReturn {
  /** Stufe, ab der es kein Zurück mehr gibt (0 bei fehlenden Daten). */
  stage: number;
  /** Kapitel dieser Stufe (0 bei fehlenden Daten). */
  chapter: number;
  /** Begründung der Einstufung (deutsch). */
  rationale: string;
  /** Ist die Rückkehr ab dieser Stufe unmöglich? */
  irreversible: boolean;
  /** Konkreter Szenenvorschlag für den Wendepunkt. */
  sceneSuggestion: string;
}

/** Schwellwert: ab diesem Menschlichkeitswert gilt der Abstieg als irreversibel. */
const POINT_OF_NO_RETURN_THRESHOLD = 50;

/** Szenenvorschläge für den Point of No Return (deterministisch gewählt). */
const SCENE_SUGGESTIONS: readonly string[] = [
  'Eine stille Szene im Spiegel: Der Protagonist erkennt, dass er sein eigenes Gesicht nicht mehr wiedererkennt.',
  'Ein Zwiegespräch mit dem letzten Vertrauten, der ihn zur Umkehr drängt — und abgewiesen wird.',
  'Ein Ritual der endgültigen Entscheidung: ein Papier wird unterschrieben, ein Bund endgültig zerschnitten.',
  'Der Blick auf ein altes Foto der einst geliebten Sache, während im Hintergrund bereits die nächste Grenzüberschreitung vorbereitet wird.',
  'Ein Regennacht-Monolog vor einem Grab, in dem der Protagonist sich selbst begräbt.',
] as const;

/**
 * Findet den Point of No Return in einer Abstiegs-Kurve.
 *
 * Als Wendepunkt gilt die erste Stufe, deren Menschlichkeitswert den Schwellwert
 * (50) unterschreitet. Gibt es keine solche Stufe, wird die Stufe mit dem
 * steilsten Abstieg gegenüber der Vorgängerstufe gewählt; als letzter Fallback
 * dient die letzte Stufe. Als irreversibel gilt der Wendepunkt ab Stufe 4.
 *
 * Fehlende/ungültige Daten liefern `{ stage: 0, chapter: 0, irreversible: false }`
 * mit einem erklärenden `rationale` (kein Throw). Die Eingabe wird nicht mutiert.
 */
export function detectPointOfNoReturn(
  curve: PointOfNoReturnCurve,
  seed: number,
): PointOfNoReturn {
  const rng = createSeededRandom(seed);
  const sceneSuggestion = pick(SCENE_SUGGESTIONS, rng);

  const rawStages = curve && typeof curve === 'object' && Array.isArray(curve.stages)
    ? curve.stages
    : [];

  const stages: PointOfNoReturnStage[] = [];
  for (const raw of rawStages) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as unknown as Record<string, unknown>;
    const stage = toFiniteNumber(obj.stage);
    const chapter = toInt(obj.chapter, 0, 0);
    const humanityLevel = toFiniteNumber(obj.humanityLevel);
    if (stage === null || humanityLevel === null) continue;
    stages.push({ stage: Math.floor(stage), chapter, humanityLevel });
  }

  if (stages.length === 0) {
    return {
      stage: 0,
      chapter: 0,
      rationale:
        'Keine gültigen Stufen in der Kurve — ein Point of No Return lässt sich ' +
        'nicht bestimmen.',
      irreversible: false,
      sceneSuggestion,
    };
  }

  stages.sort((a, b) => a.stage - b.stage);

  // 1) Erste Stufe unter dem Schwellwert.
  let chosen: PointOfNoReturnStage | null = null;
  for (const entry of stages) {
    if (entry.humanityLevel < POINT_OF_NO_RETURN_THRESHOLD) {
      chosen = entry;
      break;
    }
  }

  let reasonKind = 'threshold';

  // 2) Sonst: steilster Abstieg.
  if (!chosen) {
    let steepestDrop = 0;
    for (let i = 1; i < stages.length; i++) {
      const drop = stages[i - 1].humanityLevel - stages[i].humanityLevel;
      if (drop > steepestDrop) {
        steepestDrop = drop;
        chosen = stages[i];
      }
    }
    reasonKind = 'steepest';
  }

  // 3) Letzter Fallback: die letzte Stufe.
  if (!chosen) {
    chosen = stages[stages.length - 1];
    reasonKind = 'final';
  }

  const irreversible = chosen.stage >= 4;

  let rationale: string;
  if (reasonKind === 'threshold') {
    rationale =
      `Auf Stufe ${chosen.stage} (Kapitel ${chosen.chapter}) fällt die Menschlichkeit ` +
      `auf ${chosen.humanityLevel} und damit unter den Schwellwert ` +
      `${POINT_OF_NO_RETURN_THRESHOLD}. Ab hier übersteigen die Zugeständnisse den ` +
      'ursprünglichen Zweck — eine Umkehr erscheint nicht mehr glaubwürdig.';
  } else if (reasonKind === 'steepest') {
    rationale =
      `Auf Stufe ${chosen.stage} (Kapitel ${chosen.chapter}) zeigt die Kurve den ` +
      `steilsten Abstieg der Menschlichkeit auf ${chosen.humanityLevel}. Dieser ` +
      'Bruch markiert den Wendepunkt, an dem die Figur die Kontrolle verliert.';
  } else {
    rationale =
      `Der Abstieg endet auf Stufe ${chosen.stage} (Kapitel ${chosen.chapter}) mit ` +
      `einer Menschlichkeit von ${chosen.humanityLevel}. Es gibt keine spätere Stufe ` +
      'mehr, die eine Umkehr noch tragen könnte.';
  }

  return {
    stage: chosen.stage,
    chapter: chosen.chapter,
    rationale,
    irreversible,
    sceneSuggestion,
  };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Erstellt eine Beispiel-Stufe (die edle Absicht) als Kopie.
 */
export function createSampleStage(): CorruptionStage {
  const base = CORRUPTION_STAGES[0];
  return { ...base };
}

/**
 * Erstellt eine Beispiel-Abstiegs-Kurve mit festen Parametern.
 */
export function createSampleCorruptionCurve(): CorruptionCurve {
  return buildCorruptionCurve({ characterName: 'Lord Adrian Voss', chapters: 24 }, 42);
}
