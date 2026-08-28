// Figuren-Datenbank: Tests für CRUD, Konsistenz, Parsing.
import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "@/services/db";
import { createProject } from "@/services/project";
import {
  saveCharacter,
  listCharacters,
  getCharacter,
  deleteCharacter,
  checkCharacterConsistency,
  parseCharacterSuggestions,
} from "@/services/characters/characters";

describe("characters", () => {
  let projectId: string;

  beforeEach(async () => {
    await initDb();
    const project = await createProject("Test-Projekt");
    projectId = project.id;
  });

  it("speichert und listet Figuren", async () => {
    await saveCharacter({
      id: "char-1",
      projectId,
      name: "Anna",
      aliases: ["Anna M."],
      age: "32",
      role: "Protagonistin",
      traits: "mutig, klug",
      notes: "",
    });

    const chars = listCharacters(projectId);
    expect(chars).toHaveLength(1);
    expect(chars[0].name).toBe("Anna");
  });

  it("lädt eine Figur per ID", async () => {
    await saveCharacter({
      id: "char-1",
      projectId,
      name: "Bert",
      aliases: [],
      age: "45",
      role: "Antagonist",
      traits: "",
      notes: "",
    });

    const c = getCharacter("char-1");
    expect(c).not.toBeNull();
    expect(c!.name).toBe("Bert");
  });

  it("löscht Figuren", async () => {
    await saveCharacter({
      id: "char-1",
      projectId,
      name: "Temp",
      aliases: [],
      age: "",
      role: "",
      traits: "",
      notes: "",
    });

    expect(listCharacters(projectId)).toHaveLength(1);
    await deleteCharacter("char-1");
    expect(listCharacters(projectId)).toHaveLength(0);
  });

  it("warnt bei leerem Namen", () => {
    const warnings = checkCharacterConsistency({
      id: "c1",
      projectId,
      name: "",
      aliases: [],
      age: "",
      role: "",
      traits: "",
      notes: "",
      createdAt: 0,
      updatedAt: 0,
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].field).toBe("name");
  });

  it("warnt bei ungültigem Alter", () => {
    const warnings = checkCharacterConsistency({
      id: "c1",
      projectId,
      name: "Test",
      aliases: [],
      age: "alt",
      role: "",
      traits: "",
      notes: "",
      createdAt: 0,
      updatedAt: 0,
    });
    expect(warnings.some((w) => w.field === "age")).toBe(true);
  });

  it("parst LLM-Vorschläge korrekt", () => {
    const llm = "Anna|32|Protagonistin|mutig klug\nBert|45|Antagonist|grausam";
    const suggestions = parseCharacterSuggestions(llm);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].name).toBe("Anna");
    expect(suggestions[0].age).toBe("32");
    expect(suggestions[1].name).toBe("Bert");
  });
});
