#!/usr/bin/env node
// release-notes.mjs — Release-Notes aus Commits seit letztem Git-Tag.
// Nutzung: `npm run release:notes` (stdout) oder
//          `node scripts/release-notes.mjs --out RELEASE_NOTES.md`
//          `node scripts/release-notes.mjs --range v0.1.0..HEAD`

import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderReleaseNotes } from "./release-lib.mjs";

const ROOT = process.cwd();

function git(args) {
  const res = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} fehlgeschlagen: ${(res.stderr || "").trim()}`);
  return (res.stdout || "").trim();
}

function lastTag() {
  const res = spawnSync("git", ["describe", "--tags", "--abbrev=0"], { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 ? (res.stdout || "").trim() : null;
}

function readPkgVersion() {
  return JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version ?? "0.0.0";
}

function parseArgs(argv) {
  const out = { out: null, range: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--range") out.range = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/release-notes.mjs [--range <tag..HEAD>] [--out <file>]");
    process.exit(0);
  }
  const tag = args.range ? args.range.split("..")[0] : lastTag();
  const range = args.range ?? (tag ? `${tag}..HEAD` : "HEAD");
  const log = git(["log", range, "--pretty=format:%s"]);
  const lines = log ? log.split("\n") : [];
  const version = readPkgVersion();
  const notes = renderReleaseNotes(version, tag, lines);
  if (args.out) {
    writeFileSync(args.out, notes, "utf8");
    console.log(`Release-Notes geschrieben: ${args.out} (${lines.length} Commits seit ${tag ?? "Anfang"})`);
  } else {
    process.stdout.write(notes);
  }
}

main();
