/**
 * Tests: ComicPanelOrchestrator (WP 77.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  parseProseToPanels,
  groupPanelsIntoPages,
  createComicScript,
  formatComicScript,
  exportAsMarkdown,
  createSampleScript,
  BALLOON_LABELS,
} from "./comicPanelOrchestrator";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("parseProseToPanels", () => {
  it("zerlegt Prosa in Panels", () => {
    const text = "Der Held stand auf dem Dach. Die Stadt brannte unter ihm.";
    const panels = parseProseToPanels(text);
    expect(panels.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const text = "Der Held stand auf dem Dach. Die Stadt brannte unter ihm.";
    const p1 = parseProseToPanels(text);
    const p2 = parseProseToPanels(text);
    expect(p1).toEqual(p2);
  });

  it("verarbeitet leeren Text", () => {
    expect(parseProseToPanels("")).toEqual([]);
  });
});

describe("groupPanelsIntoPages", () => {
  it("gruppiert Panels in Seiten", () => {
    const text = "A. B. C. D. E. F. G. H.";
    const panels = parseProseToPanels(text);
    const pages = groupPanelsIntoPages(panels);
    expect(pages.length).toBeGreaterThan(0);
  });

  it("erstellt leere Seitenliste für leere Panels", () => {
    expect(groupPanelsIntoPages([])).toEqual([]);
  });
});

describe("createComicScript", () => {
  it("erstellt vollständiges Skript", () => {
    const text = "Der Held stand auf dem Dach. Die Stadt brannte.";
    const script = createComicScript("Test", text, "dark-horse");
    expect(script.title).toBe("Test");
    expect(script.pages.length).toBeGreaterThan(0);
    expect(script.totalPanels).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const text = "Der Held stand auf dem Dach. Die Stadt brannte.";
    const s1 = createComicScript("Test", text, "dark-horse");
    const s2 = createComicScript("Test", text, "dark-horse");
    expect(s1).toEqual(s2);
  });
});

describe("formatComicScript", () => {
  it("formatiert Skript als Text", () => {
    const script = createSampleScript();
    const text = formatComicScript(script);
    expect(text).toContain("COMIC-SKRIPT");
    expect(text).toContain("PAGE");
  });
});

describe("exportAsMarkdown", () => {
  it("exportiert als Markdown", () => {
    const script = createSampleScript();
    const md = exportAsMarkdown(script);
    expect(md).toContain("#");
    expect(md).toContain("##");
  });
});

describe("createSampleScript", () => {
  it("erstellt Beispiel-Skript", () => {
    const script = createSampleScript();
    expect(script.title).toBeTruthy();
    expect(script.pages.length).toBeGreaterThan(0);
  });
});

describe("BALLOON_LABELS", () => {
  it("hat alle Balloon-Typen", () => {
    expect(Object.keys(BALLOON_LABELS)).toHaveLength(5);
  });
});
