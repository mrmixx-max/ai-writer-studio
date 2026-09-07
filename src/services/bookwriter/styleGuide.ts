// Sprint 17 (Textqualität), Agent 3: Style-Guide-Engine.
//
// Per-project Style-Guide-Durchsetzung — regelbasiert und deterministisch
// (kein LLM-Call nötig):
// - verbotene Wörter (forbiddenWords, optional mit Ersatzvorschlag)
// - bevorzugte Begriffe (preferredTerms: wrong -> preferred)
// - Figurennamen-Schreibweise (characterNames: canonical + variants)
// - Zeitform (tense: past | present, Heuristik über Markerwörter)
// - Erzählperspektive (pov: first | third, Heuristik über Pronomen)
//
// Persistenz: Projekt-Settings in der generischen `settings`-Tabelle
// (Key `styleguide:<projectId>`, JSON), analog zum Settings-Service.

import { getDb, persist } from "@/services/db";
import { uid } from "@/services/knowledge/util";

/** Erwartete Zeitform eines Projekts. */
export type StyleTense = "past" | "present";

/** Erwartete Erzählperspektive eines Projekts. */
export type StylePov = "first" | "third";

/** Regelwerk eines Projekt-Style-Guides. */
export interface StyleGuideRules {
  /** Verbotene Wörter, optional mit Ersatzvorschlag. */
  forbiddenWords: Array<{ word: string; suggestion?: string }>;
  /** Bevorzugte Begriffe: falsche -> richtige Schreibweise. */
  preferredTerms: Array<{ wrong: string; preferred: string }>;
  /** Verbindliche Figurennamen-Schreibweise + tolerierte Varianten. */
  characterNames: Array<{ canonical: string; variants: string[] }>;
  /** Erwartete Zeitform (null = keine Vorgabe). */
  tense: StyleTense | null;
  /** Erwartete Erzählperspektive (null = keine Vorgabe). */
  pov: StylePov | null;
}

/** Ein Projekt-Style-Guide. */
export interface StyleGuide {
  id: string;
  projectId: string | null;
  rules: StyleGuideRules;
  createdAt: number;
  updatedAt: number;
}

/** Art eines Style-Guide-Befunds. */
export type StyleFindingKind =
  | "forbiddenWord"
  | "preferredTerm"
  | "characterName"
  | "tense"
  | "pov";

/** Ein Befund der Style-Guide-Prüfung. */
export interface StyleFinding {
  id: string;
  kind: StyleFindingKind;
  /** Zeichenoffset im geprüften Text. */
  offset: number;
  /** Länge der beanstandeten Stelle. */
  length: number;
  /** Gefundene Textstelle. */
  found: string;
  /** Erwartete Schreibweise (falls automatisch ersetzbar). */
  expected: string | null;
  /** Vorschlag für applyFix (falls automatisch ersetzbar). */
  suggestion: string | null;
  /** Menschlich lesbare Begründung. */
  message: string;
}

const EMPTY_RULES: StyleGuideRules = {
  forbiddenWords: [],
  preferredTerms: [],
  characterNames: [],
  tense: null,
  pov: null,
};

function clean(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** Erstellt einen Style-Guide aus einem (partiellen) Regelwerk. */
export function createStyleGuide(
  rules: Partial<StyleGuideRules>,
  projectId: string | null = null,
): StyleGuide {
  const now = Date.now();
  const seenForbidden = new Set<string>();
  const forbiddenWords: StyleGuideRules["forbiddenWords"] = [];
  for (const entry of rules.forbiddenWords ?? []) {
    const word = clean(entry.word);
    if (!word) continue;
    const key = word.toLocaleLowerCase("de-DE");
    if (seenForbidden.has(key)) continue;
    seenForbidden.add(key);
    const suggestion = clean(entry.suggestion);
    forbiddenWords.push(suggestion ? { word, suggestion } : { word });
  }
  const seenPreferred = new Set<string>();
  const preferredTerms: StyleGuideRules["preferredTerms"] = [];
  for (const entry of rules.preferredTerms ?? []) {
    const wrong = clean(entry.wrong);
    const preferred = clean(entry.preferred);
    if (!wrong || !preferred) continue;
    const key = wrong.toLocaleLowerCase("de-DE");
    if (seenPreferred.has(key)) continue;
    seenPreferred.add(key);
    preferredTerms.push({ wrong, preferred });
  }
  const characterNames: StyleGuideRules["characterNames"] = [];
  for (const entry of rules.characterNames ?? []) {
    const canonical = clean(entry.canonical);
    if (!canonical) continue;
    const variants = (entry.variants ?? []).map(clean).filter(Boolean);
    if (variants.length === 0) continue;
    characterNames.push({ canonical, variants });
  }
  const tense = rules.tense === "past" || rules.tense === "present" ? rules.tense : null;
  const pov = rules.pov === "first" || rules.pov === "third" ? rules.pov : null;
  return {
    id: uid("sg"),
    projectId,
    rules: { forbiddenWords, preferredTerms, characterNames, tense, pov },
    createdAt: now,
    updatedAt: now,
  };
}

/** Escaped einen String für die Verwendung in RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Findet alle Vorkommen (Wortgrenzen, case-insensitiv) mit Offset. */
function findAll(text: string, needle: string): Array<{ offset: number; found: string }> {
  const out: Array<{ offset: number; found: string }> = [];
  if (!needle) return out;
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(needle)}(?![\\p{L}\\p{N}_])`, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ offset: m.index, found: m[0] });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

// Markerwörter, die auf die jeweils *falsche* Zeitform hindeuten (Heuristik).
// Präteritums-Marker (deuten auf Vergangenheit — Verstoß bei tense="present").
const PAST_MARKERS = [
  "war", "waren", "warst", "hatte", "hatten", "hattest", "wurde", "wurden",
  "ging", "kam", "sah", "dachte", "sagte", "sagten", "konnte", "konnten",
  "musste", "mussten", "wollte", "wollten", "sollte", "sollten", "durfte",
  "durften", "wusste", "wussten", "stand", "lag", "saß", "hielt", "nahm",
];
// Präsens-Marker (deuten auf Gegenwart — Verstoß bei tense="past").
// Perfekt-Hilfsverben ("hat"/"haben") sind bewusst ausgenommen: Perfekt
// erzählt Vergangenheit und wäre ein False Positive im Präteritum-Kontext.
const PRESENT_MARKERS = [
  "ist", "sind", "bin", "bist", "seid", "wird", "werden", "wirst", "werde",
  "kann", "kannst", "können", "könnt", "muss", "musst", "müssen", "müsst",
  "will", "willst", "wollen", "wollt", "soll", "sollst", "sollen", "sollt",
  "darf", "darfst", "dürfen", "dürft", "weiß", "weißt", "wissen", "wisst",
  "geht", "gehe", "gehst", "gehen", "kommt", "komme", "kommst", "kommen",
];

// Pronomen-Heuristik für die Erzählperspektive.
const FIRST_PERSON_MARKERS = [
  "ich", "mich", "mir", "mein", "meine", "meiner", "meinem", "meinen", "meins",
  "wir", "uns", "unser", "unsere", "unserem", "unseren", "unserer",
];
// "sie"/"es"/"ihr" sind bewusst ausgenommen (mehrdeutig: Plural/Höflichkeit,
// Neutrum). "er"/"ihn"/"ihm" sind eindeutig dritte Person Singular.
const THIRD_PERSON_MARKERS = ["er", "ihn", "ihm", "sein", "seine", "seinem", "seinen", "seiner"];

let findingSeq = 0;

function makeFinding(
  kind: StyleFindingKind,
  offset: number,
  found: string,
  expected: string | null,
  suggestion: string | null,
  message: string,
): StyleFinding {
  findingSeq++;
  return {
    id: `sgf_${Date.now().toString(36)}_${findingSeq}`,
    kind,
    offset,
    length: [...found].length,
    found,
    expected,
    suggestion,
    message,
  };
}

/** Passt die Großschreibung des Ersatzes an die Fundstelle an. */
export function matchCapitalization(found: string, replacement: string): string {
  if (!found || !replacement) return replacement;
  const firstFound = [...found][0];
  const chars = [...replacement];
  if (firstFound === firstFound.toLocaleUpperCase("de-DE") && firstFound !== firstFound.toLocaleLowerCase("de-DE")) {
    chars[0] = chars[0].toLocaleUpperCase("de-DE");
  }
  return chars.join("");
}

/** Prüft einen Text gegen den Style-Guide, Befunde sortiert nach Offset. */
export function checkAgainstGuide(text: string, guide: StyleGuide): StyleFinding[] {
  const findings: StyleFinding[] = [];
  if (!text) return findings;
  const rules = guide.rules ?? EMPTY_RULES;

  for (const entry of rules.forbiddenWords) {
    for (const hit of findAll(text, entry.word)) {
      findings.push(
        makeFinding(
          "forbiddenWord",
          hit.offset,
          hit.found,
          entry.suggestion ?? null,
          entry.suggestion ?? null,
          entry.suggestion
            ? `Verbotenes Wort "${hit.found}" — verwende stattdessen "${entry.suggestion}".`
            : `Verbotenes Wort "${hit.found}" laut Style-Guide.`,
        ),
      );
    }
  }

  for (const entry of rules.preferredTerms) {
    for (const hit of findAll(text, entry.wrong)) {
      const replacement = matchCapitalization(hit.found, entry.preferred);
      findings.push(
        makeFinding(
          "preferredTerm",
          hit.offset,
          hit.found,
          replacement,
          replacement,
          `Bevorzugter Begriff: "${hit.found}" → "${replacement}".`,
        ),
      );
    }
  }

  for (const entry of rules.characterNames) {
    for (const variant of entry.variants) {
      // Kanonische Schreibweise selbst nie beanstanden.
      if (variant.toLocaleLowerCase("de-DE") === entry.canonical.toLocaleLowerCase("de-DE")) continue;
      for (const hit of findAll(text, variant)) {
        findings.push(
          makeFinding(
            "characterName",
            hit.offset,
            hit.found,
            entry.canonical,
            entry.canonical,
            `Figurenname "${hit.found}" weicht von der Style-Guide-Schreibweise "${entry.canonical}" ab.`,
          ),
        );
      }
    }
  }

  if (rules.tense === "past") {
    for (const marker of PRESENT_MARKERS) {
      for (const hit of findAll(text, marker)) {
        findings.push(
          makeFinding(
            "tense",
            hit.offset,
            hit.found,
            null,
            null,
            `Möglicher Zeitform-Bruch (Präteritum erwartet): "${hit.found}" deutet auf Präsens. Bitte prüfen.`,
          ),
        );
      }
    }
  } else if (rules.tense === "present") {
    for (const marker of PAST_MARKERS) {
      for (const hit of findAll(text, marker)) {
        findings.push(
          makeFinding(
            "tense",
            hit.offset,
            hit.found,
            null,
            null,
            `Möglicher Zeitform-Bruch (Präsens erwartet): "${hit.found}" deutet auf Präteritum. Bitte prüfen.`,
          ),
        );
      }
    }
  }

  if (rules.pov === "first") {
    for (const marker of THIRD_PERSON_MARKERS) {
      for (const hit of findAll(text, marker)) {
        findings.push(
          makeFinding(
            "pov",
            hit.offset,
            hit.found,
            null,
            null,
            `Möglicher Perspektiv-Bruch (Ich-Perspektive erwartet): "${hit.found}" deutet auf dritte Person. Bitte prüfen.`,
          ),
        );
      }
    }
  } else if (rules.pov === "third") {
    for (const marker of FIRST_PERSON_MARKERS) {
      for (const hit of findAll(text, marker)) {
        findings.push(
          makeFinding(
            "pov",
            hit.offset,
            hit.found,
            null,
            null,
            `Möglicher Perspektiv-Bruch (dritte Person erwartet): "${hit.found}" deutet auf Ich-Perspektive. Bitte prüfen.`,
          ),
        );
      }
    }
  }

  findings.sort((a, b) => a.offset - b.offset || a.kind.localeCompare(b.kind));
  return findings;
}

/**
 * Wendet die Korrektur eines Befunds auf den Text an.
 * Befunde ohne Vorschlag (Tense/POV ohne Ersatz) lassen den Text unverändert.
 */
export function applyFix(text: string, finding: StyleFinding): string {
  const replacement = finding.suggestion ?? finding.expected;
  if (replacement === null || replacement === undefined) return text;
  const chars = [...text];
  if (finding.offset < 0 || finding.length <= 0 || finding.offset + finding.length > chars.length) {
    return text;
  }
  const actual = chars.slice(finding.offset, finding.offset + finding.length).join("");
  if (actual !== finding.found) return text;
  return chars.slice(0, finding.offset).join("") + replacement + chars.slice(finding.offset + finding.length).join("");
}

// ---- Persistenz (Projekt-Settings) ----

function settingsKey(projectId: string): string {
  return `styleguide:${projectId}`;
}

/** Speichert den Style-Guide in den Projekt-Settings. */
export async function saveStyleGuide(projectId: string, guide: StyleGuide): Promise<void> {
  const db = getDb();
  const stored: StyleGuide = {
    ...guide,
    projectId,
    updatedAt: Date.now(),
  };
  db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [settingsKey(projectId), JSON.stringify(stored)],
  );
  await persist();
}

/** Lädt den Style-Guide aus den Projekt-Settings (null, wenn keiner gespeichert). */
export function loadStyleGuide(projectId: string): StyleGuide | null {
  const db = getDb();
  const row = db.exec("SELECT value FROM settings WHERE key = ?", [settingsKey(projectId)]);
  if (!row.length || !row[0].values.length) return null;
  try {
    const parsed = JSON.parse(row[0].values[0][0] as string) as StyleGuide;
    if (!parsed || typeof parsed !== "object" || !parsed.rules) return null;
    return {
      ...parsed,
      projectId,
      rules: {
        forbiddenWords: Array.isArray(parsed.rules.forbiddenWords) ? parsed.rules.forbiddenWords : [],
        preferredTerms: Array.isArray(parsed.rules.preferredTerms) ? parsed.rules.preferredTerms : [],
        characterNames: Array.isArray(parsed.rules.characterNames) ? parsed.rules.characterNames : [],
        tense: parsed.rules.tense === "past" || parsed.rules.tense === "present" ? parsed.rules.tense : null,
        pov: parsed.rules.pov === "first" || parsed.rules.pov === "third" ? parsed.rules.pov : null,
      },
    };
  } catch {
    return null;
  }
}
