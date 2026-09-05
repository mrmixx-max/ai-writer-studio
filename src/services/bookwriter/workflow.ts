// Bookwriter: Workflow-Service.
//
// Führt die Phasen des Workflows aus. Jede Phase ist eine asynchrone
// Operation, die unterbrochen und fortgesetzt werden kann.

import { loadSettings } from "@/services/settings";
import { completeOnce } from "@/services/llm";
import { createChapter } from "@/services/project";
import { markdownToTipTap } from "@/services/editor/markdown";
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
  systemForGenre, getStyle,
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
import type { HitlGate } from "@/services/cli/hitl";

/** Ein Kapitel mit seinem Inhalt. */
export interface ChapterData {
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

/**
 * Optionale HITL-Hooks (Sprint 5): Human-in-the-Loop-Steuerung für die CLI.
 *
 * - shouldPause(gate): Pausiert der Lauf an diesem Haltepunkt? (false = kein
 *   HITL-Verhalten, bestehende Aufrufer unverändert).
 * - onGate(gate, runId, projectId, summary?): Interaktiver Haltepunkt —
 *   wirft bei 'rejected' (Lauf wird pausiert).
 * - applyInjects(prompt): Injiziert eingespeiste Redaktionsanweisungen in
 *   den nächsten Prompt (neutral, wenn keine vorhanden sind).
 *
 * Haltepunkte: outline (nach Gliederung), memory (Kontext-Block vor dem
 * Schreiben), revision (nach dem finalen Revisions-Loop).
 */
export interface HitlHooks {
  shouldPause(gate: HitlGate): boolean;
  onGate(gate: HitlGate, runId: string, projectId: string, summary?: string): Promise<void>;
  applyInjects(prompt: string): string;
}

/**
 * Führt einen Lauf von der aktuellen Phase aus. Mit `hitl` werden optionale
 * Haltepunkte (Outline, Memory-Base, finaler Revisions-Loop) durchlaufen.
 */
export async function runBookwriter(
  runId: string,
  projectName: string,
  onProgress?: (phase: BookwriterPhase, progress: number, label: string) => void,
  signal?: AbortSignal,
  hitl?: HitlHooks,
): Promise<void> {
  const run = loadRun(runId);
  if (!run || (run.status !== "active" && run.status !== "paused")) {
    throw new Error("Kein aktiver Lauf gefunden.");
  }

  const settings = loadSettings();
  const briefing = loadArtifact<BookBriefing>(runId, "briefing");
  if (!briefing) throw new Error("Kein Briefing gefunden.");

  const phases: BookwriterPhase[] = [
    "briefing", "konzept", "gliederung", "manuskript",
    "qualitaet", "ueberarbeitung", "metadaten", "export",
  ];

  const startIdx = phases.indexOf(run.currentPhase);

  for (let i = startIdx; i < phases.length; i++) {
    if (signal?.aborted) return;

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
          }, signal);
          break;

        case "gliederung":
          await generateGliederung(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          }, signal, hitl);
          break;

        case "manuskript":
          await generateManuskript(runId, run.projectId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          }, signal, hitl);
          break;

        case "qualitaet":
          await runQualitaet((p, label) => {
            onProgress?.(phase, p, label);
          }, signal);
          break;

        case "ueberarbeitung":
          await runUeberarbeitung((p, label) => {
            onProgress?.(phase, p, label);
          }, signal);
          break;

        case "metadaten":
          await generateMetadaten(runId, briefing, settings, (p, label) => {
            onProgress?.(phase, p, label);
          }, signal);
          break;

        case "export":
          await runExport(runId, projectName, (p, label) => {
            onProgress?.(phase, p, label);
          }, signal);
          break;
      }

      await setPhaseStatus(runId, phase, "done", 1);

      // --- HITL-Haltepunkt: outline (nach der Gliederung) ----------------
      if (phase === "gliederung" && hitl?.shouldPause("outline")) {
        const outline = loadArtifact<BookOutline>(runId, "gliederung");
        const summary = outline
          ? `Gliederung — ${outline.chapters.length} Kapitel, ${outline.totalWords} Wörter gesamt:\n` +
            outline.chapters.map((c, i) => `  ${i + 1}. ${c.title} (ca. ${c.estimatedWords ?? 0} Wörter)`).join("\n")
          : "Keine Gliederung gefunden.";
        try {
          await hitl.onGate("outline", runId, run.projectId, summary);
        } catch {
          if (signal?.aborted) return;
          await pauseRun(runId);
          onProgress?.(phase, 1, "Haltepunkt Outline abgelehnt — Lauf pausiert.");
          console.log("⏸ Haltepunkt 'outline' abgelehnt — Lauf pausiert (Fortsetzen über Job-Recovery).");
          return;
        }
      }

      // --- HITL-Haltepunkt: memory (Memory-Base vor dem Schreiben) -------
      if (phase === "manuskript" && hitl?.shouldPause("memory")) {
        const { buildContextBlock } = await import("./contextManager");
        const memoryBlock = buildContextBlock(run.projectId);
        const summary = memoryBlock
          ? `Memory-Base (verbindlicher Kontext):\n${memoryBlock}`
          : "Memory-Base ist leer (keine Fakten gespeichert).";
        try {
          await hitl.onGate("memory", runId, run.projectId, summary);
        } catch {
          if (signal?.aborted) return;
          await pauseRun(runId);
          onProgress?.(phase, 0, "Haltepunkt Memory abgelehnt — Lauf pausiert.");
          console.log("⏸ Haltepunkt 'memory' abgelehnt — Lauf pausiert (Fortsetzen über Job-Recovery).");
          return;
        }
      }

      // --- HITL-Haltepunkt: revision (nach dem finalen Revisions-Loop) ---
      if (phase === "ueberarbeitung" && hitl?.shouldPause("revision")) {
        try {
          await hitl.onGate(
            "revision", runId, run.projectId,
            "Finaler Revisions-Loop (Überarbeitung): Stil, Konsistenz und Lesbarkeit wurden geprüft. Freigabe vor Export?",
          );
        } catch {
          if (signal?.aborted) return;
          await pauseRun(runId);
          onProgress?.(phase, 1, "Haltepunkt Revision abgelehnt — Lauf pausiert.");
          console.log("⏸ Haltepunkt 'revision' abgelehnt — Lauf pausiert (Fortsetzen über Job-Recovery).");
          return;
        }
      }

      if (run.mode === "manual" && phase !== "export") {
        await pauseRun(runId);
        return;
      }
    } catch (e) {
      if (signal?.aborted) return;
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
  signal?: AbortSignal,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, getStyle(briefing.tone) ? briefing.tone : null);

  onProgress(0.1, "Titel werden generiert…");
  const titlesRaw = await completeOnce(
    settings,
    promptTitles(briefing),
    [{ role: "system", content: system }],
    signal,
  );
  const titles = titlesRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  onProgress(0.3, "Untertitel werden generiert…");
  const subtitlesRaw = await completeOnce(
    settings,
    promptSubtitles(titles[0] ?? "", briefing),
    [{ role: "system", content: system }],
    signal,
  );
  const subtitles = subtitlesRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  onProgress(0.5, "Positionierungen werden generiert…");
  const positionsRaw = await completeOnce(
    settings,
    promptPositioning(briefing),
    [{ role: "system", content: system }],
    signal,
  );
  const positions = positionsRaw.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 5);

  onProgress(0.7, "Klappentext wird generiert…");
  const blurb = await completeOnce(
    settings,
    promptBlurb(titles[0] ?? "", subtitles[0] ?? "", briefing, 0),
    [{ role: "system", content: system }],
    signal,
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
  signal?: AbortSignal,
  hitl?: HitlHooks,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, getStyle(briefing.tone) ? briefing.tone : null);

  onProgress(0.2, "Gliederung wird erstellt…");
  const raw = await completeOnce(
    settings,
    hitl ? hitl.applyInjects(promptOutline(briefing)) : promptOutline(briefing),
    [{ role: "system", content: system }],
    signal,
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
  projectId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
  signal?: AbortSignal,
  hitl?: HitlHooks,
): Promise<void> {
  const outline = loadArtifact<BookOutline>(runId, "gliederung");
  if (!outline) throw new Error("Keine Gliederung gefunden.");

  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, getStyle(briefing.tone) ? briefing.tone : null);
  const summaries: string[] = [];
  const chapters: ChapterData[] = [];

  for (let i = 0; i < outline.chapters.length; i++) {
    if (signal?.aborted) return;

    const ch = outline.chapters[i];
    onProgress(i / outline.chapters.length, `Kapitel ${i + 1} wird geschrieben…`);

    // Sprint 5 (HITL): Eingespeiste Redaktionsanweisungen des Publishers
    // als verbindlichen Block in den Kapitel-Prompt injizieren.
    const userPrompt = hitl
      ? hitl.applyInjects(promptWriteChapter(briefing, ch, {
          previousSummaries: summaries,
          researchNotes: [],
        }))
      : promptWriteChapter(briefing, ch, {
          previousSummaries: summaries,
          researchNotes: [],
        });

    const content = await completeOnce(
      settings,
      userPrompt,
      [{ role: "system", content: system }],
      signal,
    );

    const created = await createChapter(projectId, ch.title, markdownToTipTap(content));

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
      signal,
    );
    summaries.push(summary.trim());
  }

  await saveArtifact(runId, "manuskript", "chapters", chapters);
  onProgress(1, "Manuskript fertig.");
}

/** Qualitätsloop. */
async function runQualitaet(
  onProgress: (progress: number, label: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  onProgress(0.3, "Manuskriptprüfung wird ausgeführt…");
  if (signal?.aborted) return;
  // TODO: runDiagnostics aufrufen und Ergebnisse speichern.
  onProgress(1, "Qualitätsloop fertig.");
}

/** Buch-Level-Überarbeitung. */
async function runUeberarbeitung(
  onProgress: (progress: number, label: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  onProgress(0.5, "Gesamtkonsistenz wird geprüft…");
  if (signal?.aborted) return;
  // TODO: Buch-Level-Checks.
  onProgress(1, "Überarbeitung fertig.");
}

/** KDP-Metadaten generieren. */
async function generateMetadaten(
  runId: string,
  briefing: BookBriefing,
  settings: ReturnType<typeof loadSettings>,
  onProgress: (progress: number, label: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language, getStyle(briefing.tone) ? briefing.tone : null);

  onProgress(0.3, "Keywords werden generiert…");
  const keywordsRaw = await completeOnce(
    settings,
    promptKeywords("", briefing),
    [{ role: "system", content: system }],
    signal,
  );
  const keywords = keywordsRaw.split("\n").map((k) => k.trim()).filter(Boolean).slice(0, 7);

  onProgress(0.6, "Klappentexte werden generiert…");
  const blurbs: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) return;
    const blurb = await completeOnce(
      settings,
      promptBlurb("", "", briefing, i),
      [{ role: "system", content: system }],
      signal,
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
    coverImage: null,
  };
  await saveArtifact(runId, "metadaten", "metadata", metadata);
  onProgress(1, "Metadaten fertig.");
}

/** Export-Phase. */
async function runExport(
  runId: string,
  projectName: string,
  onProgress: (progress: number, label: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  onProgress(0.1, "Snapshot wird angelegt…");
  const run = loadRun(runId);
  if (!run) throw new Error("Lauf nicht gefunden.");

  await createSnapshot(run.projectId, projectName, "Vor Export", null, "before-export");
  if (signal?.aborted) return;

  // --- Metadaten laden ---
  onProgress(0.2, "Metadaten werden geladen…");
  const metadata = loadArtifact<KdpMetadata>(runId, "metadaten");
  if (!metadata) throw new Error("Keine KDP-Metadaten gefunden. Bitte zuerst Metadaten-Phase ausführen.");

  // --- Kapitel laden ---
  const chapters = loadArtifact<ChapterData[]>(runId, "manuskript");
  if (!chapters || chapters.length === 0) {
    throw new Error("Keine Kapitel gefunden. Bitte zuerst Manuskript-Phase ausführen.");
  }

  // --- Preflight ---
  onProgress(0.3, "Preflight wird ausgeführt…");
  const { runExportPreflight } = await import("@/services/preflight/runner");
  const formats: Array<"docx" | "pdf" | "epub"> = ["docx", "pdf", "epub"];

  for (const format of formats) {
    if (signal?.aborted) return;
    try {
      await runExportPreflight(run.projectId, projectName, format);
    } catch {
      // Preflight-Fehler nicht blockieren — Export geht trotzdem.
    }
  }

  // --- Cover in Metadaten einfügen ---
  onProgress(0.5, "Cover wird übernommen…");
  const coverImage = loadArtifact<string>(runId, "cover");
  if (coverImage) {
    metadata.coverImage = coverImage;
    await saveArtifact(runId, "metadaten", "metadata", metadata);
  }

  // --- KDP-Paket erstellen ---
  onProgress(0.6, "KDP-Export-Paket wird erstellt…");
  const { downloadKdpPackage } = await import("@/services/kdp/packaging");
  const result = await downloadKdpPackage(
    chapters,
    metadata,
    projectName,
    metadata.authorBio.split(" ")[0] || "Autor",
    (p, label) => onProgress(0.6 + p * 0.35, label),
  );

  if (signal?.aborted) return;
  onProgress(1, `Export fertig: ${result.files.length} Dateien im Ordner "${result.folderName}".`);
}
