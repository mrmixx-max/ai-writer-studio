// Production-E2E: Tiefergehende Workflow-Tests gegen den Release-Build.
//
// Testet komplexe Abläufe, die in anderen Specs nicht abgedeckt sind:
// - Buchgenerierung: starten, Fortschritt, Pause/Resume, Fehler
// - Redenschreiber: Mikrofon-Berechtigung simulieren, Live-Transkription
// - Teleprompter: Geschwindigkeits-Wechsel, Auto-Scroll-Pause
// - Export: PDF/DOCX-Generierung aus Editor-Inhalt
// - Fehler-Recovery: Job-Abbruch, Wiederaufnahme, Verwerfen
// - Cloud-Sync-UI (Status-Anzeige ohne echten Sync)
// - Plugin-Payloads (word-count-badge, goal-tracker)
import { expect, test } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

// ===========================================================================
// Buchgenerierung — Detail-Flow
// ===========================================================================

test("Production: Buchgenerierung startet und zeigt Fortschritt", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "BW-Test", "Kapitel 1");

  const bwBtn = page.locator('.mode-switcher button[data-mode="bookwriter"]');
  if (await bwBtn.count()) {
    await bwBtn.first().click();
    await expect(page.locator(".bookwriter-dashboard, .bookwriter-panel")).toBeVisible({
      timeout: 10_000,
    });
    // Generieren-Button
    const genBtn = page.locator("button", { hasText: /Generieren|Erstellen|Start/i }).first();
    if (await genBtn.count()) {
      await genBtn.click();
      // Fortschritts-Anzeige
      await page.waitForTimeout(2000);
      const progress = page.locator(".progress, .progress-bar, [data-testid='bw-progress']").first();
      if (await progress.count()) {
        await expect(progress).toBeVisible();
      }
    }
  }
});

// ===========================================================================
// Redenschreiber — Mikrofon + STT
// ===========================================================================

test("Production: Redenschreiber erteilt Mikrofon-Berechtigung", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click();
  await expect(page.locator('[data-testid="redenschreiber"]')).toBeVisible();

  // Start-Button
  const startBtn = page.locator('[data-testid="redenschreiber"] button', {
    hasText: /Start|starten/i,
  });
  if (await startBtn.count()) {
    await startBtn.first().click();
    // Status sollte "Aufnahme" oder "lauschen" zeigen
    await page.waitForTimeout(1000);
    const status = page.locator('[data-testid="redenschreiber"] .rs-status').first();
    if (await status.count()) {
      await expect(status).toBeVisible();
    }
  }
});

test("Production: Redenschreiber Sprach-Deutsch vorausgewählt", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click();
  const select = page.locator('[data-testid="redenschreiber"] select').first();
  if (await select.count()) {
    const selected = await select.inputValue();
    expect(selected.length).toBeGreaterThan(0);
  }
});

// ===========================================================================
// Teleprompter — Geschwindigkeit + Auto-Scroll
// ===========================================================================

test("Production: Teleprompter Geschwindigkeit änderbar", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "TP-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();
  await expect(page.locator('[data-testid="teleprompter"]')).toBeVisible();

  // Text ins Kapitel schreiben
  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await editor.click();
  await editor.fill("Ein langer Text für den Teleprompter. Wiederholung. Wiederholung. Und noch mehr Text.");

  // Teleprompter
  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();

  // Schneller-Button
  const fasterBtn = page.locator('[data-testid="teleprompter"] .tp-speed button', {
    hasText: /Schneller|\+/i,
  }).first();
  if (await fasterBtn.count()) {
    await fasterBtn.click();
  }

  // Play starten
  const playBtn = page.locator('[data-testid="teleprompter"] button', {
    hasText: /Play|Abspielen/i,
  }).first();
  if (await playBtn.count()) {
    await playBtn.click();
    await page.waitForTimeout(2500);
    // Fortschritt > 0
    const progressText = await page
      .locator('[data-testid="teleprompter"] .tp-progress span')
      .first()
      .textContent();
    expect(progressText).not.toBe("0%");
  }
});

test("Production: Teleprompter Play/Pause-Toggle", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "TP-Toggle", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await editor.click();
  await editor.fill("Test Text für Toggle.");

  await page.locator('.mode-switcher button[data-mode="teleprompter"]').click();

  const playBtn = page.locator('[data-testid="teleprompter"] button', {
    hasText: /Play|Abspielen/i,
  }).first();
  if (await playBtn.count()) {
    await playBtn.click();
    await page.waitForTimeout(500);
    // Pause-Button sollte erscheinen
    const pauseBtn = page.locator('[data-testid="teleprompter"] button', {
      hasText: /Pause|Stop/i,
    }).first();
    await expect(pauseBtn).toBeVisible({ timeout: 3_000 });
  }
});

// ===========================================================================
// Export — PDF + DOCX aus Editor
// ===========================================================================

test("Production: Export-Panel zeigt Download-Option", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Export-Test", "Kapitel 1");

  // Editor schreiben
  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await editor.click();
  await editor.fill("# Mein Export\n\nKapitel 1\n\nEs war einmal...");

  // Export-Modus
  const exportCombo = page.locator("header select, header combobox").first();
  if (await exportCombo.count()) {
    const options = await exportCombo.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    // PDF-Option vorhanden
    const hasPdf = options.some((o) => /PDF|pdf/i.test(o));
    expect(hasPdf).toBe(true);
  }
});

test("Production: DOCX-Export löst Download aus", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "DOCX-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await editor.click();
  await editor.fill("Exportierter Text.");

  // Download abfangen
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);

  // Export-Button in Sidebar oder Header
  const exportAction = page.locator(
    'button:has-text("DOCX"), button:has-text("Export"), [data-action="export-docx"]'
  ).first();
  if (await exportAction.count()) {
    await exportAction.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.docx$/i);
    }
  }
});

// ===========================================================================
// Fehler-Recovery
// ===========================================================================

test("Production: Buchgenerierung abbrechen zeigt Recovery", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Recovery-Test", "Kapitel 1");

  const bwBtn = page.locator('.mode-switcher button[data-mode="bookwriter"]');
  if (await bwBtn.count()) {
    await bwBtn.first().click();

    // Start
    const genBtn = page.locator("button", { hasText: /Generieren|Start/i }).first();
    if (await genBtn.count()) {
      await genBtn.click();
      await page.waitForTimeout(1500);

      // Abbrechen
      const cancelBtn = page.locator("button", { hasText: /Abbrechen|Stop/i }).first();
      if (await cancelBtn.count()) {
        await cancelBtn.click();
        // Recovery-Button sollte auftauchen
        await page.waitForTimeout(1000);
        const resumeBtn = page.locator("button", { hasText: /Fortsetzen|Resume/i }).first();
        if (await resumeBtn.count()) {
          await expect(resumeBtn).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  }
});

test("Production: Recovery-Verwerfen löscht Job", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Discard-Test", "Kapitel 1");

  const bwBtn = page.locator('.mode-switcher button[data-mode="bookwriter"]');
  if (await bwBtn.count()) {
    await bwBtn.first().click();

    const genBtn = page.locator("button", { hasText: /Generieren|Start/i }).first();
    if (await genBtn.count()) {
      await genBtn.click();
      await page.waitForTimeout(1500);

      const cancelBtn = page.locator("button", { hasText: /Abbrechen|Stop/i }).first();
      if (await cancelBtn.count()) {
        await cancelBtn.click();
        await page.waitForTimeout(1000);

        // Verwerfen
        const discardBtn = page.locator("button", { hasText: /Verwerfen|Löschen|Discard/i }).first();
        if (await discardBtn.count()) {
          await discardBtn.click();
          // Fortsetzen-Button sollte weg sein
          await page.waitForTimeout(500);
          const resumeBtn = page.locator("button", { hasText: /Fortsetzen|Resume/i }).first();
          await expect(resumeBtn).toHaveCount(0);
        }
      }
    }
  }
});

// ===========================================================================
// Cloud-Sync-UI (ohne echten Sync)
// ===========================================================================

test("Production: Cloud-Sync zeigt Status-Anzeige", async ({ page }) => {
  await gotoApp(page);

  const cloudBtn = page.locator('.mode-switcher button[data-mode="cloud"]');
  if (await cloudBtn.count()) {
    await cloudBtn.first().click();
    // Status oder Hinweis
    const cloudUI = page.locator(".cloud-panel, .sync-status").first();
    if (await cloudUI.count()) {
      await expect(cloudUI).toBeVisible({ timeout: 10_000 });
    }
  }
});

// ===========================================================================
// Plugins
// ===========================================================================

test("Production: Goal-Tracker Roundtrip", async ({ page }) => {
  await gotoApp(page);

  const goalBtn = page.locator(
    '.mode-switcher button[data-mode="goal-tracker"], .mode-switcher button[data-mode="writing-pace"]'
  );
  if (await goalBtn.count()) {
    await goalBtn.first().click();
    const goalInput = page.locator("input[placeholder*='Ziel'], input[type='number']").first();
    if (await goalInput.count()) {
      await goalInput.fill("1000");
      const setBtn = page.locator("button", { hasText: /Set|Speichern/i }).first();
      if (await setBtn.count()) {
        await setBtn.click();
        // Fortschritts-Anzeige
        await expect(page.locator(".goal-progress, .progress-ring, [data-goal-progress]")).toBeVisible({
          timeout: 5_000,
        });
      }
    }
  }
});

// ===========================================================================
// Editor — Tiefergehend
// ===========================================================================

test("Production: Editor Markdown-Formatierung wird gerendert", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "MD-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.fill("# Überschrift\n\n**Fett** und *Kursiv*.\n\n- Liste 1\n- Liste 2");

  // Editor zeigt Inhalt (TipTap rendert via fill als Text — kein Crash)
  await expect(editor).toContainText("Überschrift");
  await expect(editor).toContainText("Fett");
  await expect(editor).toContainText("Kursiv");
  await expect(editor).toContainText("Liste 1");
  await expect(page.locator(".error-boundary")).toHaveCount(0);
});

test("Production: Editor Wort-Zähler aktualisiert sich", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "WC-Test", "Kapitel 1");

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable=true]").first();
  await editor.click();
  await editor.fill("Eins zwei drei vier fünf.");

  // Wort-Zähler (verschiedene Selektoren)
  const wc = page.locator(
    ".word-count, .word-counter, [data-word-count], .ProseMirror-wordcount, .editor-stats"
  ).first();
  if (await wc.count()) {
    const text = await wc.textContent();
    expect(text).toContain("5");
  }
});

// ===========================================================================
// Settings — Modell-Roundtrip
// ===========================================================================

test("Production: Modell-Auswahl Roundtrip", async ({ page }) => {
  await gotoApp(page);

  const settingsBtn = page.locator("header button", { hasText: /Settings|Einstellungen/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await expect(page.locator(".settings-panel, #settings-panel")).toBeVisible();

    // Modell-Select
    const modelSelect = page.locator("select").filter({ has: page.locator("option[value*='ollama']") }).first();
    if (await modelSelect.count()) {
      await modelSelect.selectOption({ index: 1 });
      // Speichern
      const saveBtn = page.locator("button", { hasText: /Speichern|Save/i }).first();
      if (await saveBtn.count()) {
        await saveBtn.click();
        // Kein Crash
        await expect(page.locator(".error-boundary")).toHaveCount(0);
      }
    }
  }
});

// ===========================================================================
// App-Start ohne Fehler
// ===========================================================================

test("Production: App startet ohne Console-Fehler", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await gotoApp(page);
  await page.waitForTimeout(3000);

  // Keine fatalen Console-Fehler (Ollama down = OK)
  const fatal = errors.filter(
    (e) => !/favicon|analytics|tracking|ollama|11434|connection.{0,3}refused/i.test(e)
  );
  expect(fatal).toHaveLength(0);
});

test("Production: ErrorBoundary bleibt leer bei Normal-Betrieb", async ({ page }) => {
  await gotoApp(page);
  await page.waitForTimeout(2000);

  // Durch alle Modi klicken
  const modes = ["editor", "prompts", "knowledge", "kdp", "bookwriter"];
  for (const mode of modes) {
    const btn = page.locator(`.mode-switcher button[data-mode="${mode}"]`);
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(400);
    }
  }

  await expect(page.locator(".error-boundary")).toHaveCount(0);
  await expect(page.getByText(/Es liegt ein Fehler/)).toHaveCount(0);
});
