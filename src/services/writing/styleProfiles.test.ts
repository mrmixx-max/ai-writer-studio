// Tests: Stilprofile — Presets, CRUD, YAML-Frontmatter-Import (Markdown).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  listStyleProfiles, createStyleProfile, updateStyleProfile, deleteStyleProfile,
  seedStylePresets, parseFrontmatter, importStyleProfileFromMarkdown, STYLE_PRESETS,
} from "./styleProfiles";

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Stil-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

describe("Stilprofile: Presets", () => {
  it("seedet die 3 Presets (Sachbuch klar, Ratgeber warm, Thriller temporeich)", () => {
    const profiles = listStyleProfiles(projectId);
    const names = profiles.map((p) => p.name);
    expect(names).toContain("Sachbuch klar");
    expect(names).toContain("Ratgeber warm");
    expect(names).toContain("Thriller temporeich");
    expect(profiles.filter((p) => p.isPreset)).toHaveLength(3);
  });

  it("Preset-Seed ist idempotent", () => {
    seedStylePresets();
    seedStylePresets();
    const presets = listStyleProfiles(projectId).filter((p) => p.isPreset);
    expect(presets).toHaveLength(3);
  });

  it("Presets haben systemHint und mind. 3 Regeln", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.systemHint.length).toBeGreaterThan(10);
      expect(p.rules.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("Stilprofile: CRUD", () => {
  it("create + list für ein Projekt", () => {
    createStyleProfile(projectId, "Mein Stil", "Knapp und nüchtern", ["Kein Passiv"]);
    const mine = listStyleProfiles(projectId).filter((p) => p.projectId === projectId);
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Mein Stil");
    expect(mine[0].rules).toEqual(["Kein Passiv"]);
  });

  it("update ändert Regeln", () => {
    const p = createStyleProfile(projectId, "Alt", "alt", ["A"]);
    updateStyleProfile(p.id, { name: "Neu", rules: ["B", "C"] });
    const loaded = listStyleProfiles(projectId).find((x) => x.id === p.id)!;
    expect(loaded.name).toBe("Neu");
    expect(loaded.rules).toEqual(["B", "C"]);
  });

  it("delete entfernt das Profil", () => {
    const p = createStyleProfile(projectId, "Weg", "", []);
    deleteStyleProfile(p.id);
    expect(listStyleProfiles(projectId).find((x) => x.id === p.id)).toBeUndefined();
  });
});

describe("Stilprofile: YAML-Frontmatter-Import", () => {
  it("parst Frontmatter mit rules-Liste", () => {
    const md = `---
name: Krimi nörfel
systemHint: Nüchtern, Temperament im Unterbau
rules:
  - Keine Adjektivketten
  - Max. 18 Wörter pro Satz
---

Freier Beschreibungstext.`;
    const parsed = parseFrontmatter(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.data.name).toBe("Krimi nörfel");
    expect(parsed!.data.systemHint).toBe("Nüchtern, Temperament im Unterbau");
    expect(parsed!.data.rules).toEqual(["Keine Adjektivketten", "Max. 18 Wörter pro Satz"]);
    expect(parsed!.body.trim()).toBe("Freier Beschreibungstext.");
  });

  it("importiert ein Profil aus Markdown (Akzeptanzkriterium)", () => {
    const md = `---
name: Import-Test
systemHint: Klar und sachlich
rules:
  - Regel Eins
  - Regel Zwei
---
Text danach.`;
    const p = importStyleProfileFromMarkdown(md, projectId);
    expect(p.name).toBe("Import-Test");
    expect(p.systemHint).toBe("Klar und sachlich");
    expect(p.rules).toEqual(["Regel Eins", "Regel Zwei"]);
    const loaded = listStyleProfiles(projectId).find((x) => x.id === p.id);
    expect(loaded).toBeDefined();
    expect(loaded!.isPreset).toBe(false);
  });

  it("akzeptiert quoted Werte und Einzel-String-Regel", () => {
    const md = `---
name: "Quoted Profil"
systemHint: 'Hint in Anführungszeichen'
rules: Nur eine Regel
---
`;
    const p = importStyleProfileFromMarkdown(md, projectId);
    expect(p.name).toBe("Quoted Profil");
    expect(p.rules).toEqual(["Nur eine Regel"]);
  });

  it("wirft ohne Frontmatter", () => {
    expect(() => importStyleProfileFromMarkdown("Kein Frontmatter", projectId))
      .toThrow(/Kein YAML-Frontmatter/);
  });

  it("wirft ohne name", () => {
    const md = `---
systemHint: nur hint
---
`;
    expect(() => importStyleProfileFromMarkdown(md, projectId)).toThrow(/'name'/);
  });

  it("ignoriert Kommentare und Leerzeilen im Frontmatter", () => {
    const md = `---
# Kommentar
name: Kommentar-Profil
rules:
  # Kommentar in Liste
  - Regel A
---
`;
    const p = importStyleProfileFromMarkdown(md, projectId);
    expect(p.rules).toEqual(["Regel A"]);
  });
});