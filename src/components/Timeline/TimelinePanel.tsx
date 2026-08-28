// Story-Timeline-Panel: interaktive SVG-Timeline, Plot-Struktur (3 Akte + Heldenreise), Export.
import { useEffect, useState } from "react";
import { listEvents, type TimelineEvent } from "@/services/timeline/timeline";
import {
  THREE_ACT_STRUCTURE, HERO_JOURNEY_STAGES, buildPlotStructure, structureStats,
} from "@/services/timeline/plotStructure";
import { exportTimeline } from "@/services/timeline/timelineExport";
import { downloadData } from "@/services/characters/characterExport";
import { TimelineCanvas, type TimelineBand } from "./TimelineCanvas";

const ACT_COLORS: Record<string, string> = {
  act1: "#3b82f6",
  act2: "#f59e0b",
  act3: "#ef4444",
};

const JOURNEY_BANDS = 3;

export function TimelinePanel({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  useEffect(() => {
    setEvents(listEvents(projectId));
    setSelected(null);
  }, [projectId]);

  const structure = buildPlotStructure(events);
  const stats = structureStats(events);

  const bands: TimelineBand[] = showJourney
    ? // Heldenreise grob in 3 Bänder (Welt/Ruf → Prüfungen/Tiefe → Belohnung/Rückkehr)
      [
        { label: "Act I · Ruf", color: "#3b82f6", from: 0, to: 1 / JOURNEY_BANDS },
        { label: "Act II · Prüfungen", color: "#f59e0b", from: 1 / JOURNEY_BANDS, to: 2 / JOURNEY_BANDS },
        { label: "Act III · Rückkehr", color: "#ef4444", from: 2 / JOURNEY_BANDS, to: 1 },
      ]
    : THREE_ACT_STRUCTURE.map((a, i, arr) => ({
        label: a.label,
        color: ACT_COLORS[a.id],
        from: a.share[0],
        to: a.share[1],
        ...(i === arr.length - 1 ? { to: 1 } : {}),
      }));

  const items = events.map((e) => {
    const s = structure.find((x) => x.eventId === e.id);
    return {
      id: e.id,
      label: e.title,
      sub: e.storyDate || e.chapterRef || undefined,
      detail: [
        e.description,
        s?.act ? `Akt: ${THREE_ACT_STRUCTURE.find((a) => a.id === s.act)?.label}` : null,
        s?.journeyStage
          ? `Heldenreise: ${HERO_JOURNEY_STAGES.find((h) => h.id === s.journeyStage)?.label}`
          : null,
      ].filter(Boolean).join(" — "),
      color: s?.act ? ACT_COLORS[s.act] : undefined,
    };
  });

  if (!events.length) {
    return (
      <div className="mode-placeholder">
        Noch keine Timeline-Ereignisse. Ereignisse werden über den KI-Assistenten oder
        die Timeline-Services angelegt.
      </div>
    );
  }

  return (
    <div className="timeline-panel">
      <h3>Story-Timeline</h3>
      <TimelineCanvas
        items={items}
        bands={bands}
        selectedId={selected}
        onSelect={setSelected}
      />

      <div className="plot-structure">
        <h4>
          Plot-Struktur
          <label style={{ marginLeft: 12, fontSize: 12 }}>
            <input type="checkbox" checked={showJourney} onChange={(e) => setShowJourney(e.target.checked)} />
            {" "}Heldenreise-Bänder statt 3 Akte
          </label>
        </h4>
        <p className="timeline-hint">
          {stats.total} Ereignisse · Akt I: {stats.perAct.act1} · Akt II: {stats.perAct.act2} · Akt III: {stats.perAct.act3} ·
          Heldenreise-Abdeckung: {(stats.journeyCoverage * 100).toFixed(0)}%
        </p>
        <div className="plot-acts">
          {THREE_ACT_STRUCTURE.map((a) => (
            <div key={a.id} className="plot-act" style={{ borderLeft: `3px solid ${ACT_COLORS[a.id]}` }}>
              <strong>{a.label}</strong>
              <span>{a.description}</span>
              <span>{stats.perAct[a.id]} Ereignisse</span>
            </div>
          ))}
        </div>
        <details className="journey-stages">
          <summary>Heldenreise-Stufen ({HERO_JOURNEY_STAGES.length})</summary>
          <ol>
            {HERO_JOURNEY_STAGES.map((st) => {
              const hit = structure.some((s) => s.journeyStage === st.id);
              return (
                <li key={st.id} style={{ opacity: hit ? 1 : 0.45 }}>
                  {st.label} — {st.hint} {hit ? "✔" : ""}
                </li>
              );
            })}
          </ol>
        </details>
      </div>

      <div className="timeline-export">
        <h4>Export</h4>
        <button onClick={() => exportTimeline(projectId, events, "json", downloadData)}>JSON</button>
        <button onClick={() => exportTimeline(projectId, events, "csv", downloadData)}>CSV</button>
        <button onClick={() => exportTimeline(projectId, events, "md", downloadData)}>Markdown</button>
      </div>
    </div>
  );
}
