// AmazonPanel: Buchsuche + Preis-Monitoring (Sprint 19f, Agent 2).
//
// - Suchfeld + Ergebnisliste (Titel, Autor, Preis, Cover)
// - Klick auf Ergebnis → Detail (ASIN, Kategorie, Rang)
// - „Preis überwachen“ → ASIN landet in der lokalen Watchlist (localStorage)
// - Watchlist mit aktuellem Preis + Reload-Button
// - Ohne Credentials: „Amazon API nicht konfiguriert“ + Verweis auf Einstellungen
// - Zugangsdaten-Sektion (Secret-Felder maskiert) direkt im Panel —
//   SettingsPanel/config.ts waren für diesen Sprint nicht freigegeben,
//   daher liegt die PA-API-Konfiguration in localStorage („amazon-paapi-config“).
import { useEffect, useState } from "react";
import {
  searchBooks,
  getBookByAsin,
  loadAmazonConfig,
  saveAmazonConfig,
  isAmazonConfigured,
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type AmazonBook,
  type AmazonPaConfig,
} from "@/services/amazon/amazonApi";

function formatPrice(book: AmazonBook): string {
  if (!book.price) return "–";
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: book.price.currency }).format(book.price.amount);
  } catch {
    return `${book.price.amount} ${book.price.currency}`;
  }
}

function openSettings(): void {
  window.dispatchEvent(new CustomEvent("app:open-settings"));
}

export function AmazonPanel() {
  const [cfg, setCfg] = useState<AmazonPaConfig>(() => loadAmazonConfig());
  const [configured, setConfigured] = useState<boolean>(() => isAmazonConfigured());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AmazonBook[]>([]);
  const [selected, setSelected] = useState<AmazonBook | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => loadWatchlist());
  const [prices, setPrices] = useState<Record<string, AmazonBook>>({});
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfigured(isAmazonConfigured(cfg));
  }, []);

  function updateCfg<K extends keyof AmazonPaConfig>(k: K, v: string) {
    setCfg((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function saveCfg() {
    saveAmazonConfig(cfg);
    setConfigured(isAmazonConfigured(cfg));
    setSaved(true);
  }

  async function search(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchBooks(q, "Books", cfg));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function watch(asin: string) {
    setWatchlist(addToWatchlist(asin));
  }

  function unwatch(asin: string) {
    setWatchlist(removeFromWatchlist(asin));
    setPrices((prev) => {
      const next = { ...prev };
      delete next[asin];
      return next;
    });
  }

  async function reloadPrices() {
    if (reloading || watchlist.length === 0) return;
    setReloading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        watchlist.map(async (asin) => [asin, await getBookByAsin(asin, cfg)] as const),
      );
      const next: Record<string, AmazonBook> = {};
      for (const [asin, book] of entries) {
        if (book) next[asin] = book;
      }
      setPrices(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="amazon-panel">
      <h3>🛒 Amazon — Buchsuche + Preis-Monitoring</h3>

      {!configured && (
        <div className="amazon-not-configured" role="alert">
          <strong>Amazon API nicht konfiguriert.</strong>
          <p>Hinterlege Access Key, Secret Key und Partner Tag — oder öffne die Einstellungen.</p>
          <button onClick={openSettings}>Zu den Einstellungen</button>
        </div>
      )}

      <details className="amazon-config">
        <summary>Zugangsdaten (PA-API 5.0)</summary>
        <label>
          Access Key ID
          <input
            type="password"
            autoComplete="off"
            value={cfg.accessKeyId}
            onChange={(e) => updateCfg("accessKeyId", e.target.value)}
            placeholder="AKIA…"
          />
        </label>
        <label>
          Secret Access Key
          <input
            type="password"
            autoComplete="off"
            value={cfg.secretAccessKey}
            onChange={(e) => updateCfg("secretAccessKey", e.target.value)}
            placeholder="geheim"
          />
        </label>
        <label>
          Partner Tag (Associate Tag)
          <input
            type="text"
            autoComplete="off"
            value={cfg.partnerTag}
            onChange={(e) => updateCfg("partnerTag", e.target.value)}
            placeholder="my-tag-21"
          />
        </label>
        <label>
          Region
          <input
            type="text"
            value={cfg.region}
            onChange={(e) => updateCfg("region", e.target.value)}
            placeholder="eu-west-1"
          />
        </label>
        <label>
          Marketplace
          <input
            type="text"
            value={cfg.marketplace}
            onChange={(e) => updateCfg("marketplace", e.target.value)}
            placeholder="www.amazon.de"
          />
        </label>
        <button onClick={saveCfg}>Zugangsdaten speichern</button>
        {saved && <span role="status">Gespeichert.</span>}
      </details>

      {error && (
        <div className="amazon-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="amazon-search"
        onSubmit={(e) => {
          void search(e);
        }}
      >
        <input
          type="search"
          aria-label="Buchsuche"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titel, Autor oder ISBN suchen…"
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Sucht…" : "Suchen"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="amazon-results">
          {results.map((b) => (
            <li key={b.asin}>
              <button className="amazon-result" onClick={() => setSelected(b)} aria-label={`Details: ${b.title}`}>
                {b.imageUrl && <img src={b.imageUrl} alt="" width={40} loading="lazy" />}
                <span>
                  <strong>{b.title}</strong>
                  <br />
                  {b.author} · {formatPrice(b)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="amazon-detail" aria-live="polite">
          <h4>{selected.title}</h4>
          <p>Autor: {selected.author}</p>
          <p>ASIN: {selected.asin}</p>
          {selected.category && <p>Kategorie: {selected.category}</p>}
          {selected.rank != null && <p>Rang: {selected.rank}</p>}
          <p>Preis: {formatPrice(selected)}</p>
          {selected.url && (
            <p>
              <a href={selected.url} target="_blank" rel="noreferrer">
                Auf Amazon ansehen
              </a>
            </p>
          )}
          <button onClick={() => watch(selected.asin)}>Preis überwachen</button>{" "}
          <button onClick={() => setSelected(null)}>Schließen</button>
        </div>
      )}

      <section className="amazon-watchlist" aria-label="Preis-Watchlist">
        <h4>Preis-Watchlist ({watchlist.length})</h4>
        <button onClick={() => void reloadPrices()} disabled={reloading || watchlist.length === 0}>
          {reloading ? "Lädt…" : "Preise aktualisieren"}
        </button>
        {watchlist.length === 0 ? (
          <p>Noch keine ASINs überwacht.</p>
        ) : (
          <ul>
            {watchlist.map((asin) => (
              <li key={asin}>
                <span>
                  {asin}
                  {prices[asin] && ` · ${prices[asin].title} · ${formatPrice(prices[asin])}`}
                </span>{" "}
                <button onClick={() => unwatch(asin)} aria-label={`Überwachung beenden: ${asin}`}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
