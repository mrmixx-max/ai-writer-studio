// Plot-Struktur: Zuordnung von Timeline-Ereignissen zu 3-Akt-Struktur und Heldenreise.
import type { TimelineEvent } from "./timeline";

export interface Act {
  id: "act1" | "act2" | "act3";
  label: string;
  description: string;
  /** Anteil der Ereignisse, die in diesen Akt fallen (nach Reihenfolge). */
  share: [number, number];
}

export const THREE_ACT_STRUCTURE: Act[] = [
  {
    id: "act1",
    label: "Akt I — Setup",
    description: "Welt, Held, Auslöser (Inciting Incident), Wendepunkt 1",
    share: [0, 0.25],
  },
  {
    id: "act2",
    label: "Akt II — Konfrontation",
    description: "Aufstieg, Midpoint, Krise, Wendepunkt 2",
    share: [0.25, 0.75],
  },
  {
    id: "act3",
    label: "Akt III — Auflösung",
    description: "Klimax, Fallender Ausgang, Auflösung",
    share: [0.75, 1],
  },
];

export interface JourneyStage {
  id: string;
  label: string;
  hint: string;
}

/** Die 12 Stufen der Heldenreise nach Campbell/Vogler. */
export const HERO_JOURNEY_STAGES: JourneyStage[] = [
  { id: "ordinary", label: "1. Gewohnte Welt", hint: "Der Held in seinem Alltag." },
  { id: "call", label: "2. Abenteuerruf", hint: "Der Ruf bricht in die gewohnte Welt." },
  { id: "refusal", label: "3. Verweigerung", hint: "Zögern, Angst, Widerstand." },
  { id: "mentor", label: "4. Mentor", hint: "Begegnung mit Weisheit oder Werkzeug." },
  { id: "threshold", label: "5. Schwelle überschreiten", hint: "Eintritt in die Sonderwelt." },
  { id: "trials", label: "6. Prüfungen", hint: "Verbündete, Feinde, Bewährungsproben." },
  { id: "belly", label: "7. In die Tiefe", hint: "Größte Nähe zum Ziel, größte Gefahr." },
  { id: "ordeal", label: "8. Prüfung (Ordeal)", hint: "Schwarzer Moment, Tod und Wiedergeburt." },
  { id: "reward", label: "9. Belohnung", hint: "Schwert, Erkenntnis, Versöhnung." },
  { id: "road", label: "10. Rückweg", hint: "Verfolgung, Konsequenzen." },
  { id: "resurrection", label: "11. Auferstehung", hint: "Letzte Prüfung, finale Verwandlung." },
  { id: "return", label: "12. Rückkehr mit Elixier", hint: "Heimkehr mit dem gewonnenen Elixier." },
];

export interface ActAssignment {
  eventId: string;
  eventTitle: string;
  act: Act["id"] | null;
  journeyStage: string | null;
}

/** Ordnet ein Ereignis anhand seiner Ordnungsposition einem Akt zu. */
export function assignAct(events: TimelineEvent[], event: TimelineEvent): Act["id"] | null {
  if (events.length === 0) return null;
  const pos = events.findIndex((e) => e.id === event.id);
  if (pos < 0) return null;
  const frac = events.length === 1 ? 0 : pos / (events.length - 1);
  for (const act of THREE_ACT_STRUCTURE) {
    if (frac >= act.share[0] && frac < act.share[1]) return act.id;
    // Letztes Ereignis gehört zu Akt III (share Obergrenze exklusiv).
    if (pos === events.length - 1 && act.id === "act3") return act.id;
  }
  return "act3";
}

/** LLM-freie Heuristik: schlägt Heldenreise-Stufen anhand Stichwörtern vor. */
export function suggestJourneyStage(event: TimelineEvent): string | null {
  const t = `${event.title} ${event.description}`.toLowerCase();
  const rules: [string, RegExp][] = [
    ["ordinary", /(alltag|gewohnt|dörf|stadt|arbeit|zuhause|normal)/],
    ["call", /(ruf|aufruf|brief|botschaft|brief|vision|schicksal|auslöser|inciting)/],
    ["refusal", /(zögern|angst|weiger|verweiger|habe bedenken|bleiben)/],
    ["mentor", /(mentor|lehrer|meister|rat|ratschlag|geschenk|karte|schwert erhält)/],
    ["threshold", /(aufbruch|verlassen|schwelle|reise beginnt|tor|portal|grenze)/],
    ["trials", /(prüfung|kampf|begegnung|feind|verbündeter|probe|geheimnis)/],
    ["belly", /(nähe|tiefe|kern|verlies|hafen|höhle|größte gefahr)/],
    ["ordeal", /(tod|sterbe|niederlage|verlust|dunkelste|verzweifl|zusammenbruch)/],
    ["reward", /(belohnung|beute|erkenntnis|versöhnung|siegreich|gewonnen|schwert)/],
    ["road", /(flucht|rückweg|verfolgt|heimreise|verfolgung|konsequenz)/],
    ["resurrection", /(aufersteh|letzte schlacht|finale|entscheidende schlacht|verwandlung)/],
    ["return", /(rückkehr|heimkehr|elixier|ankunft|neues leben)/],
  ];
  for (const [id, re] of rules) {
    if (re.test(t)) return id;
  }
  return null;
}

/** Vollständige Plot-Struktur-Zuordnung für alle Ereignisse. */
export function buildPlotStructure(events: TimelineEvent[]): ActAssignment[] {
  return events.map((e) => ({
    eventId: e.id,
    eventTitle: e.title,
    act: assignAct(events, e),
    journeyStage: suggestJourneyStage(e),
  }));
}

/** Kennzahlen zur dramatischen Struktur. */
export function structureStats(events: TimelineEvent[]): {
  total: number;
  perAct: Record<Act["id"], number>;
  journeyCoverage: number;
} {
  const structure = buildPlotStructure(events);
  const perAct: Record<Act["id"], number> = { act1: 0, act2: 0, act3: 0 };
  let journeyHits = 0;
  for (const s of structure) {
    if (s.act) perAct[s.act]++;
    if (s.journeyStage) journeyHits++;
  }
  return {
    total: events.length,
    perAct,
    journeyCoverage: events.length ? journeyHits / events.length : 0,
  };
}
