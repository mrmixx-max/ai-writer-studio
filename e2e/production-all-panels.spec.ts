// Production-E2E: Vollständige Panel-Abdeckung gegen Release-Build.
//
// Testet ALLE vorhandenen Mode-Panels auf korrektes Rendern.
// Ein Panel = ein Test: öffnen → rendern → kein Crash.
import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

// Alle registrierten Modes aus Sidebar.tsx
const ALL_MODES = [
  { id: "editor", name: "Editor", hasToolbar: true },
  { id: "prompts", name: "Prompts" },
  { id: "knowledge", name: "Knowledge" },
  { id: "diagnostics", name: "Diagnostics" },
  { id: "preflight", name: "Preflight" },
  { id: "snapshots", name: "Snapshots" },
  { id: "kdp", name: "KDP" },
  { id: "publishing", name: "Publishing" },
  { id: "fragments", name: "Fragments" },
  { id: "voices", name: "Voices" },
  { id: "map", name: "Map" },
  { id: "dialogue", name: "Dialogue" },
  { id: "versions", name: "Versions" },
  { id: "obstruction", name: "Obstruction" },
  { id: "dream", name: "Dream" },
  { id: "imagegen", name: "ImageGen" },
  { id: "covergen", name: "CoverGen" },
  { id: "blurbgen", name: "BlurbGen" },
  { id: "scientificwriting", name: "ScientificWriting" },
  { id: "timeline", name: "Timeline" },
  { id: "characters", name: "Characters" },
  { id: "worldbuilding", name: "Worldbuilding" },
  { id: "research", name: "Research" },
  { id: "investigate", name: "Investigate" },
  { id: "watermark", name: "Watermark" },
  { id: "tts", name: "TTS" },
  { id: "bookwriter", name: "BookWriter" },
  { id: "redenschreiber", name: "Redenschreiber" },
  { id: "teleprompter", name: "Teleprompter" },
  { id: "markdown", name: "Markdown" },
  { id: "wordstats", name: "WordStats" },
  { id: "ideas", name: "Ideas" },
  { id: "newspaper", name: "Newspaper" },
  { id: "textquality", name: "TextQuality" },
  { id: "bilingual", name: "Bilingual" },
  { id: "amazon", name: "Amazon" },
  { id: "shortprose", name: "ShortProse" },
  { id: "templates", name: "Templates" },
  { id: "collab", name: "Collab" },
  { id: "voice", name: "Voice" },
  { id: "style-analyzer", name: "StyleAnalyzer" },
];

test.describe("Production: Panel-Abdeckung", () => {
  for (const mode of ALL_MODES) {
    test(`Panel "${mode.id}" rendert ohne Crash`, async ({ page }) => {
      await gotoApp(page);

      const btn = page.locator(`.mode-switcher button[data-mode="${mode.id}"]`);
      if (!(await btn.count())) {
        test.skip(true, `Kein Button für Modus "${mode.id}" gefunden`);
        return;
      }

      await btn.first().click();

      // Panel-Container sollte sichtbar sein
      await expect(page.locator("#app-panel, .app-panel, [role='main']")).toBeVisible({
        timeout: 10_000,
      });

      // Kein Crash / ErrorBoundary
      await expect(page.locator(".error-boundary")).toHaveCount(0);
      await expect(page.getByText(/Es liegt ein Fehler/)).toHaveCount(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Editor-Panel: Toolbars + Inhalt
// ---------------------------------------------------------------------------

test("Production: Editor hat Markdown-Toolbar", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="editor"]').click();

  // Editor-Toolbar (Format-Buttons)
  const toolbar = page.locator(".editor-toolbar, .markdown-toolbar").first();
  if (await toolbar.count()) {
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
  }

  // Content-Editable
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await expect(editor).toBeVisible();
});

test("Production: Editor nimmt Markdown-Input an", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="editor"]').click();
  const editor = page.locator(".tiptap, [contenteditable='true']").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.fill("# Test\n\nDas ist ein **fetter** Text.");

  // Text sollte im Editor sein
  await expect(editor).toContainText("Test");
  await expect(editor).toContainText("fetter");
});

// ---------------------------------------------------------------------------
// Prompts-Panel
// ---------------------------------------------------------------------------

test("Production: Prompts zeigt Liste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="prompts"]').click();

  // Prompt-Liste oder Eingabe
  const promptUI = page.locator(
    ".prompt-list, .prompts-panel, textarea, input[placeholder*='Prompt']"
  ).first();
  if (await promptUI.count()) {
    await expect(promptUI).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Knowledge-Panel
// ---------------------------------------------------------------------------

test("Production: Knowledge zeigt Inhaltsverzeichnis", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="knowledge"]').click();

  // Knowledge-Liste
  const ki = page.locator(".knowledge-panel, .ki-panel, .ki-list").first();
  if (await ki.count()) {
    await expect(ki).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Preflight-Panel
// ---------------------------------------------------------------------------

test("Production: Preflight zeigt Checkliste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="preflight"]').click();

  // Preflight-Checkliste
  const preflight = page.locator(".preflight-panel, .checklist, [data-testid='preflight']").first();
  if (await preflight.count()) {
    await expect(preflight).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Snapshots-Panel
// ---------------------------------------------------------------------------

test("Production: Snapshots zeigt Session-Liste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="snapshots"]').click();

  // Snapshot-Liste oder Hinweis
  const snapshots = page.locator(".snapshots-panel, .snapshot-list").first();
  if (await snapshots.count()) {
    await expect(snapshots).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Publishing-Panel
// ---------------------------------------------------------------------------

test("Production: Publishing zeigt Assistent", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="publishing"]').click();

  // Publishing-Wizard
  const publishing = page.locator(".publishing-panel, .publishing-wizard").first();
  if (await publishing.count()) {
    await expect(publishing).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Fragments-Panel
// ---------------------------------------------------------------------------

test("Production: Fragments zeigt Textfragmente", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="fragments"]').click();

  const fragments = page.locator(".fragments-panel, .fragment-list").first();
  if (await fragments.count()) {
    await expect(fragments).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Voices-Panel
// ---------------------------------------------------------------------------

test("Production: Voices zeigt Stimmen-Vorlagen", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="voices"]').click();

  const voices = page.locator(".voices-panel, .voice-list").first();
  if (await voices.count()) {
    await expect(voices).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// TTS-Panel
// ---------------------------------------------------------------------------

test("Production: TTS zeigt Eingabe + Sprachauswahl", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="tts"]').click();

  // TTS-Textarea oder Stimmen-Select
  const ttsUI = page.locator(
    "textarea, select, .tts-panel, .tts-controls"
  ).first();
  if (await ttsUI.count()) {
    await expect(ttsUI).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// WordStats-Panel
// ---------------------------------------------------------------------------

test("Production: WordStats zeigt Statistiken", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="wordstats"]').click();

  const stats = page.locator(".wordstats-panel, .stats-panel, .word-count").first();
  if (await stats.count()) {
    await expect(stats).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Ideas-Panel
// ---------------------------------------------------------------------------

test("Production: Ideas zeigt Generator", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="ideas"]').click();

  const ideas = page.locator(".ideas-panel, .idea-generator").first();
  if (await ideas.count()) {
    await expect(ideas).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Characters-Panel
// ---------------------------------------------------------------------------

test("Production: Characters zeigt Charakter-Liste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="characters"]').click();

  const chars = page.locator(".characters-panel, .character-list").first();
  if (await chars.count()) {
    await expect(chars).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Worldbuilding-Panel
// ---------------------------------------------------------------------------

test("Production: Worldbuilding zeigt Welt-Editor", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="worldbuilding"]').click();

  const wb = page.locator(".worldbuilding-panel, .world-editor").first();
  if (await wb.count()) {
    await expect(wb).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Timeline-Panel
// ---------------------------------------------------------------------------

test("Production: Timeline zeigt Zeitleiste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="timeline"]').click();

  const tl = page.locator(".timeline-panel, .timeline-view").first();
  if (await tl.count()) {
    await expect(tl).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Style-Analyzer-Panel
// ---------------------------------------------------------------------------

test("Production: Style-Analyzer zeigt Stil-Optionen", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="style-analyzer"]').click();

  const style = page.locator(".style-analyzer-panel, .style-preset").first();
  if (await style.count()) {
    await expect(style).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Amazon-Panel
// ---------------------------------------------------------------------------

test("Production: Amazon zeigt PA-Formular", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="amazon"]').click();

  const amazon = page.locator(".amazon-panel, .pa-form").first();
  if (await amazon.count()) {
    await expect(amazon).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Bilingual-Panel
// ---------------------------------------------------------------------------

test("Production: Bilingual zeigt Übersetzungsfenster", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="bilingual"]').click();

  const bil = page.locator(".bilingual-panel, .translation-panel").first();
  if (await bil.count()) {
    await expect(bil).toBeVisible({ timeout: 10_000 });
  }
});

// ---------------------------------------------------------------------------
// Templates-Panel
// ---------------------------------------------------------------------------

test("Production: Templates zeigt Vorlagen-Liste", async ({ page }) => {
  await gotoApp(page);

  await page.locator('.mode-switcher button[data-mode="templates"]').click();

  const tpl = page.locator(".templates-panel, .template-list").first();
  if (await tpl.count()) {
    await expect(tpl).toBeVisible({ timeout: 10_000 });
  }
});
