// Publishing-History: Verlauf aller KDP-Uploads/Exporte.
//
// Wird im SQLite-Key-Value-Store persistiert (analog zum Settings-Service).

import { getDb, persist } from "@/services/db";

const KEY = "publishing_history";

/** Ein Eintrag im Publishing-Verlauf. */
export interface PublishingHistoryEntry {
  /** Eindeutige ID (Timestamp-basiert). */
  id: string;
  /** Projekt-/Buchname. */
  projectTitle: string;
  /** Buchtitel laut Metadaten. */
  bookTitle: string;
  /** Zeitpunkt (ISO-8601). */
  publishedAt: string;
  /** Art des Uploads. */
  kind: "export" | "upload";
  /** Plattform (aktuell immer "kdp"). */
  platform: "kdp";
  /** Export-Ergebnis. */
  fileCount: number;
  totalSizeBytes: number;
  /** Metadaten-Snapshot (Checksumme/Zeichenzahl der Beschreibung, Keyword-Anzahl …). */
  metaSummary: {
    keywordCount: number;
    categoryCount: number;
    descriptionChars: number;
    hasCover: boolean;
  };
}

/** Lädt den gesamten Publishing-Verlauf (neueste zuerst). */
export function loadPublishingHistory(): PublishingHistoryEntry[] {
  try {
    const row = getDb().exec("SELECT value FROM settings WHERE key = ?", [KEY]);
    if (!row.length || !row[0].values.length) return [];
    const entries = JSON.parse(row[0].values[0][0] as string) as PublishingHistoryEntry[];
    return Array.isArray(entries)
      ? entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      : [];
  } catch {
    return [];
  }
}

/** Speichert den gesamten Verlauf. */
export async function savePublishingHistory(entries: PublishingHistoryEntry[]): Promise<void> {
  getDb().run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [KEY, JSON.stringify(entries)],
  );
  await persist();
}

/** Fügt einen Eintrag hinzu (neueste zuerst, max. 100 Einträge). */
export async function addPublishingEntry(
  entry: Omit<PublishingHistoryEntry, "id" | "publishedAt" | "platform">,
): Promise<PublishingHistoryEntry> {
  const full: PublishingHistoryEntry = {
    ...entry,
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    publishedAt: new Date().toISOString(),
    platform: "kdp",
  };
  const all = loadPublishingHistory();
  all.unshift(full);
  await savePublishingHistory(all.slice(0, 100));
  return full;
}

/** Löscht den kompletten Verlauf. */
export async function clearPublishingHistory(): Promise<void> {
  getDb().run("DELETE FROM settings WHERE key = ?", [KEY]);
  await persist();
}
