// E2E: Fehler-Recovery — Provider down → Fallback/Fehler-UI →
// nach Recovery läuft die Generierung erfolgreich durch.
import { expect, test } from "@playwright/test";
import {
  createProjectWithChapter,
  gotoApp,
  setupTestProject,
  switchToClassicTab,
  waitForGeneration,
} from "./helpers";
import { MOCK_CHAPTER_COUNT, mockOllamaBookGeneration } from "./mock-ollama";

test.setTimeout(180_000);

test("Provider down → KI-Panel nutzt Offline-Fallback (kein Crash)", async ({
  page,
}) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Fallback-Projekt", "Fallback-Kapitel");

  // Alle LLM-Calls scheitern → Offline-Fallback muss trotzdem liefern.
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));

  const editor = page.locator(".tiptap-editor");
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.type("Es begann an einem nebligen Morgen.", { delay: 10 });

  const panel = page.locator("#app-ai-panel");
  await panel.locator("button", { hasText: "Weiterschreiben" }).first().click();

  const output = panel.locator(".ki-output");
  await expect(output).toContainText(/\S/, { timeout: 30_000 });

  // App bleibt bedienbar: kein ErrorBoundary, Sidebar intakt.
  await expect(page.getByText(/Es liegt ein Fehler in der Anwendung/)).toHaveCount(0);
  await expect(page.locator("#app-sidebar")).toBeVisible();
});

test("Gliederung scheitert → Fehler-UI → nach Recovery erfolgreich", async ({
  page,
}) => {
  // Erster Outline-Call scheitert 3× (withRetry attempts=3 erschöpft) → .bw-error.
  await mockOllamaBookGeneration(page, { failOutlineAttempts: 99 });
  await setupTestProject(page, "Error-Projekt");
  await switchToClassicTab(page);

  await page
    .locator('.bookwriter-panel label:has-text("Thema") input')
    .fill("Der weiße Fleck");
  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();

  await expect(page.locator(".bookwriter-panel .bw-error")).toContainText(/Fehler:/, {
    timeout: 120_000,
  });

  // Recovery: Mock auf Erfolg umstellen (neue Route überschreibt) → läuft durch.
  await page.unroute("**/api/chat");
  await mockOllamaBookGeneration(page);
  await page
    .locator('.bookwriter-panel label:has-text("Kapitel") input')
    .fill(String(MOCK_CHAPTER_COUNT));
  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();

  await waitForGeneration(page);
  await expect(page.locator(".bookwriter-panel .bw-chapter")).toHaveCount(
    MOCK_CHAPTER_COUNT,
  );
});

test("Transienter Outline-Fehler wird per Retry automatisch geheilt", async ({
  page,
}) => {
  // Nur der erste Outline-Versuch scheitert → withRetry fängt es ab.
  await mockOllamaBookGeneration(page, { failOutlineAttempts: 1 });
  await setupTestProject(page, "Retry-Projekt");
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

  // Trotz transientem Fehler: Buch wird fertig, kein harter Fehler.
  await waitForGeneration(page);
  await expect(page.locator(".bookwriter-panel .bw-chapter")).toHaveCount(
    MOCK_CHAPTER_COUNT,
  );
});
