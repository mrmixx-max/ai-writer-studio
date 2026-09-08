// Tests: WebSearch-Engine (Sprint 22, Agent 3). fetch injiziert — kein Netz.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  search,
  searchDuckDuckGo,
  searchBrave,
  searchSerpApi,
  searchGoogle,
  parseDuckDuckGoResponse,
  parseBraveResponse,
  parseSerpApiResponse,
  parseGoogleResponse,
} from "./websearch";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as Response;
}

const DDG_SAMPLE = {
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

const BRAVE_SAMPLE = {
  web: {
    results: [
      { title: "Brave Titel 1", url: "https://example.com/1", description: "Snippet eins" },
      { title: "Brave Titel 2", url: "https://example.com/2", description: "Snippet zwei" },
    ],
  },
};

const SERP_SAMPLE = {
  organic_results: [
    { title: "Serp Titel", link: "https://example.com/serp", snippet: "Serp Snippet" },
  ],
};

const GOOGLE_SAMPLE = {
  items: [{ title: "Google Titel", link: "https://example.com/g", snippet: "Google Snippet" }],
};

describe("search(): Provider-Dispatch (fetch gemockt)", () => {
  it("duckduckgo liefert SearchResult[] mit source + timestamp", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(DDG_SAMPLE));
    const res = await search({
      query: "Bundestagswahl",
      provider: "duckduckgo",
      maxResults: 10,
      language: "de",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      title: "Tagesschau",
      url: "https://www.tagesschau.de/",
      source: "duckduckgo",
    });
    expect(typeof res[0].timestamp).toBe("number");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("unbekannter Provider → [] (kein Throw)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await search({
      // @ts-expect-error absichtlich falsch
      provider: "bing",
      query: "x",
      maxResults: 5,
      language: "en",
    });
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("leere Query → [] ohne fetch", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}));
    const res = await search({
      query: "   ",
      provider: "duckduckgo",
      maxResults: 5,
      language: "en",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(res).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("searchDuckDuckGo(): Response-Parsing", () => {
  it("parst RelatedTopics + gruppierte Topics", async () => {
    const nested = {
      RelatedTopics: [
        { Name: "News", Topics: [{ Text: "BR24 — Bayern News", FirstURL: "https://www.br.de/nachrichten" }] },
      ],
    };
    const fetchFn = vi.fn(async () => jsonResponse(nested));
    const res = await searchDuckDuckGo("Bayern", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(1);
    expect(res[0].url).toBe("https://www.br.de/nachrichten");
    expect(res[0].source).toBe("duckduckgo");
  });

  it("parseDuckDuckGoResponse respektiert maxResults", () => {
    expect(parseDuckDuckGoResponse(DDG_SAMPLE, 1)).toHaveLength(1);
  });

  it("HTTP-Fehler → [] + warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 500));
    expect(await searchDuckDuckGo("x", { fetchFn: fetchFn as typeof fetch })).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("searchBrave(): Response-Parsing", () => {
  it("parst web.results zu SearchResult[]", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(BRAVE_SAMPLE));
    const res = await searchBrave("Klimawandel", "key123", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      title: "Brave Titel 1",
      url: "https://example.com/1",
      snippet: "Snippet eins",
      source: "brave",
    });
    expect(typeof res[0].timestamp).toBe("number");
  });

  it("parseBraveResponse ohne web.results → []", () => {
    expect(parseBraveResponse({}, 10)).toEqual([]);
  });

  it("ohne API-Key → [] + warn, kein fetch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn(async () => jsonResponse(BRAVE_SAMPLE));
    expect(await searchBrave("x", "", { fetchFn: fetchFn as typeof fetch })).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

describe("searchSerpApi()/searchGoogle()", () => {
  it("SerpAPI parst organic_results", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(SERP_SAMPLE));
    const res = await searchSerpApi("Roman schreiben", "key", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ title: "Serp Titel", source: "serpapi" });
    expect(parseSerpApiResponse(SERP_SAMPLE, 1)).toHaveLength(1);
  });

  it("Google parst items", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(GOOGLE_SAMPLE));
    const res = await searchGoogle("Buch", "key", "cx123", { fetchFn: fetchFn as typeof fetch });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ title: "Google Titel", source: "google" });
    expect(parseGoogleResponse(GOOGLE_SAMPLE, 1)).toHaveLength(1);
  });

  it("Google ohne Key/CX → [] + warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await searchGoogle("x", "", "")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
