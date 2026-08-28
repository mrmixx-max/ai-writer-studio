// Unit-Tests: Konflikt-Parsing und -Auflösung (pure) + Status-Parsing.
import { describe, it, expect } from "vitest";
import { parseConflicts, resolveConflictContent, countConflicts, WORKFLOW_BRANCHES } from "./conflicts";
import { parsePorcelainStatus, conflictedPaths } from "./executor";

const conflictFile = [
  "Kapitel 1",
  "<<<<<<< HEAD",
  "Der alte Entwurf",
  "=======",
  "Die neue Fassung",
  ">>>>>>> feature/ko-write",
  "Ende.",
].join("\n");

describe("git conflicts", () => {
  it("parst Konfliktmarker in Segmente", () => {
    const { segments } = parseConflicts(conflictFile);
    expect(segments).toHaveLength(1);
    expect(segments[0].before).toBe("Kapitel 1");
    expect(segments[0].ours).toBe("Der alte Entwurf");
    expect(segments[0].theirs).toBe("Die neue Fassung");
    expect(segments[0].after).toBe("Ende.");
  });

  it("resolveConflictContent: ours", () => {
    const out = resolveConflictContent(conflictFile, "ours");
    expect(out).toBe("Kapitel 1\nDer alte Entwurf\nEnde.");
  });

  it("resolveConflictContent: theirs", () => {
    const out = resolveConflictContent(conflictFile, "theirs");
    expect(out).toBe("Kapitel 1\nDie neue Fassung\nEnde.");
  });

  it("resolveConflictContent: both verkettet", () => {
    const out = resolveConflictContent(conflictFile, "both");
    expect(out).toContain("Der alte Entwurf");
    expect(out).toContain("Die neue Fassung");
    expect(out).not.toContain("<<<<<<<");
  });

  it("löst mehrere Blöcke in einer Datei auf", () => {
    const multi = conflictFile + "\n<<<<<\n".replace("<<<<<", "<<<<<<< HEAD") + "\nx\n=======\ny\n>>>>>>> b";
    expect(countConflicts(multi)).toBe(2);
    const out = resolveConflictContent(multi, "theirs");
    expect(countConflicts(out)).toBe(0);
    expect(out).toContain("y");
  });

  it("Datei ohne Marker bleibt unverändert", () => {
    expect(resolveConflictContent("sauber", "ours")).toBe("sauber");
  });

  it("Workflow-Branches sind definiert", () => {
    expect(WORKFLOW_BRANCHES.draft).toBe("entwurf");
    expect(WORKFLOW_BRANCHES.final).toBe("endversion");
  });
});

describe("git status parsing", () => {
  it("parst porcelain Status inkl. Konflikten", () => {
    const out = [
      "## main...origin/main",
      " M kapitel1.md",
      "M  kapitel2.md",
      "?? Notizen.txt",
      "UU kapitel3.md",
      "AA kapitel4.md",
    ].join("\n");
    const entries = parsePorcelainStatus(out);
    expect(entries).toHaveLength(5);
    expect(entries[0].path).toBe("kapitel1.md");
    expect(entries[0].conflicted).toBe(false);
    expect(entries[2].statusCode).toBe("??");
    expect(conflictedPaths(out)).toEqual(["kapitel3.md", "kapitel4.md"]);
  });

  it("ignoriert Branch-Zeile und leere Zeilen", () => {
    expect(parsePorcelainStatus("## main\n")).toHaveLength(0);
  });
});
