// E2E Runde 2: Hilfe-Overlay — öffnen / suchen / schließen.
// Öffnen/Schließen läuft über die echte UI (ShortcutsHelp via Shift+F1,
// Über-Dialog via F1/Header-Button); die Suche läuft über den echten
// Hilfe-Index (searchHelp) im echten Browser.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

test("Hilfe-Overlay öffnet per Shift+F1 und schließt per Escape", async ({
  page,
}) => {
  await pinGerman(page);
  await gotoApp(page);

  await page.keyboard.press("Shift+F1");
  const dialog = page.locator('.shortcuts-help[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Tastatur|Kürzel|Shortcuts/i);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Hilfe-Overlay schließt auch per Schließen-Button", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);

  await page.keyboard.press("Shift+F1");
  const dialog = page.locator('.shortcuts-help[role="dialog"]');
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button").click();
  await expect(dialog).toHaveCount(0);
  // App bleibt bedienbar, kein ErrorBoundary.
  await expect(page.locator("#app-sidebar")).toBeVisible();
  await expect(
    page.getByText(/Es liegt ein Fehler in der Anwendung/),
  ).toHaveCount(0);
});

test("Hilfe-Suche: Treffer bei Query, leer bei Kauderwelsch, alles bei leer", async ({
  page,
}) => {
  await pinGerman(page);
  await gotoApp(page);

  const result = await page.evaluate(async () => {
    const m = await import("/src/components/Help/helpIndex.ts");
    const all = m.searchHelp("");
    const hits = m.searchHelp("Update");
    const none = m.searchHelp("xqzwqy-xyz-nichts");
    return {
      allCount: all.length,
      hitsCount: hits.length,
      noneCount: none.length,
      firstTitle: m.helpTitle(hits[0], "de") ?? "",
      bodyLen: hits.length > 0 ? m.helpBody(hits[0], "de").length : 0,
    };
  });

  expect(result.allCount).toBeGreaterThan(0);
  expect(result.hitsCount).toBeGreaterThan(0);
  expect(result.hitsCount).toBeLessThanOrEqual(result.allCount);
  expect(result.noneCount).toBe(0);
  expect(result.firstTitle.length).toBeGreaterThan(0);
  expect(result.bodyLen).toBeGreaterThan(0);
});
