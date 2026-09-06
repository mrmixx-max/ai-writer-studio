// Gemeinsamer Ollama-Mock für BookWriter-E2E-Specs (offline, 0 echte Calls).
//
// Die App spricht Ollama direkt aus dem Browser an (POST {base}/api/chat,
// NDJSON-Stream mit message.content pro Zeile). Dieser Mock antwortet mit
// einer gültigen 3-Kapitel-Gliederung (B4-Qualitätsgate-konform: exakte
// Kapitelanzahl, eindeutige Titel, Summaries ≥ 20 Wörter) und Kapiteltexten
// im B3-Fenster (800–1200 Wörter bei Default-Target 1000 ± 20 %).
//
// Outline vs. Kapitel wird am Prompt unterschieden:
//   - /gliederung/i  → Gliederung (Prompt: "Erstelle eine detaillierte Gliederung …")
//   - /Schreibe Kapitel (\d+)/ → Kapitel N (Prompt: "Schreibe Kapitel N von …")
import type { Page } from "@playwright/test";

export const MOCK_CHAPTER_COUNT = 3;

const SUMMARY_1 =
  "Ein junger Kartograf entdeckt eine Karte mit einem weißen Fleck, der in keinem Register verzeichnet ist und sein ruhiges Leben für immer verändert.";
const SUMMARY_2 =
  "Die Reise führt durch neblige Moore und vergessene Dörfer, wo alte Legenden lebendig werden und unerwartete Verbündete den Weg weisen.";
const SUMMARY_3 =
  "Am Ziel angekommen muss die Wahrheit über den weißen Fleck ans Licht gebracht werden, was alles bisher Geglaubte auf den Kopf stellt.";

export const MOCK_OUTLINE_JSON = JSON.stringify({
  title: "E2E-Testbuch: Der weiße Fleck",
  genre: "Fantasy",
  targetAudience: "Erwachsene",
  chapters: [
    { number: 1, title: "Die Karte ohne Namen", summary: SUMMARY_1 },
    { number: 2, title: "Nebel über dem Moor", summary: SUMMARY_2 },
    { number: 3, title: "Das Licht dahinter", summary: SUMMARY_3 },
  ],
});

const SENTENCES = [
  "Der Morgen legte einen grauen Schleier über die Dächer der Stadt, während unten bereits das geschäftige Treiben des Marktes einsetzte.",
  "Mara strich mit dem Finger über das Pergament und spürte, wie das alte Papier unter ihrer Berührung leise raschelte.",
  "Niemand hatte je gewagt, die Grenze des bekannten Landes zu überschreiten, doch die Neugier brannte heller als jede Vernunft.",
  "Der Wirt erzählte bei Kerzenlicht Geschichten von Reisenden, die nie zurückgekehrt waren und deren Namen längst vergessen sind.",
  "Mit jedem Schritt wurde der Pfad schmaler, bis schließlich nur noch ein kaum sichtbarer Wildwechsel durch das Unterholz führte.",
  "Sie packte Proviant, Kompass und das alte Fernrohr ihres Großvaters ein und verließ das Haus noch vor dem ersten Hahnenschrei.",
  "Der Wind trug den Geruch von Regen und fernem Rauch heran, und irgendwo in der Dunkelheit rief ein einsamer Nachtvogel.",
  "Alte Chroniken berichteten von einem Ort jenseits der Berge, wo die Zeit angeblich langsamer vergehen sollte als hier.",
  "Ihre Begleiter schwiegen, denn jeder von ihnen trug seine eigenen Zweifel und Hoffnungen still mit sich herum.",
  "Als die Sonne endlich durch die Wolken brach, offenbarte sich ein Tal von solcher Schönheit, dass allen der Atem stockte.",
  "Die Brücke über die Schlucht war morsch, doch es gab keinen anderen Weg, also gingen sie vorsichtig einen Schritt nach dem anderen.",
  "In der Herberge tauschten sie Neuigkeiten mit Händlern aus, die von fernen Küsten und fremden Sitten zu berichten wussten.",
];

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Baut Kapiteltext im B3-Fenster (Standard: ~900 Wörter, Absätze mit Leerzeile). */
export function buildChapterText(chapterNo: number, targetWords = 900): string {
  const paras: string[] = [];
  let words = 0;
  let i = 0;
  while (words < targetWords) {
    const body = [0, 1, 2, 3]
      .map((k) => SENTENCES[(i * 4 + k + chapterNo) % SENTENCES.length])
      .join(" ");
    const para = `Abschnitt ${i + 1} des ${chapterNo}. Kapitels. ${body}`;
    paras.push(para);
    words += countWords(para);
    i++;
  }
  return paras.join("\n\n");
}

/** Teilt Text in zwei NDJSON-Chunks (message.content), wie Ollama streamt. */
export function toNdjson(text: string): string {
  const mid = Math.floor(text.length / 2);
  const parts = [text.slice(0, mid), text.slice(mid)];
  return (
    parts.map((p) => JSON.stringify({ message: { content: p } })).join("\n") + "\n"
  );
}

export interface MockBookOptions {
  /** Die ersten N Outline-Calls scheitern mit HTTP 500 (Retry-/Fehlerpfade). */
  failOutlineAttempts?: number;
  /** Kapitelnummern, deren Calls dauerhaft mit HTTP 500 scheitern. */
  failChapters?: number[];
  /** Künstliche Latenz je /api/chat-Antwort (ms) — für Stop-/Resume-Timing. */
  delayMs?: number;
  /** Sammelt alle Prompt-Texte (Outline + Kapitel) zur Assertion (z. B. Stil/Ton). */
  capture?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mockt POST [base]/api/chat für ein Vollautomatik-Buch (3 Kapitel).
 * Muss VOR dem Klick auf "Buch generieren" installiert werden.
 */
export async function mockOllamaBookGeneration(
  page: Page,
  opts: MockBookOptions = {},
): Promise<{ outlineCalls: () => number }> {
  let outlineCalls = 0;
  await page.route("**/api/chat", async (route) => {
    let text: string;
    try {
      const data = route.request().postDataJSON() as {
        messages?: { content?: string }[];
      } | null;
      text = (data?.messages ?? []).map((m) => m.content ?? "").join("\n");
    } catch {
      text = "";
    }
    opts.capture?.push(text);

    // WICHTIG: Kapitel zuerst — der Kapitel-Prompt bettet den Outline-Kontext
    // ("Gliederung: …") ein und würde sonst als Outline fehlklassifiziert.
    const m = text.match(/schreibe kapitel\s+(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      if ((opts.failChapters ?? []).includes(n)) {
        await route.fulfill({ status: 500, body: `mock chapter ${n} failure` });
        return;
      }
      if (opts.delayMs) await sleep(opts.delayMs);
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: toNdjson(buildChapterText(n)),
      });
      return;
    }

    if (/gliederung/i.test(text)) {
      outlineCalls++;
      if (outlineCalls <= (opts.failOutlineAttempts ?? 0)) {
        await route.fulfill({ status: 500, body: "mock outline failure" });
        return;
      }
      if (opts.delayMs) await sleep(opts.delayMs);
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: toNdjson(MOCK_OUTLINE_JSON),
      });
      return;
    }

    // Nachsteuer-/Summary-/sonstige Calls: generischer Kapiteltext.
    if (opts.delayMs) await sleep(opts.delayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: toNdjson(buildChapterText(1)),
    });
  });
  return { outlineCalls: () => outlineCalls };
}
