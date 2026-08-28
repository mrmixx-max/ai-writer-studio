// i18n-Kern: Provider, Kontext, t()-Funktion mit Interpolation.
//
// Verwendung in Komponenten:
//   const { t, lang, setLang } = useI18n();
//   <button aria-label={t("header.settings")}>{t("header.settings")}</button>
//
// Persistierung: localStorage("app-lang"), Fallback: Browsersprache.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de, type TranslationDict, type TranslationKey } from "./locales/de";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { es } from "./locales/es";

export type Lang = "de" | "en" | "fr" | "es";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

const DICTS: Record<Lang, TranslationDict> = { de, en, fr, es };

const STORAGE_KEY = "app-lang";

export function detectLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in DICTS) return saved as Lang;
  } catch {
    /* localStorage kann in Tauri-Kontexten fehlen — ignorieren. */
  }
  const nav =
    typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "de";
  return (nav in DICTS ? nav : "de") as Lang;
}

export type Interpolation = Record<string, string | number>;

export interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Interpolation) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Interpolation): string => {
      let text: string = DICTS[lang][key] ?? de[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.split(`{{${k}}}`).join(String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback ohne Provider: deutsche Texte, damit die App nie crasht.
    return {
      lang: "de",
      setLang: () => {},
      t: (key, vars) => {
        let text: string = de[key] ?? String(key);
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.split(`{{${k}}}`).join(String(v));
          }
        }
        return text;
      },
    };
  }
  return ctx;
}

export type { TranslationKey, TranslationDict };
