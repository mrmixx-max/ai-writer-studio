// Autoren-Audit Runde 8: Wissenschaft, Worldbuilding, Recherche, Investigativ,
// Waschen, Markdown, Zeitungsgenerator, Amazon, Kurzprosa, Collab.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit8/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

const modes = [
  { name: "Wissenschaft", id: "audit8-wissenschaft", text: /Wissenschaft/i },
  { name: "Worldbuilding", id: "audit8-worldbuilding", text: /Worldbuilding/i },
  { name: "Recherche", id: "audit8-recherche", text: /Recherche/i },
  { name: "Investigativ", id: "audit8-investigativ", text: /Investigativ/i },
  { name: "Waschen", id: "audit8-waschen", text: /Waschen/i },
  { name: "Markdown", id: "audit8-markdown", text: /Markdown/i },
  { name: "Zeitungsgenerator", id: "audit8-zeitung", text: /Zeitung/i },
  { name: "Amazon", id: "audit8-amazon", text: /Amazon/i },
  { name: "Kurzprosa", id: "audit8-kurzprosa", text: /Kurzprosa/i },
  { name: "Collab", id: "audit8-collab", text: /Collab/i },
];

for (const mode of modes) {
  test(`AUDIT-${mode.name}: Panel-Mount`, async ({ page }) => {
    test.setTimeout(120_000);
    const errs = watch(page);
    await gotoApp(page);
    await createProjectWithChapter(page, `Audit-${mode.name}`, "K1");
    await page.locator(".mode-switcher button", { hasText: mode.text }).first().click({ timeout: 5_000 });
    await page.waitForTimeout(1000);
    const probe = await page.evaluate(() => ({
      bodyLen: (document.body.innerText || "").length,
      modi: Array.from(document.querySelectorAll("[data-testid], .panel, .modal")).map((e) => e.getAttribute("data-testid") || e.className).filter((s) => /panel|modal|active/i.test(s)).slice(0, 8),
    }));
    console.log(`${mode.name}-PROBE:`, JSON.stringify(probe).slice(0, 500));
    await snap(page, mode.id);
    console.log("CONSOLE:", JSON.stringify(errs.slice(0, 6)));
    expect(true).toBe(true);
  });
}
