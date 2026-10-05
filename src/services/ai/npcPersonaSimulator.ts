// Autonomer Figuren-Verhör- & NPC-Simulator (WP 69.1)
//
// Autoren und Game-Designer befragen Figuren live, um ihre Reaktionen auf
// unvorhergesehene Fragen zu testen. Die Figur lügt oder blockt ab, solange
// Druck oder Sympathie nicht den individuellen Schwellenwert übersteigen, und
// gibt Geheimnisse nur bei passenden Beweisen oder emotionalem Hebel preis.
//
// Design-Regeln (analog narrativeStateMachine):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Gesinnung einer Figur. */
export type Alignment = 'gut' | 'neutral' | 'böse' | 'chaotisch' | 'rechtschaffen';

/** Ein Geheimnis der Figur. */
export interface Secret {
  /** Eindeutige ID. */
  id: string;
  /** Der Inhalt des Geheimnisses. */
  content: string;
  /** Schwellenwert für Druck, ab dem preisgegeben wird. */
  pressureThreshold: number;
  /** Schwellenwert für Sympathie, ab dem preisgegeben wird. */
  sympathyThreshold: number;
  /** Beweis-ID, die das Geheimnis sofort öffnet. */
  requiresEvidence?: string;
  /** Emotionale Hebel (Stichworte), die das Geheimnis öffnen. */
  emotionalLevers?: string[];
}

/** Die Figur. */
export interface NpcPersona {
  /** Name. */
  name: string;
  /** Gesinnung. */
  alignment: Alignment;
  /** Kurzmotivation. */
  motivation: string;
  /** Grundschwelle, ab der die Figur überhaupt kooperiert. */
  baseResistance: number;
  /** Alle Geheimnisse. */
  secrets: Secret[];
  /** Standardantwort, wenn nichts greift. */
  deflection: string;
}

/** Ein Zug im Verhör. */
export interface InterrogationMove {
  /** Art des Zugs. */
  kind: 'question' | 'evidence' | 'pressure' | 'empathy';
  /** Der Text (Frage) bzw. die Beweis-ID bzw. das Hebel-Stichwort. */
  value: string;
}

/** Eine Antwort der Figur. */
export interface InterrogationResponse {
  /** Die Antwort. */
  text: string;
  /** Art der Antwort. */
  kind: 'deflection' | 'partial' | 'confession';
  /** Name des preisgegebenen Geheimnisses, falls zutreffend. */
  revealedSecretId?: string;
}

/** Der Verhör-Zustand. */
export interface InterrogationState {
  /** Aktueller Druck (0–100). */
  pressure: number;
  /** Aktuelle Sympathie (0–100). */
  sympathy: number;
  /** Vorgelegte Beweise. */
  evidence: string[];
  /** Bereits preisgegebene Geheimnisse. */
  revealed: string[];
}

/** Spielleiter-Dossier für Tabletop. */
export interface GameMasterDossier {
  /** Name. */
  name: string;
  /** Gesinnung. */
  alignment: string;
  /** Motivation. */
  motivation: string;
  /** Grundwiderstand. */
  baseResistance: number;
  /** Übersicht der Geheimnisse mit Schwellenwerten. */
  secrets: Array<{
    content: string;
    pressureThreshold: number;
    sympathyThreshold: number;
    requiresEvidence?: string;
    emotionalLevers: string[];
  }>;
  /** Fertiger Textblock für den Spielleiter. */
  formatted: string;
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zahl auf [0, 100] begrenzen. */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Menschenlesbarer Gesinnungs-Name. */
export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  gut: 'Gut',
  neutral: 'Neutral',
  böse: 'Böse',
  chaotisch: 'Chaotisch',
  rechtschaffen: 'Rechtschaffen',
};

/** Standard-Persona, falls keine übergeben wurde. */
function defaultPersona(): NpcPersona {
  return {
    name: 'Der Wirt',
    alignment: 'neutral',
    motivation: 'Er will seinen Ruf und seine Schänke schützen.',
    baseResistance: 40,
    secrets: [
      {
        id: 'geheim-1',
        content: 'Er hat gesehen, wer das Feuer legte.',
        pressureThreshold: 70,
        sympathyThreshold: 75,
        requiresEvidence: 'brandbeschleuniger',
        emotionalLevers: ['familie', 'tochter'],
      },
    ],
    deflection: 'Ich weiß von nichts. Wirklich nicht.',
  };
}

/** Persona defensiv prüfen. */
function normalizePersona(persona: NpcPersona | null | undefined): NpcPersona {
  if (!persona || typeof persona !== 'object') return defaultPersona();
  const fallback = defaultPersona();
  return {
    name: typeof persona.name === 'string' && persona.name.trim() ? persona.name.trim() : fallback.name,
    alignment: persona.alignment ?? fallback.alignment,
    motivation: typeof persona.motivation === 'string' && persona.motivation.trim() ? persona.motivation.trim() : fallback.motivation,
    baseResistance: typeof persona.baseResistance === 'number' && Number.isFinite(persona.baseResistance)
      ? clamp100(persona.baseResistance)
      : fallback.baseResistance,
    secrets: Array.isArray(persona.secrets) ? persona.secrets : [],
    deflection: typeof persona.deflection === 'string' && persona.deflection.trim() ? persona.deflection.trim() : fallback.deflection,
  };
}

// ---------------------------------------------------------------------------
// 1) Verhör starten
// ---------------------------------------------------------------------------

/**
 * Erzeugt den Anfangszustand eines Verhörs.
 *
 * Defensiv: ohne Persona wird eine Standardfigur verwendet.
 */
export function startInterrogation(persona?: NpcPersona | null): InterrogationState {
  const p = normalizePersona(persona);
  return {
    // Eine misstrauische Figur startet mit höherem Druck und weniger Sympathie.
    pressure: Math.round(p.baseResistance * 0.3),
    sympathy: clamp100(50 - Math.round(p.baseResistance * 0.2)),
    evidence: [],
    revealed: [],
  };
}

// ---------------------------------------------------------------------------
// 2) Zug ausführen
// ---------------------------------------------------------------------------

/**
 * Führt einen Zug aus und liefert die Antwort der Figur.
 *
 * Regeln:
 *   - `evidence` legt einen Beweis vor (öffnet Geheimnisse mit passender
 *     `requiresEvidence` sofort).
 *   - `pressure` erhöht den Druck stark, senkt die Sympathie.
 *   - `empathy` erhöht die Sympathie, senkt den Druck leicht.
 *   - `question` prüft, ob ein Geheimnis jetzt preisgegeben wird.
 *
 * Defensiv: der Zustand wird nie mutiert; die Antwort ist immer ein Objekt.
 */
export function applyMove(
  persona: NpcPersona | null | undefined,
  state: InterrogationState | null | undefined,
  move: InterrogationMove | null | undefined,
): { state: InterrogationState; response: InterrogationResponse } {
  const p = normalizePersona(persona);
  const current: InterrogationState = state
    ? {
        pressure: clamp100(state.pressure),
        sympathy: clamp100(state.sympathy),
        evidence: Array.isArray(state.evidence) ? [...state.evidence] : [],
        revealed: Array.isArray(state.revealed) ? [...state.revealed] : [],
      }
    : startInterrogation(p);

  const kind = move?.kind ?? 'question';
  const value = typeof move?.value === 'string' ? move.value : '';
  const lowerValue = value.toLowerCase();

  // Effekte je Zug-Art.
  switch (kind) {
    case 'pressure':
      current.pressure = clamp100(current.pressure + 25);
      current.sympathy = clamp100(current.sympathy - 10);
      break;
    case 'empathy':
      current.sympathy = clamp100(current.sympathy + 20);
      current.pressure = clamp100(current.pressure - 5);
      break;
    case 'evidence':
      if (value.length > 0 && !current.evidence.includes(value)) {
        current.evidence.push(value);
      }
      current.pressure = clamp100(current.pressure + 10);
      break;
    case 'question':
    default:
      current.pressure = clamp100(current.pressure + 3);
      break;
  }

  // Prüfen, ob ein Geheimnis fällt.
  for (const secret of p.secrets) {
    if (current.revealed.includes(secret.id)) continue;

    const hasEvidence =
      secret.requiresEvidence !== undefined && current.evidence.includes(secret.requiresEvidence);

    const leverHit =
      Array.isArray(secret.emotionalLevers) &&
      secret.emotionalLevers.some((lever) => lowerValue.includes(lever.toLowerCase()));

    const pressureHit = current.pressure >= secret.pressureThreshold;
    const sympathyHit = current.sympathy >= secret.sympathyThreshold;

    if (hasEvidence || leverHit || pressureHit || sympathyHit) {
      current.revealed.push(secret.id);
      return {
        state: current,
        response: {
          text: secret.content,
          kind: 'confession',
          revealedSecretId: secret.id,
        },
      };
    }

    // Teilinformation, wenn der Spieler nah dran ist.
    const nearPressure = current.pressure >= secret.pressureThreshold - 15;
    const nearSympathy = current.sympathy >= secret.sympathyThreshold - 15;
    if (nearPressure || nearSympathy) {
      return {
        state: current,
        response: {
          text: `${p.deflection} … aber vielleicht solltest du die richtige Frage stellen.`,
          kind: 'partial',
        },
      };
    }
  }

  return {
    state: current,
    response: { text: p.deflection, kind: 'deflection' },
  };
}

// ---------------------------------------------------------------------------
// 3) Tabletop-Dossier
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein kompaktes Spielleiter-Dossier.
 *
 * Defensiv: ohne Persona wird das Standard-Dossier ausgegeben.
 */
export function buildGameMasterDossier(
  persona: NpcPersona | null | undefined,
): GameMasterDossier {
  const p = normalizePersona(persona);

  const secrets = p.secrets.map((s) => ({
    content: s.content,
    pressureThreshold: s.pressureThreshold,
    sympathyThreshold: s.sympathyThreshold,
    requiresEvidence: s.requiresEvidence,
    emotionalLevers: Array.isArray(s.emotionalLevers) ? [...s.emotionalLevers] : [],
  }));

  const formatted = [
    `=== SPIELLEITER-DOSSIER: ${p.name} ===`,
    '',
    `Gesinnung:     ${ALIGNMENT_LABELS[p.alignment] ?? p.alignment}`,
    `Motivation:    ${p.motivation}`,
    `Grundwiderstand: ${p.baseResistance}/100`,
    '',
    `Geheimnisse (${secrets.length}):`,
    ...secrets.map((s, i) => {
      const lines = [
        `  ${i + 1}. ${s.content}`,
        `     Einschüchtern ab Druck ${s.pressureThreshold}, Überzeugen ab Sympathie ${s.sympathyThreshold}`,
      ];
      if (s.requiresEvidence) lines.push(`     Beweis nötig: ${s.requiresEvidence}`);
      if (s.emotionalLevers.length > 0) lines.push(`     Emotionale Hebel: ${s.emotionalLevers.join(', ')}`);
      return lines.join('\n');
    }),
    '',
    `Standard-Abwehr: „${p.deflection}"`,
  ].join('\n');

  return {
    name: p.name,
    alignment: ALIGNMENT_LABELS[p.alignment] ?? p.alignment,
    motivation: p.motivation,
    baseResistance: p.baseResistance,
    secrets,
    formatted,
  };
}

// ---------------------------------------------------------------------------
// 4) Verhör-Protokoll
// ---------------------------------------------------------------------------

/**
 * Führt eine ganze Zugfolge aus und liefert das Protokoll.
 *
 * Defensiv: eine leere Zugfolge liefert ein leeres Protokoll.
 */
export function runInterrogation(
  persona: NpcPersona | null | undefined,
  moves: readonly InterrogationMove[] | null | undefined,
): { transcript: string; finalState: InterrogationState; confessionCount: number } {
  const p = normalizePersona(persona);
  let state = startInterrogation(p);
  const lines: string[] = [`Verhör: ${p.name}`, ''];
  let confessionCount = 0;

  for (const move of Array.isArray(moves) ? moves : []) {
    const { state: nextState, response } = applyMove(p, state, move);
    state = nextState;
    const tag = response.kind === 'confession' ? '!!' : response.kind === 'partial' ? '~' : '·';
    lines.push(`[${tag}] ${move.kind}: ${move.value}`);
    lines.push(`    → ${response.text}`);
    if (response.kind === 'confession') confessionCount += 1;
  }

  lines.push('');
  lines.push(`Endstand: Druck ${state.pressure}, Sympathie ${state.sympathy}`);
  lines.push(`Preisgegeben: ${state.revealed.length} von ${p.secrets.length}`);

  return { transcript: lines.join('\n'), finalState: state, confessionCount };
}
