// Gemeinsame E2E-Helfer: App-Start mit übersprungenem Welcome-Wizard.
//
// Das Welcome-Overlay fängt im Erststart-Zustand alle Klicks ab (position:
// fixed über der ganzen Fläche). Für Widget-Tests überspringen wir das Setup
// deterministisch per localStorage-Flags — die Flags werden VOR App-Start
// gesetzt (addInitScript), damit es kein Race zwischen Overlay und Klick gibt.
import { expect, type Page } from "@playwright/test";

export const SKIP_SETUP = () => {
  localStorage.setItem("aiws.setup.completed", "1");
  localStorage.setItem("aiws.setup.version", "1");
};

/**
 * Öffnet die App mit übersprungenem Wizard und wartet, bis die Haupt-UI
 * bedienbar ist (Header sichtbar, Welcome-Overlay vollständig entfernt).
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(SKIP_SETUP);
  await page.goto("/");
  // App-Gerüst (Header-Logo) ist der Stabilitäts-Anker.
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  // Welcome-Overlay abwarten, falls es doch kurz gerendert wird — egal ob es
  // nie erscheint (dann sofort vorbei) oder erst ausgeblendet wird.
  await page
    .locator(".welcome-overlay")
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {
      /* Overlay kam nie — auch gut. */
    });
}

/**
 * Legt per Sidebar ein Projekt + Kapitel an (window.prompt wird accepted),
 * sodass Editor und Export-Flows echte Daten haben.
 */
export async function createProjectWithChapter(
  page: Page,
  projectName = "E2E-Projekt",
  chapterTitle = "Kapitel 1",
): Promise<void> {
  page.on("dialog", (d) => {
    void d.accept(currentPromptValue(d.message(), projectName, chapterTitle));
  });

  await page
    .locator("#app-sidebar button", { hasText: "+ Projekt" })
    .first()
    .click();
  await expect(page.locator("#app-sidebar")).toContainText(projectName, {
    timeout: 10_000,
  });

  await page
    .locator("#app-sidebar button", { hasText: "+ Kapitel" })
    .first()
    .click();
  // Kapitel erscheint in der Sidebar → Projekt wurde geöffnet.
  await expect(page.locator("#app-sidebar")).toContainText(chapterTitle, {
    timeout: 10_000,
  });
}

function currentPromptValue(message: string, projectName: string, chapterTitle: string): string {
  if (/Kapitel/i.test(message)) return chapterTitle;
  return projectName;
}
