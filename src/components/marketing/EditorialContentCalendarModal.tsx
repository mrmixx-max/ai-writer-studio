// EditorialContentCalendarModal (WP 111.1 UI)
import { useState, useMemo } from "react";
import {
  generateEditorialCalendar,
  exportCalendarToCsv,
  exportCalendarToMarkdown,
  CAMPAIGN_PHASES,
  CHANNELS,
} from "@/services/marketing/editorialContentCalendar";

export interface EditorialContentCalendarModalProps {
  className?: string;
}

export function EditorialContentCalendarModal({ className }: EditorialContentCalendarModalProps) {
  const [seed, setSeed] = useState(42);
  const [selectedDay, setSelectedDay] = useState(15);

  const calendar = useMemo(() => generateEditorialCalendar(seed), [seed]);
  const csv = useMemo(() => exportCalendarToCsv(calendar), [calendar]);
  const markdown = useMemo(() => exportCalendarToMarkdown(calendar), [calendar]);
  const selectedEntry = calendar.entries.find((e) => e.day === selectedDay) || calendar.entries[0];

  return (
    <div
      className={className}
      data-testid="editorial-calendar-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📅 30-Tage-Launch-Redaktionskalender
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {calendar.entries.length} Einträge · {CAMPAIGN_PHASES.length} Phasen · {CHANNELS.length} Kanäle
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Tag wählen
          <input
            type="number"
            min={1}
            max={30}
            value={selectedDay}
            onChange={(e) => setSelectedDay(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 TAG {selectedEntry.day}: {selectedEntry.title}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Phase:</strong> {selectedEntry.phase.name}</div>
          <div><strong>Kanal:</strong> {selectedEntry.channel.name} ({selectedEntry.channel.bestTime})</div>
          <div><strong>Beschreibung:</strong> {selectedEntry.description}</div>
          <div><strong>Hashtags:</strong> {selectedEntry.hashtags.join(" ")}</div>
          <div><strong>CTA:</strong> {selectedEntry.cta}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗓️ KAMPAGNEN-PHASEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {CAMPAIGN_PHASES.map((p) => (
            <div key={p.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{p.name} (Tag {p.startDay}–{p.endDay})</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{p.focus}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 KANÄLE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {CHANNELS.map((c) => (
            <div key={c.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Beste Zeit: {c.bestTime} · Format: {c.format}</div>
            </div>
          ))}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📤 EXPORT
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div style={{ marginBottom: 4 }}>
            <strong>CSV:</strong> {csv.rows.length} Zeilen, {csv.content.length} Zeichen
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Markdown:</strong> {markdown.sections.length} Abschnitte, {markdown.content.length} Zeichen
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Kompatibel mit Notion, Buffer, Hootsuite und Excel.
          </div>
        </div>
      </details>
    </div>
  );
}
