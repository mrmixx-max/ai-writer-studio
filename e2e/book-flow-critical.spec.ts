// E2E: Kritischer Buch-Flow in Stufen — Outline → Kapitel → Export-Stub.
// Ollama wird per page.route gemockt (e2e/mock-ollama.ts), 0 echte Calls.
// Ergänzt book-complete-flow.spec.ts um stufenweise Assertions (Outline-Titel,
// B3-Längenfenster, DOCX-Export statt Markdown).
import { expect, test, type Page } from "@playwright/test";
import { setupTestProject, switchToClassicTab, waitForGeneration } from "./helpers";
import { MOCK_CHAPTER_COUNT, mockOllamaBookGeneration } from "./mock-ollama";

test.setTimeout(180_000);

/**
 * Pinned die UI-Sprache auf Deutsch (siehe offline-boot.spec.ts): Ohne Pin
 * hängt die UI-Sprache von der Browsersprache ab (Chromium-Default en-US).
 */
async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

/** Startet eine gemockte 3-Kapitel-Generierung und wartet auf Fertigstellung. */
async function generateMockBook(page: import("@playwright/test").Page): Promise<void> {
  await pinGerman(page);
  await mockOllamaBookGeneration(page);
  await setupTestProject(page, "Stufenbuch-Projekt");
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
}

test("Outline-Stufe: Gliederung mit 3 Kapiteln und Mock-Titeln", async ({ page }) => {
  await generateMockBook(page);

  const live = await page.locator(".bookwriter-panel .bw-live pre").textContent();
  expect(live).toMatch(/Gliederung erstellt: 3 Kapitel/);

  const chapters = page.locator(".bookwriter-panel .bw-chapter");
  await expect(chapters).toHaveCount(MOCK_CHAPTER_COUNT);

  // Outline-Titel aus dem Mock sind im Ergebnis sichtbar.
  const result = page.locator(".bookwriter-panel .bw-result");
  await expect(result).toContainText("Die Karte ohne Namen");
  await expect(result).toContainText("Nebel über dem Moor");
  await expect(result).toContainText("Das Licht dahinter");
});

test("Kapitel-Stufe: Texte im B3-Fenster, Wortzähler je Kapitel", async ({ page }) => {
  await generateMockBook(page);

  // Jedes Kapitel: Volltext im B3-Längenfenster (Mock-Target 900 Wörter,
  // Toleranz nach unten) + Wortzähler-Badge gegen 2000er-Outline-Target.
  for (let n = 1; n <= MOCK_CHAPTER_COUNT; n++) {
    const chapter = page.locator(".bookwriter-panel .bw-chapter", {
      hasText: `Kapitel ${n}:`,
    });
    const text = (await chapter.locator("p").textContent()) ?? "";
    const words = text.split(/\s+/).filter(Boolean).length;
    expect(words, `Kapitel ${n} Wortzahl`).toBeGreaterThanOrEqual(700);

    await expect(page.locator(`[data-testid="bw-words-${n}"]`)).toContainText(
      /2\.000 Wörter/,
    );
  }
});

test("Export-Stub: DOCX-Download nach Kapitel-anlegen", async ({ page }) => {
  await generateMockBook(page);

  // Kapitel in den Store übernehmen (Export braucht Store-Kapitel mit draft).
  await page
    .locator(".bookwriter-panel button", { hasText: /Kapitel anlegen \(3\)/ })
    .click();
  await expect(page.locator(".bookwriter-panel .bw-live pre")).toContainText(
    /3 Kapitel mit Content angelegt/,
    { timeout: 15_000 },
  );

  // Export-Sektion lebt im Planer-Tab → dorthin wechseln, DOCX exportieren.
  await page.locator(".bookwriter-panel .bw-tab", { hasText: "Kapitelplaner" }).click();
  const exportSection = page.locator('[data-testid="bw-export-section"]');
  await expect(exportSection).toBeVisible();
  await exportSection.locator('select[aria-label="Exportformat"]').selectOption("docx");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await exportSection.locator('[data-testid="bw-export-btn"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/i);

  await expect(exportSection.locator('[data-testid="bw-export-success"]')).toContainText(
    /Export fertig/,
    { timeout: 30_000 },
  );
});
