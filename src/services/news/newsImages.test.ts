// Tests: Artikel-Illustrationen (Sprint 16, Agent 3). ASCII-only (shell-safe).
// generateImage() aus imageGen.ts (Sprint 14) ist per vi.mock gemockt —
// kein Netz, kein Ollama, keine GPU noetig. ImageGenError bleibt original.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ImageGenError } from "../images/imageGen";
import { generateImage } from "../images/imageGen";
import {
  DEFAULT_NEWS_IMAGE_STYLE,
  HEADLINE_CARD_HEIGHT,
  HEADLINE_CARD_WIDTH,
  buildArticleImagePrompt,
  buildHeadlineImagePrompt,
  generateArticleImage,
  generateHeadlineImage,
} from "./newsImages";

vi.mock("../images/imageGen", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../images/imageGen")>();
  return { ...orig, generateImage: vi.fn() };
});

const mockGenerateImage = vi.mocked(generateImage);

const SVG_URL = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
const PNG_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function mockOk(dataUrl: string = SVG_URL) {
  mockGenerateImage.mockResolvedValue({
    dataUrl,
    model: "llava",
    backend: "ollama",
    mimeType: "image/svg+xml",
  });
}

beforeEach(() => {
  mockGenerateImage.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("generateArticleImage: Erfolg (gemocktes imageGen)", () => {
  it("liefert dataUrl + angereicherten Prompt", async () => {
    mockOk();
    const res = await generateArticleImage("Stadtfest am Marktplatz");
    expect(res.dataUrl).toBe(SVG_URL);
    expect(res.prompt).toContain("Stadtfest am Marktplatz");
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("Default-Stil ist editorial", async () => {
    mockOk();
    const res = await generateArticleImage("Hafen bei Sturm");
    expect(res.prompt).toContain("Redaktionell");
    expect(res.prompt).toContain("editorial newspaper illustration");
    expect(DEFAULT_NEWS_IMAGE_STYLE).toBe("editorial");
  });

  it("Stil foto landet im Prompt", async () => {
    mockOk();
    const res = await generateArticleImage("Hafen bei Sturm", "foto");
    expect(res.prompt).toContain("Pressefoto");
    expect(res.prompt).toContain("realistic press photograph");
  });

  it("Backend/Modell/fetchFn werden an generateImage durchgereicht", async () => {
    mockOk(PNG_URL);
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const res = await generateArticleImage("Bruecke im Nebel", "minimal", {
      backend: "sd-webui",
      model: "sd-xl",
      fetchFn,
      width: 768,
      height: 512,
    });
    expect(res.dataUrl).toBe(PNG_URL);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    const opts = mockGenerateImage.mock.calls[0][1] ?? {};
    expect(opts).toMatchObject({
      backend: "sd-webui",
      model: "sd-xl",
      width: 768,
      height: 512,
    });
    expect(opts.fetchFn).toBe(fetchFn);
  });
});

describe("generateArticleImage: Validierung + Offline", () => {
  it("leerer Artikel-Prompt wirft kind=bad-request ohne Backend-Call", async () => {
    await expect(generateArticleImage("   ")).rejects.toMatchObject({ kind: "bad-request" });
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("Offline-Fehler (kind=offline) wird durchgereicht", async () => {
    mockGenerateImage.mockRejectedValue(
      new ImageGenError("offline", "Ollama ist nicht erreichbar."),
    );
    await expect(generateArticleImage("Stadtrat tagt")).rejects.toMatchObject({
      kind: "offline",
    });
  });

  it("unbekannter Stil faellt auf editorial zurueck", async () => {
    mockOk();
    const res = await generateArticleImage("Markt", "comic" as never);
    expect(res.prompt).toContain("Redaktionell");
  });
});

describe("generateHeadlineImage: Social-Media-Karte", () => {
  it("Erfolg liefert dataUrl, Prompt enthaelt Headline + Format", async () => {
    mockOk(PNG_URL);
    const res = await generateHeadlineImage("Stadt gewinnt Klimapreis");
    expect(res.dataUrl).toBe(PNG_URL);
    const sentPrompt = String(mockGenerateImage.mock.calls[0][0]);
    expect(sentPrompt).toContain("Stadt gewinnt Klimapreis");
    expect(sentPrompt).toContain("1200x630");
  });

  it("sd-webui bekommt Default-Groesse 1200x630", async () => {
    mockOk(PNG_URL);
    await generateHeadlineImage("Derby am Sonntag", { backend: "sd-webui" });
    const opts = mockGenerateImage.mock.calls[0][1] ?? {};
    expect(opts.width).toBe(HEADLINE_CARD_WIDTH);
    expect(opts.height).toBe(HEADLINE_CARD_HEIGHT);
    expect(HEADLINE_CARD_WIDTH).toBe(1200);
    expect(HEADLINE_CARD_HEIGHT).toBe(630);
  });

  it("leere Headline wirft kind=bad-request ohne Backend-Call", async () => {
    await expect(generateHeadlineImage("  ")).rejects.toMatchObject({ kind: "bad-request" });
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });
});

describe("Prompt-Bau (ohne Netz)", () => {
  it("buildArticleImagePrompt enthaelt Input + No-Text-Hinweis", () => {
    const p = buildArticleImagePrompt("Nachtzug nach Hamburg", "illustration");
    expect(p).toContain("Nachtzug nach Hamburg");
    expect(p).toContain("Illustration");
    expect(p).toContain("no text in image");
  });

  it("buildHeadlineImagePrompt enthaelt Headline + Copy-Space-Hinweis", () => {
    const p = buildHeadlineImagePrompt("Neues Schwimmbad eroeffnet");
    expect(p).toContain("Neues Schwimmbad eroeffnet");
    expect(p).toContain("copy space");
  });
});
