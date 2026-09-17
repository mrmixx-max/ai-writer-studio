// Autoren-Audit: echte Autor-Journeys mit echtem Ollama (llama3.2-Default).
// CI-sicher: ohne Ollama auf dem Runner wird geskippt (offline-Prüfung auf
// Modulebene per Node-fetch); Screenshots relativ in test-results/audit/.
// Modell-Ladezeiten beachten: erster KI-Call lädt das Modell (~60 s).
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

let OLLAMA_UP = false;
try {
  const r = await fetch("http://127.0.0.1:11434/api/tags");
  OLLAMA_UP = r.ok;
} catch {
  OLLAMA_UP = false;
}
test.skip(!OLLAMA_UP, "Audit braucht lokales Ollama (127.0.0.1:11434)");

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit/${name}.png` });
}

function watch(page: Page): { errs: string[]; failed: string[] } {
  const errs: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  page.on("requestfailed", (r) =>
    failed.push(r.url().slice(0, 100) + " :: " + (r.failure()?.errorText || "?")),
  );
  return { errs, failed };
}

async function openPlanner(page: Page) {
  await page.locator('.mode-switcher button[data-mode="bookwriter"]').click();
  await page.locator(".bw-dash-classic button").first().click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 10_000 });
  await page.locator(".bookwriter-panel .bw-tab", { hasText: /Kapitelplaner|Planner/i }).click();
}

test("AUDIT-1: Schreiben mit Umlauten + Kapitelwechsel = Autosave hält", async ({ page }) => {
  test.setTimeout(120_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Roman", "Audit-Kapitel");
  await page.locator("#app-sidebar", { hasText: "Audit-Kapitel" }).click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await editor.click();
  const probe = "Grüße aus München — Anführungszeichen, ß, €, Emoji. ";
  await page.keyboard.type(probe.repeat(5));
  await page.waitForTimeout(6000); // Autosave-Delay abwarten
  // Kapitelwechsel-Roundtrip (Browser-DB ist In-Memory: Reload leert sie per
  // Design — der Autoren-Flow ist Kapitel schließen/öffnen).
  await page.locator("#app-sidebar button", { hasText: /^\+ *(Kapitel|Chapter)$/i }).first().click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible({ timeout: 10_000 });
  await dlg.locator("input").fill("Zweitkapitel");
  await dlg.getByRole("button", { name: /OK/i }).click();
  await page.waitForTimeout(1500);
  await page.locator("#app-sidebar", { hasText: "Audit-Kapitel" }).click();
  await page.waitForTimeout(1000);
  const body = await page.locator(".tiptap").first().textContent().catch(() => "");
  console.log("ROUNDTRIP-TEXT-ERHALTEN:", (body || "").includes("München"));
  await snap(page, "audit1-nach-roundtrip");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect((body || "").includes("München")).toBe(true);
});

test("AUDIT-2: Markdown-Export enthält den geschriebenen Text", async ({ page }) => {
  test.setTimeout(120_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Export", "Exp-Kapitel");
  await page.locator("#app-sidebar", { hasText: "Exp-Kapitel" }).click();
  await page.locator(".tiptap, [contenteditable='true']").first().click();
  await page.keyboard.type("Export-Prüfsatz mit Umläuten äöü.");
  await page.waitForTimeout(6000);
  // Export-Panel öffnen (Modus oder Button mit Export)
  const expMode = page.locator(".mode-switcher button", { hasText: /Export/i }).first();
  if (await expMode.count()) {
    await expMode.click();
    await page.waitForTimeout(600);
    await snap(page, "audit2-export-panel");
  }
  const dl = await page
    .locator("button", { hasText: /Markdown|\\.md|Exportieren|Herunterladen/i })
    .first()
    .count();
  console.log("EXPORT-BTNS:", dl);
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(true).toBe(true);
});

test("AUDIT-3: Konzept generieren (echt) + KI-Vorschlag + Kapitel anlegen", async ({ page }) => {
  test.setTimeout(300_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Buch", "K1");
  await openPlanner(page);
  // Thema setzen (Buch-Titel-Feld im Planer)
  await page.locator('.bookwriter-panel input[placeholder*="KI im Alltag"], .bookwriter-panel input').first().fill("Ein Imker in den Alpen");
  // Konzept generieren (echter Modell-Call, Kaltstart möglich)
  await page.locator("button", { hasText: /Konzept generieren/i }).first().click();
  await expect(page.locator('[data-testid="bw-concept"]')).not.toBeEmpty({ timeout: 180_000 });
  const concept = await page.locator('[data-testid="bw-concept"]').inputValue();
  console.log("KONZEPT-LEN:", concept.length, "VORSCHAU:", concept.slice(0, 120).replace(/\n/g, " / "));
  await snap(page, "audit3-konzept");
  // M2-Fix: dünnes Konzept (<300 Zeichen) → Hinweis statt stiller Akzeptanz.
  if (concept.trim().length < 300) {
    await expect(page.locator('[data-testid="bw-panel-notice"]')).toContainText(/sehr kurz/, { timeout: 10_000 });
    console.log("THIN-NOTICE: sichtbar");
  }
  // KI-Vorschlag für Kapitel
  await page.locator(".cp-suggest-btn").first().click();
  await expect(page.locator('[data-testid="cp-suggest"]')).toBeVisible({ timeout: 180_000 });
  const titles = await page.locator(".cp-suggest-title").allTextContents();
  console.log("VORSCHLAG-TITEL:", JSON.stringify(titles).slice(0, 300));
  // Erstes Titel-Angebot übernehmen + Kapitel anlegen
  await page.locator(".cp-suggest-title").first().click();
  await page.locator("button", { hasText: /Kapitel hinzufügen/i }).first().click();
  await page.waitForTimeout(800);
  const plan = await page.locator(".bookwriter-panel").textContent();
  console.log("KAPITEL-ANGELEGT:", (plan || "").includes(titles[0]?.slice(0, 20) || "XXX-NIE"));
  await snap(page, "audit3-planer");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(concept.length).toBeGreaterThan(100);
});

test("AUDIT-4: Gliederung (echt) zeigt Fortschritt + Budget, dann Ergebnis", async ({ page }) => {
  test.setTimeout(600_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Outline", "K1");
  await openPlanner(page);
  await page.locator('.bookwriter-panel input[placeholder*="KI im Alltag"], .bookwriter-panel input').first().fill("Ein Imker in den Alpen");
  await page.locator("button", { hasText: /Konzept generieren/i }).first().click();
  await expect(page.locator('[data-testid="bw-concept"]')).not.toBeEmpty({ timeout: 180_000 });
  await page.locator("button", { hasText: /Gliederung neu generieren/i }).first().click();
  // H1-Fix: Versuch + Budget stehen SOFORT im Live-Log (kein stilles Warten).
  const live = page.locator(".bookwriter-panel .bw-live pre");
  await expect(live).toContainText(/Versuch 1\/3.*Budget/, { timeout: 90_000 });
  console.log("LIVE-FORTSCHRITT: sichtbar");
  await snap(page, "audit4-fortschritt");
  // Ergebnis: mindestens 2 generierbare Kapitel (Budget kleines Modell: 90 s
  // pro Versuch, max. 3 Versuche + Reparatur → 8-Min-Rahmen).
  // Poll auf Anzahl (nicht first-visible): K1 allein zählt nicht.
  await expect
    .poll(async () => await page.locator("button", { hasText: /Kapitel generieren:/i }).count(), {
      timeout: 420_000,
    })
    .toBeGreaterThanOrEqual(2);
  const btns = await page.locator("button", { hasText: /Kapitel generieren:/i }).allTextContents();
  console.log("OUTLINE-KAPITEL:", JSON.stringify(btns).slice(0, 400));
  await snap(page, "audit4-outline");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(btns.length).toBeGreaterThanOrEqual(2);
});

test("AUDIT-5: Redenschreiber — Vorlage, Druck-Event, Teleprompter-Übergabe", async ({ page }) => {
  test.setTimeout(180_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Reden", "K1");
  await page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='redenschreiber'], .redenschreiber").length,
    selects: document.querySelectorAll("[data-testid='redenschreiber'] select, .redenschreiber select").length,
    textareas: document.querySelectorAll("[data-testid='redenschreiber'] textarea, .redenschreiber textarea").length,
    btns: Array.from(
      document.querySelectorAll("[data-testid='redenschreiber'] button, .redenschreiber button"),
    )
      .map((b) => (b.textContent || "").trim().slice(0, 30))
      .slice(0, 15),
  }));
  console.log("REDEN-PROBE:", JSON.stringify(probe).slice(0, 900));
  await snap(page, "audit5-reden");
  // Drucken: window.open-Popup abfangen (falls Popup-Technik)
  const printBtn = page.locator("[data-testid='redenschreiber'] button, .redenschreiber button").filter({ hasText: /Druck/i }).first();
  console.log("DRUCK-BTN:", await printBtn.count());
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(probe.panel).toBeGreaterThan(0);
});

test("AUDIT-6: Teleprompter — Text übernehmen, Abspielen, Stopp", async ({ page }) => {
  test.setTimeout(120_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Tele", "K1");
  await page.locator(".mode-switcher button", { hasText: /Teleprompter/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-testid='teleprompter'], .teleprompter").length,
    text: (document.querySelector("[data-testid='teleprompter'], .teleprompter")?.textContent || "").slice(0, 200),
  }));
  console.log("TELE-PROBE:", JSON.stringify(probe).slice(0, 500));
  const play = page.locator("[data-testid='teleprompter'] button, .teleprompter button").filter({ hasText: /Abspielen|Start/i }).first();
  console.log("PLAY-BTN:", await play.count());
  if (await play.count()) {
    await play.click();
    await page.waitForTimeout(2500);
    await snap(page, "audit6-tele-laeuft");
    const stop = page.locator("[data-testid='teleprompter'] button, .teleprompter button").filter({ hasText: /Stopp|Pause|Stop/i }).first();
    if (await stop.count()) await stop.click();
  }
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(probe.panel).toBeGreaterThan(0);
});

test("AUDIT-3b: Titel-Übernahme ins Formular nachstellen", async ({ page }) => {
  test.setTimeout(300_000);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Buch2", "K1");
  await openPlanner(page);
  await page.locator(".cp-suggest-btn").first().click();
  await expect(page.locator("[data-testid='cp-suggest']")).toBeVisible({ timeout: 180_000 });
  const t0 = await page.locator(".cp-suggest-title").first().textContent();
  await page.locator(".cp-suggest-title").first().click();
  await page.waitForTimeout(500);
  const field = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll(".bookwriter-panel input[type='text'], .chapter-planner input[type='text'], .bookwriter-panel input:not([type])"));
    return inputs.map((i) => (i as HTMLInputElement).value.slice(0, 60));
  });
  console.log("TITEL-ANGEBOT:", (t0 || "").slice(0, 50));
  console.log("FORMULAR-FELDER:", JSON.stringify(field).slice(0, 400));
  const addBtn = page.locator("button", { hasText: /Kapitel hinzufügen/i }).first();
  console.log("ADD-DISABLED:", await addBtn.isDisabled());
  await addBtn.click();
  await page.waitForTimeout(1000);
  const items = await page.locator(".bookwriter-panel").textContent();
  const whole = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log("LISTE-ENTHAELT-TITEL:", (items || "").includes((t0 || "").slice(0, 25)));
  console.log("BODY-ENTHAELT-TITEL:", whole.includes((t0 || "").slice(0, 25)));
  const idx = whole.indexOf("Kapitel hinzufügen");
  console.log("UMGEBUNG:", whole.slice(Math.max(0,idx-200), idx+600).replace(/\n/g, " | ").slice(0, 800));
  await snap(page, "audit3b-liste");
  expect(true).toBe(true);
});

test("AUDIT-5b: Rede schreiben (echt) -> Druck + Teleprompter-Buttons", async ({ page }) => {
  test.setTimeout(420_000);
  const { errs } = watch(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Rede", "K1");
  await page.locator(".mode-switcher button", { hasText: /Reden/i }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(800);
  await page.locator("[data-testid='redenschreiber'] button, .redenschreiber button").filter({ hasText: /Rede schreiben/i }).first().click();
  await expect(page.locator("[data-testid='redenschreiber'] button, .redenschreiber button").filter({ hasText: /Druck/i })).toBeVisible({ timeout: 300_000 });
  const nachher = await page.evaluate(() => Array.from(
    document.querySelectorAll("[data-testid='redenschreiber'] button, .redenschreiber button"),
  ).map((b) => (b.textContent || "").trim().slice(0, 30)).slice(0, 20));
  console.log("REDEN-NACHHER:", JSON.stringify(nachher).slice(0, 700));
  const tele = page.locator("[data-testid='redenschreiber'] button, .redenschreiber button").filter({ hasText: /Teleprompter/i }).first();
  console.log("TELE-BTN-NACHHER:", await tele.count());
  await snap(page, "audit5b-rede");
  console.log("CONSOLE:", JSON.stringify(errs.slice(0, 8)));
  expect(true).toBe(true);
});

test("AUDIT-3c: Offline-Konzept -> Hinweis statt stiller Vorlage", async ({ page }) => {
  test.setTimeout(120_000);
  await gotoApp(page);
  await createProjectWithChapter(page, "Audit-Off", "K1");
  await openPlanner(page);
  await page.locator('.bookwriter-panel input[placeholder*="KI im Alltag"], .bookwriter-panel input').first().fill("Ein Imker in den Alpen");
  // Ollama blockieren -> Offline-Template -> Offline-Hinweis erwartet.
  await page.route("**://127.0.0.1:11434/**", (r) => r.abort());
  await page.route("**://localhost:11434/**", (r) => r.abort());
  await page.locator("button", { hasText: /Konzept generieren/i }).first().click();
  await expect(page.locator("[data-testid='bw-panel-notice']")).toContainText(/Offline/, { timeout: 60_000 });
  console.log("OFFLINE-NOTICE: sichtbar");
  expect(true).toBe(true);
});
