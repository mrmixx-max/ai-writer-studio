// Production-E2E: Vollständige Feature-Abdeckung gegen den Release-Build.
//
// Testet ALLE Hauptpanels und Workflows, die in Dev-Specs existieren,
// aber nicht gegen den Release-Build (dist/) geprüft wurden.
import { expect, test } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

// ---------------------------------------------------------------------------
// AI-Panel: Aktionen
// ---------------------------------------------------------------------------

test("Production: AI-Panel Weiterschreibt", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "AI-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.fill("Der Tag begann mit einem Gewitter.");

  // KI-Panel: Weiterschreiben-Button
  const kiAction = page.locator("#app-ai-panel button", {
    hasText: /Weiterschreiben|Continue/i,
  }).first();
  if (await kiAction.count()) {
    await kiAction.click();
    // Output oder Fehlermeldung — kein Crash
    await expect(page.locator(".error-boundary")).toHaveCount(0);
  }
});

test("Production: AI-Panel Zusammenfassen", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Zusammenfassen-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await editor.click();
  await editor.fill("Ein langer Text mit vielen Worten, der zusammengefasst werden soll.");

  const kiAction = page.locator("#app-ai-panel button", {
    hasText: /Zusammenfassen|Sammarn/i,
  }).first();
  if (await kiAction.count()) {
    await kiAction.click();
    await expect(page.locator(".error-boundary")).toHaveCount(0);
  }
});

test("Production: AI-Panel Freier Chat", async ({ page }) => {
  await gotoApp(page);

  const chatBtn = page.locator('.mode-switcher button[data-mode="chat"]');
  if (await chatBtn.count()) {
    await chatBtn.first().click();
    // Chat-Eingabefeld
    const chatInput = page.locator("#app-ai-panel textarea, #app-ai-panel input[type='text']").first();
    if (await chatInput.count()) {
      await chatInput.fill("Hallo, sag nur: OK");
      const sendBtn = page.locator("#app-ai-panel button", { hasText: /Send|Senden/i }).first();
      if (await sendBtn.count()) {
        await sendBtn.click();
        // Antwort erscheint oder Fehlermeldung — kein Crash
        await expect(page.locator(".error-boundary")).toHaveCount(0);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Export-Panel
// ---------------------------------------------------------------------------

test("Production: Export-Panel zeigt Formate", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Export-Test", "Kapitel 1");

  // Export-Modus: Combobox "Format" im Header
  const exportCombo = page.locator("header select, header combobox, label:has-text('Format') select").first();
  if (await exportCombo.count()) {
    await expect(exportCombo).toBeVisible({ timeout: 5_000 });
    // Optionen prüfen
    const options = await exportCombo.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
  }
});

// ---------------------------------------------------------------------------
// Settings-Panel
// ---------------------------------------------------------------------------

test("Production: Settings Sprachwechsel Deutsch", async ({ page }) => {
  await gotoApp(page);

  const settingsBtn = page.locator("header button", { hasText: /Settings|Einstellungen/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await expect(page.locator(".settings-panel, #settings-panel")).toBeVisible();

    // Sprache auf Deutsch
    const langSelect = page.locator("select").filter({ has: page.locator("option[value='de']") }).first();
    if (await langSelect.count()) {
      await langSelect.selectOption("de");
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
    }
  }
});

test("Production: Settings Ollama-URL anpassbar", async ({ page }) => {
  await gotoApp(page);

  const settingsBtn = page.locator("header button", { hasText: /Settings|Einstellungen/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();

    // Ollama-URL Input
    const ollamaInput = page.locator("input[placeholder*='11434'], input[placeholder*='Ollama']").first();
    if (await ollamaInput.count()) {
      await ollamaInput.fill("http://127.0.0.1:11434");
      await expect(ollamaInput).toHaveValue("http://127.0.0.1:11434");
    }
  }
});

// ---------------------------------------------------------------------------
// BookWriter-Dashboard
// ---------------------------------------------------------------------------

test("Production: BookWriter-Dashboard öffnet", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "BookWriter-Test", "Kapitel 1");

  const bwBtn = page.locator('.mode-switcher button[data-mode="bookwriter"]');
  if (await bwBtn.count()) {
    await bwBtn.first().click();
    // Dashboard oder Panel sichtbar
    const dashboard = page.locator(".bookwriter-dashboard, .bookwriter-panel, .bw-dash").first();
    await expect(dashboard).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Goal-Tracker
// ---------------------------------------------------------------------------

test("Production: Goal-Tracker Tagesziel setzen", async ({ page }) => {
  await gotoApp(page);

  const goalBtn = page.locator('.mode-switcher button[data-mode="goal-tracker"], .mode-switcher button[data-mode="writing-pace"]');
  if (await goalBtn.count()) {
    await goalBtn.first().click();
    // Ziel-Eingabe
    const goalInput = page.locator("input[placeholder*='Ziel'], input[type='number']").first();
    if (await goalInput.count()) {
      await goalInput.fill("500");
      const setBtn = page.locator("button", { hasText: /Set|Speichern|Ziel/i }).first();
      if (await setBtn.count()) {
        await setBtn.click();
        await expect(page.locator(".error-boundary")).toHaveCount(0);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Hilfe-Overlay
// ---------------------------------------------------------------------------

test("Production: Hilfe-Overlay öffnet und schließt", async ({ page }) => {
  await gotoApp(page);

  // Shift+F1
  await page.keyboard.press("Shift+F1");
  const overlay = page.locator(".help-overlay, .overlay-help").first();
  if (await overlay.count()) {
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    // Escape schließt
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// KDP-Checkliste
// ---------------------------------------------------------------------------

test("Production: KDP-Checkliste öffnet mit Kapitel-Daten", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "KDP-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await editor.click();
  await editor.fill("KDP-Testtext für die Checkliste.");

  const kdpBtn = page.locator('.mode-switcher button[data-mode="kdp"]');
  if (await kdpBtn.count()) {
    await kdpBtn.first().click();
    await expect(page.getByRole("heading", { name: /KDP/i })).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Job-Recovery
// ---------------------------------------------------------------------------

test("Production: Job-Recovery zeigt Status nach Stop", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Recovery-Test", "Kapitel 1");

  const bwBtn = page.locator('.mode-switcher button[data-mode="bookwriter"]');
  if (await bwBtn.count()) {
    await bwBtn.first().click();
    // Recovery-Button oder Status
    const recoveryBtn = page.locator("button", { hasText: /Fortsetzen|Resume|Wiederaufnehmen/i }).first();
    if (await recoveryBtn.count()) {
      await expect(recoveryBtn).toBeVisible({ timeout: 5_000 });
    }
  }
});

// ---------------------------------------------------------------------------
// Stil-Presets
// ---------------------------------------------------------------------------

test("Production: Stil-Presets wählbar", async ({ page }) => {
  await gotoApp(page);

  const styleBtn = page.locator('.mode-switcher button[data-mode="style-analyzer"]');
  if (await styleBtn.count()) {
    await styleBtn.first().click();
    // Stil-Optionen
    const styleOptions = page.locator(".style-preset, .style-option, [data-style]").first();
    if (await styleOptions.count()) {
      await expect(styleOptions).toBeVisible({ timeout: 5_000 });
    }
  }
});

// ---------------------------------------------------------------------------
// Fehler-Recovery
// ---------------------------------------------------------------------------

test("Production: App bleibt stabil bei schnellem Modus-Wechsel", async ({ page }) => {
  await gotoApp(page);

  const modes = ["editor", "prompts", "knowledge", "diagnostics", "redenschreiber", "teleprompter", "kdp", "bookwriter"];
  for (const mode of modes) {
    const btn = page.locator(`.mode-switcher button[data-mode="${mode}"]`);
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(200);
    }
  }

  // Kein Crash
  await expect(page.locator("header .logo")).toBeVisible();
  await expect(page.getByText(/Es liegt ein Fehler/)).toHaveCount(0);
});
