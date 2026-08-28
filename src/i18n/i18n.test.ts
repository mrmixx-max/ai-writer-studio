// Tests: i18n — Locale-Vollständigkeit (Parität de/en/fr/es), Kern-Helper.
// Datei: src/i18n/i18n.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { de, type TranslationKey } from "./locales/de";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { LANGUAGES, detectLanguage } from "./index";

const DICTS = { de, en, fr, es } as const;

describe("i18n Locales", () => {
  const deKeys = Object.keys(de) as TranslationKey[];

  it("de ist nicht leer und ohne Duplikat-Schlüssel", () => {
    expect(deKeys.length).toBeGreaterThan(10);
    expect(new Set(deKeys).size).toBe(deKeys.length);
  });

  for (const lang of ["en", "fr", "es"] as const) {
    it(`${lang} deckt alle de-Schlüssel ab`, () => {
      const dict = DICTS[lang] as Record<string, string>;
      const missing = deKeys.filter((k) => !(k in dict));
      expect(missing, `${lang} fehlt: ${missing.join(", ")}`).toEqual([]);
    });

    it(`${lang} hat keine Überzähl-Schlüssel`, () => {
      const dict = DICTS[lang] as Record<string, string>;
      const extra = Object.keys(dict).filter((k) => !(k in de));
      expect(extra, `${lang} überzählig: ${extra.join(", ")}`).toEqual([]);
    });

    it(`${lang} hat keine leeren Übersetzungen`, () => {
      const dict = DICTS[lang] as Record<string, string>;
      const empty = Object.entries(dict).filter(([, v]) => typeof v !== "string" || v.trim() === "");
      expect(empty.map(([k]) => k)).toEqual([]);
    });
  }
});

describe("i18n Kern", () => {
  it("LANGUAGES listet genau die vier unterstützten Sprachen", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["de", "en", "fr", "es"]);
    expect(LANGUAGES.every((l) => l.label.length > 0)).toBe(true);
  });

  it("detectLanguage: gespeicherte Sprache hat Vorrang", () => {
    localStorage.setItem("app-lang", "fr");
    expect(detectLanguage()).toBe("fr");
    localStorage.removeItem("app-lang");
  });

  it("detectLanguage: ungültiger Wert fällt auf eine gültige Standardsprache", () => {
    localStorage.setItem("app-lang", "xx");
    const lang = detectLanguage();
    expect(["de", "en", "fr", "es"]).toContain(lang);
    expect(lang).not.toBe("xx");
    localStorage.removeItem("app-lang");
  });
});
