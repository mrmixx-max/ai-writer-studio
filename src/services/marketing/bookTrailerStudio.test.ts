// bookTrailerStudio.test.ts — Tests für das Book-Trailer-Studio (WP 44.1).
// Deterministisch, keine Netzwerk-/LLM-Aufrufe.
import { describe, it, expect } from "vitest";
import {
  createTrailerTimeline,
  renderTrailerFrame,
  exportTimelineAsSvg,
  calculateTrailerDuration,
  validateFormat,
  type TrailerConfig,
  type TrailerFormat,
  type TrailerTimeline,
} from "./bookTrailerStudio";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function sampleConfig(overrides: Partial<TrailerConfig> = {}): TrailerConfig {
  return {
    title: "Die letzte Zukunft",
    author: "Mara Winter",
    hookQuote: "Manche Wahrheiten will niemand sehen.",
    callToAction: "Jetzt lesen!",
    coverImageUrl: "https://example.com/cover.jpg",
    format: "vertical",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateFormat
// ---------------------------------------------------------------------------

describe("validateFormat", () => {
  it("akzeptiert 'vertical'", () => {
    expect(validateFormat("vertical")).toBe(true);
  });

  it("akzeptiert 'horizontal'", () => {
    expect(validateFormat("horizontal")).toBe(true);
  });

  it("lehnt unbekannte Formate ab", () => {
    expect(validateFormat("square" as TrailerFormat)).toBe(false);
    expect(validateFormat("" as TrailerFormat)).toBe(false);
    expect(validateFormat(undefined as unknown as TrailerFormat)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTrailerTimeline
// ---------------------------------------------------------------------------

describe("createTrailerTimeline", () => {
  it("erzeugt 5 Keyframes in korrekter Reihenfolge", () => {
    const timeline = createTrailerTimeline(sampleConfig());
    expect(timeline.keyframes).toHaveLength(5);
    expect(timeline.keyframes.map((k) => k.kind)).toEqual([
      "hook",
      "particles",
      "title",
      "cover-rotate",
      "cta",
    ]);
  });

  it("legt vertikale Maße 1080x1920 an", () => {
    const timeline = createTrailerTimeline(sampleConfig({ format: "vertical" }));
    expect(timeline.width).toBe(1080);
    expect(timeline.height).toBe(1920);
  });

  it("legt horizontale Maße 1920x1080 an", () => {
    const timeline = createTrailerTimeline(sampleConfig({ format: "horizontal" }));
    expect(timeline.width).toBe(1920);
    expect(timeline.height).toBe(1080);
  });

  it("setzt die Keyframe-Zeitfenster fortlaufend (0-3-6-9-12s)", () => {
    const timeline = createTrailerTimeline(sampleConfig());
    expect(timeline.keyframes.map((k) => k.startMs)).toEqual([0, 3000, 6000, 9000, 12000]);
    expect(timeline.keyframes.every((k) => k.durationMs === 3000)).toBe(true);
    expect(timeline.totalDurationMs).toBe(15000);
  });

  it("übernimmt Titel, Autor, Hook und CTA in die Keyframe-Inhalte", () => {
    const timeline = createTrailerTimeline(sampleConfig());
    const byKind = Object.fromEntries(timeline.keyframes.map((k) => [k.kind, k.content]));
    expect(byKind.hook).toContain("Manche Wahrheiten will niemand sehen.");
    expect(byKind.title).toBe("Die letzte Zukunft");
    expect(byKind["cover-rotate"]).toContain("Die letzte Zukunft");
    expect(byKind["cover-rotate"]).toContain("Mara Winter");
    expect(byKind.cta).toBe("Jetzt lesen!");
  });

  it("ist deterministisch: gleiche Config → gleiche id", () => {
    const a = createTrailerTimeline(sampleConfig());
    const b = createTrailerTimeline(sampleConfig());
    expect(a.id).toBe(b.id);
    expect(a.keyframes.map((k) => k.id)).toEqual(b.keyframes.map((k) => k.id));
  });

  it("vergibt unterschiedliche ids für unterschiedliche Titel", () => {
    const a = createTrailerTimeline(sampleConfig({ title: "Buch A" }));
    const b = createTrailerTimeline(sampleConfig({ title: "Buch B" }));
    expect(a.id).not.toBe(b.id);
  });

  it("verwendet Fallbacks bei leeren Feldern", () => {
    const timeline = createTrailerTimeline({
      title: "",
      author: "",
      hookQuote: "",
      callToAction: "",
      format: "vertical",
    });
    const byKind = Object.fromEntries(timeline.keyframes.map((k) => [k.kind, k.content]));
    expect(byKind.title).toBe("Unbekannter Titel");
    expect(byKind["cover-rotate"]).toContain("Unbekannter Autor");
    expect(byKind.cta).toBe("Jetzt lesen!");
    expect(byKind.hook).toContain("Eine Geschichte, die unter die Haut geht.");
  });

  it("fällt bei ungültigem Format auf 'vertical' zurück", () => {
    const timeline = createTrailerTimeline(sampleConfig({ format: "square" as TrailerFormat }));
    expect(timeline.format).toBe("vertical");
    expect(timeline.width).toBe(1080);
    expect(timeline.height).toBe(1920);
  });
});

// ---------------------------------------------------------------------------
// calculateTrailerDuration
// ---------------------------------------------------------------------------

describe("calculateTrailerDuration", () => {
  it("summiert die Keyframe-Dauern zu 15000ms", () => {
    const timeline = createTrailerTimeline(sampleConfig());
    expect(calculateTrailerDuration(timeline)).toBe(15000);
  });

  it("liefert 0 für eine leere Timeline", () => {
    const empty: TrailerTimeline = {
      id: "leer",
      format: "vertical",
      width: 1080,
      height: 1920,
      keyframes: [],
      totalDurationMs: 0,
    };
    expect(calculateTrailerDuration(empty)).toBe(0);
  });

  it("ignoriert negative und ungültige Dauern defensiv", () => {
    const broken = {
      id: "broken",
      format: "vertical",
      width: 1080,
      height: 1920,
      keyframes: [
        { id: "a", kind: "hook", startMs: 0, durationMs: 2000, content: "x" },
        { id: "b", kind: "title", startMs: 2000, durationMs: -500, content: "y" },
        { id: "c", kind: "cta", startMs: 2000, durationMs: NaN, content: "z" },
      ],
      totalDurationMs: 0,
    } as unknown as TrailerTimeline;
    expect(calculateTrailerDuration(broken)).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// renderTrailerFrame
// ---------------------------------------------------------------------------

describe("renderTrailerFrame", () => {
  const timeline = createTrailerTimeline(sampleConfig());

  it("wählt den Hook-Keyframe zum Zeitpunkt 0", () => {
    const frame = renderTrailerFrame(timeline, 0);
    expect(frame.activeKeyframe).toBe(timeline.keyframes[0].id);
    expect(frame.text).toContain("Manche Wahrheiten will niemand sehen.");
  });

  it("wählt den Partikel-Keyframe bei 4000ms", () => {
    const frame = renderTrailerFrame(timeline, 4000);
    expect(frame.activeKeyframe).toBe(timeline.keyframes[1].id);
    expect(frame.text).toBe("");
  });

  it("wählt den CTA-Keyframe bei 14000ms", () => {
    const frame = renderTrailerFrame(timeline, 14000);
    expect(frame.activeKeyframe).toBe(timeline.keyframes[4].id);
    expect(frame.text).toBe("Jetzt lesen!");
  });

  it("klemmt Zeiten außerhalb des Bereichs (negativ → 0, zu groß → Ende)", () => {
    const early = renderTrailerFrame(timeline, -1000);
    expect(early.timeMs).toBe(0);
    expect(early.activeKeyframe).toBe(timeline.keyframes[0].id);

    const late = renderTrailerFrame(timeline, 999999);
    expect(late.timeMs).toBeLessThan(timeline.totalDurationMs);
    expect(late.activeKeyframe).toBe(timeline.keyframes[4].id);
  });

  it("blendet an den Keyframe-Rändern ein/aus (Opacity 0 am Anfang)", () => {
    const atStart = renderTrailerFrame(timeline, 0);
    expect(atStart.opacity).toBe(0);
    const mid = renderTrailerFrame(timeline, 1500);
    expect(mid.opacity).toBe(1);
  });

  it("berechnet eine 3D-Rotation nur im cover-rotate-Keyframe", () => {
    const hookFrame = renderTrailerFrame(timeline, 1500);
    expect(hookFrame.rotationDeg).toBe(0);

    const coverMid = renderTrailerFrame(timeline, 10500); // 50% des cover-rotate
    expect(coverMid.rotationDeg).toBe(180);

    const coverStart = renderTrailerFrame(timeline, 9000);
    expect(coverStart.rotationDeg).toBe(0);
  });

  it("skaliert progressiv (scale >= 1 im Hook-Verlauf)", () => {
    const frame = renderTrailerFrame(timeline, 2900);
    expect(frame.scale).toBeGreaterThan(1);
  });

  it("liefert einen sicheren Leer-Frame bei leerer Timeline", () => {
    const empty: TrailerTimeline = {
      id: "leer",
      format: "vertical",
      width: 1080,
      height: 1920,
      keyframes: [],
      totalDurationMs: 0,
    };
    const frame = renderTrailerFrame(empty, 500);
    expect(frame.activeKeyframe).toBe("");
    expect(frame.opacity).toBe(0);
    expect(frame.scale).toBe(1);
    expect(frame.rotationDeg).toBe(0);
    expect(frame.text).toBe("");
  });

  it("ist deterministisch: gleicher Zeitpunkt → gleicher Frame", () => {
    const a = renderTrailerFrame(timeline, 10500);
    const b = renderTrailerFrame(timeline, 10500);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// exportTimelineAsSvg
// ---------------------------------------------------------------------------

describe("exportTimelineAsSvg", () => {
  const timeline = createTrailerTimeline(sampleConfig());

  it("liefert ein vollständiges SVG-Dokument", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("verwendet die Format-Maße im SVG", () => {
    const vertical = exportTimelineAsSvg(timeline, "vertical");
    expect(vertical).toContain('width="1080"');
    expect(vertical).toContain('height="1920"');

    const horizontal = exportTimelineAsSvg(timeline, "horizontal");
    expect(horizontal).toContain('width="1920"');
    expect(horizontal).toContain('height="1080"');
  });

  it("enthält SMIL-Animations-Elemente", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("<animate");
    expect(svg).toContain("attributeName=\"opacity\"");
  });

  it("enthält eine 360°-Drehung im cover-rotate-Keyframe", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("<animateTransform");
    expect(svg).toContain('type="rotate"');
    expect(svg).toContain("360");
  });

  it("bettet die Keyframe-Texte (escaped) ein", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("Die letzte Zukunft");
    expect(svg).toContain("Mara Winter");
    expect(svg).toContain("Jetzt lesen!");
  });

  it("escaped XML-spezielle Zeichen in Texten", () => {
    const svg = exportTimelineAsSvg(
      createTrailerTimeline(sampleConfig({ title: "A & B <C>" })),
      "vertical"
    );
    expect(svg).toContain("A &amp; B &lt;C&gt;");
    expect(svg).not.toContain("A & B <C>");
  });

  it("rendert Partikel-Kreise im particles-Keyframe", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("<circle");
  });

  it("bettet das Cover-Bild ein, wenn eine URL vorliegt", () => {
    const svg = exportTimelineAsSvg(timeline, "vertical");
    expect(svg).toContain("<image");
    expect(svg).toContain("https://example.com/cover.jpg");
  });

  it("fällt bei ungültigem Export-Format auf das Timeline-Format zurück", () => {
    const svg = exportTimelineAsSvg(timeline, "square" as TrailerFormat);
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
  });

  it("liefert ein gültiges (leeres) SVG bei leerer Timeline", () => {
    const empty: TrailerTimeline = {
      id: "leer",
      format: "vertical",
      width: 1080,
      height: 1920,
      keyframes: [],
      totalDurationMs: 0,
    };
    const svg = exportTimelineAsSvg(empty, "vertical");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('data-duration-ms="0"');
  });

  it("ist deterministisch: gleicher Input → identischer String", () => {
    const a = exportTimelineAsSvg(timeline, "vertical");
    const b = exportTimelineAsSvg(timeline, "vertical");
    expect(a).toBe(b);
  });
});
