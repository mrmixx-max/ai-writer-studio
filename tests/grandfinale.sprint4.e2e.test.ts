// AGENT 4 — Grand Finale E2E (Sprint 4): Der ultimative Stresstest.
//
// Szenario: komplettes Fachbuch (10 Kapitel) von A bis Z — mit Chaos-Monkey 2.0:
//   C1  Timeout bei Kapitel 3 → BookwriterRouter fällt auf Cloud um
//       (fallback_reason "retry_exhausted", provider "openrouter").
//   C2  RAG-Injektion einer Falschinformation vor Kapitel 5 → das Modell
//       übernimmt die Falschinfo in den Kapiteltext → der Konsistenz-Prüfer
//       schlägt an (attribute_conflict, severity error → needs_revision,
//       Befund-Status "revision_queued").
//   C3  Release-ZIP enthält alle Artefakte: DOCX (Scrivener-kompatible
//       Formatvorlagen + VBA-CustomXML), valides EPUB, VBA-.bas-Makro,
//       OPML (Scrivener-Outline), Metadata, Marketing, Report, Manifest.
//
// Kein echter Netzwerk-Call — Provider sind gemockt (CI-sicher).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());

// ---------------------------------------------------------------------------
// Chaos-Monkey 2.0 Fixtures (hoisted, damit Mock-Factories sie sehen).
// ---------------------------------------------------------------------------
const t = vi.hoisted(() => {
  /** Kapiteltext (deterministisch; widerspruchsfrei zur Fakten-Base). */
  const genericChapter = (n: number): string =>
    `Anna Weber ordnet das Thema mit einem klaren Blick. Kapitel ${n} trennt ` +
    `die Grundlage vom Beispiel und das Beispiel von der Bewertung. Jede ` +
    `Aussage hängt an einem prüfbaren Kriterium, damit der Leser den Schritt ` +
    `nachvollziehen kann. Die Untersuchung zeigt, wie Beobachtung, Modell und ` +
    `Kritik zusammenspielen. Am Ende steht eine Erkenntnis, die den Bogen zu ` +
    `den folgenden Kapiteln spannt und den roten Faden des Buches offen hält. ` +
    `Anna Weber betont, dass Ordnung kein Selbstzweck ist: Sie macht die ` +
    `Grundlage erst brauchbar. Wer den Aufbau verstanden hat, erkennt die ` +
    `Muster auch in fremden Beispielen und kann sie auf neue Fälle übertragen.`;

  /** Kapitel 5: das Modell spiegelt die injizierte Falschinfo (62 statt 34). */
  const chapter5FalseEcho =
    `Anna Weber eröffnet die Fallstudie mit einer knappen Skizze. Die ` +
    `Untersuchung begleitet die Projektarbeit von der Idee bis zur Bewertung. ` +
    `Anna Weber war zu diesem Zeitpunkt 62 Jahre alt, wie die Recherche zeigt. ` +
    `Die Beobachtungen werden in drei Schritten geordnet: Grundlage, Beispiel, ` +
    `Bewertung. Am Ende steht eine Erkenntnis, die den Bogen zu den folgenden ` +
    `Kapiteln spannt und den roten Faden des Buches offen hält. Wer die ` +
    `Fallstudie nachvollzieht, erkennt die Muster auch in eigenen Projekten.`;

  /** Die vom Chaos-Monkey injizierte Falschquelle (RAG-Dokument). */
  const falseDoc =
    `Recherche-Quelle Personenakte Kapitel 5: Die Fallstudie begleitet ` +
    `Anna Weber über das gesamte Projekt. Anna Weber war zum ` +
    `Untersuchungszeitpunkt 62 Jahre alt und leitete das Labor vor Ort. ` +
    `Die Quelle stammt aus dem Recherche-Verzeichnis der Projektmappe.`;

  /** Kapitel 3 aus der Cloud (Fallback-Antwort). */
  const cloudChapter3 =
    `Neuronale Netze verarbeiten Informationen in Schichten. Anna Weber ` +
    `vergleicht Aufbau, Training und Grenzen klassischer Netze und zeigt, wie ` +
    `Gewichte aus Daten gelernt werden. Jede Aussage hängt an einem prüfbaren ` +
    `Kriterium, damit der Leser den Schritt nachvollziehen kann. Am Ende steht ` +
    `eine klare Erkenntnis, die den Bogen zu den folgenden Kapiteln spannt und ` +
    `den roten Faden des Buches offen hält. Wer den Aufbau verstanden hat, ` +
    `erkennt die Muster auch in fremden Beispielen und überträgt sie auf neue ` +
    `Fälle, ohne die Grundlagen aus den Augen zu verlieren.`;

  return { genericChapter, chapter5FalseEcho, falseDoc, cloudChapter3 };
});

// --- C1: Lokaler Provider wirft bei Kapitel 3 hart einen Timeout -------------
vi.mock("@/services/llm/ollama", () => {
  class ChaosOllamaProvider {
    static attempts = 0;
    constructor(_baseUrl: string) {
      void _baseUrl;
    }
    async *chat(messages: Array<{ role: string; content: string }>) {
      ChaosOllamaProvider.attempts += 1;
      const prompt = messages.map((m) => m.content).join("\n");
      if (prompt.includes("Schreibe ein Kapitel") && prompt.includes("3. Neuronale Netze")) {
        throw new DOMException("Timeout nach 30000 ms", "TimeoutError");
      }
      yield "Chaos-Antwort: hätte nie im Buch landen dürfen.";
    }
    async healthCheck(): Promise<boolean> {
      return true;
    }
    async listModels(): Promise<string[]> {
      return ["chaos-local"];
    }
    describe(): string {
      return "ChaosOllamaProvider (Timeout bei Kapitel 3)";
    }
  }
  return { OllamaProvider: ChaosOllamaProvider };
});

// --- C1: Cloud-Provider ist gesund und übernimmt Kapitel 3 -------------------
vi.mock("@/services/llm/openrouter", () => {
  class CloudOpenRouterProvider {
    static calls: string[] = [];
    constructor(_apiKey?: string) {
      void _apiKey;
    }
    async *chat(messages: Array<{ role: string; content: string }>) {
      CloudOpenRouterProvider.calls.push(messages.map((m) => m.content).join("\n"));
      yield t.cloudChapter3;
    }
    async healthCheck(): Promise<boolean> {
      return true;
    }
    async listModels(): Promise<string[]> {
      return ["cloud-model"];
    }
    describe(): string {
      return "CloudOpenRouterProvider (Chaos-Fallback)";
    }
  }
  return { OpenRouterProvider: CloudOpenRouterProvider };
});

// --- Skriptbarer Provider für die restliche Generierung ----------------------
vi.mock("@/services/llm", () => {
  const makeProvider = () => ({
    chat: async function* (
      messages: Array<{ role: string; content: string }>,
      _opts?: unknown,
      signal?: AbortSignal,
    ) {
      const prompt = messages.map((m) => m.content).join("\n");
      let text: string;
      if (prompt.includes("Fasse das folgende Kapitel")) {
        text = "Kapitelzusammenfassung: zentrale Konzepte, ein Beispiel, eine klare Erkenntnis.";
      } else if (prompt.includes("Schreibe ein Kapitel") && prompt.includes("5. Fallstudie")) {
        text = t.chapter5FalseEcho;
      } else if (prompt.includes("Schreibe ein Kapitel")) {
        const m = prompt.match(/Kapitel (\d+)/);
        text = t.genericChapter(Number(m?.[1] ?? 0));
      } else {
        text = "Mock-Antwort.";
      }
      for (const chunk of text.match(/[\s\S]{1,256}/g) ?? []) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield chunk;
      }
    },
    async healthCheck() {
      return true;
    },
    async listModels() {
      return ["mock-model"];
    },
    describe() {
      return "ScriptedProvider (Grand Finale)";
    },
  });
  return {
    createProvider: makeProvider,
    buildMessages: (userContent: string, _s: unknown, history?: Array<{ role: string; content: string }>) => [
      ...(history ?? []),
      { role: "user" as const, content: userContent },
    ],
    completeOnce: async (
      settings: unknown,
      userContent: string,
      history?: Array<{ role: string; content: string }>,
    ) => {
      const provider = makeProvider();
      const msgs = [
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: userContent },
      ];
      let out = "";
      for await (const token of provider.chat(msgs, { model: (settings as { model?: string })?.model })) {
        out += token;
      }
      return out;
    },
  };
});

import initSqlJs from "sql.js";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter, getChapter } from "@/services/project";
import { startBookwriter } from "@/services/bookwriter/workflow";
import { saveArtifact, loadRun, completeRun } from "@/services/bookwriter/state";
import { upsertFacts } from "@/services/bookwriter/contextManager";
import { addDocument } from "@/services/bookwriter/documents";
import { generateChapter } from "@/services/bookwriter/chapter-gen";
import { runConsistencyCheck, listFindings } from "@/services/bookwriter/consistency";
import { buildReleasePackage } from "@/services/bookwriter/releasePackage";
import { buildAiwsBasFilename } from "@/services/bookwriter/export/vbaMacro";
import { promptWriteChapter } from "@/services/bookwriter/prompts";
import { BookwriterRouter } from "@/services/llm/router";
import { OllamaProvider } from "@/services/llm/ollama";
import { OpenRouterProvider } from "@/services/llm/openrouter";
import { classifyError } from "@/services/writing/retry";
import { markdownToTipTap } from "@/services/editor/markdown";
import { logger } from "@/services/logger";
import type { BookBriefing, BookOutline } from "@/types/bookwriter";

const OUT_DIR = path.resolve(__dirname, "../test-results/grand-finale");
const TITLE = "KI-Systeme verstehen";
const SAFE_TITLE = "KI-Systeme_verstehen"; // sanitize(): \s → _

const briefing: BookBriefing = {
  genre: "sachbuch",
  targetAudience: "Interessierte Laien",
  tone: "sachlich und zugänglich",
  chapterCount: 10,
  wordsPerChapter: 1500,
  idea: "Ein Fachbuch, das KI-Systeme von den Grundlagen bis zur Praxis erklärt.",
  uniqueAngle: "Verbindet Technik mit einer durchgängigen Fallstudie.",
  corePromise: "Der Leser versteht, wie KI-Systeme aufgebaut sind und wo ihre Grenzen liegen.",
  kdpTarget: "beides",
  language: "de",
  styleReferences: "",
  customOutline: null,
};

const CHAPTER_TITLES = [
  "Grundlagen der KI",
  "Maschinelles Lernen",
  "Neuronale Netze",
  "Deep Learning in der Praxis",
  "Fallstudie: Anna Weber",
  "Sprachmodelle",
  "Bilderkennung",
  "Ethik und Verantwortung",
  "Bewertung und Metriken",
  "Ausblick und Praxis",
];

function outline10(): BookOutline {
  return {
    chapters: CHAPTER_TITLES.map((title, i) => ({
      title: `${i + 1}. ${title}`,
      goal:
        i === 4
          ? "Anna Weber wird als Fallstudie durchleuchtet."
          : `Zentrale Fragen von Kapitel ${i + 1} beantworten.`,
      conflict: "Der Leser bringt fragwürdige Annahmen mit.",
      outcome: "Die Annahmen sind geprüft und korrigiert.",
      estimatedWords: 1500,
      pov: "sachlich",
      research: [],
      subchapters: [`Einstieg ${i + 1}`, `Vertiefung ${i + 1}`],
    })),
    totalWords: 15000,
  };
}

const SUMMARY =
  "Das Fachbuch erklärt KI-Systeme von den Grundlagen bis zur Praxis. Eine durchgängige Fallstudie verankert jedes Konzept. Der Leser kann Systeme bewerten, Grenzen benennen und Schritte ableiten.";

let projectId: string;

interface BookChapterResult {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  viaCloud: boolean;
}

const e2eLog: {
  startedAt: string;
  scenario: string;
  events: Array<{ ts: string; event: string; detail: string }>;
  summary: Record<string, unknown>;
} = {
  startedAt: "",
  scenario: "Sprint 4 Grand Finale — 10-Kapitel-Fachbuch mit Chaos-Monkey 2.0",
  events: [],
  summary: {},
};

function logEvent(event: string, detail: string): void {
  e2eLog.events.push({ ts: new Date().toISOString(), event, detail });
}

beforeEach(async () => {
  e2eLog.startedAt = new Date().toISOString();
  e2eLog.events = [];
  e2eLog.summary = {};
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as unknown as { __aws_db?: unknown }).__aws_db = db;
  const p = await createProject("Grand-Finale-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as unknown as { __aws_db?: unknown }).__aws_db;
  vi.restoreAllMocks();
});

describe("AGENT 4 — Grand Finale E2E (Sprint 4)", () => {
  it("C1+C2+C3: 10 Kapitel, Timeout-Fallback bei Kapitel 3, RAG-Injektion bei Kapitel 5, vollständiges Release-ZIP", async () => {
    // ------------------------------------------------------------------
    // Vorbereitung: verbindliche Fakten-Base (die "Wahrheit" des Buchs).
    // ------------------------------------------------------------------
    await upsertFacts(projectId, [
      { kind: "character", key: "Anna Weber", value: "KI-Ethikerin, 34 Jahre", confidence: 1 },
      { kind: "timeline", key: "Projektzeitraum", value: "Herbst 2026", confidence: 1 },
    ]);
    logEvent("facts_bound", "Anna Weber = KI-Ethikerin, 34 Jahre (verbindlich)");

    const runId = await startBookwriter(projectId, briefing, "auto");
    expect(runId).toBeTruthy();

    const outline = outline10();
    await saveArtifact(runId, "gliederung", "outline", outline);

    const chapters: BookChapterResult[] = [];
    const summaries: string[] = [];
    const routerMetas: Array<{
      provider: string;
      model: string;
      fallback_reason: string | null;
      task: string;
    }> = [];

    for (let i = 0; i < outline.chapters.length; i++) {
      const ch = outline.chapters[i];
      let content: string;

      if (i === 2) {
        // ------------------------------------------------------------
        // CHAOS 1 — Kapitel 3: lokaler Provider timeoutet hart.
        // Der BookwriterRouter muss auf die Cloud-Kette umschalten.
        // ------------------------------------------------------------
        const router = new BookwriterRouter({
          chain: [
            { provider: "ollama", baseUrl: "http://127.0.0.1:11434" },
            { provider: "openrouter", apiKey: "chaos-test-key" },
          ],
        });
        const prompt = promptWriteChapter(briefing, ch, {
          previousSummaries: summaries,
          researchNotes: [],
        });
        const result = await router.complete(
          "chapter",
          [
            { role: "system", content: "System" },
            { role: "user", content: prompt },
          ],
          { model: "llama3.2" },
        );
        content = result.text;
        routerMetas.push(result.meta);
        logEvent(
          "chaos_timeout_fallback",
          `Kapitel 3: provider=${result.meta.provider}, fallback_reason=${result.meta.fallback_reason}, lokale Versuche=${(OllamaProvider as unknown as { attempts: number }).attempts}`,
        );
      } else {
        if (i === 4) {
          // ----------------------------------------------------------
          // CHAOS 2 — Kapitel 5: Falschinformation in den RAG-Kontext
          // injizieren (BM25-Dokument), VOR der Generierung.
          // ------------------------------------------------------------
          const added = await addDocument({
            projectId,
            title: "Personenakte (CHAOS-INJEKTION)",
            fileType: "txt",
            fileName: "personenakte-chaos.txt",
            content: t.falseDoc,
          });
          expect(added.error).toBeNull();
          expect(added.chunks).toBeGreaterThan(0);
          logEvent("rag_injection", "Falschinfo in RAG-Kontext injiziert: Anna Weber 62 (statt 34) Jahre");
        }

        content = await generateChapter(briefing, ch, summaries, () => {}, undefined, projectId);
      }

      const created = await createChapter(projectId, ch.title, markdownToTipTap(content));
      const words = (content.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
      chapters.push({ id: created.id, title: ch.title, content, wordCount: words, viaCloud: i === 2 });
      summaries.push(`Kapitel ${i + 1} verankert die zentralen Konzepte mit prüfbaren Beispielen.`);

      // Crash-sicher committen (wie das Produktions-Panel).
      await saveArtifact(runId, "manuskript", "chapters", chapters);
    }

    // ------------------------------------------------------------------
    // AKZEPTANZ 1 — Buch vollständig: 10 Kapitel, alle mit Inhalt.
    // ------------------------------------------------------------------
    expect(chapters).toHaveLength(10);
    for (const c of chapters) {
      expect(c.id).toBeTruthy();
      expect(c.wordCount).toBeGreaterThan(40);
    }
    logEvent("book_generated", `10/10 Kapitel generiert (${chapters.reduce((s, c) => s + c.wordCount, 0)} Wörter)`);

    // ------------------------------------------------------------------
    // AKZEPTANZ 2a — Timeout-Fallback bei Kapitel 3 ist belegt.
    // ------------------------------------------------------------------
    expect((OllamaProvider as unknown as { attempts: number }).attempts).toBe(2); // 2 Retry-Endfehler
    expect((OpenRouterProvider as unknown as { calls: string[] }).calls).toHaveLength(1); // Cloud hat übernommen
    expect(routerMetas).toHaveLength(1);
    expect(routerMetas[0].provider).toBe("openrouter");
    expect(routerMetas[0].fallback_reason).toBe("retry_exhausted");
    expect(routerMetas[0].task).toBe("chapter");
    expect(chapters[2].content).toContain("Neuronale Netze");
    logEvent("fallback_verified", "Kapitel 3 via Cloud generiert (fallback_reason=retry_exhausted)");

    // ------------------------------------------------------------------
    // AKZEPTANZ 2b — RAG-Injektion erreichte das Kapitel UND der
    // Konsistenz-Prüfer schlägt bei Kapitel 5 an.
    // ------------------------------------------------------------------
    expect(chapters[4].content).toContain("62 Jahre alt");

    const consistency = await runConsistencyCheck(
      runId,
      projectId,
      chapters.map((c, index) => ({ index, title: c.title, content: c.content })),
      { queueRevision: true },
    );

    const errorFindings = consistency.findings.filter((f) => f.severity === "error");
    expect(errorFindings.map((f) => f.chapterIndex)).toEqual([4]); // nur Kapitel 5
    expect(
      errorFindings.some(
        (f) => f.type === "attribute_conflict" && f.found === "62" && (f.expected ?? "").startsWith("34"),
      ),
    ).toBe(true);
    expect(consistency.queuedForRevision).toContain(4);

    // Übergabe an den Revisions-Loop: Kapitel-Status + Befund-Status.
    const ch5Row = getChapter(chapters[4].id);
    expect(ch5Row?.status).toBe("needs_revision");
    const queuedFinding = listFindings(runId).find(
      (f) => f.chapterIndex === 4 && f.severity === "error",
    );
    expect(queuedFinding?.status).toBe("revision_queued");
    logEvent(
      "consistency_hit",
      "Kapitel 5: attribute_conflict (erwartet 34 Jahre, gefunden 62) → needs_revision, finding=revision_queued",
    );

    // ------------------------------------------------------------------
    // AKZEPTANZ 3 — Release-ZIP mit allen Artefakten + Log-Eintrag.
    // ------------------------------------------------------------------
    const infoSpy = vi.spyOn(logger, "info");
    const release = await buildReleasePackage({
      title: TITLE,
      author: "E2E Testautor",
      language: "de",
      year: 2026,
      summary: SUMMARY,
      genre: "sachbuch",
      targetAudience: "Erwachsene",
      chapters: chapters.map((c) => ({ title: c.title, content: markdownToTipTap(c.content) })),
      modelsUsed: [
        "local:llama3.2-mock (Kapitel 1-2, 4-10)",
        "cloud:openrouter-mock (Kapitel 3, Fallback)",
      ],
      productionStartedAt: e2eLog.startedAt,
      productionEndedAt: new Date().toISOString(),
    });
    expect(release.filename).toBe(`${SAFE_TITLE}-Release.zip`);

    // Log-Eintrag im zentralen Logger (buildReleasePackage).
    expect(
      infoSpy.mock.calls.some(
        ([msg, ctx]) => String(msg).includes("Release-Paket erstellt") && ctx === "buildReleasePackage",
      ),
    ).toBe(true);
    logEvent("release_logged", `logger.info: ${release.filename}, ${release.entries.length} Einträge`);

    // ZIP-Struktur:
    const zip = await JSZip.loadAsync(await release.blob.arrayBuffer());
    const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    const basPath = `manuscript/${buildAiwsBasFilename(TITLE)}`;
    expect(paths).toContain(`manuscript/${SAFE_TITLE}.docx`);
    expect(paths).toContain(`manuscript/${SAFE_TITLE}.epub`);
    expect(paths).toContain(basPath);
    expect(paths).toContain(`manuscript/${TITLE}.opml`); // exportBook-sanitize (kein \s-Mapping)
    expect(paths).toContain("metadata/book.json");
    expect(paths).toContain("metadata/kdp-keywords.json");
    expect(paths).toContain("metadata/blurbs.json");
    expect(paths).toContain("marketing/midjourney-prompts.json");
    expect(paths).toContain("marketing/social-teasers.md");
    expect(paths).toContain("project-report.md");
    expect(paths).toContain("manifest.json");

    // DOCX: Scrivener-kompatible Styles + VBA-Kanäle (Custom XML + Properties)
    const docx = await JSZip.loadAsync(await zip.file(`manuscript/${SAFE_TITLE}.docx`)!.async("uint8array"));
    const stylesXml = await docx.file("word/styles.xml")!.async("string");
    for (const styleId of ["Standard", "Einzug", "Heading1", "Heading2"]) {
      expect(stylesXml).toContain(`w:styleId="${styleId}"`);
    }
    const item = await docx.file("customXml/item1.xml")!.async("string");
    expect(item).toContain("urn:ai-writer-studio:ai-text-refinement");
    for (let i = 1; i <= 10; i++) expect(item).toContain(`index="${i}"`);
    const customProps = await docx.file("docProps/custom.xml")!.async("string");
    expect(customProps).toContain("AIWS_AISuite");
    expect(customProps).toContain("AIWS_ChapterCount");

    // EPUB: mimetype first + alle 10 Kapitel-XHTML + OPF
    const epub = await JSZip.loadAsync(await zip.file(`manuscript/${SAFE_TITLE}.epub`)!.async("uint8array"));
    expect(Object.keys(epub.files)[0]).toBe("mimetype");
    expect(await epub.file("mimetype")!.async("string")).toBe("application/epub+zip");
    for (let i = 1; i <= 10; i++) {
      expect(epub.file(`OEBPS/kapitel-${i}.xhtml`)).not.toBeNull();
    }
    const ncx = await epub.file("OEBPS/toc.ncx")!.async("string");
    expect(ncx).toContain("Kapitel 10: 10. Ausblick und Praxis");

    // VBA-Makro (.bas): valides Modul
    const bas = await zip.file(`manuscript/${buildAiwsBasFilename(TITLE)}`)!.async("string");
    expect(bas.startsWith('Attribute VB_Name = "AIWSTextRefinement"')).toBe(true);
    expect(bas).toContain("Option Explicit");
    expect(bas).toContain("Sub AIWS_RefineAll()");
    expect(bas).toContain("Private Const AIWS_CHAPTER_COUNT As Long = 10");

    // OPML: Scrivener-Outline mit allen Kapiteln
    const opmlText = await zip.file(`manuscript/${TITLE}.opml`)!.async("string");
    expect(opmlText.startsWith("<?xml")).toBe(true);
    expect(opmlText).toContain('<opml version="2.0">');
    expect(opmlText).toContain('_chapterNumber="10"');

    // Metadata + Marketing
    const book = JSON.parse(await zip.file("metadata/book.json")!.async("string"));
    expect(book.title).toBe(TITLE);
    expect(book.wordCount).toBeGreaterThan(0);
    expect(book.chapters).toHaveLength(10);
    const kw = JSON.parse(await zip.file("metadata/kdp-keywords.json")!.async("string"));
    expect(kw.keywords).toHaveLength(7);
    for (const k of kw.keywords) expect(k.length).toBeLessThanOrEqual(50);
    const blurbs = JSON.parse(await zip.file("metadata/blurbs.json")!.async("string"));
    expect(blurbs.shortBlurb.length).toBeGreaterThan(0);
    expect(blurbs.standardBlurb.length).toBeGreaterThan(0);
    expect(blurbs.amazonDescription.length).toBeGreaterThan(0);
    const mj = JSON.parse(await zip.file("marketing/midjourney-prompts.json")!.async("string"));
    expect(mj.length).toBeGreaterThanOrEqual(3);
    expect(mj.length).toBeLessThanOrEqual(5);
    const teasers = await zip.file("marketing/social-teasers.md")!.async("string");
    expect(teasers).toContain(TITLE);

    // Report + Manifest decken das Archiv vollständig ab
    const reportMd = await zip.file("project-report.md")!.async("string");
    expect(reportMd).toContain("Wörterzahl");
    expect(reportMd).toContain("Flesch");
    expect(reportMd).toContain("Produktionszeit");
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.entries.map((e: { path: string }) => e.path).sort()).toEqual([...paths].sort());
    logEvent("zip_verified", `ZIP vollständig: ${paths.length} Dateien (DOCX/EPUB/VBA/OPML/Metadata/Marketing/Report/Manifest)`);

    // ------------------------------------------------------------------
    // Ausgabe: Dateien + Log auf Platte (test-results/grand-finale).
    // ------------------------------------------------------------------
    mkdirSync(OUT_DIR, { recursive: true });
    const zipPath = path.join(OUT_DIR, release.filename);
    writeFileSync(zipPath, Buffer.from(await release.blob.arrayBuffer()));
    e2eLog.summary = {
      chaptersGenerated: chapters.length,
      totalWords: chapters.reduce((s, c) => s + c.wordCount, 0),
      chaos: {
        chapter3Timeout: true,
        fallbackProvider: routerMetas[0].provider,
        fallbackReason: routerMetas[0].fallback_reason,
        localAttempts: (OllamaProvider as unknown as { attempts: number }).attempts,
        cloudCalls: (OpenRouterProvider as unknown as { calls: string[] }).calls.length,
      },
      injection: {
        chapter: 5,
        falseInfo: "Anna Weber 62 Jahre (statt 34)",
        detectedType: "attribute_conflict",
        severity: "error",
        revisionQueued: true,
      },
      release: {
        filename: release.filename,
        entries: release.entries.length,
        bytes: release.blob.size,
        zipPath,
      },
      acceptance: {
        chaptersGenerated: chapters.length === 10,
        timeoutFallbackTriggered:
          routerMetas[0]?.provider === "openrouter" && routerMetas[0]?.fallback_reason === "retry_exhausted",
        injectionDetected: (queuedFinding?.status ?? "") === "revision_queued",
        zipComplete: paths.length === release.entries.length,
      },
    };
    const logPath = path.join(OUT_DIR, "grand-finale-log.json");
    writeFileSync(logPath, JSON.stringify(e2eLog, null, 2));

    const chaosReport = [
      "# Grand Finale E2E — Chaos-Monkey 2.0 (Sprint 4, Agent 4)",
      "",
      `Szenario: ${e2eLog.scenario}`,
      `Start: ${e2eLog.startedAt}`,
      "",
      "## Akzeptanzkriterien",
      "",
      "- [x] 10/10 Kapitel vollständig generiert",
      "- [x] Timeout bei Kapitel 3 → Fallback auf Cloud (retry_exhausted → openrouter)",
      "- [x] RAG-Injektion bei Kapitel 5 vom Konsistenz-Prüfer erkannt (attribute_conflict, error)",
      "- [x] Release-ZIP enthält DOCX, EPUB, VBA-.bas, OPML, Metadata, Marketing, Report, Manifest",
      "",
      "## Ereignis-Log",
      "",
      ...e2eLog.events.map((e) => `- \`${e.ts}\` **${e.event}** — ${e.detail}`),
      "",
      "---",
      "",
      `Erstellt von AI Writer Studio v1.2.0 · ${new Date().toISOString()}`,
      "",
    ].join("\n");
    const reportPath = path.join(OUT_DIR, "chaos-monkey-report.md");
    writeFileSync(reportPath, chaosReport, "utf-8");

    expect(existsSync(zipPath)).toBe(true);
    expect(readFileSync(zipPath).byteLength).toBeGreaterThan(10000);
    expect(existsSync(logPath)).toBe(true);
    expect(JSON.parse(readFileSync(logPath, "utf-8")).events.length).toBeGreaterThanOrEqual(5);
    expect(existsSync(reportPath)).toBe(true);

    // ------------------------------------------------------------------
    // Lauf sauber abschließen (von A bis Z).
    // ------------------------------------------------------------------
    await completeRun(runId);
    const run = loadRun(runId);
    expect(run?.status).toBe("completed");
  });

  it("Chaos-Vertrag: TimeoutError ist retrybar, Abort und 4xx nicht", () => {
    expect(classifyError(new DOMException("Timeout", "TimeoutError"))).toBe("timeout");
    expect(classifyError(new DOMException("Aborted", "AbortError"))).toBe("abort");
    expect(classifyError(new Error("Provider HTTP 402. Payment required"))).toBe("http4xx");
  });
});
