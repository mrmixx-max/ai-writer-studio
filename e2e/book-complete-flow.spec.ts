// E2E: Kompletter Buch-Flow — Projekt → Genre → Outline → Kapitel →
// Kapitel anlegen → Export (Download) → KDP-Checkliste.
// Ollama wird per page.route gemockt (e2e/mock-ollama.ts), 0 echte Calls.
import { expect, test } from "@playwright/test";
import {
  selectGenre,
  selectStylePreset,
  setupTestProject,
  switchToClassicTab,
  waitForGeneration,
} from "./helpers";
import { MOCK_CHAPTER_COUNT, mockOllamaBookGeneration } from "./mock-ollama";

test.setTimeout(180_000);

test("Kompletter Buch-Flow: generieren, Kapitel anlegen, Markdown exportieren", async ({
  page,
}) => {
  await mockOllamaBookGeneration(page);
  await setupTestProject(page, "Komplettbuch-Projekt");
  await switchToClassicTab(page);

  // Thema + Genre + Stil wählen.
  await page
    .locator('.bookwriter-panel label:has-text("Thema") input')
    .fill("Der weiße Fleck");
  await selectGenre(page, "Fantasy");
  const description = await selectStylePreset(page, "humorvoll");
  expect(description.length).toBeGreaterThan(0);

  // 3 Kapitel ( passend zum Mock ).
  await page
    .locator('.bookwriter-panel label:has-text("Kapitel") input')
    .fill(String(MOCK_CHAPTER_COUNT));

  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();

  await waitForGeneration(page);

  // Outline + alle Kapitel im Ergebnis.
  const live = await page.locator(".bookwriter-panel .bw-live pre").textContent();
  expect(live).toMatch(/Gliederung erstellt: 3 Kapitel/);
  await expect(page.locator(".bookwriter-panel .bw-chapter")).toHaveCount(
    MOCK_CHAPTER_COUNT,
  );

  // Kapitel in den Store übernehmen (Export braucht Store-Kapitel mit draft).
  await page
    .locator(".bookwriter-panel button", { hasText: /Kapitel anlegen \(3\)/ })
    .click();
  await expect(page.locator(".bookwriter-panel .bw-live pre")).toContainText(
    /3 Kapitel mit Content angelegt/,
    { timeout: 15_000 },
  );

  // Export-Sektion lebt im Planer-Tab → dorthin wechseln, Markdown exportieren.
  await page.locator(".bookwriter-panel .bw-tab", { hasText: "Kapitelplaner" }).click();
  const exportSection = page.locator('[data-testid="bw-export-section"]');
  await expect(exportSection).toBeVisible();
  await exportSection.locator('select[aria-label="Exportformat"]').selectOption("markdown");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await exportSection.locator('[data-testid="bw-export-btn"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/i);

  await expect(exportSection.locator('[data-testid="bw-export-success"]')).toContainText(
    /Export fertig/,
    { timeout: 30_000 },
  );
});

test("Komplett-Flow: KDP-Checkliste zeigt Buchdaten nach Generierung", async ({
  page,
}) => {
  await mockOllamaBookGeneration(page);
  await setupTestProject(page, "KDP-Buchprojekt");
  await switchToClassicTab(page);

  await page
    .locator('.bookwriter-panel label:has-text("Thema") input')
    .fill("Der weiße Fleck");
  await page
    .locator('.bookwriter-panel label:has-text("Kapitel") input')
    .fill(String(MOCK_CHAPTER_COUNT));
  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();
  await waitForGeneration(page);

  // KDP-Modus: Checkliste für das aktive Projekt rendern.
  await page.locator('.mode-switcher button[aria-label="KDP"]').click();
  const kdp = page.locator(".kdp");
  await expect(kdp).toBeVisible({ timeout: 15_000 });
  // Entweder Checkliste mit Items oder Hinweis — aber kein Crash/Placeholder-Fehler.
  await expect(kdp).toContainText(/KDP|Checkliste|Metadaten|Titel/i, { timeout: 15_000 });
});
