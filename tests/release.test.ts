import { describe, it, expect } from "vitest";
import {
  parseVersion,
  isValidVersion,
  bumpVersion,
  checkVersionSync,
  applyVersion,
  parseCommitLine,
  groupCommits,
  renderChangelog,
  renderReleaseNotes,
} from "../scripts/release-lib.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function makeRoot(versions = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "release-test-"));
  const { pkg = "1.2.3", tauri = "1.2.3", cargo = "1.2.3" } = versions;
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "x", version: pkg }));
  mkdirSync(path.join(root, "src-tauri"), { recursive: true });
  writeFileSync(path.join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ version: tauri }));
  writeFileSync(
    path.join(root, "src-tauri", "Cargo.toml"),
    `[package]\nname = "x"\nversion = "${cargo}"\nedition = "2021"\n\n[dependencies]\nfoo = "1"\n`,
  );
  return root;
}

describe("parseVersion / isValidVersion", () => {
  it("parst SemVer-Komponenten", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });
  it("wirft bei ungültigem Format", () => {
    expect(() => parseVersion("abc")).toThrow();
    expect(() => parseVersion("1.2")).toThrow();
  });
  it("validiert Versionen", () => {
    expect(isValidVersion("0.0.1")).toBe(true);
    expect(isValidVersion("nope")).toBe(false);
  });
});

describe("bumpVersion", () => {
  it("patch/minor/major", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });
  it("akzeptiert explizite Version", () => {
    expect(bumpVersion("1.2.3", "2.0.0")).toBe("2.0.0");
  });
  it("wirft bei unbekanntem Bump-Typ", () => {
    expect(() => bumpVersion("1.2.3", "mega")).toThrow();
  });
});

describe("checkVersionSync", () => {
  it("synced wenn alle drei übereinstimmen", () => {
    const r = checkVersionSync(makeRoot());
    expect(r.synced).toBe(true);
    expect(r.version).toBe("1.2.3");
  });
  it("erkennt Drift zwischen den Dateien", () => {
    const r = checkVersionSync(makeRoot({ cargo: "9.9.9" }));
    expect(r.synced).toBe(false);
    expect(r.versions.cargo).toBe("9.9.9");
    expect(r.versions.packageJson).toBe("1.2.3");
  });
});

describe("applyVersion", () => {
  it("schreibt alle drei Dateien synchron (dryRun ändert nichts)", () => {
    const root = makeRoot();
    const res = applyVersion(root, "2.0.0", { dryRun: true });
    expect(res.version).toBe("2.0.0");
    expect(checkVersionSync(root).version).toBe("1.2.3");
  });
  it("schreibt alle drei Dateien synchron", () => {
    const root = makeRoot();
    applyVersion(root, "2.0.0");
    const r = checkVersionSync(root);
    expect(r.synced).toBe(true);
    expect(r.version).toBe("2.0.0");
    // Cargo-Dependency "foo = 1" darf nicht angefasst werden
    const cargo = readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8");
    expect(cargo).toContain('foo = "1"');
  });
  it("wirft bei ungültiger Zielversion", () => {
    expect(() => applyVersion(makeRoot(), "kaputt")).toThrow();
  });
});

describe("parseCommitLine / groupCommits", () => {
  it("parst type(scope): subject", () => {
    expect(parseCommitLine("feat(auth): login")).toEqual({ type: "feat", scope: "auth", subject: "login" });
    expect(parseCommitLine("fix: crash")).toEqual({ type: "fix", scope: null, subject: "crash" });
  });
  it("gruppiert feat/fix/docs/sonstiges", () => {
    const g = groupCommits(["feat: a", "fix: b", "docs: c", "chore: d", "merge: Sprint 8", ""]);
    expect(g.feat).toHaveLength(1);
    expect(g.fix).toHaveLength(1);
    expect(g.docs).toHaveLength(1);
    expect(g.other).toHaveLength(2);
  });
});

describe("renderChangelog / renderReleaseNotes", () => {
  const groups = groupCommits(["feat: neues Feature", "fix: Bug behoben", "docs: Readme"]);
  it("rendert Changelog-Sektion mit Version und Datum", () => {
    const md = renderChangelog("1.2.4", "2026-09-06", groups);
    expect(md).toContain("## [1.2.4] - 2026-09-06");
    expect(md).toContain("### Features");
    expect(md).toContain("- neues Feature");
    expect(md).toContain("### Fixes");
  });
  it("lässt leere Gruppen weg", () => {
    const md = renderChangelog("1.0.0", "2026-01-01", groupCommits(["fix: nur ein Fix"]));
    expect(md).not.toContain("### Features");
    expect(md).toContain("### Fixes");
  });
  it("rendert Release-Notes mit Tag-Referenz", () => {
    const md = renderReleaseNotes("1.2.4", "v1.2.3", ["feat: a", "fix: b"]);
    expect(md).toContain("# AI Writer Studio v1.2.4");
    expect(md).toContain("`v1.2.3`");
  });
  it("meldet leere Ranges explizit", () => {
    expect(renderReleaseNotes("1.0.0", "v1.0.0", [])).toContain("Keine Änderungen");
  });
});
