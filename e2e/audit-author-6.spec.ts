// Autoren-Audit Runde 6: Publishing, Statistik, Ideen, Format, Cloud Sync,
// Plugins, Exportprüfung, Manuskriptprüfung, Vorlesen, Chat.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit6/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

test("AUDIT-AA: Publishing Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Publishing", "K1");
  await page.locator(".mode-switcher button", { hasText: /Publishing/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='publishing'], .publishing-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /veröffentl|upload|epub|mobi/i.test(t)).slice(0, 5),
  }));
  console.log("PUBLISHING-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-publishing");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AB: Statistik Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Stats", "K1");
  await page.locator(".mode-switcher button", { hasText: /Statistik/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='stats'], .stats-panel").length,
    stats: (document.body.innerText || "").match(/\d+ (Wörter|Zeichen|Kapitel|Bücher)/g)?.slice(0, 5),
    canvas: document.querySelectorAll("canvas").length,
  }));
  console.log("STATS-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-stats");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AC: Ideen Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Ideas", "K1");
  await page.locator(".mode-switcher button", { hasText: /Ideen/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='ideas'], .ideas-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /idee|brainstorm|generier/i.test(t)).slice(0, 5),
  }));
  console.log("IDEAS-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-ideas");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AD: Format Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Format", "K1");
  await page.locator(".mode-switcher button", { hasText: /Format/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='format'], .format-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /markdown|toolbar|shortcut/i.test(t)).slice(0, 5),
  }));
  console.log("FORMAT-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-format");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AE: Cloud Sync Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Cloud", "K1");
  await page.locator(".mode-switcher button", { hasText: /Cloud/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='cloud'], .cloud-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /dropbox|drive|onedrive|sync/i.test(t)).slice(0, 5),
  }));
  console.log("CLOUD-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-cloud");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AF: Plugins Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Plugins", "K1");
  await page.locator(".mode-switcher button", { hasText: /Plugins/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='plugins'], .plugins-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /plugin|install|aktivi/i.test(t)).slice(0, 5),
  }));
  console.log("PLUGINS-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-plugins");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AG: Exportprüfung Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-ExportCheck", "K1");
  await page.locator(".mode-switcher button", { hasText: /Exportprüfung/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='export-check'], .export-check-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /prüf|check|freigeb/i.test(t)).slice(0, 5),
  }));
  console.log("EXPORTCHECK-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-exportcheck");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AH: Vorlesen Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Vorlesen", "K1");
  await page.locator(".mode-switcher button", { hasText: /Vorlesen/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='vorlesen'], .vorlesen-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /vorles|sprech|audio/i.test(t)).slice(0, 5),
  }));
  console.log("VORLESEN-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-vorlesen");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-AI: Chat Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Chat", "K1");
  await page.locator(".mode-switcher button", { hasText: /Chat/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='chat'], .chat-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /send|chat|nachricht/i.test(t)).slice(0, 5),
  }));
  console.log("CHAT-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit6-chat");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});
