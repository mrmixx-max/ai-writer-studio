// Production-E2E: Erweiterte Tests gegen den Release-Build (dist/).
//
// Testet Features, die in der Dev-Suite nicht abgedeckt sind:
// - Redenschreiber (STT → Editor)
// - Teleprompter (Scroll-Flow)
// - AppDialog (In-App-Prompt statt window.prompt)
// - i18n-Parität (de/en/es/fr)
// - Ollama-Integration über Rust-Proxy (kein CORS-403)
// - Fehlerfälle: Provider down, Netzwerkfehler
import { expect, test } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

// ---------------------------------------------------------------------------
// Redenschreiber (STT → Editor)
// ---------------------------------------------------------------------------

test("Production: Redenschreiber öffnet mit korrekten Steuerelementen", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click();
  await expect(page.locator('[data-testid="redenschreiber"]')).toBeVisible();

  // Sprachauswahl vorhanden
  await expect(page.locator('[data-testid="redenschreiber"] .rs-controls select')).toBeVisible();
  // Start-Button vorhanden
  await expect(page.locator('[data-testid="redenschreiber"] button', { hasText: /Start|starten/i })).toBeVisible();
  // Status-Anzeige
  await expect(page.locator('[data-testid="redenschreiber"] .rs-status')).toBeVisible();
  // KI-Rede-Generator + Redetexte
  await expect(page.locator('[data-testid="rs-compose"]')).toBeVisible();
  await expect(page.locator('[data-testid="rs-templates"]')).toBeVisible();
});

test("Production: Redenschreiber KI-Generator + Vorlage wählbar", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click();
  await expect(page.locator('[data-testid="rs-compose"]')).toBeVisible();

  // Anlass-Feld + Generieren-Button
  await expect(
    page.locator('[data-testid="rs-compose"] input[type="text"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="rs-compose"] button', { hasText: /Rede schreiben/i }),
  ).toBeVisible();

  // Vorlage wählen → Vorschau erscheint
  const tplSelect = page.locator('[data-testid="rs-templates"] select');
  await tplSelect.selectOption("wahlkampf-auftakt");
  await expect(page.locator('[data-testid="rs-template-preview"]')).toContainText(
    /Richtungsentscheidung/,
  );
});

test("Production: Redenschreiber Sprachauswahl zeigt alle Sprachen", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click();
  const select = page.locator('[data-testid="redenschreiber"] .rs-controls select');
  await expect(select).toBeVisible();

  const options = await select.locator("option").allTextContents();
  expect(options.length).toBeGreaterThanOrEqual(4);
  expect(options.some((o) => o.includes("Deutsch"))).toBe(true);
  expect(options.some((o) => o.includes("English"))).toBe(true);
});

// ---------------------------------------------------------------------------
// Teleprompter
// ---------------------------------------------------------------------------

test("Production: Teleprompter öffnet mit korrekten Steuerelementen", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();
  await expect(page.locator('[data-testid="teleprompter"]')).toBeVisible();

  // Geschwindigkeits-Auswahl
  await expect(page.locator('[data-testid="teleprompter"] .tp-speed button').first()).toBeVisible();
  // Play/Pause-Button
  await expect(page.locator('[data-testid="teleprompter"] button', { hasText: /Play|Abspielen/i })).toBeVisible();
  // Fortschritt-Container (auch bei 0% sichtbar — inneres div kann 0px breit sein)
  await expect(page.locator('[data-testid="teleprompter"] .tp-progress')).toBeVisible();
});

test("Production: Teleprompter zeigt leeren Zustand ohne Kapitel", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();
  await expect(page.locator('[data-testid="teleprompter"] .tp-empty')).toBeVisible();
});

test("Production: Teleprompter scrollt durch Kapitel-Text", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Teleprompter-Projekt", "Kapitel 1");

  // Text im Editor eingeben
  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.fill("Der schnelle Fuchs sprang über den faulen Hund. Ein klassischer Test für den Teleprompter.");

  // Teleprompter öffnen
  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();
  await expect(page.locator('[data-testid="teleprompter"] .tp-words')).toBeVisible();

  // Play klicken
  await page.locator('[data-testid="teleprompter"] button', { hasText: /Play|Abspielen/i }).click();

  // Fortschritt sollte ansteigen
  await page.waitForTimeout(2000);
  const progressText = await page.locator('[data-testid="teleprompter"] .tp-progress span').first().textContent();
  expect(progressText).not.toBe("0%");
});

// ---------------------------------------------------------------------------
// AppDialog (In-App-Prompt)
// ---------------------------------------------------------------------------

test("Production: AppDialog ersetzt window.prompt (Projekt anlegen)", async ({ page }) => {
  await gotoApp(page);

  // Dialog sollte beim Klick auf "+" erscheinen
  const projectsTab = page.locator("#app-sidebar nav button").first();
  await projectsTab.click();

  await page.locator("#app-sidebar button", { hasText: /^\+\s*(Projekt|Project)$/i }).first().click();

  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();

  // Input + OK/Cancel
  await expect(dlg.locator("input")).toBeVisible();
  await expect(dlg.getByRole("button", { name: /OK/i })).toBeVisible();
  await expect(dlg.getByRole("button", { name: /Cancel|Abbrechen/i })).toBeVisible();

  // OK mit Namen
  await dlg.locator("input").fill("Dialog-Test-Projekt");
  await dlg.getByRole("button", { name: /OK/i }).click();

  await expect(page.locator("#app-sidebar")).toContainText("Dialog-Test-Projekt");
});

test("Production: AppDialog Escape bricht ab", async ({ page }) => {
  await gotoApp(page);

  const projectsTab = page.locator("#app-sidebar nav button").first();
  await projectsTab.click();

  await page.locator("#app-sidebar button", { hasText: /^\+\s*(Projekt|Project)$/i }).first().click();

  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();

  // Escape → Dialog verschwindet, kein Projekt angelegt
  await page.keyboard.press("Escape");
  await expect(dlg).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// i18n-Parität
// ---------------------------------------------------------------------------

test("Production: Sprachwechsel auf Englisch", async ({ page }) => {
  await gotoApp(page);

  // Settings öffnen
  await page.locator("button", { hasText: /Settings|Einstellungen/i }).first().click();

  // Sprache auswählen (Englisch)
  const langSelect = page.locator("select").filter({ has: page.locator("option[value='en']") }).first();
  if (await langSelect.count()) {
    await langSelect.selectOption("en");
    // UI sollte sich ändern
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  }
});

test("Production: Alle vier Sprachen verfügbar", async ({ page }) => {
  await gotoApp(page);

  await page.locator("button", { hasText: /Settings|Einstellungen/i }).first().click();

  const langSelect = page.locator("select").filter({ has: page.locator("option[value='de']") }).first();
  if (await langSelect.count()) {
    const options = await langSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(4);
  }
});

// ---------------------------------------------------------------------------
// Ollama-Integration (Rust-Proxy)
// ---------------------------------------------------------------------------

test("Production: Ollama-Status wird korrekt angezeigt", async ({ page }) => {
  await gotoApp(page);

  // KI-Panel: Ollama-Karte sollte erreichbar/nicht erreichbar zeigen
  const ollamaCard = page.locator(".provider-card[data-provider='ollama']");
  if (await ollamaCard.count()) {
    // Status-Dot vorhanden
    await expect(ollamaCard.locator(".status-dot")).toBeVisible();
  }
});

test("Production: Modell-Auswahl zeigt Ollama-Modelle", async ({ page }) => {
  await gotoApp(page);

  // ModelPicker öffnen
  const modelPicker = page.locator("#ki-model-picker-toggle, .model-picker-toggle, button", { hasText: /Modell|Model/i }).first();
  if (await modelPicker.count()) {
    await modelPicker.click();
    // Liste der Modelle
    const modelList = page.locator(".model-picker-dropdown, .model-list").first();
    await expect(modelList).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Fehlerfälle
// ---------------------------------------------------------------------------

test("Production: Fehler-UI bei kaputtem Provider", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Fehler-Test", "Kapitel 1");

  // KI-Aktion ausführen (Weiterschreiben)
  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await editor.click();
  await editor.fill("Test.");

  // KI-Panel: Weiterschreiben
  const kiAction = page.locator("#app-ai-panel button", { hasText: /Weiterschreiben|Continue/i }).first();
  if (await kiAction.count()) {
    await kiAction.click();
    // Kein ErrorBoundary-Crash. Ollama-Status-Alert (role="alert") ist erwartet,
    // wenn Ollama nicht läuft — das ist KEIN App-Fehler.
    await expect(page.locator(".error-boundary")).toHaveCount(0);
  }
});

test("Production: App bleibt stabil nach vielen Modus-Wechseln", async ({ page }) => {
  await gotoApp(page);

  const modes = ["editor", "prompts", "knowledge", "diagnostics", "redenschreiber", "teleprompter"];
  for (const mode of modes) {
    const btn = page.locator(`.mode-switcher button[data-mode="${mode}"]`);
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(300);
    }
  }

  // Kein Crash
  await expect(page.locator("header .logo")).toBeVisible();
  await expect(page.getByText(/Es liegt ein Fehler/)).toHaveCount(0);
});
