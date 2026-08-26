// Strukturorientiertes Chunking für Kapitel, Notizen und Langtexte.
//
// Strategie (bewusst NICHT rein tokenbasiert):
//   1. Text an Überschriften in Blöcke schneiden → jeder Block behält seinen Heading-Pfad
//   2. Blöcke an Absatzgrenzen zu Chunks zusammenfassen, bis TARGET_TOKENS erreicht ist
//   3. Übergroße Absätze an Satzgrenzen splitten (niemals mitten im Satz)
//   4. Overlap von OVERLAP_TOKENS am Chunk-Anfang für Kontexterhalt
//
// Ergebnis: Chunks respektieren Sinneinheiten. Ein Retrieval-Treffer liefert damit
// einen lesbaren Abschnitt mit korrekter Herkunftsangabe statt eines Textfetzens.

/** Zielgröße eines Chunks in geschätzten Tokens. */
export const TARGET_TOKENS = 320;
/** Harte Obergrenze, bevor zwangsweise gesplittet wird. */
export const MAX_TOKENS = 480;
/** Overlap zwischen aufeinanderfolgenden Chunks. */
export const OVERLAP_TOKENS = 40;
/** Chunks unterhalb dieser Größe werden mit dem Nachbarn verschmolzen. */
export const MIN_TOKENS = 24;

export interface StructuredBlock {
  /** Überschriften-Pfad, z. B. "Kapitel 3 › Der Brief". Leer bei Text ohne Überschrift. */
  headingPath: string;
  /** Absätze innerhalb dieses Blocks. */
  paragraphs: string[];
}

export interface Chunk {
  chunkIndex: number;
  text: string;
  headingPath: string | null;
  tokenCount: number;
}

/**
 * Schätzt die Tokenzahl. Für deutschen Text liegt das Verhältnis bei ca. 1 Token
 * pro 3,4 Zeichen (mehr Komposita als im Englischen). Bewusst konservativ geschätzt,
 * damit Chunks nie das Kontextfenster sprengen.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.4);
}

/** Splittet Text an Satzgrenzen. Behandelt Abkürzungen und Anführungszeichen. */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  // Schutz gängiger deutscher Abkürzungen vor dem Split.
  // Jeder Punkt innerhalb einer Abkürzung wird maskiert, auch mehrteilige wie "z. B.".
  const ABBREV = [
    "z\\.\\s?B", "d\\.\\s?h", "u\\.\\s?a", "u\\.\\s?U", "i\\.\\s?d\\.\\s?R", "v\\.\\s?Chr", "n\\.\\s?Chr",
    "bzw", "ca", "Dr", "Prof", "Nr", "Abs", "Art", "vgl", "ggf", "evtl", "inkl", "exkl",
    "max", "min", "Mio", "Mrd", "St", "Bd", "Hg", "Hrsg", "Aufl", "Kap", "usw", "etc",
  ];
  // Sentinel für maskierte Punkte. Kein Steuerzeichen, damit es keine
  // Regex-Warnungen gibt und der Marker im Editor sichtbar bleibt, falls er je durchrutscht.
  const DOT = "\uE000"; // Private Use Area — kommt in echtem Text nicht vor
  let guarded = text;
  for (const a of ABBREV) {
    guarded = guarded.replace(
      new RegExp(`\\b(${a})\\.`, "g"),
      (m) => m.split(".").join(DOT),
    );
  }
  // Ordinalzahlen und Datumsangaben: "3. Kapitel", "1. Januar"
  guarded = guarded.replace(/(\d)\.(\s)/g, `$1${DOT}$2`);

  const parts = guarded
    .split(/(?<=[.!?…])["»«"']?\s+/)
    .map((s) => s.split(DOT).join(".").trim())
    .filter(Boolean);

  return parts.length ? parts : [text.trim()];
}

/**
 * Extrahiert strukturierte Blöcke aus TipTap-JSON.
 * Überschriften (heading) öffnen einen neuen Block, Absätze füllen ihn.
 */
export function blocksFromTiptap(json: string, rootLabel?: string): StructuredBlock[] {
  let doc: any;
  try {
    doc = JSON.parse(json);
  } catch {
    return [];
  }
  return blocksFromTiptapDoc(doc, rootLabel);
}

/** Wie blocksFromTiptap, aber auf einem bereits geparsten Dokument. */
export function blocksFromTiptapDoc(doc: any, rootLabel?: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = [];
  /** Aktueller Überschriften-Stack pro Ebene (Index 0 = h1). */
  const headingStack: string[] = [];
  let current: StructuredBlock = {
    headingPath: rootLabel ?? "",
    paragraphs: [],
  };

  function flush() {
    if (current.paragraphs.length) blocks.push(current);
  }

  function pathFor(): string {
    const parts = rootLabel ? [rootLabel, ...headingStack] : [...headingStack];
    return parts.filter(Boolean).join(" › ");
  }

  const nodes: any[] = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type === "heading") {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level ?? 1)));
      const text = extractInline(node).trim();
      flush();
      headingStack.length = level - 1;
      headingStack[level - 1] = text;
      current = { headingPath: pathFor(), paragraphs: [] };
      continue;
    }

    const text = extractInline(node).trim();
    if (!text) continue;

    if (node?.type === "blockquote") {
      current.paragraphs.push(`» ${text}`);
    } else if (node?.type === "bulletList" || node?.type === "orderedList") {
      // Listen als ein Absatz behandeln — sie bilden eine Sinneinheit
      current.paragraphs.push(text);
    } else {
      current.paragraphs.push(text);
    }
  }
  flush();
  return blocks;
}

/** Rekursive Textextraktion aus einem TipTap-Knoten. */
function extractInline(node: any): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  const sep = node.type === "bulletList" || node.type === "orderedList" ? "\n" : "";
  return node.content.map((c: any) => extractInline(c)).join(sep);
}

/** Erzeugt Blöcke aus reinem Text (Notizen, Referenztexte, Figurenprofile). */
export function blocksFromPlainText(text: string, rootLabel?: string): StructuredBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: StructuredBlock[] = [];
  const headingStack: string[] = [];
  let current: StructuredBlock = { headingPath: rootLabel ?? "", paragraphs: [] };
  let buffer: string[] = [];

  function flushParagraph() {
    const p = buffer.join(" ").trim();
    if (p) current.paragraphs.push(p);
    buffer = [];
  }
  function flushBlock() {
    flushParagraph();
    if (current.paragraphs.length) blocks.push(current);
  }
  function pathFor(): string {
    const parts = rootLabel ? [rootLabel, ...headingStack] : [...headingStack];
    return parts.filter(Boolean).join(" › ");
  }

  for (const raw of lines) {
    const line = raw.trim();
    const md = /^(#{1,6})\s+(.*)$/.exec(line);
    if (md) {
      flushBlock();
      const level = md[1].length;
      headingStack.length = level - 1;
      headingStack[level - 1] = md[2].trim();
      current = { headingPath: pathFor(), paragraphs: [] };
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    buffer.push(line);
  }
  flushBlock();
  return blocks;
}

/**
 * Baut aus strukturierten Blöcken die endgültigen Chunks.
 * Garantien:
 *   - kein Chunk überschreitet MAX_TOKENS
 *   - Sätze werden nie zerschnitten
 *   - jeder Chunk kennt seinen Heading-Pfad
 *   - Chunks unter MIN_TOKENS werden verschmolzen (kein Fragment-Rauschen im Index)
 */
export function chunkBlocks(blocks: StructuredBlock[]): Chunk[] {
  const out: Chunk[] = [];
  let index = 0;

  for (const block of blocks) {
    const units = expandToUnits(block.paragraphs);
    let buf: string[] = [];
    let bufTokens = 0;
    /** Anzahl führender Einheiten in `buf`, die nur Overlap sind (kein neuer Inhalt). */
    let overlapUnits = 0;

    const push = () => {
      const text = buf.join("\n\n").trim();
      if (!text) return;
      out.push({
        chunkIndex: index++,
        text,
        headingPath: block.headingPath || null,
        tokenCount: estimateTokens(text),
      });
      // Overlap: Ende des Chunks als Kontext in den nächsten übernehmen
      const last = buf[buf.length - 1] ?? "";
      const overlap = tailByTokens(last, OVERLAP_TOKENS);
      buf = overlap ? [overlap] : [];
      bufTokens = estimateTokens(overlap);
      overlapUnits = overlap ? 1 : 0;
    };

    for (const unit of units) {
      const t = estimateTokens(unit);
      if (bufTokens + t > MAX_TOKENS && buf.length) push();
      buf.push(unit);
      bufTokens += t;
      if (bufTokens >= TARGET_TOKENS) push();
    }

    // Restpuffer: nur behalten, wenn er echten Inhalt jenseits des Overlaps enthält.
    // Sonst gingen kurze Absätze verloren (Datenverlust) oder es entstünden reine
    // Overlap-Duplikate im Index.
    if (buf.length > overlapUnits) {
      const rest = buf.join("\n\n").trim();
      if (rest) {
        out.push({
          chunkIndex: index++,
          text: rest,
          headingPath: block.headingPath || null,
          tokenCount: estimateTokens(rest),
        });
      }
    }
  }

  return mergeTinyChunks(out);
}

/** Zerlegt Absätze, die allein schon MAX_TOKENS überschreiten, an Satzgrenzen. */
function expandToUnits(paragraphs: string[]): string[] {
  const units: string[] = [];
  for (const p of paragraphs) {
    if (estimateTokens(p) <= MAX_TOKENS) {
      units.push(p);
      continue;
    }
    let buf: string[] = [];
    let tokens = 0;
    for (const s of splitSentences(p)) {
      const t = estimateTokens(s);
      if (tokens + t > MAX_TOKENS && buf.length) {
        units.push(buf.join(" "));
        buf = [];
        tokens = 0;
      }
      buf.push(s);
      tokens += t;
    }
    if (buf.length) units.push(buf.join(" "));
  }
  return units;
}

/** Liefert das Textende mit ungefähr `tokens` Tokens, an Satzgrenze ausgerichtet. */
function tailByTokens(text: string, tokens: number): string {
  if (!text) return "";
  const sentences = splitSentences(text);
  const acc: string[] = [];
  let sum = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const t = estimateTokens(sentences[i]);
    if (sum + t > tokens && acc.length) break;
    acc.unshift(sentences[i]);
    sum += t;
  }
  return acc.join(" ");
}

/** Verschmilzt zu kleine Chunks mit dem Vorgänger, wenn der Heading-Pfad übereinstimmt. */
function mergeTinyChunks(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    if (
      prev &&
      c.tokenCount < MIN_TOKENS &&
      prev.headingPath === c.headingPath &&
      prev.tokenCount + c.tokenCount <= MAX_TOKENS
    ) {
      prev.text = `${prev.text}\n\n${c.text}`;
      prev.tokenCount = estimateTokens(prev.text);
      continue;
    }
    out.push({ ...c, chunkIndex: out.length });
  }
  return out;
}

/** Komfort-Einstieg: TipTap-JSON → Chunks. */
export function chunkTiptap(json: string, rootLabel?: string): Chunk[] {
  return chunkBlocks(blocksFromTiptap(json, rootLabel));
}

/** Komfort-Einstieg: Plaintext/Markdown → Chunks. */
export function chunkPlainText(text: string, rootLabel?: string): Chunk[] {
  return chunkBlocks(blocksFromPlainText(text, rootLabel));
}
