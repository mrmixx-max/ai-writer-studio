// Cinematography-Previs-Service (WP 38.2).
// Lokal, kein LLM nötig, vollständig deterministisch.
//
// Aus einem Rohtext/Storyboard werden drei Dinge abgeleitet:
//   1. assignCameraShots   -> filmische Einstellung je Absatz (Shot-Liste)
//   2. calculateScreenTime -> geschätzte Leinwandzeit (1 Seite ≈ 1 Minute)
//   3. estimateBudget      -> grober Szenenaufwand (Budget-Level + Faktoren)
//
// Alle Ableitungen sind rein regelbasiert (Keyword-Profile + feste Gewichte),
// damit identische Eingaben immer identische Ergebnisse liefern. Fehlende oder
// unbrauchbare Eingaben fallen auf neutrale Standardwerte zurück.

export type ShotType =
  | "wide"
  | "closeup"
  | "overShoulder"
  | "birdsEye"
  | "dutchAngle";

export interface ShotAssignment {
  paragraphIndex: number;
  shot: ShotType;
  reason: string;
}

export interface ScreenTime {
  minutes: number;
  pages: number;
  scenes: number;
}

export interface BudgetEstimate {
  level: "low" | "medium" | "high";
  score: number;
  factors: string[];
}

/** Branchenübliche Näherung: eine Drehbuchseite fasst ~55 Textzeilen. */
const LINES_PER_PAGE = 55;
/** Vorgabe aus WP 38.2: 1 Seite entspricht 1 Minute Leinwandzeit. */
const MINUTES_PER_PAGE = 1;
/** Durchschnittliche Szenenlänge (~1,6 Seiten) zur Szenenschätzung. */
const LINES_PER_SCENE = 90;

/** Aufwandsgewicht je Einstellung (relativ, deterministisch). */
const SHOT_WEIGHT: Record<ShotType, number> = {
  wide: 1,
  closeup: 2,
  overShoulder: 2,
  dutchAngle: 3,
  birdsEye: 4,
};

/** Ab diesem Score gilt der Aufwand als mittel bzw. hoch. */
const BUDGET_MEDIUM_THRESHOLD = 5;
const BUDGET_HIGH_THRESHOLD = 13;

/** Feste Reihenfolge für Zählung und Faktoren-Ausgabe (deterministisch). */
const SHOT_TYPES: ShotType[] = [
  "birdsEye",
  "dutchAngle",
  "closeup",
  "overShoulder",
  "wide",
];

const SHOT_LABEL: Record<ShotType, string> = {
  wide: "Totale",
  closeup: "Großaufnahme",
  overShoulder: "Schuss-Gegenschuss",
  birdsEye: "Vogelperspektive/Luftaufnahme",
  dutchAngle: "Schrägstellung (Dutch Angle)",
};

/**
 * Keyword-Profile in Prioritätsreihenfolge: explizite Kamerasignale zuerst,
 * inhaltliche Signale danach, die generische Totale zuletzt.
 */
const SHOT_PROFILES: Array<{ shot: ShotType; keywords: string[] }> = [
  {
    shot: "birdsEye",
    keywords: [
      "vogelperspektive",
      "luftaufnahme",
      "luftbild",
      "von oben",
      "von hoch oben",
      "draufsicht",
      "drohne",
      "herab",
    ],
  },
  {
    shot: "dutchAngle",
    keywords: [
      "schräg",
      "schraeg",
      "schief",
      "kippt",
      "kippen",
      "verzerrt",
      "instabil",
      "taumel",
      "chaos",
      "panik",
      "wahnsinn",
    ],
  },
  {
    shot: "closeup",
    keywords: [
      "gesicht",
      "auge",
      "augen",
      "träne",
      "traene",
      "lippen",
      "flüstert",
      "fluestert",
      "lächelt",
      "laechelt",
      "weint",
      "hand",
      "faust",
      "atem",
      "kuss",
      "küsst",
      "kuest",
      "schweiß",
      "schweiss",
    ],
  },
  {
    shot: "overShoulder",
    keywords: [
      "schulter",
      "gegenüber",
      "gegenueber",
      "sagt",
      "sagte",
      "fragt",
      "fragte",
      "antwortet",
      "spricht",
      "zuhört",
      "zuhørt",
      "dialog",
      "beobachtet",
      "verfolgt",
      "blickt",
    ],
  },
  {
    shot: "wide",
    keywords: [
      "landschaft",
      "stadt",
      "straße",
      "strasse",
      "platz",
      "feld",
      "weite",
      "wüste",
      "wueste",
      "meer",
      "himmel",
      "horizont",
      "gebäude",
      "gebaeude",
      "anwesen",
      "tal",
      "ebene",
      "szenerie",
      "panorama",
    ],
  },
];

/**
 * Rotationsreihenfolge für Absätze ohne erkennbares Signal. Deterministisch
 * (Zähler statt Zufall), damit dieselbe Eingabe dieselbe Shot-Liste ergibt.
 */
const FALLBACK_SHOTS: ShotType[] = ["wide", "overShoulder", "closeup"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Treffer am Wortanfang (deckt Komposita wie „Straßenecke" mit ab). */
function matchKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  const re = new RegExp(`(^|[^a-zäöüß0-9])${escapeRegExp(keyword)}`, "i");
  return re.test(text);
}

/** Normalisiert die Eingabe defensiv auf einen sicheren, getrimmten String. */
function normalizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

/** Erkennt die spezifischste Einstellung für einen Absatz (oder null). */
function detectShot(
  text: string,
): { shot: ShotType; keyword: string } | null {
  const lower = text.toLowerCase();
  for (const profile of SHOT_PROFILES) {
    for (const keyword of profile.keywords) {
      if (matchKeyword(lower, keyword)) {
        return { shot: profile.shot, keyword };
      }
    }
  }
  return null;
}

/**
 * Weist jedem nicht-leeren Absatz eine filmische Einstellung zu.
 * Leere/ungültige Absätze werden übersprungen; der paragraphIndex bezieht sich
 * weiterhin auf die Position im Original-Array.
 */
export function assignCameraShots(paragraphs: string[]): ShotAssignment[] {
  if (!Array.isArray(paragraphs)) return [];

  const assignments: ShotAssignment[] = [];
  let fallbackCount = 0;

  paragraphs.forEach((raw, index) => {
    const text = normalizeText(raw);
    if (!text) return;

    const match = detectShot(text);
    if (match) {
      assignments.push({
        paragraphIndex: index,
        shot: match.shot,
        reason: `Signal „${match.keyword}" → ${SHOT_LABEL[match.shot]}.`,
      });
      return;
    }

    const shot = FALLBACK_SHOTS[fallbackCount % FALLBACK_SHOTS.length];
    fallbackCount += 1;
    assignments.push({
      paragraphIndex: index,
      shot,
      reason: `Kein spezifisches Signal – Standardeinstellung ${SHOT_LABEL[shot]}.`,
    });
  });

  return assignments;
}

/** Wandelt eine Zeilenzahl defensiv in eine nicht-negative Ganzzahl um. */
function safeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Schätzt die Leinwandzeit aus Action- und Dialogzeilen.
 * 1 Seite (≈55 Zeilen) = 1 Minute; Szenen werden über eine mittlere
 * Szenenlänge grob hochgerechnet. Fehlende Daten ergeben Nullwerte.
 */
export function calculateScreenTime(doc: {
  actionLines: number;
  dialogueLines: number;
}): ScreenTime {
  const source = (doc ?? {}) as Partial<
    Record<"actionLines" | "dialogueLines", unknown>
  >;
  const actionLines = safeCount(source.actionLines);
  const dialogueLines = safeCount(source.dialogueLines);
  const totalLines = actionLines + dialogueLines;

  if (totalLines <= 0) {
    return { minutes: 0, pages: 0, scenes: 0 };
  }

  const pages = round2(totalLines / LINES_PER_PAGE);
  const minutes = round2(pages * MINUTES_PER_PAGE);
  const scenes = Math.max(1, Math.round(totalLines / LINES_PER_SCENE));

  return { minutes, pages, scenes };
}

function buildFactors(counts: Map<string, number>, total: number): string[] {
  const factors: string[] = [];

  for (const shot of SHOT_TYPES) {
    const count = counts.get(shot) ?? 0;
    if (count <= 0) continue;
    switch (shot) {
      case "birdsEye":
        factors.push(
          `${count}× Luftaufnahme (Vogelperspektive) – Drohne/Kran erhöht Aufwand und Drehzeit.`,
        );
        break;
      case "dutchAngle":
        factors.push(
          `${count}× Schrägstellung (Dutch Angle) – Spezialrig und zusätzliche Takes.`,
        );
        break;
      case "closeup":
        factors.push(
          `${count}× Großaufnahme – aufwändige Lichtsetzung und Feinabstimmung.`,
        );
        break;
      case "overShoulder":
        factors.push(
          `${count}× Schuss-Gegenschuss – Umbau zwischen Perspektiven.`,
        );
        break;
      case "wide":
        factors.push(
          `${count}× Totale – Set-Design und aufwändige Lichtsetzung.`,
        );
        break;
    }
  }

  if (total >= 20) {
    factors.push(
      `Hohe Einstellungsdichte: ${total} Einstellungen – mehr Umbauten am Set.`,
    );
  }

  if (factors.length === 0) {
    factors.push("Unbekannte Einstellungstypen – Basiskosten angesetzt.");
  }

  return factors;
}

/**
 * Bewertet den Szenenaufwand anhand der Shot-Liste.
 * score = Summe der Aufwandsgewichte; level ergibt sich aus festen Schwellen.
 * Eine leere Liste ergibt „low" mit Score 0 und einem erklärenden Faktor.
 */
export function estimateBudget(shots: ShotAssignment[]): BudgetEstimate {
  const list = Array.isArray(shots) ? shots : [];
  const valid = list.filter(
    (shot): shot is ShotAssignment => !!shot && typeof shot === "object",
  );

  if (valid.length === 0) {
    return {
      level: "low",
      score: 0,
      factors: [
        "Keine Einstellungen vorhanden – keine bewertbaren Aufwandsfaktoren.",
      ],
    };
  }

  const counts = new Map<string, number>();
  let rawScore = 0;

  for (const assignment of valid) {
    const weight = SHOT_WEIGHT[assignment.shot as ShotType] ?? SHOT_WEIGHT.wide;
    rawScore += weight;
    counts.set(assignment.shot, (counts.get(assignment.shot) ?? 0) + 1);
  }

  const score = round2(clamp(rawScore, 0, Number.MAX_SAFE_INTEGER));
  const level =
    score >= BUDGET_HIGH_THRESHOLD
      ? "high"
      : score >= BUDGET_MEDIUM_THRESHOLD
        ? "medium"
        : "low";

  return { level, score, factors: buildFactors(counts, valid.length) };
}
