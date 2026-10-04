// Table-Read-Director (WP 45.1): Rollenverteilung, lineares Sprech-Skript und
// Regie-Markup für Drehbuch-Lesungen (table reads).
//
// Design-Regeln (analog zu screenplayTransmuter / readabilityMetrics / publisherExchange):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Strukturen
//     statt zu werfen.
//
// Öffentliche API:
//   assignRoles(doc, speakers)        — Figuren -> { speaker, color }
//   buildTableReadScript(doc, roles)  — lineares Sprech-Skript mit Cues
//   getCurrentSpeaker(script, index)  — aktuelle Dialogzeile oder null
//   getSceneChangeCue(script, index)  — Szenenwechsel-Cue (INT./EXT.)
//   formatDirectorMarkup(line)        — Regieanweisungen hervorheben
//
// Zusätzlich exportierte Helfer (für Tests / Wiederverwendung):
//   colorFromName, hashString, DEFAULT_READ_COLOR, COLOR_PALETTE
import type { ScreenplayDocument } from "./screenplayTransmuter";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine Figur-Zuweisung: Sprecher und zugehörige Farbe. */
export interface RoleEntry {
  /** Figurenname (normalisiert, i. d. R. GROSSBUCHSTABEN). */
  character: string;
  /** Sprecher, der die Figur liest. */
  speaker: string;
  /** Deterministische Hex-Farbe (`#RRGGBB`) für die Figur. */
  color: string;
}

/** Ergebnis der Rollenverteilung. */
export interface RoleAssignment {
  assignments: RoleEntry[];
}

/** Eine Zeile des linearen Sprech-Skripts. */
export interface TableReadLine {
  /** Fortlaufender Index ab 0. */
  index: number;
  /** Zeilenart: Szenenüberschrift, Action/Regieanweisung oder Dialog. */
  kind: "scene" | "action" | "dialogue";
  /** Figurenname (nur bei Dialog). */
  character?: string;
  /** Sprecher (nur bei Dialog). */
  speaker?: string;
  /** Farbe der Figur (nur bei Dialog). */
  color?: string;
  /** Text der Zeile (bei reinen Regieanweisungen ggf. leer). */
  text: string;
  /** Regieanweisung ohne Klammern (nur an der ersten Zeile eines Blocks). */
  parenthetical?: string;
  /** True bei Szenenwechsel (Szenenüberschrift INT./EXT.). */
  isSceneChange: boolean;
}

/** Das vollständige Sprech-Skript. */
export interface TableReadScript {
  lines: TableReadLine[];
  sceneCount: number;
  characterCount: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Kuratierte Farbpalette mit gut unterscheidbaren, lesbaren Tönen. */
export const COLOR_PALETTE: readonly string[] = [
  "#E6194B",
  "#3CB44B",
  "#FFE119",
  "#4363D8",
  "#F58231",
  "#911EB4",
  "#46F0F0",
  "#F032E6",
  "#BCF60C",
  "#FABEBE",
  "#008080",
  "#E6BEFF",
  "#9A6324",
  "#FFFAC8",
  "#800000",
  "#AAFFC3",
];

/** Fallback-Farbe, falls kein Name ableitbar ist. */
export const DEFAULT_READ_COLOR = COLOR_PALETTE[3];

/** Schlüssel für unbekannte Figuren. */
const UNKNOWN_CHARACTER = "UNBEKANNT";

// ---------------------------------------------------------------------------
// Farbe (deterministisch aus dem Namen)
// ---------------------------------------------------------------------------

/**
 * Normalisiert einen Figurennamen zum stabilen Hash-Schlüssel.
 * Trimmt und vereinheitlicht die Groß-/Kleinschreibung.
 */
function normalizeCharacterKey(name: string): string {
  return String(name ?? "").trim().toUpperCase();
}

/**
 * 32-Bit-FNV-1a-Hash. Deterministisch und plattformunabhängig.
 * Liefert einen vorzeichenlosen Integer in [0, 2^32).
 */
export function hashString(input: string): number {
  const s = typeof input === "string" ? input : "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Leitet eine stabile Hex-Farbe aus einem Figurennamen ab.
 * Case-insensitiv; leerer Name fällt auf `UNBEKANNT` zurück.
 */
export function colorFromName(name: string): string {
  const key = normalizeCharacterKey(name) || UNKNOWN_CHARACTER;
  const h = hashString(key);
  const color = COLOR_PALETTE[h % COLOR_PALETTE.length];
  return color ?? DEFAULT_READ_COLOR;
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Sammelt eindeutige Figurennamen in Erscheinungsreihenfolge. */
function collectCharacters(doc: ScreenplayDocument | null | undefined): string[] {
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const scene of scenes) {
    const dialogue = Array.isArray(scene?.dialogue) ? scene.dialogue : [];
    for (const block of dialogue) {
      const raw = String(block?.character ?? "").trim();
      if (!raw) continue;
      const key = normalizeCharacterKey(raw);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
    }
  }
  return out;
}

/** Bereinigt die Sprecherliste: trimmen, leere Einträge entfernen. */
function cleanSpeakers(speakers: string[] | null | undefined): string[] {
  if (!Array.isArray(speakers)) return [];
  return speakers.map((s) => String(s ?? "").trim()).filter((s) => s.length > 0);
}

/** Baut eine Nachschlagetabelle Figur -> { speaker, color } aus der Zuweisung. */
function roleIndex(roles: RoleAssignment | null | undefined): Map<string, RoleEntry> {
  const map = new Map<string, RoleEntry>();
  const assignments = Array.isArray(roles?.assignments) ? roles!.assignments : [];
  for (const entry of assignments) {
    const raw = String(entry?.character ?? "").trim();
    if (!raw) continue;
    const key = normalizeCharacterKey(raw);
    if (map.has(key)) continue;
    map.set(key, {
      character: raw,
      speaker: String(entry?.speaker ?? "").trim() || raw,
      color: String(entry?.color ?? "").trim() || colorFromName(raw),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Rollenverteilung
// ---------------------------------------------------------------------------

/**
 * Weist jeder Figur eine Farbe und einen Sprecher zu.
 *
 * - Figuren werden in Erscheinungsreihenfolge erfasst (eindeutig).
 * - Sprecher werden round-robin verteilt; bei mehr Figuren als Sprechern
 *   beginnt die Liste von vorn.
 * - Ohne Sprecher liest die Figur sich selbst (Sprecher = Figurenname).
 * - Farben sind deterministisch aus dem Figurennamen abgeleitet.
 */
export function assignRoles(
  doc: ScreenplayDocument | null | undefined,
  speakers: string[] | null | undefined,
): RoleAssignment {
  const characters = collectCharacters(doc);
  if (characters.length === 0) return { assignments: [] };

  const pool = cleanSpeakers(speakers);
  const assignments: RoleEntry[] = characters.map((character, i) => ({
    character,
    speaker: pool.length > 0 ? pool[i % pool.length] : character,
    color: colorFromName(character),
  }));

  return { assignments };
}

// ---------------------------------------------------------------------------
// Sprech-Skript
// ---------------------------------------------------------------------------

/**
 * Baut ein lineares Sprech-Skript mit fortlaufenden Indizes.
 *
 * Pro Szene:
 *   - eine Szenenzeile (kind "scene", isSceneChange true)
 *   - Action-Zeilen (kind "action")
 *   - Dialogzeilen (kind "dialogue") mit Figur, Sprecher und Farbe
 *
 * Das Parenthetical steht nur an der ersten Zeile eines Dialogblocks.
 * Fehlt eine Rollenzuweisung, wird defensiv auf Figurenname + Farbe
 * aus dem Namen zurückgegriffen.
 */
export function buildTableReadScript(
  doc: ScreenplayDocument | null | undefined,
  roles: RoleAssignment | null | undefined,
): TableReadScript {
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
  const index = roleIndex(roles);
  const lines: TableReadLine[] = [];
  const seenCharacters = new Set<string>();
  let sceneCount = 0;

  const push = (line: Omit<TableReadLine, "index">): void => {
    lines.push({ index: lines.length, ...line });
  };

  for (const scene of scenes) {
    const slug = String(scene?.slugline ?? "").trim();
    push({ kind: "scene", text: slug, isSceneChange: true });
    sceneCount++;

    for (const raw of Array.isArray(scene?.action) ? scene.action : []) {
      const a = String(raw ?? "").trim();
      if (a) push({ kind: "action", text: a, isSceneChange: false });
    }

    for (const block of Array.isArray(scene?.dialogue) ? scene.dialogue : []) {
      const character = String(block?.character ?? "").trim();
      if (!character) continue;
      const key = normalizeCharacterKey(character);
      seenCharacters.add(key);

      const entry = index.get(key);
      const speaker = entry?.speaker ?? character;
      const color = entry?.color ?? colorFromName(character);
      const parenthetical = String(block?.parenthetical ?? "").trim();
      const body = Array.isArray(block?.lines) ? block.lines : [];

      const emitted = body
        .map((l) => String(l ?? "").trim())
        .filter((l) => l.length > 0);

      if (emitted.length === 0) {
        // Reine Regieanweisung ohne Sprechtext: dennoch als Zeile führen.
        if (parenthetical) {
          push({
            kind: "dialogue",
            character,
            speaker,
            color,
            text: "",
            parenthetical,
            isSceneChange: false,
          });
        }
        continue;
      }

      emitted.forEach((text, i) => {
        push({
          kind: "dialogue",
          character,
          speaker,
          color,
          text,
          ...(i === 0 && parenthetical ? { parenthetical } : {}),
          isSceneChange: false,
        });
      });
    }
  }

  return {
    lines,
    sceneCount,
    characterCount: seenCharacters.size,
  };
}

// ---------------------------------------------------------------------------
// Abfragen
// ---------------------------------------------------------------------------

/** Liefert die Dialogzeile am Index oder null (Nicht-Dialog / out of range). */
export function getCurrentSpeaker(
  script: TableReadScript | null | undefined,
  index: number,
): TableReadLine | null {
  const lines = Array.isArray(script?.lines) ? script!.lines : [];
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return null;
  const line = lines[index];
  if (!line || line.kind !== "dialogue") return null;
  return line;
}

/** True, wenn am Index ein Szenenwechsel-Cue steht (Szenenüberschrift). */
export function getSceneChangeCue(
  script: TableReadScript | null | undefined,
  index: number,
): boolean {
  const lines = Array.isArray(script?.lines) ? script!.lines : [];
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return false;
  return lines[index]?.isSceneChange === true;
}

// ---------------------------------------------------------------------------
// Regie-Markup
// ---------------------------------------------------------------------------

/**
 * Formatiert eine Zeile als Regie-Markup.
 *
 *   - Szenenüberschrift: `### INT. KÜCHE - TAG ###`
 *   - Action:            `*Mara steht am Herd.*`
 *   - Dialog:            `Sprecher (als FIGUR) [[REGIE: flüsternd]]: Text`
 *     (Sprecher == Figur: nur `FIGUR: Text`; ohne Parenthetical: ohne Regie-Zusatz)
 */
export function formatDirectorMarkup(line: TableReadLine | null | undefined): string {
  if (!line || typeof line !== "object") return "";
  const text = String(line.text ?? "").trim();

  if (line.kind === "scene") return `### ${text} ###`;
  if (line.kind === "action") return `*${text}*`;

  const character = String(line.character ?? "").trim();
  const speaker = String(line.speaker ?? "").trim();
  const parenthetical = String(line.parenthetical ?? "").trim();

  let label: string;
  if (speaker && character && speaker !== character) {
    label = `${speaker} (als ${character})`;
  } else {
    label = speaker || character;
  }

  const cue = parenthetical ? ` [[REGIE: ${parenthetical}]]` : "";
  return label ? `${label}${cue}: ${text}` : `${cue ? cue.replace(/^ /, "") : ""}${text}`;
}
