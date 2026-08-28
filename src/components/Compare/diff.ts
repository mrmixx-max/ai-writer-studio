// Diff-Engine für Manuskript-Vergleich: LCS-basiert, Wort- und Zeilenebene.
// Kein externes Dependency — deterministisch und testbar.

export type DiffOp = "equal" | "insert" | "delete" | "changed";

export interface DiffSegment {
  op: DiffOp;
  text: string;
}

export interface DiffLine {
  op: DiffOp;
  segments: DiffSegment[]; // Wort-Diff innerhalb geänderter Zeilen
  leftNo?: number; // Zeilennummer in Version A
  rightNo?: number; // Zeilennummer in Version B
}

export interface DiffStats {
  added: number; // Wörter
  deleted: number; // Wörter
  changedLines: number;
  totalLines: number;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Klassisches LCS-Diff über Token. Bei sehr langen Texten Grobdiff (delete+insert). */
function lcsDiff(a: string[], b: string[]): Array<{ op: "equal" | "insert" | "delete"; text: string }> {
  const n = a.length;
  const m = b.length;
  if (n * m > 36_000_000) {
    return [
      { op: "delete", text: a.join("") },
      { op: "insert", text: b.join("") },
    ];
  }
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out: Array<{ op: "equal" | "insert" | "delete"; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      out.push({ op: "delete", text: a[i] });
      i++;
    } else {
      out.push({ op: "insert", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "delete", text: a[i++] });
  while (j < m) out.push({ op: "insert", text: b[j++] });
  return out;
}

/** Roh-Token-Diff zu Segmenten zusammenfassen. */
function coalesce(raw: Array<{ op: "equal" | "insert" | "delete"; text: string }>): DiffSegment[] {
  const segs: DiffSegment[] = [];
  for (const r of raw) {
    const last = segs[segs.length - 1];
    if (last && last.op === r.op) last.text += r.text;
    else segs.push({ op: r.op, text: r.text });
  }
  return segs;
}

/** Wortebenen-Diff zweier Texte (Inline-Hervorhebung). */
export function diffWords(a: string, b: string): DiffSegment[] {
  if (a === b) return [{ op: "equal", text: a }];
  return coalesce(lcsDiff(tokenize(a), tokenize(b)));
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/** Zeilen-Diff; aufeinanderfolgende delete/insert-Blöcke werden zeilenweise gepaart
 *  und auf Wortebene als "changed" hervorgehoben. */
export function diffLines(aText: string, bText: string): DiffLine[] {
  const raw = lcsDiff(splitLines(aText), splitLines(bText));
  const result: DiffLine[] = [];
  let leftNo = 0;
  let rightNo = 0;
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    if (cur.op === "equal") {
      leftNo++;
      rightNo++;
      result.push({ op: "equal", segments: [{ op: "equal", text: cur.text }], leftNo, rightNo });
      k++;
      continue;
    }
    const dels: string[] = [];
    const ins: string[] = [];
    while (k < raw.length && raw[k].op === "delete") dels.push(raw[k++].text);
    while (k < raw.length && raw[k].op === "insert") ins.push(raw[k++].text);
    const paired = Math.min(dels.length, ins.length);
    for (let p = 0; p < paired; p++) {
      leftNo++;
      rightNo++;
      result.push({ op: "changed", segments: diffWords(dels[p], ins[p]), leftNo, rightNo });
    }
    for (let p = paired; p < dels.length; p++) {
      leftNo++;
      result.push({ op: "delete", segments: [{ op: "delete", text: dels[p] }], leftNo });
    }
    for (let p = paired; p < ins.length; p++) {
      rightNo++;
      result.push({ op: "insert", segments: [{ op: "insert", text: ins[p] }], rightNo });
    }
  }
  return result;
}

/** Statistik über den Zeilen-Diff. */
export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let deleted = 0;
  let changedLines = 0;
  let totalLines = 0;
  for (const l of lines) {
    if (l.op === "equal") continue;
    if (l.op === "changed") changedLines++;
    if (l.op !== "insert") totalLines++;
    for (const seg of l.segments) {
      const words = seg.text.trim() ? seg.text.trim().split(/\s+/).length : 0;
      if (seg.op === "insert") added += words;
      else if (seg.op === "delete") deleted += words;
    }
  }
  return { added, deleted, changedLines, totalLines };
}
