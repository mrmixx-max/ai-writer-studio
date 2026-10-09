// ErgodicFootnoteLabyrinth (WP 124.2, Meilenstein 60.0 / v7.2.0)
//
// Ein ergodisches Fußnoten-Labyrinth für experimentelle Fiktion. Das Werkzeug
// erzeugt einen rekursiven Fußnoten-Baum (Fußnoten in Fußnoten: 1 → 1a → 1a.i),
// bevölkert ihn mit fiktiven Kommentatoren-Stimmen und leitet daraus
// nicht-lineare Lese-Pfade ab (Hüpfkästchen-Stil: Sprungmarken statt Sequenz).
//
// Design-Regeln (analog zu mobiusPlotTopology / leitmotifNetwork):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Keine Node-Module: reine Browser-Kompatibilität.
//   - Eingaben werden nie mutiert; jede Transformation liefert neue Knoten.
//   - Identischer Seed ⇒ identische Ausgabe (FNV-1a + mulberry32).
//
// Nummerierungs-Schema der Fußnoten:
//   Ebene 1: "1", "2", …            (arabische Ziffern)
//   Ebene 2: "1a", "1b", …          (Ziffer + Buchstabe)
//   Ebene 3: "1a.i", "1a.ii", …     (Ziffer + Buchstabe + römische Ziffer)
//   Ebene ≥4: "1a.i(1)", …          (fortlaufende Klammer-Indizes)

// ---------------------------------------------------------------------------
// Deterministische Zufalls-Basis (FNV-1a + mulberry32)
// ---------------------------------------------------------------------------

/** FNV-1a-Hash. Liefert eine vorzeichenlose 32-Bit-Ganzzahl. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32-PRNG. Liefert einen Generator, der Werte in [0, 1) erzeugt. */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wählt deterministisch ein Element aus `arr`. Wirft bei leerem Array. */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("pick: leeres Array");
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Ein Knoten des Fußnoten-Labyrinths. */
export interface FootnoteNode {
  /** Eindeutige, aus dem Nummerierungs-Schema abgeleitete ID. */
  id: string;
  /** Anzeige-Label ("1", "1a", "1a.i", …). */
  label: string;
  /** Der Fußnoten-Text selbst (deutsch, experimentell). */
  content: string;
  /** Verschachtelte Unter-Fußnoten (Fußnoten in Fußnoten). */
  children: FootnoteNode[];
  /** Zugewiesene Kommentatoren-Stimme (optional). */
  commentator?: string;
}

/** Eine fiktive Kommentatoren-Stimme. */
export interface Commentator {
  /** Kurz-ID ("librarian", "psychiatrist", "editor", "ghost"). */
  id: string;
  /** Anzeigename. */
  name: string;
  /** Beschreibung der Rolle/Haltung. */
  description: string;
  /** Beschreibung des Tons der Stimme. */
  tone: string;
}

/** Ein nicht-linearer Lese-Pfad (Sprungmarken im Hüpfkästchen-Stil). */
export interface ReadingPath {
  /** Eindeutige Pfad-ID. */
  id: string;
  /** Anzeige-Titel des Pfads. */
  label: string;
  /** Erläuterung, wie der Pfad das Labyrinth durchquert. */
  description: string;
  /** Abfolge der Sprungziele (Fußnoten-Labels). */
  steps: string[];
}

// ---------------------------------------------------------------------------
// Fiktive Kommentatoren (WP 124.2)
// ---------------------------------------------------------------------------

/** Die vier Stimmen, die das Labyrinth kommentieren. */
export const COMMENTATORS = [
  {
    id: "librarian",
    name: "Der paranoide Bibliothekar",
    description:
      "Ein Archivar, der überzeugt ist, jede Fußnote sei ein Codewort und das gesamte Labyrinth ein Verschlüsselungsapparat.",
    tone: "misstrauisch, katalogisierend, in Klammern flüsternd",
  },
  {
    id: "psychiatrist",
    name: "Der zensierende Psychiater",
    description:
      "Ein Gutachter, der jede Fußnote als Symptom liest und alles streicht, was die Diagnose des Verfassers bestätigen könnte.",
    tone: "klinisch, beschwichtigend, redigierend",
  },
  {
    id: "editor",
    name: "Der skeptische Lektor",
    description:
      "Ein Verlagslektor, der den Fußnotenapparat für Selbstsabotage hält und zur Straffung drängt, ohne je zu kürzen.",
    tone: "trocken, fordernd, mit rotem Stift",
  },
  {
    id: "ghost",
    name: "Der unheimliche Geist",
    description:
      "Eine Stimme ohne Ursprung, die aus der Tiefe des Apparats spricht und Fußnoten schreibt, bevor sie gedacht wurden.",
    tone: "flüsternd, zeitlos, orthographisch unzuverlässig",
  },
] as const;

/** Gültiger Kommentatoren-ID-Typ. */
export type CommentatorId = (typeof COMMENTATORS)[number]["id"];

// ---------------------------------------------------------------------------
// Hilfsfunktionen (Nummerierung, IDs, Textbausteine)
// ---------------------------------------------------------------------------

/** Römische Ziffer (lowercase) für kleine Werte; Fallback als Zahl. */
function romanNumeral(n: number): string {
  if (n <= 0) return String(n);
  const table: [number, string][] = [
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let rest = n;
  let out = "";
  for (const [value, symbol] of table) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

/** Buchstabe (lowercase) für 1-basierte Indizes (a, b, c, …). */
function letterSegment(n: number): string {
  const idx = ((n - 1) % 26 + 26) % 26;
  const repeat = Math.floor((n - 1) / 26) + 1;
  return String.fromCharCode(97 + idx).repeat(repeat);
}

/**
 * Baut das Label-Segment für einen Kind-Knoten auf der Ziel-Ebene.
 * Ebene 1 → Ziffer, Ebene 2 → Buchstabe, Ebene 3 → römisch, sonst Klammerindex.
 */
function segmentForLevel(targetLevel: number, index: number): string {
  if (targetLevel <= 1) return String(index);
  if (targetLevel === 2) return letterSegment(index);
  if (targetLevel === 3) return romanNumeral(index);
  return `(${index})`;
}

/** Erzeugt eine stabile ID aus den Label-Segmenten. */
function idFromSegments(segments: string[]): string {
  const cleaned = segments.map((s) => s.replace(/[^a-zA-Z0-9]/g, "")).join("-");
  return `fn-${cleaned}`;
}

/**
 * Fügt Label-Segmente zusammen. Ab der dritten Ebene (römische Ziffer) wird
 * ein Punkt vorangestellt, sodass "1" + "a" + "i" zu "1a.i" wird.
 */
function joinLabel(segments: string[]): string {
  let out = "";
  for (let i = 0; i < segments.length; i++) {
    out += i >= 2 ? `.${segments[i]}` : segments[i];
  }
  return out;
}

/** Basis-Textbausteine für Fußnoten (deutsch, experimentell). */
const FOOTNOTE_FRAGMENTS = [
  "Siehe hierzu die Anmerkung, die sich selbst voraussetzt.",
  "Vgl. die gestrichene Passage, die nur in dieser Fußnote überlebt hat.",
  "Der Autor bestreitet, diesen Satz je geschrieben zu haben.",
  "An dieser Stelle wurde eine frühere Version durch eine spätere ersetzt, die es nie gab.",
  "Die Seitenzählung verschiebt sich, sobald man die Fußnote liest.",
  "Man beachte den Widerspruch zur Haupttextstelle, den die Haupttextstelle leugnet.",
  "Die Anmerkung wurde nachträglich eingefügt, um eine Lücke zu schließen, die sie erst schuf.",
  "Der Herausgeber markiert hier ein unleserliches Wort, das im Original deutlich lesbar war.",
  "Fußnoten dieser Art dienen ausschließlich ihrer eigenen Verzweigung.",
  "Der Text verweist auf sich selbst, um den Leser aufzuhalten.",
];

/** Optionale Kommentatoren-Zusätze im Fußnotentext. */
const COMMENTARY_TRAILERS = [
  "— Man vergleiche die Randbemerkung, die fehlt.",
  "— Der Apparat widerspricht hier dem Apparat.",
  "— Diese Notiz wurde zensiert und durch sich selbst ersetzt.",
  "— Achtung: der Verweis führt ins Leere, das Leere führt zurück.",
];

/** Zählt alle Nicht-Wurzel-Knoten eines Labyrinths (Tiefensuche, stabil). */
function collectNodes(root: FootnoteNode): FootnoteNode[] {
  const out: FootnoteNode[] = [];
  const walk = (node: FootnoteNode): void => {
    for (const child of node.children) {
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** Tiefe Klon-Funktion, damit Eingaben nie mutiert werden. */
function cloneNode(node: FootnoteNode): FootnoteNode {
  const copy: FootnoteNode = {
    id: node.id,
    label: node.label,
    content: node.content,
    children: node.children.map(cloneNode),
  };
  if (node.commentator !== undefined) copy.commentator = node.commentator;
  return copy;
}

// ---------------------------------------------------------------------------
// 1. Rekursive Fußnoten-Hierarchie
// ---------------------------------------------------------------------------

/**
 * Erzeugt rekursiv einen Unterbaum. `segments` sind die bereits aufgebauten
 * Label-Segmente des aktuellen Knotens; `level` ist seine Ebene (1-basiert).
 */
function buildSubtree(
  segments: string[],
  level: number,
  maxDepth: number,
  rng: () => number
): FootnoteNode {
  const label = joinLabel(segments);
  const base = pick(FOOTNOTE_FRAGMENTS, rng);
  const useTrailer = rng() < 0.35;
  const content = useTrailer ? `${base} ${pick(COMMENTARY_TRAILERS, rng)}` : base;

  const node: FootnoteNode = {
    id: idFromSegments(segments),
    label,
    content,
    children: [],
  };

  if (level < maxDepth) {
    // Deterministische Kinder-Anzahl: meist 0–3, gelegentlich mehr auf Ebene 1.
    const roll = rng();
    let childCount: number;
    if (level === 1) childCount = Math.floor(roll * 4); // 0..3
    else childCount = Math.floor(roll * 3); // 0..2

    for (let i = 1; i <= childCount; i++) {
      const seg = segmentForLevel(level + 1, i);
      node.children.push(buildSubtree([...segments, seg], level + 1, maxDepth, rng));
    }
  }

  return node;
}

/**
 * Baut ein vollständiges Fußnoten-Labyrinth (Wurzel = Haupttext, Kinder =
 * Fußnoten). `depth` steuert die maximale Verschachtelungstiefe (Default 3 ⇒
 * bis "1a.i"). Deterministisch für gleichen Seed.
 */
export function buildFootnoteLabyrinth(seed: number, depth: number = 3): FootnoteNode {
  const maxDepth = Math.max(1, Math.floor(depth) || 1);
  const rng = createSeededRandom(hashString(`ergodic-labyrinth:${seed}`));

  const root: FootnoteNode = {
    id: "fn-root",
    label: "Manuskript",
    content:
      "Der Haupttext ist nur der Rand einer Fußnote, die ihn umschließt.",
    children: [],
  };

  // Anzahl der Top-Level-Fußnoten: 3–5, deterministisch.
  const topCount = 3 + Math.floor(rng() * 3);
  for (let i = 1; i <= topCount; i++) {
    root.children.push(buildSubtree([String(i)], 1, maxDepth, rng));
  }

  return root;
}

// ---------------------------------------------------------------------------
// 2. Fiktive Kommentatoren zuweisen
// ---------------------------------------------------------------------------

/**
 * Weist jedem Fußnoten-Knoten (außer der Wurzel) deterministisch eine
 * Kommentatoren-Stimme zu. Liefert einen neuen Baum; die Eingabe bleibt
 * unverändert. Knoten ohne Zuweisung erhalten kein `commentator`-Feld.
 */
export function assignCommentators(labyrinth: FootnoteNode, seed: number): FootnoteNode {
  const rng = createSeededRandom(hashString(`commentators:${seed}`));
  const root = cloneNode(labyrinth);

  const walk = (node: FootnoteNode, isRoot: boolean): void => {
    if (!isRoot && rng() < 0.75) {
      const voice = pick(COMMENTATORS as unknown as Commentator[], rng);
      node.commentator = voice.id;
    }
    for (const child of node.children) walk(child, false);
  };

  walk(root, true);
  return root;
}

// ---------------------------------------------------------------------------
// 3. Alternative Lesepfade (Hüpfkästchen-Stil)
// ---------------------------------------------------------------------------

/** Titel-Varianten für die erzeugten Lese-Pfade. */
const PATH_TITLES = [
  "Hüpfkästchen nach innen",
  "Der Rand des Apparats",
  "Rückwärts durch die Anmerkungen",
  "Die gestrichene Route",
  "Spirale um die Haupttextstelle",
];

/** Erläuterungen für die erzeugten Lese-Pfade. */
const PATH_DESCRIPTIONS = [
  "Springt von Fußnote zu Fußnote, ohne je zum Haupttext zurückzukehren.",
  "Folgt ausschließlich den innersten Fußnoten, von außen nach innen.",
  "Liest die Anmerkungen in umgekehrter Reihenfolge ihrer Entstehung.",
  "Verbindet nur Kommentatoren derselben Stimme über alle Ebenen hinweg.",
  "Umkreist die Wurzel und berührt jede Ebene genau einmal.",
];

/**
 * Leitet nicht-lineare Lese-Pfade aus dem Labyrinth ab. Jeder Pfad ist eine
 * Folge von Sprungmarken (Fußnoten-Labels) im Hüpfkästchen-Stil.
 * Deterministisch für gleichen Seed.
 */
export function generateReadingPaths(labyrinth: FootnoteNode, seed: number): ReadingPath[] {
  const nodes = collectNodes(labyrinth);
  const rng = createSeededRandom(hashString(`paths:${seed}`));

  // Kein Baum vorhanden: ein einziger Degenerat-Pfad über die Wurzel.
  if (nodes.length === 0) {
    return [
      {
        id: `path-${hashString(`empty:${seed}`).toString(16).padStart(8, "0")}`,
        label: pick(PATH_TITLES, rng),
        description: "Das Labyrinth ist leer; der Pfad bleibt an der Wurzel stehen.",
        steps: [labyrinth.label],
      },
    ];
  }

  const pathCount = 2 + Math.floor(rng() * 3); // 2..4
  const paths: ReadingPath[] = [];

  for (let p = 0; p < pathCount; p++) {
    const stepCount = 3 + Math.floor(rng() * 4); // 3..6 Sprungmarken
    const steps: string[] = [];
    let cursor = Math.floor(rng() * nodes.length);

    for (let s = 0; s < stepCount; s++) {
      const node = nodes[cursor % nodes.length];
      steps.push(node.label);
      // Nicht-linearer Sprung: deterministischer Offset statt Nachbar.
      const jump = 1 + Math.floor(rng() * nodes.length);
      cursor = (cursor + jump) % nodes.length;
    }

    const label = pick(PATH_TITLES, rng);
    const description = pick(PATH_DESCRIPTIONS, rng);
    paths.push({
      id: `path-${hashString(`${seed}:${p}:${steps.join(">")}`).toString(16).padStart(8, "0")}`,
      label,
      description,
      steps,
    });
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Beispiel-Fabriken
// ---------------------------------------------------------------------------

/** Liefert ein deterministisches Beispiel-Labyrinth (Seed 1242, Tiefe 3). */
export function createSampleFootnoteNode(): FootnoteNode {
  return buildFootnoteLabyrinth(1242, 3);
}

/** Liefert einen deterministischen Beispiel-Lese-Pfad. */
export function createSampleReadingPath(): ReadingPath {
  const labyrinth = assignCommentators(createSampleFootnoteNode(), 1242);
  const paths = generateReadingPaths(labyrinth, 1242);
  return paths[0];
}
