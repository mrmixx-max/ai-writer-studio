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

// ---------------------------------------------------------------------------
// Sprint 8 / Agent 4: BookWriter-Flow-Helfer (Genre, Stil/Ton, Generation).
// Die BookWriter-Ansicht lebt im Sidebar-Modus "BookWriter" (Dashboard);
// das klassische Vollautomatik-Panel ist hinter dem Toggle
// "Buchgenerierung starten / steuern" eingeklappt.
// ---------------------------------------------------------------------------

/** Öffnet den BookWriter-Modus und klappt das klassische Generierungs-Panel auf. */
export async function openBookWriter(page: Page): Promise<void> {
  await page.locator('.mode-switcher button[aria-label="BookWriter"]').click();
  const toggle = page.locator(".bw-dash-classic button").first();
  await toggle.click();
  await expect(page.locator(".bookwriter-panel")).toBeVisible({ timeout: 10_000 });
}

/**
 * Richtet ein Testprojekt ein und öffnet den BookWriter:
 * gotoApp → Projekt + Kapitel → BookWriter-Modus.
 */
export async function setupTestProject(
  page: Page,
  projectName = "E2E-Buchprojekt",
  chapterTitle = "Kapitel 1",
): Promise<void> {
  await gotoApp(page);
  await createProjectWithChapter(page, projectName, chapterTitle);
  await openBookWriter(page);
}

/** Wechselt im BookWriter-Panel auf den Klassik-Tab (Vollautomatik mit Start-Button). */
export async function switchToClassicTab(page: Page): Promise<void> {
  await page.locator(".bookwriter-panel .bw-tab", { hasText: "Klassisch" }).click();
}

/**
 * Wählt ein Genre im BookWriter-Panel (Klassik-Ansicht).
 * UI-Genres: Sachbuch, Roman, Thriller, Fantasy, Selbsthilfe, Business.
 */
export async function selectGenre(page: Page, genre: string): Promise<void> {
  const select = page.locator('.bookwriter-panel label:has-text("Genre") select').first();
  await select.selectOption({ label: genre });
  await expect(select).toHaveValue(genre);
}

/**
 * Wählt ein Stil/Ton-Preset (8 Presets aus prompts.json, Sprint 7).
 * Gibt die angezeigte Preset-Beschreibung zurück.
 */
export async function selectStylePreset(page: Page, presetId: string): Promise<string> {
  const select = page.locator('[data-testid="bw-style-select"]').first();
  await select.selectOption(presetId);
  const description = page.locator('[data-testid="bw-style-description"]').first();
  await expect(description).toBeVisible({ timeout: 5_000 });
  return (await description.textContent())?.trim() ?? "";
}

/**
 * Eigener Ton: Die UI bietet (Sprint 7) ausschließlich die 8 Presets im
 * Dropdown an — kein Freitextfeld. Der "eigene Ton" ist daher die Wahl eines
 * Presets per ID; diese Funktion dokumentiert genau diesen Pfad und prüft,
 * dass die Beschreibung erscheint (Transparenz-Anforderung).
 */
export async function enterCustomTone(page: Page, presetId: string): Promise<string> {
  return selectStylePreset(page, presetId);
}

/** Wartet auf den Abschluss der Vollautomatik-Generierung ("🎉 Buch fertig!"). */
export async function waitForGeneration(page: Page, timeout = 120_000): Promise<void> {
  await expect(page.locator(".bookwriter-panel .bw-live pre")).toContainText(
    "🎉 Buch fertig!",
    { timeout },
  );
}
