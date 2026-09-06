// E2E Runde 2: Lektorat-Befunde-Flow (mocked, offline, 0 echte LLM-Calls).
// Das LektoratPanel ist standalone (reine Sicht auf analyzeBook); der Flow wird
// hier gegen die echte Service-Logik im echten Browser geprüft — mit
// abgebrochenem Provider-Netz (Mock statt Ollama) und gemockter CompleteFn.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

async function goOffline(page: Page): Promise<void> {
  await page.route(
    (url) =>
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port !== "1420",
    (route) => route.abort("connectionrefused"),
  );
}

const LEKTORAT_MOD = "/src/services/bookwriter/lektorat.ts";

test("Lektorat findet Befunde offline: Wiederholung + Füllwörter, kein Netz", async ({
  page,
}) => {
  await pinGerman(page);
  await goOffline(page);
  await gotoApp(page);

  const result = await page.evaluate(async (mod) => {
    const m = await import(mod);
    const findings = m.analyzeBook([
      {
        id: "k1",
        content:
          "Das ist ein Test. Das ist ein Test. Man hat gesagt, dass es quasi eigentlich sehr gut war.",
      },
    ]);
    const counts = m.countFindingsByType(findings);
    return {
      types: findings.map((f: { type: string }) => f.type),
      counts,
    };
  }, LEKTORAT_MOD);

  expect(result.types).toContain("repeated_word");
  expect(result.types).toContain("filler_word");
  const total =
    result.counts.repeated_word +
    result.counts.sentence_variance +
    result.counts.passive_voice +
    result.counts.dialogue_tag +
    result.counts.filler_word;
  expect(total).toBe(result.types.length);
  expect(total).toBeGreaterThan(0);
});

test("Lektorat-Umformulierung nutzt gemockte CompleteFn (Prompt belegt, 0 echte Calls)", async ({
  page,
}) => {
  await pinGerman(page);
  await goOffline(page);
  await gotoApp(page);

  const result = await page.evaluate(async (mod) => {
    const m = await import(mod);
    const findings = m.analyzeBook([
      { id: "k1", content: "Das ist ein Test. Das ist ein Test." },
    ]);
    const target = findings.find(
      (f: { type: string }) => f.type === "repeated_word",
    );
    if (!target) return { skipped: "kein repeated_word-Befund" };
    const prompts: string[] = [];
    const out = await m.rephraseWithLlm(
      target,
      "Das ist ein Test. Das ist ein Test.",
      async (prompt: string) => {
        prompts.push(prompt);
        return "Der Versuch war ein Test, danach eine Prüfung.";
      },
    );
    return { out, promptCount: prompts.length, promptHead: prompts[0]?.slice(0, 80) ?? "" };
  }, LEKTORAT_MOD);

  expect(result.skipped ?? "").toBe("");
  expect(result.promptCount).toBe(1);
  expect(result.out).toContain("Prüfung");
});

test("Lektorat: stilistisch sauberer Text liefert keine Befunde", async ({
  page,
}) => {
  await pinGerman(page);
  await goOffline(page);
  await gotoApp(page);

  const count = await page.evaluate(async (mod) => {
    const m = await import(mod);
    return m.analyzeBook([
      {
        id: "k1",
        content:
          "Mara strich mit dem Finger über das Pergament. Niemand hatte je gewagt, die Grenze zu überschreiten.",
      },
    ]).length;
  }, LEKTORAT_MOD);

  expect(count).toBe(0);
});
