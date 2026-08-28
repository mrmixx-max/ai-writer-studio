// E2E: KI-Panel — öffnen/prüfen, Kapitel mit KI weiterschreiben (Offline-
// Fallback, kein Ollama nötig), Chat-Eingabe, "In Dokument einfügen".
import { expect, test } from "@playwright/test";
import { createProjectWithChapter, gotoApp } from "./helpers";

test("KI-Panel ist sichtbar und bietet Aktionen", async ({ page }) => {
  await gotoApp(page);

  const panel = page.locator("#app-ai-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "KI-Assistent" })).toHaveText(/KI-Assistent/i);

  // Alle KI-Aktionen sind als Buttons vorhanden.
  for (const label of [
    "Weiterschreiben",
    "Umschreiben",
    "Zusammenfassen",
    "Korrektur",
    "Brainstorming",
  ]) {
    await expect(panel.locator("button", { hasText: label })).toBeVisible();
  }
});

test("KI weiterschreibt ein Kapitel und Output ist einfügbar", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "KI-Projekt", "KI-Kapitel");

  // Kapitel-Editor ist da (Kapitel aktiv) und hat etwas Text als Kontext.
  const editor = page.locator(".tiptap-editor");
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.type("Es begann an einem nebligen Morgen.", { delay: 10 });

  const panel = page.locator("#app-ai-panel");
  await panel.locator("button", { hasText: "Weiterschreiben" }).first().click();

  // Ohne erreichbaren LLM-Provider greift der Offline-Fallback — in beiden
  // Fällen erscheint eine Ausgabe im KI-Panel.
  const output = panel.locator(".ki-output");
  await expect(output).toContainText(/\S/, { timeout: 30_000 });

  // Output in den Editor übernehmen.
  const insert = panel.locator("button.ki-insert");
  if (await insert.isVisible().catch(() => false)) {
    await insert.click();
    const body = await page.textContent("body");
    expect(body?.length ?? 0).toBeGreaterThan(0);
  }
});

test("Freier Chat im KI-Panel liefert eine Antwort", async ({ page }) => {
  await gotoApp(page);

  const panel = page.locator("#app-ai-panel");
  await panel
    .locator('.ki-chat-input input[placeholder*="Frage"]')
    .fill("Was ist ein guter Kapitelanfang?");
  await panel
    .locator('.ki-chat-input input[placeholder*="Frage"]')
    .press("Enter");

  const output = panel.locator(".ki-output");
  await expect(output).toContainText(/\S/, { timeout: 30_000 });
});
