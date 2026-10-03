// Screenplay-Transmuter (WP 38.1): Prosa -> Drehbuch + Final-Draft/Fountain-Export.
//
// Design-Regeln (analog zu readabilityMetrics / manuscriptHealth / publisherExchange):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Dokumente
//     statt zu werfen.
//   - Uneinheitliche Anführungszeichen ("…", „…", »…«, ›…‹, '…', '…') werden
//     zuverlässig erkannt und zu geraden "…" normalisiert.
//
// Öffentliche API:
//   proseToScreenplay(text)   — Prosa -> ScreenplayDocument
//   exportToFdx(doc)          — ScreenplayDocument -> Final Draft (.fdx)
//   exportToFountain(doc)     — ScreenplayDocument -> Fountain
//
// Zusätzlich exportierte Helfer (für Tests / Wiederverwendung):
//   normalizeQuotes, normalizeSlugline, isSlugline, splitIntoBlocks,
//   emptyDocument

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein einzelner Dialogblock (Figur + optionaler Parenthetical + Zeilen). */
export interface DialogueBlock {
  /** Figurenname (bereits normalisiert, i. d. R. GROSSBUCHSTABEN). */
  character: string;
  /** Regieanweisung ohne Klammern, z. B. "flüsternd". */
  parenthetical?: string;
  /** Gesprochene Zeilen (kann bei reinen Regieanweisungen leer sein). */
  lines: string[];
}

/** Eine Szene mit Slugline, Action-Zeilen und Dialogblöcken. */
export interface ScreenplayScene {
  /** Szenenüberschrift, z. B. "INT. KÜCHE - TAG". */
  slugline: string;
  /** Handlungsbeschreibung (Action), eine Zeile pro Eintrag. */
  action: string[];
  /** Dialogblöcke der Szene. */
  dialogue: DialogueBlock[];
}

/** Ein vollständiges Drehbuch. */
export interface ScreenplayDocument {
  title: string;
  scenes: ScreenplayScene[];
}

// ---------------------------------------------------------------------------
// Konstanten / Regexe
// ---------------------------------------------------------------------------

/** Zeichen, die als Anführungszeichen gelten (öffnend + schließend, alle Varianten). */
const QUOTE_CHARS = "\"'\u201C\u201D\u201E\u201F\u2018\u2019\u201A\u201B\u00AB\u00BB\u2039\u203A";

/** Paarweise Ersetzung typografischer durch gerade Anführungszeichen. */
const QUOTE_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\u00AB([^\u00AB\u00BB]*)\u00BB/g, "\"$1\""], // « … »
  [/\u2039([^\u2039\u203A]*)\u203A/g, "\"$1\""], // › … ‹
  [/\u201E([^\u201C\u201D]*)\u201C/g, "\"$1\""], // „ … "
  [/\u201E([^\u201C\u201D]*)\u201D/g, "\"$1\""], // „ … " (gemischte Schließung)
  [/\u201C([^\u201C\u201D]*)\u201D/g, "\"$1\""], // " … "
  [/\u201C([^\u201C\u201D]*)\u201C/g, "\"$1\""], // " … " (gleiche Zeichen)
  [/\u201D([^\u201C\u201D]*)\u201D/g, "\"$1\""], // " … "
  [/\u201A([^\u2018\u2019]*)\u2019/g, "\"$1\""], // ‚ … '
  [/\u2018([^\u2018\u2019]*)\u2019/g, "\"$1\""], // ' … '
  [/\u2018([^\u2018\u2019]*)\u2018/g, "\"$1\""], // ' … '
  [/\u2019([^\u2018\u2019]*)\u2019/g, "\"$1\""], // ' … '
  [/\u2039([^\u2039\u203A]*)\u2039/g, "\"$1\""], // › … ›
  [/\u203A([^\u2039\u203A]*)\u203A/g, "\"$1\""], // ‹ … ‹
];

/** Gemeinsames Slugline-Präfix (Int./Ext. und Varianten). */
const SLUG_PREFIX_SRC = "(?:int\\.\\/ext\\.?|int\\/ext|i\\/e|i\\.e|int|ext|est)";
/** Slugline-Präfix am Zeilenanfang, gefolgt von "."/" " (Wortgrenze). */
const SLUG_PREFIX_RE = new RegExp(`^${SLUG_PREFIX_SRC}(?:\\.\\s?|\\s)`, "i");
/** Slugline-Kernform: "INT. ORT - TAG". */
const SLUG_FORM_RE = new RegExp(`^${SLUG_PREFIX_SRC}\\.?\\s+.+?\\s*[-–—]\\s*.+$`, "i");
/** Explizite Szenen-Nummer-Präfixe, z. B. "SZENE 1:", "1.", "12 –". */
const SCENE_NUM_RE = /^(?:szene|scene|#)?\s*\d{1,3}\s*[:.)\-–—]\s*/i;
/** Regieanweisung am Zeilenanfang, optional gefolgt von weiterem Text. */
const PARENTHETICAL_RE = /^\(([^)]*)\)\s*(.*)$/;

/** Schlüsselwörter, die keinen Figurennamen darstellen dürfen. */
const NON_CHARACTER_RE =
  /^(?:int|ext|i\/e|i\.e|est|szene|scene|akt|ende|fin|fade|cut|dissolve|black|title|titel|author|chapter|kapitel|transition|abblende|aufblende|ausblende|schnitt|drehbuch)\b/i;

/** Maximale Wortzahl / Länge eines Figurennamens. */
const MAX_CHARACTER_WORDS = 4;
const MAX_CHARACTER_LEN = 40;

/** Default-Slugline für Szenen ohne erkannte Überschrift. */
const DEFAULT_SLUGLINE = "INT. UNBEKANNT - TAG";

// ---------------------------------------------------------------------------
// Öffentliche Helfer
// ---------------------------------------------------------------------------

/**
 * Normalisiert uneinheitliche Anführungszeichen zu geraden `"…"`.
 * Deterministisch; bereits gerade Anführungszeichen bleiben unverändert.
 */
export function normalizeQuotes(input: string): string {
  if (typeof input !== "string" || input.length === 0) return "";
  let out = input;
  for (const [re, rep] of QUOTE_PAIRS) {
    out = out.replace(re, rep);
  }
  // Verbliebene, unpaarige typografische Anführungszeichen gerade biegen.
  out = out.replace(/[\u201C\u201D\u201E\u201F]/g, "\"");
  out = out.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  out = out.replace(/[\u00AB\u00BB\u2039\u203A]/g, "\"");
  return out;
}

/** Prüft, ob eine Zeile eine Slugline (Szenenüberschrift) ist. */
export function isSlugline(line: string): boolean {
  if (typeof line !== "string") return false;
  let s = normalizeQuotes(stripInlineQuotes(line)).trim();
  s = s.replace(SCENE_NUM_RE, "").trim();
  if (!s) return false;
  if (SLUG_FORM_RE.test(s)) return true;
  // "INT. KÜCHE" ohne Tageszeit gilt ebenfalls als Slugline.
  if (SLUG_PREFIX_RE.test(s) && s.length > 6) return true;
  return false;
}

/**
 * Normalisiert eine Slugline in die kanonische Form `INT./EXT. ORT - TAG/NACHT`.
 * Fehlende Bestandteile werden mit defensiven Defaults ergänzt.
 */
export function normalizeSlugline(raw: string, fallbackTime = "TAG"): string {
  let s = normalizeQuotes(raw).trim();
  s = s.replace(SCENE_NUM_RE, "").trim();
  s = s.replace(/^[.、。]+/, "").trim();
  s = s.replace(/\s+/g, " ");

  const prefixMatch = s.match(SLUG_PREFIX_RE);
  let prefix: string;
  let rest: string;
  if (prefixMatch) {
    const token = prefixMatch[0].trim().toUpperCase();
    if (/^INT\.?\/EXT/i.test(token) || /^I\/E/i.test(token)) {
      prefix = "INT./EXT.";
    } else if (/^EXT/i.test(token) || /^EST/i.test(token) || /^I\.E/i.test(token)) {
      prefix = "EXT.";
    } else {
      prefix = "INT.";
    }
    rest = s.slice(prefixMatch[0].length).trim();
  } else {
    // Kein erkennbares Präfix: defensiv als INT. interpretieren.
    prefix = "INT.";
    rest = s;
  }

  rest = rest.replace(/^[-–—.,\s]+/, "").trim();

  // "ORT - TAG" auftrennen.
  const dashSplit = rest.split(/\s+[-–—]\s+/);
  let place: string;
  let time: string;
  if (dashSplit.length >= 2) {
    place = dashSplit[0].trim();
    time = dashSplit.slice(1).join(" - ").trim();
  } else {
    place = rest;
    time = "";
  }

  // Fallback: Tageszeit ohne Bindestrich innerhalb des Ortes erkennen.
  if (!time) {
    const t = place.match(
      /\b(tag|nacht|morgen|abend|d[äa]mmerung|dawn|day|night|dusk|morning|evening|continuous)\b/i,
    );
    if (t && t.index !== undefined && t.index > 0) {
      time = t[0];
      place = place.slice(0, t.index).trim().replace(/[-–—.,\s]+$/, "");
    }
  }

  place = place.replace(/[-–—.,\s]+$/, "").trim();
  if (!place) place = "UNBEKANNT";
  if (!time) time = fallbackTime;

  return `${prefix} ${place} - ${time}`.toUpperCase();
}

/** Leeres, aber strukturell gültiges Dokument. */
export function emptyDocument(title = "Ohne Titel"): ScreenplayDocument {
  return { title: title && title.trim() ? title.trim() : "Ohne Titel", scenes: [] };
}

/**
 * Zerlegt Text in Absätze anhand von Leerzeilen.
 * Zeilenumbrüche innerhalb eines Absatzes bleiben erhalten.
 */
export function splitIntoBlocks(text: string): string[] {
  if (typeof text !== "string" || text.trim().length === 0) return [];
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((b) => b.replace(/^\n+|\n+$/g, "").trim())
    .filter((b) => b.length > 0);
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Entfernt umschließende Anführungszeichen (gerade/krumm, einfach/doppelt). */
function stripInlineQuotes(line: string): string {
  let s = String(line ?? "").trim();
  const re = new RegExp(`^[${QUOTE_CHARS}]+|[${QUOTE_CHARS}]+$`, "g");
  for (let i = 0; i < 2; i++) {
    const next = s.replace(re, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Name-artig: 1–4 Wörter, jedes beginnt mit Großbuchstabe, keine Ziffern. */
function isNameLike(candidate: string): boolean {
  const c = String(candidate ?? "").trim();
  if (!c || c.length > MAX_CHARACTER_LEN) return false;
  if (NON_CHARACTER_RE.test(c)) return false;
  if (/\d/.test(c)) return false;
  if (!/^[A-Za-zÄÖÜäöüß0-9'.\- ]+$/.test(c)) return false;
  const words = c.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_CHARACTER_WORDS) return false;
  return words.every((w) => /^[A-ZÄÖÜ]/.test(w));
}

/** Figuren-Cue als alleinstehende Großbuchstaben-Zeile (ohne Satzende). */
function isAllCapsCue(candidate: string): boolean {
  const c = String(candidate ?? "").trim();
  if (!isNameLike(c)) return false;
  if (/[a-zäöüß]/.test(c)) return false;
  if (/[.!?…]$/.test(c)) return false;
  return true;
}

interface Cue {
  name: string;
  inlineRest: string;
  kind: "colon" | "caps";
}

/** Erkennt eine Figurenzeile und liefert Name + optionalen Inline-Text. */
function detectCharacterCue(line: string): Cue | null {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;

  const colon = trimmed.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/);
  if (colon) {
    const cand = stripInlineQuotes(colon[1]).replace(/[.!?]+$/, "").trim();
    if (isNameLike(cand)) {
      return { name: cand.toUpperCase(), inlineRest: colon[2].trim(), kind: "colon" };
    }
  }

  const single = trimmed.replace(/\s+/g, " ");
  if (isAllCapsCue(single)) {
    return { name: single.toUpperCase(), inlineRest: "", kind: "caps" };
  }
  return null;
}

/** Baut aus Figurenname + Body-Zeilen einen normalisierten Dialogblock. */
function buildDialogueBlock(character: string, bodyLines: string[]): DialogueBlock {
  const cleaned: string[] = [];
  let parenthetical: string | undefined;
  for (const raw of bodyLines) {
    const line = normalizeQuotes(String(raw ?? "").trim());
    if (!line) continue;
    if (!parenthetical && cleaned.length === 0) {
      const m = line.match(PARENTHETICAL_RE);
      if (m) {
        parenthetical = m[1].trim();
        const rest = m[2].trim();
        if (rest) cleaned.push(stripInlineQuotes(rest));
        continue;
      }
    }
    cleaned.push(stripInlineQuotes(line));
  }
  return { character, ...(parenthetical ? { parenthetical } : {}), lines: cleaned };
}

/** Erzeugt eine leere Szene. */
function makeScene(slugline: string): ScreenplayScene {
  return { slugline, action: [], dialogue: [] };
}

/** Liefert die nächste nicht-leere Zeile ab `start` oder null. */
function findNextNonEmpty(lines: string[], start: number): string | null {
  for (let k = start; k < lines.length; k++) {
    const l = lines[k]?.trim();
    if (l) return l;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kern: Prosa -> Drehbuch
// ---------------------------------------------------------------------------

/**
 * Wandelt Prosa in ein Drehbuch um.
 *
 * Erkennt:
 *   - Sluglines ("INT. KÜCHE - TAG", "EXT. STRAND – NACHT", "1. INT. AUTO - TAG")
 *   - Dialogblöcke ("MARA: ...", „MARA: ...", "MARA\nZeile")
 *   - Regieanweisungen in Klammern
 *   - Action (alles Übrige)
 *
 * Deterministisch, ohne LLM, mit defensiven Fallbacks.
 */
export function proseToScreenplay(text: string): ScreenplayDocument {
  if (typeof text !== "string" || text.trim().length === 0) {
    return emptyDocument("Ohne Titel");
  }

  const normalized = normalizeQuotes(text).replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  let title = "Ohne Titel";
  let titleConsumed = false;
  const scenes: ScreenplayScene[] = [];
  let current: ScreenplayScene | null = null;

  const ensureScene = (): ScreenplayScene => {
    if (!current) {
      current = makeScene(DEFAULT_SLUGLINE);
      scenes.push(current);
    }
    return current;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // --- Titel (einmalig) ------------------------------------------------
    if (!titleConsumed) {
      const explicit = line.match(/^(?:title|titel|drehbuch)\s*:\s*(.*)$/i);
      if (explicit) {
        title = explicit[1].trim() || "Ohne Titel";
        titleConsumed = true;
        i++;
        continue;
      }
      const md = line.match(/^#\s+(.+)$/);
      if (md) {
        title = md[1].trim() || "Ohne Titel";
        titleConsumed = true;
        i++;
        continue;
      }
      titleConsumed = true;
      // Heuristik: kurze Zeile ohne Satzende, auf die eine Slugline folgt.
      if (
        scenes.length === 0 &&
        !current &&
        !isSlugline(line) &&
        !detectCharacterCue(line) &&
        !/[.!?…]$/.test(line) &&
        line.length <= 80
      ) {
        const nxt = findNextNonEmpty(lines, i + 1);
        if (nxt && isSlugline(nxt)) {
          title = stripInlineQuotes(line) || "Ohne Titel";
          i++;
          continue;
        }
      }
    }

    // --- Slugline --------------------------------------------------------
    if (isSlugline(line)) {
      let slugRaw = line;
      const next = lines[i + 1]?.trim() ?? "";
      // Über zwei Zeilen umbrochene Slugline ("INT. KÜCHE" / "- TAG").
      if (!/[-–—]\s*\S/.test(line) && /^[-–—]\s*\S/.test(next)) {
        slugRaw = `${line} ${next}`;
        i++;
      }
      current = makeScene(normalizeSlugline(slugRaw));
      scenes.push(current);
      i++;
      continue;
    }

    // --- Dialogblock -----------------------------------------------------
    const cue = detectCharacterCue(line);
    if (cue) {
      const body: string[] = [];
      if (cue.inlineRest) body.push(cue.inlineRest);
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j].trim();
        if (!l) break;
        if (isSlugline(l)) break;
        if (detectCharacterCue(l)) break;
        body.push(l);
        j++;
      }
      if (body.length > 0) {
        const block = buildDialogueBlock(cue.name, body);
        if (block.lines.length > 0 || block.parenthetical) {
          ensureScene().dialogue.push(block);
          i = j;
          continue;
        }
      }
      // Kein Dialogkörper -> als Action behandeln (Fallthrough).
    }

    // --- Action (ggf. mehrzeiliger Absatz) -------------------------------
    const actionLines: string[] = [line];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j].trim();
      if (!l) break;
      if (isSlugline(l)) break;
      if (detectCharacterCue(l)) break;
      actionLines.push(l);
      j++;
    }
    ensureScene().action.push(...actionLines);
    i = j;
  }

  // Leere Default-Szenen verwerfen (echte Szenen bleiben erhalten).
  const cleaned = scenes.filter(
    (s) => s.action.length > 0 || s.dialogue.length > 0 || s.slugline !== DEFAULT_SLUGLINE,
  );

  return { title: title || "Ohne Titel", scenes: cleaned.length > 0 ? cleaned : scenes };
}

// ---------------------------------------------------------------------------
// Export: Final Draft (.fdx)
// ---------------------------------------------------------------------------

/** XML-escaped einen Text (Elementinhalt). */
function xmlEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Baut einen FDX-Absatz eines gegebenen Typs. */
function fdxParagraph(type: string, text: string): string {
  const content = text ? `<Text>${xmlEscape(text)}</Text>` : "<Text></Text>";
  return `    <Paragraph Type="${type}">\n      ${content}\n    </Paragraph>`;
}

/**
 * Exportiert ein Drehbuch als Final Draft `.fdx` (wohlgeformtes XML).
 * Defensiv bei leeren oder unvollständigen Dokumenten.
 */
export function exportToFdx(doc: ScreenplayDocument): string {
  const title = doc?.title?.trim() || "Ohne Titel";
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];

  const paragraphs: string[] = [];
  paragraphs.push(fdxParagraph("Title", title));

  for (const scene of scenes) {
    const slug = scene?.slugline?.trim() || DEFAULT_SLUGLINE;
    paragraphs.push(fdxParagraph("Scene Heading", slug.toUpperCase()));

    for (const action of Array.isArray(scene?.action) ? scene.action : []) {
      const a = String(action ?? "").trim();
      if (a) paragraphs.push(fdxParagraph("Action", a));
    }

    for (const block of Array.isArray(scene?.dialogue) ? scene.dialogue : []) {
      const character = String(block?.character ?? "").trim();
      if (!character) continue;
      paragraphs.push(fdxParagraph("Character", character.toUpperCase()));

      if (block?.parenthetical) {
        const p = String(block.parenthetical).trim();
        if (p) {
          const withParens = /^\(.*\)$/.test(p) ? p : `(${p})`;
          paragraphs.push(fdxParagraph("Parenthetical", withParens));
        }
      }

      const lines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of lines) {
        paragraphs.push(fdxParagraph("Dialogue", String(line ?? "").trim()));
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${paragraphs.join("\n")}
  </Content>
</FinalDraft>`;
}

// ---------------------------------------------------------------------------
// Export: Fountain
// ---------------------------------------------------------------------------

/**
 * Exportiert ein Drehbuch als Fountain.
 * Sluglines als Szenenüberschriften, Dialogblöcke als "CHARACTER" +
 * optional Parenthetical + Zeilen, Action als normale Absätze.
 */
export function exportToFountain(doc: ScreenplayDocument): string {
  const title = doc?.title?.trim() || "Ohne Titel";
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];

  const out: string[] = [];
  out.push(`Title: ${title}`);
  out.push(`Draft date: ${new Date().toISOString().split("T")[0]}`);
  out.push("");

  for (const scene of scenes) {
    const slug = scene?.slugline?.trim() || DEFAULT_SLUGLINE;
    out.push(slug.toUpperCase());
    out.push("");

    for (const action of Array.isArray(scene?.action) ? scene.action : []) {
      const a = String(action ?? "").trim();
      if (a) {
        out.push(a);
        out.push("");
      }
    }

    for (const block of Array.isArray(scene?.dialogue) ? scene.dialogue : []) {
      const character = String(block?.character ?? "").trim();
      if (!character) continue;
      out.push(character.toUpperCase());

      if (block?.parenthetical) {
        const p = String(block.parenthetical).trim();
        if (p) out.push(/^\(.*\)$/.test(p) ? p : `(${p})`);
      }

      const lines = Array.isArray(block?.lines) ? block.lines : [];
      for (const line of lines) {
        out.push(String(line ?? "").trim());
      }
      out.push("");
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
}
