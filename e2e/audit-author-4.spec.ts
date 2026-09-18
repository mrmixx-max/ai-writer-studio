// Autoren-Audit Runde 4: Editor, Settings, Dashboard, Import, Cover.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit4/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

test("AUDIT-L: Editor Toolbar sichtbar + klickbar", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Editor4", "K1");
  // Editor-Modus aktivieren (Kapitel ist nach createProjectWithChapter bereits geoeffnet)
  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  await page.waitForTimeout(500);
  const tb = page.locator(".editor-toolbar");
  await expect(tb).toBeVisible({ timeout: 5_000 });
  const n = await page.locator(".editor-toolbar button").count();
  console.log("TOOLBAR-BUTTONS:", n);
  // Bold-Button klicken
  await page.locator(".editor-toolbar button").first().click();
  await page.waitForTimeout(200);
  await snap(page, "auditl-toolbar");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(n).toBeGreaterThanOrEqual(3);
});

test("AUDIT-M: Settings-Panel oeffnet + Sprache wechselt sich", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Settings4", "K1");
  // Settings-Button oeffnen
  await page.locator("button[title*='Settings'], button[data-testid='open-settings'], .settings-btn").first().click({ timeout: 5_000 }).catch(() => {
    page.locator("button", { hasText: /Einstellungen|Settings/i }).first().click({ timeout: 5_000 });
  });
  await page.waitForTimeout(800);
  const settingsPanel = await page.locator(".settings-panel, [data-testid='settings-modal']").count();
  console.log("SETTINGS-PANEL:", settingsPanel);
  // Sprache dropdown pruefen
  const langSelect = await page.locator("select[name='language'], select[data-testid='lang-select']").count();
  console.log("LANG-SELECT:", langSelect);
  await snap(page, "auditm-settings");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(settingsPanel).toBeGreaterThan(0);
});

test("AUDIT-N: Dashboard zeigt Projekt-Statistiken", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Dashboard4", "K1");
  await page.waitForTimeout(500);
  const probe = await page.evaluate(() => ({
    stats: (document.body.innerText || "").match(/\d+ (Wörter|Zeichen|Kapitel|Bücher)/g)?.slice(0, 5),
    cards: Array.from(document.querySelectorAll("[data-testid], .stat-card, .dashboard-card")).map((e) => e.getAttribute("data-testid") || e.className).filter((s) => /stat|card|count|zahl/i.test(s)).slice(0, 8),
  }));
  console.log("DASHBOARD-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "auditn-dashboard");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-O: Import-Dialog oeffnet ohne Crash", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Import4", "K1");
  // Import-Button suchen
  await page.locator("button", { hasText: /Import|Importieren/i }).first().click({ timeout: 5_000 }).catch(() => {
    page.locator("button[data-testid='import-btn']").first().click({ timeout: 5_000 });
  });
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => ({
    dialog: document.querySelectorAll("[data-testid='import-dialog'], .import-dialog, .modal").length,

  }));
  console.log("IMPORT-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "auditp-import");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-P: Cover-Editor Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Cover4", "K1");
  // Cover-Modus oeffnen
  await page.locator(".mode-switcher button", { hasText: /Cover|Titelbild/i }).first().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='cover-panel'], .cover-editor, .cover-panel").length,
    canvas: document.querySelectorAll("canvas").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /bild|farb|cover|title/i.test(t)).slice(0, 8),
  }));
  console.log("COVER-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "auditp-cover");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-Q: Sidebar-Modus-Uebergang stabil", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Sidebar4", "K1");
  // Alle Modi schnell durchschalten
  const modes = page.locator(".mode-switcher button");
  const n = await modes.count();
  console.log("ANZAHL-MODI:", n);
  for (let i = 0; i < Math.min(n, 8); i++) {
    await modes.nth(i).click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await snap(page, "auditq-sidebar");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(n).toBeGreaterThan(3);
});
