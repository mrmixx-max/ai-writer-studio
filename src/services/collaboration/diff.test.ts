// Tests für den Diff-Service (Versionsvergleich).
import { describe, it, expect } from "vitest";
import { diffWords, diffLines, diffStats, similarity } from "./diff";

describe("diffWords", () => {
  it("erkennt Einfügungen", () => {
    const seg = diffWords("Der Hund lief", "Der braune Hund lief");
    expect(seg.some((s) => s.type === "insert" && s.text.includes("braune"))).toBe(true);
    expect(seg.every((s) => s.type !== "delete")).toBe(true);
  });

  it("erkennt Löschungen", () => {
    const seg = diffWords("Der braune Hund lief", "Der Hund lief");
    expect(seg.some((s) => s.type === "delete" && s.text.includes("braune"))).toBe(true);
  });

  it("erkennt Ersetzungen", () => {
    const seg = diffWords("Der Hund bellt", "Der Hund miaut");
    expect(seg.some((s) => s.type === "delete" && s.text.includes("bellt"))).toBe(true);
    expect(seg.some((s) => s.type === "insert" && s.text.includes("miaut"))).toBe(true);
  });

  it("identische Texte erzeugen nur equal-Segmente", () => {
    const seg = diffWords("Ich bin ein Satz", "Ich bin ein Satz");
    expect(seg.every((s) => s.type === "equal")).toBe(true);
  });

  it("leere Eingaben", () => {
    expect(diffWords("", "")).toEqual([]);
    expect(diffWords("", "Neu")).toEqual([{ type: "insert", text: "Neu" }]);
  });
});

describe("diffLines", () => {
  it("erkennt geänderte Absätze", () => {
    const seg = diffLines("Erste Zeile\nZweite Zeile", "Erste Zeile\nZweite Zeile geändert");
    expect(seg.some((s) => s.type === "delete")).toBe(true);
    expect(seg.some((s) => s.type === "insert" && s.text.includes("geändert"))).toBe(true);
  });
});

describe("diffStats & similarity", () => {
  it("zählt Wörter korrekt", () => {
    const stats = diffStats(diffWords("a b c", "a b c d e"));
    expect(stats).toEqual({ inserted: 2, deleted: 0, unchanged: 3 });
  });

  it("similarity: identisch = 1, fremd = 0", () => {
    expect(similarity("a b c", "a b c")).toBe(1);
    expect(similarity("a b c", "x y z")).toBe(0);
  });
});
