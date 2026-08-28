// Diff-Engine: reine Textvergleiche für die Diff-Visualisierung.
//
// Kein Backend, keine Abhängigkeiten — funktioniert im Browser und in Vitest.
// Basis: LCS (Longest Common Subsequence) auf Zeilenebene, Wort-Diff auf
// geänderten Zeilenpaaren für hervorgehobene Änderungen innerhalb einer Zeile.

import type { DiffLine, DiffStats } from "./types";

export type { DiffLine, DiffStats };

/** LCS-Länge-Tabelle (dynamische Programmierung). */
function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/**
 * Zeilen-Diff zweier Texte (LCS-basiert).
 * Identische Zeilen werden zusammengefasst; gelöschte vor zugefügten
 * aufeinanderfolgenden Paaren werden zu "modify"-Blöcken gruppiert.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const table = lcsTable(a, b);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ type: "remove", text: a[i], oldNo: i + 1 });
      i++;
    } else {
      out.push({ type: "add", text: b[j], newNo: j + 1 });
      j++;
    }
  }
  while (i < a.length) out.push({ type: "remove", text: a[i], oldNo: ++i });
  while (j < b.length) out.push({ type: "add", text: b[j], newNo: ++j });
  return out;
}

/** Statistik eines Diff-Laufs. */
export function diffStats(oldText: string, newText: string): DiffStats {
  const lines = diffLines(oldText, newText);
  return {
    added: lines.filter((l) => l.type === "add").length,
    removed: lines.filter((l) => l.type === "remove").length,
    unchanged: lines.filter((l) => l.type === "same").length,
  };
}

/** Wort-Diff einer einzelnen Zeile (für Intra-Line-Highlighting). */
export function diffWords(oldLine: string, newLine: string): { type: "same" | "add" | "remove"; text: string }[] {
  const a = oldLine.split(/(\s+)/).filter((w) => w !== "");
  const b = newLine.split(/(\s+)/).filter((w) => w !== "");
  const table = lcsTable(a, b);
  const out: { type: "same" | "add" | "remove"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ type: "remove", text: a[i++] });
    } else {
      out.push({ type: "add", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: "remove", text: a[i++] });
  while (j < b.length) out.push({ type: "add", text: b[j++] });
  return out;
}

/** Parses `git diff` Unified-Output in visualisierbare Zeilen. */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of diff.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("@@")) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) continue;
    if (line.startsWith("+")) {
      out.push({ type: "add", text: line.slice(1), newNo: newNo++ });
    } else if (line.startsWith("-")) {
      out.push({ type: "remove", text: line.slice(1), oldNo: oldNo++ });
    } else if (line.startsWith(" ") || line === "") {
      out.push({ type: "same", text: line.startsWith(" ") ? line.slice(1) : line, oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return out;
}

/** Diff als lesbarer Text (z.B. für Export/Klemmbrett). */
export function formatDiffText(oldText: string, newText: string): string {
  return diffLines(oldText, newText)
    .map((l) => (l.type === "add" ? `+ ${l.text}` : l.type === "remove" ? `- ${l.text}` : `  ${l.text}`))
    .join("\n");
}

/**
 * Diff des Kapitelinhalts gegen eine Revision — Frontend-Brücke.
 * (Ruft git diff im Backend auf; Revisionskandidaten: HEAD~1, Branch-Namen, Hashes.)
 */
export async function gitDiffText(dir: string, fromRev: string, toRev: string | null): Promise<string> {
  const { gitAllowFail } = await import("./executor");
  const args = ["diff", "--unified=3", fromRev];
  if (toRev) args.push(toRev);
  const res = await gitAllowFail(dir, ...args);
  return res.stdout;
}
