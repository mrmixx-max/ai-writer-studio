// Story-Timeline-Panel (Sprint 23, Agent 4): Plot-Timeline-Engine-UI
// (Timeline-Liste, Zeitleiste mit Event-Markern, Hinzufuegen/Bearbeiten,
// Filter, JSON-Export) + legacy Plot-Struktur-Ansicht (Sprint davor).
// Bloomberg-Terminal-Stil: schwarzer Grund, Phosphor-Farben, Monospace.
import { useEffect, useMemo, useState } from "react";
import {
  listEvents,
  type TimelineEvent,
  createTimeline,
  addEvent,
  updateEvent,
  removeEvent,
  getTimelines,
  exportToJSON,
  TIMELINE_TYPE_COLORS,
  type Timeline,
  type PlotTimelineEvent,
  type TimelineEventType,
} from "@/services/timeline/timeline";
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

const EVENT_TYPES: TimelineEventType[] = [
  "action", "revelation", "conflict", "decision", "climax", "resolution",
];

const TYPE_LABELS: Record<TimelineEventType, string> = {
  action: "Aktion",
  revelation: "Enthüllung",
  conflict: "Konflikt",
  decision: "Entscheidung",
  climax: "Höhepunkt",
  resolution: "Auflösung",
};

// Bloomberg-Terminal-Farbwelt (Inline-Stile, keine neue CSS-Datei noetig).
const BB = {
  bg: "#0a0e14",
  panel: "#0d131c",
  border: "#1f2a3a",
  amber: "#ffb000",
  green: "#00ff41",
  red: "#ff3333",
  cyan: "#00e5ff",
  text: "#d6dbd6",
  dim: "#7a8599",
} as const;

const bbInput: React.CSSProperties = {
  background: "#000",
  color: BB.text,
  border: `1px solid ${BB.border}`,
  fontFamily: "monospace",
  fontSize: 12,
  padding: "4px 6px",
};

const bbButton: React.CSSProperties = {
  background: "#000",
  color: BB.amber,
  border: `1px solid ${BB.amber}`,
  fontFamily: "monospace",
  fontSize: 12,
  padding: "4px 10px",
  cursor: "pointer",
};

interface EventForm {
  title: string;
  description: string;
  timestamp: string;
  type: TimelineEventType;
  chapter: string;
  characters: string;
  location: string;
}

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  timestamp: "",
  type: "action",
  chapter: "",
  characters: "",
  location: "",
};

function toForm(e: PlotTimelineEvent): EventForm {
  return {
    title: e.title,
    description: e.description,
    timestamp: e.timestamp,
    type: e.type,
    chapter: e.chapter ?? "",
    characters: e.characters.join(", "),
    location: e.location ?? "",
  };
}

function downloadJson(filename: string, content: string): void {
  try {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // jsdom / No-Browser-Kontext: stiller No-Op, JSON bleibt in <details> kopierbar.
  }
}

function PlotEngineUI() {
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("alle");
  const [filterChar, setFilterChar] = useState("");
  const [exported, setExported] = useState(false);

  const refresh = () => {
    void getTimelines().then((all) => {
      setTimelines(all);
      setActiveId((prev) => (prev && all.some((t) => t.id === prev) ? prev : (all[0]?.id ?? null)));
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const active = timelines.find((t) => t.id === activeId) ?? null;

  const visibleEvents = useMemo(() => {
    if (!active) return [];
    const needle = filterChar.trim().toLowerCase();
    return active.events.filter((e) => {
      if (filterType !== "alle" && e.type !== filterType) return false;
      if (needle && !e.characters.some((c) => c.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [active, filterType, filterChar]);

  const set = (patch: Partial<EventForm>) => setForm((f) => ({ ...f, ...patch }));

  const handleCreateTimeline = () => {
    const title = newTitle.trim() || "Neue Timeline";
    const tl = createTimeline(title);
    setNewTitle("");
    void getTimelines().then((all) => {
      setTimelines(all);
      setActiveId(tl.id);
    });
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (e: PlotTimelineEvent) => {
    setEditingId(e.id);
    setForm(toForm(e));
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!active || !form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      timestamp: form.timestamp.trim() || "ohne Zeit",
      type: form.type,
      chapter: form.chapter.trim() || undefined,
      characters: form.characters.split(",").map((c) => c.trim()).filter(Boolean),
      location: form.location.trim() || undefined,
    };
    if (editingId) {
      await updateEvent(active.id, editingId, payload);
    } else {
      await addEvent(active.id, payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    refresh();
  };

  const handleDelete = async (eventId: string) => {
    if (!active) return;
    await removeEvent(active.id, eventId);
    refresh();
  };

  const handleExport = () => {
    if (!active) return;
    downloadJson(`timeline-${active.title.replace(/\s+/g, "-")}.json`, exportToJSON(active));
    setExported(true);
  };

  return (
    <div data-testid="timeline-engine" style={{ background: BB.bg, color: BB.text, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ borderBottom: `1px solid ${BB.border}`, padding: "6px 8px", color: BB.amber, fontWeight: "bold" }}>
        TIMELINE // Handlungs-Zeitleiste
      </div>

      {/* Timeline-Liste + Anlage */}
      <div style={{ display: "flex", gap: 6, padding: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          aria-label="Timeline wählen"
          data-testid="timeline-select"
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value || null)}
          style={bbInput}
        >
          {timelines.length === 0 && <option value="">— keine Timeline —</option>}
          {timelines.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.events.length})
            </option>
          ))}
        </select>
        <input
          aria-label="Neuer Timeline-Titel"
          placeholder="Titel…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={bbInput}
        />
        <button onClick={handleCreateTimeline} style={bbButton}>+ Timeline</button>
      </div>

      {!active ? (
        <div className="mode-placeholder" style={{ padding: 12, color: BB.dim }}>
          Noch keine Timeline. Lege oben eine an.
        </div>
      ) : (
        <>
          {/* Filter + Aktionen */}
          <div style={{ display: "flex", gap: 6, padding: "0 8px 8px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              aria-label="Nach Typ filtern"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={bbInput}
            >
              <option value="alle">Alle Typen</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              aria-label="Nach Charakter filtern"
              placeholder="Charakter filtern…"
              value={filterChar}
              onChange={(e) => setFilterChar(e.target.value)}
              style={bbInput}
            />
            <button onClick={openAddForm} data-testid="timeline-add-open" style={bbButton}>
              + Event hinzufügen
            </button>
            <button onClick={handleExport} data-testid="timeline-export" style={{ ...bbButton, color: BB.green, borderColor: BB.green }}>
              JSON-Export
            </button>
          </div>

          {/* Add-/Edit-Formular */}
          {showForm && (
            <div data-testid="timeline-event-form" style={{ border: `1px solid ${BB.amber}`, margin: "0 8px 8px", padding: 8, background: BB.panel }}>
              <div style={{ color: BB.amber, marginBottom: 6 }}>
                {editingId ? "EVENT BEARBEITEN" : "NEUES EVENT"}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <input aria-label="Event-Titel" placeholder="Titel" value={form.title} onChange={(e) => set({ title: e.target.value })} style={bbInput} />
                <input aria-label="Event-Beschreibung" placeholder="Beschreibung" value={form.description} onChange={(e) => set({ description: e.target.value })} style={bbInput} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input aria-label="Event-Zeit" placeholder="Zeit (z.B. Tag 3)" value={form.timestamp} onChange={(e) => set({ timestamp: e.target.value })} style={bbInput} />
                  <select aria-label="Event-Typ" value={form.type} onChange={(e) => set({ type: e.target.value as TimelineEventType })} style={bbInput}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input aria-label="Event-Kapitel" placeholder="Kapitel" value={form.chapter} onChange={(e) => set({ chapter: e.target.value })} style={bbInput} />
                  <input aria-label="Event-Charaktere" placeholder="Charaktere (Komma-getrennt)" value={form.characters} onChange={(e) => set({ characters: e.target.value })} style={bbInput} />
                  <input aria-label="Event-Ort" placeholder="Ort" value={form.location} onChange={(e) => set({ location: e.target.value })} style={bbInput} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => void handleSubmit()} data-testid="timeline-event-save" style={bbButton} disabled={!form.title.trim()}>
                    Speichern
                  </button>
                  <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ ...bbButton, color: BB.dim, borderColor: BB.border }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Zeitleiste mit Event-Markern */}
          <div data-testid="timeline-track" style={{ margin: "0 8px", borderLeft: `2px solid ${BB.border}`, paddingLeft: 0 }}>
            {visibleEvents.length === 0 && (
              <div style={{ padding: "8px 12px", color: BB.dim }}>
                {active.events.length === 0 ? "Noch keine Events. Füge oben eines hinzu." : "Kein Event passt zum Filter."}
              </div>
            )}
            {visibleEvents.map((e) => (
              <div key={e.id} data-testid="timeline-event" data-event-type={e.type} style={{ display: "flex", gap: 8, padding: "6px 0 6px 12px", position: "relative" }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: -6,
                    top: 10,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: e.color ?? TIMELINE_TYPE_COLORS[e.type],
                    boxShadow: `0 0 6px ${e.color ?? TIMELINE_TYPE_COLORS[e.type]}`,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ color: BB.cyan }}>[{e.timestamp}]</span>{" "}
                    <strong style={{ color: BB.text }}>{e.title}</strong>{" "}
                    <span
                      data-testid="timeline-event-type"
                      style={{
                        color: e.color ?? TIMELINE_TYPE_COLORS[e.type],
                        border: `1px solid ${e.color ?? TIMELINE_TYPE_COLORS[e.type]}`,
                        padding: "0 4px",
                        fontSize: 10,
                      }}
                    >
                      {TYPE_LABELS[e.type]}
                    </span>
                  </div>
                  {e.description && <div style={{ color: BB.dim }}>{e.description}</div>}
                  <div style={{ color: BB.dim, fontSize: 11 }}>
                    {[e.chapter && `Kapitel: ${e.chapter}`, e.characters.length > 0 && `Figuren: ${e.characters.join(", ")}`, e.location && `Ort: ${e.location}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button onClick={() => openEditForm(e)} aria-label={`Event ${e.title} bearbeiten`} style={{ ...bbButton, fontSize: 11, padding: "2px 8px" }}>
                      Bearbeiten
                    </button>
                    <button onClick={() => void handleDelete(e.id)} aria-label={`Event ${e.title} löschen`} style={{ ...bbButton, fontSize: 11, padding: "2px 8px", color: BB.red, borderColor: BB.red }}>
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* JSON-Export-Vorschau */}
          <details style={{ margin: 8 }} open={exported}>
            <summary style={{ color: BB.green, cursor: "pointer" }}>JSON-Vorschau</summary>
            <pre data-testid="timeline-json" style={{ background: "#000", border: `1px solid ${BB.border}`, padding: 8, overflowX: "auto", color: BB.green }}>
              {exportToJSON(active)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function LegacyPlotView({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  useEffect(() => {
    try {
      setEvents(listEvents(projectId));
    } catch {
      setEvents([]);
    }
    setSelected(null);
  }, [projectId]);

  const structure = buildPlotStructure(events);
  const stats = structureStats(events);

  const bands: TimelineBand[] = showJourney
    ? [
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

  if (!events.length) return null;

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

export function TimelinePanel({ projectId }: { projectId?: string }) {
  return (
    <div data-testid="timeline-panel">
      <PlotEngineUI />
      {projectId && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>
            Plot-Struktur (Projekt-Timeline)
          </summary>
          <LegacyPlotView projectId={projectId} />
        </details>
      )}
    </div>
  );
}
