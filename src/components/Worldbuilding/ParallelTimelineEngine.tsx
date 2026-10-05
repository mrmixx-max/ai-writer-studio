// ParallelTimelineEngine (WP 51.1): Zeitreise- & Multiversum-Kausalitätswächter.
//
// Multi-Branch-Zeitleiste, Kausalitäts-Prüfer und Gantt-Spur-Visualisierung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createTimeline,
  addEvent,
  detectParadoxes,
  generateGanttData,
  type Timeline,
  type TimelineEvent,
} from "@/services/worldbuilding/parallelTimelineEngine";

export interface ParallelTimelineEngineProps {
  className?: string;
}

export function ParallelTimelineEngine({ className }: ParallelTimelineEngineProps) {
  const [timelines, setTimelines] = useState<Timeline[]>([
    createTimeline("tl-a", "Zeitlinie A (Hauptplot)", 2020, 2030),
    createTimeline("tl-b", "Zeitlinie B (Rückblende)", 1980, 1990),
  ]);
  const [selectedTimeline, setSelectedTimeline] = useState("tl-a");
  const [eventName, setEventName] = useState("");
  const [eventYear, setEventYear] = useState(2025);
  const [eventCharacters, setEventCharacters] = useState("");

  const paradoxes = useMemo(() => detectParadoxes(timelines), [timelines]);
  const gantt = useMemo(() => generateGanttData(timelines), [timelines]);

  const handleAddEvent = useCallback(() => {
    if (!eventName.trim()) return;
    const tl = timelines.find((t) => t.id === selectedTimeline);
    if (!tl) return;
    const event: TimelineEvent = {
      id: `ev-${Date.now()}`,
      name: eventName.trim(),
      year: eventYear,
      characterIds: eventCharacters.split(",").map((c) => c.trim()).filter(Boolean),
      description: "",
    };
    setTimelines(timelines.map((t) => (t.id === selectedTimeline ? addEvent(t, event) : t)));
    setEventName("");
    setEventCharacters("");
  }, [timelines, selectedTimeline, eventName, eventYear, eventCharacters]);

  return (
    <div
      className={className}
      data-testid="parallel-timeline-engine"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⏳ Kausalitätswächter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {timelines.length} Zeitleisten · {timelines.reduce((s, t) => s + t.events.length, 0)} Ereignisse · {paradoxes.length} Paradoxa
      </div>

      {/* Paradoxa */}
      {paradoxes.length > 0 && (
        <div data-testid="timeline-paradoxes" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--error)", marginBottom: 4 }}>
            PARADOXA ({paradoxes.length})
          </div>
          {paradoxes.map((p) => (
            <div
              key={p.id}
              data-testid={`timeline-paradox-${p.id}`}
              style={{
                borderLeft: "3px solid var(--error)",
                paddingLeft: 10,
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              <strong style={{ color: "var(--error)" }}>{p.kind}</strong>
              <span style={{ color: "var(--muted)" }}> · {p.timelineA} ↔ {p.timelineB}</span>
              <div style={{ color: "var(--muted)", fontSize: 10 }}>{p.description}</div>
            </div>
          ))}
        </div>
      )}

      {paradoxes.length === 0 && (
        <div data-testid="timeline-no-paradoxes" style={{ fontSize: 12, color: "var(--success)", marginBottom: 14 }}>
          ✓ Keine Paradoxa gefunden.
        </div>
      )}

      {/* Ereignis hinzufügen */}
      <div data-testid="timeline-add" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>EREIGNIS HINZUFÜGEN</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select
            data-testid="timeline-select"
            value={selectedTimeline}
            onChange={(e) => setSelectedTimeline(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          >
            {timelines.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            data-testid="timeline-event-year"
            type="number"
            value={eventYear}
            onChange={(e) => setEventYear(Number(e.target.value) || 0)}
            style={{
              width: 70,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "4px 6px",
              fontSize: 10,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            data-testid="timeline-event-name"
            placeholder="Ereignisname..."
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <input
            data-testid="timeline-event-characters"
            placeholder="Figuren (kommagetrennt)..."
            value={eventCharacters}
            onChange={(e) => setEventCharacters(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
          <button
            data-testid="timeline-add-event"
            onClick={handleAddEvent}
            disabled={!eventName.trim()}
            style={{
              background: eventName.trim() ? "var(--accent)" : "transparent",
              color: eventName.trim() ? "var(--bg)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: eventName.trim() ? "pointer" : "not-allowed",
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Gantt */}
      <div data-testid="timeline-gantt" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>GANTT-ÜBERSICHT</div>
        {gantt.tracks.map((track) => (
          <div key={track.timelineId} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{track.timelineName}</div>
            <div style={{ position: "relative", height: 20, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3 }}>
              {track.bars.map((bar) => {
                const totalYears = gantt.maxYear - gantt.minYear || 1;
                const left = ((bar.startYear - gantt.minYear) / totalYears) * 100;
                const width = Math.max(2, ((bar.endYear - bar.startYear) / totalYears) * 100);
                return (
                  <div
                    key={bar.eventId}
                    data-testid={`gantt-bar-${bar.eventId}`}
                    title={bar.eventName}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 2,
                      height: 16,
                      background: "var(--accent)",
                      borderRadius: 2,
                      opacity: 0.8,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Ereignis-Liste */}
      <div data-testid="timeline-events">
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>EREIGNISSE</div>
        {timelines.map((tl) => (
          <div key={tl.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{tl.name}</div>
            {tl.events.length === 0 && (
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Keine Ereignisse.</div>
            )}
            {tl.events.map((ev) => (
              <div
                key={ev.id}
                data-testid={`timeline-event-${ev.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 8px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 10,
                }}
              >
                <span>{ev.name}</span>
                <span style={{ color: "var(--muted)" }}>{ev.year}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
