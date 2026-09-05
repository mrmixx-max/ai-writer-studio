// Tests: Sprint 3 — Spezialisiertes Agenten-Routing (Logik vs. Kreativ).
//
// Akzeptanzkriterium: Routing trennt Logik-Modelle von Kreativ-Modellen —
// entities/repair (Faktenchecks, JSON-Reparatur) laufen bevorzugt auf dem
// spezialisierten Logik-Modell, chapter/summary/outline auf dem Matrix-Modell.
// Konservativ: ohne konfiguriertes logic-Modell bleibt alles beim
// bestehenden Verhalten (keine Breaking Changes).
import { describe, it, expect } from "vitest";
import {
  TASK_CLASS_MATRIX,
  pickModelWithTaskClass,
  taskClassOf,
  pickModelForTask,
} from "./router";

describe("Sprint 3: TASK_CLASS_MATRIX", () => {
  it("entities und repair sind Logik-Aufgaben", () => {
    expect(TASK_CLASS_MATRIX.entities).toBe("logic");
    expect(TASK_CLASS_MATRIX.repair).toBe("logic");
  });

  it("chapter, summary, outline, metadata sind Kreativ-Aufgaben", () => {
    expect(TASK_CLASS_MATRIX.chapter).toBe("creative");
    expect(TASK_CLASS_MATRIX.summary).toBe("creative");
    expect(TASK_CLASS_MATRIX.outline).toBe("creative");
    expect(TASK_CLASS_MATRIX.metadata).toBe("creative");
  });

  it("taskClassOf klassifiziert für Router-Metadaten", () => {
    expect(taskClassOf("entities")).toBe("logic");
    expect(taskClassOf("chapter")).toBe("creative");
  });
});

describe("Sprint 3: pickModelWithTaskClass", () => {
  it("Logik-Aufgabe mit logic-Modell → spezialisiertes Modell", () => {
    const models = { main: "llama3.1:8b", fast: "llama3.2", logic: "qwen2.5:14b-instruct" };
    expect(pickModelWithTaskClass("entities", models)).toBe("qwen2.5:14b-instruct");
    expect(pickModelWithTaskClass("repair", models)).toBe("qwen2.5:14b-instruct");
  });

  it("Kreativ-Aufgabe ignorieren das logic-Modell (Matrix gilt)", () => {
    const models = { main: "llama3.1:8b", fast: "llama3.2", logic: "qwen2.5:14b-instruct" };
    expect(pickModelWithTaskClass("chapter", models)).toBe("llama3.1:8b");
    expect(pickModelWithTaskClass("summary", models)).toBe("llama3.2");
  });

  it("ohne logic-Modell: konservativ bestehende Matrix (kein Bruch)", () => {
    const models = { main: "llama3.1:8b", fast: "llama3.2" };
    expect(pickModelWithTaskClass("entities", models)).toBe("llama3.2");
    expect(pickModelWithTaskClass("repair", models)).toBe("llama3.1:8b");
    // Identisch zum Legacy-Ergebnis.
    expect(pickModelWithTaskClass("entities", models)).toBe(pickModelForTask("entities", models));
  });

  it("strong-Modell für outline bleibt unberührt", () => {
    const models = { main: "m", strong: "70b-model", logic: "logic-m" };
    expect(pickModelWithTaskClass("outline", models)).toBe("70b-model");
  });
});

describe("Sprint 3: Router-Integration (complete nutzt Logik-Modell)", () => {
  it("entities-Call läuft auf logic-Modell, chapter-Call auf Hauptmodell; task_class gesetzt", async () => {
    const calls: Array<{ model: string; task: string; taskClass?: string }> = [];
    const { BookwriterRouter } = await import("./router");
    const router = new BookwriterRouter(
      {
        chain: [
          { provider: "ollama", baseUrl: "http://x", models: { main: "main-m", fast: "fast-m", logic: "logic-m" } as never },
        ],
      },
      { onCall: (m) => calls.push({ model: m.model, task: m.task, taskClass: m.task_class }) },
    );
    // healthCheck muss grün sein — Provider-Mock statt echter Instanz:
    // BookwriterRouter instanziiert echte Provider; wir patchen healthCheck.
    for (const entry of router.entries) {
      (entry.provider as unknown as { healthCheck: () => Promise<boolean> }).healthCheck = async () => true;
      (entry.provider as unknown as { chat: () => AsyncGenerator<string> }).chat = async function* () {
        yield "ok";
      };
    }

    await router.complete("entities", [{ role: "user", content: "Faktencheck" }], {});
    await router.complete("chapter", [{ role: "user", content: "Schreibe..." }], {});

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ model: "logic-m", task: "entities", taskClass: "logic" });
    expect(calls[1]).toMatchObject({ model: "main-m", task: "chapter", taskClass: "creative" });
  });
});
