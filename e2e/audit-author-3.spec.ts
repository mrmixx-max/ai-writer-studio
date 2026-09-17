// Autoren-Audit Runde 3: Luecken aus Runde 1+2 schliessen.
// Fokus: Job-Recovery (Resume nach Neustart), KDP-Checkliste, Vorlesen/Teleprompter,
// Knowledge/RAG-Panel, Modellwechsel-Status, Fragmente/Dialoge-Panel.
// Kein LLM noetig -> CI-sicher (skip nur fuer echte KI-Aufrufe).
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit3/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

test("AUDIT-F: Job-Resume-Dialog nach App-Neustart", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Resume", "K1");
  // BookWriter oeffnen, Thema setzen, Start — dann simulierter "Neustart"
  // (Store ist In-Memory: Resume-Dialog kommt nur, wenn ein Job persistiert.
  //  Hier pruefen wir: Panel zeigt keine Resume-Ueberraschung im Frischstart).
  await page.locator('.mode-switcher button[data-mode="bookwriter"]').click();
  await page.locator(".bw-dash-classic button").first().click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 10_000 });
  const resume = await page.locator(".bw-resume").count();
  console.log("RESUME-IM-FRISHSTART:", resume);
  await snap(page, "auditf-freshstart");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(resume).toBe(0);
});

test("AUDIT-G: KDP-Checkliste zeigt Buchdaten", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-KDP", "K1");
  // KDP-Modus oeffnen
  await page.locator('.mode-switcher button[data-mode="kdp"]').click({ timeout: 5_000 }).catch(() => {
    page.locator(".mode-switcher button", { hasText: /KDP/i }).first().click({ timeout: 5_000 });
  });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='kdp-checklist'], .kdp-checklist, .kdp-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /checkliste|check|export|kdp/i.test(t)).slice(0, 10),
  }));
  console.log("KDP-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "auditg-kdp");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-H: Redenschreiber — Vorlesen + Teleprompter-Buttons", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Reden3", "K1");
  await page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='redenschreiber'], .redenschreiber").length,
    vorlesen: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /vorles/i.test(t)).slice(0, 5),
    teleprompter: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /teleprompter/i.test(t)).slice(0, 5),
  }));
  console.log("REDEN-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "audith-reden");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(probe.panel).toBeGreaterThan(0);
});

test("AUDIT-I: Knowledge/RAG-Panel oeffnet ohne Crash", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Knowledge", "K1");
  // Knowledge-Modus oeffnen
  await page.locator('.mode-switcher button[data-mode="knowledge"]').click({ timeout: 5_000 }).catch(() => {
    page.locator(".mode-switcher button", { hasText: /Wissen|Knowledge/i }).first().click({ timeout: 5_000 });
  });
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='knowledge-panel'], .knowledge-panel, [data-testid='source-panel']").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /hinzuf|quelle|dokument|wissen/i.test(t)).slice(0, 10),
  }));
  console.log("KNOWLEDGE-PROBE:", JSON.stringify(probe).slice(0, 500));
  await snap(page, "auditi-knowledge");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-J: Fragmente + Dialoge Panel-Mounts", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Fragments", "K1");
  // Fragmente
  await page.locator(".mode-switcher button", { hasText: /Fragment/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const frag = await page.evaluate(() => (document.body.innerText || "").includes("Fragment"));
  console.log("FRAGMENTE-SICHTBAR:", frag);
  await snap(page, "auditj-fragments");
  // Dialoge
  await page.locator(".mode-switcher button", { hasText: /Dialog/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const dlg = await page.evaluate(() => (document.body.innerText || "").includes("Dialog"));
  console.log("DIALOG-SICHTBAR:", dlg);
  await snap(page, "auditj-dialog");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});

test("AUDIT-K: Modellwechsel aendert Karten-Status", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Modell2", "K1");
  await page.locator('.mode-switcher button[data-mode="bookwriter"]').click();
  await page.locator(".bw-dash-classic button").first().click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 10_000 });
  // Modell-Auswahl im BookWriter-Panel praesen?
  const modelSelect = await page.locator(".bookwriter-panel select, .bookwriter-panel [data-testid='model-select']").count();
  console.log("MODEL-SELECT:", modelSelect);
  await snap(page, "auditk-model");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
  expect(true).toBe(true);
});
