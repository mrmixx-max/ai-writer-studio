// World-Bible Service: zentrale Welt-Info (Prämisse, Regeln, Geschichte).
import { getDb, persist } from "@/services/db";

export interface WorldRule {
  id: string;
  text: string;
  category: string; // z.B. "Magie", "Technologie", "Gesellschaft"
}

export interface HistoryEvent {
  id: string;
  year: string;
  title: string;
  description: string;
}

export interface WorldBible {
  id: string;
  projectId: string;
  name: string;
  premise: string;
  rules: WorldRule[];
  history: HistoryEvent[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const COLS = "id, project_id, name, premise, rules, history, notes, created_at, updated_at";

function rowToBible(v: unknown[]): WorldBible {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    name: (v[2] as string) || "",
    premise: (v[3] as string) || "",
    rules: JSON.parse((v[4] as string) || "[]"),
    history: JSON.parse((v[5] as string) || "[]"),
    notes: (v[6] as string) || "",
    createdAt: Number(v[7]),
    updatedAt: Number(v[8]),
  };
}

/** World-Bible eines Projekts laden (oder null). */
export function getWorldBible(projectId: string): WorldBible | null {
  const res = getDb().exec(
    `SELECT ${COLS} FROM world_bible WHERE project_id = ?`, [projectId],
  );
  return res.length ? rowToBible(res[0].values[0]) : null;
}

/** World-Bible anlegen, falls noch nicht vorhanden — liefert die bestehende/neue zurück. */
export function ensureWorldBible(projectId: string): WorldBible {
  const existing = getWorldBible(projectId);
  if (existing) return existing;
  const now = Date.now();
  const bible: WorldBible = {
    id: "bible_" + projectId, projectId, name: "", premise: "",
    rules: [], history: [], notes: "", createdAt: now, updatedAt: now,
  };
  getDb().exec(
    `INSERT OR REPLACE INTO world_bible (${COLS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [bible.id, bible.projectId, bible.name, bible.premise,
      JSON.stringify(bible.rules), JSON.stringify(bible.history),
      bible.notes, bible.createdAt, bible.updatedAt],
  );
  return bible;
}

/** World-Bible speichern (Teilfelder möglich). */
export async function saveWorldBible(
  projectId: string,
  patch: Partial<Omit<WorldBible, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<WorldBible> {
  const existing = ensureWorldBible(projectId);
  const record: WorldBible = { ...existing, ...patch, updatedAt: Date.now() };
  getDb().exec(
    `INSERT OR REPLACE INTO world_bible (${COLS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [record.id, record.projectId, record.name, record.premise,
      JSON.stringify(record.rules), JSON.stringify(record.history),
      record.notes, record.createdAt, record.updatedAt],
  );
  await persist();
  return record;
}

/** Regel hinzufügen. */
export async function addWorldRule(
  projectId: string, text: string, category = "Allgemein",
): Promise<WorldRule> {
  const bible = ensureWorldBible(projectId);
  const rule: WorldRule = {
    id: "rule_" + Math.random().toString(36).slice(2, 10),
    text: text.trim(), category,
  };
  return (await saveWorldBible(projectId, { rules: [...bible.rules, rule] })).rules
    .slice(-1)[0] as WorldRule;
}

/** Regel löschen. */
export async function deleteWorldRule(projectId: string, ruleId: string): Promise<void> {
  const bible = ensureWorldBible(projectId);
  await saveWorldBible(projectId, {
    rules: bible.rules.filter((r) => r.id !== ruleId),
  });
}

/** Geschichtsereignis hinzufügen. */
export async function addHistoryEvent(
  projectId: string, year: string, title: string, description = "",
): Promise<HistoryEvent> {
  const bible = ensureWorldBible(projectId);
  const ev: HistoryEvent = {
    id: "hist_" + Math.random().toString(36).slice(2, 10),
    year: year.trim(), title: title.trim(), description,
  };
  await saveWorldBible(projectId, { history: [...bible.history, ev] });
  return ev;
}

/** Geschichtsereignis löschen. */
export async function deleteHistoryEvent(projectId: string, eventId: string): Promise<void> {
  const bible = ensureWorldBible(projectId);
  await saveWorldBible(projectId, {
    history: bible.history.filter((e) => e.id !== eventId),
  });
}
