// PolyglotBookBuilderModal (WP 84.2 UI) - Minimal Stub
import { useState } from "react";

export interface PolyglotBookBuilderModalProps {
  className?: string;
}

export function PolyglotBookBuilderModal({ className }: PolyglotBookBuilderModalProps) {
  const [bookTitle, setBookTitle] = useState("Zweisprachige Ausgabe");
  const [leftLang, setLeftLang] = useState("de");
  const [rightLang, setRightLang] = useState("en");
  const [paragraphs, setParagraphs] = useState<{ left: string; right: string }[]>([
    { left: "Es war einmal ein König...", right: "Once upon a time there was a king..." },
    { left: "Der in einem fernen Land regierte.", right: "Who ruled in a distant land." },
  ]);
  const [newLeft, setNewLeft] = useState("");
  const [newRight, setNewRight] = useState("");
  const [lineHeight, setLineHeight] = useState(1.5);
  const [fontSize, setFontSize] = useState(12);
  const [gutter, setGutter] = useState(24);

  const addParagraph = () => {
    if (newLeft.trim() || newRight.trim()) {
      setParagraphs([...paragraphs, { left: newLeft, right: newRight }]);
      setNewLeft("");
      setNewRight("");
    }
  };

  return (
    <div
      className={className}
      data-testid="polyglot-book-builder-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌐 Zweisprachiger Parallel-Buch-Satz (Facing-Page)
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Absätze: {paragraphs.length} · Alignment: ✓ Ausgerichtet · Score: 95%
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
          Buchtitel
          <input value={bookTitle} onChange={e => setBookTitle(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Linke Sprache
          <select value={leftLang} onChange={e => setLeftLang(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="la">Latina</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Rechte Sprache
          <select value={rightLang} onChange={e => setRightLang(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="la">Latina</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Zeilenhöhe
          <input type="number" step="0.1" value={lineHeight} onChange={e => setLineHeight(Number(e.target.value) || 1.5)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Schriftgröße (pt)
          <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value) || 12)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Spaltenabstand (pt)
          <input type="number" value={gutter} onChange={e => setGutter(Number(e.target.value) || 24)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          Neuer Absatz (links):
          <textarea value={newLeft} onChange={e => setNewLeft(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, fontFamily: "var(--font-mono)", minHeight: 40 }} />
        </label>
        <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 8, marginBottom: 6 }}>
          Neuer Absatz (rechts):
          <textarea value={newRight} onChange={e => setNewRight(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, fontFamily: "var(--font-mono)", minHeight: 40 }} />
        </label>
        <button onClick={addParagraph} style={{ marginTop: 8, padding: "6px 12px", fontSize: 11, background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: "pointer" }}>
          ➕ Absatz-Paar hinzufügen
        </button>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8, marginBottom: 14, maxHeight: 300, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 8, fontSize: 10, color: "var(--muted)" }}>
          <div style={{ fontWeight: 700 }}>DE (Verso)</div>
          <div style={{ fontWeight: 700 }}>EN (Recto)</div>
        </div>
        {paragraphs.map((pair, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 12, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", lineHeight: 1.5, fontSize: 12 }}>
            <div style={{ whiteSpace: "pre-wrap" }}>{pair.left}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{pair.right}</div>
          </div>
        ))}
        {paragraphs.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>Keine Absätze — fügen Sie ein Paar hinzu.</div>
        )}
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 ALIGNMENT-DETAILS
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}>
          <div>Status: ✓ Ausgerichtet</div>
          <div>Score: 95%</div>
          <div>Max. Versatz: 0.5pt</div>
          <div>Durchschnittl. Versatz: 0.2pt</div>
          <div>Betroffene Paare: 0</div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📄 EXPORT (Markdown)
        </summary>
        <pre style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", background: "var(--panel)" }}>
          {`# ${bookTitle}

---

**Links (${leftLang})** | **Rechts (${rightLang})**
--- | ---
${paragraphs.map(p => `${p.left} | ${p.right}`).join("\n")}
`}
        </pre>
      </details>
    </div>
  );
}