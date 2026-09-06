#!/usr/bin/env node
// release-lib.mjs — reine, testbare Release-Helfer (kein Prozess-Seiteneffekt).
// Wird von scripts/release.mjs und scripts/release-notes.mjs importiert
// und von tests/release.test.ts (vitest) abgedeckt.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/** "1.2.3" → {major, minor, patch}; wirft bei ungültigem Format. */
export function parseVersion(v) {
  const m = String(v ?? "").trim().match(SEMVER);
  if (!m) throw new Error(`Ungültige SemVer-Version: ${JSON.stringify(v)}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function isValidVersion(v) {
  return SEMVER.test(String(v ?? "").trim());
}

/**
 * bumpVersion("1.2.3", "minor") → "1.3.0".
 * kind: "major" | "minor" | "patch" oder eine explizite Version ("2.0.0").
 */
export function bumpVersion(current, kind) {
  if (isValidVersion(kind)) return String(kind).trim();
  const { major, minor, patch } = parseVersion(current);
  switch (kind) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`Unbekannter Bump-Typ: ${JSON.stringify(kind)} (major|minor|patch|x.y.z erwartet)`);
  }
}

/** Liest die drei Versionsquellen. Fehlt eine Datei, ist der Eintrag null. */
export function readVersionFiles(root) {
  const out = { packageJson: null, tauriConf: null, cargo: null };
  const pkgPath = path.join(root, "package.json");
  const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
  const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
  if (existsSync(pkgPath)) {
    try { out.packageJson = JSON.parse(readFileSync(pkgPath, "utf8")).version ?? null; } catch { out.packageJson = null; }
  }
  if (existsSync(tauriPath)) {
    try { out.tauriConf = JSON.parse(readFileSync(tauriPath, "utf8")).version ?? null; } catch { out.tauriConf = null; }
  }
  if (existsSync(cargoPath)) {
    const m = readFileSync(cargoPath, "utf8").match(/^version\s*=\s*"([^"]+)"/m);
    out.cargo = m ? m[1] : null;
  }
  return out;
}

/** Prüft, ob alle vorhandenen Versionsquellen übereinstimmen. */
export function checkVersionSync(root) {
  const versions = readVersionFiles(root);
  const present = Object.values(versions).filter((v) => v !== null);
  const synced = present.length > 0 && present.every((v) => v === present[0]);
  return { synced, versions, version: synced ? present[0] : null };
}

function replaceCargoVersion(src, newVersion) {
  let done = false;
  const out = src.replace(/^version\s*=\s*"[^"]*"/m, (m) => {
    if (done) return m;
    done = true;
    return `version = "${newVersion}"`;
  });
  if (!done) throw new Error("Keine [package] version in Cargo.toml gefunden.");
  return out;
}

/**
 * Schreibt newVersion in package.json, src-tauri/tauri.conf.json,
 * src-tauri/Cargo.toml und src/version.ts (falls vorhanden).
 * Mit dryRun=true wird nichts geschrieben; Rückgabe: {version, files}.
 */
export function applyVersion(root, newVersion, { dryRun = false } = {}) {
  if (!isValidVersion(newVersion)) throw new Error(`Ungültige Zielversion: ${JSON.stringify(newVersion)}`);
  const touched = [];
  const write = (file, content) => {
    if (!dryRun) writeFileSync(file, content, "utf8");
    touched.push(file);
  };

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.version = newVersion;
  write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
  const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
  tauri.version = newVersion;
  write(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

  const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
  write(cargoPath, replaceCargoVersion(readFileSync(cargoPath, "utf8"), newVersion));

  const versionTs = path.join(root, "src", "version.ts");
  if (existsSync(versionTs)) {
    const src = readFileSync(versionTs, "utf8");
    const updated = src.includes("APP_VERSION")
      ? src.replace(/APP_VERSION\s*=\s*"[^"]*"/, `APP_VERSION = "${newVersion}"`)
      : `${src.replace(/\s+$/, "")}\n\nexport const APP_VERSION = "${newVersion}";\n`;
    write(versionTs, updated);
  }
  return { version: newVersion, files: touched, dryRun };
}

// ── Changelog / Release-Notes ──────────────────────────────────────────

/** "feat(scope): text" → {type:"feat", scope:"scope", subject:"text"}; Rest → type "other". */
export function parseCommitLine(line) {
  const m = String(line).match(/^([a-zA-Z]+)(?:\(([^)]*)\))?[!]?:\s*(.+)$/);
  if (!m) return { type: "other", scope: null, subject: String(line).trim() };
  return { type: m[1].toLowerCase(), scope: m[2] ?? null, subject: m[3].trim() };
}

const SECTION_TITLES = { feat: "Features", fix: "Fixes", docs: "Docs" };

/** Gruppiert Commit-Zeilen in feat/fix/docs/other (reine Funktion, gut testbar). */
export function groupCommits(lines) {
  const groups = { feat: [], fix: [], docs: [], other: [] };
  for (const line of lines) {
    const text = String(line).trim();
    if (!text) continue;
    // Merge-Commits ("merge: ...") landen unverändert unter Sonstiges.
    if (/^merge:/i.test(text)) { groups.other.push(text); continue; }
    const c = parseCommitLine(text);
    if (c.type in groups && c.type !== "other") groups[c.type].push(c);
    else groups.other.push(text);
  }
  return groups;
}

function bullet(c) {
  return typeof c === "string" ? c : c.scope ? `${c.scope}: ${c.subject}` : c.subject;
}

/** Markdown-Sektion für docs/CHANGELOG.md (neueste Version oben, Caller prependet). */
export function renderChangelog(version, date, groups) {
  const out = [`## [${version}] - ${date}`, ""];
  for (const key of ["feat", "fix", "docs"]) {
    if (groups[key].length === 0) continue;
    out.push(`### ${SECTION_TITLES[key]}`, "");
    for (const c of groups[key]) out.push(`- ${bullet(c)}`);
    out.push("");
  }
  if (groups.other.length > 0) {
    out.push("### Sonstiges", "");
    for (const c of groups.other) out.push(`- ${bullet(c)}`);
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

/** Release-Notes für GitHub Release / `npm run release:notes`. */
export function renderReleaseNotes(version, tag, lines) {
  const groups = groupCommits(lines);
  const out = [`# AI Writer Studio v${version}`, ""];
  if (tag) out.push(`Änderungen seit \`${tag}\`:`, "");
  for (const key of ["feat", "fix", "docs"]) {
    if (groups[key].length === 0) continue;
    out.push(`## ${SECTION_TITLES[key]}`, "");
    for (const c of groups[key]) out.push(`- ${bullet(c)}`);
    out.push("");
  }
  if (groups.other.length > 0) {
    out.push("## Sonstiges", "");
    for (const c of groups.other) out.push(`- ${bullet(c)}`);
    out.push("");
  }
  if (lines.filter((l) => String(l).trim()).length === 0) out.push("_Keine Änderungen seit dem letzten Tag._", "");
  return `${out.join("\n").trimEnd()}\n`;
}

/** SHA256-Hex einer Datei (für Release-Artefakte). */
export async function sha256File(file) {
  const { readFile } = await import("node:fs/promises");
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
