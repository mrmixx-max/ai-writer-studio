// WebSerialPublisherModal (WP 113.2 UI)
import { useState, useMemo } from "react";
import {
  formatLitRPGStatus,
  analyzeCliffhanger,
  exportChapter,
  analyzeSerial,
  PLATFORMS,
  type PlatformId,
} from "@/services/publishing/webSerialPublisher";

export interface WebSerialPublisherModalProps {
  className?: string;
}

const SAMPLE_STATUS = {
  name: "Kael",
  level: 15,
  class: "Shadow Blade",
  hp: 340,
  maxHp: 400,
  mp: 180,
  maxMp: 220,
  attributes: [
    { name: "Stärke", value: 18 },
    { name: "Geschick", value: 22 },
    { name: "Konstitution", value: 16 },
    { name: "Intelligenz", value: 14 },
    { name: "Weisheit", value: 12 },
    { name: "Charisma", value: 10 },
  ],
  skills: ["Schattenschritt", "Giftklinge", "Verschwinden"],
  inventory: ["Schwarze Klinge", "Heiltrank ×3", "Schlüssel der Ahnen"],
};

export function WebSerialPublisherModal({ className }: WebSerialPublisherModalProps) {
  const [platform, setPlatform] = useState<PlatformId>("royalRoad");
  const [chapterTitle, setChapterTitle] = useState("Kapitel 15: Der Verrat");
  const [chapterContent, setChapterContent] = useState("Der Schwert aus der Hand, die Flamme erlosch — und in der Dunkelheit lachte es.");
  const [seed, setSeed] = useState(42);

  const statusText = useMemo(() => formatLitRPGStatus(SAMPLE_STATUS), []);
  const cliffhanger = useMemo(
    () => analyzeCliffhanger(chapterContent, 3, 7, 8, seed),
    [chapterContent, seed]
  );
  const chapterExport = useMemo(
    () => exportChapter(platform, chapterTitle, chapterContent, seed),
    [platform, chapterTitle, chapterContent, seed]
  );
  const serialReport = useMemo(
    () => analyzeSerial(platform, [{ title: chapterTitle, content: chapterContent }], seed),
    [platform, chapterTitle, chapterContent, seed]
  );

  return (
    <div
      className={className}
      data-testid="web-serial-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📖 Web-Serial- &amp; Royal-Road-Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {chapterExport.platform.name} · {chapterExport.wordCount} Wörter · {chapterExport.readingMinutes} Min. Lesezeit
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Plattform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 200 }}>
          Kapiteltitel
          <input
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 3, minWidth: 200 }}>
          Kapitelinhalt
          <textarea
            value={chapterContent}
            onChange={(e) => setChapterContent(e.target.value)}
            rows={3}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, resize: "vertical" }}
          />
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
          📊 LITRPG-STATUSFENSTER
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", lineHeight: 1.5 }}>
          {statusText}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎭 PATREON-CLIFFHANGER-SCORE: {cliffhanger.score}/10
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Offenheit:</strong> {cliffhanger.openness}/10</div>
          <div><strong>Spannung:</strong> {cliffhanger.tension}/10</div>
          <div><strong>Emotionaler Impact:</strong> {cliffhanger.emotionalImpact}/10</div>
          <div><strong>Cliffhanger-Typ:</strong> {cliffhanger.cliffhangerType}</div>
          <div style={{ marginTop: 4, fontWeight: 700, color: cliffhanger.score >= 8 ? "var(--success)" : cliffhanger.score >= 5 ? "var(--warning)" : "var(--error)" }}>
            {cliffhanger.patreonRecommendation}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📤 1-KLICK-PLATTFORM-EXPORT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Markdown:</strong> {chapterExport.markdown.length} Zeichen</div>
          <div><strong>HTML:</strong> {chapterExport.html.length} Zeichen</div>
          <div><strong>Wortzahl:</strong> {chapterExport.wordCount}</div>
          <div><strong>Lesezeit:</strong> {chapterExport.readingMinutes} Minuten</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Kompatibel mit Royal Road, Wattpad, Substack und Patreon.
          </div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📈 SERIAL-BERICHT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Plattform:</strong> {serialReport.platform.name}</div>
          <div><strong>Kapitel:</strong> {serialReport.chapterCount}</div>
          <div><strong>Gesamtwortzahl:</strong> {serialReport.totalWords}</div>
          <div><strong>Ø Wörter/Kapitel:</strong> {serialReport.avgWordsPerChapter}</div>
          <div><strong>Cliffhanger-Score:</strong> {serialReport.cliffhangerAnalysis.score}/10</div>
        </div>
      </details>
    </div>
  );
}
