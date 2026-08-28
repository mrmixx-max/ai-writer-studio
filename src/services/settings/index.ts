// Settings-Service: lädt/speichert AppSettings in SQLite (key-value).
import { getDb, persist } from "@/services/db";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";
import { setPrivacyMode } from "@/services/security/privacy";

const KEY = "app_settings";
const AUTH_KEY = "security_auth";

export function loadSettings(): AppSettings {
  const db = getDb();
  const row = db.exec("SELECT value FROM settings WHERE key = ?", [KEY]);
  if (row.length && row[0].values.length) {
    try {
      const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(row[0].values[0][0] as string) };
      // Privatsphaere-Modus sofort aktivieren (vor jedem Netzwerkzugriff).
      setPrivacyMode(merged.privacyMode);
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  setPrivacyMode(DEFAULT_SETTINGS.privacyMode);
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const db = getDb();
  db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [KEY, JSON.stringify(s)],
  );
  setPrivacyMode(s.privacyMode);
  await persist();
}

// ---- App-Start-Schutz (PIN/Passwort) ----
// Gespeichert wird nur der PBKDF2-Verifikations-Hash (security_auth), nie das Passwort.

/** Liest den gespeicherten Auth-Record (null, wenn kein Schutz aktiv). */
export function loadAuthRecord(): import("@/services/security/auth").AuthRecord | null {
  const db = getDb();
  const row = db.exec("SELECT value FROM settings WHERE key = ?", [AUTH_KEY]);
  if (!row.length || !row[0].values.length) return null;
  try {
    return JSON.parse(row[0].values[0][0] as string);
  } catch {
    return null;
  }
}

export async function saveAuthRecord(
  record: import("@/services/security/auth").AuthRecord,
): Promise<void> {
  const db = getDb();
  db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [AUTH_KEY, JSON.stringify(record)],
  );
  await persist();
}

export async function clearAuthRecord(): Promise<void> {
  getDb().run("DELETE FROM settings WHERE key = ?", [AUTH_KEY]);
  await persist();
}
