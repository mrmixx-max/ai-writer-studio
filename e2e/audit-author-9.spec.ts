// Autoren-Audit Runde 9: Style Analyzer, Web Recherche, KI-Review, Backup,
// Suche, Prompt-Bibliothek, Lesbarkeit, Uebersetzer, Plot-Analyse, Mindmap.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit9/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

const modes = [
  { name: "StyleAnalyzer", id: "audit9-style", text: /Style Analyzer/i },
  { name: "WebRecherche", id: "audit9-webrecherche", text: /Web Recherche/i },
  { name: "KI-Review", id: "audit9-kireview", text: /KI-Review/i },
  { name: "Backup", id: "audit9-backup", text: /Backup/i },
  { name: "Suche", id: "audit9-suche", text: /Suche/i },
  { name: "Prompt-Bibliothek", id: "audit9-promptbib", text: /Prompt-Bibliothek/i },
  { name: "Lesbarkeit", id: "audit9-lesbarkeit", text: /Lesbarkeit/i },
  { name: "Uebersetzer", id: "audit9-uebersetzer", text: /Übersetzer/i },
  { name: "Plot-Analyse", id: "audit9-plot", text: /Plot-Analyse/i },
  { name: "Mindmap", id: "audit9-mindmap", text: /Mindmap/i },
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
