// E2E: Projekt anlegen — über die Sidebar per "+ Projekt" (window.prompt).
// Der Erststart-Assistent wird per localStorage-Flag übersprungen (siehe
// helpers.ts); sein Ablauf ist in der manuellen Desktop-Abnahme abgedeckt.
import { expect, test } from "@playwright/test";
import { createProjectWithChapter, gotoApp } from "./helpers";

test("Projekt über die Sidebar anlegen", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "E2E-Projekt");
  // Zusätzlich: das Kapitel ist angelegt und der Editor-Kontext steht.
  await expect(page.locator("#app-sidebar")).toContainText("Kapitel 1");
});

test("Kapitel über die Sidebar anlegen", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page, "Kapitel-Projekt", "Zweites Kapitel");
  await expect(page.locator("#app-sidebar")).toContainText("Zweites Kapitel");
});
