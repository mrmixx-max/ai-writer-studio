// Live-Konsistenzwächter (WP3.1).
//
// Problem: Der bestehende Checker (worldbuilding/consistency.ts) ist
// Pull-basiert — er läuft, wenn der Autor ihn startet, und prüft nur, ob
// Figuren/Orte überhaupt erwähnt werden. Ein Widerspruch im laufenden Text
// ("ihre braunen Augen" bei einer Figur mit "blauen Augen") fällt erst beim
// Preflight auf, wenn der Autor den Zusammenhang längst nicht mehr im Kopf hat.
//
// Ansatz: Beim Schreiben werden die Figuren-Merkmale gegen den Text geprüft.
// Erkannt wird ein Widerspruch nur, wenn BEIDE Seiten explizit sind:
//  - das Merkmal steht in den Figurendaten (z. B. "blaue Augen"),
//  - im Text steht ein anderer Wert derselben Kategorie ("braune Augen").
//
// Bewusst KEINE KI und keine Fuzzy-Erkennung: Ein Wächter, der beim Schreiben
// ständig falsch anspringt, wird abgeschaltet und ist dann nutzlos. Lieber
// wenige, sichere Befunde.
//
// Was NICHT gemeldet wird:
//  - Wenn die Figur das Merkmal ändert (Handlung! "sie färbte sich die Haare").
//    Dafür gibt es keine Erkennung — der Autor entscheidet.
//  - Wenn nur eine Seite bekannt ist. "braune Augen" im Text ohne Angabe in
//    den Figurendaten ist kein Widerspruch, sondern eine Lücke.

import { listCharacters, type Character } from "@/services/characters/characters";

/**
 * Attribut-Kategorien mit ihren typischen Ausprägungen.
 *
 * Nur Kategorien, deren Werte endlich und eindeutig sind. "Größe" fehlt
 * bewusst: "groß" vs. "1,85 m" ist kein Widerspruch, sondern eine
 * Präzisierung.
 */
export interface AttributeCategory {
  id: string;
  /** Wie die Kategorie in der Meldung heißt. */
  label: string;
  /** Erlaubte Ausprägungen (Grundform, kleingeschrieben). */
  values: string[];
  /** Substantive, die auf die Kategorie hindeuten. */
  nouns: string[];
}

export const ATTRIBUTE_CATEGORIES: readonly AttributeCategory[] = [
  {
    id: "augenfarbe",
    label: "Augenfarbe",
    values: ["blau", "braun", "grün", "grau", "schwarz", "hasel"],
    nouns: ["augen", "augenfarbe", "blick"],
  },
  {
    id: "haarfarbe",
    label: "Haarfarbe",
    values: ["blond", "braun", "schwarz", "rot", "grau", "weiß", "rötlich"],
    nouns: ["haare", "haar", "haarfarbe", "mähne", "zöpfe"],
  },
  {
    id: "haarlänge",
    label: "Haarlänge",
    values: ["kurz", "lang", "schulterlang", "kahl", "rasiert"],
    nouns: ["haare", "haar", "zöpfe", "mähne"],
  },
] as const;

/** Ein erkannter Widerspruch. */
export interface LiveFinding {
  /** Figur, auf die sich der Befund bezieht. */
  characterId: string;
  characterName: string;
  category: string;
  categoryLabel: string;
  /** Was in den Figurendaten steht. */
  expected: string;
  /** Was im Text steht. */
  found: string;
  /** Der Satz, in dem es auftrat (für die Anzeige). */
  excerpt: string;
  /** Zeichenposition im Text — erlaubt dem Editor, dorthin zu springen. */
  index: number;
}

/** Ergebnis einer Textprüfung. */
export interface LiveCheckResult {
  findings: LiveFinding[];
  /** Wie viele Figuren geprüft wurden. */
  charactersChecked: number;
}

/** Findet die im Text genannte Ausprägung einer Kategorie. */
function detectValueInText(
  text: string,
  category: AttributeCategory,
): { value: string; index: number } | null {
  // Muster: <Wert> ... <Substantiv> ODER <Substantiv> ... <Wert>
  // Beide Reihenfolgen kommen vor ("ihre blauen Augen" / "die Augen waren blau").
  for (const noun of category.nouns) {
    for (const value of category.values) {
      const before = new RegExp(`\\b${value}\\w*\\s+(?:\\w+\\s+){0,2}${noun}\\b`, "i");
      const after = new RegExp(`\\b${noun}\\b\\s+(?:\\w+\\s+){0,3}(?:war|waren|sind|ist)?\\s*${value}\\w*`, "i");
      const mBefore = before.exec(text);
      if (mBefore) return { value, index: mBefore.index };
      const mAfter = after.exec(text);
      if (mAfter) return { value, index: mAfter.index };
    }
  }
  return null;
}

/** Findet die in den Figurendaten hinterlegte Ausprägung einer Kategorie. */
function detectValueInTraits(
  traits: string,
  category: AttributeCategory,
): string | null {
  const t = traits.toLowerCase();
  // Nur zählen, wenn das Merkmal im Kontext der Kategorie steht: "blaue Augen"
  // statt nur "blau" (das könnte sich auf ein Kleidungsstück beziehen).
  for (const noun of category.nouns) {
    const stem = noun.replace(/e$/, ""); // "augen" → "aug", "haare" → "haar"
    for (const value of category.values) {
      const re = new RegExp(`\\b${value}\\w*\\s+(?:\\w+\\s+){0,2}${stem}`, "i");
      if (re.test(t)) return value;
    }
  }
  return null;
}

/** Holt den Satz um eine Position für die Anzeige. */
function excerptAround(text: string, index: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const raw = text.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + raw + (end < text.length ? "…" : "");
}

/**
 * Prüft einen Text gegen die Merkmale einer Figur.
 *
 * @param text      Der zu prüfende Text (Kapitel oder Abschnitt).
 * @param character Die Figur mit ihren Merkmalen.
 */
export function checkTextAgainstCharacter(text: string, character: Character): LiveFinding[] {
  const findings: LiveFinding[] = [];
  if (!text.trim() || !character.traits.trim()) return findings;

  // Die Figur muss im Text vorkommen, sonst ist der Text nicht über sie.
  const names = [character.name, ...character.aliases].filter((n) => n.trim());
  const mentioned = names.some((n) =>
    new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text),
  );
  if (!mentioned) return findings;

  for (const category of ATTRIBUTE_CATEGORIES) {
    const expected = detectValueInTraits(character.traits, category);
    if (!expected) continue; // keine Angabe → keine Prüfung

    const found = detectValueInText(text, category);
    if (!found) continue;
    if (found.value === expected) continue; // stimmt überein

    findings.push({
      characterId: character.id,
      characterName: character.name,
      category: category.id,
      categoryLabel: category.label,
      expected,
      found: found.value,
      excerpt: excerptAround(text, found.index),
      index: found.index,
    });
  }

  return findings;
}

/**
 * Prüft einen Text gegen alle Figuren eines Projekts.
 *
 * @param text      Der zu prüfende Text.
 * @param projectId Projekt der Figuren.
 * @param characters Optional: bereits geladene Figuren (spart eine DB-Abfrage).
 */
export function checkTextLive(
  text: string,
  projectId: string,
  characters?: Character[],
): LiveCheckResult {
  const chars = characters ?? listCharacters(projectId);
  const findings: LiveFinding[] = [];
  for (const c of chars) {
    findings.push(...checkTextAgainstCharacter(text, c));
  }
  return { findings, charactersChecked: chars.length };
}

/**
 * Erkennt, ob ein Befund durch eine bewusste Änderung entkräftet wird.
 *
 * Ein Wächter, der eine geplante Veränderung als Fehler meldet, wird
 * abgeschaltet. Diese Prüfung sucht im Text nach Wendungen, die eine
 * Veränderung anzeigen ("färbte", "schnitt", "veränderte").
 */
export function isIntentionalChange(excerpt: string): boolean {
  return /\b(färbte|färben|schnit|schneid|veränder|wandel|verwandel|frisierte|rasierte|tönte)\w*/i.test(
    excerpt,
  );
}

/**
 * Filtert Befunde, die auf einer erkennbaren bewussten Änderung beruhen.
 * Für die Live-Anzeige: Diese Fälle nicht als Widerspruch melden.
 */
export function filterIntentionalChanges(findings: LiveFinding[]): LiveFinding[] {
  return findings.filter((f) => !isIntentionalChange(f.excerpt));
}
