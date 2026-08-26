// Settings-Service: lädt/speichert AppSettings in SQLite (key-value).
import { getDb, persist } from "@/services/db";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";

const KEY = "app_settings";

export function loadSettings(): AppSettings {
  const db = getDb();
  const row = db.exec("SELECT value FROM settings WHERE key = ?", [KEY]);
  if (row.length && row[0].values.length) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row[0].values[0][0] as string) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const db = getDb();
  db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [KEY, JSON.stringify(s)],
  );
  await persist();
}
