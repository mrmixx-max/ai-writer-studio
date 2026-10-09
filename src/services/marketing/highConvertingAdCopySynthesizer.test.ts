// @vitest-environment jsdom
// HighConvertingAdCopySynthesizer Tests (Meilenstein 61.0 / v7.3.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  AD_ANGLES,
  buildBlurbArchitecture,
  generateMetaAds,
  generateAmazonAds,
  createSampleAdBrief,
  createSampleAdSet,
} from "./highConvertingAdCopySynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("ad")).toBe(hashString("ad"));
  });

  it("unterscheidet verschiedene Strings", () => {
    expect(hashString("meta")).not.toBe(hashString("amazon"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Blurb");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch", () => {
    const a = createSeededRandom(13);
    const b = createSeededRandom(13);
    expect(a()).toBe(b());
  });

  it("liefert Werte in [0,1)", () => {
    const rng = createSeededRandom(31);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("AD_ANGLES", () => {
  it("enthält genau 3 Werbewinkel", () => {
    expect(AD_ANGLES).toHaveLength(3);
  });

  it("enthält die erwarteten IDs", () => {
    expect(AD_ANGLES.map((a) => a.id)).toEqual([
      "emotionalTrope",
      "plotTwistTeaser",
      "socialProof",
    ]);
  });

  it("hat gültige Felder", () => {
    for (const a of AD_ANGLES) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.targetAudience.length).toBeGreaterThan(0);
    }
  });
});

describe("buildBlurbArchitecture", () => {
  const brief = createSampleAdBrief();

  it("liefert die vollständige Klappentext-Architektur", () => {
    const b = buildBlurbArchitecture(brief, 42);
    expect(b.hook.length).toBeGreaterThan(0);
    expect(b.characterConflict.length).toBeGreaterThan(0);
    expect(b.dilemma.length).toBeGreaterThan(0);
    expect(Array.isArray(b.tropeBullets)).toBe(true);
    expect(b.callToAction.length).toBeGreaterThan(0);
    expect(b.fullBlurb.length).toBeGreaterThan(0);
    expect(b.wordCount).toBeGreaterThan(0);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildBlurbArchitecture(brief, 5);
    const b = buildBlurbArchitecture(brief, 5);
    expect(a.fullBlurb).toBe(b.fullBlurb);
    expect(a.wordCount).toBe(b.wordCount);
  });

  it("funktioniert mit minimalen Eingaben", () => {
    const b = buildBlurbArchitecture({ title: "Test", genre: "drama", protagonist: "Anna" }, 1);
    expect(b.fullBlurb.length).toBeGreaterThan(0);
  });
});

describe("generateMetaAds", () => {
  const brief = createSampleAdBrief();

  it("erzeugt einen Ad pro Winkel", () => {
    const ads = generateMetaAds(brief, 42);
    expect(ads).toHaveLength(3);
    for (const ad of ads) {
      expect(ad.angleId.length).toBeGreaterThan(0);
      expect(ad.headline.length).toBeGreaterThan(0);
      expect(ad.primaryText.length).toBeGreaterThan(0);
      expect(ad.description.length).toBeGreaterThan(0);
      expect(ad.callToAction.length).toBeGreaterThan(0);
    }
  });

  it("deckt alle drei Winkel ab", () => {
    const ids = generateMetaAds(brief, 42).map((a) => a.angleId);
    expect(ids).toEqual(["emotionalTrope", "plotTwistTeaser", "socialProof"]);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = generateMetaAds(brief, 8);
    const b = generateMetaAds(brief, 8);
    expect(a.map((x) => x.headline)).toEqual(b.map((x) => x.headline));
  });
});

describe("generateAmazonAds", () => {
  const brief = createSampleAdBrief();

  it("erzeugt Amazon-Ads mit Schlagzeilen unter 150 Zeichen", () => {
    const ads = generateAmazonAds(brief, 42);
    expect(ads.length).toBeGreaterThan(0);
    for (const ad of ads) {
      expect(ad.headline.length).toBeGreaterThan(0);
      expect(ad.headline.length).toBeLessThan(150);
      expect(Array.isArray(ad.keywords)).toBe(true);
      expect(ad.matchType.length).toBeGreaterThan(0);
      expect(ad.description.length).toBeGreaterThan(0);
    }
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = generateAmazonAds(brief, 3);
    const b = generateAmazonAds(brief, 3);
    expect(a.map((x) => x.headline)).toEqual(b.map((x) => x.headline));
  });
});

describe("createSampleAdBrief", () => {
  it("liefert ein gültiges Briefing", () => {
    const b = createSampleAdBrief();
    expect(b.title.length).toBeGreaterThan(0);
    expect(b.genre.length).toBeGreaterThan(0);
    expect(b.protagonist.length).toBeGreaterThan(0);
  });
});

describe("createSampleAdSet", () => {
  it("liefert Briefing, Blurb, Meta- und Amazon-Ads", () => {
    const s = createSampleAdSet();
    expect(s.brief.title.length).toBeGreaterThan(0);
    expect(s.blurb.fullBlurb.length).toBeGreaterThan(0);
    expect(s.metaAds).toHaveLength(3);
    expect(s.amazonAds.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const a = createSampleAdSet();
    const b = createSampleAdSet();
    expect(a.blurb.fullBlurb).toBe(b.blurb.fullBlurb);
    expect(a.amazonAds.map((x) => x.headline)).toEqual(b.amazonAds.map((x) => x.headline));
  });
});
