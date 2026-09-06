// E2E: Settings-Roundtrip — Modell, Temperatur/MaxTokens, Theme.
// Muster: ändern → Speichern → Persistenz nachweisen → Reload/Reopen.
//
// HINWEIS Web-Harness: Im reinen Browser (Playwright gegen Vite-Dev-Server)
// läuft die App mit In-Memory-SQLite (siehe src/services/db/index.ts:
// "Kein Tauri-Kontext: In-Memory-Betrieb ohne Persistenz"). SQLite-Settings
// (Modell, Temperatur, MaxTokens) überleben daher keinen page.reload() —
// der Roundtrip wird dort per DB-Assert (window.__aws_db) + Modal-Reopen
// nachgewiesen. Das Theme persistiert zusätzlich in localStorage und wird
// per echtem Reload verifiziert.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

type SettingsRow = { model: string; temperature: number; maxTokens: number };

/**
 * Pinned die UI-Sprache auf Deutsch (siehe offline-boot.spec.ts): Ohne Pin
 * hängt die UI-Sprache von der Browsersprache ab (Chromium-Default en-US).
 * addInitScript gilt pro Kontext — überlebt auch page.reload().
 */
async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

async function openSettings(page: import("@playwright/test").Page) {
  await page
    .locator("header button", { hasText: /Einstellungen|Settings/ })
    .first()
    .click();
  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  // Settings-Panel ist lazy geladen — Speichern-Button abwarten.
  await expect(modal.locator(".settings-actions button.save")).toBeVisible({
    timeout: 15_000,
  });
  return modal;
}

/** Schließt das Modal per Backdrop-Klick (App.tsx: onClick → setShowSettings(false)). */
async function closeSettings(page: import("@playwright/test").Page): Promise<void> {
  await page.locator(".modal-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
}

/**
 * Erzwingt das Modell-Textfeld (statt Select): Discovery scheitert offline.
 * Host-basiert gematcht (localhost/127.0.0.1 außer Dev-Port 1420) — ein
 * Pfad-Glob wie `**\/api/**` würde auch eigene Dev-Module
 * (`/src/plugins/api/*.ts`) abbrechen und den App-Boot zerstören.
 */
async function forceModelInput(page: import("@playwright/test").Page): Promise<void> {
  await page.route(
    (url) =>
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port !== "1420",
    (route) => route.abort("connectionrefused"),
  );
}

/** Liest die persistierten AppSettings direkt aus der App-DB (In-Memory im Browser). */
async function readStoredSettings(
  page: import("@playwright/test").Page,
): Promise<SettingsRow | null> {
  const raw = await page.evaluate((): string | null => {
    const w = window as unknown as Record<
      string,
      { exec: (sql: string) => Array<{ values: string[][] }> } | undefined
    >;
    const rows = w.__aws_db?.exec(
      "SELECT value FROM settings WHERE key = 'app_settings'",
    );
    return rows && rows.length && rows[0].values.length
      ? (rows[0].values[0][0] as string)
      : null;
  });
  return raw ? (JSON.parse(raw) as SettingsRow) : null;
}

test("Modellwechsel: speichern, DB-Roundtrip, Modal-Reopen", async ({ page }) => {
  await pinGerman(page);
  await forceModelInput(page);
  await gotoApp(page);
  const modal = await openSettings(page);

  const modelInput = modal.locator('.settings-panel > label:has-text("Modell") input');
  await expect(modelInput).toBeVisible({ timeout: 15_000 });
  await modelInput.fill("e2e-wechsel-modell");

  const save = modal.locator(".settings-actions button.save");
  await expect(save).toBeEnabled();
  await save.click();
  // Dirty-Flag gelöscht = gespeichert.
  await expect(save).toBeDisabled();

  await expect
    .poll(async () => (await readStoredSettings(page))?.model, { timeout: 10_000 })
    .toBe("e2e-wechsel-modell");

  await closeSettings(page);
  const modal2 = await openSettings(page);
  await expect(
    modal2.locator('.settings-panel > label:has-text("Modell") input'),
  ).toHaveValue("e2e-wechsel-modell");
});

test("Temperatur + MaxTokens: speichern, DB-Roundtrip, Modal-Reopen", async ({
  page,
}) => {
  await pinGerman(page);
  await forceModelInput(page);
  await gotoApp(page);
  const modal = await openSettings(page);

  const tempLabel = modal.locator('.settings-panel > label:has-text("Temperatur")');
  await tempLabel.locator('input[type="range"]').fill("0.3");
  const maxTokens = modal.locator('.settings-panel > label:has-text("Max Tokens") input');
  await maxTokens.fill("4096");
  await expect(tempLabel).toContainText("0.3");

  const save = modal.locator(".settings-actions button.save");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();

  await expect
    .poll(async () => await readStoredSettings(page), { timeout: 10_000 })
    .toMatchObject({ temperature: 0.3, maxTokens: 4096 });

  await closeSettings(page);
  const modal2 = await openSettings(page);
  await expect(
    modal2.locator('.settings-panel > label:has-text("Temperatur")'),
  ).toContainText("0.3");
  await expect(
    modal2.locator('.settings-panel > label:has-text("Max Tokens") input'),
  ).toHaveValue("4096");
});

test("Theme-Roundtrip: Wechsel übersteht Reload (localStorage)", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);
  const modal = await openSettings(page);

  // Theme-Select anhand der dark/light-Optionen finden (sprachunabhängig).
  const themeSelect = modal
    .locator("label select")
    .filter({ has: page.locator('option[value="light"]') });
  await expect(themeSelect.first()).toBeVisible({ timeout: 10_000 });
  await themeSelect.first().selectOption("light");

  const save = modal.locator(".settings-actions button.save");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Echter Reload: Theme kommt aus localStorage zurück.
  await page.reload();
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
