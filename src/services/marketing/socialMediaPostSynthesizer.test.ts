// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  PLATFORMS,
  getPlatform,
  generatePost,
  generateCarousel,
  curateHashtags,
  generateCampaign,
  createSamplePost,
  createSampleCampaign,
} from "./socialMediaPostSynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("PLATFORMS", () => {
  it("enthält vier Plattformen", () => {
    expect(PLATFORMS).toHaveLength(4);
  });
  it("BookTok hat die kürzeste Zeichenbegrenzung", () => {
    expect(getPlatform("booktok")!.maxChars).toBe(150);
  });
  it("LinkedIn hat die längste Zeichenbegrenzung", () => {
    expect(getPlatform("linkedin")!.maxChars).toBe(3000);
  });
  it("Threads ist auf 280 Zeichen begrenzt", () => {
    expect(getPlatform("threads")!.maxChars).toBe(280);
  });
  it("getPlatform liefert undefined für unbekannt", () => {
    expect(getPlatform("xyz" as never)).toBeUndefined();
  });
});

describe("generatePost", () => {
  it("ist deterministisch", () => {
    expect(generatePost("booktok", 42).id).toBe(generatePost("booktok", 42).id);
  });
  it("BookTok-Post enthält einen Hook", () => {
    const p = generatePost("booktok", 42);
    expect(p.content.length).toBeGreaterThan(10);
    expect(p.content.length).toBeLessThanOrEqual(150);
  });
  it("Instagram-Post enthält 6 Folien", () => {
    const p = generatePost("instagram", 42);
    expect(p.content).toContain("Folie 1");
    expect(p.content).toContain("Folie 6");
  });
  it("Threads-Post enthält 5 Schritte", () => {
    const p = generatePost("threads", 42);
    expect(p.content).toContain("1/5");
    expect(p.content).toContain("5/5");
  });
  it("LinkedIn-Post ist professionell", () => {
    const p = generatePost("linkedin", 42);
    expect(p.content.length).toBeGreaterThan(20);
  });
  it("Hashtags entsprechen der Plattform-Empfehlung", () => {
    for (const platform of PLATFORMS) {
      const p = generatePost(platform.id, 42);
      expect(p.hashtags.length).toBe(platform.hashtagCount);
    }
  });
  it("visualHint ist gesetzt", () => {
    for (const platform of PLATFORMS) {
      expect(generatePost(platform.id, 42).visualHint.length).toBeGreaterThan(0);
    }
  });
  it("unbekannte Plattform fällt auf die erste zurück", () => {
    expect(generatePost("xyz" as never, 42).platform.id).toBe("booktok");
  });
});

describe("generateCarousel", () => {
  it("ist deterministisch", () => {
    expect(generateCarousel(42).length).toBe(generateCarousel(42).length);
  });
  it("erzeugt 6 Folien", () => {
    expect(generateCarousel(42)).toHaveLength(6);
  });
  it("Folien sind nummeriert", () => {
    const slides = generateCarousel(42);
    expect(slides[0].slideNumber).toBe(1);
    expect(slides[5].slideNumber).toBe(6);
  });
  it("jede Folie hat Titel und Design-Hinweis", () => {
    for (const s of generateCarousel(42)) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.designHint.length).toBeGreaterThan(0);
    }
  });
});

describe("curateHashtags", () => {
  it("ist deterministisch", () => {
    expect(curateHashtags("Fantasy", 42).primary).toEqual(curateHashtags("Fantasy", 42).primary);
  });
  it("liefert primäre, sekundäre und Nischen-Tags", () => {
    const h = curateHashtags("Dark Romance", 42);
    expect(h.primary.length).toBe(5);
    expect(h.secondary.length).toBe(7);
    expect(h.niche.length).toBe(3);
  });
  it("keine Duplikate über alle Gruppen hinweg", () => {
    const h = curateHashtags("Thriller", 42);
    const all = [...h.primary, ...h.secondary, ...h.niche];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("generateCampaign", () => {
  it("ist deterministisch", () => {
    expect(generateCampaign("Fantasy", 42).id).toBe(generateCampaign("Fantasy", 42).id);
  });
  it("enthält 4 Plattform-Posts, Karussell und Hashtags", () => {
    const c = generateCampaign("Dark Romance", 42);
    expect(c.posts).toHaveLength(4);
    expect(c.carousel).toHaveLength(6);
    expect(c.hashtags.primary.length).toBeGreaterThan(0);
  });
  it("Posts decken alle Plattformen ab", () => {
    const c = generateCampaign("Fantasy", 42);
    const ids = c.posts.map((p) => p.platform.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSamplePost liefert einen BookTok-Post", () => {
    expect(createSamplePost().platform.id).toBe("booktok");
  });
  it("createSampleCampaign liefert eine Kampagne", () => {
    expect(createSampleCampaign().posts).toHaveLength(4);
  });
});
