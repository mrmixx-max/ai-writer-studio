// Tests: i18n Key-Parität de/en/es/fr (Sprint 9, Agent 5).
// Jeder Schlüssel muss in allen vier Locales existieren (keine Orphans),
// keine leeren Werte, und {{Platzhalter}} müssen mit de übereinstimmen.
import { describe, expect, it } from "vitest";
import { de, type TranslationKey } from "./locales/de";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { LANGUAGES } from "./index";

const LOCALES = { en, fr, es } as const;
type Lang = keyof typeof LOCALES;

const deKeys = Object.keys(de) as TranslationKey[];

function placeholders(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\{\{(\w+)\}\}/g)) out.add(m[1]);
  return out;
}

describe("i18n Parität: alle Locales decken alle de-Schlüssel ab", () => {
  for (const lang of Object.keys(LOCALES) as Lang[]) {
    it(`${lang} enthält jeden de-Schlüssel`, () => {
      const dict = LOCALES[lang] as Record<string, string>;
      const missing = deKeys.filter((k) => !(k in dict));
      expect(missing, `${lang} fehlt: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

describe("i18n Parität: keine Orphans, keine leeren Werte", () => {
  it("kein Locale hat Schlüssel, die in de fehlen", () => {
    for (const lang of Object.keys(LOCALES) as Lang[]) {
      const dict = LOCALES[lang] as Record<string, string>;
      const extra = Object.keys(dict).filter((k) => !(k in de));
      expect(extra, `${lang} überzählig: ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("alle Locales haben exakt so viele Schlüssel wie de", () => {
    for (const lang of Object.keys(LOCALES) as Lang[]) {
      expect(Object.keys(LOCALES[lang]).length).toBe(deKeys.length);
    }
  });

  it("kein Locale hat leere oder nicht-string Übersetzungen", () => {
    const all = { de, ...LOCALES } as Record<string, Record<string, unknown>>;
    for (const [lang, dict] of Object.entries(all)) {
      const bad = Object.entries(dict)
        .filter(([, v]) => typeof v !== "string" || (v as string).trim() === "")
        .map(([k]) => k);
      expect(bad, `${lang} leer: ${bad.join(", ")}`).toEqual([]);
    }
  });
});

describe("i18n KDP-Panels (Sprint 13, Agent 6): kdp.*-Namensraum", () => {
  const KDP_KEYS = deKeys.filter((k) => k.startsWith("kdp."));

  it("kdp.*-Namensraum existiert (Pre-Upload-Checkliste + Package-Panel)", () => {
    expect(KDP_KEYS.length).toBeGreaterThan(0);
    for (const prefix of ["kdp.preupload.", "kdp.package."]) {
      expect(
        KDP_KEYS.some((k) => k.startsWith(prefix)),
        `kein Schlüssel mit Präfix ${prefix}`,
      ).toBe(true);
    }
  });

  it("alle kdp.*-Schlüssel sind in en/fr/es übersetzt (kein deutsches Fallback nötig)", () => {
    // Identische Werte sind nur für diese sprachunabhängigen Schlüssel ok
    // (Produktname, technische Kürzel, Einheiten, en ≈ de bei "optional").
    const IDENTICAL_OK = new Set([
      "kdp.preupload.optional",
      "kdp.package.title",
      "kdp.package.col.sha",
      "kdp.package.sizeKb",
    ]);
    const bad: string[] = [];
    for (const lang of Object.keys(LOCALES) as Lang[]) {
      const dict = LOCALES[lang] as Record<string, string>;
      for (const key of KDP_KEYS) {
        if (!(key in dict)) bad.push(`${lang}:${key} fehlt`);
        else if (dict[key] === de[key] && !IDENTICAL_OK.has(key)) bad.push(`${lang}:${key} unübersetzt`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
describe("i18n Parität: Interpolation und Registrierung", () => {
  it("{{Platzhalter}} stimmen in allen Locales mit de überein", () => {
    const mismatches: string[] = [];
    for (const lang of Object.keys(LOCALES) as Lang[]) {
      const dict = LOCALES[lang] as Record<string, string>;
      for (const key of deKeys) {
        const want = [...placeholders(de[key])].sort().join(",");
        const got = [...placeholders(dict[key] ?? "")].sort().join(",");
        if (want !== got) mismatches.push(`${lang}:${key} (de:{${want}} vs ${lang}:{${got}})`);
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("LANGUAGES-Codes entsprechen genau den verfügbaren Dictionaries", () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(["de", "en", "es", "fr"]);
    expect(Object.keys(LOCALES).sort()).toEqual(["en", "es", "fr"]);
  });
});
