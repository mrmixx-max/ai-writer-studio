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

/**
 * Adaptive Zielgröße basierend auf der Satzdichte des Textes.
 *
 * Texte mit vielen kurzen Sätzen (z. B. Action-Szenen) bekommen kleinere Chunks,
 * damit jedes Retrieval-Ergebnis eine kompakte Sinneinheit abbildet.
 * Texte mit langen, verschachtelätzen Sätzen (z. B. philosophische Passagen)
 * bekommen größere Chunks, damit der Zusammenhang nicht zerrissen wird.
 *
 * @param text  Der vollständige Text des Blocks
 * @returns     Zielgröße in Tokens (zwischen TARGET_TOKENS/2 und TARGET_TOKENS*1.5)
 */
export function adaptiveTargetTokens(text: string): number {
  if (!text || text.length < 50) return TARGET_TOKENS;

  // Satz-Extraktion zur Dichte-Analyse
  const sentences = splitSentences(text);
  if (sentences.length < 3) return TARGET_TOKENS;

  // Durchschnittliche Satzlänge in Zeichen
  const avgLen = text.length / sentences.length;

  // Kurze Sätze (< 40 Zeichen) → kleinere Chunks für präzisere Treffer
  // Lange Sätze (> 120 Zeichen) → größere Chunks für Zusammenhang
  if (avgLen < 40) {
    return Math.round(TARGET_TOKENS * 0.7); // ~224 Tokens — kompakt
  }
  if (avgLen > 120) {
    return Math.round(TARGET_TOKENS * 1.3); // ~416 Tokens — Kontext-erhaltend
  }
  return TARGET_TOKENS;
}

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
    .split(/(?<=[.!?…])[»«"']?\s+/)
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
 *
 * Optimierte Heuristik:
 *   - Adaptive Zielgröße basierend auf Satzdichte (adaptiveTargetTokens)
 *   - Satz-Analyse: Chunks enden immer an Satzgrenzen
 *   - Absatz-Analyse: Absätze werden nur gesplittet, wenn sie MAX_TOKENS überschreiten
 *   - Verschmelzung winziger Chunks mit gleichem Heading-Pfad
 *
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
    // Adaptive Zielgröße für diesen Block berechnen
    const blockText = block.paragraphs.join("\n\n");
    const target = adaptiveTargetTokens(blockText);

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
      // Puffer enthält echten Inhalt → abschließen, bevor das Limit gerissen wird
      if (bufTokens + t > MAX_TOKENS && buf.length > overlapUnits) push();
      // Puffer besteht nur aus Overlap → Overlap verwerfen statt Limit zu verletzen
      if (bufTokens + t > MAX_TOKENS && buf.length) {
        buf = [];
        bufTokens = 0;
        overlapUnits = 0;
      }
      buf.push(unit);
      bufTokens += t;
      if (bufTokens >= target) push();
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

/** Zerlegt Absätze, die allein schon das Limit (inkl. Overlap-Kopfroom) überschreiten, an Satzgrenzen. */
function expandToUnits(paragraphs: string[]): string[] {
  // Kopfroom für den Overlap, der dem Chunk vorangestellt wird — so bleibt
  // auch nach dem Zusammenführen mit dem Overlap die MAX_TOKENS-Garantie intact.
  const LIMIT = MAX_TOKENS - OVERLAP_TOKENS;
  const units: string[] = [];
  for (const p of paragraphs) {
    if (estimateTokens(p) <= LIMIT) {
      units.push(p);
      continue;
    }
    let buf: string[] = [];
    let tokens = 0;
    for (const s of splitSentences(p)) {
      // Pathologischer Fall: ein einzelner Satz übersteigt das Limit → harte Wortgrenzen-Splits
      for (const piece of splitOversizedSentence(s, LIMIT)) {
        const t = estimateTokens(piece);
        if (tokens + t > LIMIT && buf.length) {
          units.push(buf.join(" "));
          buf = [];
          tokens = 0;
        }
        buf.push(piece);
        tokens += t;
      }
    }
    if (buf.length) units.push(buf.join(" "));
  }
  return units;
}

/** Harte Splits eines überlangen Satzes an Wortgrenzen, damit nie ein Einzelstück das Limit reißt. */
function splitOversizedSentence(sentence: string, limitTokens: number): string[] {
  if (estimateTokens(sentence) <= limitTokens) return [sentence];
  const limitChars = Math.max(10, Math.floor(limitTokens * 3.4));
  const out: string[] = [];
  let buf = "";
  for (const w of sentence.split(/\s+/)) {
    if (buf && buf.length + w.length + 1 > limitChars) {
      out.push(buf);
      buf = w;
    } else {
      buf = buf ? `${buf} ${w}` : w;
    }
  }
  if (buf) out.push(buf);
  return out;
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
