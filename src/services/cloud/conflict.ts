// Konfliktloesung bei gleichzeitigen Aenderungen: Erkennung via ETag-Vergleich,
// zeilenweiser Merge ohne Ueberschneidung + strategiegesteuerte Aufloesung.
// Datei: src/services/cloud/conflict.ts
import type {
  ConflictResolution,
  SyncConflict,
  SyncPayload,
} from "./types";

/** Kapitel-Nummerierung neu ausrichten (orderIndex = Position im Array). */
function reindex(payload: SyncPayload): SyncPayload {
  const chapters = [...payload.chapters]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c, i) => ({ ...c, orderIndex: i }));
  return { ...payload, chapters };
}

/**
 * Zeilenweiser Merge zweier Kapitelinhalte: identische Zeilen werden
 * beibehalten, nicht ueberschneidende Aenderungen kombiniert. Nur wenn beide
 * Seiten dieselbe Zeile unterschiedlich geaendert haben, schlaegt der Merge
 * fehl (null) — dann muss der Nutzer manuell entscheiden.
 */
export function mergeChapterContent(
  local: string,
  remote: string,
  base: string,
): string | null {
  const L = local.split("\n");
  const R = remote.split("\n");
  const B = base.split("\n");
  const max = Math.max(L.length, R.length, B.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const l = L[i] ?? "";
    const r = R[i] ?? "";
    const b = B[i] ?? "";
    if (l === r) out.push(l); // beide gleich -> egal, was base war
    else if (l === b) out.push(r); // nur remote geaendert
    else if (r === b) out.push(l); // nur lokal geaendert
    else return null; // echter Zielkonflikt in derselben Zeile
  }
  return out.join("\n");
}

/** Kapitel zusammenfuehren: gleiche IDs mergen, neue Kapitel werden kombiniert. */
export function mergePayloads(
  local: SyncPayload,
  remote: SyncPayload,
): SyncPayload | null {
  // Basis schlaegt fehl, wenn beide das Projekt-Metadatum unterschiedlich geaendert haben.
  if (local.project.name !== remote.project.name) return null;

  const remoteById = new Map(remote.chapters.map((c) => [c.id, c]));
  const merged: SyncPayload["chapters"] = [];
  const seen = new Set<string>();

  for (const lc of local.chapters) {
    seen.add(lc.id);
    const rc = remoteById.get(lc.id);
    if (!rc) {
      merged.push(lc); // nur lokal vorhanden -> behalten
      continue;
    }
    if (lc.content === rc.content && lc.title === rc.title) {
      merged.push(lc.updatedAt >= rc.updatedAt ? lc : rc);
      continue;
    }
    if (lc.title !== rc.title) {
      // Titel-Konflikt: juengere Version gewinnt (kleinitaetiger Konflikt).
      merged.push(lc.updatedAt >= rc.updatedAt ? { ...lc } : { ...rc });
      continue;
    }
    const content = mergeChapterContent(lc.content, rc.content, lc.content);
    if (content === null) return null; // manueller Konflikt noetig
    merged.push({
      ...(lc.updatedAt >= rc.updatedAt ? lc : rc),
      content,
      updatedAt: Math.max(lc.updatedAt, rc.updatedAt),
    });
  }
  // Nur remote vorhandene Kapitel ergaenzen.
  for (const rc of remote.chapters) {
    if (!seen.has(rc.id)) merged.push(rc);
  }

  return reindex({
    project: { ...local.project, updatedAt: Math.max(local.project.updatedAt, remote.project.updatedAt) },
    chapters: merged,
    exportedAt: Date.now(),
    schemaVersion: local.schemaVersion,
  });
}

/**
 * Entscheidet anhand der Strategie, wie mit einem erkannten Konflikt
 * umgegangen wird. Liefert (ergebnis, aufgelosterPayload|null).
 * "manual" und fehlgeschlagener Merge geben den Konflikt unveraendert zurueck.
 */
export function resolveConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution,
): { conflict: SyncConflict; payload: SyncPayload | null } {
  switch (resolution) {
    case "local-wins":
      return {
        conflict: { ...conflict, status: "resolved", resolution, mergedPayload: conflict.localPayload },
        payload: conflict.localPayload,
      };
    case "remote-wins":
      return {
        conflict: { ...conflict, status: "resolved", resolution, mergedPayload: conflict.remotePayload },
        payload: conflict.remotePayload,
      };
    case "merged": {
      const merged = mergePayloads(conflict.localPayload, conflict.remotePayload);
      if (!merged) {
        return { conflict: { ...conflict, status: "open", resolution: "manual" }, payload: null };
      }
      return {
        conflict: { ...conflict, status: "resolved", resolution: "merged", mergedPayload: merged },
        payload: merged,
      };
    }
    case "manual":
    default:
      return { conflict: { ...conflict, status: "open", resolution: "manual" }, payload: null };
  }
}

/** Nutzungsregel: wenn remote aelter als lokale letzte Sync-Basis ist, kein Konflikt. */
export function isNewerLocally(conflict: SyncConflict): boolean {
  return conflict.localTime >= conflict.remoteTime;
}
