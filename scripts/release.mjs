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
import { readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

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

async function main() {
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
