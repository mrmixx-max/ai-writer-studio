// E2E: Stil/Ton — Preset wählen → Beschreibung sichtbar →
// Generierung → Ton landet im LLM-Prompt (captured via Mock).
import { expect, test } from "@playwright/test";
import {
  enterCustomTone,
  selectStylePreset,
  setupTestProject,
  switchToClassicTab,
  waitForGeneration,
} from "./helpers";
import { MOCK_CHAPTER_COUNT, mockOllamaBookGeneration } from "./mock-ollama";

test.setTimeout(180_000);

// Alle 8 Presets aus prompts.json (Sprint 7) müssen wählbar sein + Beschreibung zeigen.
test("Alle 8 Stil-Presets sind wählbar und zeigen eine Beschreibung", async ({
  page,
}) => {
  await setupTestProject(page, "Stil-Projekt");
  await switchToClassicTab(page);

  const select = page.locator('[data-testid="bw-style-select"]').first();
  const options = await select.locator("option").all();
  // 8 Presets + "Kein Stil-Preset".
  expect(options.length).toBe(9);

  for (const presetId of [
    "wissenschaftlich",
    "blog",
    "sachbuch-klassisch",
    "thriller",
    "humorvoll",
    "noir",
    "poetisch",
    "biografisch",
  ]) {
    const description = await selectStylePreset(page, presetId);
    expect(description.length, `Beschreibung für ${presetId}`).toBeGreaterThan(0);
  }

  // "Kein Stil-Preset" blendet die Beschreibung wieder aus.
  await select.selectOption("");
  await expect(
    page.locator('[data-testid="bw-style-description"]'),
  ).toHaveCount(0);
});

test("Gewählter Ton landet im Generierungs-Prompt und Buch wird fertig", async ({
  page,
}) => {
  const captured: string[] = [];
  await mockOllamaBookGeneration(page, { capture: captured });
  await setupTestProject(page, "Ton-Projekt");
  await switchToClassicTab(page);

  await page
    .locator('.bookwriter-panel label:has-text("Thema") input')
    .fill("Der weiße Fleck");
  await enterCustomTone(page, "noir");
  await page
    .locator('.bookwriter-panel label:has-text("Kapitel") input')
    .fill(String(MOCK_CHAPTER_COUNT));
  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();

  await waitForGeneration(page);

  // Outline- + Kapitel-Prompts enthalten den gewählten Ton (Stil-Overlay wiring).
  const outlinePrompts = captured.filter((p) => /gliederung/i.test(p));
  const chapterPrompts = captured.filter((p) => /schreibe kapitel/i.test(p));
  expect(outlinePrompts.length).toBeGreaterThan(0);
  expect(chapterPrompts.length).toBe(MOCK_CHAPTER_COUNT);
  for (const p of [...outlinePrompts, ...chapterPrompts]) {
    expect(p).toMatch(/Stil\/Ton: noir/);
  }
});
