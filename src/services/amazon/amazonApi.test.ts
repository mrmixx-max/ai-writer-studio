// Tests: Amazon PA-API 5.0 Client (Sprint 19f, Agent 2).
//
// Keine echten API-Calls — fetch wird als Parameter injiziert (Mock).
// SigV4-Tests prüfen Format + Determinismus des Authorization-Headers.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchBooks,
  getBookByAsin,
  getBookPrice,
  signPaApiRequest,
  mapPaItem,
  isAmazonConfigured,
  addToWatchlist,
  removeFromWatchlist,
  loadWatchlist,
  hostForRegion,
  type AmazonPaConfig,
} from "./amazonApi";

const CFG: AmazonPaConfig = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  partnerTag: "testtag-21",
  region: "eu-west-1",
  marketplace: "www.amazon.de",
};

const SEARCH_RESPONSE = {
  SearchResult: {
    Items: [
      {
        ASIN: "B00EXAMPLE1",
        DetailPageURL: "https://www.amazon.de/dp/B00EXAMPLE1",
        ItemInfo: {
          Title: { DisplayValue: "Testbuch Eins" },
          ByLineInfo: { Contributors: [{ Name: "Max Muster" }] },
          Classifications: { ProductGroup: { DisplayValue: "Book" } },
        },
        Images: { Primary: { Medium: { URL: "https://cover.example/1.jpg" } } },
        Offers: { Listings: [{ Price: { Amount: 19.99, Currency: "EUR" } }] },
        BrowseNodeInfo: {
          BrowseNodes: [{ DisplayName: "Science Fiction" }],
          WebsiteSalesRank: { Rank: 42 },
        },
      },
    ],
  },
};

const GET_RESPONSE = {
  ItemsResult: {
    Items: [
      {
        ASIN: "B00EXAMPLE2",
        DetailPageURL: "https://www.amazon.de/dp/B00EXAMPLE2",
        ItemInfo: {
          Title: { DisplayValue: "Testbuch Zwei" },
          ByLineInfo: { Contributors: [{ Name: "Erika Muster" }, { Name: "Co-Autor" }] },
        },
        Offers: { Listings: [{ Price: { Amount: 9.99, Currency: "EUR" } }] },
      },
    ],
  },
};

 
function mockFetch(json: any, ok = true, status = 200) {
   
  return vi.fn(async () => ({ ok, status, json: async () => json, text: async () => "" }) as any);
}

// In-Memory-localStorage für node-Umgebung.
function stubLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    },
    writable: true,
    configurable: true,
  });
}

describe("amazonApi", () => {
  beforeEach(() => {
    stubLocalStorage();
    vi.restoreAllMocks();
  });

  it("searchBooks mappt eine SearchItems-Antwort auf AmazonBook[]", async () => {
    const fetchFn = mockFetch(SEARCH_RESPONSE);
    const books = await searchBooks("Testbuch", "Books", CFG, fetchFn as unknown as typeof fetch);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      asin: "B00EXAMPLE1",
      title: "Testbuch Eins",
      author: "Max Muster",
      price: { currency: "EUR", amount: 19.99 },
      url: "https://www.amazon.de/dp/B00EXAMPLE1",
      imageUrl: "https://cover.example/1.jpg",
      rank: 42,
      category: "Science Fiction",
    });
    // PA-API-Vertrag: POST gegen /paapi5/searchitems mit SearchItems-Target.
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://webservices.amazon.de/paapi5/searchitems");
    expect((init.headers as Record<string, string>)["X-Amz-Target"]).toContain("SearchItems");
    expect(String((init.headers as Record<string, string>)["Authorization"])).toContain("AWS4-HMAC-SHA256");
  });

  it("getBookByAsin mappt eine GetItems-Antwort auf ein AmazonBook", async () => {
    const fetchFn = mockFetch(GET_RESPONSE);
    const book = await getBookByAsin("B00EXAMPLE2", CFG, fetchFn as unknown as typeof fetch);
    expect(book).not.toBeNull();
    expect(book).toMatchObject({
      asin: "B00EXAMPLE2",
      title: "Testbuch Zwei",
      author: "Erika Muster, Co-Autor",
      price: { currency: "EUR", amount: 9.99 },
    });
    const [url] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://webservices.amazon.de/paapi5/getitems");
  });

  it("getBookByAsin liefert null bei leerem ItemsResult", async () => {
    const fetchFn = mockFetch({ ItemsResult: { Items: [] } });
    await expect(getBookByAsin("B00MISSING0", CFG, fetchFn as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("getBookPrice liefert den Angebotspreis, null ohne Preis", async () => {
    const fetchFn = mockFetch(GET_RESPONSE);
    await expect(getBookPrice("B00EXAMPLE2", CFG, fetchFn as unknown as typeof fetch)).resolves.toEqual({
      currency: "EUR",
      amount: 9.99,
    });
    const noPrice = mockFetch({ ItemsResult: { Items: [{ ASIN: "X", ItemInfo: { Title: { DisplayValue: "T" } } }] } });
    await expect(getBookPrice("X", CFG, noPrice as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("wirft 'Amazon API nicht konfiguriert' ohne Credentials — ohne Netzwerk", async () => {
    const fetchFn = mockFetch({});
    const empty: AmazonPaConfig = { accessKeyId: "", secretAccessKey: "", partnerTag: "", region: "eu-west-1", marketplace: "www.amazon.de" };
    expect(isAmazonConfigured(empty)).toBe(false);
    expect(isAmazonConfigured(CFG)).toBe(true);
    await expect(searchBooks("x", "Books", empty, fetchFn as unknown as typeof fetch)).rejects.toThrow(
      "Amazon API nicht konfiguriert",
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("SigV4 erzeugt einen korrekten Authorization-Header (Scope, SignedHeaders, Signatur)", async () => {
    const signed = await signPaApiRequest({
      method: "POST",
      host: "webservices.amazon.de",
      path: "/paapi5/searchitems",
      payload: '{"Keywords":"Test"}',
      target: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "eu-west-1",
      amzDate: "20260801T120000Z",
    });
    expect(signed.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20260801\/eu-west-1\/ProductAdvertisingAPI\/aws4_request, SignedHeaders=content-encoding;content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/,
    );
    expect(signed.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("SigV4 ist deterministisch (gleiche Eingabe → gleiche Signatur)", async () => {
    const input = {
      method: "POST",
      host: "webservices.amazon.de",
      path: "/paapi5/searchitems",
      payload: '{"Keywords":"Test"}',
      target: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "eu-west-1",
      amzDate: "20260801T120000Z",
    };
    const a = await signPaApiRequest(input);
    const b = await signPaApiRequest(input);
    expect(a.authorization).toBe(b.authorization);
  });

  it("mapPaItem kommt ohne optionale Felder zurecht", () => {
    expect(mapPaItem({ ASIN: "X" })).toMatchObject({ asin: "X", title: "(ohne Titel)", author: "(unbekannt)" });
  });

  it("Watchlist: add ist idempotent, remove entfernt", () => {
    expect(loadWatchlist()).toEqual([]);
    expect(addToWatchlist("B00EXAMPLE1")).toEqual(["B00EXAMPLE1"]);
    expect(addToWatchlist("B00EXAMPLE1")).toEqual(["B00EXAMPLE1"]);
    expect(addToWatchlist("B00EXAMPLE2")).toEqual(["B00EXAMPLE1", "B00EXAMPLE2"]);
    expect(removeFromWatchlist("B00EXAMPLE1")).toEqual(["B00EXAMPLE2"]);
  });

  it("hostForRegion kennt die PA-API-Endpunkte", () => {
    expect(hostForRegion("eu-west-1")).toBe("webservices.amazon.de");
    expect(hostForRegion("us-east-1")).toBe("webservices.amazon.com");
    expect(hostForRegion("unbekannt")).toBe("webservices.amazon.de");
  });
});
