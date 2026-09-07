// BilingualSettings (Sprint 15, Agent 6): eigenständige Einstellungs-Sektion
// für zweisprachiges Schreiben (DE/EN).
//
// - Standard-Zielsprache (DE/EN-Dropdown)
// - Auto-Translate bei Kapitelabschluss (Toggle)
// - Formatierung erhalten (Toggle, Default: an)
// - Kapitel-spezifischer Sprach-Override (je Kapitel: Vererbt/DE/EN)
//
// Persistenz: nutzt das bestehende Settings-Store-Pattern (loadSettings /
// saveSettings aus @/services/settings, SQLite key-value). Die bilingualen
// Prefs leben als optionale `bilingual`-Erweiterung im gespeicherten
// AppSettings-Objekt und überstehen den Merge mit DEFAULT_SETTINGS —
// geteilte Typen/Services bleiben unverändert (additiv, abwärtskompatibel).
import { useMemo, useState } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/config";
import { loadSettings, saveSettings } from "@/services/settings";

/** Unterstützte Zielsprachen der Bilingual-Pipeline. */
export type BilingualTargetLanguage = "de" | "en";

/** Minimalinfo eines Kapitels für den Override-Editor. */
export interface BilingualChapterInfo {
  id: string;
  title: string;
}

/** Bilinguale Präferenzen (im Settings-Store unter `bilingual` abgelegt). */
export interface BilingualPrefs {
  /** Standard-Zielsprache für Übersetzungen. */
  defaultTargetLanguage: BilingualTargetLanguage;
  /** Bei true wird nach Kapitelabschluss automatisch übersetzt. */
  autoTranslateOnChapterComplete: boolean;
  /** Bei true bleibt Markup/Formatierung beim Übersetzen erhalten. */
  preserveFormatting: boolean;
  /** Kapitel-Overrides: nur abweichende Kapitel sind eingetragen. */
  chapterOverrides: Record<string, BilingualTargetLanguage>;
}

export const DEFAULT_BILINGUAL_PREFS: BilingualPrefs = {
  defaultTargetLanguage: "en",
  autoTranslateOnChapterComplete: false,
  preserveFormatting: true,
  chapterOverrides: {},
};

type SettingsWithBilingual = AppSettings & { bilingual?: Partial<BilingualPrefs> };

/** Liest die Bilingual-Prefs aus geladenen Settings (mit Defaults). */
export function getBilingualPrefs(s: AppSettings): BilingualPrefs {
  const b = (s as SettingsWithBilingual).bilingual ?? {};
  return {
    ...DEFAULT_BILINGUAL_PREFS,
    ...b,
    chapterOverrides: { ...(b.chapterOverrides ?? {}) },
  };
}

/** Serialisiert Prefs zurück in ein speicherbares Settings-Objekt. */
export function withBilingualPrefs(s: AppSettings, prefs: BilingualPrefs): AppSettings {
  return { ...s, bilingual: { ...prefs, chapterOverrides: { ...prefs.chapterOverrides } } } as AppSettings;
}

export interface BilingualSettingsProps {
  /** Kapitel für den Override-Editor (optional; Overrides ohne Kapitel bleiben editierbar). */
  chapters?: BilingualChapterInfo[];
}

function isTargetLanguage(v: string): v is BilingualTargetLanguage {
  return v === "de" || v === "en";
}

export function BilingualSettings({ chapters = [] }: BilingualSettingsProps) {
  const [base] = useState<AppSettings>(() => {
    try {
      return loadSettings();
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });
  const [initialPrefs] = useState<BilingualPrefs>(() => getBilingualPrefs(base));
  const [prefs, setPrefs] = useState<BilingualPrefs>(initialPrefs);
  const [newChapterId, setNewChapterId] = useState("");
  const [newChapterLang, setNewChapterLang] = useState<BilingualTargetLanguage>("en");

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(initialPrefs),
    [prefs, initialPrefs],
  );

  function save() {
    void saveSettings(withBilingualPrefs(base, prefs));
  }

  function discard() {
    setPrefs({ ...initialPrefs, chapterOverrides: { ...initialPrefs.chapterOverrides } });
  }

  function setOverride(chapterId: string, lang: BilingualTargetLanguage | "inherit") {
    setPrefs((prev) => {
      const chapterOverrides = { ...prev.chapterOverrides };
      if (lang === "inherit") delete chapterOverrides[chapterId];
      else chapterOverrides[chapterId] = lang;
      return { ...prev, chapterOverrides };
    });
  }

  function addOverride() {
    const id = newChapterId.trim();
    if (!id) return;
    setOverride(id, newChapterLang);
    setNewChapterId("");
  }

  // Alle Override-Zeilen: Kapitel-Prop ∪ bereits gespeicherte Overrides.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; title: string }> = [];
    for (const c of chapters) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    }
    for (const id of Object.keys(prefs.chapterOverrides)) {
      if (!seen.has(id)) {
        seen.add(id);
        list.push({ id, title: id });
      }
    }
    return list;
  }, [chapters, prefs.chapterOverrides]);

  return (
    <section className="bilingual-settings" aria-label="Bilinguale Einstellungen">
      <h3>Bilinguale Einstellungen</h3>

      <label>
        Standard-Zielsprache
        <select
          aria-label="Standard-Zielsprache"
          value={prefs.defaultTargetLanguage}
          onChange={(e) => {
            if (isTargetLanguage(e.target.value)) {
              setPrefs((prev) => ({ ...prev, defaultTargetLanguage: e.target.value as BilingualTargetLanguage }));
            }
          }}
        >
          <option value="de">Deutsch</option>
          <option value="en">Englisch</option>
        </select>
        <span className="settings-hint">Zielsprache für Kapitelübersetzungen, sofern kein Override greift.</span>
      </label>

      <label>
        <input
          type="checkbox"
          aria-label="Auto-Translate bei Kapitelabschluss"
          checked={prefs.autoTranslateOnChapterComplete}
          onChange={(e) => setPrefs((prev) => ({ ...prev, autoTranslateOnChapterComplete: e.target.checked }))}
        />{" "}
        Automatisch übersetzen, wenn ein Kapitel fertiggestellt wird
        <span className="settings-hint">Startet die Übersetzung direkt nach Kapitelabschluss.</span>
      </label>

      <label>
        <input
          type="checkbox"
          aria-label="Formatierung beim Übersetzen erhalten"
          checked={prefs.preserveFormatting}
          onChange={(e) => setPrefs((prev) => ({ ...prev, preserveFormatting: e.target.checked }))}
        />{" "}
        Formatierung beim Übersetzen erhalten
        <span className="settings-hint">Behält Markup und Struktur des Originals in der Übersetzung.</span>
      </label>

      <fieldset className="bilingual-overrides">
        <legend>Sprache je Kapitel</legend>
        {rows.length === 0 ? (
          <p className="settings-hint">Keine Kapitel vorhanden — Overrides können unten per ID hinzugefügt werden.</p>
        ) : (
          rows.map((row) => {
            const effective = prefs.chapterOverrides[row.id] ?? "inherit";
            return (
              <label key={row.id}>
                {row.title}
                <select
                  aria-label={`Zielsprache für ${row.title}`}
                  value={effective}
                  onChange={(e) =>
                    setOverride(row.id, e.target.value === "inherit" ? "inherit" : (e.target.value as BilingualTargetLanguage))
                  }
                >
                  <option value="inherit">Vererbt (Standard)</option>
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
              </label>
            );
          })
        )}
        <div className="bilingual-override-add">
          <input
            aria-label="Kapitel-ID für Override"
            placeholder="Kapitel-ID, z. B. ch-3"
            value={newChapterId}
            onChange={(e) => setNewChapterId(e.target.value)}
          />
          <select aria-label="Override-Sprache" value={newChapterLang} onChange={(e) => isTargetLanguage(e.target.value) && setNewChapterLang(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
          <button type="button" onClick={addOverride} disabled={!newChapterId.trim()}>
            Override hinzufügen
          </button>
        </div>
      </fieldset>

      <div className="settings-actions">
        <button type="button" className="save" onClick={save} disabled={!dirty}>
          Speichern{dirty ? " •" : ""}
        </button>
        <button type="button" onClick={discard} disabled={!dirty} title="Alle ungespeicherten Änderungen zurücksetzen">
          Änderungen verwerfen
        </button>
      </div>
    </section>
  );
}
