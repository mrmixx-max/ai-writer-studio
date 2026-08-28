// Tests: Git-Branching (Entwurf → Endversion) gegen einen Fake-Git-Runner.
// Datei: src/services/git/branches.test.ts
import { describe, expect, it } from "vitest";
import { setGitRunner } from "./executor";
import { createBranch, deleteBranch, mergeBranch, openDraftBranch, promoteToFinal, switchBranch } from "./branches";
import { WORKFLOW_BRANCHES } from "./conflicts";
import type { GitResult } from "./types";

const ok = (stdout = ""): GitResult => ({ code: 0, stdout, stderr: "" });
const fail = (stderr: string): GitResult => ({ code: 1, stdout: "", stderr });

/**
 * Minimaler In-Memory-Git-Zustand: Branches-Set + aktueller Branch.
 * Simuliert branch/switch/merge so weit, wie die Branch-Logik es erwartet.
 */
function fakeGit() {
  const state = { branches: new Set(["main", WORKFLOW_BRANCHES.draft]), current: "main", merged: [] as string[] };
  setGitRunner(async (_cwd, args) => {
    const [cmd, ...rest] = args;
    if (cmd === "branch") {
      const name = rest.find((a) => !a.startsWith("-"));
      if (name) state.branches.add(name);
      return ok();
    }
    if (cmd === "switch" && rest[0]) {
      if (!state.branches.has(rest[0])) return fail(`branch '${rest[0]}' not found`);
      state.current = rest[0];
      return ok();
    }
    if (cmd === "rev-parse") {
      return ok(state.current);
    }
    if (cmd === "merge") {
      const src = rest.find((a) => !a.startsWith("-")) ?? "";
      if (src === state.current) return fail("already up to date with itself");
      state.merged.push(src);
      return ok(`Merge branch '${src}'`);
    }
    return ok();
  });
  return state;
}

describe("branches", () => {
  it("legt einen Branch an und wechselt dorthin", async () => {
    const state = fakeGit();
    await createBranch(".", "endversion-1");
    expect(state.branches.has("endversion-1")).toBe(true);
    expect(state.current).toBe("endversion-1");
  });

  it("legt einen Branch an, ohne zu wechseln (switchTo=false)", async () => {
    const state = fakeGit();
    await createBranch(".", "b2", false);
    expect(state.branches.has("b2")).toBe(true);
    expect(state.current).toBe("main");
  });

  it("wechselt zu einem existierenden Branch", async () => {
    const state = fakeGit();
    await switchBranch(".", "main");
    expect(state.current).toBe("main");
  });

  it("löscht einen Branch (force)", async () => {
    fakeGit();
    const res = await deleteBranch(".", WORKFLOW_BRANCHES.draft, true);
    expect(res.code).toBe(0);
  });

  it("öffnet den Entwurfs-Branch (bereits aktiv → kein switch nötig)", async () => {
    const state = fakeGit();
    state.current = WORKFLOW_BRANCHES.draft;
    const name = await openDraftBranch(".");
    expect(name).toBe(WORKFLOW_BRANCHES.draft);
    expect(state.current).toBe(WORKFLOW_BRANCHES.draft);
  });

  it("öffnet den Entwurfs-Branch (fehlt → wird erstellt und gewechselt)", async () => {
    const state = fakeGit();
    state.branches.delete(WORKFLOW_BRANCHES.draft);
    state.current = "main";
    const name = await openDraftBranch(".");
    expect(name).toBe(WORKFLOW_BRANCHES.draft);
    expect(state.current).toBe(WORKFLOW_BRANCHES.draft);
  });

  it("merged einen Quell-Branch in den aktuellen", async () => {
    const state = fakeGit();
    state.current = WORKFLOW_BRANCHES.draft; // main → draft mergen
    const res = await mergeBranch(".", "main");
    expect(res.code).toBe(0);
    expect(state.merged).toContain("main");
  });

  it("fördert den Entwurf in den Endversion-Branch", async () => {
    const state = fakeGit();
    state.current = WORKFLOW_BRANCHES.draft;
    state.branches.add(WORKFLOW_BRANCHES.final);
    const res = await promoteToFinal(".");
    expect(res.code).toBe(0);
    // Nach dem Wechsel auf final wurde der Draft gemerged.
    expect(state.merged).toContain(WORKFLOW_BRANCHES.draft);
    expect(state.current).toBe(WORKFLOW_BRANCHES.final);
  });
});
