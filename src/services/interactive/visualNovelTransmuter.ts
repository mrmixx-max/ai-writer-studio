// Visual Novel & Ren'Py/Twine Transmuter (WP 68.1)
//
// Wandelt Prosa in ein spielbares Visual Novel: Szenen mit Klick-Dialogen,
// Sprechernamen, Emotionstags und Entscheidungsoptionen — exportierbar als
// Ren'Py-Skript (.rpy) und als Twine-2-HTML (Harlowe).
//
// Eingabeformat (bewusst schlank, damit Autoren es direkt tippen können):
//
//   [bg: forest]                → Hintergrund der Szene
//   [emotion: happy]            → Emotion für die nächste Zeile
//   Mira: "Ich gehe jetzt."     → Dialogzeile
//   > Fliehen -> Wald           → Entscheidung, springt zur Szene "Wald"
//   ---                         → trennt zwei Szenen
//
// Design-Regeln (analog den übrigen Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine Dialogzeile. */
export interface NovelLine {
  /** Sprecher. */
  speaker: string;
  /** Gesprochener Text. */
  text: string;
  /** Emotionstag (z. B. „happy"), sofern gesetzt. */
  emotion?: string;
}

/** Eine Entscheidungsoption. */
export interface NovelChoice {
  /** Beschriftung der Option. */
  label: string;
  /** Ziel-Szene (Label). */
  target: string;
}

/** Eine Szene. */
export interface NovelScene {
  /** 1-basierte Nummer. */
  index: number;
  /** Szenen-Label (aus dem Titel abgeleitet). */
  label: string;
  /** Anzeigetitel. */
  title: string;
  /** Hintergrund, sofern gesetzt. */
  background?: string;
  /** Dialogzeilen. */
  lines: NovelLine[];
  /** Entscheidungen am Szenenende. */
  choices: NovelChoice[];
}

/** Das geparste Skript. */
export interface VisualNovelScript {
  /** Titel des Spiels. */
  title: string;
  /** Alle Szenen. */
  scenes: NovelScene[];
  /** Anzahl Szenen. */
  sceneCount: number;
  /** Anzahl Dialogzeilen über alle Szenen. */
  lineCount: number;
  /** Anzahl Entscheidungen über alle Szenen. */
  choiceCount: number;
  /** Alle vorkommenden Sprecher. */
  speakers: string[];
}

/** Ergebnis der Skript-Prüfung. */
export interface ScriptValidation {
  /** true, wenn keine Fehler gefunden wurden. */
  valid: boolean;
  /** Fehler (blockierend). */
  errors: string[];
  /** Warnungen (nicht blockierend). */
  warnings: string[];
  /** Entscheidungen, deren Ziel-Szene nicht existiert. */
  brokenJumps: string[];
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Leitet ein Ren'Py-taugliches Label aus einem Titel ab.
 *
 * Ren'Py-Labels müssen mit einem Buchstaben beginnen und dürfen nur
 * Kleinbuchstaben, Ziffern und Unterstriche enthalten.
 */
export function toLabel(title: string): string {
  const base = (title || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (base.length === 0) return 'szene';
  return /^[a-z]/.test(base) ? base : `szene_${base}`;
}

/** Entfernt umschließende Anführungszeichen und Leerraum. */
function stripQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith('„') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Normalisiert einen Szenen-Bezug für den toleranten Vergleich.
 *
 * Entfernt führende Artikel und Füllwörter, damit „Lichtung" auf die Szene
 * „Die Lichtung" passt — Autoren schreiben das Sprungziel kürzer als den Titel.
 */
function normalizeRef(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/^(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Löst einen Szenen-Bezug gegen die vorhandenen Szenen auf.
 *
 * Reihenfolge: exaktes Label → exakter Titel → normalisiertes Label →
 * normalisierter Titel → Teilstring-Treffer. Gibt `null` zurück, wenn nichts
 * passt (echter kaputter Sprung).
 */
export function resolveSceneTarget(
  target: string,
  scenes: readonly NovelScene[],
): NovelScene | null {
  if (!Array.isArray(scenes) || scenes.length === 0) return null;
  const wanted = (target || '').trim();
  if (wanted.length === 0) return null;

  const wantedLabel = toLabel(wanted);
  const wantedNorm = normalizeRef(wanted);

  // 1./2. exakt
  const exact = scenes.find((s) => s.label === wantedLabel || s.title === wanted);
  if (exact) return exact;

  // 3./4. normalisiert (Artikel-tolerant)
  const normalized = scenes.find(
    (s) => normalizeRef(s.title) === wantedNorm || s.label === wantedNorm,
  );
  if (normalized) return normalized;

  // 5. Teilstring — nur bei eindeutigem Treffer, sonst lieber Fehler melden.
  const partial = scenes.filter((s) => {
    const n = normalizeRef(s.title);
    return n.length > 0 && wantedNorm.length > 0 && (n.includes(wantedNorm) || wantedNorm.includes(n));
  });
  return partial.length === 1 ? partial[0] : null;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 1) Prosa-zu-Game-Parser
// ---------------------------------------------------------------------------

/**
 * Zerlegt Prosa in spielbare Szenen mit Dialogen und Entscheidungen.
 *
 * Defensiv: leerer oder ungültiger Input liefert ein leeres Skript (0 Szenen).
 */
export function parseVisualNovelScript(
  prose: string,
  title?: string,
): VisualNovelScript {
  const safeTitle = normalizeText(title, 'Ohne Titel');
  const raw = typeof prose === 'string' ? prose : '';

  const blocks = raw
    .split(/^\s*---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const scenes: NovelScene[] = [];
  const speakerSet = new Set<string>();

  blocks.forEach((block, i) => {
    const lines: NovelLine[] = [];
    const choices: NovelChoice[] = [];
    let background: string | undefined;
    let pendingEmotion: string | undefined;
    let sceneTitle = `Szene ${i + 1}`;

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      if (line.length === 0) continue;

      // [bg: name]
      const bg = line.match(/^\[bg:\s*([^\]]+)\]$/i);
      if (bg) {
        background = bg[1].trim();
        continue;
      }

      // [emotion: name]
      const emo = line.match(/^\[emotion:\s*([^\]]+)\]$/i);
      if (emo) {
        pendingEmotion = emo[1].trim();
        continue;
      }

      // > Option -> Ziel
      const choice = line.match(/^>\s*(.+?)\s*->\s*(.+)$/);
      if (choice) {
        choices.push({ label: choice[1].trim(), target: choice[2].trim() });
        continue;
      }

      // # Titel
      const heading = line.match(/^#+\s*(.+)$/);
      if (heading) {
        sceneTitle = heading[1].trim();
        continue;
      }

      // Sprecher: "Text"
      const dialogue = line.match(/^([^:]{1,60}):\s*(.+)$/);
      if (dialogue) {
        const speaker = dialogue[1].trim();
        const text = stripQuotes(dialogue[2]);
        if (text.length > 0) {
          lines.push({ speaker, text, emotion: pendingEmotion });
          speakerSet.add(speaker);
          pendingEmotion = undefined;
        }
        continue;
      }

      // Reine Erzählzeile ohne Sprecher.
      lines.push({ speaker: 'Erzähler', text: stripQuotes(line), emotion: pendingEmotion });
      speakerSet.add('Erzähler');
      pendingEmotion = undefined;
    }

    scenes.push({
      index: i + 1,
      label: toLabel(sceneTitle),
      title: sceneTitle,
      background,
      lines,
      choices,
    });
  });

  // Labels eindeutig machen (gleiche Titel → Suffix).
  const used = new Map<string, number>();
  for (const scene of scenes) {
    const count = used.get(scene.label) ?? 0;
    used.set(scene.label, count + 1);
    if (count > 0) scene.label = `${scene.label}_${count + 1}`;
  }

  return {
    title: safeTitle,
    scenes,
    sceneCount: scenes.length,
    lineCount: scenes.reduce((s, sc) => s + sc.lines.length, 0),
    choiceCount: scenes.reduce((s, sc) => s + sc.choices.length, 0),
    speakers: Array.from(speakerSet),
  };
}

// ---------------------------------------------------------------------------
// 2) Ren'Py-Export (.rpy)
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Ren'Py-Skript mit Labels, Szenen, Dialogen und Menüs.
 *
 * Defensiv: ein leeres Skript liefert ein minimales, syntaktisch valides
 * Ren'Py-Gerüst.
 */
export function generateRenPy(script: VisualNovelScript | null | undefined): string {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    return [
      '# Ren\'Py-Skript (leer)',
      '# Kein Manuskript übergeben.',
      '',
      'label start:',
      '    "Kein Skript vorhanden."',
      '    return',
      '',
    ].join('\n');
  }

  const out: string[] = [
    `# Ren'Py-Skript — ${script.title}`,
    `# ${script.sceneCount} Szenen, ${script.lineCount} Dialogzeilen, ${script.choiceCount} Entscheidungen`,
    '',
    'define e = Character(None, kind=nvl)',
    '',
  ];

  script.scenes.forEach((scene, i) => {
    const label = i === 0 ? 'start' : scene.label;
    out.push(`label ${label}:`);

    if (scene.background) {
      out.push(`    scene bg ${toLabel(scene.background)}`);
    }

    for (const line of scene.lines) {
      const text = line.text.replace(/"/g, '\\"');
      if (line.emotion) {
        out.push(`    # Emotion: ${line.emotion}`);
      }
      out.push(`    "${text}"`);
    }

    if (scene.choices.length > 0) {
      out.push('    menu:');
      for (const choice of scene.choices) {
        const resolved = resolveSceneTarget(choice.target, script.scenes);
        const target = resolved ? resolved.label : toLabel(choice.target);
        out.push(`        "${choice.label.replace(/"/g, '\\"')}":`);
        out.push(`            jump ${target}`);
      }
    } else if (i === script.scenes.length - 1) {
      out.push('    return');
    } else {
      // Ohne Entscheidung geht es linear weiter.
      out.push(`    jump ${script.scenes[i + 1].label}`);
    }

    out.push('');
  });

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 3) Twine-2-Export (Harlowe)
// ---------------------------------------------------------------------------

/** Escaped HTML-Sonderzeichen. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Erzeugt ein W3C-konformes Twine-2-HTML (Harlowe-Format), das direkt im
 * Browser spielbar ist.
 *
 * Defensiv: ein leeres Skript liefert ein leeres, valides Twine-Dokument.
 */
export function generateTwine(script: VisualNovelScript | null | undefined): string {
  const title = script?.title ?? 'Interaktive Geschichte';
  const scenes = script?.scenes ?? [];

  const passages: string[] = [];
  let pid = 1;

  if (scenes.length === 0) {
    passages.push(
      `<tw-passagedata pid="${pid}" name="Start" tags="" position="100,100" size="100,100">Kein Skript vorhanden.</tw-passagedata>`,
    );
  }

  scenes.forEach((scene, i) => {
    const name = i === 0 ? 'Start' : scene.title;
    const parts: string[] = [];

    if (scene.background) {
      parts.push(`(bg: ${escapeHtml(scene.background)})`);
    }

    for (const line of scene.lines) {
      const emo = line.emotion ? ` (${escapeHtml(line.emotion)})` : '';
      parts.push(`${escapeHtml(line.speaker)}${emo}: ${escapeHtml(line.text)}`);
    }

    if (scene.choices.length > 0) {
      for (const choice of scene.choices) {
        const resolved = resolveSceneTarget(choice.target, scenes);
        const target = resolved ? resolved.title : choice.target;
        parts.push(`[[${escapeHtml(choice.label)}->${escapeHtml(target)}]]`);
      }
    } else if (i < scenes.length - 1) {
      parts.push(`[[Weiter->${escapeHtml(scenes[i + 1].title)}]]`);
    }

    passages.push(
      `<tw-passagedata pid="${pid}" name="${escapeHtml(name)}" tags="" position="${100 + (i % 5) * 150},${100 + Math.floor(i / 5) * 150}" size="100,100">${parts.join('\n')}</tw-passagedata>`,
    );
    pid += 1;
  });

  return [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${escapeHtml(title)}</title>`,
    '</head>',
    '<body>',
    `<tw-storydata name="${escapeHtml(title)}" startnode="1" creator="AI Writer Studio" format="Harlowe" format-version="3.3.9" ifid="">`,
    '  <style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css"></style>',
    '  <script role="script" id="twine-user-script" type="text/twine-javascript"></script>',
    passages.join('\n'),
    '</tw-storydata>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 4) Skript-Prüfung
// ---------------------------------------------------------------------------

/**
 * Prüft ein Skript auf kaputte Sprünge und inhaltliche Lücken.
 *
 * `brokenJumps` listet Entscheidungen, deren Ziel-Szene nicht existiert —
 * das ist die häufigste Sackgasse in verzweigten Geschichten.
 */
export function validateScript(
  script: VisualNovelScript | null | undefined,
): ScriptValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const brokenJumps: string[] = [];

  if (!script || !Array.isArray(script.scenes)) {
    return { valid: false, errors: ['Kein Skript vorhanden.'], warnings: [], brokenJumps: [] };
  }

  if (script.scenes.length === 0) {
    errors.push('Das Skript enthält keine Szenen.');
  }

  for (const scene of script.scenes) {
    for (const choice of scene.choices) {
      if (!resolveSceneTarget(choice.target, script.scenes)) {
        brokenJumps.push(`${scene.title}: „${choice.label}" → „${choice.target}"`);
      }
    }
    if (scene.lines.length === 0) {
      warnings.push(`Szene „${scene.title}" hat keine Dialogzeilen.`);
    }
  }

  if (brokenJumps.length > 0) {
    errors.push(`${brokenJumps.length} Entscheidung(en) zeigen auf unbekannte Szenen.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    brokenJumps,
  };
}

// ---------------------------------------------------------------------------
// 5) Kennzahlen
// ---------------------------------------------------------------------------

/** Durchschnittliche Dialogzeilen pro Szene. */
export function averageLinesPerScene(script: VisualNovelScript | null | undefined): number {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) return 0;
  return round4(script.lineCount / script.scenes.length);
}
