// Stilprofile: { id, name, systemHint, rules[] } pro Projekt.
//
// Offenes Format: Profile können als Markdown-Datei mit YAML-Frontmatter
// importiert werden:
//
//   ---
//   name: Krimi nörfel
//   systemHint: Nüchtern, Temperament im Unterbau
//   rules:
//     - Keine Adjektivketten
//     - Max. 18 Wörter pro Satz
//   ---
//   Freier Beschreibungstext wird ignoriert.
//
// 3 Presets (sachbuch, ratgeber, thriller) werden bei leerem Bestand
// seed-seitig angelegt (is_preset = 1).

import { getDb, persistNow } from "@/services/db";
import { uid } from "@/services/knowledge/util";

/** Ein Stilprofil. */
export interface StyleProfile {
  id: string;
  /** project_id = null → globales Preset. */
  projectId: string | null;
  name: string;
  /** Hint, der als System-Prompt-Anteil in die Revisions-Pipeline geht. */
  systemHint: string;
  /** Konkrete, prüfbare Stilregeln. */
  rules: string[];
  isPreset: boolean;
  createdAt: number;
  updatedAt: number;
}

const COLUMNS = `id, project_id, name, system_hint, rules_json, is_preset, created_at, updated_at`;

function rowToProfile(r: unknown[]): StyleProfile {
  let rules: string[] = [];
  try {
    const parsed = JSON.parse(String(r[4] ?? "[]"));
    if (Array.isArray(parsed)) rules = parsed.map(String);
  } catch {
    rules = [];
  }
  return {
    id: String(r[0]),
    projectId: r[1] === null || r[1] === undefined ? null : String(r[1]),
    name: String(r[2]),
    systemHint: String(r[3] ?? ""),
    rules,
    isPreset: Number(r[5] ?? 0) === 1,
    createdAt: Number(r[6] ?? 0),
    updatedAt: Number(r[7] ?? 0),
  };
}

// --- 3 Presets (Sprint-2 Vorgabe) -------------------------------------------

/** Preset-Definitionen (werden Seed-seitig in die DB geschrieben). */
export const STYLE_PRESETS: Array<Omit<StyleProfile, "id" | "projectId" | "createdAt" | "updatedAt" | "isPreset">> = [
  {
    name: "Sachbuch klar",
    systemHint:
      "Schreibe klar, präzise und sachlich. Jeder Absatz transportiert genau eine Kernaussage. Fachbegriffe werden beim ersten Auftreten definiert.",
    rules: [
      "Max. 18 Wörter pro Satz",
      "Keine Füllwörter (also, eigentlich, irgendwie)",
      "Aktiv statt Passiv",
      "Jeder Absatz eine Kernaussage",
      "Beispiele immer konkret (Zahlen, Namen)",
    ],
  },
  {
    name: "Ratgeber warm",
    systemHint:
      "Schreibe warm und ermutigend, du-Form. Sprich die Leserin/den Leser direkt an, erkenne Schwierigkeiten an und gib sofort umsetzbare Schritte.",
    rules: [
      "Du-Anrede durchgängig",
      "Jedes Kapitel mit direkter Ansprache beginnen",
      "Nach jeder Anleitung ein Mini-Beispiel",
      "Kein Fachjargon ohne Übersetzung",
      "Sätze max. 20 Wörter",
    ],
  },
  {
    name: "Thriller temporeich",
    systemHint:
      "Schreibe temporeich und knapp. Kurze Sätze in Spannungsmomenten, harte Schnittwechsel, keine Erklärungen, die die Handlung aufhalten.",
    rules: [
      "Spannungsmomente: Sätze unter 10 Wörtern",
      "Keine inneren Monologe über 3 Zeilen",
      "Verben statt Adjektive",
      "Jede Szene endet mit Cliffhanger oder Wendung",
      "Kein/adverbialer Vorspann (Plötzlich, Schließlich vermeiden)",
    ],
  },
];

/** Legt die 3 Presets an, wenn noch keine Profile existieren (idempotent). */
export function seedStylePresets(): void {
  const db = getDb();
  const res = db.exec("SELECT COUNT(*) FROM style_profiles");
  const n = res.length && res[0].values.length ? Number(res[0].values[0][0]) : 0;
  if (n > 0) return;
  const now = Date.now();
  for (const p of STYLE_PRESETS) {
    db.run(
      `INSERT INTO style_profiles (${COLUMNS}) VALUES (?,?,?,?,?,?,?,?)`,
      [uid("sty"), null, p.name, p.systemHint, JSON.stringify(p.rules), 1, now, now],
    );
  }
  void persistNow();
}

/** Alle Profile eines Projekts (plus globale Presets). */
export function listStyleProfiles(projectId: string | null = null): StyleProfile[] {
  seedStylePresets();
  const db = getDb();
  const res = db.exec(
    `SELECT ${COLUMNS} FROM style_profiles WHERE project_id IS NULL OR project_id = ? ORDER BY is_preset DESC, name ASC`,
    [projectId],
  );
  if (!res.length) return [];
  return res[0].values.map(rowToProfile);
}

/** Legt ein Profil an. */
export function createStyleProfile(
  projectId: string | null,
  name: string,
  systemHint: string,
  rules: string[],
  isPreset = false,
): StyleProfile {
  const db = getDb();
  const now = Date.now();
  const id = uid("sty");
  db.run(
    `INSERT INTO style_profiles (${COLUMNS}) VALUES (?,?,?,?,?,?,?,?)`,
    [id, projectId, name, systemHint, JSON.stringify(rules), isPreset ? 1 : 0, now, now],
  );
  void persistNow();
  return {
    id,
    projectId,
    name,
    systemHint,
    rules,
    isPreset,
    createdAt: now,
    updatedAt: now,
  };
}

/** Aktualisiert ein Profil. */
export function updateStyleProfile(id: string, updates: Partial<Pick<StyleProfile, "name" | "systemHint" | "rules">>): void {
  const db = getDb();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); args.push(updates.name); }
  if (updates.systemHint !== undefined) { sets.push("system_hint = ?"); args.push(updates.systemHint); }
  if (updates.rules !== undefined) { sets.push("rules_json = ?"); args.push(JSON.stringify(updates.rules)); }
  if (!sets.length) return;
  sets.push("updated_at = ?");
  args.push(Date.now(), id);
  db.run(`UPDATE style_profiles SET ${sets.join(", ")} WHERE id = ?`, args);
  void persistNow();
}

/** Löscht ein Profil (Presets lassen sich löschen — Nutzer-Entscheidung). */
export function deleteStyleProfile(id: string): void {
  getDb().run("DELETE FROM style_profiles WHERE id = ?", [id]);
  void persistNow();
}

// --- YAML-Frontmatter-Import (bewusst ohne yaml-Dependency) ------------------

/**
 * Parst YAML-Frontmatter aus Markdown. Unterstützt die für Stilprofile
 * nötige Teilmenge: Skalar-Keys (name, systemHint) und List-Keys (rules)
 * im "- Item"-Format. Gibt null zurück, wenn kein Frontmatter vorhanden ist.
 */
export function parseFrontmatter(md: string): { data: Record<string, string | string[]>; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(md);
  if (!match) return null;
  const data: Record<string, string | string[]> = {};
  let currentKey: string | null = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "    ");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      const existing = data[currentKey];
      const arr = Array.isArray(existing) ? existing : existing !== undefined ? [String(existing)] : [];
      arr.push(listItem[1].trim().replace(/^["']|["']$/g, ""));
      data[currentKey] = arr;
      continue;
    }
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1];
      const value = kv[2].trim().replace(/^["']|["']$/g, "");
      if (value === "") data[currentKey] = [];
      else data[currentKey] = value;
    }
  }
  return { data, body: md.slice(match[0].length) };
}

/**
 * Importiert ein Stilprofil aus Markdown (YAML-Frontmatter).
 * Wirft eine sprechende Fehlermeldung, wenn Pflichtfelder fehlen.
 */
export function importStyleProfileFromMarkdown(md: string, projectId: string | null): StyleProfile {
  const parsed = parseFrontmatter(md);
  if (!parsed) {
    throw new Error("Stilprofil-Import: Kein YAML-Frontmatter gefunden (erwartet: --- ... --- am Dateianfang).");
  }
  const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  if (!name) throw new Error("Stilprofil-Import: Frontmatter-Feld 'name' fehlt oder ist leer.");
  const systemHint = typeof parsed.data.systemHint === "string" ? parsed.data.systemHint : "";
  const rulesRaw = parsed.data.rules;
  const rules = Array.isArray(rulesRawSafe(rulesRaw)) ? rulesRawSafe(rulesRaw) : [];
  return createStyleProfile(projectId, name, systemHint, rules);
}

/** Liste von Regeln aus Frontmatter-Wert (string[] oder einzelner String). */
function rulesRawSafe(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x.trim().length > 0);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}