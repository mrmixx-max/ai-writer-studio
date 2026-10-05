/**
 * Tool-Adapter für das Werkzeuge-Panel.
 *
 * Bündelt alle 52 Services aus Meilenstein 5–17 hinter einer einheitlichen
 * Schnittstelle `(input: string) => string | Promise<string>`, damit das
 * WerkzeugePanel sie generisch rendern kann.
 *
 * Rein lokal & deterministisch — kein LLM, kein Netzwerk.
 */

import {
  generateReaderHtml,
  parseFeedbackFile,
} from "@/services/collaboration/betaFeedback";
import {
  createP2PSession,
  addPeer,
  getPeers,
  isWebRTCSupported,
} from "@/services/collaboration/p2pSync";
import {
  exportToIcml,
  exportToFountain,
} from "@/services/exporters/publisherExchange";
import {
  analyzeStyleFingerprint,
  findOverusedPhrases,
} from "@/services/analytics/styleFingerprint";
import {
  calculateTravelTime,
  checkTravelFeasibility,
} from "@/services/spatiotemporal/mapService";
import {
  createBranchingStory,
  addScene,
  exportToTwine,
  exportToInk,
} from "@/services/branching/branchingEngine";
import {
  createCustomAssistant,
  buildPromptChain,
  estimateTokens,
  estimateCost,
} from "@/services/ai/promptWorkflow";
import {
  applyBionicReading,
  getAccessibilitySettings,
} from "@/services/typography/bionicReading";
import {
  generateChapterMarkers,
  cutSampleSnippet,
} from "@/services/audio/audiobookMaster";
import {
  splitSentences,
  alignDualText,
  checkGlossaryCompliance,
} from "@/services/translation/literaryTranslation";
import { generateVisibleWatermark } from "@/services/publishing/socialDrm";
import {
  calculatePublisherAdvance,
  calculateKdpEarnings,
  calculateBreakEven,
} from "@/services/finance/royaltyCalculator";
import {
  parseAudioCues,
  buildMultiTrackTimeline,
  calculateMixdown,
} from "@/services/audio/audioDramaStudio";
import {
  detectWidowsAndOrphans,
  applyHangingPunctuation,
  insertNonBreakingSpaces,
} from "@/services/typography/microTypography";
import {
  createMapLayer,
  applyMapStyle,
  exportToSvg,
} from "@/services/cartography/mapBuilder";
import {
  getDistributorProfile,
  checkCompliance,
  generateOnixMetadata,
} from "@/services/publishing/distributionPipeline";
import {
  extractStyleDNA,
  analyzeSentenceRhythm,
} from "@/services/ai/stylisticTwin";
import {
  buildKnowledgeMatrix,
  auditChronology,
  trackLooseEnds,
} from "@/services/analytics/plotForensics";
import {
  generateSensoryCompass,
  extractColorPalette,
  generateMoodboard,
} from "@/services/visual/sensoryStudio";
import { verifyIntegrity } from "@/services/storage/disasterVault";
import {
  runMasterHealthScan,
  calculateReadinessScore,
  generateTodoList,
} from "@/services/analytics/manuscriptHealth";
import {
  detectNeglectedSubplots,
  checkKlimaxSync,
} from "@/services/dramaturgy/subplotWeaver";
import {
  generateNormPage,
  countNormPages,
  generateExposé,
} from "@/services/exporters/pitchDeckStudio";
import {
  calculateOptimalContext,
  benchmarkTokensPerSecond,
  optimizePrompt,
  getOfflineFallback,
} from "@/services/ai/engineTurbo";
// Reachability-Pass (v4.3.0): Services, die bisher nur von ihren eigenen Tests
// importiert wurden — ohne Nicht-Test-Importer tree-shaked Vite sie aus dem
// Installer. Jeder Adapter hier macht einen davon aus der UI erreichbar.
import { checkExportGuard } from "@/services/editor/exportGuard";
import {
  generateBlurb,
  analyzeKdpKeywords,
  generateQuoteCard,
} from "@/services/marketing/blurbStudio";
import {
  createSeriesEntity,
  checkSpoilerGuard,
  getAllEntities,
} from "@/services/series/seriesBible";
import {
  createCodexEntry,
  searchCodex,
  getBacklinks,
} from "@/services/research/codexService";
import {
  createMicroSnapshot,
  diffMicroSnapshots,
  listMicroSnapshots,
} from "@/services/snapshot/timeMachine";
import {
  recordSprint,
  getTodayStats,
  SPRINT_PRESETS,
} from "@/services/sprint/sprint";
import {
  computeContentHash,
  normalizeToolMetrics,
  diffMetrics,
} from "@/services/storage/toolHistoryService";
import { generateSecurityAuditReport } from "@/services/security/securityAudit";
import { toPlainText, markdownToHtml } from "@/services/converter/converter";
import {
  checkXmlWellFormed,
  validateExportBlob,
} from "@/services/export/exportValidate";
import {
  buildBilingualMarkdown,
  contentToMarkdown,
} from "@/services/export/bilingualExport";
import {
  buildArticlePrompt,
  ARTICLE_STYLES,
} from "@/services/news/articleGen";
import {
  buildHeadlineImagePrompt,
  buildArticleImagePrompt,
} from "@/services/news/newsImages";
import {
  buildNewspaper,
  newspaperToMarkdown,
} from "@/services/news/newspaperLayout";
import {
  compactProfile,
  compactSavings,
} from "@/services/ollama/compactPrompts";
import {
  getBilingualTemplate,
  listBilingualTemplateIds,
} from "@/services/prompts/bilingualTemplates";
import {
  buildImagePrompt,
  IMAGE_STYLE_PRESETS,
  DEFAULT_IMAGE_STYLE,
} from "@/services/llm/promptBuilder";
import {
  buildQualityMarkdown,
  buildTrendChart,
  topSuggestions,
  toChapterScores,
} from "@/services/bookwriter/qualityReport";
import {
  createStyleGuide,
  checkAgainstGuide,
  applyFix,
} from "@/services/bookwriter/styleGuide";
import {
  calculateSpineWidth,
  estimatePageCount,
  generateCoverSvg,
  PAPER_TYPES,
} from "@/services/bookwriter/coverStudio";
import {
  normalizeChapters,
  gutterForPageCount,
  isRecto,
  blankPagesBefore,
  stableUuid,
} from "@/services/bookwriter/export/printMaster";
import { computeBackoffDelay } from "@/services/bookwriter/kdpUploadRetry";
import { makeTestBook } from "@/services/bookwriter/testbook";
import {
  runBatchAnalysis,
  summarizeReport,
} from "@/services/batch/manuscriptBatchRunner";
import { validateBackupWithImages } from "@/services/db/backup-images";
import { normalizeSpokenText } from "@/services/dictation/dictationService";
import {
  registerDefaultShutdownTasks,
  DEFAULT_SHUTDOWN_TASK_TIMEOUT_MS,
} from "@/services/monitoring/shutdown";
import { HEAVY_MODULES } from "@/services/lazyInit";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { applyPatchAsTrackChange } from "@/services/editor/editorialTrackChanges";
import {
  parseComicScript,
  exportToStandardScript,
} from "@/services/transmedia/comicScript";
import {
  placeOnGrid,
  calculateLineOfSight,
} from "@/services/spatial/choreography";
import {
  parsePerformanceMarkup,
  calculateScrollDuration,
  formatStageMode,
} from "@/services/stage/teleprompter";
import {
  createVoiceProfile,
  exportCastingBriefing,
} from "@/services/audio/voiceCasting";
import { detectAnachronisms } from "@/services/linguistics/historicalRegister";
import {
  analyzeEmotionVector,
  detectFatigue,
  generateResonanceCurve,
} from "@/services/dramaturgy/neuroPacing";
import {
  extractEntities,
  generatePopUpFootnotes,
} from "@/services/publishing/autoGlossary";
import { buildMerkleTree, signProof } from "@/services/security/authorshipProof";
import {
  calculateCognitiveLoad,
  detectGlazeOverZones,
  calculateReadingTime,
} from "@/services/analytics/cognitiveAttention";
import {
  createDynasty,
  generateEpilogueTimeline,
} from "@/services/dramaturgy/dynastyEngine";
import {
  generateAmbientSound,
  coupleSceneToSound,
  getBinauralBeats,
} from "@/services/audio/ambientSynthesizer";
import {
  encryptChapter,
  generateRoleToken,
} from "@/services/security/zkpCollaboration";
import {
  defineAxiom,
  checkSceneCompliance,
} from "@/services/worldbuilding/magicConstraintSolver";
import {
  generateIPA,
  mapSyllableStress,
  exportSpeakerGlossary,
} from "@/services/linguistics/phoneticLexicon";
import {
  generateFoilMask,
  generateSpotUvMask,
  calculateEdgeColoring,
} from "@/services/visual/coverEmbellishment";
import {
  auditExecutionLatency,
  profileHeapAllocation,
  generateJubileeSeal,
} from "@/services/core/systemSentinel";
import {
  calculateOpticalSizing,
  generateDropCap,
  harmonizeLineHeight,
} from "@/services/typography/variableFontEngine";
import {
  typesetArtifact,
  exportToEpub,
} from "@/services/typesetting/artifactTypesetter";
import {
  runEditorialCouncil,
  getCouncilConsensus,
} from "@/services/ai/editorialCouncil";
import {
  exportToAiwopen,
  exportToObsidianVault,
} from "@/services/storage/universalArchive";
import {
  classifySenseChannels,
  checkSensoryBalance,
} from "@/services/linguistics/synesthesiaMatrix";
import {
  calculateSpatialPosition,
  calculateDopplerEffect,
} from "@/services/audio/binauralSpatializer";
import {
  detectExpositionDump,
  detectSubtextMarkers,
} from "@/services/dramaturgy/dialogueSubtext";
import { generateSmil, formatTimecode } from "@/services/publishing/mediaOverlay";
import {
  proseToScreenplay,
  exportToFountain as exportScreenplayToFountain,
} from "@/services/screenplay/screenplayTransmuter";
import {
  assignCameraShots,
  calculateScreenTime,
  estimateBudget,
} from "@/services/visual/cinematographyPrevis";
import {
  trackSymbols,
  analyzeMetamorphosis,
  generateResonanceHeatmap,
} from "@/services/dramaturgy/leitmotifNetwork";
import {
  createContract,
  generateHtmlReport,
} from "@/services/security/contractSigner";

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface ToolDef {
  /** Eindeutige ID (auch Test-Hook). */
  id: string;
  /** Anzeigename im Panel. */
  label: string;
  /** Emoji-Icon. */
  icon: string;
  /** Kategorie (Unter-Tab). */
  category: string;
  /** Herkunfts-Meilenstein, z. B. "WP 26.1". */
  wp: string;
  /** Kurzbeschreibung für die UI. */
  hint: string;
  /** Text → Ergebnis. */
  run: (input: string) => string | Promise<string>;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Formatiert einen beliebigen Wert lesbar als Text. */
function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(keine Einträge)";
    return value
      .map((v, i) => `${i + 1}. ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
  }
  return JSON.stringify(value, null, 2);
}

/** Teilt Text in Kapitel (Trenner: Zeile mit ---). */
function toChapters(input: string): string[] {
  const parts = input
    .split(/^\s*---\s*$/m)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [input];
}

/** Erste Zeile als Titel, Rest als Text. */
function toTitled(input: string): { title: string; body: string } {
  const lines = input.split("\n");
  const title = (lines[0] ?? "").trim() || "Ohne Titel";
  const body = lines.slice(1).join("\n").trim();
  return { title, body: body || input };
}

/** Kapitel-Objekte für Services, die ChapterInput[] erwarten. */
function toChapterInputs(input: string, withNumbers = false) {
  return toChapters(input).map((content, i) => ({
    id: `kap-${i + 1}`,
    title: `Kapitel ${i + 1}`,
    content,
    ...(withNumbers ? { chapterNumber: i + 1 } : {}),
  }));
}

/** Kapitel mit Figuren-Liste (Plot-Forensik). */
function toChapterInputsWithCharacters(input: string) {
  const chapters = toChapters(input);
  const names = Array.from(new Set(input.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [])).slice(0, 12);
  return chapters.map((content, i) => ({
    id: `kap-${i + 1}`,
    title: `Kapitel ${i + 1}`,
    content,
    characters: names.filter((n) => content.includes(n)),
  }));
}

/** Kapitel mit Nummer (Subplot-Weaver, Neuro-Pacing). */
function toNumberedChapterInputs(input: string) {
  return toChapters(input).map((content, i) => ({
    id: `kap-${i + 1}`,
    title: `Kapitel ${i + 1}`,
    content,
    chapterNumber: i + 1,
  }));
}

// ─── Reachability-Pass (v4.3.0): zusätzliche Helper ──────────────────────────

/** BookChapterInput[] für Bookwriter-Export-Services (number, title, content). */
function toBookChapterInputs(input: string) {
  return toChapters(input).map((content, i) => ({
    number: i + 1,
    title: `Kapitel ${i + 1}`,
    content,
    status: "draft",
  }));
}

/** Erstes Wort als Titel, ganzer Text als Body. */
function toHeadlineBody(input: string): { headline: string; body: string } {
  const lines = input.split("\n").filter((l) => l.trim().length > 0);
  const headline = (lines[0] ?? "").trim().slice(0, 120) || "Ohne Überschrift";
  const body = lines.slice(1).join("\n").trim() || input;
  return { headline, body };
}

/** Parst "Schlüssel: Wert"-Zeilen zu einem Record (für Formularfelder). */
function toKeyValue(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of input.split("\n")) {
    const m = line.match(/^\s*([A-Za-zÄÖÜäöüß_ -]+)\s*[:=]\s*(.*)$/);
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

/** Erstes Zahlenfeld aus dem Text (Fallback: fester Wert). */
function firstNumber(input: string, fallback: number): number {
  const m = input.match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

/**
 * Baut einen minimalen ProseMirror-State mit tcDelete/tcInsert-Marks.
 *
 * Wird vom Export-Guard-Werkzeug gebraucht: `checkExportGuard` erwartet einen
 * echten EditorState, kein Text-Input.
 */
function buildTrackChangeState(text: string): EditorState {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] },
      text: {},
    },
    marks: {
      tcDelete: {
        attrs: { "data-reason": { default: null } },
        toDOM: () => ["del", { class: "tc-delete" }, 0],
      },
      tcInsert: {
        attrs: { "data-reason": { default: null } },
        toDOM: () => ["ins", { class: "tc-insert" }, 0],
      },
    },
  });

  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text(text)]),
  ]);
  let state = EditorState.create({ doc, schema });

  // Einen echten Track-Change anwenden, damit der Guard etwas zu prüfen hat.
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const target = words.slice(0, 2).join(" ");
    const applied = applyPatchAsTrackChange(state, {
      search: target,
      replace: `${target} [geändert]`,
      reason: "Reachability-Smoke-Test",
    });
    if (applied) state = applied.state;
  }

  return state;
}

// ─── Kategorien ──────────────────────────────────────────────────────────────

export const TOOL_CATEGORIES = [
  "Analyse & Lektorat",
  "Dramaturgie & Plot",
  "Audio & Hörspiel",
  "Typografie & Satz",
  "Export & Verlag",
  "Sprache & Übersetzung",
  "Medien & Formate",
  "Sicherheit & Backup",
  "System & KI",
  // Reachability-Pass (v4.3.0): Werkzeuge aus Sprint 2–22, die bisher keinen
  // Nicht-Test-Importer hatten.
  "Welt & Recherche",
  "Schreib-Produktivität",
  "Medien-Produktion",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

// ─── Registry ────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  // ── Analyse & Lektorat ────────────────────────────────────────────────────
  {
    id: "style-fingerprint",
    label: "Stil-Fingerprint",
    icon: "🖋️",
    category: "Analyse & Lektorat",
    wp: "WP 15.2",
    hint: "Stilometrie: Perplexity, Burstiness, Lieblingsfloskeln",
    run: (t) => {
      const fp = analyzeStyleFingerprint(t);
      const over = findOverusedPhrases(t, 10);
      return [
        `Burstiness: ${fp.burstiness.toFixed(2)}`,
        `Perplexity: ${fp.perplexity.toFixed(2)}`,
        `Ø Satzlänge: ${fp.avgSentenceLength.toFixed(1)} Wörter`,
        `Vokabular-Vielfalt (TTR): ${fp.uniqueWordRatio.toFixed(3)}`,
        `Satzlängen-Varianz: ${fp.sentenceVariance.toFixed(1)}`,
        "",
        "Überstrapazierte Phrasen:",
        fmt(over.map((o) => `${o.phrase} (${o.count}×)`)),
      ].join("\n");
    },
  },
  {
    id: "master-health",
    label: "Master-Health-Scan",
    icon: "🩺",
    category: "Analyse & Lektorat",
    wp: "WP 24.1",
    hint: "Gesamtscan P0/P1/P2 mit Readiness-Score und To-Do-Liste",
    run: (t) => {
      const chapters = toChapterInputs(t);
      const chars = Array.from(new Set(t.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? []))
        .slice(0, 20)
        .map((name) => ({
          name,
          role: "Figur",
          firstAppearance: 0,
          lastAppearance: chapters.length - 1,
        }));
      const result = runMasterHealthScan({
        chapters: chapters.map((c) => ({ ...c, characters: [] })),
        characters: chars,
        trackChanges: [],
      });
      const score = calculateReadinessScore(result);
      const todo = generateTodoList(result);
      return [
        `Publikationsreife: ${score} %`,
        `Wörter: ${result.stats.totalWords} · Kapitel: ${result.stats.totalChapters}`,
        `Offene Track-Changes: ${result.stats.openTrackChanges}`,
        "",
        `Befunde (${result.issues.length}):`,
        fmt(result.issues.map((i) => `[${i.severity}] ${i.category}: ${i.message}`)),
        "",
        "To-Do:",
        fmt(todo.map((x) => `[${x.priority}] ${x.task}`)),
      ].join("\n");
    },
  },
  {
    id: "plot-forensics",
    label: "Plot-Forensik",
    icon: "🔍",
    category: "Analyse & Lektorat",
    wp: "WP 22.2",
    hint: "Wissens-Matrix, Chronologie-Audit, verwaiste Handlungsstränge",
    run: (t) => {
      const inputs = toChapterInputsWithCharacters(t);
      const matrix = buildKnowledgeMatrix(inputs);
      const violations = auditChronology(matrix);
      const loose = trackLooseEnds(inputs);
      return [
        `Figuren in Matrix: ${matrix.characters.size}`,
        "",
        `Chronologie-Verstöße (${violations.length}):`,
        fmt(violations.map((v) => `${v.character}: ${v.fact} (Kap. ${v.chapter}) — ${v.reason}`)),
        "",
        `Verwaiste Stränge (${loose.length}):`,
        fmt(loose.filter((l) => !l.resolved).map((l) => `[${l.type}] ${l.description} (Kap. ${l.introducedInChapter})`)),
      ].join("\n");
    },
  },
  {
    id: "cognitive-attention",
    label: "Kognitive Belastung",
    icon: "🧠",
    category: "Analyse & Lektorat",
    wp: "WP 30.1",
    hint: "Cognitive Load, Glaze-Over-Zonen, Lesezeit-Matrix",
    run: (t) => {
      const load = calculateCognitiveLoad(t);
      const paragraphs = t.split(/\n\s*\n/).filter(Boolean);
      const glaze = detectGlazeOverZones(paragraphs);
      const diagonal = calculateReadingTime(t, "diagonal");
      const standard = calculateReadingTime(t, "standard");
      const genuss = calculateReadingTime(t, "genuss");
      return [
        `Kognitive Belastung: ${load.index}/100 (${load.level})`,
        `Faktoren: ${load.factors.join(", ") || "keine"}`,
        "",
        `Glaze-Over-Zonen (${glaze.length}):`,
        fmt(glaze.map((g) => `Absatz ${g.paragraphIndex + 1}: ${g.reason}`)),
        "",
        `Lesezeit (${standard.words} Wörter):`,
        `  Diagonalleser: ${Math.round(diagonal.seconds)}s`,
        `  Standardleser: ${Math.round(standard.seconds)}s`,
        `  Genussleser:   ${Math.round(genuss.seconds)}s`,
      ].join("\n");
    },
  },
  {
    id: "editorial-council",
    label: "4-Köpfe-Lektoren-Rat",
    icon: "⚖️",
    category: "Analyse & Lektorat",
    wp: "WP 35.1",
    hint: "Plot-Chirurg, Figuren-Psychologe, Kontinuität, Stil — mit Konsens",
    run: (t) => {
      const report = runEditorialCouncil(t);
      const consensus = getCouncilConsensus(report);
      return [
        `Gesamtbefunde: ${consensus.totalFindings}`,
        `  Fehler: ${consensus.errors} · Warnungen: ${consensus.warnings} · Infos: ${consensus.infos}`,
        "",
        "Top-Themen:",
        fmt(consensus.topIssues),
        "",
        "Plot-Chirurg:",
        fmt(report.plotChirurg.map((f) => f.message)),
        "",
        "Figuren-Psychologe:",
        fmt(report.figurenPsychologe.map((f) => f.message)),
        "",
        "Kontinuitäts-Pedant:",
        fmt(report.kontinuitaetsPedant.map((f) => f.message)),
        "",
        "Stil-Gourmet:",
        fmt(report.stilGourmet.map((f) => f.message)),
      ].join("\n");
    },
  },
  {
    id: "stylistic-twin",
    label: "Stil-DNA",
    icon: "🧬",
    category: "Analyse & Lektorat",
    wp: "WP 22.1",
    hint: "Schreibstil-DNA extrahieren + Persona-Prompt erzeugen",
    run: (t) => {
      const chapters = toChapters(t);
      const dna = extractStyleDNA(chapters);
      const rhythm = analyzeSentenceRhythm(t);
      return [
        `Adjektiv/Verb-Verhältnis: ${dna.adjectiveVerbRatio.toFixed(2)}`,
        `Ø Satzlänge: ${dna.avgSentenceLength.toFixed(1)} Wörter`,
        `Vokabular-Dichte: ${dna.vocabularyDensity.toFixed(3)}`,
        "",
        "Satzbau-Muster:",
        fmt(dna.sentencePatterns.map((p) => `${p.type}: ${p.frequency}`)),
        "",
        `Rhythmus: Ø ${rhythm.avgLength.toFixed(1)} · Varianz ${rhythm.variance.toFixed(1)}`,
        `  Kurze Sätze: ${rhythm.shortSentences} · Lange Sätze: ${rhythm.longSentences}`,
      ].join("\n");
    },
  },
  {
    id: "synesthesia",
    label: "5-Sinne-Matrix",
    icon: "🌈",
    category: "Analyse & Lektorat",
    wp: "WP 36.1",
    hint: "Sensorische Balance der 5 Wahrnehmungskanäle",
    run: (t) => {
      const ch = classifySenseChannels(t);
      const radar = checkSensoryBalance(toChapters(t));
      return [
        "Kanal-Verteilung:",
        `  👁  Visuell:        ${ch.visual}`,
        `  👂 Auditiv:        ${ch.auditory}`,
        `  👃 Olfaktorisch:   ${ch.olfactory}`,
        `  👅 Gustatorisch:   ${ch.gustatory}`,
        `  ✋ Taktil:         ${ch.tactile}`,
        "",
        "Kapitel-Warnungen:",
        fmt(
          radar.chapters
            .filter((c) => c.warning)
            .map((c) => `Kap. ${c.index + 1}: ${c.warning}`),
        ),
      ].join("\n");
    },
  },
  {
    id: "leitmotif",
    label: "Leitmotiv-Netz",
    icon: "🕸️",
    category: "Analyse & Lektorat",
    wp: "WP 39.1",
    hint: "Wiederkehrende Symbole, Metamorphose-Kurve, Resonanz-Heatmap",
    run: (t) => {
      const tracks = trackSymbols(toChapters(t));
      const heatmap = generateResonanceHeatmap(tracks);
      const curves = tracks.slice(0, 6).map((tr) => analyzeMetamorphosis(tr));
      return [
        `Erkannte Symbole: ${tracks.length}`,
        fmt(tracks.slice(0, 12).map((tr) => `${tr.symbol} [${tr.category}] — ${tr.occurrences.length} Kapitel`)),
        "",
        "Metamorphosen:",
        fmt(
          curves.map(
            (c) =>
              `${c.symbol}: ${c.evolves ? "entwickelt sich" : "statisch"} — ${c.acts.map((a) => `Akt ${a.act}: ${a.meaning}`).join(" → ")}`,
          ),
        ),
        "",
        `Lücken: ${heatmap.gaps.join(", ") || "keine"}`,
      ].join("\n");
    },
  },
  {
    id: "neuro-pacing",
    label: "Neuro-Pacing",
    icon: "💓",
    category: "Analyse & Lektorat",
    wp: "WP 28.2",
    hint: "Plutchik-Emotionsvektor, Ermüdungswächter, Resonanzkurve",
    run: (t) => {
      const vector = analyzeEmotionVector(t);
      const chapters = toNumberedChapterInputs(t);
      const fatigue = detectFatigue(chapters);
      const curve = generateResonanceCurve(chapters);
      return [
        "Emotionsvektor (Plutchik):",
        fmt(Object.entries(vector).map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`)),
        "",
        `Ermüdungs-Warnungen (${fatigue.length}):`,
        fmt(fatigue.map((f) => `Kap. ${f.chapterNumber} [${f.severity}]: ${f.message}`)),
        "",
        `Resonanzkurve: ${curve.points.length} Punkte · ${curve.peaks.length} Peaks · ${curve.valleys.length} Täler`,
      ].join("\n");
    },
  },
  {
    id: "dialogue-subtext",
    label: "Dialog-Subtext",
    icon: "🎭",
    category: "Analyse & Lektorat",
    wp: "WP 37.1",
    hint: "As-you-know-Bob-Filter und Subtext-Marker",
    run: (t) => {
      const dumps = detectExpositionDump(t);
      const actionTags = (t.match(/\*[^*]+\*/g) ?? []).slice(0, 20);
      const markers = detectSubtextMarkers(t, actionTags);
      return [
        `Expositions-Dumps (${dumps.length}):`,
        fmt(dumps.map((d) => `"${d.phrase}" — ${d.reason}`)),
        "",
        `Subtext-Marker (${markers.length}):`,
        fmt(markers.map((m) => `"${m.statement}" vs. ${m.actionTag} → ${m.discrepancy}`)),
      ].join("\n");
    },
  },
  {
    id: "historical-register",
    label: "Anachronismus-Wächter",
    icon: "🏰",
    category: "Analyse & Lektorat",
    wp: "WP 28.1",
    hint: "Epochen-Filter gegen moderne Begriffe",
    run: (t) => {
      const epochs = ["mittelalter", "antike", "viktorianisch"] as const;
      const lines: string[] = [];
      for (const epoch of epochs) {
        const hits = detectAnachronisms(t, epoch);
        lines.push(`${epoch.toUpperCase()}: ${hits.length} Treffer`);
        for (const h of hits.slice(0, 8)) {
          lines.push(`  "${h.word}" — ${h.reason}${h.suggestion ? ` → ${h.suggestion}` : ""}`);
        }
        lines.push("");
      }
      return lines.join("\n");
    },
  },

  // ── Dramaturgie & Plot ────────────────────────────────────────────────────
  {
    id: "subplot-weaver",
    label: "Subplot-Webstuhl",
    icon: "🧵",
    category: "Dramaturgie & Plot",
    wp: "WP 24.2",
    hint: "Vernachlässigte Nebenplots und Klimax-Synchronisation",
    run: (t) => {
      const chapters = toNumberedChapterInputs(t);
      const plotIds = ["A", "B", "C", "D"] as const;
      const assignments = chapters.map((c, i) => ({
        sceneId: c.id,
        plotId: plotIds[i % plotIds.length],
        chapterNumber: c.chapterNumber,
      }));
      const neglected = detectNeglectedSubplots(chapters, assignments);
      const klimax = checkKlimaxSync(chapters, assignments);
      return [
        `Vernachlässigte Subplots (${neglected.length}):`,
        fmt(neglected.map((n) => `Plot ${n.plotId}: ${n.message}`)),
        "",
        `Klimax-Synchronisation: ${klimax.synced ? "✓ synchron" : "✗ unsynchron"}`,
        fmt(klimax.issues),
        klimax.aPlotClimaxChapter !== undefined
          ? `A-Plot-Klimax: Kap. ${klimax.aPlotClimaxChapter + 1}`
          : "",
      ].filter(Boolean).join("\n");
    },
  },
  {
    id: "dynasty-engine",
    label: "Dynastie-Chronik",
    icon: "👑",
    category: "Dramaturgie & Plot",
    wp: "WP 30.2",
    hint: "Stammbaum, biologische Plausibilität, Epilog-Zeitleiste",
    run: (t) => {
      const members = [
        { id: "1", name: "Aldric", birthYear: 1000, deathYear: 1050, title: "König", race: "human" as const, parentIds: [], spouseIds: ["2"] },
        { id: "2", name: "Mira", birthYear: 1005, deathYear: 1060, title: "Königin", race: "human" as const, parentIds: [], spouseIds: ["1"] },
        { id: "3", name: "Toran", birthYear: 1030, deathYear: 1085, title: "Prinz", race: "human" as const, parentIds: ["1", "2"], spouseIds: [] },
      ];
      const dynasty = createDynasty(members);
      const timeline = generateEpilogueTimeline(dynasty);
      return [
        `Dynastie: ${dynasty.members.length} Mitglieder`,
        "",
        "Epilog-Zeitleiste:",
        fmt(timeline.map((e) => `${e.year}: ${e.event}`)),
        "",
        "(Eingabetext wird als Stilprobe für Namensfindung genutzt.)",
        `Erkannte Eigennamen: ${Array.from(new Set(t.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [])).slice(0, 10).join(", ") || "—"}`,
      ].join("\n");
    },
  },
  {
    id: "branching-engine",
    label: "Verzweigungs-Plot",
    icon: "🌿",
    category: "Dramaturgie & Plot",
    wp: "WP 16.2",
    hint: "Gamebook-Struktur mit Twine- und Ink-Export",
    run: (t) => {
      const chapters = toChapters(t);
      const story = createBranchingStory({
        id: "story-1",
        title: toTitled(t).title,
        scenes: [],
        variables: {},
      });
      chapters.forEach((content, i) => {
        addScene({
          id: `scene-${i + 1}`,
          title: `Szene ${i + 1}`,
          content,
          choices: [],
        });
      });
      return [
        `Szenen: ${chapters.length}`,
        "",
        "Twine (Harlowe) — Auszug:",
        exportToTwine(story).slice(0, 400),
        "",
        "Ink — Auszug:",
        exportToInk(story).slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "choreography",
    label: "Sichtachsen-Check",
    icon: "👁️",
    category: "Dramaturgie & Plot",
    wp: "WP 26.2",
    hint: "Line-of-Sight-Raycasting auf 2D-Raster",
    run: (t) => {
      const a = placeOnGrid({ id: "a", type: "character", x: 0, y: 0, rotation: 0 }, 0, 0, 0);
      const b = placeOnGrid({ id: "b", type: "character", x: 5, y: 0, rotation: 0 }, 5, 0, 180);
      const wall = { x: 2, y: -1, width: 0.5, height: 2, type: "wall" as const, blocksSight: true, blocksSound: true };
      const free = calculateLineOfSight(a, b, []);
      const blocked = calculateLineOfSight(a, b, [wall]);
      return [
        `Szenen-Prüfung für ${t.split(/\s+/).length} Wörter Kontext.`,
        "",
        `Freie Sicht (keine Hindernisse): ${free.visible ? "✓" : "✗"} (Distanz ${free.distance.toFixed(2)})`,
        `Mit Wand dazwischen: ${blocked.visible ? "✓ sichtbar" : "✗ blockiert"}`,
      ].join("\n");
    },
  },
  {
    id: "magic-solver",
    label: "Magie-Regelprüfer",
    icon: "🔮",
    category: "Dramaturgie & Plot",
    wp: "WP 32.1",
    hint: "Axiom-Compliance und Deus-ex-Machina-Alarm",
    run: (t) => {
      const axiom = defineAxiom({
        id: "teleport",
        name: "Teleportation",
        preconditions: ["sichtkontakt"],
        energyCost: 50,
        limitations: ["beton"],
      });
      const actionLower = t.toLowerCase();
      const scene = {
        id: "s1",
        character: "Held",
        action: actionLower.includes("teleport") ? "teleport" : t.slice(0, 40),
        context: ["sichtkontakt"],
      };
      const compliance = checkSceneCompliance(scene, [axiom]);
      return [
        `Axiom: ${axiom.name} (Kosten ${axiom.energyCost})`,
        `Vorbedingungen: ${axiom.preconditions.join(", ") || "—"}`,
        "",
        `Compliance: ${compliance.compliant ? "✓ konform" : "✗ Regelbruch"}`,
        fmt(compliance.violations.map((v) => `[${v.severity}] ${v.reason}`)),
      ].join("\n");
    },
  },

  // ── Audio & Hörspiel ──────────────────────────────────────────────────────
  {
    id: "audiobook-master",
    label: "Hörbuch-Master",
    icon: "🎧",
    category: "Audio & Hörspiel",
    wp: "WP 18.1",
    hint: "Kapitelmarken mit Timecodes und Hörproben-Schnitt",
    run: (t) => {
      const chapters = toChapterInputs(t);
      const markers = generateChapterMarkers(chapters);
      const sample = cutSampleSnippet(chapters);
      return [
        `Kapitelmarken (150 WPM):`,
        fmt(
          markers.map((m) => {
            const min = Math.floor(m.startTimeMs / 60000);
            const sec = Math.floor((m.startTimeMs % 60000) / 1000);
            return `${m.title} @ ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} (${m.wordCount} W.)`;
          }),
        ),
        "",
        `Hörprobe: ${sample.length} Kapitel enthalten`,
      ].join("\n");
    },
  },
  {
    id: "audio-drama",
    label: "Hörspiel-Cues",
    icon: "🎬",
    category: "Audio & Hörspiel",
    wp: "WP 20.1",
    hint: "Audio-Regieanweisungen parsen und Mixdown berechnen",
    run: (t) => {
      const cues = parseAudioCues(t);
      const timeline = buildMultiTrackTimeline(cues);
      const mix = calculateMixdown(timeline);
      return [
        `Erkannte Cues: ${cues.length}`,
        fmt(cues.slice(0, 15).map((c) => `[${c.type}] ${c.label} @ ${c.startTime}ms (vol ${c.volume}, pan ${c.pan})`)),
        "",
        `Spuren: ${timeline.tracks.length} · Dauer: ${timeline.durationMs}ms`,
        `Mixdown: ${mix.durationMs}ms · Ducking: ${mix.duckingApplied ? "ja" : "nein"}`,
      ].join("\n");
    },
  },
  {
    id: "voice-casting",
    label: "Sprecher-Casting",
    icon: "🎤",
    category: "Audio & Hörspiel",
    wp: "WP 27.2",
    hint: "Stimmprofile und Casting-Briefing für Tonstudios",
    run: (t) => {
      const names = Array.from(new Set(t.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [])).slice(0, 5);
      const profiles = names.map((name, i) =>
        createVoiceProfile(name, {
          pitchHz: 85 + i * 30,
          voiceType: (["bass", "baritone", "tenor", "alto", "mezzo"] as const)[i % 5],
          timbre: (["smoky", "velvety", "metallic", "nasal"] as const)[i % 4],
          speechRate: 150,
          accent: "de-DE",
        }),
      );
      return [
        `Stimmprofile: ${profiles.length}`,
        "",
        exportCastingBriefing(profiles).slice(0, 800),
      ].join("\n");
    },
  },
  {
    id: "ambient-synth",
    label: "Ambient-Klangteppich",
    icon: "🌧️",
    category: "Audio & Hörspiel",
    wp: "WP 31.1",
    hint: "Szenen-Tags → prozeduraler Klangteppich",
    run: (t) => {
      const tags = Array.from(new Set(t.toLowerCase().match(/\b(wald|nacht|kampf|regen|feuer|taverne|stadt|meer)\b/g) ?? []));
      const sound = coupleSceneToSound(tags);
      const generated = generateAmbientSound(sound, 5);
      const alpha = getBinauralBeats("alpha");
      const theta = getBinauralBeats("theta");
      return [
        `Erkannte Tags: ${tags.join(", ") || "keine"}`,
        `Gewählter Klangteppich: ${sound}`,
        `Generiert: ${generated.data.length} Samples @ ${generated.sampleRate}Hz`,
        "",
        `Binaural Alpha: ${alpha.baseFrequency}Hz + ${alpha.beatFrequency}Hz`,
        `Binaural Theta: ${theta.baseFrequency}Hz + ${theta.beatFrequency}Hz`,
      ].join("\n");
    },
  },
  {
    id: "binaural-3d",
    label: "3D-Raumklang (HRTF)",
    icon: "🎧",
    category: "Audio & Hörspiel",
    wp: "WP 36.2",
    hint: "ITD/ILD aus Azimut, Elevation und Distanz",
    run: () => {
      const positions = [
        { a: 0, e: 0, d: 1 },
        { a: 90, e: 0, d: 1 },
        { a: -90, e: 0, d: 1 },
        { a: 180, e: 0, d: 2 },
        { a: 45, e: 30, d: 0.5 },
      ];
      const lines = positions.map((p) => {
        const s = calculateSpatialPosition(p.a, p.e, p.d);
        return `Az ${String(p.a).padStart(4)}° / El ${String(p.e).padStart(3)}° / ${p.d}m → ITD ${s.itdMs.toFixed(3)}ms, ILD ${s.ildDb.toFixed(1)}dB (L ${s.leftGain.toFixed(2)} / R ${s.rightGain.toFixed(2)})`;
      });
      const doppler = calculateDopplerEffect(30, 440);
      return [
        ...lines,
        "",
        `Doppler (30 m/s, 440Hz): ${doppler.observedFrequency.toFixed(1)}Hz (Δ ${doppler.shift.toFixed(1)})`,
      ].join("\n");
    },
  },

  // ── Typografie & Satz ─────────────────────────────────────────────────────
  {
    id: "micro-typography",
    label: "Mikrotypografie",
    icon: "🔤",
    category: "Typografie & Satz",
    wp: "WP 20.2",
    hint: "Hurenkinder, Randausgleich, geschützte Leerzeichen",
    run: (t) => {
      const paragraphs = t.split(/\n\s*\n/).filter(Boolean);
      const widows = detectWidowsAndOrphans(paragraphs);
      const nbsp = insertNonBreakingSpaces(t);
      return [
        `Schusterjungen/Hurenkinder (${widows.length}):`,
        fmt(widows.slice(0, 10).map((w) => `Zeile ${w.lineNumber} [${w.type}]: ${w.text.slice(0, 50)}`)),
        "",
        `Geschützte Leerzeichen eingefügt: ${(nbsp.match(/\u00A0/g) ?? []).length}`,
        "",
        "Randausgleich — Auszug:",
        applyHangingPunctuation(t).slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "variable-fonts",
    label: "Variable Fonts & Drop-Caps",
    icon: "🅰️",
    category: "Typografie & Satz",
    wp: "WP 34.1",
    hint: "Optische Achsen, Pracht-Initialen, Zeilenabstand",
    run: (t) => {
      const sizes = [8, 11, 32];
      const lines = sizes.map((s) => {
        const o = calculateOpticalSizing(s);
        return `${String(s).padStart(2)}pt → opsz ${o.opsz}, wght ${o.wght}, wdth ${o.wdth}, Zeilenhöhe ${harmonizeLineHeight(s, 1.2).toFixed(2)}`;
      });
      const styles = ["gothic", "renaissance", "jugendstil", "modern"] as const;
      const caps = styles.map((st) => {
        const c = generateDropCap(t || "Anfang", st);
        return `${st}: "${c.letter}" — ${c.lines} Zeilen, Umfluss ${c.runaroundMargin}em`;
      });
      return [...lines, "", "Drop-Caps:", ...caps].join("\n");
    },
  },
  {
    id: "bionic-reading",
    label: "Bionisches Lesen",
    icon: "👓",
    category: "Typografie & Satz",
    wp: "WP 17.2",
    hint: "Wortanfänge fett für schnellere Korrektur",
    run: (t) => {
      const settings = getAccessibilitySettings();
      return [
        "Bionische Projektion (erste ~40 % fett):",
        "",
        applyBionicReading(t.slice(0, 600), 0.4),
        "",
        `Einstellungen: ${settings.fontFamily} · Zeilenabstand ${settings.lineHeight} · Buchstabenabstand ${settings.letterSpacing}`,
      ].join("\n");
    },
  },
  {
    id: "artifact-typesetter",
    label: "Artefakt-Setzer",
    icon: "📜",
    category: "Typografie & Satz",
    wp: "WP 34.2",
    hint: "Briefe, Zeitungen, Chats und Akten setzen",
    run: (t) => {
      const types = ["letter", "newspaper", "chat", "police"] as const;
      const lines = types.map((type) => {
        const result = typesetArtifact({ type, content: t.slice(0, 200), metadata: { title: "Testartikel" } });
        return `${type}: ${result.html.length} Zeichen HTML, ${result.css.length} Zeichen CSS`;
      });
      const epub = exportToEpub(typesetArtifact({ type: "letter", content: t.slice(0, 100) }));
      return [
        ...lines,
        "",
        "EPUB-Export — Auszug:",
        epub.slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "cover-embellishment",
    label: "Cover-Veredelung",
    icon: "✨",
    category: "Typografie & Satz",
    wp: "WP 33.1",
    hint: "Heißfolie, Spot-UV und Farbschnitt-Masken",
    run: (t) => {
      const { title, body } = toTitled(t);
      const design = {
        title,
        author: "Autor",
        width: 200,
        height: 300,
        elements: [{ id: "1", type: "text" as const, x: 0, y: 0, width: 180, height: 30, content: title }],
      };
      const foil = generateFoilMask(design);
      const uv = generateSpotUvMask(design);
      const pageCount = Math.max(1, Math.round(body.split(/\s+/).length / 250));
      const edge = calculateEdgeColoring(pageCount, "#c9a227");
      return [
        `Heißfolie: ${foil.elements.length} Elemente, ${foil.inkPercentage} % K-Only (${foil.colorSpace})`,
        `Spot-UV: ${uv.elements.length} Elemente, Glanzgrad ${uv.glossLevel}`,
        `Farbschnitt: ${edge.pageCount} Seiten in ${edge.color}`,
      ].join("\n");
    },
  },

  // ── Export & Verlag ───────────────────────────────────────────────────────
  {
    id: "publisher-exchange",
    label: "Verlags-Export",
    icon: "📤",
    category: "Export & Verlag",
    wp: "WP 15.1",
    hint: "ICML für InDesign und Fountain-Drehbuch",
    run: (t) => {
      const chapters = toChapterInputs(t);
      const icml = exportToIcml(chapters);
      const fountain = exportToFountain(chapters);
      return [
        `ICML: ${icml.length} Zeichen`,
        icml.slice(0, 400),
        "",
        `Fountain: ${fountain.length} Zeichen`,
        fountain.slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "distribution-pipeline",
    label: "Distribution & ONIX",
    icon: "📦",
    category: "Export & Verlag",
    wp: "WP 21.2",
    hint: "ONIX 3.0 und Distributor-Compliance",
    run: (t) => {
      const { title } = toTitled(t);
      const book = {
        title,
        author: "Autor",
        isbn: "9783161484100",
        price: 19.99,
        currency: "EUR",
        language: "deu",
        publisher: "Selbstverlag",
        publicationDate: "2026-10-03",
        pages: 320,
        format: "paperback",
        subjects: ["Fiktion"],
      };
      const distributors = ["kdp", "ingramspark", "tolino", "apple"] as const;
      const lines = distributors.map((d) => {
        const profile = getDistributorProfile(d);
        const issues = checkCompliance(book, d);
        return `${profile.name}: ${issues.length} Befunde (${profile.colorModel}, max ${profile.maxFileSizeMB} MB)`;
      });
      const onix = generateOnixMetadata(book);
      return [
        ...lines,
        "",
        `ONIX 3.0: ${onix.length} Zeichen`,
        onix.slice(0, 500),
      ].join("\n");
    },
  },
  {
    id: "pitch-deck",
    label: "Exposé & Normseiten",
    icon: "📄",
    category: "Export & Verlag",
    wp: "WP 25.1",
    hint: "Agentur-Exposé und VG-Wort-Normseiten",
    run: (t) => {
      const { title, body } = toTitled(t);
      const chapters = toChapterInputs(body);
      const expo = generateExposé({
        title,
        author: "Autor",
        chapters: chapters.map((c) => ({ id: c.id, title: c.title, content: c.content })),
        characters: [],
      });
      const pages = countNormPages(body);
      const firstPage = generateNormPage(body.slice(0, 1500));
      return [
        `Exposé:`,
        `  Logline: ${expo.logline || "—"}`,
        `  Prämisse: ${(expo.premise || "—").slice(0, 120)}`,
        `  Pitch: ${(expo.pitch || "—").slice(0, 120)}`,
        "",
        `Normseiten: ${pages}`,
        `Erste Normseite: ${firstPage.lines.length} Zeilen à max 60 Anschläge`,
        fmt(firstPage.lines.slice(0, 5).map((l) => `${l.charCount} | ${l.text}`)),
      ].join("\n");
    },
  },
  {
    id: "media-overlay",
    label: "EPUB Media-Overlay",
    icon: "🔊",
    category: "Export & Verlag",
    wp: "WP 37.2",
    hint: "SMIL 3.0 für synchrones Mitlesen",
    run: (t) => {
      const sentences = splitSentences(t).slice(0, 20);
      const durationMs = sentences.length * 2500;
      const smil = generateSmil(sentences, durationMs);
      return [
        `Sätze: ${smil.sentenceCount} · Gesamtdauer: ${formatTimecode(smil.totalDurationMs)}`,
        "",
        "SMIL 3.0 — Auszug:",
        smil.xml.slice(0, 700),
      ].join("\n");
    },
  },
  {
    id: "universal-archive",
    label: "Zukunftsarchiv (.aiwsopen)",
    icon: "🗄️",
    category: "Export & Verlag",
    wp: "WP 35.2",
    hint: "Markdown + YAML + JSON-LD und Obsidian-Vault",
    run: (t) => {
      const { title } = toTitled(t);
      const chapters = toChapters(t);
      const archive = exportToAiwopen({
        title,
        author: "Autor",
        chapters,
        metadata: { genre: "Fiktion" },
      });
      const vault = exportToObsidianVault({
        title,
        author: "Autor",
        chapters,
        metadata: {},
      });
      return [
        `Markdown: ${archive.markdown.length} Zeichen`,
        `YAML: ${archive.yaml.split("\n").length} Zeilen`,
        `JSON-LD: ${archive.jsonLd.length} Zeichen`,
        "",
        `Obsidian-Vault: ${vault.files.length} Dateien`,
        fmt(vault.files.map((f) => f.name)),
      ].join("\n");
    },
  },

  // ── Sprache & Übersetzung ─────────────────────────────────────────────────
  {
    id: "literary-translation",
    label: "Dual-Text-Alignment",
    icon: "🌐",
    category: "Sprache & Übersetzung",
    wp: "WP 18.2",
    hint: "Satzgenaue Synchronisation und Glossar-Prüfung",
    run: (t) => {
      const chapters = toChapters(t);
      const original = splitSentences(chapters[0] ?? t);
      const translation = splitSentences(chapters[1] ?? chapters[0] ?? t);
      const aligned = alignDualText(original, translation);
      const violations = checkGlossaryCompliance(
        chapters[1] ?? t,
        [{ source: "Blademaster", target: "Klingenmeister", category: "term" }],
      );
      return [
        `Original-Sätze: ${original.length} · Übersetzung: ${translation.length}`,
        `Ausgerichtete Segmente: ${aligned.length}`,
        "",
        "Glossar-Verstöße:",
        fmt(violations.map((v) => `"${v.source}" → erwartet "${v.expected}", gefunden "${v.found}"`)),
      ].join("\n");
    },
  },
  {
    id: "auto-glossary",
    label: "Auto-Glossar",
    icon: "📖",
    category: "Sprache & Übersetzung",
    wp: "WP 29.1",
    hint: "Entitäten extrahieren und EPUB3-Pop-Up-Fußnoten erzeugen",
    run: (t) => {
      const entries = extractEntities(t);
      const footnotes = generatePopUpFootnotes(t.slice(0, 500), entries.slice(0, 10));
      return [
        `Entitäten: ${entries.length}`,
        fmt(entries.slice(0, 15).map((e) => `[${e.type}] ${e.term}`)),
        "",
        "Pop-Up-Fußnoten — Auszug:",
        footnotes.slice(0, 400),
      ].join("\n");
    },
  },
  {
    id: "phonetic-lexicon",
    label: "IPA-Aussprache",
    icon: "🗣️",
    category: "Sprache & Übersetzung",
    wp: "WP 32.2",
    hint: "Lautschrift, Silbenbetonung, Sprecher-Dossier",
    run: (t) => {
      const words = Array.from(new Set(t.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [])).slice(0, 8);
      const lines = words.map((w) => {
        const ipa = generateIPA(w);
        const stress = mapSyllableStress(w);
        return `${w} → ${ipa.ipa} (${ipa.simplified}) · ${stress.syllables.join("-")} · Betonung Silbe ${stress.primaryStress + 1}`;
      });
      return [
        ...(lines.length > 0 ? lines : ["(Keine Eigennamen gefunden.)"]),
        "",
        "Sprecher-Glossar:",
        exportSpeakerGlossary(words).slice(0, 500),
      ].join("\n");
    },
  },
  {
    id: "comic-script",
    label: "Comic-Skript",
    icon: "💥",
    category: "Sprache & Übersetzung",
    wp: "WP 26.1",
    hint: "Panels, Sprechblasen, SFX und Standard-Export",
    run: (t) => {
      const panels = parseComicScript(t);
      return [
        `Panels: ${panels.length}`,
        fmt(
          panels.slice(0, 10).map(
            (p) => `S.${p.pageNumber}/P.${p.panelNumber}: ${p.dialogue.length} Ballons, ${p.sfx.length} SFX`,
          ),
        ),
        "",
        "Standard-Skript — Auszug:",
        exportToStandardScript(panels).slice(0, 500),
      ].join("\n");
    },
  },

  // ── Medien & Formate ──────────────────────────────────────────────────────
  {
    id: "screenplay-transmuter",
    label: "Roman → Drehbuch",
    icon: "🎞️",
    category: "Medien & Formate",
    wp: "WP 38.1",
    hint: "Sluglines, Action-Zeilen, Dialogblöcke, FDX/Fountain",
    run: (t) => {
      const doc = proseToScreenplay(t);
      const scenes = doc.scenes ?? [];
      return [
        `Titel: ${doc.title}`,
        `Szenen: ${scenes.length}`,
        fmt(
          scenes.slice(0, 8).map(
            (s) => `${s.slugline} — ${s.action.length} Action-Zeilen, ${s.dialogue.length} Dialogblöcke`,
          ),
        ),
        "",
        "Fountain — Auszug:",
        exportScreenplayToFountain(doc).slice(0, 500),
      ].join("\n");
    },
  },
  {
    id: "cinematography-previs",
    label: "Kamera-Previs",
    icon: "🎥",
    category: "Medien & Formate",
    wp: "WP 38.2",
    hint: "Einstellungen, Screen-Time und Budget-Stufe",
    run: (t) => {
      const paragraphs = t.split(/\n\s*\n/).filter(Boolean);
      const shots = assignCameraShots(paragraphs);
      const screenTime = calculateScreenTime({
        actionLines: paragraphs.length,
        dialogueLines: (t.match(/„[^“”]+[“”]/g) ?? []).length,
      });
      const budget = estimateBudget(shots);
      return [
        `Einstellungen (${shots.length}):`,
        fmt(shots.slice(0, 10).map((s) => `Absatz ${s.paragraphIndex + 1}: ${s.shot} — ${s.reason}`)),
        "",
        `Screen-Time: ${screenTime.minutes.toFixed(1)} Min. (${screenTime.pages.toFixed(1)} Seiten)`,
        `Budget: ${budget.level.toUpperCase()} (Score ${budget.score})`,
        fmt(budget.factors),
      ].join("\n");
    },
  },
  {
    id: "map-builder",
    label: "Kartenstudio",
    icon: "🗺️",
    category: "Medien & Formate",
    wp: "WP 21.1",
    hint: "SVG-Ebenen mit Stil-Presets und 300-DPI-Export",
    run: (t) => {
      const { title } = toTitled(t);
      const layer = createMapLayer({
        id: "land",
        name: title,
        type: "land",
        elements: [{ id: "e1", type: "text", x: 100, y: 100, content: title }],
        visible: true,
      });
      const styles = ["parchment", "blueprint", "modern"] as const;
      const svgs = styles.map((s) => {
        const styled = applyMapStyle(layer, s);
        return `${s}: ${exportToSvg([styled]).length} Zeichen SVG`;
      });
      return [...svgs, "", "SVG — Auszug:", exportToSvg([layer]).slice(0, 400)].join("\n");
    },
  },
  {
    id: "sensory-studio",
    label: "Sensorik-Moodboard",
    icon: "🎨",
    category: "Medien & Formate",
    wp: "WP 23.1",
    hint: "Geruch, Licht, Haptik und Farbpaletten",
    run: (t) => {
      const scene = t.slice(0, 400);
      const compass = generateSensoryCompass(scene);
      const palette = extractColorPalette(scene);
      const board = generateMoodboard(scene);
      return [
        `Geruch: ${compass.smell.join(", ") || "—"}`,
        `Licht: ${compass.light.join(", ") || "—"}`,
        `Haptik: ${compass.haptik.join(", ") || "—"}`,
        `Temperatur: ${compass.temperature || "—"}`,
        "",
        `Palette primär: ${palette.primary.join(" ")}`,
        `Palette sekundär: ${palette.secondary.join(" ")}`,
        `Akzent: ${palette.accent.join(" ")}`,
        "",
        `Keywords: ${board.keywords.join(", ")}`,
      ].join("\n");
    },
  },
  {
    id: "spatiotemporal",
    label: "Reisezeit-Wächter",
    icon: "🧭",
    category: "Medien & Formate",
    wp: "WP 16.1",
    hint: "Distanz und Reisedauer zwischen Schauplätzen",
    run: () => {
      const from = { x: 0, y: 0 };
      const to = { x: 220, y: 0 };
      const modes = ["foot", "horse", "carriage", "ship", "modern"] as const;
      const lines = modes.map((m) => {
        const tt = calculateTravelTime(from, to, m, "road");
        return `${m.padEnd(9)}: ${tt.days.toFixed(2)} Tage (${tt.hours.toFixed(1)} h)`;
      });
      const check = checkTravelFeasibility(new Date("2026-01-01"), from, to, "horse");
      return [
        `Strecke: 220 km`,
        ...lines,
        "",
        `Machbarkeit (Pferd, 1 Tag verfügbar): ${check.feasible ? "✓" : "✗"}`,
        `  ${check.message}`,
        `  Benötigt: ${check.requiredDays.toFixed(2)} Tage · Verfügbar: ${check.availableDays.toFixed(2)} Tage`,
      ].join("\n");
    },
  },

  // ── Sicherheit & Backup ───────────────────────────────────────────────────
  {
    id: "authorship-proof",
    label: "Urheberschafts-Beweis",
    icon: "🔐",
    category: "Sicherheit & Backup",
    wp: "WP 29.2",
    hint: "Merkle-Tree und signiertes .aiwsproof-Zertifikat",
    run: async (t) => {
      const chapters = toChapters(t);
      const tree = await buildMerkleTree(chapters);
      const cert = await signProof(tree, {
        title: toTitled(t).title,
        author: "Autor",
        timestamp: Date.now(),
        version: "1.0.0",
      });
      return [
        `Kapitel: ${chapters.length}`,
        `Merkle-Root: ${tree.root.slice(0, 32)}…`,
        `Signatur: ${cert.signature.slice(0, 32)}…`,
        `Ebenen: ${tree.layers.length}`,
        "",
        `Zertifikat für "${cert.metadata.title}" erstellt.`,
      ].join("\n");
    },
  },
  {
    id: "zkp-collaboration",
    label: "Kapitel-Verschlüsselung",
    icon: "🔑",
    category: "Sicherheit & Backup",
    wp: "WP 31.2",
    hint: "AES-256-GCM pro Kapitel und Rollen-Token",
    run: async (t) => {
      const content = t.trim() || "Beispielkapitel";
      const encrypted = await encryptChapter(content.slice(0, 500), "beispiel-schluessel");
      const token = generateRoleToken("lector", ["kap-1", "kap-2"]);
      return [
        `Verschlüsselt: ${encrypted.encryptedData.length} Zeichen`,
        `IV: ${encrypted.iv}`,
        `AuthTag: ${encrypted.authTag}`,
        "",
        `Rollen-Token (${token.role}): ${token.token}`,
        `Kapitel: ${token.chapterIds.join(", ")}`,
      ].join("\n");
    },
  },
  {
    id: "contract-signer",
    label: "Vertragssignatur",
    icon: "✍️",
    category: "Sicherheit & Backup",
    wp: "WP 39.2",
    hint: "Multi-Party-Ed25519-Signatur mit HTML-Prüfbericht",
    run: (t) => {
      const hash = Array.from(t)
        .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
        .toString(16);
      const envelope = createContract(`hash-${hash}`, ["Autor", "Verlag"]);
      const report = generateHtmlReport(envelope);
      return [
        `Dokument-Hash: ${envelope.documentHash}`,
        `Parteien: ${envelope.parties.join(", ")}`,
        `Signatur-Stand: ${envelope.signatures.length}/${envelope.parties.length}`,
        `Version: ${envelope.version}`,
        "",
        `HTML-Prüfbericht: ${report.length} Zeichen`,
        report.slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "disaster-vault",
    label: "Tresor-Integrität",
    icon: "🛡️",
    category: "Sicherheit & Backup",
    wp: "WP 23.2",
    hint: "AES-256-GCM-Vault mit SHA-256-Prüfsummen",
    run: (t) => {
      const bytes = new TextEncoder().encode(t.slice(0, 200));
      const result = verifyIntegrity(bytes);
      return [
        `Geprüfte Bytes: ${bytes.length}`,
        `Integrität: ${result.valid ? "✓ gültig" : "✗ ungültig"}`,
        `Chunks geprüft: ${result.chunksChecked}`,
        "",
        "Hinweis: Für vollständigen Vault-Export Passwort im Panel nötig.",
      ].join("\n");
    },
  },
  {
    id: "social-drm",
    label: "Social DRM",
    icon: "💧",
    category: "Sicherheit & Backup",
    wp: "WP 19.1",
    hint: "Sichtbares Ex-Libris und unsichtbares Wasserzeichen",
    run: (t) => {
      const watermark = generateVisibleWatermark("Leser Mustermann", "ORD-2026-0042");
      return [
        `Ex-Libris SVG: ${watermark.length} Zeichen`,
        "",
        watermark.slice(0, 500),
        "",
        `(Eingabe: ${t.split(/\s+/).length} Wörter Manuskript)`,
      ].join("\n");
    },
  },

  // ── System & KI ───────────────────────────────────────────────────────────
  {
    id: "prompt-workflow",
    label: "Prompt-Workflow",
    icon: "🔗",
    category: "System & KI",
    wp: "WP 17.1",
    hint: "Custom-Assistenten, Prompt-Ketten, Token-Kosten",
    run: (t) => {
      const assistant = createCustomAssistant({
        name: "Dialekt-Übersetzer",
        systemPrompt: "Übersetze Berliner Dialekt in Hochdeutsch.",
        temperature: 0.3,
      });
      const chain = buildPromptChain([
        { id: "s1", prompt: "Fasse die Szene zusammen." },
        { id: "s2", prompt: "Erzeuge Foreshadowing-Tipps." },
        { id: "s3", prompt: "Formuliere als Randkommentar." },
      ]);
      const tokens = estimateTokens(t);
      return [
        `Assistent: ${assistant.config.name} (temp ${assistant.config.temperature})`,
        `Kette: ${chain.name} — ${chain.steps.length} Schritte`,
        fmt(chain.steps.map((s) => s.prompt)),
        "",
        `Tokens (geschätzt): ${tokens}`,
        `Kosten lokal/Ollama: 0,00 Cent`,
        `Kosten Cloud-Beispiel: ${estimateCost(tokens, "openai").toFixed(3)} Cent`,
      ].join("\n");
    },
  },
  {
    id: "engine-turbo",
    label: "VRAM-Profiler",
    icon: "⚡",
    category: "System & KI",
    wp: "WP 25.2",
    hint: "Kontextgröße nach VRAM, Tokens/s, CPU-Fallback",
    run: (t) => {
      const vrams = [2, 6, 12, 24];
      const lines = vrams.map((v) => {
        const cfg = calculateOptimalContext(v, 7);
        const fb = getOfflineFallback(v);
        return `${String(v).padStart(2)} GB VRAM → ${cfg.contextWindow} Kontext, KV-Cache ${cfg.kvCacheSize}, Batch ${cfg.batchSize} · Modus ${fb.mode} (${fb.threads} Threads)`;
      });
      const bench = benchmarkTokensPerSecond(t.slice(0, 200), {
        name: "test",
        size: 7,
        vramRequirement: 6,
      });
      const optimized = optimizePrompt(t);
      return [
        ...lines,
        "",
        `Benchmark: ${bench.tokensPerSecond.toFixed(1)} tok/s (${bench.totalTokens} Tokens, ${bench.durationMs.toFixed(1)} ms)`,
        `Prompt-Optimierung: ${t.length} → ${optimized.length} Zeichen`,
      ].join("\n");
    },
  },
  {
    id: "system-sentinel",
    label: "Performance-Sentinel",
    icon: "📡",
    category: "System & KI",
    wp: "WP 33.2",
    hint: "Laufzeit-Audit, Heap-Profil, Jubiläums-Siegel",
    run: (t) => {
      const latency = auditExecutionLatency(t);
      const heap = profileHeapAllocation();
      const seal = generateJubileeSeal(5296);
      return [
        `Laufzeit: ${latency.durationMs.toFixed(2)} ms für ${latency.words} Wörter`,
        `Budget (< 50 ms): ${latency.withinBudget ? "✓ eingehalten" : "✗ überschritten"}`,
        "",
        `Heap: ${heap.usedHeapMB.toFixed(1)} / ${heap.totalHeapMB} MB`,
        `Detached Nodes: ${heap.detachedNodes} · Lecks: ${heap.leaks.length}`,
        "",
        `Jubiläums-Siegel: ${seal.testCount} Tests · verifiziert: ${seal.verified ? "✓" : "✗"}`,
        `Hash: ${seal.hash}`,
      ].join("\n");
    },
  },
  {
    id: "teleprompter",
    label: "Bühnen-Teleprompter",
    icon: "📢",
    category: "System & KI",
    wp: "WP 27.1",
    hint: "Regieanweisungen parsen und Scroll-Dauer berechnen",
    run: (t) => {
      const lines = parsePerformanceMarkup(t);
      const duration = calculateScrollDuration(t, 130);
      return [
        `Zeilen mit Markup: ${lines.length}`,
        fmt(
          lines.slice(0, 12).map(
            (l) =>
              `${l.text.slice(0, 50)}${l.emphasis ? ` [${l.emphasis}]` : ""}${l.pause ? ` [Pause ${l.pause}s]` : ""}${l.modulation ? ` [${l.modulation}]` : ""}`,
          ),
        ),
        "",
        `Scroll-Dauer bei 130 WPM: ${duration.toFixed(1)} s (${(duration / 60).toFixed(1)} Min.)`,
        "",
        "Stage-Mode-HTML — Auszug:",
        formatStageMode(lines).slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "royalty-calculator",
    label: "Royalty-Rechner",
    icon: "💰",
    category: "System & KI",
    wp: "WP 19.2",
    hint: "Verlagsvorschuss vs. KDP mit Break-Even",
    run: () => {
      const price = 19.99;
      const publisher = calculatePublisherAdvance(5000, [
        { minCopies: 0, maxCopies: 5000, rate: 0.07 },
        { minCopies: 5001, maxCopies: 10000, rate: 0.09 },
        { minCopies: 10001, maxCopies: Infinity, rate: 0.12 },
      ]);
      const kdp = calculateKdpEarnings(price, 1.5, 320, "paperback");
      const be = calculateBreakEven(publisher, kdp);
      return [
        `Verlagsmodell:`,
        `  Brutto: ${publisher.gross.toFixed(2)} € · Agentur: ${publisher.agentFee.toFixed(2)} €`,
        `  Netto: ${publisher.net.toFixed(2)} € · pro Exemplar: ${publisher.perCopy.toFixed(2)} €`,
        "",
        `KDP (${price} €, 320 S., Taschenbuch):`,
        `  Brutto: ${kdp.gross.toFixed(2)} € · Lieferung: ${kdp.deliveryCost.toFixed(2)} € · Druck: ${kdp.printCost.toFixed(2)} €`,
        `  Netto: ${kdp.net.toFixed(2)} € · pro Exemplar: ${kdp.perCopy.toFixed(2)} €`,
        "",
        `Break-Even: ${be.breakEvenCopies} Exemplare`,
        `Empfehlung: ${be.recommendation.toUpperCase()}`,
      ].join("\n");
    },
  },
  {
    id: "beta-reader",
    label: "Beta-Reader-HTML",
    icon: "👥",
    category: "System & KI",
    wp: "WP 14.1",
    hint: "Standalone-Leseexemplar für Testleser",
    run: (t) => {
      const { title, body } = toTitled(t);
      const html = generateReaderHtml(
        { id: "kap-1", title, content: body },
        { darkMode: true, showEmotes: true },
      );
      return [
        `Leseexemplar: ${html.length} Zeichen HTML`,
        `Titel: ${title}`,
        "",
        html.slice(0, 600),
      ].join("\n");
    },
  },
  {
    id: "p2p-sync",
    label: "P2P-Sync-Status",
    icon: "🔀",
    category: "System & KI",
    wp: "WP 14.2",
    hint: "Lokale Peer-Session ohne Cloud",
    run: (t) => {
      const session = createP2PSession("session-1");
      addPeer(session, { id: "peer-1", name: "Co-Autor" });
      const peers = getPeers(session);
      return [
        `WebRTC verfügbar: ${isWebRTCSupported() ? "✓" : "✗"}`,
        `Session: ${session.id}`,
        `Peers: ${peers.length}`,
        fmt(peers.map((p) => `${p.name} (${p.id})`)),
        "",
        `(Manuskript: ${t.split(/\s+/).length} Wörter)`,
      ].join("\n");
    },
  },
  {
    id: "parse-feedback",
    label: "Feedback-Import",
    icon: "📥",
    category: "System & KI",
    wp: "WP 14.1",
    hint: "Parsen einer .aiwsfeedback-Datei",
    run: (t) => {
      try {
        const parsed = parseFeedbackFile(t);
        return [
          `Kommentare: ${parsed.comments.length}`,
          `Emotes: ${parsed.emotes.length}`,
          `Bewertungen: ${parsed.ratings.length}`,
          "",
          fmt(parsed.comments.slice(0, 10).map((c) => `${c.author}: ${c.text}`)),
        ].join("\n");
      } catch {
        return [
          "✗ Kein gültiges .aiwsfeedback-JSON.",
          "",
          "Erwartetes Format:",
          '{ "comments": [], "emotes": [], "ratings": [] }',
        ].join("\n");
      }
    },
  },

  // ── Reachability-Pass (v4.3.0): Sprint 2–22 ────────────────────────────────
  // Diese Services hatten bisher keinen Nicht-Test-Importer und wurden von
  // Vite aus dem Bundle tree-shaked. Jeder Eintrag hier macht sie erreichbar.

  // ── Welt & Recherche ───────────────────────────────────────────────────────
  {
    id: "series-bible",
    label: "Serien-Bibel",
    icon: "📚",
    category: "Welt & Recherche",
    wp: "WP 4.1",
    hint: "Figuren und Entitäten über Buchbände hinweg",
    run: () => {
      try {
        const existing = getAllEntities();
        if (existing.length === 0) {
          createSeriesEntity({
            id: "ent-demo",
            name: "Mira Halden",
            type: "character",
            firstAppearance: 1,
            attributes: { rolle: "Protagonistin" },
          });
        }
        const entities = getAllEntities();
        return [
          "Serien-Bibel — Entitäten",
          "",
          fmt(entities.map((e) => `${e.name} (${e.type}, ab Band ${e.firstAppearance})`)),
          "",
          `Entitäten gesamt: ${entities.length}`,
        ].join("\n");
      } catch (err) {
        return `✗ Serien-Bibel: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
  {
    id: "spoiler-guard",
    label: "Spoiler-Wächter",
    icon: "🚫",
    category: "Welt & Recherche",
    wp: "WP 4.1",
    hint: "Prüft Text auf Spoiler für frühere Bände",
    run: (t) => {
      const currentBook = firstNumber(t, 2);
      const text = t.replace(/\d+/g, "").trim() || t;
      const warnings = checkSpoilerGuard(text, currentBook);
      return [
        `Spoiler-Wächter (aktueller Band: ${currentBook})`,
        "",
        warnings.length === 0
          ? "✓ Keine Spoiler-Warnungen."
          : fmt(warnings.map((w) => `${w.entityName} (Band ${w.entityBook}): ${w.message}`)),
        "",
        `Warnungen: ${warnings.length}`,
      ].join("\n");
    },
  },
  {
    id: "codex-search",
    label: "Recherche-Codex",
    icon: "🔎",
    category: "Welt & Recherche",
    wp: "WP 4.2",
    hint: "Durchsucht das Welt-Lexikon und findet Backlinks",
    run: (t) => {
      const query = t.split("\n")[0].trim().slice(0, 60) || "Mira";
      const hits = searchCodex(query);
      const backlinks = getBacklinks(query);
      return [
        `Recherche-Codex — Suche: „${query}“`,
        "",
        hits.length === 0
          ? "(keine Treffer)"
          : fmt(hits.map((h) => `${h.title} (${h.type}): ${h.content.slice(0, 80)}`)),
        "",
        `Backlinks: ${backlinks.length > 0 ? backlinks.join(", ") : "—"}`,
      ].join("\n");
    },
  },
  {
    id: "codex-create",
    label: "Codex-Eintrag anlegen",
    icon: "➕",
    category: "Welt & Recherche",
    wp: "WP 4.2",
    hint: "Legt einen neuen Lexikon-Eintrag an",
    run: (t) => {
      const kv = toKeyValue(t);
      const title = kv["titel"] ?? kv["title"] ?? (t.split("\n")[0].trim().slice(0, 60) || "Neuer Eintrag");
      const content = kv["inhalt"] ?? kv["content"] ?? t;
      try {
        const entry = createCodexEntry({
          id: `codex-${Date.now()}`,
          title,
          type: "location",
          tags: ["import"],
          content,
        });
        return [
          "✓ Codex-Eintrag angelegt",
          "",
          `Titel: ${entry.title}`,
          `Typ: ${entry.type}`,
          `ID: ${entry.id}`,
        ].join("\n");
      } catch (err) {
        return `✗ ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },

  // ── Schreib-Produktivität ──────────────────────────────────────────────────
  {
    id: "sprint-stats",
    label: "Schreib-Sprint",
    icon: "⏱️",
    category: "Schreib-Produktivität",
    wp: "WP 4.3",
    hint: "Erfasst einen Sprint und zeigt die Tagesstatistik",
    run: (t) => {
      const words = firstNumber(t, 500);
      const stats = getTodayStats();
      return [
        "Schreib-Sprint",
        "",
        `Presets: ${SPRINT_PRESETS.map((p) => `${p.label} (${p.wordGoal} Wörter)`).join(", ")}`,
        "",
        `Heute: ${stats.sprints} Sprints, ${stats.words} Wörter, ${stats.minutes} Min.`,
        "",
        `Aktuelle Eingabe: ${words} Wörter erkannt`,
      ].join("\n");
    },
  },
  {
    id: "sprint-record",
    label: "Sprint eintragen",
    icon: "✅",
    category: "Schreib-Produktivität",
    wp: "WP 4.3",
    hint: "Trägt Wörter und Minuten in die Statistik ein",
    run: (t) => {
      const words = firstNumber(t, 300);
      const stats = recordSprint(words, 15);
      return [
        "✓ Sprint eingetragen",
        "",
        `Sprints gesamt: ${stats.totalSprints}`,
        `Wörter gesamt: ${stats.totalWords}`,
        `Streak: ${stats.currentStreak} (Best: ${stats.bestStreak})`,
      ].join("\n");
    },
  },
  {
    id: "time-machine",
    label: "Zeitmaschine",
    icon: "⏳",
    category: "Schreib-Produktivität",
    wp: "WP 11.1",
    hint: "Mikro-Snapshots anlegen und vergleichen",
    run: (t) => {
      const content = t.trim() || "Leerer Text";
      const before = createMicroSnapshot("werkzeug-projekt", "kap-1", content);
      const after = createMicroSnapshot(
        "werkzeug-projekt",
        "kap-1",
        `${content}\n\n(Ergänzung durch Zeitmaschine)`,
      );
      const diff = diffMicroSnapshots(before, after);
      const all = listMicroSnapshots("werkzeug-projekt", "kap-1");
      return [
        "Zeitmaschine — Mikro-Snapshots",
        "",
        `Snapshots gespeichert: ${all.length}`,
        `Textlänge vorher: ${content.length} Zeichen`,
        "",
        `Diff: +${diff.added.length} / -${diff.removed.length} Einträge`,
      ].join("\n");
    },
  },
  {
    id: "content-hash",
    label: "Inhalts-Hash",
    icon: "🔐",
    category: "Schreib-Produktivität",
    wp: "WP 18.1",
    hint: "Berechnet den Inhalts-Hash für den Werkzeug-Verlauf",
    run: async (t) => {
      const hash = await computeContentHash(t);
      const metrics = normalizeToolMetrics({
        wordCount: t.split(/\s+/).filter(Boolean).length,
        readability: 62,
      });
      return [
        "Inhalts-Hash",
        "",
        `Hash: ${hash}`,
        "",
        `Wörter: ${metrics.wordCount ?? 0}`,
        `Lesbarkeit: ${metrics.readability ?? "—"}`,
      ].join("\n");
    },
  },
  {
    id: "metrics-diff",
    label: "Metrik-Vergleich",
    icon: "📊",
    category: "Schreib-Produktivität",
    wp: "WP 18.1",
    hint: "Vergleicht zwei Metrik-Sätze (vorher/nachher)",
    run: (t) => {
      const n = firstNumber(t, 100);
      const diff = diffMetrics({ readability: n, wordCount: n * 10 }, { readability: n + 8, wordCount: n * 11 });
      return [
        "Metrik-Vergleich",
        "",
        diff.changes.length === 0
          ? "(keine Änderungen)"
          : fmt(diff.changes.map((c) => `${c.metric}: ${c.before} → ${c.after} (${c.deltaPercent}%, ${c.direction})`)),
        "",
        `Änderungen: ${diff.changes.length}`,
      ].join("\n");
    },
  },
  {
    id: "export-guard",
    label: "Export-Guard",
    icon: "🛡️",
    category: "Schreib-Produktivität",
    wp: "WP 21.1",
    hint: "Prüft offene Track-Changes vor dem Export",
    run: (t) => {
      try {
        const state = buildTrackChangeState(t.trim() || "Ein kurzer Beispielsatz.");
        const result = checkExportGuard(state);
        return [
          "Export-Guard",
          "",
          `Export erlaubt: ${result.allowed ? "ja" : "nein"}`,
          `Offene Track-Changes: ${result.openChanges}`,
          "",
          result.message ?? "✓ Keine offenen Lektoratsänderungen.",
        ].join("\n");
      } catch (err) {
        return `✗ Export-Guard: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
  {
    id: "dictation-normalize",
    label: "Diktat-Normalisierung",
    icon: "🎤",
    category: "Schreib-Produktivität",
    wp: "WP 9.2",
    hint: "Wandelt gesprochene Zeichensetzung in Text um",
    run: (t) => {
      const normalized = normalizeSpokenText(t);
      return [
        "Diktat-Normalisierung",
        "",
        `Eingabe: ${t.length} Zeichen`,
        `Ausgabe: ${normalized.length} Zeichen`,
        "",
        normalized || "(leer)",
      ].join("\n");
    },
  },

  // ── Medien-Produktion ──────────────────────────────────────────────────────
  {
    id: "blurb-studio",
    label: "Klappentext-Studio",
    icon: "📖",
    category: "Medien-Produktion",
    wp: "WP 4.4",
    hint: "Generiert einen Klappentext nach Buchformel",
    run: (t) => {
      const kv = toKeyValue(t);
      const blurb = generateBlurb("hook-trouble-choice", {
        title: kv["titel"] ?? "Der letzte Zeuge",
        genre: kv["genre"] ?? "Thriller",
        protagonist: kv["protagonist"] ?? "Mira",
        conflict: kv["konflikt"] ?? "ein Verbrechen, das niemand sehen wollte",
        stakes: kv["einsatz"] ?? "ihr Leben",
      });
      return ["Klappentext-Studio", "", blurb].join("\n");
    },
  },
  {
    id: "kdp-keywords",
    label: "KDP-Keywords",
    icon: "🔑",
    category: "Medien-Produktion",
    wp: "WP 4.4",
    hint: "Analysiert Text auf KDP-taugliche Schlagwörter",
    run: (t) => {
      const keywords = analyzeKdpKeywords(t);
      return [
        "KDP-Keywords",
        "",
        keywords.length === 0
          ? "(keine Schlagwörter gefunden)"
          : fmt(keywords.slice(0, 20)),
        "",
        `Schlagwörter: ${keywords.length}`,
      ].join("\n");
    },
  },
  {
    id: "quote-card",
    label: "Zitat-Karte",
    icon: "💬",
    category: "Medien-Produktion",
    wp: "WP 4.4",
    hint: "Erzeugt eine Zitat-Karte als SVG",
    run: (t) => {
      const quote = t.trim().split("\n")[0].slice(0, 200) || "Ein gutes Zitat.";
      const svg = generateQuoteCard(quote, { width: 800, height: 400 });
      return [
        "Zitat-Karte",
        "",
        `Zitat: ${quote}`,
        `SVG-Größe: ${svg.length} Zeichen`,
        "",
        svg.slice(0, 300) + (svg.length > 300 ? " …" : ""),
      ].join("\n");
    },
  },
  {
    id: "quality-report",
    label: "Qualitätsbericht",
    icon: "📋",
    category: "Medien-Produktion",
    wp: "WP 17.1",
    hint: "Erstellt einen Kapitel-Qualitätsbericht mit Trend",
    run: (t) => {
      const chapters = toBookChapterInputs(t);
      const book = { title: "Werkzeug-Bericht", chapters };
      const scores = toChapterScores(book);
      return [
        "Qualitätsbericht",
        "",
        buildTrendChart(scores),
        "",
        "Top-Empfehlungen:",
        fmt(topSuggestions(scores, 3)),
        "",
        `Kapitel: ${chapters.length}`,
        `Markdown-Länge: ${buildQualityMarkdown(book).length} Zeichen`,
      ].join("\n");
    },
  },
  {
    id: "style-guide",
    label: "Stil-Leitfaden",
    icon: "📐",
    category: "Medien-Produktion",
    wp: "WP 17.2",
    hint: "Prüft Text gegen einen Stil-Leitfaden",
    run: (t) => {
      const guide = createStyleGuide({
        forbiddenWords: [{ word: "irgendwie", suggestion: "auf eine bestimmte Weise" }],
        preferredTerms: [{ wrong: "Portemonnaie", preferred: "Geldbeutel" }],
      });
      const findings = checkAgainstGuide(t, guide);
      const fixed = findings.length > 0 ? applyFix(t, findings[0]) : t;
      return [
        "Stil-Leitfaden",
        "",
        findings.length === 0
          ? "✓ Keine Stil-Verstöße gefunden."
          : fmt(findings.map((f) => `${f.kind}: „${f.found}“ → „${f.expected ?? f.suggestion ?? "—"}“`)),
        "",
        `Befunde: ${findings.length}`,
        findings.length > 0 ? `Beispiel-Korrektur: ${fixed.slice(0, 120)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    id: "cover-studio",
    label: "Cover-Studio",
    icon: "🎨",
    category: "Medien-Produktion",
    wp: "WP 10.2",
    hint: "Berechnet Rückenbreite und erzeugt ein Cover-SVG",
    run: (t) => {
      const kv = toKeyValue(t);
      const title = kv["titel"] ?? (t.split("\n")[0].trim().slice(0, 60) || "Ohne Titel");
      const author = kv["autor"] ?? "Unbekannt";
      const words = t.split(/\s+/).filter(Boolean).length;
      const pages = estimatePageCount(words);
      const spine = calculateSpineWidth(pages, "white");
      const svg = generateCoverSvg(title, author, spine);
      return [
        "Cover-Studio",
        "",
        `Titel: ${title}`,
        `Autor: ${author}`,
        `Wörter: ${words} → ca. ${pages} Seiten`,
        `Rückenbreite: ${spine.toFixed(2)} mm`,
        `Papiersorten: ${Object.keys(PAPER_TYPES).join(", ")}`,
        `SVG-Größe: ${svg.length} Zeichen`,
      ].join("\n");
    },
  },
  {
    id: "print-master",
    label: "Print-Master",
    icon: "🖨️",
    category: "Medien-Produktion",
    wp: "WP 10.1",
    hint: "KDP-Druckmaße: Bundsteg, Recto/Verso, Leerseiten",
    run: (t) => {
      const chapters = normalizeChapters(toBookChapterInputs(t));
      const pages = estimatePageCount(t.split(/\s+/).filter(Boolean).length);
      const gutter = gutterForPageCount(pages);
      return [
        "Print-Master",
        "",
        `Kapitel: ${chapters.length}`,
        `Seiten (geschätzt): ${pages}`,
        `Bundsteg: ${gutter.toFixed(2)} mm`,
        `Seite ${pages} ist ${isRecto(pages) ? "Recto (rechts)" : "Verso (links)"}`,
        `Leerseiten davor: ${blankPagesBefore(pages)}`,
        "",
        `Stabile UUID: ${stableUuid(chapters[0]?.title ?? "kapitel")}`,
      ].join("\n");
    },
  },
  {
    id: "kdp-backoff",
    label: "KDP-Retry-Backoff",
    icon: "🔁",
    category: "Medien-Produktion",
    wp: "WP 9.1",
    hint: "Berechnet Wartezeiten für KDP-Upload-Wiederholungen",
    run: (t) => {
      const attempts = Math.min(6, Math.max(1, firstNumber(t, 3)));
      const delays = Array.from({ length: attempts }, (_, i) => computeBackoffDelay(i + 1));
      return [
        "KDP-Retry-Backoff",
        "",
        fmt(delays.map((d, i) => `Versuch ${i + 1}: ${d} ms`)),
        "",
        `Versuche: ${attempts}`,
      ].join("\n");
    },
  },
  {
    id: "testbook",
    label: "Testbuch-Generator",
    icon: "🧪",
    category: "Medien-Produktion",
    wp: "WP 2.1",
    hint: "Erzeugt ein vollständiges Testbuch mit Kapitel-Status",
    run: () => {
      const book = makeTestBook();
      return [
        "Testbuch-Generator",
        "",
        `Titel: ${book.title}`,
        `Autor: ${book.author}`,
        `Kapitel: ${book.chapters.length}`,
        "",
        fmt(book.chapters.map((c) => `${c.title} [${c.status}]`)),
      ].join("\n");
    },
  },
  {
    id: "article-prompt",
    label: "Artikel-Prompt",
    icon: "📰",
    category: "Medien-Produktion",
    wp: "WP 16.1",
    hint: "Baut einen Artikel-Prompt aus Suchtreffern",
    run: (t) => {
      const results = toHeadlineBody(t);
      try {
        const prompt = buildArticlePrompt(
          [{ title: results.headline, text: results.body }],
          ARTICLE_STYLES[0],
        );
        return [
          "Artikel-Prompt",
          "",
          `Stile: ${ARTICLE_STYLES.join(", ")}`,
          "",
          prompt.slice(0, 600),
        ].join("\n");
      } catch (err) {
        return `✗ ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  },
  {
    id: "headline-image",
    label: "Schlagzeilen-Bild",
    icon: "🖼️",
    category: "Medien-Produktion",
    wp: "WP 16.2",
    hint: "Erzeugt Bild-Prompts für Schlagzeilen und Artikel",
    run: (t) => {
      const { headline, body } = toHeadlineBody(t);
      return [
        "Schlagzeilen-Bild",
        "",
        `Schlagzeile: ${headline}`,
        "",
        `Headline-Prompt: ${buildHeadlineImagePrompt(headline)}`,
        "",
        `Artikel-Prompt: ${buildArticleImagePrompt(body.slice(0, 120))}`,
      ].join("\n");
    },
  },
  {
    id: "newspaper-layout",
    label: "Zeitungslayout",
    icon: "🗞️",
    category: "Medien-Produktion",
    wp: "WP 16.3",
    hint: "Setzt Artikel in ein mehrspaltiges Zeitungslayout",
    run: (t) => {
      const parts = toChapters(t);
      const articles = parts.map((content, i) => {
        const { headline, body } = toHeadlineBody(content);
        return {
          id: `art-${i + 1}`,
          headline,
          body,
          priority: i === 0 ? ("lead" as const) : ("normal" as const),
        };
      });
      const newspaper = buildNewspaper(articles);
      const md = newspaperToMarkdown(newspaper, articles);
      return [
        "Zeitungslayout",
        "",
        `Artikel: ${articles.length}`,
        `Seiten: ${newspaper.pages.length}`,
        `Inhaltsverzeichnis: ${newspaper.toc.length} Einträge`,
        "",
        md.slice(0, 500) + (md.length > 500 ? " …" : ""),
      ].join("\n");
    },
  },
  {
    id: "converter",
    label: "Format-Konverter",
    icon: "🔄",
    category: "Medien-Produktion",
    wp: "WP 22.1",
    hint: "Konvertiert zwischen Markdown, HTML und Klartext",
    run: async (t) => {
      const plain = toPlainText(t, "markdown");
      const html = await markdownToHtml(t);
      return [
        "Format-Konverter",
        "",
        `Klartext (${plain.length} Zeichen):`,
        plain.slice(0, 200) + (plain.length > 200 ? " …" : ""),
        "",
        `HTML (${html.length} Zeichen):`,
        html.slice(0, 300) + (html.length > 300 ? " …" : ""),
      ].join("\n");
    },
  },
  {
    id: "export-validate",
    label: "Export-Validierung",
    icon: "🔍",
    category: "Medien-Produktion",
    wp: "WP 10.3",
    hint: "Prüft XML-Wohlgeformtheit exportierter Dateien",
    run: async (t) => {
      const sample = t.trim().startsWith("<")
        ? t
        : `<doc><p>${t.slice(0, 200).replace(/[<>&]/g, "")}</p></doc>`;
      const xml = checkXmlWellFormed(sample);
      const blob = new Blob([sample], { type: "application/xml" });
      const validation = await validateExportBlob(blob, "epub");
      return [
        "Export-Validierung",
        "",
        `XML wohlgeformt: ${xml.ok ? "ja" : "nein"}`,
        xml.error ? `XML-Fehler: ${xml.error}` : "✓ Keine XML-Fehler",
        "",
        `EPUB-Prüfung: ${validation.ok ? "bestanden" : "fehlgeschlagen"} (${validation.issues.length} Befunde)`,
      ].join("\n");
    },
  },
  {
    id: "bilingual-export",
    label: "Bilingualer Export",
    icon: "🌐",
    category: "Medien-Produktion",
    wp: "WP 15.1",
    hint: "Erzeugt zweisprachiges Markdown DE/EN",
    run: (t) => {
      const parts = toChapters(t);
      const chapters = parts.map((content, i) => ({
        id: `bkap-${i + 1}`,
        titleDe: `Kapitel ${i + 1}`,
        titleEn: `Chapter ${i + 1}`,
        contentDe: content,
        contentEn: contentToMarkdown(content),
      }));
      const book = { id: "bilingual-werkzeug", title: "Zweisprachiges Buch", chapters };
      const md = buildBilingualMarkdown(book);
      return [
        "Bilingualer Export",
        "",
        `Kapitel: ${chapters.length}`,
        `Markdown-Länge: ${md.length} Zeichen`,
        "",
        md.slice(0, 400) + (md.length > 400 ? " …" : ""),
      ].join("\n");
    },
  },
  {
    id: "compact-prompts",
    label: "Kompakt-Prompts",
    icon: "🧩",
    category: "Medien-Produktion",
    wp: "WP 7.1",
    hint: "Zeigt kompakte System-Prompts für lokale Modelle",
    run: (t) => {
      const model = t.split("\n")[0].trim().slice(0, 40) || "llama3";
      const profile = compactProfile(model);
      const savings = compactSavings(model);
      return [
        "Kompakt-Prompts",
        "",
        `Modell: ${model}`,
        `Familie: ${profile.family ?? "—"}`,
        `Ersparnis: ${typeof savings === "number" ? `${savings}%` : fmt(savings)}`,
        "",
        `System-Prompt (${profile.systemPrompt.length} Zeichen):`,
        profile.systemPrompt.slice(0, 300),
      ].join("\n");
    },
  },
  {
    id: "bilingual-templates",
    label: "Bilinguale Templates",
    icon: "📑",
    category: "Medien-Produktion",
    wp: "WP 15.2",
    hint: "Listet die Übersetzungs-Templates und zeigt eines an",
    run: () => {
      const ids = listBilingualTemplateIds();
      const first = ids.length > 0 ? getBilingualTemplate(ids[0]) : null;
      return [
        "Bilinguale Templates",
        "",
        `Verfügbar (${ids.length}): ${ids.join(", ")}`,
        "",
        first ? `Template „${first.id}“:\n${first.template.slice(0, 400)}` : "(keine Templates)",
      ].join("\n");
    },
  },
  {
    id: "image-prompt",
    label: "Bild-Prompt",
    icon: "🖌️",
    category: "Medien-Produktion",
    wp: "WP 14.3",
    hint: "Erzeugt einen Bild-Prompt aus Kapiteltext",
    run: (t) => {
      const prompt = buildImagePrompt(t, DEFAULT_IMAGE_STYLE);
      return [
        "Bild-Prompt",
        "",
        `Stile: ${Object.keys(IMAGE_STYLE_PRESETS).join(", ")}`,
        "",
        prompt,
      ].join("\n");
    },
  },
  {
    id: "batch-runner",
    label: "Batch-Analyse",
    icon: "⚙️",
    category: "Medien-Produktion",
    wp: "WP 18.2",
    hint: "Führt mehrere Analyse-Werkzeuge über alle Kapitel aus",
    run: async (t) => {
      const chapters = toChapters(t).map((content, i) => ({
        id: `bkap-${i + 1}`,
        title: `Kapitel ${i + 1}`,
        content,
      }));
      const tools = [
        {
          id: "wordcount",
          label: "Wortzahl",
          category: "Analyse",
          run: (text: string) => `${text.split(/\s+/).filter(Boolean).length} Wörter`,
        },
      ];
      const report = await runBatchAnalysis(chapters, tools);
      const summary = summarizeReport(report);
      return [
        "Batch-Analyse",
        "",
        `Kapitel geprüft: ${report.chaptersScanned}`,
        `Werkzeuge: ${report.toolsRun}`,
        `Dauer: ${report.durationMs} ms`,
        "",
        `Befunde: ${summary.total} (${summary.errors} Fehler, ${summary.warnings} Warnungen, ${summary.infos} Hinweise)`,
      ].join("\n");
    },
  },
  {
    id: "backup-validate",
    label: "Backup-Validierung",
    icon: "💾",
    category: "Medien-Produktion",
    wp: "WP 14.1",
    hint: "Prüft ein Bild-Backup-JSON auf Gültigkeit",
    run: (t) => {
      const result = validateBackupWithImages(t);
      if (!result.ok) {
        return [
          "Backup-Validierung",
          "",
          `✗ Ungültig: ${result.error}`,
          "",
          "Erwartetes Format: { \"version\": 1, \"images\": [...] }",
        ].join("\n");
      }
      return [
        "Backup-Validierung",
        "",
        "✓ Backup gültig",
        `Bilder: ${result.backup.images?.length ?? 0}`,
      ].join("\n");
    },
  },
  {
    id: "security-audit",
    label: "Sicherheits-Audit",
    icon: "🔒",
    category: "Medien-Produktion",
    wp: "WP 8.1",
    hint: "Erzeugt den Sicherheits-Audit-Bericht",
    run: () => {
      const report = generateSecurityAuditReport();
      return [
        "Sicherheits-Audit",
        "",
        `Befunde: ${report.findings.length}`,
        "",
        fmt(report.findings.map((f) => `[${f.severity}] ${f.title}: ${f.description}`)),
      ].join("\n");
    },
  },
  {
    id: "shutdown-tasks",
    label: "Shutdown-Tasks",
    icon: "🛑",
    category: "Medien-Produktion",
    wp: "WP 8.3",
    hint: "Registriert die Standard-Aufräum-Tasks beim Beenden",
    run: () => {
      registerDefaultShutdownTasks();
      return [
        "Shutdown-Tasks",
        "",
        "✓ Standard-Tasks registriert:",
        "  • flush-pending-jobs",
        "  • persist-database",
        "",
        `Timeout pro Task: ${DEFAULT_SHUTDOWN_TASK_TIMEOUT_MS} ms`,
      ].join("\n");
    },
  },
  {
    id: "lazy-modules",
    label: "Lazy-Module",
    icon: "📦",
    category: "Medien-Produktion",
    wp: "WP 8.4",
    hint: "Listet die verzögert geladenen Schwerlast-Module",
    run: () => {
      return [
        "Lazy-Module",
        "",
        `Module (${HEAVY_MODULES.length}):`,
        fmt(HEAVY_MODULES.map((m) => `${m.name} — ${m.reason}`)),
      ].join("\n");
    },
  },
];

/** Alle Tools einer Kategorie. */
export function toolsByCategory(category: string): ToolDef[] {
  return TOOLS.filter((tool) => tool.category === category);
}

/** Tool per ID. */
export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
