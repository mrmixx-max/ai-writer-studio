// E2E Runde 2: KDP-Checkliste in der echten UI (Sidebar-Modus "KDP").
// Die Checkliste braucht einen Bookwriter-Lauf mit Metadaten-Artefakt —
// dieser wird per echtem Service (createRun/saveArtifact, keine Mocks)
// angelegt, danach rendert das echte Panel. Offline, 0 echte Calls.
import { expect, test, type Page } from "@playwright/test";
import { createProjectWithChapter, gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

/** Legt Lauf + Metadaten-Artefakt für das aktive Projekt an (echte Services). */
async function seedKdpRun(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const store = await import("/src/store/projectStore.ts");
    const state = await import("/src/services/bookwriter/state.ts");
    const projectId = store.useProjectStore.getState().activeProjectId;
    if (!projectId) throw new Error("kein aktives Projekt");
    const run = state.createRun(projectId, "auto");
    await state.saveArtifact(run.id, "metadaten", "metadata", {
      title: "E2E-KDP-Buch",
      subtitle: "Untertitel",
      blurbVariants: ["Klappentext-Variante eins mit genug Zeichen."],
      shortDescription: "Kurzbeschreibung mit ausreichend vielen Zeichen hier.",
      keywords: ["test", "e2e", "buch", "kdp", "roman", "fiktion", "probe"],
      categories: ["Fiction / General"],
      authorBio: "Autorenbio mit ausreichend vielen Zeichen für die Prüfung.",
      seriesIdea: null,
      marketingNotes: null,
      coverImage: null,
      priceUsd: 2.99,
    });
  });
}

async function openKdpMode(page: Page): Promise<void> {
  await page.locator('.mode-switcher button[aria-label="KDP"]').click();
  await expect(page.locator(".kdp")).toBeVisible({ timeout: 15_000 });
}

test("KDP-Modus zeigt Checkliste mit Einträgen", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "E2E-KDP-Projekt");
  await seedKdpRun(page);
  await openKdpMode(page);

  const list = page.locator(".kdp-list");
  await expect(list).toBeVisible({ timeout: 15_000 });
  expect(await list.locator(".kdp-item").count()).toBeGreaterThan(0);
  // Jeder Eintrag hat Label + Hinweis.
  const firstLabel = await list.locator(".kdp-item-label").first().textContent();
  expect((firstLabel ?? "").trim().length).toBeGreaterThan(0);
});

test("KDP-Zusammenfassung mit Fortschritt rendert", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);
  await createProjectWithChapter(page, "E2E-KDP-Projekt");
  await seedKdpRun(page);
  await openKdpMode(page);

  await expect(page.locator(".kdp-list")).toBeVisible({ timeout: 15_000 });
  const summary = page.locator(".kdp-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(/Punkte erfüllt/);
  await expect(summary.locator(".kdp-bar-fill")).toHaveCount(1);
  // Kein ErrorBoundary-Fallback.
  await expect(
    page.getByText(/Es liegt ein Fehler in der Anwendung/),
  ).toHaveCount(0);
});
