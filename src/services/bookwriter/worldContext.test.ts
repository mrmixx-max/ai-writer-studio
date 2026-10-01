// Tests für den Welt-Kontext (WP1.3, RAG-Light).
//
// Kernaussage: World-Bible und Lore waren bisher reine UI-Daten und landeten
// nie im Generierungs-Prompt. Diese Tests belegen, dass sie jetzt eingebunden
// werden — und dass in der Szene erwähnte Einträge bevorzugt aufgenommen werden.

import { describe, it, expect, beforeEach, vi } from "vitest";

// DB und Welt-Services mocken: getestet wird die Auswahl-Logik, nicht SQLite.
const worldBibleMock = vi.fn();
const listLoreMock = vi.fn();
const countLoreMentionsMock = vi.fn();

vi.mock("@/services/worldbuilding/worldbible", () => ({
  getWorldBible: (...a: unknown[]) => worldBibleMock(...a),
}));
vi.mock("@/services/worldbuilding/lore", () => ({
  listLore: (...a: unknown[]) => listLoreMock(...a),
  countLoreMentions: (...a: unknown[]) => countLoreMentionsMock(...a),
}));

import { buildWorldContext, MAX_WORLD_RULES } from "./worldContext";

function bible(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "b1",
    projectId: "p1",
    name: "Welt",
    premise: "Eine Welt, in der Erinnerungen handelbar sind.",
    rules: [{ id: "r1", text: "Magie kostet Erinnerung.", category: "Magie" }],
    history: [{ id: "h1", year: "1200", title: "Der Bruch", description: "" }],
    notes: "",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

beforeEach(() => {
  worldBibleMock.mockReset();
  listLoreMock.mockReset();
  countLoreMentionsMock.mockReset();
  countLoreMentionsMock.mockReturnValue(0);
});

describe("buildWorldContext — Grundgerüst", () => {
  it("liefert leeren Block, wenn es keine Welt-Daten gibt", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1");
    expect(r.text).toBe("");
    expect(r.tokens).toBe(0);
  });

  it("nimmt Prämisse, Regeln und Chronologie auf", () => {
    worldBibleMock.mockReturnValue(bible());
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1");
    expect(r.text).toContain("Erinnerungen handelbar");
    expect(r.text).toContain("Magie kostet Erinnerung");
    expect(r.text).toContain("1200: Der Bruch");
    expect(r.text).toContain("Welt-Kontext (verbindlich");
  });

  it("gruppiert Regeln nach Kategorie", () => {
    worldBibleMock.mockReturnValue(
      bible({
        rules: [
          { id: "a", text: "Regel A", category: "Magie" },
          { id: "b", text: "Regel B", category: "Magie" },
          { id: "c", text: "Regel C", category: "Technik" },
        ],
      }),
    );
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1");
    expect(r.text).toContain("- Magie: Regel A | Regel B");
    expect(r.text).toContain("- Technik: Regel C");
  });

  it("überspringt leere Regeln und Einträge", () => {
    worldBibleMock.mockReturnValue(
      bible({
        rules: [{ id: "a", text: "   ", category: "Magie" }],
        history: [{ id: "h", year: "", title: "", description: "" }],
        premise: "",
        notes: "",
      }),
    );
    listLoreMock.mockReturnValue([]);
    expect(buildWorldContext("p1").text).toBe("");
  });

  it("begrenzt die Zahl der Regeln", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, text: `Regel ${i}`, category: "C" }));
    worldBibleMock.mockReturnValue(bible({ rules: many }));
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1");
    const ruleCount = (r.text.match(/Regel \d+/g) ?? []).length;
    expect(ruleCount).toBeLessThanOrEqual(MAX_WORLD_RULES);
  });
});

describe("buildWorldContext — Lore-Relevanz", () => {
  const lore = [
    { id: "l1", projectId: "p1", name: "Aschenkelch", category: "Artefakt", description: "Ein Kelch.", aliases: [], notes: "", createdAt: 0, updatedAt: 0 },
    { id: "l2", projectId: "p1", name: "Nordhain", category: "Begriff", description: "Ein Wald.", aliases: ["Hain"], notes: "", createdAt: 0, updatedAt: 0 },
  ];

  it("markiert in der Szene erwähnte Einträge", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue(lore);
    // Nur "Aschenkelch" kommt in der Szene vor.
    countLoreMentionsMock.mockImplementation((e: { name: string }) => (e.name === "Aschenkelch" ? 3 : 0));

    const r = buildWorldContext("p1", "Der Held nimmt den Aschenkelch.");
    expect(r.mentioned).toContain("Aschenkelch");
    expect(r.text).toContain("Aschenkelch");
    expect(r.text).toContain("[in dieser Szene erwähnt]");
  });

  it("stellt erwähnte Einträge vor nicht erwähnte", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue(lore);
    countLoreMentionsMock.mockImplementation((e: { name: string }) => (e.name === "Nordhain" ? 1 : 0));

    const r = buildWorldContext("p1", "Im Nordhain.");
    const posNordhain = r.text.indexOf("Nordhain");
    const posKelch = r.text.indexOf("Aschenkelch");
    expect(posNordhain).toBeLessThan(posKelch);
  });

  it("zeigt Aliase mit an", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue(lore);
    const r = buildWorldContext("p1");
    expect(r.text).toContain("(auch: Hain)");
  });

  it("ruft countLoreMentions nur mit Szenen-Text auf", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue(lore);
    buildWorldContext("p1", "Szene");
    expect(countLoreMentionsMock).toHaveBeenCalledTimes(2);
  });

  it("kommt ohne Szenen-Text aus (keine Erwähnungen)", () => {
    worldBibleMock.mockReturnValue(null);
    listLoreMock.mockReturnValue(lore);
    const r = buildWorldContext("p1");
    expect(countLoreMentionsMock).not.toHaveBeenCalled();
    expect(r.text).toContain("Aschenkelch");
    // mentioned = in der Szene erwähnt (hier: keiner), included = im Block.
    expect(r.mentioned).toEqual([]);
    expect(r.included).toEqual(["Aschenkelch", "Nordhain"]);
  });
});

describe("buildWorldContext — Budget", () => {
  it("hält die Token-Obergrenze ein", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `r${i}`, text: `Regel Nummer ${i} mit etwas Text`, category: "C" }));
    worldBibleMock.mockReturnValue(bible({ rules: many }));
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1", "", 100);
    expect(r.tokens).toBeLessThanOrEqual(100 + 20); // + Markierung
  });

  it("markiert gekürzte Blöcke", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `r${i}`, text: `Regel ${i}`, category: "C" }));
    worldBibleMock.mockReturnValue(bible({ rules: many }));
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1", "", 60);
    expect(r.text).toContain("[…gekürzt]");
  });

  it("kürzt nicht, wenn maxTokens 0 ist", () => {
    worldBibleMock.mockReturnValue(bible());
    listLoreMock.mockReturnValue([]);
    const r = buildWorldContext("p1", "", 0);
    expect(r.text).not.toContain("[…gekürzt]");
    expect(r.tokens).toBeGreaterThan(0);
  });
});
