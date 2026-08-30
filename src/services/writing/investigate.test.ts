import { describe, it, expect } from "vitest";
import {
  generateArticle,
  generateXThread,
  buildTimeline,
  analyzeArticle,
  generateResearchPlan,
  type InvestigateInput,
  type ArticleResult,
} from "@/services/writing/investigate";

const sampleInput: InvestigateInput = {
  titel: "Datenleck bei Kommunal-IT",
  these: "Der Dienstleister hat Personaldaten offengelegt",
  artikelTyp: "investigation",
  zielmedium: "blog",
  sprache: "Deutsch",
  ton: "nüchtern",
  kernfakten: [
    "Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht",
    "Der Dienstleister war über das Problem informiert",
  ],
  quellen: [
    { type: "Dokument", label: "interner Bericht", glaubwürdigkeit: "hoch" },
    { type: "Interview", label: "Experte für IT-Sicherheit" },
  ],
  akteure: [
    { name: "Max Mustermann", rolle: "IT-Verantwortlicher", quelle: "Bericht" },
  ],
  ereignisse: [
    { datum: "2026-05-01", beschreibung: "Erste Meldung an die Leitung", quelle: "Internes Memo" },
    { datum: "2026-05-03", beschreibung: "Daten werden öffentlich zugänglich" },
  ],
  offeneFragen: [
    "Wie viele Personen sind betroffen?",
    "Gab es frühere Vorfälle?",
  ],
  rechtlicheSensibilität: true,
  maxLaenge: 3000,
  threadLaenge: 8,
  claims: ["Der Dienstleister wusste seit Monaten Bescheid"],
};

const sampleArticle: ArticleResult = {
  headline: "Recherche: Datenleck bei Kommunal-IT",
  teaser: "Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht [BELEGT: interner Bericht]",
  nutGraf: "Offene Fragen erfordern eine schnelle Klärung: Wie viele Personen sind betroffen?",
  article: `# Recherche: Datenleck bei Kommunal-IT

> Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht [BELEGT: interner Bericht]

**Warum das jetzt wichtig ist:** Offene Fragen erfordern eine schnelle Klärung: Wie viele Personen sind betroffen?

## Hauptteil

## Chronologie

2026-05-01: Erste Meldung an die Leitung [BELEGT: Internes Memo]

2026-05-03: Daten werden öffentlich zugänglich [UNBESTÄTIGT]

## Kernfakten

- Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht [BELEGT: interner Bericht]
- Der Dienstleister war über das Problem informiert [UNBESTÄTIGT]

## Beteiligte

- Max Mustermann (IT-Verantwortlicher) [BELEGT: Bericht]

## Ungeklärt

- Wie viele Personen sind betroffen? [UNBESTÄTIGT]
- Gab es frühere Vorfälle? [UNBESTÄTIGT]

> **Hinweis:** [EINSCHÄTZUNG] Dieser Artikel enthält potentiell rechtlich relevante Aussagen.

---
*Artikeltyp: investigation | Sprache: Deutsch | Ton: nüchtern*`,
  factTable: [
    { behauptung: "Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht", quelle: "interner Bericht", status: "belegt" },
    { behauptung: "Der Dienstleister war über das Problem informiert", quelle: "interner Bericht", status: "belegt" },
  ],
  timeline: [
    { datum: "2026-05-01", beschreibung: "Erste Meldung an die Leitung", quelle: "Internes Memo" },
    { datum: "2026-05-03", beschreibung: "Daten werden öffentlich zugänglich" },
  ],
  openQuestions: ["Wie viele Personen sind betroffen?", "Gab es frühere Vorfälle?"],
  warnings: ["Rechtliche Sensibilität: Tatsachenbehauptungen über Personen erfordern besondere Sorgfalt"],
  rationale: "Artikel basiert auf 2 Quellen und 2 Kernfakten. Typ: investigation.",
};

describe("investigate mode", () => {
  it("erzeugt Artikel-Grundstruktur aus Notizen", () => {
    const result = generateArticle({
      titel: "Datenleck bei Kommunal-IT",
      these: "",
      artikelTyp: "investigation",
      zielmedium: "blog",
      sprache: "Deutsch",
      ton: "nüchtern",
      kernfakten: ["Am 3. Mai 2026 wurden Personaldaten öffentlich zugänglich gemacht"],
      quellen: [{ type: "Dokument", label: "interner Bericht" }],
      akteure: [],
      ereignisse: [],
      offeneFragen: [],
      rechtlicheSensibilität: false,
      maxLaenge: 3000,
      threadLaenge: 8,
    });
    expect(result.headline.length).toBeGreaterThan(10);
    expect(result.article).toContain("[BELEGT]");
    expect(result.article).toContain("Warum das jetzt wichtig ist");
  });

  it("markiert unbelegte Behauptungen", () => {
    const result = generateArticle({
      titel: "Test",
      these: "",
      artikelTyp: "news-report",
      zielmedium: "blog",
      sprache: "Deutsch",
      ton: "nüchtern",
      kernfakten: [],
      quellen: [],
      akteure: [],
      ereignisse: [],
      offeneFragen: [],
      rechtlicheSensibilität: false,
      maxLaenge: 3000,
      threadLaenge: 8,
      claims: ["Der Dienstleister wusste seit Monaten Bescheid"],
    });
    expect(result.article).toContain("[UNBESTÄTIGT]");
  });

  it("erfindet keine Fakten: Lücken bleiben markiert", () => {
    const result = generateArticle({
      titel: "Test ohne Fakten",
      these: "Eine These ohne Quellen",
      artikelTyp: "news-report",
      zielmedium: "blog",
      sprache: "Deutsch",
      ton: "nüchtern",
      kernfakten: [],
      quellen: [],
      akteure: [],
      ereignisse: [],
      offeneFragen: [],
      rechtlicheSensibilität: false,
      maxLaenge: 3000,
      threadLaenge: 8,
    });
    // Keine erfundenen Fakten
    expect(result.factTable.length).toBe(0);
    expect(result.article).not.toContain("1970");
    expect(result.article).not.toContain("Millionen");
  });

  it("hält X-Thread-Posts unter 280 Zeichen", () => {
    const thread = generateXThread(sampleArticle, { posts: 8 });
    for (const post of thread.posts) {
      expect(post.text.length).toBeLessThanOrEqual(280);
    }
  });

  it("Thread-Post 1 funktioniert ohne Kontext (Hook)", () => {
    const thread = generateXThread(sampleArticle, { posts: 5 });
    expect(thread.posts.length).toBeGreaterThan(0);
    const firstPost = thread.posts[0].text;
    // Hook sollte Kernaussage enthalten (nicht "Lesen Sie weiter")
    expect(firstPost.length).toBeGreaterThan(20);
    expect(firstPost.length).toBeLessThanOrEqual(280);
  });

  it("Thread enthält keine Fakten, die nicht im Artikel stehen", () => {
    const threadResult = generateXThread(sampleArticle, { posts: 5 });
    // Der erste Post sollte aus dem Artikel stammen
    const articleTexts = sampleArticle.factTable.map((f) => f.behauptung);
    const hookFakt = articleTexts.some((f) => sampleArticle.article.includes(f));
    expect(hookFakt).toBe(true);
    expect(threadResult.posts.length).toBeGreaterThan(0);
  });

  it("factTable erkennt single-sourcing", () => {
    const warnings = analyzeArticle(sampleArticle);
    // Single-Sourcing erkannt (zwei Fakten, aber nur eine Quelle)
    expect(warnings.some((w) => w.code === "single-source")).toBe(true);
  });

  it("warnt bei rechtlich riskanter Tatsachenbehauptung", () => {
    const result = generateArticle(sampleInput);
    const warnings = analyzeArticle(result);
    expect(warnings.some((w) => w.code === "rechtlich" || w.code === "single-source")).toBe(true);
  });

  it("timeline sortiert Ereignisse chronologisch", () => {
    const timeline = buildTimeline(sampleInput);
    expect(timeline.length).toBe(2);
    expect(timeline[0].datum).toBe("2026-05-01");
    expect(timeline[1].datum).toBe("2026-05-03");
  });

  it("opinion-Typ wird gekennzeichnet", () => {
    const result = generateArticle({
      ...sampleInput,
      artikelTyp: "opinion",
    });
    expect(result.article).toContain("Meinung");
  });

  it("enthält keine KI-Floskeln", () => {
    const result = generateArticle(sampleInput);
    const floskeln = ["bahnbrechend", "schockierend", "Game-Changer", "revolutionär"];
    for (const floskel of floskeln) {
      expect(result.article.toLowerCase()).not.toContain(floskel.toLowerCase());
    }
  });

  it("generiert Hook-Alternativen", () => {
    const thread = generateXThread(sampleArticle, { posts: 5 });
    expect(thread.hookAlternatives.length).toBeGreaterThan(0);
    expect(thread.hookAlternatives.length).toBeLessThanOrEqual(3);
  });

  it("generiert Hashtags (max. 3)", () => {
    const thread = generateXThread(sampleArticle, { posts: 5 });
    expect(thread.hashtags.length).toBeLessThanOrEqual(3);
  });

  it("warnt bei Clickbait-Formulierungen", () => {
    const clickbaitsArticle: ArticleResult = {
      ...sampleArticle,
      article: sampleArticle.article + " SCHOCKIERENDE Enthüllung!",
    };
    const warnings = analyzeArticle(clickbaitsArticle);
    expect(warnings.some((w) => w.code === "clickbait")).toBe(true);
  });

  it("generiert Recherche-Plan", () => {
    const plan = generateResearchPlan(sampleInput);
    expect(plan.offeneFragen.length).toBe(2);
    expect(plan.benoetigteDokumente.length).toBe(3);
    expect(plan.moeglicheGespraechspartner.length).toBe(3);
    expect(plan.ifgAnfrage).toBeDefined();
  });

  it("schützt Datenverlust bei korruptem JSON", () => {
    const input: InvestigateInput = {
      ...sampleInput,
      kernfakten: ["Wichtiger Fakt ohne JSON-Struktur"],
      quellen: [],
      ereignisse: [],
      offeneFragen: [],
    };
    const result = generateArticle(input);
    expect(result.factTable.length).toBe(1);
    expect(result.article).toContain("Wichtiger Fakt");
  });
});
