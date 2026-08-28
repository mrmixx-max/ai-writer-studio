// Repo-Layer- und Executor-Tests gegen einen Mock-Git-Runner (vi.fn()-Basis).
// Kein echtes Git, kein Tauri-Backend.
// Datei: src/services/git/repo.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { setGitRunner, git, gitAllowFail, GitError, parsePorcelainStatus, conflictedPaths } from "./executor";
import {
  isRepo, initRepo, cloneRepo, getStatus, currentBranch,
  listBranches, getLog, commitAll, push, pull,
} from "./repo";
import { gitDiffText } from "./diff";
import { resolveConflicts } from "./conflicts";
import type { GitResult } from "./types";

const ok = (stdout = ""): GitResult => ({ code: 0, stdout, stderr: "" });
const fail = (stderr: string): GitResult => ({ code: 1, stdout: "", stderr });

type Handler = (args: string[]) => GitResult;

/** Mock-Runner: Befehle werden in calls protokolliert, Antworten via Handler-Map. */
function mockGit(handlers: Record<string, Handler> = {}) {
  const calls: string[][] = [];
  const runner = vi.fn(async (_cwd: string, args: string[]): Promise<GitResult> => {
    calls.push(args);
    const h = handlers[args[0]];
    return h ? h(args.slice(1)) : ok();
  });
  setGitRunner(runner);
  return { calls, runner };
}

afterEach(() => {
  setGitRunner(async () => ({ code: 1, stdout: "", stderr: "no runner in test" }));
});

describe("executor", () => {
  it("git wirft GitError bei Exit-Code != 0", async () => {
    mockGit({ status: () => fail("not a repo") });
    await expect(git(".", "status")).rejects.toThrow(GitError);
    try {
      await git(".", "status");
    } catch (e) {
      const err = e as GitError;
      expect(err.name).toBe("GitError");
      expect(err.result.stderr).toBe("not a repo");
      expect(err.args).toEqual(["status"]);
      expect(err.message).toContain("status");
    }
  });

  it("gitAllowFail liefert das rohe Ergebnis ohne Wurf", async () => {
    mockGit({ pull: () => fail("conflict") });
    const res = await gitAllowFail(".", "pull");
    expect(res.code).toBe(1);
    expect(res.stderr).toBe("conflict");
  });

  it("parsePorcelainStatus: R-Status, CRLF und Short-Lines", () => {
    const out = "## main\r\nR  alt.md -> neu.md\r\nAM bearbeitet.md\r\nx\r\n";
    const entries = parsePorcelainStatus(out);
    expect(entries).toHaveLength(2);
    expect(entries[0].statusCode).toBe("R ");
    expect(entries[0].path).toBe("alt.md -> neu.md");
    expect(entries[1].statusCode).toBe("AM");
    expect(conflictedPaths(out)).toEqual([]);
  });

  it("parsePorcelainStatus erkennt alle Konfliktcodes", () => {
    const codes = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"];
    const out = codes.map((c, i) => `${c} f${i}`).join("\n");
    expect(conflictedPaths(out)).toHaveLength(codes.length);
  });
});

describe("repo", () => {
  it("isRepo: true bei 'true'-Antwort, false bei Fehler", async () => {
    mockGit({ "rev-parse": (a) => (a.includes("abbrev-ref") ? ok("main") : ok("true")) });
    expect(await isRepo(".")).toBe(true);
    // Fehlerfall: rev-parse schlaegt fehl
    setGitRunner(async (_c, args) =>
      args[0] === "rev-parse" ? fail("fatal") : ok(),
    );
    expect(await isRepo(".")).toBe(false);
  });

  it("initRepo fuehrt init + config aus", async () => {
    const { calls } = mockGit();
    await initRepo("/tmp/repo");
    expect(calls[0]).toEqual(["init"]);
    expect(calls.some((c) => c[0] === "config" && c.includes("core.autocrlf"))).toBe(true);
    expect(calls.some((c) => c[0] === "config" && c.includes("core.quotepath"))).toBe(true);
  });

  it("cloneRepo ruft git clone mit URL und Ziel auf", async () => {
    const { calls } = mockGit();
    await cloneRepo("https://example.org/repo.git", "ziel");
    expect(calls[0]).toEqual(["clone", "https://example.org/repo.git", "ziel"]);
  });

  it("getStatus parst den Porcelain-Output", async () => {
    mockGit({ status: (a) => (a.includes("-b") ? ok("## main\n M kap1.md") : ok(" M kap1.md")) });
    const entries = await getStatus(".");
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("kap1.md");
  });

  it("currentBranch: Name, null bei detached und null bei Fehler", async () => {
    let stdout = "main";
    mockGit({ "rev-parse": () => ok(stdout) });
    expect(await currentBranch(".")).toBe("main");
    stdout = "HEAD";
    expect(await currentBranch(".")).toBeNull();
    setGitRunner(async () => fail("no repo"));
    expect(await currentBranch(".")).toBeNull();
  });

  it("listBranches parst Ahead/Behind/Upstream/HEAD", async () => {
    mockGit({
      "for-each-ref": () =>
        ok(
          [
            "main|origin/main|[ahead 2, behind 1]|*",
            "feature|x|| ",
            "lokal|||",
          ].join("\n"),
        ),
    });
    const branches = await listBranches(".");
    expect(branches).toHaveLength(3);
    expect(branches[0]).toEqual({ name: "main", current: true, upstream: "origin/main", ahead: 2, behind: 1 });
    expect(branches[1]).toEqual({ name: "feature", current: false, upstream: "x", ahead: 0, behind: 0 });
    expect(branches[2].upstream).toBeNull();
  });

  it("getLog parst %x1f-Felder und liefert [] bei Fehler", async () => {
    mockGit({
      log: () => ok(["h1", "s1", "autor", "1756000000", "Kapitel 1 fertig", "HEAD -> main"].join("\x1f")),
    });
    const log = await getLog(".", 10);
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({
      hash: "h1", shortHash: "s1", author: "autor",
      timestamp: 1756000000, subject: "Kapitel 1 fertig", refs: "HEAD -> main",
    });
    setGitRunner(async () => fail("no log"));
    expect(await getLog(".")).toEqual([]);
  });

  it("commitAll: false wenn clean, sonst add + commit", async () => {
    const { calls } = mockGit({ status: () => ok("") });
    expect(await commitAll(".", "msg")).toBe(false);
    expect(calls.some((c) => c[0] === "commit")).toBe(false);

    mockGit({ status: (a) => (a.includes("-b") ? ok("") : ok(" M f.md")) });
    const g2calls = mockGit({ status: (a) => (a.includes("-b") ? ok("") : ok(" M f.md")) }).calls;
    await commitAll(".", "Kapitel gespeichert");
    expect(g2calls.some((c) => c[0] === "add")).toBe(true);
    expect(g2calls.some((c) => c[0] === "commit" && c.includes("Kapitel gespeichert"))).toBe(true);
  });

  it("push nutzt den aktuellen Branch mit Upstream", async () => {
    const { calls } = mockGit({ "rev-parse": () => ok("feature-x") });
    await push(".");
    expect(calls.some((c) => c[0] === "push" && c.includes("feature-x"))).toBe(true);
  });

  it("pull fuehrt einen Merge-Pull ohne Rebase aus", async () => {
    const { calls } = mockGit();
    await pull(".");
    expect(calls[0]).toEqual(["pull", "--no-rebase", "--no-edit"]);
  });
});

describe("gitDiffText", () => {
  it("ruft git diff mit Revisionen auf und liefert stdout", async () => {
    const { calls } = mockGit({ diff: () => ok("diff --git a/x b/x") });
    const out = await gitDiffText(".", "HEAD~1", "HEAD");
    expect(out).toContain("diff --git");
    expect(calls[0]).toEqual(["diff", "--unified=3", "HEAD~1", "HEAD"]);
  });

  it("funktioniert ohne Ziel-Revision", async () => {
    const { calls } = mockGit({ diff: () => ok("+neu") });
    await gitDiffText(".", "HEAD~1", null);
    expect(calls[0]).toEqual(["diff", "--unified=3", "HEAD~1"]);
  });
});

describe("resolveConflicts (Datei-basiert)", () => {
  const conflictFile = ["<<<<<<< HEAD", "ours", "=======", "theirs", ">>>>>>> b"].join("\n");

  it("loest Konflikte per Strategie, markiert sie und committet", async () => {
    const { calls } = mockGit({ add: () => ok(), commit: () => ok() });
    const read = vi.fn(async () => conflictFile);
    const write = vi.fn(async (_dir: string, _p: string, content: string) => {
      expect(content).toBe("theirs");
    });
    await resolveConflicts(
      ".",
      [{ path: "kap1.md", strategy: "manual" }],
      "theirs",
      read, write,
    );
    expect(read).toHaveBeenCalledWith(".", "kap1.md");
    expect(write).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c[0] === "add" && c.includes("kap1.md"))).toBe(true);
    expect(calls.some((c) => c[0] === "commit")).toBe(true);
  });

  it("manual tut nichts", async () => {
    const { calls } = mockGit();
    const read = vi.fn(async () => conflictFile);
    await resolveConflicts(".", [{ path: "kap1.md", strategy: "manual" }], "manual", read, vi.fn());
    expect(read).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});
