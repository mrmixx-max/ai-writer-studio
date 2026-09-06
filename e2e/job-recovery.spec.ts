// E2E: Job-Recovery — Abbruch mitten in der Generierung →
// Recovery-Dialog (Dashboard-Modal) → Fortsetzen im Panel → Buch fertig.
//
// Hinweis: Im Browser läuft die App mit In-Memory-DB, daher simuliert der
// "Neustart" einen Panel-Remount per Sidebar-Moduswechsel (BookWriter →
// Editor → BookWriter). Der Job-Store (jobs.ts, current_chapter + Status)
// überlebt das; echte Prozess-Kill-Persistenz decken jobs.test.ts und
// tests/integration/api-flow.test.ts per committed Rows ab.
import { expect, test } from "@playwright/test";
import {
  setupTestProject,
  switchToClassicTab,
  waitForGeneration,
} from "./helpers";
import { MOCK_CHAPTER_COUNT, mockOllamaBookGeneration } from "./mock-ollama";

test.setTimeout(180_000);

/** Bricht einen laufenden Generierungslauf nach Kapitel 1 per Stop ab. */
async function startAndStopAfterChapterOne(
  page: import("@playwright/test").Page,
  projectName: string,
): Promise<void> {
  // Langsame Kapitel, damit der Stop sicher während Kapitel 2+ greift.
  await mockOllamaBookGeneration(page, { delayMs: 3000 });
  await setupTestProject(page, projectName);
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

  // Warten bis Kapitel 1 committed ist, dann abbrechen. Der Confirm-Dialog
  // wird vom permanenten Dialog-Handler aus helpers.ts akzeptiert.
  await expect(page.locator(".bookwriter-panel .bw-live pre")).toContainText(
    "✅ Kapitel 1 fertig",
    { timeout: 120_000 },
  );
  await page.locator(".bookwriter-panel button.bw-stop").click();
  // Generierung beendet → Start-Button wieder da.
  await expect(
    page.locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" }),
  ).toBeVisible({ timeout: 30_000 });
}

test("Stop mitten in der Generierung → Recovery-Dialog → Fortsetzen beendet das Buch", async ({
  page,
}) => {
  await startAndStopAfterChapterOne(page, "Recovery-Projekt");

  // "Neustart": Modus wechseln (Panels unmounten) und zurückkehren.
  await page.locator('.mode-switcher button[aria-label="Editor"]').click();
  await page.locator('.mode-switcher button[aria-label="BookWriter"]').click();

  // Dashboard-Recovery-Modal: 1 gespeichertes Kapitel, fortsetzbar ab Kapitel 2.
  const modal = page.locator(
    '.bw-recovery-dialog[aria-label="Unterbrochene Buchgenerierung fortsetzen?"]',
  );
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await expect(modal).toContainText(/Kapitel 1 von 3 gespeichert.*fortsetzbar ab Kapitel 2/);
  await modal.locator("button", { hasText: "Fortsetzen" }).click();
  await expect(modal).toHaveCount(0);

  // Klassisches Panel aufklappen → panel-interner Resume-Dialog erscheint.
  await page.locator(".bw-dash-classic button").first().click();
  const resume = page.locator('.bw-resume[aria-label="Generierung fortsetzen?"]');
  await expect(resume).toBeVisible({ timeout: 15_000 });
  await expect(resume).toContainText(/Kapitel 1 \/ 3/);

  // Fortsetzen → läuft ab Kapitel 2 weiter bis zum Ende.
  await resume.locator("button", { hasText: "Fortsetzen" }).click();
  await waitForGeneration(page);
  await expect(page.locator(".bookwriter-panel .bw-chapter")).toHaveCount(
    MOCK_CHAPTER_COUNT,
  );
});

test("Recovery-Verwerfen löscht den Job, kein Resume-Dialog mehr", async ({
  page,
}) => {
  await startAndStopAfterChapterOne(page, "Verwerfen-Projekt");

  await page.locator('.mode-switcher button[aria-label="Editor"]').click();
  await page.locator('.mode-switcher button[aria-label="BookWriter"]').click();

  const modal = page.locator(
    '.bw-recovery-dialog[aria-label="Unterbrochene Buchgenerierung fortsetzen?"]',
  );
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.locator("button", { hasText: "Verwerfen" }).click();
  await expect(modal).toHaveCount(0);

  // Klassisches Panel aufklappen → kein Resume-Dialog (Job verworfen).
  await page.locator(".bw-dash-classic button").first().click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('.bw-resume[aria-label="Generierung fortsetzen?"]'),
  ).toHaveCount(0);
});
