// Tests für strukturierte LLM-Ausgaben: Zod-Validierung + Repair-Prompting.
//
// Kernaussage: `parseJson<T>` castet nur. Diese Tests belegen, dass
// `parseStructuredJson` die Form tatsächlich PRÜFT und bei Abweichung genau
// einen Reparaturversuch macht.

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  parseStructuredJson,
  buildRepairPrompt,
  zodIssueLines,
  parseJson,
} from "./structured";

const chapterSchema = z.object({
  title: z.string({ error: "Titel fehlt" }).trim().min(1, "Titel fehlt"),
});

const listSchema = z.array(chapterSchema).min(1, "Liste ist leer");

describe("parseStructuredJson — gültige Ausgabe", () => {
  it("nimmt valides JSON ohne Reparaturversuch an", async () => {
    const repair = vi.fn();
    const out = await parseStructuredJson(
      '[{"title":"Kapitel 1"}]',
      listSchema,
      repair,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toEqual([{ title: "Kapitel 1" }]);
      expect(out.attempts).toBe(1);
      expect(out.repaired).toBe(false);
    }
    expect(repair).not.toHaveBeenCalled();
  });

  it("extrahiert JSON aus Markdown-Code-Fences", async () => {
    const out = await parseStructuredJson(
      'Hier ist die Gliederung:\n```json\n[{"title":"A"}]\n```',
      listSchema,
    );
    expect(out.ok).toBe(true);
  });
});

describe("parseStructuredJson — ungültige Struktur", () => {
  it("erkennt fehlenden Titel und repariert in EINEM weiteren Call", async () => {
    const repair = vi.fn(async () => '[{"title":"Repariert"}]');
    const out = await parseStructuredJson(
      '[{"summary":"ohne Titel"}]',
      listSchema,
      repair,
    );

    expect(repair).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toEqual([{ title: "Repariert" }]);
      expect(out.attempts).toBe(2);
      expect(out.repaired).toBe(true);
    }
  });

  it("erkennt ein Objekt statt eines Arrays als Strukturfehler", async () => {
    // Genau der Fall, den der reine Cast durchgelassen hätte:
    // {"chapters": [...]} statt [...].
    const out = await parseStructuredJson(
      '{"chapters":[{"title":"A"}]}',
      listSchema,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.failure.noJson).toBe(false);
      expect(out.failure.messages.length).toBeGreaterThan(0);
    }
  });

  it("erkennt leere Liste als Strukturfehler", async () => {
    const out = await parseStructuredJson("[]", listSchema);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.messages.join(" ")).toContain("leer");
  });

  it("meldet Wort-Salat als noJson", async () => {
    const out = await parseStructuredJson(
      "Leider kann ich keine Gliederung erstellen.",
      listSchema,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.noJson).toBe(true);
  });

  it("liefert ohne Repair-Callback sofort ok:false (kein stiller Durchlauf)", async () => {
    const out = await parseStructuredJson('[{"summary":"x"}]', listSchema);
    expect(out.ok).toBe(false);
  });

  it("gibt bei gescheiterter Reparatur die Fehler des zweiten Versuchs zurück", async () => {
    const repair = vi.fn(async () => '[{"immer":"noch falsch"}]');
    const out = await parseStructuredJson(
      '[{"summary":"x"}]',
      listSchema,
      repair,
    );
    expect(repair).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.messages.join(" ")).toContain("Titel");
  });

  it("überlebt einen werfenden Repair-Call und meldet den Originalfehler", async () => {
    // Ein Netzwerkfehler im Reparatur-Call darf die bessere Diagnose
    // (Strukturfehler der ersten Antwort) nicht verdrängen.
    const repair = vi.fn(async () => {
      throw new Error("Netzwerk weg");
    });
    const out = await parseStructuredJson(
      '[{"summary":"x"}]',
      listSchema,
      repair,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.failure.noJson).toBe(false);
      expect(out.failure.messages.join(" ")).toContain("Titel");
    }
  });
});

describe("buildRepairPrompt", () => {
  it("nennt die konkreten Fehler und die ursprüngliche Antwort", () => {
    const prompt = buildRepairPrompt('[{"summary":"x"}]', {
      messages: ["0.title: Titel fehlt"],
      noJson: false,
    });
    expect(prompt).toContain("0.title: Titel fehlt");
    expect(prompt).toContain('{"summary":"x"}');
    expect(prompt).toContain("NUR valides JSON");
  });

  it("formuliert bei fehlendem JSON einen anderen Hinweis", () => {
    const prompt = buildRepairPrompt("Wort-Salat", {
      messages: [],
      noJson: true,
    });
    expect(prompt).toContain("kein erkennbares JSON");
  });

  it("kürzt sehr lange Antworten", () => {
    const long = "x".repeat(10_000);
    const prompt = buildRepairPrompt(long, { messages: ["a: b"], noJson: false });
    expect(prompt).toContain("(gekürzt)");
    expect(prompt.length).toBeLessThan(long.length);
  });
});

describe("zodIssueLines", () => {
  it("formatiert Pfad und Meldung", () => {
    const r = listSchema.safeParse([{ title: "" }]);
    expect(r.success).toBe(false);
    if (!r.success) {
      const lines = zodIssueLines(r.error);
      expect(lines[0]).toContain("0.title");
      expect(lines[0]).toContain("Titel fehlt");
    }
  });
});

describe("parseJson — Extraktionskaskade (Regression)", () => {
  it("parst direkt, aus Fences und aus Fließtext", () => {
    expect(parseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson<{ a: number }>('Antwort: {"a":1} — fertig.')).toEqual({ a: 1 });
  });

  it("repariert Single-Quotes und unquotete Keys", () => {
    expect(parseJson<{ a: number }>("{'a':1}")).toEqual({ a: 1 });
    expect(parseJson<{ a: number }>("{a:1}")).toEqual({ a: 1 });
  });

  it("liefert null bei Wort-Salat", () => {
    expect(parseJson("nur text ohne struktur")).toBeNull();
    expect(parseJson("")).toBeNull();
  });
});
