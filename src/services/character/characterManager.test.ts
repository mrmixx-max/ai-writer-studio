// Tests für die Character Engine (CRUD + Beziehungen + Auto-Detect + Export).
import { describe, it, expect, beforeEach } from "vitest";
import {
  createCharacter, updateCharacter, deleteCharacter, getCharacters, getCharacter,
  addRelationship, detectCharacters, exportToJSON, resetCharacterStore,
} from "./characterManager";

beforeEach(() => resetCharacterStore());

describe("characterManager", () => {
  it("createCharacter() erzeugt einen Charakter mit ID", async () => {
    const c = await createCharacter({ name: "Anna Berger", age: 34, occupation: "Detektivin" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Anna Berger");
    const all = await getCharacters();
    expect(all).toHaveLength(1);
  });

  it("updateCharacter() aktualisiert Felder, getCharacter() lädt einzeln", async () => {
    const c = await createCharacter({ name: "Bernd" });
    const updated = await updateCharacter(c.id, { occupation: "Schmied", arc: "redemption" });
    expect(updated.occupation).toBe("Schmied");
    expect(updated.arc).toBe("redemption");
    expect(await getCharacter(c.id)).toMatchObject({ occupation: "Schmied" });
    expect(await getCharacter("unbekannt")).toBeUndefined();
  });

  it("deleteCharacter() löscht und räumt fremde Beziehungen auf", async () => {
    const a = await createCharacter({ name: "Anna" });
    const b = await createCharacter({ name: "Bernd" });
    await addRelationship(a.id, b.id, "Freundschaft");
    await deleteCharacter(b.id);
    expect(await getCharacters()).toHaveLength(1);
    expect((await getCharacter(a.id))?.relationships).toHaveLength(0);
  });

  it("addRelationship() verknüpft zwei Charaktere", async () => {
    const a = await createCharacter({ name: "Anna" });
    const b = await createCharacter({ name: "Bernd" });
    await addRelationship(a.id, b.id, "Rivale");
    const loaded = await getCharacter(a.id);
    expect(loaded?.relationships).toEqual([{ characterId: b.id, type: "Rivale" }]);
    await expect(addRelationship(a.id, a.id, "Ich")).rejects.toThrow();
  });

  it("detectCharacters() erkennt Namen aus Text", async () => {
    const text = "Anna Berger betrat den Raum. Bernd starrte sie an. Anna Berger lächelte, doch Bernd schwieg.";
    const found = await detectCharacters(text);
    const names = found.map((f) => f.name);
    expect(names).toContain("Anna Berger");
    expect(names).toContain("Bernd");
    expect(names).not.toContain("Raum");
  });

  it("exportToJSON() exportiert alle Charaktere als JSON", async () => {
    await createCharacter({ name: "Anna" });
    const json = exportToJSON(await getCharacters());
    const parsed = JSON.parse(json);
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.characters[0].name).toBe("Anna");
  });
});
