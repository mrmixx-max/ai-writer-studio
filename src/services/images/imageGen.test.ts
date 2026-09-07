// Tests: Bildgenerierung-Service (Sprint 14, Agent 3). ASCII-only (shell-safe).
// Alle Netzaufrufe sind gemockt (injizierbarer fetchFn) — kein Ollama, keine GPU noetig.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_OLLAMA_VISION_MODEL,
  ImageGenError,
  checkAvailability,
  describeImage,
  generateImage,
  listAvailableModels,
  renderTextAsSvgDataUrl,
} from "./imageGen";

const okJson = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("generateImage: Validierung", () => {
  it("leerer Prompt wirft kind=bad-request ohne Fetch", async () => {
    const fetchFn = vi.fn(async () => okJson({}));
    await expect(
      generateImage("   ", { fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "bad-request" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("unbekanntes Backend wirft kind=bad-request", async () => {
    const fetchFn = vi.fn(async () => okJson({}));
    await expect(
      generateImage("Burg bei Nacht", {
        backend: "dalle" as never,
        fetchFn: fetchFn as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "bad-request" });
  });
});

describe("generateImage: Ollama-Backend", () => {
  it("Erfolg liefert SVG-Data-URL + Default-Modell", async () => {
    const fetchFn = vi.fn(async () => okJson({ response: "Eine Burg auf einem Felsen." }));
    const res = await generateImage("Burg bei Nacht", { fetchFn: fetchFn as typeof fetch });
    expect(res.backend).toBe("ollama");
    expect(res.model).toBe(DEFAULT_OLLAMA_VISION_MODEL);
    expect(res.mimeType).toBe("image/svg+xml");
    expect(res.dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = String((fetchFn.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/api/generate");
  });

  it("eigenes Modell wird an /api/generate durchgereicht", async () => {
    const fetchFn = vi.fn(async () => okJson({ response: "Text." }));
    const res = await generateImage("Drache", {
      model: "qwen2-vl",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(res.model).toBe("qwen2-vl");
    const body = JSON.parse(((fetchFn.mock.calls[0] as unknown[])[1] as RequestInit).body as string);
    expect(body.model).toBe("qwen2-vl");
    expect(body.stream).toBe(false);
  });

  it("Ollama offline (TypeError) wirft kind=offline", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      generateImage("Burg", { fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "offline" });
  });

  it("Ollama 404 wirft Modell-Hinweis (ollama pull)", async () => {
    const fetchFn = vi.fn(async () => new Response("no such model", { status: 404 }));
    const err = await generateImage("Burg", { fetchFn: fetchFn as typeof fetch }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ImageGenError);
    expect((err as ImageGenError).kind).toBe("server");
    expect(String((err as Error).message)).toContain("ollama pull");
  });

  it("ungueltiges JSON wirft kind=server", async () => {
    const fetchFn = vi.fn(async () => new Response("kein-json{{{", { status: 200 }));
    await expect(
      generateImage("Burg", { fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "server" });
  });

  it("Timeout wirft kind=timeout", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
            once: true,
          });
        }),
    );
    const p = generateImage("Burg", {
      timeoutMs: 50,
      fetchFn: fetchFn as typeof fetch,
    });
    const assertion = expect(p).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });
});

describe("generateImage: SD-WebUI-Backend", () => {
  it("Erfolg liefert PNG-Data-URL aus images[0]", async () => {
    const fetchFn = vi.fn(async () => okJson({ images: [PNG_B64] }));
    const res = await generateImage("Burg bei Nacht", {
      backend: "sd-webui",
      width: 512,
      height: 512,
      steps: 20,
      fetchFn: fetchFn as typeof fetch,
    });
    expect(res.backend).toBe("sd-webui");
    expect(res.mimeType).toBe("image/png");
    expect(res.dataUrl).toBe(`data:image/png;base64,${PNG_B64}`);
    const url = String((fetchFn.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/sdapi/v1/txt2img");
    const body = JSON.parse(((fetchFn.mock.calls[0] as unknown[])[1] as RequestInit).body as string);
    expect(body.width).toBe(512);
    expect(body.steps).toBe(20);
  });

  it("SD offline wirft kind=offline", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      generateImage("Burg", { backend: "sd-webui", fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "offline", name: "ImageGenError" });
  });

  it("SD 400 wirft kind=bad-request", async () => {
    const fetchFn = vi.fn(async () => new Response("bad prompt", { status: 400 }));
    await expect(
      generateImage("Burg", { backend: "sd-webui", fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "bad-request" });
  });

  it("leeres images-Feld wirft kind=server", async () => {
    const fetchFn = vi.fn(async () => okJson({ images: [] }));
    await expect(
      generateImage("Burg", { backend: "sd-webui", fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "server" });
  });
});

describe("checkAvailability / listAvailableModels", () => {
  const onlineOllama = (url: string) =>
    url.includes("11434")
      ? Promise.resolve(new Response("{}", { status: 200 }))
      : Promise.reject(new TypeError("fetch failed"));

  it("beide online -> { ollama: true, sdWebui: true }", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await checkAvailability({ fetchFn: fetchFn as typeof fetch, timeoutMs: 500 });
    expect(res).toEqual({ ollama: true, sdWebui: true });
  });

  it("beide offline -> { ollama: false, sdWebui: false }, wirft nie", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const res = await checkAvailability({ fetchFn: fetchFn as typeof fetch, timeoutMs: 200 });
    expect(res).toEqual({ ollama: false, sdWebui: false });
  });

  it("gemischt: nur Ollama online", async () => {
    const fetchFn = vi.fn((url: string) => onlineOllama(url));
    const res = await checkAvailability({ fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 500 });
    expect(res).toEqual({ ollama: true, sdWebui: false });
  });

  it("listAvailableModels ist Alias und liefert Booleans", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await listAvailableModels({ fetchFn: fetchFn as typeof fetch, timeoutMs: 500 });
    expect(res).toEqual({ ollama: true, sdWebui: true });
  });
});

describe("describeImage (Ollama Vision)", () => {
  it("Erfolg liefert Beschreibungstext, images[] wird gesendet", async () => {
    const fetchFn = vi.fn(async () => okJson({ response: "  Eine rote Burg. " }));
    const text = await describeImage(`data:image/png;base64,${PNG_B64}`, "Was ist zu sehen?", {
      fetchFn: fetchFn as typeof fetch,
    });
    expect(text).toBe("Eine rote Burg.");
    const body = JSON.parse(((fetchFn.mock.calls[0] as unknown[])[1] as RequestInit).body as string);
    expect(body.images).toEqual([PNG_B64]);
  });

  it("leere Frage wirft kind=bad-request ohne Fetch", async () => {
    const fetchFn = vi.fn(async () => okJson({}));
    await expect(
      describeImage(`data:image/png;base64,${PNG_B64}`, "  ", { fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "bad-request" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fehlendes Bild wirft kind=bad-request", async () => {
    const fetchFn = vi.fn(async () => okJson({}));
    await expect(
      describeImage("", "Was ist das?", { fetchFn: fetchFn as typeof fetch }),
    ).rejects.toMatchObject({ kind: "bad-request" });
  });
});

describe("renderTextAsSvgDataUrl", () => {
  it("liefert dekodierbares SVG mit Label", () => {
    const url = renderTextAsSvgDataUrl("Eine Burg.", "Ollama: llava");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(url.split(",")[1], "base64").toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Ollama: llava");
  });
});
