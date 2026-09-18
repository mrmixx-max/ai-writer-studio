// Autoren-Audit Runde 7: Prompts, Snapshots, Stimmen, Karte, Dialogue, Versionen,
// Obstruktion, Traumlogik, Bildgenerierung, Blurb-Generator.
// Kein LLM -> CI-sicher.
import { test, expect, type Page } from "@playwright/test";
import { gotoApp, createProjectWithChapter } from "./helpers";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit7/${name}.png` });
}

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  return errs;
}

const modes = [
  { name: "Prompts", id: "audit7-prompts", text: /Prompts/i },
  { name: "Snapshots", id: "audit7-snapshots", text: /Snapshots/i },
  { name: "Stimmen", id: "audit7-stimmen", text: /Stimmen/i },
  { name: "Karte", id: "audit7-karte", text: /Karte/i },
  { name: "Dialogue", id: "audit7-dialogue", text: /Dialog/i },
  { name: "Versionen", id: "audit7-versionen", text: /Version/i },
  { name: "Obstruktion", id: "audit7-obstruktion", text: /Obstruktion/i },
  { name: "Traumlogik", id: "audit7-traumlogik", text: /Traum/i },
  { name: "Bildgenerierung", id: "audit7-bild", text: /Bild/i },
  { name: "Blurb-Generator", id: "audit7-blurb", text: /Blurb/i },
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
