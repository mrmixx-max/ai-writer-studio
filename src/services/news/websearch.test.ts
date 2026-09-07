// Tests: Websearch-Service fuer Nachrichten (Sprint 16, Agent 1).
// fetch ist injiziert — kein Netz noetig.
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchNews, parseInstantAnswer, buildSearchUrl } from "./websearch";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

const SAMPLE = {
  Results: [],
  Abstract: "",
  AbstractText: "",
  AbstractURL: "",
  AbstractSource: "",
  RelatedTopics: [
    { Text: "Tagesschau — Nachrichten aus Deutschland", FirstURL: "https://www.tagesschau.de/" },
    { Text: "ZDF heute — Aktuelle Nachrichten", FirstURL: "https://www.zdf.de/nachrichten" },
  ],
};

const NESTED = {
  RelatedTopics: [
    {
      Name: "Nachrichten",
      Topics: [
        { Text: "BR24 — Bayern News", FirstURL: "https://www.br.de/nachrichten" },
        { Text: "ORF — Oesterreich News", FirstURL: "https://orf.at/" },
      ],
    },
  ],
};

describe("searchNews: Erfolg", () => {
  it("flache RelatedTopics werden zu SearchResult[] gemappt", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(SAMPLE));
    const res = await searchNews("Bundestagswahl", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      title: "Tagesschau",
      url: "https://www.tagesschau.de/",
      source: "DuckDuckGo",
    });
    expect(res[0].snippet).toContain("Nachrichten aus Deutschland");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("gruppierte Topics (Topics-Array) werden flach aufgeloest", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(NESTED));
    const res = await searchNews("Bayern News", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(2);
    expect(res[0].url).toBe("https://www.br.de/nachrichten");
  });

  it("Results-Array wird gemappt", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ Results: [{ Text: "dpa — Eilmeldung", FirstURL: "https://www.dpa.com/" }], RelatedTopics: [] }),
    );
    const res = await searchNews("Eilmeldung", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("dpa");
  });

  it("Abstract mit URL wird als Ergebnis uebernommen", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        AbstractText: "Die Bundestagswahl findet 2025 statt.",
        AbstractURL: "https://de.wikipedia.org/wiki/Bundestagswahl",
        AbstractSource: "Wikipedia",
        RelatedTopics: [],
        Results: [],
      }),
    );
    const res = await searchNews("Bundestagswahl", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ source: "Wikipedia", url: "https://de.wikipedia.org/wiki/Bundestagswahl" });
  });

  it("limit begrenzt die Ergebniszahl", async () => {
    const big = {
      RelatedTopics: Array.from({ length: 20 }, (_, i) => ({
        Text: `Quelle ${i} — Meldung ${i}`,
        FirstURL: `https://example.com/${i}`,
      })),
    };
    const fetchFn = vi.fn(async () => jsonResponse(big));
    const res = await searchNews("News", "de", { fetchFn: fetchFn as typeof fetch, limit: 5 });
    expect(res).toHaveLength(5);
  });
});

describe("searchNews: Sprache", () => {
  it("lang=de setzt kl=de-de in der URL", async () => {
    let seenUrl = "";
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      seenUrl = String(url);
      return jsonResponse({ RelatedTopics: [] });
    });
    await searchNews("Klimagipfel", "de", { fetchFn: fetchFn as typeof fetch });
    expect(seenUrl).toContain("kl=de-de");
  });

  it("Default-Sprache ist en (kl=us-en)", async () => {
    let seenUrl = "";
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      seenUrl = String(url);
      return jsonResponse({ RelatedTopics: [] });
    });
    await searchNews("climate summit", undefined, { fetchFn: fetchFn as typeof fetch });
    expect(seenUrl).toContain("kl=us-en");
  });

  it("buildSearchUrl kodiert Query + Format-Parameter", () => {
    const url = buildSearchUrl("Klimagipfel 2026", "de");
    expect(url).toContain("api.duckduckgo.com");
    expect(url).toContain("format=json");
    expect(url).toContain("Klimagipfel");
  });
});

describe("searchNews: Fallback (kein Throw)", () => {
  it("leerer Query gibt [] zurueck ohne fetch", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(SAMPLE));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchNews("   ", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("Netzwerkfehler gibt [] zurueck + warnt", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchNews("Wahl", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/Netzwerkfehler/);
  });

  it("Timeout (AbortError) gibt [] zurueck + warnt", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: { signal?: AbortSignal }) => {
      // Simuliert Abort-Verhalten: wirft sobald signal abbricht.
      await new Promise<void>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new DOMException("aborted", "AbortError");
          reject(e);
        });
      });
      throw new Error("unreachable");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchNews("Wahl", "de", { fetchFn: fetchFn as typeof fetch, timeoutMs: 20 });
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/Timeout/);
  });

  it("HTTP-Fehlerstatus gibt [] zurueck + warnt", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 500));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchNews("Wahl", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("ungueltiges JSON gibt [] zurueck + warnt", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }) as unknown as Response);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchNews("Wahl", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("leere API-Antwort gibt [] zurueck (kein Crash)", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ RelatedTopics: [], Results: [] }));
    const res = await searchNews("QWERTZ-asdf-xyz", "de", { fetchFn: fetchFn as typeof fetch });
    expect(res).toEqual([]);
  });

  it("defekte Eintraege werden uebersprungen", () => {
    const out = parseInstantAnswer({
      RelatedTopics: [
        { Text: "", FirstURL: "" },
        { Text: "Ohne URL" },
        { Text: "Gut — Eintrag", FirstURL: "https://example.com/gut" },
        null,
        "string-eintrag",
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://example.com/gut");
  });

  it("parseInstantAnswer mit null/Fehltyp gibt [] zurueck", () => {
    expect(parseInstantAnswer(null)).toEqual([]);
    expect(parseInstantAnswer("müll")).toEqual([]);
    expect(parseInstantAnswer(undefined)).toEqual([]);
  });
});
