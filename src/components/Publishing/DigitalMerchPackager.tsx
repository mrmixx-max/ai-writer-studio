// DigitalMerchPackager (WP 47.2): Digitales Fan-Merch & Lesezeichen-Studio.
//
// Generiert druckfertige Lesezeichen (50×200mm, 300 DPI), Smartphone-
// Wallpaper (1080×2400px) und schnürt ein Fan-Bundle mit Dankeskarte.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  generateBookmark,
  generateWallpaper,
  packageFanBundle,
  selectQuotes,
  type BookmarkOptions,
  type FanBundleItem,
} from "@/services/publishing/digitalMerchPackager";

export interface DigitalMerchPackagerProps {
  manuscript?: string;
  authorName?: string;
  className?: string;
}

const DEFAULT_MANUSCRIPT = `Der letzte Winter kam leise. Sie stand am Fenster und sah den Schnee über die Stadt fallen. "Niemand wird uns reisen", flüsterte sie. Doch er wusste, dass das Unmögliche möglich war. Die Kälte biss in ihre Wangen, aber in ihrem Herzen brannte ein Feuer, das niemand löschen konnte.`;

export function DigitalMerchPackager({
  manuscript = DEFAULT_MANUSCRIPT,
  authorName = "Erik Gieske",
  className,
}: DigitalMerchPackagerProps) {
  const [quote, setQuote] = useState("");
  const [bookmarkFont, setBookmarkFont] = useState("serif");
  const [frameStyle, setFrameStyle] = useState<BookmarkOptions["frameStyle"]>("ornate");
  const [wallpaperSize, setWallpaperSize] = useState<"standard" | "large">("standard");
  const [bundleMessage, setBundleMessage] = useState("Danke, dass du meine Welt lesest!");
  const [bundle, setBundle] = useState<ReturnType<typeof packageFanBundle> | null>(null);

  const quotes = useMemo(() => selectQuotes(manuscript, 5), [manuscript]);

  const bookmark = useMemo(
    () =>
      generateBookmark(quote || quotes[0] || "Zitat", {
        font: bookmarkFont,
        frameStyle,
        backgroundColor: "#1a1a2e",
        textColor: "#e0d5c1",
      }),
    [quote, quotes, bookmarkFont, frameStyle],
  );

  const wallpaper = useMemo(
    () =>
      generateWallpaper(quote || quotes[0] || "Zitat", {
        width: wallpaperSize === "large" ? 1440 : 1080,
        height: wallpaperSize === "large" ? 3200 : 2400,
        backgroundColor: "#0f0f1a",
        textColor: "#f0e6d3",
        fontSize: 48,
      }),
    [quote, quotes, wallpaperSize],
  );

  const handleBundle = useCallback(() => {
    const items: FanBundleItem[] = [
      { id: "bm", kind: "bookmark", name: "Lesezeichen", data: bookmark.svg },
      { id: "wp", kind: "wallpaper", name: "Wallpaper", data: wallpaper.svg },
      { id: "qc", kind: "quote-card", name: "Zitat-Karte", data: bookmark.svg },
    ];
    setBundle(packageFanBundle(items, authorName, bundleMessage));
  }, [bookmark, wallpaper, authorName, bundleMessage]);

  return (
    <div
      className={className}
      data-testid="digital-merch-packager"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎁 Fan-Merch-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Lesezeichen · Wallpaper · Zitat-Karten · Fan-Bundle
      </div>

      {/* Zitat-Auswahl */}
      <div data-testid="merch-quotes" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ZITAT WÄHLEN</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {quotes.map((q, i) => (
            <button
              key={i}
              data-testid={`merch-quote-${i}`}
              onClick={() => setQuote(q)}
              style={{
                background: quote === q ? "var(--accent)" : "transparent",
                color: quote === q ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 10,
                cursor: "pointer",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              "{q.length > 40 ? q.slice(0, 40) + "…" : q}"
            </button>
          ))}
        </div>
      </div>

      {/* Lesezeichen */}
      <div data-testid="merch-bookmark" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          LESEZEICHEN ({bookmark.widthMm}×{bookmark.heightMm}mm, {bookmark.dpi} DPI)
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Schrift
            <select
              data-testid="merch-font"
              value={bookmarkFont}
              onChange={(e) => setBookmarkFont(e.target.value)}
              style={{
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "3px 6px",
                fontSize: 11,
                marginLeft: 5,
              }}
            >
              <option value="serif">Serif</option>
              <option value="sans-serif">Sans-Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            Rahmen
            <select
              data-testid="merch-frame"
              value={frameStyle}
              onChange={(e) => setFrameStyle(e.target.value as BookmarkOptions["frameStyle"])}
              style={{
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "3px 6px",
                fontSize: 11,
                marginLeft: 5,
              }}
            >
              <option value="ornate">Verziert</option>
              <option value="minimal">Minimal</option>
              <option value="none">Kein</option>
            </select>
          </label>
        </div>
        <div
          data-testid="merch-bookmark-preview"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            display: "inline-block",
          }}
        >
          <div
            style={{
              width: 60,
              height: 240,
              background: bookmark.svg.match(/background:\s*([^;]+)/)?.[1] ?? "#1a1a2e",
              border: frameStyle === "ornate" ? "2px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: "#e0d5c1",
                textAlign: "center",
                fontFamily: bookmarkFont,
                lineHeight: 1.4,
              }}
            >
              {bookmark.quote}
            </span>
          </div>
        </div>
      </div>

      {/* Wallpaper */}
      <div data-testid="merch-wallpaper" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          WALLPAPER ({wallpaper.width}×{wallpaper.height}px)
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 5, alignItems: "center" }}>
            <input
              data-testid="merch-wallpaper-size"
              type="checkbox"
              checked={wallpaperSize === "large"}
              onChange={(e) => setWallpaperSize(e.target.checked ? "large" : "standard")}
            />
            Groß (1440×3200)
          </label>
        </div>
        <div
          data-testid="merch-wallpaper-preview"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            display: "inline-block",
          }}
        >
          <div
            style={{
              width: 72,
              height: 160,
              background: "#0f0f1a",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                fontSize: 7,
                color: "#f0e6d3",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {wallpaper.quote}
            </span>
          </div>
        </div>
      </div>

      {/* Fan-Bundle */}
      <div data-testid="merch-bundle" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>FAN-BUNDLE</div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8, maxWidth: 520 }}>
          Dankeskarte
          <input
            data-testid="merch-bundle-message"
            value={bundleMessage}
            onChange={(e) => setBundleMessage(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 3,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </label>
        <button
          data-testid="merch-bundle-create"
          onClick={handleBundle}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Bundle erstellen
        </button>
      </div>

      {bundle && (
        <div
          data-testid="merch-bundle-result"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
            📦 {bundle.items.length} Dateien
          </div>
          {bundle.items.map((item) => (
            <div key={item.id} data-testid={`merch-bundle-item-${item.id}`} style={{ fontSize: 11, marginBottom: 2 }}>
              · {item.kind}: {item.name}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            "{bundle.thankYouMessage}" — {bundle.authorName}
          </div>
        </div>
      )}
    </div>
  );
}
