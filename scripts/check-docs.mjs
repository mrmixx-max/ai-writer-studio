#!/usr/bin/env node
/**
 * check-docs.mjs — Dokulink-Audit (read-only).
 *
 * Prüft:
 *  1. Jede im Index `docs/README.md` per Backticks referenzierte `.md`-Datei existiert.
 *  2. Jeder Markdown-Link `[text](ziel)` in `docs/*.md` auf eine lokale Datei
 *     (`.md`, Bilder, `.pdf`, …) zeigt auf eine existierende Datei.
 *  3. Dateilokale Sprungmarken `[text](#anker)` lösen gegen die Überschriften
 *     derselben Datei auf (GitHub-Slug-Regel).
 *
 * Externe URLs (http/https/mailto) und reine CLI-Beispiele ohne Link-Syntax
 * werden ignoriert. Exit-Code 1 bei toten Links, sonst 0.
 *
 * Nutzung: node scripts/check-docs.mjs [--root <pfad>] [--json]
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..");

/** GitHub-Anchor-Slug für eine Markdown-Überschrift. */
export function slugifyHeading(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\- _]/gu, "")
    .replace(/ /g, "-");
}

/** Alle Überschriften-Anker einer Markdown-Datei (GitHub-Regel). */
export function collectAnchors(markdown) {
  const anchors = new Set();
  for (const line of markdown.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.*)\s*$/);
    if (m) anchors.add(slugifyHeading(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")));
  }
  return anchors;
}

/** Markdown-Links `[text](ziel)` einsammeln (Bilder via `!` eingeschlossen). */
export function collectLinks(markdown) {
  const links = [];
  const re = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) links.push(m[1]);
  return links;
}

/** Backtick-Spans aus dem Index einsammeln (`datei.md`). */
export function collectIndexRefs(markdown) {
  const refs = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1].endsWith(".md")) refs.push(m[1]);
  }
  return [...new Set(refs)];
}

export function isExternal(target) {
  return /^(https?:|mailto:|ftp:)/i.test(target);
}

/**
 * Audit über `docsDir`. Gibt { errors: string[], checkedFiles: number } zurück.
 * Rein lesend — schreibt keine einzige Datei.
 */
export function auditDocs(docsDir) {
  const errors = [];
  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
  const basenames = new Set(files);

  // 1) Index-Vollständigkeit: jede referenzierte Datei muss existieren.
  const indexPath = path.join(docsDir, "README.md");
  if (!existsSync(indexPath)) {
    errors.push("docs/README.md fehlt (Index)");
  } else {
    const indexMd = readFileSync(indexPath, "utf8");
    for (const ref of collectIndexRefs(indexMd)) {
      const base = path.basename(ref);
      if (!basenames.has(base) && !existsSync(path.join(docsDir, base))) {
        errors.push(`Index verweist auf fehlende Datei: ${ref}`);
      }
    }
    // Umgekehrt: jede Sprint-/Themendatei sollte im Index auffindbar sein.
    const indexBases = new Set(collectIndexRefs(indexMd).map((r) => path.basename(r)));
    for (const f of files) {
      if (f === "README.md") continue; // der Index selbst
      if (!indexBases.has(f)) {
        errors.push(`Datei nicht im Index verlinkt: ${f}`);
      }
    }
  }

  // 2) + 3) Linkziele + Anker je Datei.
  for (const f of files) {
    const full = path.join(docsDir, f);
    const md = readFileSync(full, "utf8");
    const anchors = collectAnchors(md);
    for (const target of collectLinks(md)) {
      if (isExternal(target) || target.startsWith("#")) {
        if (target.startsWith("#")) {
          const slug = target.slice(1);
          if (!anchors.has(slug)) errors.push(`${f}: toter Anker #${slug}`);
        }
        continue;
      }
      const [filePart, anchor] = target.split("#");
      if (!filePart) continue;
      // Nur lokale Datei-Ziele mit Endung prüfen (keine Routen/Platzhalter).
      if (!/\.[a-z0-9]{2,4}$/i.test(filePart)) continue;
      const resolved = path.resolve(docsDir, filePart);
      if (!existsSync(resolved)) {
        errors.push(`${f}: tote Datei-Referenz ${target}`);
        continue;
      }
      if (anchor && filePart.endsWith(".md")) {
        const other = readFileSync(resolved, "utf8");
        if (!collectAnchors(other).has(anchor)) {
          errors.push(`${f}: toter Anker ${target}`);
        }
      }
    }
  }

  return { errors, checkedFiles: files.length };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const rootIdx = process.argv.indexOf("--root");
  const root = rootIdx >= 0 ? path.resolve(process.argv[rootIdx + 1]) : DEFAULT_ROOT;
  const asJson = process.argv.includes("--json");
  const { errors, checkedFiles } = auditDocs(path.join(root, "docs"));
  if (asJson) {
    console.log(JSON.stringify({ checkedFiles, errors }, null, 2));
  } else {
    console.log(`check-docs: ${checkedFiles} Dateien geprüft`);
    if (errors.length === 0) console.log("✓ Keine toten Links, Index vollständig.");
    else {
      console.log(`✗ ${errors.length} Problem(e):`);
      for (const e of errors) console.log(`  - ${e}`);
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}
