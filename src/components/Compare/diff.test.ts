// Tests für die Diff-Engine des Manuskript-Vergleichs.
import { describe, it, expect } from "vitest";
import { diffWords, diffLines, diffStats } from "./diff";

describe("diffWords", () => {
  it("identische Texte erzeugen nur equal-Segmente", () => {
    const segs = diffWords("Hallo Welt", "Hallo Welt");
    expect(segs).toEqual([{ op: "equal", text: "Hallo Welt" }]);
  });

  it("erkennt gelöschte Wörter", () => {
    const segs = diffWords("Hallo schöne Welt", "Hallo Welt");
    const del = segs.filter((s) => s.op === "delete").map((s) => s.text).join("");
    expect(del.trim()).toBe("schöne");
  });

  it("erkennt hinzugefügte Wörter", () => {
    const segs = diffWords("Hallo Welt", "Hallo schöne Welt");
    const ins = segs.filter((s) => s.op === "insert").map((s) => s.text).join("");
    expect(ins.trim()).toBe("schöne");
  });
});

describe("diffLines", () => {
  it("markiert gelöschte Zeilen", () => {
    const lines = diffLines("a\nb\nc", "a\nc");
    expect(lines.filter((l) => l.op === "delete").length).toBe(1);
  });

  it("markiert hinzugefügte Zeilen mit rechter Nummer", () => {
    const lines = diffLines("a\nc", "a\nb\nc");
    const ins = lines.filter((l) => l.op === "insert");
    expect(ins.length).toBe(1);
    expect(ins[0].rightNo).toBe(2);
  });

  it("paart geänderte Zeilen und liefert Inline-Segmente", () => {
    const lines = diffLines("Der alte Mann ging", "Der junge Mann ging");
    const chg = lines.filter((l) => l.op === "changed");
    expect(chg.length).toBe(1);
    const ops = chg[0].segments.map((s) => s.op);
    expect(ops).toContain("delete");
    expect(ops).toContain("insert");
  });

  it("gleiche Datei -> alles equal", () => {
    const lines = diffLines("x\ny", "x\ny");
    expect(lines.every((l) => l.op === "equal")).toBe(true);
  });
});

describe("diffStats", () => {
  it("zählt Wörter und Zeilen", () => {
    const lines = diffLines("a b c\nd e", "a b\nd e f");
    const s = diffStats(lines);
    expect(s.deleted).toBe(1); // "c"
    expect(s.added).toBe(1); // "f"
    expect(s.totalLines).toBe(2);
  });
});
