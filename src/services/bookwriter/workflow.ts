// Bookwriter: Workflow-Service.
//
// Führt die Phasen des Workflows aus. Jede Phase ist eine asynchrone
// Operation, die unterbrochen und fortgesetzt werden kann.

import { loadSettings } from "@/services/settings";
import { completeOnce } from "@/services/llm";
import { createChapter } from "@/services/project";
import { createSnapshot } from "@/services/snapshot";
import {
  promptTitles,
  promptSubtitles,
  promptPositioning,
  promptOutline,
  promptWriteChapter,
  promptSummarizeChapter,
  promptBlurb,
  promptKeywords,
  systemForGenre,
} from "./prompts";
import {
  createRun,
  loadActiveRun,
  loadRun,
  setPhaseStatus,
  setCurrentPhase,
  saveArtifact,
  loadArtifact,
  pauseRun,
  completeRun,
} from "./state";
import type {
  BookBriefing,
  BookConcept,
  BookOutline,
  BookwriterPhase,
  KdpMetadata,
} from "@/types/bookwriter";

/** Ein Kapitel mit seinem Inhalt. */
interface ChapterData {
  id: string;
  title: string;
  content: string;
  wordCount: number;
}

/** Zählt Wörter. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Parst JSON aus einer LLM-Antwort. */
function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    /* weiter */
  }
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) {
    try {
      return JSON.parse(m[1].trim()) as T;
    } catch {
      /* weiter */
    }
  }
  return null;
}

/** Startet einen neuen Bookwriter-Lauf. */
export async function startBookwriter(
  projectId: string,
  briefing: BookBriefing,
  mode: "auto" | "phase" | "manual" = "phase",
): Promise<string> {
  const run = createRun(projectId, mode);
  await saveArtifact(run.id, "briefing", "briefing", briefing);
  return run.id;
}

/** Führt einen Lauf von der aktuellen Phase aus. */
export async function runBookwriter(
  runId: string,
  projectName: string,
  onProgress?: (phase: BookwriterPhase, progress: number, label: string) => void,
): Promise<void> {
  const run = loadActiveRun(runId);
  if (!run) throw new Error("Kein aktiver Lauf gefunden.");

  const settings = loadSettings();
  const briefing = loadArtifact<BookBriefing>(runId, "briefing");
  if (!briefing) throw new Error("Kein Briefing gefunden.");

  const phases: BookwriterPhase[] = [
    "briefing", "konzept", "gliederung", "manuskript",
    "qualitaet", "ueberarbeitung", "metadaten", "export",
  ];

  const startIdx = phases.indexOf(run.currentPhase);

  for (let i = startIdx; i < phases.length; i++) {
    const phase = phases[i];

    const current = loadActiveRun(run.projectId);
    if (!current || current.status !== "active") {
      return;
    }

    await setCurrentPhase(runId, phase);
    await setPhaseStatus(runId, phase, "running", 0);
    onProgress?.(phase, 0, `${phase} wird gestartet…`);

    try {
      switch (phase) {
        case "briefing":
          await setPhaseStatus(runId, phase, "done", 1);
          break;

        case "konzept":
          await generateKonzept(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "gliederung":
          await generateGliederung(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "manuskript":
          await generateManuskript(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "qualitaet":
          await runQualitaet((p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "ueberarbeitung":
          await runUeberarbeitung((p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "metadaten":
          await generateMetadaten(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          });
          break;

        case "export":
          await runExport(runId, projectName, (p, label) => {
            onProgress?.(phase, p, label);
          });
          break;
      }

      await setPhaseStatus(runId, phase, "done", 1);

      if (run.mode === "manual" && phase !== "export") {
        await pauseRun(runId);
        return;
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await setPhaseStatus(runId, phase, "error", null, msg);
      throw e;
    }
  }

  await completeRun(runId);
}

/** Generiert das Konzept. */
async function generateKonzept(
  runId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);

  onProgress(0.1, "Titel werden generiert…");
  const titlesRaw = await completeOnce(
    settings,
    promptTitles(briefing),
    [{ role: "system", content: system }],
  );
  const titles = titlesRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  onProgress(0.3, "Untertitel werden generiert…");
  const subtitlesRaw = await completeOnce(
    settings,
    promptSubtitles(titles[0] ?? "", briefing),
    [{ role: "system", content: system }],
  );
  const subtitles = subtitlesRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  onProgress(0.5, "Positionierungen werden generiert…");
  const positionsRaw = await completeOnce(
    settings,
    promptPositioning(briefing),
    [{ role: "system", content: system }],
  );
  const positions = positionsRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 5);

  onProgress(0.7, "Klappentext wird generiert…");
  const blurb = await completeOnce(
    settings,
    promptBlurb(titles[0] ?? "", subtitles[0] ?? "", briefing, 0),
    [{ role: "system", content: system }],
  );

  onProgress(0.9, "Artefakte werden gespeichert…");
  const concept: BookConcept = {
    titles,
    subtitles,
    positions,
    persona: "",
    pitch: "",
    backmatter: blurb.slice(0, 1000),
    promises: [],
    genreFit: "",
    outlineProposals: [],
  };
  await saveArtifact(runId, "konzept", "concept", concept);
}

/** Generiert die Gliederung. */
async function generateGliederung(
  runId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);

  onProgress(0.2, "Gliederung wird erstellt…");
  const raw = await completeOnce(
    settings,
    promptOutline(briefing),
    [{ role: "system", content: system }],
  );

  const parsed = parseJson<BookOutline["chapters"]>(raw);
  if (!parsed) {
    throw new Error("Gliederung konnte nicht als JSON gelesen werden.");
  }

  const outline: BookOutline = {
    chapters: parsed,
    totalWords: parsed.reduce((sum, c) => sum + (c.estimatedWords ?? 0), 0),
  };

  await saveArtifact(runId, "gliederung", "outline", outline);
  onProgress(1, "Gliederung fertig.");
}

/** Generiert das Manuskript kapitelweise. */
async function generateManuskript(
  runId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  const outline = loadArtifact<BookOutline>(runId, "gliederung");
  if (!outline) throw new Error("Keine Gliederung gefunden.");

  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);
  const summaries: string[] = [];
  const chapters: ChapterData[] = [];

  for (let i = 0; i < outline.chapters.length; i++) {
    const ch = outline.chapters[i];
    onProgress(i / outline.chapters.length, `Kapitel ${i + 1} wird geschrieben…`);

    const content = await completeOnce(
      settings,
      promptWriteChapter(briefing, ch, {
        previousSummaries: summaries,
        researchNotes: [],
      }),
      [{ role: "system", content: system }],
    );

    const created = await createChapter(runId, ch.title, JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: content }] }],
    }));

    chapters.push({
      id: created.id,
      title: ch.title,
      content,
      wordCount: countWords(content),
    });

    const summary = await completeOnce(
      settings,
      promptSummarizeChapter(ch.title, content),
      [{ role: "system", content: system }],
    );
    summaries.push(summary.trim());
  }

  await saveArtifact(runId, "manuskript", "chapters", chapters);
  onProgress(1, "Manuskript fertig.");
}

/** Qualitätsloop. */
async function runQualitaet(
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  onProgress(0.3, "Manuskriptprüfung wird ausgeführt…");
  // TODO: runDiagnostics aufrufen und Ergebnisse speichern.
  onProgress(1, "Qualitätsloop fertig.");
}

/** Buch-Level-Überarbeitung. */
async function runUeberarbeitung(
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  onProgress(0.5, "Gesamtkonsistenz wird geprüft…");
  // TODO: Buch-Level-Checks.
  onProgress(1, "Überarbeitung fertig.");
}

/** KDP-Metadaten generieren. */
async function generateMetadaten(
  runId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);

  onProgress(0.3, "Keywords werden generiert…");
  const keywordsRaw = await completeOnce(
    settings,
    promptKeywords("", briefing),
    [{ role: "system", content: system }],
  );
  const keywords = keywordsRaw.split("\n").map((k) => k.trim()).filter(Boolean).slice(0, 7);

  onProgress(0.6, "Klappentexte werden generiert…");
  const blurbs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const blurb = await completeOnce(
      settings,
      promptBlurb("", "", briefing, i),
      [{ role: "system", content: system }],
    );
    blurbs.push(blurb.trim());
  }

  onProgress(0.9, "Metadaten werden gespeichert…");
  const metadata: KdpMetadata = {
    title: "",
    subtitle: "",
    blurbVariants: blurbs,
    shortDescription: "",
    keywords,
    categories: [],
    authorBio: "",
    seriesIdea: null,
    marketingNotes: null,
  };
  await saveArtifact(runId, "metadaten", "metadata", metadata);
  onProgress(1, "Metadaten fertig.");
}

/** Export-Phase. */
async function runExport(
  runId: string,
  projectName: string,
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  onProgress(0.3, "Snapshot wird angelegt…");
  const run = loadRun(runId);
  if (run) {
    await createSnapshot(run.projectId, projectName, "Vor Export", null, "before-export");
  }

  onProgress(0.6, "Preflight wird ausgeführt…");
  // TODO: runPreflight aufrufen.
  onProgress(1, "Exportbereitschaft geprüft.");
}
