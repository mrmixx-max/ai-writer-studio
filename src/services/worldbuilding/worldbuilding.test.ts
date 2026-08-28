// Worldbuilding-Service-Tests: Bible, Locations, Lore, Konsistenz, Export.
import { describe, it, expect, beforeEach } from "vitest";
import { getDb, initDb } from "@/services/db";
import { createProject, createChapter } from "@/services/project";
import { saveCharacter } from "@/services/characters/characters";
import {
  getWorldBible, ensureWorldBible, saveWorldBible, addWorldRule,
  deleteWorldRule, addHistoryEvent, deleteHistoryEvent,
} from "@/services/worldbuilding/worldbible";
import {
  listLocations, createLocation, saveLocation, deleteLocation,
} from "@/services/worldbuilding/locations";
import {
  listLore, createLoreEntry, deleteLoreEntry, countLoreMentions,
} from "@/services/worldbuilding/lore";
import {
  checkWorldConsistency, reportToMarkdown,
} from "@/services/worldbuilding/consistency";
import {
  buildWorldbuildingBundle, worldbuildingToJson, worldbuildingToMarkdown,
  locationsToSvg,
} from "@/services/worldbuilding/worldbuildingExport";

let projectId: string;

beforeEach(async () => {
  await initDb();
  const db = getDb();
  db.run("DELETE FROM projects");
  const p = await createProject("Weltprojekt");
  projectId = p.id;
});

describe("World-Bible", () => {
  it("erstellt lazily und speichert Felder", async () => {
    const b = ensureWorldBible(projectId);
    expect(b.projectId).toBe(projectId);
    await saveWorldBible(projectId, { name: "Aetheria", premise: "Magie kostet Erinnerung." });
    const loaded = getWorldBible(projectId)!;
    expect(loaded.name).toBe("Aetheria");
    expect(loaded.premise).toContain("Erinnerung");
  });

  it("Regeln und Geschichte add/delete", async () => {
    const rule = await addWorldRule(projectId, "Magie verblasst bei Mondfinsternis", "Magie");
    expect(getWorldBible(projectId)!.rules).toHaveLength(1);
    await deleteWorldRule(projectId, rule.id);
    expect(getWorldBible(projectId)!.rules).toHaveLength(0);

    await addHistoryEvent(projectId, "1200", "Der Große Krieg", "Zerstörte Altefels");
    const ev = getWorldBible(projectId)!.history[0];
    expect(ev.year).toBe("1200");
    await deleteHistoryEvent(projectId, ev.id);
    expect(getWorldBible(projectId)!.history).toHaveLength(0);
  });
});

describe("Locations", () => {
  it("CRUD mit Koordinaten", async () => {
    const loc = await createLocation(projectId, { name: "Altefels", type: "Stadt", x: 200, y: 300, description: "Hauptstadt" });
    expect(listLocations(projectId)).toHaveLength(1);
    await saveLocation({ ...loc, x: 400 });
    expect(listLocations(projectId)[0].x).toBe(400);
    await deleteLocation(loc.id);
    expect(listLocations(projectId)).toHaveLength(0);
  });
});

describe("Lore", () => {
  it("CRUD + Mention-Zählung mit Aliasen", async () => {
    const entry = await createLoreEntry(projectId, {
      name: "Aetherstein", category: "Artefakt", aliases: ["Der Stein"], description: "Uraltes Relikt",
    });
    const all = listLore(projectId);
    expect(all).toHaveLength(1);
    expect(all[0].category).toBe("Artefakt");
    expect(countLoreMentions(all[0], "Der Aetherstein glüht. Der Stein flüstert.")).toBe(2);
    await deleteLoreEntry(entry.id);
    expect(listLore(projectId)).toHaveLength(0);
  });
});

describe("Konsistenz-Checker", () => {
  it("findet unerwähnte Figuren/Orte und Tippfehler", async () => {
    await saveCharacter({
      id: "c1", projectId, name: "Lyra", aliases: [], age: "28",
      role: "", traits: "", notes: "",
    });
    await createLocation(projectId, { name: "Altefels" });
    await createLocation(projectId, { name: "Nirgendmoor" });
    const ch = await createChapter(projectId, "Kapitel 1", "lyra betrat Altefels.");
    const db = getDb();
    db.run("UPDATE chapters SET content = ? WHERE id = ?", [
      "lyra betrat Altefels.", ch.id,
    ]);

    const report = checkWorldConsistency(projectId);
    expect(report.chaptersChecked).toBe(1);
    const chars = report.mentions.characters.find((m) => m.name === "Lyra");
    expect(chars!.total).toBeGreaterThanOrEqual(1); // 1× kleingeschrieben → Typo-Warnung
    expect(report.findings.some((f) => f.kind === "character" && f.severity === "warning")).toBe(true);
    expect(report.findings.some((f) => f.kind === "location" && f.name === "Nirgendmoor" && f.severity === "info")).toBe(true);

    const md = reportToMarkdown(report);
    expect(md).toContain("Konsistenz-Report");
    expect(md).toContain("Lyra");
  });
});

describe("Export", () => {
  it("JSON + Markdown Bundle", async () => {
    await saveWorldBible(projectId, { name: "Aetheria" });
    await addWorldRule(projectId, "Testregel", "Magie");
    await createLocation(projectId, { name: "Altefels", type: "Stadt", x: 100, y: 200 });
    await createLoreEntry(projectId, { name: "Aetherstein", category: "Artefakt" });

    const bundle = buildWorldbuildingBundle(
      projectId, getWorldBible(projectId), listLocations(projectId), listLore(projectId),
    );
    const json = worldbuildingToJson(bundle);
    expect(JSON.parse(json).bible.name).toBe("Aetheria");
    const md = worldbuildingToMarkdown(bundle);
    expect(md).toContain("# Welt-Bible");
    expect(md).toContain("## Orte");
    expect(md).toContain("Aetherstein");
  });

  it("SVG-Karten-Export enthält Orte", async () => {
    await createLocation(projectId, { name: "Altefels", type: "Stadt", x: 250, y: 500 });
    const svg = locationsToSvg(listLocations(projectId), { title: "Meine Karte" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("Meine Karte");
    expect(svg).toContain("Altefels");
  });
});
