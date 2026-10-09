// Chiffrier-Drehscheibe & Cardan-Gitter — Requisiten-Studio (WP 129.2).
//
// Rein lokale, deterministische Werkstatt für Spionagerequisiten aus Papier:
//   - Konzentrische Chiffrier-Drehscheibe (konzentrische Ringe + Mittelloch
//     für eine Messingklammer) als druckfertiges SVG.
//   - Cardan-Gitter-Lochmaske: Löcher auf einem Raster, die über den Text
//     gelegt die geheime Botschaft freilegen.
//   - Bastel-Anleitung mit Schnittmarken, Falzlinien und Lösungsschlüssel.
//
// Grundsätze:
// - KEIN LLM-Aufruf, kein Netzwerk, keine Zufalls-/Zeit-abhängigen IDs.
//   Gleiche Eingabe + gleicher Seed ⇒ gleiche Ausgabe (Snapshot-/Diff-fähig).
// - Nur browserkompatible Sprache: kein `node:`-Modul.
// - Deterministisch über FNV-1a (hashString) + mulberry32 (createSeededRandom).
// - SVGs enthalten AUSSCHLIESSLICH CSS-Variablen (var(--…)), nie Hex-Farben.

// ---------------------------------------------------------------------------
// Hash & Zufall
// ---------------------------------------------------------------------------

/**
 * FNV-1a Hash eines Strings. Liefert einen unsigned 32-bit Wert.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 Pseudo-Zufallszahlengenerator. Liefert Werte in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function (): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wählt ein zufälliges Element aus einem Array. Wirft bei leerem Array.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick(): leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Standard-Alphabet der Drehscheibe (deutsche Großbuchstaben inkl. Umlaute). */
export const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ";

/** Escaped kritische Zeichen für die Einbettung in SVG-Textknoten/Attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Formatiert eine Zahl kompakt (max. zwei Nachkommastellen). */
function fmt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return (Math.round(value * 100) / 100).toString();
}

/** Begrenzt einen optionalen Wert auf einen ganzzahligen Bereich. */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  return Math.max(min, Math.min(max, floored));
}

/** Liefert eine deterministisch gemischte Kopie eines Arrays (Fisher-Yates). */
function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// ---------------------------------------------------------------------------
// 1. Konzentrische Chiffrier-Drehscheibe
// ---------------------------------------------------------------------------

/** Eingabe für {@link buildCipherWheel}. */
export interface CipherWheelInput {
  /** Zeichenvorrat der Ringe (Default: {@link DEFAULT_ALPHABET}). */
  alphabet?: string;
  /** Anzahl konzentrischer Ringe (Default deterministisch 2–3, max. 6). */
  ringCount?: number;
  /** Verschiebung des äußeren Rings in Buchstaben (Default 0). */
  offset?: number;
}

/** Ein einzelner Ring der Drehscheibe. */
export interface CipherRing {
  /** Ringindex, 0 = äußerer Ring. */
  index: number;
  /** Alphabet des Rings (gegenüber dem Grundalphabet verschoben). */
  alphabet: string;
  /** Drehung in Grad gegenüber der Markierung. */
  rotation: number;
}

/** Ergebnis von {@link buildCipherWheel}. */
export interface CipherWheel {
  rings: CipherRing[];
  ringCount: number;
  /** Radius des Mittellochs für die Messingklammer. */
  centerHoleRadius: number;
  /** Vollständiges, druckfertiges SVG. */
  svg: string;
}

/** Baut das vollständige SVG einer Chiffrier-Drehscheibe. */
function buildWheelSvg(rings: CipherRing[], centerHoleRadius: number): string {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const outer = 196;
  const ringCount = Math.max(1, rings.length);
  const step = Math.min(34, (outer - 44) / ringCount);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Chiffrier-Drehscheibe">`,
  );
  parts.push(`  <title>Chiffrier-Drehscheibe</title>`);
  parts.push(
    `  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(outer)}" fill="none" stroke="var(--border-strong)" stroke-width="2"/>`,
  );

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const circleR = outer - i * step;
    const letterR = circleR - step / 2;
    parts.push(
      `  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(circleR)}" fill="none" stroke="var(--border)" stroke-width="1"/>`,
    );
    const letters = ring.alphabet.split("");
    const n = Math.max(1, letters.length);
    const angleStep = 360 / n;
    const fontSize = Math.max(7, Math.round(step * 0.5));
    for (let j = 0; j < letters.length; j++) {
      const angle = j * angleStep + ring.rotation - 90;
      const xform = `translate(${fmt(cx)} ${fmt(cy)}) rotate(${fmt(angle)}) translate(0 ${fmt(-letterR)})`;
      parts.push(
        `  <text transform="${xform}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" style="fill: var(--fg)">${escapeXml(letters[j])}</text>`,
      );
    }
  }

  // Zeiger / Markierung am oberen Rand.
  parts.push(
    `  <polygon points="${fmt(cx - 8)},12 ${fmt(cx + 8)},12 ${fmt(cx)},34" style="fill: var(--accent)"/>`,
  );
  // Mittelloch für die Messingklammer.
  parts.push(
    `  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(centerHoleRadius)}" fill="var(--bg)" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 3"/>`,
  );
  parts.push(`  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="2" style="fill: var(--muted)"/>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

/**
 * Baut eine konzentrische Chiffrier-Drehscheibe. Jeder Ring ist eine
 * Caesar-Verschiebung des Grundalphabets; der äußere Ring folgt `offset`.
 * Deterministisch bei gleichem Seed.
 */
export function buildCipherWheel(input: CipherWheelInput = {}, seed: number): CipherWheel {
  const src = input ?? {};
  const rng = createSeededRandom(seed >>> 0);

  const alphabet =
    typeof src.alphabet === "string" && src.alphabet.length >= 2 ? src.alphabet : DEFAULT_ALPHABET;

  let ringCount: number;
  if (typeof src.ringCount === "number" && Number.isFinite(src.ringCount)) {
    ringCount = clampInt(src.ringCount, 3, 2, 6);
  } else {
    // Default deterministisch: 2 oder 3 konzentrische Ringe.
    ringCount = 2 + Math.floor(rng() * 2);
  }

  const offset = clampInt(src.offset, 0, 0, alphabet.length - 1);
  const centerHoleRadius = 12 + Math.floor(rng() * 5);
  const angleStep = 360 / alphabet.length;

  const rings: CipherRing[] = [];
  for (let i = 0; i < ringCount; i++) {
    const shift =
      i === 0 ? ((offset % alphabet.length) + alphabet.length) % alphabet.length : Math.floor(rng() * alphabet.length);
    const rotated = alphabet.slice(shift) + alphabet.slice(0, shift);
    rings.push({
      index: i,
      alphabet: rotated,
      rotation: shift * angleStep,
    });
  }

  return {
    rings,
    ringCount,
    centerHoleRadius,
    svg: buildWheelSvg(rings, centerHoleRadius),
  };
}

// ---------------------------------------------------------------------------
// 2. Cardan-Gitter-Lochmaske
// ---------------------------------------------------------------------------

/** Eingabe für {@link buildCardanGrille}. */
export interface CardanGrilleInput {
  /** Cover-Text, der in das Raster gelegt wird. */
  text: string;
  /** Geheime Botschaft, die durch die Löcher sichtbar wird. */
  message: string;
  /** Rasterkantenlänge (Default aus der Textlänge abgeleitet). */
  gridSize?: number;
}

/** Ein Loch im Gitter (1-basierte Zeile/Spalte). */
export interface CardanHole {
  row: number;
  col: number;
}

/** Ergebnis von {@link buildCardanGrille}. */
export interface CardanGrille {
  gridSize: number;
  holes: CardanHole[];
  /** Vollständiges SVG der Lochmaske. */
  maskSvg: string;
  /** Text, den die Löcher tatsächlich freilegen. */
  revealText: string;
  /** Lesbare Koordinaten der Löcher, z. B. "R2C5". */
  coordinates: string[];
}

/** Baut das vollständige SVG einer Cardan-Gitter-Lochmaske. */
function buildMaskSvg(gridSize: number, holes: CardanHole[]): string {
  const cell = 30;
  const pad = 12;
  const dim = gridSize * cell + pad * 2;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="Cardan-Gitter-Lochmaske">`,
  );
  parts.push(`  <title>Cardan-Gitter-Lochmaske</title>`);
  parts.push(
    `  <rect x="0" y="0" width="${dim}" height="${dim}" fill="var(--panel-2)" stroke="var(--border-strong)" stroke-width="1.5"/>`,
  );

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = pad + c * cell;
      const y = pad + r * cell;
      parts.push(
        `  <rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="var(--border)" stroke-width="0.5"/>`,
      );
    }
  }

  for (const hole of holes) {
    const x = pad + (hole.col - 1) * cell + cell / 2;
    const y = pad + (hole.row - 1) * cell + cell / 2;
    parts.push(
      `  <circle cx="${x}" cy="${y}" r="${fmt(cell * 0.32)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`,
    );
    parts.push(`  <circle cx="${x}" cy="${y}" r="2.5" style="fill: var(--accent)"/>`);
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

/**
 * Legt den Cover-Text in ein Raster und stanzt Löcher, die — über den Text
 * gelegt — die geheime Botschaft freilegen. Die Suche läuft zeilenweise
 * vorwärts; exakte Treffer haben Vorrang, sonst wird ohne Groß-/Klein-
 * schreibung gesucht. Deterministisch bei gleichem Seed.
 */
export function buildCardanGrille(input: CardanGrilleInput, _seed: number): CardanGrille {
  const src = input ?? ({} as CardanGrilleInput);
  const text = typeof src.text === "string" ? src.text : "";
  const message = typeof src.message === "string" ? src.message : "";

  const defaultGrid = Math.max(
    4,
    Math.min(16, Math.ceil(Math.sqrt(Math.max(text.length, message.length, 1)))),
  );
  const gridSize = clampInt(src.gridSize, defaultGrid, 3, 16);

  const total = gridSize * gridSize;
  const rawChars = text.split("");
  const cells: string[] = [];
  for (let i = 0; i < total; i++) {
    cells.push(rawChars[i] ?? " ");
  }

  const holes: CardanHole[] = [];
  const revealed: string[] = [];
  let cursor = 0;

  for (let m = 0; m < message.length; m++) {
    const wanted = message[m];
    let found = -1;

    for (let k = cursor; k < cells.length; k++) {
      if (cells[k] === wanted) {
        found = k;
        break;
      }
    }
    if (found === -1) {
      const lower = wanted.toLowerCase();
      for (let k = cursor; k < cells.length; k++) {
        if (cells[k].toLowerCase() === lower) {
          found = k;
          break;
        }
      }
    }
    if (found === -1) {
      found = Math.min(cursor, cells.length - 1);
    }

    cursor = found + 1;
    const row = Math.floor(found / gridSize);
    const col = found % gridSize;
    holes.push({ row: row + 1, col: col + 1 });
    revealed.push(cells[found]);
  }

  return {
    gridSize,
    holes,
    maskSvg: buildMaskSvg(gridSize, holes),
    revealText: revealed.join(""),
    coordinates: holes.map((h) => `R${h.row}C${h.col}`),
  };
}

// ---------------------------------------------------------------------------
// 3. Bastel-Anleitung mit Schnittmarken
// ---------------------------------------------------------------------------

/** Eine Schnittmarke auf dem Bastelbogen. */
export interface CutMark {
  x: number;
  y: number;
  label: string;
}

/** Ergebnis von {@link buildAssemblyInstructions}. */
export interface AssemblyInstructions {
  steps: string[];
  cutMarks: CutMark[];
  /** Lösungsschlüssel (Grundstellung der Ringe). */
  solutionKey: string;
  /** Vollständiges SVG des Bastelbogens. */
  svg: string;
}

/** Vorlagen für die Bastelschritte. */
const STEP_TEMPLATES: readonly string[] = [
  "Drucke die Vorlage auf festem Karton (mindestens 200 g/m²) aus.",
  "Schneide die beiden Chiffrier-Ringe entlang der gestrichelten Schnittmarken aus.",
  "Stich mit einer Nadel ein Loch in die Mitte jeder Scheibe.",
  "Verbinde die Scheiben mit einer Messingklammer zu einer drehbaren Chiffrierscheibe.",
  "Schneide das Cardan-Gitter an der Außenkante sauber aus.",
  "Stanze die markierten Löcher des Gitters mit einer Lochzange aus.",
  "Lege das Cardan-Gitter deckungsgleich über die Textvorlage.",
  "Drehe den äußeren Ring, bis der vereinbarte Buchstabe unter der Markierung steht.",
  "Prüfe die Grundstellung mit dem Lösungsschlüssel und notiere sie getrennt.",
];

/** Vorlagen für die Schnittmarken-Beschriftungen. */
const CUT_LABEL_TEMPLATES: readonly string[] = [
  "Schnitt",
  "Falz",
  "Lochung",
  "Klebelasche",
  "Markierung",
  "Stanzung",
];

/** Baut das vollständige SVG des Bastelbogens. */
function buildInstructionSvg(cutMarks: CutMark[]): string {
  const w = 400;
  const h = 300;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Bastel-Anleitung">`,
  );
  parts.push(`  <title>Bastel-Anleitung mit Schnittmarken</title>`);
  parts.push(
    `  <rect x="0" y="0" width="${w}" height="${h}" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="1.5"/>`,
  );
  // Falzlinie in der Mitte.
  parts.push(
    `  <line x1="${w / 2}" y1="10" x2="${w / 2}" y2="${h - 10}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="6 4"/>`,
  );
  // Drehscheibe (oben links).
  parts.push(`  <circle cx="110" cy="120" r="80" fill="none" stroke="var(--fg)" stroke-width="1.5"/>`);
  parts.push(`  <circle cx="110" cy="120" r="52" fill="none" stroke="var(--fg)" stroke-width="1.5"/>`);
  parts.push(`  <circle cx="110" cy="120" r="8" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>`);
  // Cardan-Gitter (unten rechts).
  parts.push(`  <rect x="220" y="150" width="140" height="120" fill="none" stroke="var(--fg)" stroke-width="1.5"/>`);
  parts.push(
    `  <line x1="255" y1="150" x2="255" y2="270" stroke="var(--border)" stroke-width="0.5"/>`,
  );
  parts.push(
    `  <line x1="290" y1="150" x2="290" y2="270" stroke="var(--border)" stroke-width="0.5"/>`,
  );
  // Schnittmarken als Fadenkreuze mit Beschriftung.
  for (const mark of cutMarks) {
    parts.push(
      `  <line x1="${fmt(mark.x - 5)}" y1="${fmt(mark.y)}" x2="${fmt(mark.x + 5)}" y2="${fmt(mark.y)}" style="stroke: var(--accent)" stroke-width="2"/>`,
    );
    parts.push(
      `  <line x1="${fmt(mark.x)}" y1="${fmt(mark.y - 5)}" x2="${fmt(mark.x)}" y2="${fmt(mark.y + 5)}" style="stroke: var(--accent)" stroke-width="2"/>`,
    );
    parts.push(
      `  <text x="${fmt(mark.x + 8)}" y="${fmt(mark.y - 6)}" font-size="9" style="fill: var(--muted)">${escapeXml(mark.label)}</text>`,
    );
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}

/**
 * Erstellt eine Bastel-Anleitung mit Schnittmarken, Lösungsschlüssel und
 * druckfertigem SVG. Deterministisch bei gleichem Seed.
 */
export function buildAssemblyInstructions(seed: number): AssemblyInstructions {
  const rng = createSeededRandom(seed >>> 0);

  const stepCount = 6 + Math.floor(rng() * 3);
  const steps = shuffled(STEP_TEMPLATES, rng).slice(0, Math.min(stepCount, STEP_TEMPLATES.length));

  const markCount = 4 + Math.floor(rng() * 3);
  const cutMarks: CutMark[] = [];
  for (let i = 0; i < markCount; i++) {
    const x = 40 + Math.floor(rng() * 320);
    const y = 40 + Math.floor(rng() * 220);
    const label = pick(CUT_LABEL_TEMPLATES, rng);
    cutMarks.push({ x, y, label });
  }

  const alphabet = DEFAULT_ALPHABET.split("");
  const startLetter = pick(alphabet, rng);
  const innerOffset = 1 + Math.floor(rng() * Math.max(1, alphabet.length - 1));
  const solutionKey = `Schlüssel: Der äußere Ring beginnt bei „${startLetter}“, der innere Ring ist um ${innerOffset} Stellen versetzt.`;

  return {
    steps,
    cutMarks,
    solutionKey,
    svg: buildInstructionSvg(cutMarks),
  };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/** Erzeugt eine Beispiel-Chiffrier-Drehscheibe (3 Ringe, Grundalphabet). */
export function createSampleCipherWheel(): CipherWheel {
  return buildCipherWheel({ alphabet: DEFAULT_ALPHABET, ringCount: 3, offset: 0 }, 1292);
}

/** Erzeugt eine Beispiel-Cardan-Gitter-Lochmaske mit der Botschaft „KARTE“. */
export function createSampleCardanGrille(): CardanGrille {
  const text = "DIE ALTE KARTE LIEGT VERBORGEN UNTER DEM LOSEN BRETT IM KAMINSTOCK";
  const message = "KARTE";
  return buildCardanGrille({ text, message, gridSize: 8 }, 1292);
}
