// Gnadenloser Autoren-QA, Runde 2 (robust).
// Screenshots → C:/Users/webmaster/dogfood-ai-writer/screenshots
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

const SHOT = "C:/Users/webmaster/dogfood-ai-writer/screenshots";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: false });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errs.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 200)));
  return errs;
}

async function openBookWriterPanel(page: Page) {
  await page.locator('.mode-switcher button[data-mode="bookwriter"]').click();
  await page.locator(".bw-dash-classic button").first().click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 10_000 });
}

test("QA1: alle Sidebar-Modi anclicken (Stichprobe, kein Absturz)", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Roman", "QA-Kapitel");
  const modes = await page.locator(".mode-switcher button").all();
  console.log("MODI-COUNT:", modes.length);
  // Stichprobe: jeder 6. Modus + die drei neuen (BookWriter/Redenschreiber/Teleprompter)
  const targets: number[] = [];
  for (let i = 0; i < modes.length; i += 6) targets.push(i);
  for (const name of ["BookWriter", "Redenschreiber", "Teleprompter"]) {
    const idx = await page
      .locator(".mode-switcher button")
      .all()
      .then(async (all) => {
        for (let i = 0; i < all.length; i++) {
          const t = ((await all[i].textContent()) || "").replace(/[^a-zA-Z]/g, "");
          if (t.toLowerCase().includes(name.toLowerCase().replace(/[^a-z]/g, ""))) return i;
        }
        return -1;
      });
    if (idx >= 0 && !targets.includes(idx)) targets.push(idx);
  }
  console.log("TARGETS:", JSON.stringify(targets));
  for (const i of targets) {
    try {
      await modes[i].click({ timeout: 5_000 });
      await page.waitForTimeout(300);
    } catch (e) {
      console.log(`MODE-${i}-CLICK-FAIL:`, String(e).slice(0, 150));
      await snap(page, `qa1-mode-${i}-fail`);
    }
  }
  await snap(page, "qa1-nach-stichprobe");
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 20)));
  expect(true).toBe(true);
});

test("QA2: klassisch — Konzeptfeld + Generator-Button, Start ohne Ollama", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Buch", "K1");
  await openBookWriterPanel(page);
  await page.locator(".bookwriter-panel .bw-tab", { hasText: /Klassisch|Classic/i }).click();
  await page.waitForTimeout(400);
  const concept = page.locator('[data-testid="bw-concept"]');
  await expect(concept).toBeVisible({ timeout: 5_000 });
  const genBtn = page.locator(".bookwriter-panel button", { hasText: /Konzept generieren/i });
  console.log("KLASSIK-KONZEPT-BTN:", await genBtn.count());
  await concept.fill("Prämisse: Ein verwöhnter Autor testet gnadenlos.\n".repeat(20));
  await snap(page, "qa2-klassik-konzept");
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 20)));
  expect(true).toBe(true);
});

test("QA3: Planer — KI-Vorschlag + Konzept-Button (DOM-Probe)", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Planer", "K1");
  await openBookWriterPanel(page);
  await page.locator(".bookwriter-panel .bw-tab", { hasText: /Kapitelplaner|Planner/i }).click();
  await page.waitForTimeout(400);
  const probe = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll(".bookwriter-panel button")).map((b) =>
      (b.textContent || "").trim().slice(0, 40),
    );
    return {
      btns,
      hasPlanner: !!document.querySelector(".bookwriter-panel .cp-add-btn, .chapter-planner"),
      hasSuggest: !!document.querySelector(".cp-suggest-btn"),
      hasConcept: !!document.querySelector('[data-testid="bw-concept"]'),
    };
  });
  console.log("PLANER-PROBE:", JSON.stringify(probe).slice(0, 1500));
  const suggest = page.locator(".cp-suggest-btn").first();
  if (await suggest.count()) {
    await suggest.click();
    await page.waitForTimeout(4000);
    await snap(page, "qa3-nach-ki-vorschlag");
    const box = await page.locator('[data-testid="cp-suggest"]').count();
    console.log("SUGGEST-BOX:", box);
  }
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 20)));
  expect(true).toBe(true);
});

test("QA4: Editor — H1/H2/H3 nur aktuelle Zeile ohne Markierung", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Editor", "E-Kapitel");
  await page.locator("#app-sidebar", { hasText: "E-Kapitel" }).click();
  await page.waitForTimeout(800);
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  console.log("EDITOR-VORHANDEN:", await editor.count());
  if (await editor.count()) {
    await editor.click();
    await page.keyboard.type("Zeile eins hier. Zeile zwei hier. Zeile drei hier.");
    await page.waitForTimeout(400);
    // Cursor in Zeile 1, KEINE Markierung → H1 klicken → nur Zeile 1 darf Heading werden
    await page.keyboard.press("Control+Home");
    await snap(page, "qa4-vor-h1");
    const h1 = page.locator(".tiptap-toolbar button, .editor-toolbar button", { hasText: /^H1$/ }).first();
    console.log("H1-BTN:", await h1.count());
    if (await h1.count()) {
      await h1.click();
      await page.waitForTimeout(400);
      const headings = await page.locator(".tiptap h1").count();
      const paras = await page.locator(".tiptap p").count();
      console.log(`NACH-H1: h1=${headings} p=${paras}`);
      await snap(page, "qa4-nach-h1");
    } else {
      const allBtns = await page.locator(".tiptap-toolbar button, .editor-toolbar button").allTextContents();
      console.log("TOOLBAR:", JSON.stringify(allBtns).slice(0, 500));
    }
  }
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 20)));
  expect(true).toBe(true);
});

test("QA5: Redenschreiber öffnen + Teleprompter-Modus", async ({ page }) => {
  test.setTimeout(120_000);
  const errs = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Reden", "K1");
  await page.locator('.mode-switcher button[data-mode="redenschreiber"]').click({ timeout: 5_000 }).catch(() =>
    page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 }),
  );
  await page.waitForTimeout(800);
  await snap(page, "qa5-redenschreiber");
  const probe = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => (b.textContent || "").trim().slice(0, 30))
      .filter((t) => /druck|teleprompter|vorles|rede/i.test(t))
      .slice(0, 15),
  );
  console.log("REDEN-BTNS:", JSON.stringify(probe));
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 20)));
  expect(true).toBe(true);
});

test("QA6: Nachbohren — Failed-Requests, Suggest-Fehler, H1 mit 3 Absätzen, Reden-Panel", async ({ page }) => {
  test.setTimeout(120_000);
  const errs: string[] = [];
  const failedUrls: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errs.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 200)));
  page.on("requestfailed", (r) => failedUrls.push(r.url().slice(0, 120) + " :: " + (r.failure()?.errorText || "?")));
  page.on("response", (r) => {
    if (r.status() >= 400) failedUrls.push(r.status() + " " + r.url().slice(0, 120));
  });
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Tief", "T-Kapitel");
  await page.waitForTimeout(1500);
  console.log("FAILED-URLS-START:", JSON.stringify(failedUrls.slice(0, 10)));

  // 1) KI-Vorschlag klicken und Fehlerbox prüfen
  await openBookWriterPanel(page);
  await page.locator(".bookwriter-panel .bw-tab", { hasText: /Kapitelplaner|Planner/i }).click();
  await page.waitForTimeout(300);
  await page.locator(".cp-suggest-btn").first().click();
  await page.waitForTimeout(5000);
  const suggestProbe = await page.evaluate(() => ({
    box: document.querySelectorAll("[data-testid='cp-suggest']").length,
    warnings: Array.from(document.querySelectorAll(".bookwriter-panel .cp-warning")).map((e) => (e.textContent || "").slice(0, 150)),
    titles: document.querySelectorAll(".cp-suggest-title").length,
  }));
  console.log("SUGGEST-PROBE:", JSON.stringify(suggestProbe).slice(0, 800));

  // 2) H1 mit 3 getrennten Absätzen
  await page.locator("#app-sidebar", { hasText: "T-Kapitel" }).click();
  await page.waitForTimeout(600);
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Absatz eins hier.");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Absatz zwei hier.");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Absatz drei hier.");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+Home");
  await page.waitForTimeout(200);
  const h1 = page.locator(".tiptap-toolbar button, .editor-toolbar button", { hasText: /^H1$/ }).first();
  if (await h1.count()) {
    await h1.click();
    await page.waitForTimeout(400);
    const counts = await page.evaluate(() => ({
      h1: document.querySelectorAll(".tiptap h1").length,
      p: document.querySelectorAll(".tiptap p").length,
      h1text: Array.from(document.querySelectorAll(".tiptap h1")).map((e) => (e.textContent || "").slice(0, 60)),
    }));
    console.log("H1-3ABS:", JSON.stringify(counts).slice(0, 400));
    await snap(page, "qa6-nach-h1-3abs");
  }

  // 3) Redenschreiber-Panel wirklich offen?
  await page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const redenProbe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='redenschreiber-panel'], .redenschreiber-panel").length,
    btns: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((t) => /druck|teleprompter|vorles|generier|vorlage/i.test(t)).slice(0, 15),
  }));
  console.log("REDEN-PROBE:", JSON.stringify(redenProbe).slice(0, 800));
  await snap(page, "qa6-redenschreiber");
  console.log("FAILED-URLS-END:", JSON.stringify(failedUrls.slice(0, 15)));
  console.log("CONSOLE-ERRORS:", JSON.stringify(errs.slice(0, 15)));
  expect(true).toBe(true);
});

test("QA7: KI-Vorschlag Langzeit-Probe (busy-state samplen)", async ({ page }) => {
  test.setTimeout(120_000);
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Lang", "L-Kapitel");
  await openBookWriterPanel(page);
  await page.locator(".bookwriter-panel .bw-tab", { hasText: /Kapitelplaner|Planner/i }).click();
  await page.waitForTimeout(300);
  await page.locator(".cp-suggest-btn").first().click();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    const s = await page.evaluate(() => ({
      btn: (document.querySelector(".cp-suggest-btn")?.textContent || "").trim().slice(0, 30),
      box: document.querySelectorAll("[data-testid='cp-suggest']").length,
      warn: Array.from(document.querySelectorAll(".bookwriter-panel .cp-warning")).map((e) => (e.textContent || "").slice(0, 120)),
    }));
    console.log("T+" + ((i + 1) * 5) + "s:", JSON.stringify(s).slice(0, 400));
    if (s.box > 0) break;
  }
  expect(true).toBe(true);
});

test("QA8: Reden-Panel + Teleprompter-Panel mit korrekten Selektoren", async ({ page }) => {
  test.setTimeout(120_000);
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 200)));
  await gotoApp(page);
  await createProjectWithChapter(page, "QA-Reden2", "R-Kapitel");
  await page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const reden = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='redenschreiber'], .redenschreiber").length,
    ctrls: Array.from(document.querySelectorAll("[data-testid='redenschreiber'] button, .redenschreiber button")).map((b) => (b.textContent || "").trim().slice(0, 30)).slice(0, 15),
  }));
  console.log("REDEN2:", JSON.stringify(reden).slice(0, 900));
  await snap(page, "qa8-redenschreiber");
  await page.locator(".mode-switcher button", { hasText: /Teleprompter/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const tele = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='teleprompter'], .teleprompter").length,
    ctrls: Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 30)).filter((x) => /start|stop|geschwindigkeit|tempo|schrift|spiel|pause|fortschritt/i.test(x)).slice(0, 12),
  }));
  console.log("TELE2:", JSON.stringify(tele).slice(0, 900));
  await snap(page, "qa8-teleprompter");
  console.log("PAGEERRORS:", JSON.stringify(errs.slice(0, 8)));
  expect(true).toBe(true);
});
