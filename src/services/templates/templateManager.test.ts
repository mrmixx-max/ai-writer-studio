// @vitest-environment jsdom
// Tests für den TemplateManager: CRUD + Rendern + Kategorie-Filter.
import { describe, it, expect, beforeEach } from "vitest";
import {
  createTemplate,
  getTemplates,
  getTemplatesByCategory,
  getTemplateById,
  deleteTemplate,
  renderTemplate,
  resetTemplates,
} from "./templateManager";

beforeEach(async () => {
  await resetTemplates();
});

describe("createTemplate", () => {
  it("erzeugt ein Template mit vergebener ID", async () => {
    const created = await createTemplate({
      name: "Test-Essay",
      category: "essay",
      description: "Zum Testen",
      prompt: "Schreibe einen Essay über {{topic}}.",
      variables: [
        { name: "topic", label: "Thema", type: "text", defaultValue: "Zeit" },
      ],
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Test-Essay");
    const all = await getTemplates();
    expect(all.some((t) => t.id === created.id)).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("ersetzt Variablen durch übergebene Werte", async () => {
    const created = await createTemplate({
      name: "R-Test",
      category: "blog",
      description: "",
      prompt: "Thema: {{topic}}, Ton: {{tone}}.",
      variables: [
        { name: "topic", label: "Thema", type: "text", defaultValue: "Fallback" },
        { name: "tone", label: "Ton", type: "text", defaultValue: "sachlich" },
      ],
    });
    const out = await renderTemplate(created.id, { topic: "KI" });
    expect(out).toBe("Thema: KI, Ton: sachlich.");
  });

  it("nutzt Leerstring für unbekannte Platzhalter und wirft bei unbekannter ID", async () => {
    const created = await createTemplate({
      name: "R-Test2",
      category: "email",
      description: "",
      prompt: "Hallo {{name}} {{missing}}!",
      variables: [
        { name: "name", label: "Name", type: "text", defaultValue: "" },
      ],
    });
    expect(await renderTemplate(created.id, { name: "Anna" })).toBe(
      "Hallo Anna !",
    );
    await expect(renderTemplate("gibt-es-nicht", {})).rejects.toThrow();
  });
});

describe("getTemplatesByCategory", () => {
  it("filtert korrekt nach Kategorie", async () => {
    const novels = await getTemplatesByCategory("novel");
    expect(novels.length).toBeGreaterThan(0);
    expect(novels.every((t) => t.category === "novel")).toBe(true);
    const essays = await getTemplatesByCategory("essay");
    expect(essays).toHaveLength(0);
  });
});

describe("deleteTemplate", () => {
  it("entfernt das Template und ist idempotent", async () => {
    const created = await createTemplate({
      name: "Weg",
      category: "poetry",
      description: "",
      prompt: "Dichte über {{motif}}.",
      variables: [
        { name: "motif", label: "Motiv", type: "text", defaultValue: "Meer" },
      ],
    });
    await deleteTemplate(created.id);
    expect(await getTemplateById(created.id)).toBeNull();
    await expect(deleteTemplate(created.id)).resolves.toBeUndefined();
  });
});
