// Unit-Tests: Diff-Engine (pure, ohne Backend).
import { describe, it, expect } from "vitest";
import { diffLines, diffStats, diffWords, parseUnifiedDiff, formatDiffText } from "./diff";

describe("git diff engine", () => {
  it("erkennt identische Texte", () => {
    const lines = diffLines("A\nB\nC", "A\nB\nC");
    expect(lines.every((l) => l.type === "same")).toBe(true);
    const stats = diffStats("A\nB\nC", "A\nB\nC");
    expect(stats).toEqual({ added: 0, removed: 0, unchanged: 3 });
  });

  it("erkennt hinzugefügte Zeilen", () => {
    const stats = diffStats("A\nC", "A\nB\nC");
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
    const lines = diffLines("A\nC", "A\nB\nC");
    expect(lines.find((l) => l.type === "add")?.text).toBe("B");
    expect(lines.find((l) => l.type === "add")?.newNo).toBe(2);
  });

  it("erkennt entfernte Zeilen mit korrekter alter Zeilennummer", () => {
    const lines = diffLines("A\nB\nC", "A\nC");
    const removed = lines.find((l) => l.type === "remove");
    expect(removed?.text).toBe("B");
    expect(removed?.oldNo).toBe(2);
  });

  it("behandelt komplett neuen Text", () => {
    const lines = diffLines("", "Neu");
    expect(lines.filter((l) => l.type === "add")).toHaveLength(1);
  });

  it("formatDiffText liefert +/- Vorzeichen", () => {
    const out = formatDiffText("alt", "neu");
    expect(out).toBe("- alt\n+ neu");
  });

  it("diffWords markiert geänderte Wörter innerhalb einer Zeile", () => {
    const parts = diffWords("Der rote Hund", "Der blaue Hund");
    expect(parts.some((p) => p.type === "remove" && p.text === "rote")).toBe(true);
    expect(parts.some((p) => p.type === "add" && p.text === "blaue")).toBe(true);
    expect(parts.some((p) => p.type === "same" && p.text === "Hund")).toBe(true);
  });

  it("parseUnifiedDiff liest git diff Output", () => {
    const unified = [
      "diff --git a/kap1.md b/kap1.md",
      "index 111..222 100644",
      "--- a/kap1.md",
      "+++ b/kap1.md",
      "@@ -1,3 +1,3 @@",
      " A",
      "-alte Zeile",
      "+neue Zeile",
      " C",
    ].join("\n");
    const lines = parseUnifiedDiff(unified);
    expect(lines).toHaveLength(4);
    expect(lines.find((l) => l.type === "remove")?.text).toBe("alte Zeile");
    expect(lines.find((l) => l.type === "add")?.text).toBe("neue Zeile");
    expect(lines[0].text).toBe("A");
  });
});
