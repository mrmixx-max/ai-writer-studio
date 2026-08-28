import { describe, expect, it } from "vitest";
import { buildKdpChecklist, isKdpReady, validateKdpMetadata } from "./validation";
import type { KdpMetadata } from "@/types/bookwriter";

const base: KdpMetadata = {
  title: "Testbuch",
  subtitle: "Ein Untertitel",
  blurbVariants: ["Ein Klappentext."],
  shortDescription: "Kurz.",
  keywords: ["fantasy", "drachen"],
  categories: ["Fiction > Fantasy"],
  authorBio: "Autorin, geboren 1980.",
  seriesIdea: null,
  marketingNotes: null,
  coverImage: "data:image/png;base64,AAA",
  priceUsd: 4.99,
};

describe("validateKdpMetadata", () => {
  it("gültige Metadaten erzeugen keine Fehler", () => {
    const r = validateKdpMetadata(base);
    expect(r.isValid).toBe(true);
    expect(r.errorCount).toBe(0);
    expect(isKdpReady(base)).toBe(true);
  });

  it("fehlender Titel ist ein Fehler", () => {
    const r = validateKdpMetadata({ ...base, title: "  " });
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.field === "title" && i.severity === "error")).toBe(true);
  });

  it("mehr als 7 Keywords ist ein Fehler", () => {
    const r = validateKdpMetadata({ ...base, keywords: Array(8).fill("kw") });
    expect(r.isValid).toBe(false);
  });

  it("mehr als 2 Kategorien ist ein Fehler", () => {
    const r = validateKdpMetadata({ ...base, categories: ["A", "B", "C"] });
    expect(r.isValid).toBe(false);
  });

  it("Preis außerhalb des KDP-Bereichs ist ein Fehler, fehlender Preis eine Warnung", () => {
    const tooLow = validateKdpMetadata({ ...base, priceUsd: 0.10 });
    expect(tooLow.isValid).toBe(false);
    const missing = validateKdpMetadata({ ...base, priceUsd: null });
    expect(missing.isValid).toBe(true);
    expect(missing.warningCount).toBeGreaterThan(0);
  });
});

describe("buildKdpChecklist", () => {
  it("alle Punkte ok bei vollständigen Metadaten", () => {
    const items = buildKdpChecklist(base);
    expect(items.map((i) => i.status)).toEqual(Array(items.length).fill("ok"));
  });

  it("fehlendes Cover ist ein Fehler, fehlende Bio eine Warnung", () => {
    const items = buildKdpChecklist({ ...base, coverImage: null, authorBio: "" });
    const cover = items.find((i) => i.id === "cover")!;
    const bio = items.find((i) => i.id === "authorBio")!;
    expect(cover.status).toBe("err");
    expect(bio.status).toBe("warn");
  });

  it("Keyword-Anzahl wird im Label angezeigt", () => {
    const items = buildKdpChecklist(base);
    const kw = items.find((i) => i.id === "keywords")!;
    expect(kw.label).toContain("2/7");
  });
});
