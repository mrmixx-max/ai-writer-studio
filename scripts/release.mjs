#!/usr/bin/env node
// release.mjs — Sprint 6, Agent 4.
// `npm run release`: TypeScript transpilieren (tsc --noEmit als Gate),
// Vite-Produktions-Build (minifiziert) und Bundle als ZIP packen.
//
// Pipeline:
//   1. typecheck      (tsc --noEmit)
//   2. copy wasm      (scripts/copy_wasm.py, wie prebuild)
//   3. vite build     (Minifizierung via Vite/esbuild, dist/)
//   4. Tests          (vitest run — Release-Gate)
//   5. Bundle         (dist/ + LICENSE + CHANGELOG → release/ai-writer-studio-<version>.zip)

import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import {
  checkVersionSync,
  applyVersion,
  bumpVersion,
  groupCommits,
  renderChangelog,
  sha256File,
} from "./release-lib.mjs";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const RELEASE_DIR = path.join(ROOT, "release");

const IS_WIN = process.platform === "win32";
const NPM = IS_WIN ? "npm.cmd" : "npm";

function run(cmd, args, { label, allowFail = false } = {}) {
  console.log(`\n=== ${label ?? cmd} ===`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: IS_WIN && cmd === NPM });
  if (res.status !== 0) {
    const msg = `${label ?? cmd} fehlgeschlagen (Exit ${res.status})`;
    if (allowFail) {
      console.warn(`⚠ ${msg} — wird übersprungen.`);
      return false;
    }
    console.error(`✗ ${msg}`);
    process.exit(res.status ?? 1);
  }
  console.log(`✓ ${label ?? cmd}`);
  return true;
}

function readVersion() {
  const { readFileSync } = fsSync;
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return pkg.version ?? "0.0.0";
}

import * as fsSync from "node:fs";

async function sha256(file) {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

// ── ZIP ohne externe Abhängigkeit: Store-only-ZIP-Writer ────────────────
// (Deflate ist nicht nötig — Vite-Assets sind bereits gzip-optimal;
//  zip.js/jszip ist als Produktions-Dependency vorhanden.)
async function buildZip(entries, outFile) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const e of entries) {
    zip.file(e.name, e.content, { date: new Date() });
  }
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outFile, buf);
  return buf.length;
}

async function collectDist(dir, base = "") {
  const { readdir } = await import("node:fs/promises");
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await collectDist(full, rel)));
    else out.push({ rel, full });
  }
  return out;
}

function gitLog(range) {
  const res = spawnSync("git", ["log", range, "--pretty=format:%s"], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`git log fehlgeschlagen: ${(res.stderr || "").trim()}`);
  const out = (res.stdout || "").trim();
  return out ? out.split("\n") : [];
}

function lastTag() {
  const res = spawnSync("git", ["describe", "--tags", "--abbrev=0"], { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 ? (res.stdout || "").trim() : null;
}

/** Schreibt SHA256-Summen der Dateien in <file>.sha256 (eine Zeile pro Datei). */
async function writeSha256(files) {
  const lines = [];
  for (const f of files) {
    const hash = await sha256File(f);
    lines.push(`${hash}  ${path.basename(f)}`);
    console.log(`  ${hash}  ${path.basename(f)}`);
  }
  const outFile = `${files[0]}.sha256`;
  await writeFile(outFile, `${lines.join("\n")}\n`, "utf8");
  console.log(`✓ SHA256 geschrieben: ${outFile}`);
  return outFile;
}

/**
 * --changelog: Changelog-Sektion aus Git-Log seit letztem Tag erzeugen und
 * oben in docs/CHANGELOG.md einfügen (erstellt die Datei bei Bedarf).
 */
async function cmdChangelog() {
  const tag = lastTag();
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const lines = gitLog(range);
  const { version } = checkVersionSync(ROOT);
  const today = new Date().toISOString().slice(0, 10);
  const section = renderChangelog(version ?? readVersion(), today, groupCommits(lines));
  const changelogPath = path.join(ROOT, "docs", "CHANGELOG.md");
  const header = "# Changelog\n\nAlle nennenswerten Änderungen dieses Projekts werden in dieser Datei dokumentiert.\n\n";
  const prev = existsSync(changelogPath) ? await readFile(changelogPath, "utf8") : header;
  const body = prev.startsWith("# Changelog") ? prev.slice(prev.indexOf("\n\n") + 2) : prev;
  await writeFile(changelogPath, `${header}${section}\n${body.replace(/^\n+/, "")}`, "utf8");
  console.log(`✓ Changelog aktualisiert: docs/CHANGELOG.md (${lines.length} Commits seit ${tag ?? "Anfang"})`);
}

function printHelp() {
  console.log(`AI Writer Studio — Release-Build

Nutzung:
  npm run release                          Voll-Pipeline (Typecheck → Build → Tests → ZIP)
  npm run release -- --check                Nur Versions-Sync prüfen (package.json/tauri.conf.json/Cargo.toml)
  npm run release -- --bump <major|minor|patch|x.y.z> [--dry-run]
                                            Version in allen drei Dateien (+ src/version.ts) setzen
  npm run release -- --changelog             Changelog-Sektion aus Git-Log in docs/CHANGELOG.md
  npm run release -- --sha256 <datei...>     SHA256-Summen schreiben (<datei>.sha256)
  npm run release:notes [-- --out <file>]   Release-Notes seit letztem Tag (stdout oder Datei)`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) { printHelp(); return; }

  if (argv.includes("--check")) {
    const { synced, versions, version } = checkVersionSync(ROOT);
    console.log("Versions-Sync:", JSON.stringify(versions, null, 2));
    if (!synced) { console.error("✗ Versionen weichen voneinander ab."); process.exit(1); }
    console.log(`✓ Alle Quellen synchron auf ${version}`);
    return;
  }

  const bumpIdx = argv.indexOf("--bump");
  if (bumpIdx !== -1) {
    const kind = argv[bumpIdx + 1];
    if (!kind) { console.error("✗ --bump braucht ein Argument (major|minor|patch|x.y.z)."); process.exit(1); }
    const { version: current } = checkVersionSync(ROOT);
    const base = current ?? readVersion();
    const dryRun = argv.includes("--dry-run");
    const res = applyVersion(ROOT, bumpVersion(base, kind), { dryRun });
    console.log(`${dryRun ? "(dry-run) " : ""}✓ Version ${base} → ${res.version}`);
    for (const f of res.files) console.log(`  ${path.relative(ROOT, f)}`);
    return;
  }

  if (argv.includes("--changelog")) { await cmdChangelog(); return; }

  const shaIdx = argv.indexOf("--sha256");
  if (shaIdx !== -1) {
    const files = argv.slice(shaIdx + 1).filter((a) => !a.startsWith("--"));
    if (files.length === 0) { console.error("✗ --sha256 braucht mindestens eine Datei."); process.exit(1); }
    await writeSha256(files);
    return;
  }

  const t0 = Date.now();
  const version = readVersion();
  console.log(`AI Writer Studio — Release-Build v${version}`);

  // 1) Typecheck (Break-Schutz)
  run(NPM, ["run", "typecheck"], { label: "TypeScript-Check (tsc --noEmit)" });

  // 2) WASM kopieren (wie prebuild)
  run("python", ["scripts/copy_wasm.py"], { label: "WASM-Assets kopieren", allowFail: true });

  // 3) Produktions-Build (Vite, minifiziert)
  run(NPM, ["run", "build"], { label: "Vite-Produktionsbuild (minifiziert)" });

  if (!existsSync(DIST)) {
    console.error("✗ dist/ nach Build nicht gefunden — Abbruch.");
    process.exit(1);
  }

  // 4) Tests als Release-Gate (schneller Ersatzpfad: volle Suite ist Teil von `npm run verify`)
  run(NPM, ["run", "test"], { label: "Test-Suite (Release-Gate)" });

  // 5) Bundle packen
  mkdirSync(RELEASE_DIR, { recursive: true });
  const zipName = `ai-writer-studio-${version}.zip`;
  const zipPath = path.join(RELEASE_DIR, zipName);

  const files = await collectDist(DIST);
  const entries = [];
  for (const f of files) {
    entries.push({ name: `ai-writer-studio-${version}/${f.rel}`, content: await readFile(f.full) });
  }
  for (const extra of ["LICENSE.txt", "CHANGELOG.md", "README.md"]) {
    const p = path.join(ROOT, extra);
    if (existsSync(p)) entries.push({ name: `ai-writer-studio-${version}/${extra}`, content: await readFile(p) });
  }

  const size = await buildZip(entries, zipPath);
  const hash = (await sha256(zipPath)).slice(0, 16);

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n──────────────────────────────────────────────");
  console.log(`✓ Release-Bundle: release/${zipName}`);
  console.log(`  Dateien: ${entries.length}   Größe: ${(size / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`  SHA256 (gekürzt): ${hash}…`);
  console.log(`  Dauer: ${dur}s`);
  console.log("──────────────────────────────────────────────");
}

main().catch((e) => {
  console.error("✗ Release fehlgeschlagen:", e);
  process.exit(1);
});
