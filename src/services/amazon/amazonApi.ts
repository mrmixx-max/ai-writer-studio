// Amazon Product Advertising API 5.0 Client (Sprint 19f, Agent 2).
//
// Buchsuche (SearchItems) + Einzelabruf (GetItems) + Preis-Monitoring.
// Signiert jede Anfrage mit AWS Signature Version 4 (SigV4) — ausschließlich
// über die Web Crypto API (crypto.subtle), ohne neue Dependencies.
//
// Doku: https://webservices.amazon.de/paapi5/documentation/
// Hinweis: PA-API erfordert ein Partner Tag (Associate) + PA-API-Zugang;
// ohne gültige Credentials antwortet Amazon mit 401/403.

export interface AmazonPrice {
  currency: string;
  amount: number;
}

export interface AmazonBook {
  asin: string;
  title: string;
  author: string;
  price?: AmazonPrice;
  url: string;
  imageUrl?: string;
  rank?: number;
  category?: string;
}

export interface AmazonPaConfig {
  accessKeyId: string;
  secretAccessKey: string;
  partnerTag: string;
  /** AWS-Region, Default: eu-west-1 (Amazon.de). */
  region: string;
  /** Marketplace-Host, Default: www.amazon.de. */
  marketplace: string;
}

export const DEFAULT_AMAZON_REGION = "eu-west-1";
export const DEFAULT_AMAZON_MARKETPLACE = "www.amazon.de";

/** Für SigV4 relevante PA-API-Konstante (Credential-Scope). */
export const PAAPI_SERVICE = "ProductAdvertisingAPI";

const CONFIG_KEY = "amazon-paapi-config";
const WATCHLIST_KEY = "amazon-watchlist";

/** Host je Region (PA-API 5.0 Endpunkte). Unbekannte Regionen → .de-Host. */
export function hostForRegion(region: string): string {
  switch (region) {
    case "us-east-1":
      return "webservices.amazon.com";
    case "eu-west-1":
      return "webservices.amazon.de";
    case "eu-west-2":
      return "webservices.amazon.co.uk";
    case "us-west-2":
      return "webservices.amazon.com";
    default:
      return "webservices.amazon.de";
  }
}

// ---- Konfiguration (localStorage) ------------------------------------------

export function defaultAmazonConfig(): AmazonPaConfig {
  return {
    accessKeyId: "",
    secretAccessKey: "",
    partnerTag: "",
    region: DEFAULT_AMAZON_REGION,
    marketplace: DEFAULT_AMAZON_MARKETPLACE,
  };
}

export function loadAmazonConfig(): AmazonPaConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultAmazonConfig();
    return { ...defaultAmazonConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultAmazonConfig();
  }
}

export function saveAmazonConfig(cfg: AmazonPaConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* Storage voll/blockiert — Konfiguration bleibt nur im Speicher. */
  }
}

/** True, wenn alle drei Pflicht-Credentials gesetzt sind. */
export function isAmazonConfigured(cfg?: AmazonPaConfig): boolean {
  const c = cfg ?? loadAmazonConfig();
  return Boolean(c.accessKeyId.trim() && c.secretAccessKey.trim() && c.partnerTag.trim());
}

// ---- SigV4-Signing (Web Crypto API) -----------------------------------------

const te = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256-Hex eines UTF-8-Strings. */
export async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", te.encode(data)));
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  // Kopie mit echtem ArrayBuffer-Backing — TextEncoder-Views sind
  // typseitig nur ArrayBufferLike und werden von subtle abgelehnt.
  const raw: Uint8Array<ArrayBuffer> =
    key instanceof Uint8Array ? new Uint8Array(key) : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, te.encode(msg));
}

/** Abgeleiteter SigV4-Signing-Key: kDate → kRegion → kService → kSigning. */
export async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string = PAAPI_SERVICE,
): Promise<ArrayBuffer> {
  const kDate = await hmac(te.encode("AWS4" + secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export interface SignInput {
  method: string;
  host: string;
  path: string;
  payload: string;
  target: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  /** Format: 20150830T123600Z. Default: jetzt (UTC). */
  amzDate?: string;
}

export interface SignedRequest {
  authorization: string;
  amzDate: string;
  payloadHash: string;
  signedHeaders: string;
}

function toAmzDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/**
 * Baut Canonical Request + String-to-Sign und liefert den
 * `Authorization`-Header für eine PA-API-5.0-Anfrage.
 */
export async function signPaApiRequest(input: SignInput): Promise<SignedRequest> {
  const service = input.service ?? PAAPI_SERVICE;
  const amzDate = input.amzDate ?? toAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(input.payload);
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${input.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${input.target}\n`;
  const canonicalRequest = [
    input.method,
    input.path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await deriveSigningKey(input.secretAccessKey, dateStamp, input.region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));
  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
    payloadHash,
    signedHeaders,
  };
}

// ---- PA-API-Transport --------------------------------------------------------

const SEARCH_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const GET_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

const SEARCH_RESOURCES = [
  "Images.Primary.Medium",
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "ItemInfo.Classifications",
  "Offers.Listings.Price",
  "BrowseNodeInfo.BrowseNodes",
  "BrowseNodeInfo.WebsiteSalesRank",
];

const GET_RESOURCES = [
  ...SEARCH_RESOURCES,
  "Offers.Summaries.LowestPrice",
];

async function paPost(
  cfg: AmazonPaConfig,
  path: "/paapi5/searchitems" | "/paapi5/getitems",
  target: string,
  body: Record<string, unknown>,
   
  fetchFn: typeof fetch = fetch as any,
   
): Promise<any> {
  if (!isAmazonConfigured(cfg)) throw new Error("Amazon API nicht konfiguriert");
  const host = hostForRegion(cfg.region);
  const payload = JSON.stringify(body);
  const signed = await signPaApiRequest({
    method: "POST",
    host,
    path,
    payload,
    target,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region || DEFAULT_AMAZON_REGION,
  });
  const res = await fetchFn(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "amz-1.0",
      "X-Amz-Target": target,
      "X-Amz-Date": signed.amzDate,
      Authorization: signed.authorization,
    },
    body: payload,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Amazon PA-API Fehler ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

// ---- Response-Mapping ---------------------------------------------------------

 
export function mapPaItem(item: any): AmazonBook {
  const asin: string = item?.ASIN ?? "";
  const title: string = item?.ItemInfo?.Title?.DisplayValue ?? "(ohne Titel)";
  const contributors = item?.ItemInfo?.ByLineInfo?.Contributors ?? [];
  const author: string =
    contributors.map((c: { Name?: string }) => c?.Name).filter(Boolean).join(", ") ||
    item?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue ||
    "(unbekannt)";
  const listing = item?.Offers?.Listings?.[0]?.Price;
  const summary = item?.Offers?.Summaries?.[0]?.LowestPrice;
  const priceRaw = listing ?? summary;
  const price: AmazonPrice | undefined =
    priceRaw?.Amount != null
      ? { currency: String(priceRaw.Currency ?? "EUR"), amount: Number(priceRaw.Amount) }
      : undefined;
  const rankRaw =
    item?.BrowseNodeInfo?.WebsiteSalesRank?.Rank ?? item?.SalesRank ?? undefined;
  const rank = rankRaw != null ? Number(rankRaw) : undefined;
  const category: string | undefined =
    item?.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ??
    item?.ItemInfo?.Classifications?.ProductGroup?.DisplayValue ??
    undefined;
  return {
    asin,
    title,
    author,
    ...(price ? { price } : {}),
    url: item?.DetailPageURL ?? "",
    ...(item?.Images?.Primary?.Medium?.URL ? { imageUrl: item.Images.Primary.Medium.URL } : {}),
    ...(rank != null && !Number.isNaN(rank) ? { rank } : {}),
    ...(category ? { category } : {}),
  };
}

// ---- Öffentliche API -----------------------------------------------------------

/**
 * Buchsuche (SearchItems). `searchIndex` z. B. "Books".
 * Wirft "Amazon API nicht konfiguriert", wenn Credentials fehlen.
 */
export async function searchBooks(
  query: string,
  searchIndex = "Books",
  cfg?: AmazonPaConfig,
   
  fetchFn: typeof fetch = fetch as any,
): Promise<AmazonBook[]> {
  const c = cfg ?? loadAmazonConfig();
   
  const data: any = await paPost(
    c,
    "/paapi5/searchitems",
    SEARCH_TARGET,
    {
      PartnerTag: c.partnerTag,
      PartnerType: "Associates",
      Marketplace: c.marketplace || DEFAULT_AMAZON_MARKETPLACE,
      Keywords: query,
      SearchIndex: searchIndex,
      ItemCount: 10,
      Resources: SEARCH_RESOURCES,
    },
    fetchFn,
  );
  const items = data?.SearchResult?.Items ?? [];
   
  return items.map((i: any) => mapPaItem(i));
}

/** Einzelabruf per ASIN (GetItems). Null, wenn nicht gefunden. */
export async function getBookByAsin(
  asin: string,
  cfg?: AmazonPaConfig,
   
  fetchFn: typeof fetch = fetch as any,
): Promise<AmazonBook | null> {
  const c = cfg ?? loadAmazonConfig();
   
  const data: any = await paPost(
    c,
    "/paapi5/getitems",
    GET_TARGET,
    {
      PartnerTag: c.partnerTag,
      PartnerType: "Associates",
      Marketplace: c.marketplace || DEFAULT_AMAZON_MARKETPLACE,
      ItemIds: [asin],
      ItemIdType: "ASIN",
      Resources: GET_RESOURCES,
    },
    fetchFn,
  );
  const items = data?.ItemsResult?.Items ?? [];
  return items.length ? mapPaItem(items[0]) : null;
}

/** Aktueller Preis per ASIN. Null, wenn kein Angebot/Preis verfügbar. */
export async function getBookPrice(
  asin: string,
  cfg?: AmazonPaConfig,
   
  fetchFn: typeof fetch = fetch as any,
): Promise<AmazonPrice | null> {
  const book = await getBookByAsin(asin, cfg, fetchFn);
  return book?.price ?? null;
}

// ---- Watchlist (localStorage) ---------------------------------------------------

/** Gespeicherte ASINs der Preis-Watchlist. */
export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(asins: string[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(asins));
  } catch {
    /* ignore */
  }
}

/** Fügt eine ASIN hinzu (idempotent). Gibt die neue Liste zurück. */
export function addToWatchlist(asin: string): string[] {
  const list = loadWatchlist();
  if (!list.includes(asin)) list.push(asin);
  saveWatchlist(list);
  return list;
}

/** Entfernt eine ASIN. Gibt die neue Liste zurück. */
export function removeFromWatchlist(asin: string): string[] {
  const list = loadWatchlist().filter((a) => a !== asin);
  saveWatchlist(list);
  return list;
}
