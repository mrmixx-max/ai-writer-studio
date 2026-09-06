#!/usr/bin/env node
// updater-feed.mjs — Sprint 11, Agent 1 (key-agnostic Updater-Feed).
//
// Baut `latest.json` (Tauri-Updater-Feed) aus einem GitHub-Release.
// Key-agnostisch: signiert NUR, wenn TAURI_SIGNING_PRIVATE_KEY gesetzt ist.
// Ohne Key wird ein UNSIGNED-DRAFT geschrieben und vor dem Publizieren
// gestoppt — es werden niemals Keys erzeugt oder ausgegeben.
//
// Nutzung:
//   node scripts/updater-feed.mjs --repo owner/name --version 1.1.0 \
//     --notes "Neu: ..." --out latest.json
//   node scripts/updater-feed.mjs --release-json release.json --out latest.json
//   node scripts/updater-feed.mjs --repo owner/name --tag v1.1.0 \
//     --notes-file NOTES.md --out latest.json [--asset-url ...] [--sig ...]
//
// release.json-Format (Fixture, kein Netzwerk):
//   { "tag": "v1.1.0", "body": "notes", "assets": [{ "name": "...", "url": "..." }] }
//
// Signaturen: --sig "<target>=<sig>" (wiederholbar) oder --sigs-json file.
// Ohne TAURI_SIGNING_PRIVATE_KEY werden Signaturen NICHT übernommen —
// der Draft erhält leere Signaturen + "unsigned": true und Exit-Code 2.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export const KEYGEN_HINT =
  "Kein Signing-Key gefunden. Key erzeugen mit: tauri signer generate -w";

export const SUPPORTED_TARGETS = ["windows-x86_64"];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/** "v1.2.3" → "1.2.3"; wirft bei ungültigem Format. */
export function normalizeVersion(v) {
  const s = String(v ?? "").trim().replace(/^v/i, "");
  if (!SEMVER.test(s)) throw new Error(`Ungueltige Version: ${JSON.stringify(v)}`);
  return s;
}

/** Prüft, ob ein Signing-Key in der Umgebung gesetzt ist (nur Bool, kein Wert). */
export function hasSigningKey(env = process.env) {
  const v = env?.TAURI_SIGNING_PRIVATE_KEY ?? env?.TAURI_PRIVATE_KEY ?? "";
  return String(v).trim().length > 0;
}

/** Dateiname des Windows-Updater-Artefakts für eine Version. */
export function windowsAssetName(version) {
  return `AI-Writer-Studio_${normalizeVersion(version)}_x64-setup.nsis.zip`;
}

/** Download-URL eines Release-Assets (tag behält v-Präfix). */
export function assetUrl(repo, tag, assetName) {
  const r = String(repo ?? "").trim().replace(/\/+$/, "");
  if (!r || !r.includes("/")) throw new Error(`Ungueltiges Repo: ${JSON.stringify(repo)}`);
  const t = String(tag ?? "").trim();
  if (!t) throw new Error("Tag fehlt (z. B. v1.1.0 erwartet).");
  return `https://github.com/${r}/releases/download/${t}/${assetName}`;
}

/**
 * Baut die platforms-Map aus Asset-Liste.
 * assets: [{name, url}]; sigs: {assetName|target: signature}.
 * Fehlt das Windows-Asset, wird die URL aus repo+tag synthetisiert.
 */
export function buildPlatforms({ repo, tag, version, assets = [], sigs = {}, allowUnsigned = false }) {
  const ver = normalizeVersion(version ?? tag);
  const t = String(tag ?? `v${ver}`).trim() || `v${ver}`;
  const wanted = windowsAssetName(ver);
  const list = Array.isArray(assets) ? assets : [];
  const found = list.find((a) => a && a.name === wanted);
  const url = found?.url ?? (repo ? assetUrl(repo, t, wanted) : null);
  if (!url) throw new Error(`Windows-Asset fehlt und Repo unbekannt (erwartet: ${wanted}).`);
  const sig =
    sigs[wanted] ?? sigs["windows-x86_64"] ?? found?.signature ?? "";
  if (!String(sig).trim() && !allowUnsigned) {
    throw new Error(`Signatur fehlt fuer ${wanted} (oder allowUnsigned=true setzen).`);
  }
  return { "windows-x86_64": { url, signature: String(sig).trim() } };
}

/**
 * Baut das Feed-Objekt. notes Default: "" (Tauri toleriert leere Notes).
 * pubDate Default: jetzt (ISO). unsigned=true markiert Drafts ohne Key.
 */
export function buildFeed({ version, notes = "", pubDate, platforms, unsigned = false }) {
  const ver = normalizeVersion(version);
  if (!platforms || typeof platforms !== "object" || Object.keys(platforms).length === 0) {
    throw new Error("platforms fehlt (mind. ein Target erforderlich).");
  }
  for (const [target, p] of Object.entries(platforms)) {
    if (!p || typeof p.url !== "string" || !p.url.startsWith("https://")) {
      throw new Error(`Ungueltige URL fuer ${target}.`);
    }
    if (!unsigned && (!p.signature || !String(p.signature).trim())) {
      throw new Error(`Signatur fehlt fuer ${target}.`);
    }
  }
  const feed = {
    version: ver,
    pub_date: pubDate ?? new Date().toISOString(),
    notes: String(notes ?? ""),
    platforms,
  };
  if (unsigned) feed.unsigned = true;
  return feed;
}

/** Wirft bei ungültigem Feed (strikte Prüfung, ohne unsigned-Toleranz). */
export function validateFeed(feed) {
  if (!feed || typeof feed !== "object") throw new Error("Feed ist kein Objekt.");
  normalizeVersion(feed.version);
  if (typeof feed.notes !== "string") throw new Error("notes muss ein String sein.");
  if (Number.isNaN(Date.parse(feed.pub_date))) throw new Error("pub_date ist kein Datum.");
  if (!feed.platforms || typeof feed.platforms !== "object") throw new Error("platforms fehlt.");
  for (const [t, p] of Object.entries(feed.platforms)) {
    if (!p?.url?.startsWith("https://")) throw new Error(`URL fehlt/ungueltig: ${t}`);
    if (!p?.signature?.trim()) throw new Error(`Signatur fehlt: ${t}`);
  }
  return true;
}

export function renderFeed(feed) {
  return `${JSON.stringify(feed, null, 2)}\n`;
}

/** Extrahiert {version, notes, tag, assets} aus release.json-Objekt. */
export function fromReleaseJson(rel) {
  if (!rel || typeof rel !== "object") throw new Error("release.json ist kein Objekt.");
  const tag = rel.tag ?? rel.tag_name ?? "";
  const version = rel.version ?? tag;
  return {
    tag: String(tag || "").trim(),
    version: normalizeVersion(version),
    notes: String(rel.body ?? rel.notes ?? ""),
    assets: Array.isArray(rel.assets) ? rel.assets : [],
  };
}

export function parseArgs(argv) {
  const o = {
    repo: null, tag: null, version: null, notes: null, notesFile: null,
    out: "latest.json", releaseJson: null, assetUrls: [], sigs: {}, sigsJson: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") o.repo = argv[++i];
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--version") o.version = argv[++i];
    else if (a === "--notes") o.notes = argv[++i];
    else if (a === "--notes-file") o.notesFile = argv[++i];
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--release-json") o.releaseJson = argv[++i];
    else if (a === "--sigs-json") o.sigsJson = argv[++i];
    else if (a === "--asset-url") o.assetUrls.push(argv[++i]);
    else if (a === "--sig") {
      const kv = String(argv[++i] ?? "");
      const eq = kv.indexOf("=");
      if (eq === -1) throw new Error("--sig braucht Format <target|assetName>=<signatur>.");
      o.sigs[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (a === "--help" || a === "-h") o.help = true;
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/updater-feed.mjs --repo <owner/name> [--tag vX.Y.Z] [--version X.Y.Z] [--notes ...] [--notes-file F] [--release-json F] [--out latest.json] [--sig <target>=<sig>]");
    process.exit(0);
  }

  let info = { tag: args.tag ?? "", version: args.version ?? args.tag ?? "", notes: args.notes ?? "", assets: [] };
  if (args.releaseJson) {
    const rel = JSON.parse(readFileSync(args.releaseJson, "utf8"));
    info = { ...fromReleaseJson(rel) };
    if (args.version) info.version = args.version;
    if (args.tag) info.tag = args.tag;
    if (args.notes) info.notes = args.notes;
  }
  if (args.notesFile) info.notes = readFileSync(args.notesFile, "utf8");
  for (const u of args.assetUrls) {
    const name = String(u).split("/").pop();
    info.assets.push({ name, url: u });
  }
  if (args.sigsJson) Object.assign(args.sigs, JSON.parse(readFileSync(args.sigsJson, "utf8")));

  const signed = hasSigningKey();
  // Ohne Key: Signaturen niemals übernehmen — Draft bleibt unsigned.
  const sigs = signed ? args.sigs : {};
  const version = normalizeVersion(info.version);
  const tag = info.tag?.trim() || `v${version}`;
  const platforms = buildPlatforms({
    repo: args.repo, tag, version, assets: info.assets, sigs, allowUnsigned: !signed,
  });
  const feed = buildFeed({ version, notes: info.notes ?? "", platforms, unsigned: !signed });
  writeFileSync(args.out, renderFeed(feed), "utf8");
  console.log(`Feed-Draft geschrieben: ${path.resolve(args.out)} (v${version}${signed ? "" : ", UNSIGNED"})`);
  if (!signed) {
    console.log(KEYGEN_HINT);
    console.log("Stopp vor Publishing: latest.json NICHT als Release-Asset hochladen, bis signiert.");
    process.exit(2);
  }
}

const isMain = process.argv[1] && path.basename(process.argv[1]) === "updater-feed.mjs";
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(`✗ updater-feed: ${e.message}`);
    process.exit(1);
  }
}
