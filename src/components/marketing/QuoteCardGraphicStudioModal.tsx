// QuoteCardGraphicStudioModal (WP 110.2 UI)
import { useState, useMemo } from "react";
import {
  createQuoteCard,
  createCarouselTemplate,
  buildExportSpec,
  ASPECT_RATIOS,
  THEMES,
  type AspectRatioId,
  type ThemeId,
} from "@/services/marketing/quoteCardGraphicStudio";

export interface QuoteCardGraphicStudioModalProps {
  className?: string;
}

export function QuoteCardGraphicStudioModal({ className }: QuoteCardGraphicStudioModalProps) {
  const [quote, setQuote] = useState("Manchmal ist der größte Mut, den eigenen Weg zu gehen.");
  const [author, setAuthor] = useState("Erik Gieske");
  const [bookTitle, setBookTitle] = useState("Die Stille zwischen den Worten");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("square");
  const [theme, setTheme] = useState<ThemeId>("darkAcademia");
  const [seed, setSeed] = useState(42);

  const card = useMemo(
    () => createQuoteCard({ quote, author, bookTitle, aspectRatioId: aspectRatio, themeId: theme, seed }),
    [quote, author, bookTitle, aspectRatio, theme, seed]
  );
  const carousel = useMemo(
    () => createCarouselTemplate([quote, "Die Worte, die wir nicht sagen, sind die lautesten.", "In der Stille liegt die Antwort, die wir suchen."], author, bookTitle, aspectRatio, theme, seed),
    [quote, author, bookTitle, aspectRatio, theme, seed]
  );
  const exportSpec = useMemo(() => buildExportSpec(card, "svg", 300), [card]);

  return (
    <div
      className={className}
      data-testid="quote-card-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎨 Zitat-Karten- &amp; Karussell-Grafik-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {card.aspectRatio.label} · {card.theme.name} · {card.lineCount} Zeilen
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 200 }}>
          Zitat
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={2}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, resize: "vertical" }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Autor
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Buchtitel
          <input
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 120 }}>
          Seitenverhältnis
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatioId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {ASPECT_RATIOS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 120 }}>
          Stil-Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🖼️ ZITAT-KARTE (SVG)
        </summary>
        <div
          style={{ marginTop: 8, padding: 8, border: "2px solid var(--accent)", borderRadius: 8, background: "var(--panel)", overflow: "auto", textAlign: "center" }}
          dangerouslySetInnerHTML={{ __html: card.svg }}
        />
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎠 KARUSSELL ({carousel.slides.length} Folien)
        </summary>
        <div style={{ marginTop: 8, display: "flex", gap: 8, overflow: "auto", padding: 4 }}>
          {carousel.slides.map((s, i) => (
            <div key={i} style={{ flex: "0 0 120px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", padding: 4, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>Folie {i + 1}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>{s.quote.substring(0, 30)}...</div>
            </div>
          ))}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📥 EXPORT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Format:</strong> {exportSpec.format.toUpperCase()}</div>
          <div><strong>Auflösung:</strong> {exportSpec.width}×{exportSpec.height} px</div>
          <div><strong>DPI:</strong> {exportSpec.dpi}</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>Hinweise:</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10, color: "var(--muted)" }}>
            {exportSpec.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
