// Tests: E2E Helpers für Playwright.
import type { Page } from "@playwright/test";

export async function setupTestProject(page: Page, name: string = "Test-Projekt"): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Neues Projekt/i }).click();
  await page.getByLabel(/Projektname/i).fill(name);
  await page.getByRole("button", { name: /Erstellen/i }).click();
  await page.waitForSelector(`text=${name}`);
}

export async function waitForGeneration(page: Page, timeout: number = 60000): Promise<void> {
  await page.waitForSelector(/Generierung abgeschlossen|Kapitel generiert/i, {
    timeout,
  });
}

export async function selectGenre(page: Page, genre: string): Promise<void> {
  await page.getByLabel(/Genre/i).selectOption(genre);
}

export async function selectStylePreset(page: Page, preset: string): Promise<void> {
  await page.getByLabel(/Stil\/Ton/i).selectOption(preset);
}

export async function enterCustomTone(page: Page, tone: string): Promise<void> {
  await page.getByLabel(/Eigener Ton/i).fill(tone);
}
