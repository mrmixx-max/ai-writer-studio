// Leser-Empathie- & Tränen-Heatmap (WP 71.1)
//
// Bestseller-Autoren wollen wissen, wo die emotionalen Höhepunkte sitzen:
// Wo weint der Leser? Wo bekommt er Gänsehaut? Wo stockt ihm der Atem?
//
// Vier physiologische Reaktions-Heuristiken:
//   - Tränenfluss (Lacrimal Reflex)
//   - Gänsehaut (Piloerection)
//   - Lach-Dichte
//   - Puls- & Adrenalin-Spitze
//
// Design-Regeln (analog den übrigen Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Physiologische Reaktionsart. */
export type ReactionKind = 'tears' | 'goosebumps' | 'laughter' | 'adrenaline';

/** Ein Absatz mit seinen Reaktionswerten. */
export interface ParagraphReaction {
  /** 1-basierte Absatznummer. */
  index: number;
  /** Erste Zeichen des Absatzes (für die Anzeige). */
  preview: string;
  /** Wortzahl. */
  wordCount: number;
  /** Tränenfluss-Wahrscheinlichkeit (0–100). */
  tears: number;
  /** Gänsehaut-Index (0–100). */
  goosebumps: number;
  /** Lach- & Schmunzel-Dichte (0–100). */
  laughter: number;
  /** Puls- & Adrenalin-Spitze (0–100). */
  adrenaline: number;
  /** Dominante Reaktion dieses Absatzes. */
  dominant: ReactionKind;
  /** Höchstwert (0–100). */
  peak: number;
}

/** Ein emotionaler Hotspot. */
export interface EmpathyHotspot {
  /** Absatznummer. */
  paragraph: number;
  /** Reaktionsart. */
  kind: ReactionKind;
  /** Intensität (0–100). */
  intensity: number;
  /** Menschenlesbare Beschreibung. */
  label: string;
}

/** Ergebnis der Heatmap-Analyse. */
export interface EmpathyHeatmap {
  /** Alle Absätze mit Werten. */
  paragraphs: ParagraphReaction[];
  /** Die stärksten Hotspots (absteigend). */
  hotspots: EmpathyHotspot[];
  /** Durchschnitt je Reaktion über alle Absätze. */
  averages: Record<ReactionKind, number>;
  /** Gesamtwortzahl. */
  totalWords: number;
  /** Absatz mit dem höchsten Gesamtwert. */
  climaxParagraph: number | null;
}

// ---------------------------------------------------------------------------
// Signalwörter (regex-basiert, damit Flexionen greifen)
// ---------------------------------------------------------------------------

/** Marker je Reaktionsart als Regex-Quellen. */
export const REACTION_MARKERS: Record<ReactionKind, readonly string[]> = {
  tears: [
    '\\b(wein|trän|schluchz|trauer|verlust|abschied|trenn|begräbnis|totenbett)',
    '\\b(opfer|opferbereit|hingab|bittersüß|erinnerung|vermächtnis)',
    '\\b(sterb|gestorben|letzte[rn]? (Wort|Atemzug|Blick))',
    '\\b(umarm|tröst|verzeih|vergebung)',
    '\\b(allein|einsam|zurückgelassen)',
  ],
  goosebumps: [
    '\\b(katharsis|erlösung|erhaben|schauer|gänsehaut)',
    '\\b(episch|monumental|gewaltig|unfassbar)',
    '\\b(enthüll|offenbar|wahrheit|schicksal|prophezeiung)',
    '\\b(rettung|gerettet|unverhofft|im letzten Moment)',
    '\\b(heil|wunder|aufersteh|verwandl)',
  ],
  laughter: [
    '\\b(lach|kicher|grins|schmunzel|kicherte|amüsier)',
    '\\b(witz|ironie|spott|sarkas|schlagfertig)',
    '\\b(peinlich|missgeschick|patzer|stolper|daneben)',
    '\\b(absurd|lächerlich|albern|skurril)',
    '\\b(seufz|augenroll|stirnrunzel)',
  ],
  adrenaline: [
    '\\b(ticken|Uhr|Sekunden|Countdown|Zeit läuft)',
    '\\b(Gefahr|Bedrohung|Angriff|Schuss|Explosion|Feuer)',
    '\\b(flieh|renn|jagd|verfolg|hetz)',
    '\\b(Angst|Panik|Schreck|Entsetzen|Grauen)',
    '\\b(schnell|sofort|jetzt|keine Zeit)',
    '\\b(Messer|Waffe|Blut|Wunde|Schmerz)',
  ],
};

/** Menschenlesbare Namen der Reaktionen. */
export const REACTION_LABELS: Record<ReactionKind, string> = {
  tears: 'Tränenfluss',
  goosebumps: 'Gänsehaut',
  laughter: 'Lachen',
  adrenaline: 'Adrenalin',
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zahl auf einen Bereich begrenzen. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rundet auf 2 Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Wortzahl eines Textes. */
function countWords(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Zählt Marker-Treffer einer Reaktionsart.
 *
 * Frisches Regex-Objekt je Marker, damit `lastIndex` nicht zwischen Aufrufen
 * leckt (siehe Skill-Regel zu Phrasen-Markern).
 */
function countMarkers(text: string, kind: ReactionKind): number {
  let hits = 0;
  for (const source of REACTION_MARKERS[kind]) {
    const re = new RegExp(source, 'gi');
    const matches = text.match(re);
    if (matches) hits += matches.length;
  }
  return hits;
}

/**
 * Wandelt eine Trefferzahl in einen 0–100-Wert um.
 *
 * Die Sättigung ist bewusst niedrig angesetzt: schon zwei bis drei Treffer in
 * einem Absatz sind ein deutliches Signal, nicht erst zwanzig.
 */
function scoreFromHits(hits: number, wordCount: number): number {
  if (hits === 0 || wordCount === 0) return 0;
  // Trefferdichte je 100 Wörter, mit Sättigung bei 4 Treffern.
  const density = (hits / Math.max(1, wordCount)) * 100;
  return Math.round(clamp((density / 4) * 100, 0, 100));
}

// ---------------------------------------------------------------------------
// 1) Heatmap-Analyse
// ---------------------------------------------------------------------------

/**
 * Zerlegt Text in Absätze und bewertet jeden nach vier physiologischen
 * Reaktions-Heuristiken.
 *
 * Defensiv: leerer Text liefert eine leere Heatmap.
 */
export function analyzeEmpathyHeatmap(text: string): EmpathyHeatmap {
  const raw = typeof text === 'string' ? text : '';
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const totalWords = countWords(raw);
  const sums: Record<ReactionKind, number> = { tears: 0, goosebumps: 0, laughter: 0, adrenaline: 0 };

  const rows: ParagraphReaction[] = paragraphs.map((p, i) => {
    const words = countWords(p);
    const tears = scoreFromHits(countMarkers(p, 'tears'), words);
    const goosebumps = scoreFromHits(countMarkers(p, 'goosebumps'), words);
    const laughter = scoreFromHits(countMarkers(p, 'laughter'), words);
    const adrenaline = scoreFromHits(countMarkers(p, 'adrenaline'), words);

    sums.tears += tears;
    sums.goosebumps += goosebumps;
    sums.laughter += laughter;
    sums.adrenaline += adrenaline;

    const values: Array<[ReactionKind, number]> = [
      ['tears', tears],
      ['goosebumps', goosebumps],
      ['laughter', laughter],
      ['adrenaline', adrenaline],
    ];
    // Bei Gleichstand gewinnt die zuerst geprüfte Reaktion (deterministisch).
    let dominant: ReactionKind = 'tears';
    let peak = -1;
    for (const [kind, value] of values) {
      if (value > peak) {
        peak = value;
        dominant = kind;
      }
    }

    return {
      index: i + 1,
      preview: p.slice(0, 80),
      wordCount: words,
      tears,
      goosebumps,
      laughter,
      adrenaline,
      dominant,
      peak: peak < 0 ? 0 : peak,
    };
  });

  // Durchschnitte.
  const n = Math.max(1, rows.length);
  const averages: Record<ReactionKind, number> = {
    tears: round2(sums.tears / n),
    goosebumps: round2(sums.goosebumps / n),
    laughter: round2(sums.laughter / n),
    adrenaline: round2(sums.adrenaline / n),
  };

  // Hotspots: jeder Absatz mit einem Wert ≥ 40 erzeugt einen Eintrag.
  const hotspots: EmpathyHotspot[] = [];
  for (const row of rows) {
    const values: Array<[ReactionKind, number]> = [
      ['tears', row.tears],
      ['goosebumps', row.goosebumps],
      ['laughter', row.laughter],
      ['adrenaline', row.adrenaline],
    ];
    for (const [kind, intensity] of values) {
      if (intensity >= 40) {
        hotspots.push({
          paragraph: row.index,
          kind,
          intensity,
          label: `${REACTION_LABELS[kind]} in Absatz ${row.index} (${intensity}%)`,
        });
      }
    }
  }
  hotspots.sort((a, b) => b.intensity - a.intensity || a.paragraph - b.paragraph);

  // Klimax: Absatz mit dem höchsten Einzelwert.
  let climaxParagraph: number | null = null;
  let climaxPeak = -1;
  for (const row of rows) {
    if (row.peak > climaxPeak) {
      climaxPeak = row.peak;
      climaxParagraph = row.index;
    }
  }

  return {
    paragraphs: rows,
    hotspots,
    averages,
    totalWords,
    climaxParagraph: climaxPeak > 0 ? climaxParagraph : null,
  };
}

// ---------------------------------------------------------------------------
// 2) Glow-Intensität für die UI
// ---------------------------------------------------------------------------

/**
 * Rechnet einen Reaktionswert in eine CSS-Deckkraft für die Glow-Schicht um.
 *
 * Die UI legt diese Deckkraft über einen Farbverlauf; der Wert bleibt bewusst
 * unter 1, damit der Text lesbar bleibt.
 *
 * Defensiv: Werte außerhalb 0–100 werden begrenzt.
 */
export function glowOpacity(intensity: number): number {
  const safe = clamp(typeof intensity === 'number' && Number.isFinite(intensity) ? intensity : 0, 0, 100);
  return round2(clamp(safe / 140, 0, 0.7));
}

// ---------------------------------------------------------------------------
// 3) Zusammenfassung
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine menschenlesbare Zusammenfassung der Heatmap.
 *
 * Defensiv: eine leere Heatmap liefert einen Hinweis-Text.
 */
export function summarizeHeatmap(heatmap: EmpathyHeatmap | null | undefined): string {
  if (!heatmap || heatmap.paragraphs.length === 0) {
    return 'Keine Absätze analysiert.';
  }

  const lines: string[] = [
    `Empathie-Heatmap: ${heatmap.paragraphs.length} Absätze, ${heatmap.totalWords} Wörter`,
    '',
    'Durchschnittliche Reaktionsstärke:',
    `  ${REACTION_LABELS.tears}:      ${heatmap.averages.tears}%`,
    `  ${REACTION_LABELS.goosebumps}: ${heatmap.averages.goosebumps}%`,
    `  ${REACTION_LABELS.laughter}:   ${heatmap.averages.laughter}%`,
    `  ${REACTION_LABELS.adrenaline}: ${heatmap.averages.adrenaline}%`,
    '',
  ];

  if (heatmap.climaxParagraph !== null) {
    const row = heatmap.paragraphs.find((p) => p.index === heatmap.climaxParagraph);
    lines.push(`Emotionaler Höhepunkt: Absatz ${heatmap.climaxParagraph} (${row?.peak ?? 0}%, ${REACTION_LABELS[row?.dominant ?? 'tears']})`);
  }

  if (heatmap.hotspots.length > 0) {
    lines.push('');
    lines.push(`Top-Hotspots (${heatmap.hotspots.length}):`);
    for (const h of heatmap.hotspots.slice(0, 5)) {
      lines.push(`  • ${h.label}`);
    }
  } else {
    lines.push('');
    lines.push('Keine ausgeprägten Hotspots gefunden.');
  }

  return lines.join('\n');
}
