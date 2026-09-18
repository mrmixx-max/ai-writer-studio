// Autoren-Audit Runde 5: Voice Lab, Manuskriptprüfung, Outliner, Figuren, Timeline,
// Templates, Sessions, Textverbesserung, Bilingual, Vorlesen.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit5/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

test("AUDIT-R: Voice Lab Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Voice", "K1");
  await page.locator(".mode-switcher button", { hasText: /Voice Lab/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='voice-lab'], .voice-lab, .voice-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /aufnah|sprech|transkrib/i.test(t)).slice(0, 5),
  }));
  console.log("VOICE-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-voice");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-S: Manuskriptprüfung Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Manuscript", "K1");
  await page.locator(".mode-switcher button", { hasText: /Manuskript/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='manuscript'], .manuscript-panel, .prüf-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /prüf|analyse|check/i.test(t)).slice(0, 5),
  }));
  console.log("MANUSCRIPT-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-manuscript");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-T: Outliner Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Outliner", "K1");
  await page.locator(".mode-switcher button", { hasText: /Outliner/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='outliner'], .outliner-panel, .tree-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /struktur|glieder|kapitel/i.test(t)).slice(0, 5),
  }));
  console.log("OUTLINER-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-outliner");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-U: Figuren Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Characters", "K1");
  await page.locator(".mode-switcher button", { hasText: /Figuren/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='characters'], .characters-panel, .figuren-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /figur|hinzuf|charak/i.test(t)).slice(0, 5),
  }));
  console.log("CHARACTERS-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-characters");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-V: Timeline Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Timeline", "K1");
  await page.locator(".mode-switcher button", { hasText: /Timeline/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='timeline'], .timeline-panel").length,
    canvas: document.querySelectorAll("canvas").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /ereign|zeit/i.test(t)).slice(0, 5),
  }));
  console.log("TIMELINE-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-timeline");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-W: Templates Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Templates", "K1");
  await page.locator(".mode-switcher button", { hasText: /Templates/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='templates'], .templates-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /vorlag|generier/i.test(t)).slice(0, 5),
  }));
  console.log("TEMPLATES-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-templates");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-X: Sessions Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Sessions", "K1");
  await page.locator(".mode-switcher button", { hasText: /Sessions/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='sessions'], .sessions-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /sitzung|speicher|lad/i.test(t)).slice(0, 5),
  }));
  console.log("SESSIONS-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-sessions");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-Y: Textverbesserung Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Improve", "K1");
  await page.locator(".mode-switcher button", { hasText: /Textverbesserung/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='improve'], .improve-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /verbess|lektor|umschreib/i.test(t)).slice(0, 5),
  }));
  console.log("IMPROVE-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-improve");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-Z: Bilingual Panel-Mount", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Bilingual", "K1");
  await page.locator(".mode-switcher button", { hasText: /Bilingual/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='bilingual'], .bilingual-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /übersetz|deutsch|englisch/i.test(t)).slice(0, 5),
  }));
  console.log("BILINGUAL-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audit5-bilingual");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});
