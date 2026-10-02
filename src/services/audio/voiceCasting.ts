// Voice-Casting-Service (WP 27.2 — Sprecher-Casting & Timbre-Direktor).
//
// Verwaltet Voice-Profile für Charaktere, generiert Audition-Monologe
// und exportiert ein professionelles Casting-Briefing.
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Defensive Fallbacks: fehlende/ungültige Daten (null, NaN, negativ,
//   falsche Typen) werden auf Defaults abgebildet statt zu werfen.
// - Gleiche Eingabe ⇒ gleiche Ausgabe (keine Zufallsquellen).

// --- Types ---------------------------------------------------------------------------

export type VoiceType = "bass" | "baritone" | "tenor" | "alto" | "mezzo" | "soprano";
export type Timbre = "smoky" | "metallic" | "nasal" | "velvety";

export interface VoiceConfig {
  /** Tonhöhe in Hertz (z. B. 85 für Bass, 220 für Sopran). */
  pitchHz: number;
  /** Stimmtyp (Bass bis Sopran). */
  voiceType: VoiceType;
  /** Klangfarbe (Timbre). */
  timbre: Timbre;
  /** Sprachgeschwindigkeit in Wörtern pro Minute (wpm). */
  speechRate: number;
  /** Akzent (z. B. "de-DE", "en-US", "österreichisch"). */
  accent: string;
}

export interface VoiceProfile {
  /** Name des Charakters. */
  character: string;
  /** Voice-Konfiguration. */
  config: VoiceConfig;
  /** Beispiel-Dialog (optional). */
  sampleDialogue?: string;
}

// --- Konstanten ----------------------------------------------------------------------

const VOICE_TYPES: readonly VoiceType[] = ["bass", "baritone", "tenor", "alto", "mezzo", "soprano"];
const TIMBRES: readonly Timbre[] = ["smoky", "metallic", "nasal", "velvety"];

/** Standard-Sprachgeschwindigkeit in Wörtern pro Minute. */
export const DEFAULT_SPEECH_RATE = 150;

/** Standard-Tonhöhe je Stimmtyp (Hz). */
export const DEFAULT_PITCH_HZ: Record<VoiceType, number> = {
  bass: 85,
  baritone: 110,
  tenor: 140,
  alto: 180,
  mezzo: 200,
  soprano: 240,
};

/** Standard-Timbre je Stimmtyp. */
export const DEFAULT_TIMBRE: Record<VoiceType, Timbre> = {
  bass: "smoky",
  baritone: "velvety",
  tenor: "metallic",
  alto: "velvety",
  mezzo: "smoky",
  soprano: "metallic",
};

/** Standard-Akzent. */
export const DEFAULT_ACCENT = "de-DE";

/** Ziel-Dauer des Audition-Monologs in Sekunden. */
export const AUDITION_TARGET_SECONDS = 60;

/** Zeichen pro Wort inkl. Leerzeichen (für Zeitberechnung). */
const CHARS_PER_WORD = 6.5;

// --- Kleine, defensive Helfer --------------------------------------------------------

/** Begrenzt auf [min, max]; NaN/Infinity → min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** true, wenn `value` ein bekannter VoiceType ist. */
function isVoiceType(value: unknown): value is VoiceType {
  return typeof value === "string" && (VOICE_TYPES as readonly string[]).includes(value);
}

/** true, wenn `value` ein bekanntes Timbre ist. */
function isTimbre(value: unknown): value is Timbre {
  return typeof value === "string" && (TIMBRES as readonly string[]).includes(value);
}

/** Sanitisiert einen VoiceConfig defensiv. */
function sanitizeVoiceConfig(raw: Partial<VoiceConfig> | null | undefined): VoiceConfig {
  const cfg = raw && typeof raw === "object" ? raw : {};

  const voiceType = isVoiceType(cfg.voiceType) ? cfg.voiceType : "baritone";
  const timbre = isTimbre(cfg.timbre) ? cfg.timbre : DEFAULT_TIMBRE[voiceType];

  const pitchHz = Number.isFinite(cfg.pitchHz) && (cfg.pitchHz as number) > 0
    ? clamp(cfg.pitchHz as number, 40, 500)
    : DEFAULT_PITCH_HZ[voiceType];

  const speechRate = Number.isFinite(cfg.speechRate) && (cfg.speechRate as number) > 0
    ? clamp(cfg.speechRate as number, 50, 400)
    : DEFAULT_SPEECH_RATE;

  const accent = typeof cfg.accent === "string" && cfg.accent.trim().length > 0
    ? cfg.accent.trim()
    : DEFAULT_ACCENT;

  return { pitchHz, voiceType, timbre, speechRate, accent };
}

// --- 1) createVoiceProfile ------------------------------------------------------------

/**
 * Erstellt ein Voice-Profil für einen Charakter.
 * Defensive Fallbacks: fehlende/ungültige Config-Werte werden defaultet.
 */
export function createVoiceProfile(
  character: string,
  config: Partial<VoiceConfig> | null | undefined,
): VoiceProfile {
  const char = typeof character === "string" && character.trim().length > 0
    ? character.trim()
    : "Unbekannt";

  const sanitized = sanitizeVoiceConfig(config);

  return {
    character: char,
    config: sanitized,
  };
}

// --- 2) generateAuditionMonologue ------------------------------------------------------

/**
 * Generiert aus den stärksten Dialogen einen 60-Sekunden-Casting-Text.
 * Die Auswahl ist deterministisch: längere Dialoge werden bevorzugt,
 * bei Gleichstand gilt die Reihenfolge im Array.
 */
export function generateAuditionMonologue(
  character: string,
  dialogues: string[],
): string {
  const char = typeof character === "string" && character.trim().length > 0
    ? character.trim()
    : "Unbekannt";

  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    return `[${char}] — Keine Dialoge verfügbar.`;
  }

  // Filtere leere/un gültige Dialoge
  const valid = dialogues.filter(
    (d): d is string => typeof d === "string" && d.trim().length > 0,
  );

  if (valid.length === 0) {
    return `[${char}] — Keine gültigen Dialoge verfügbar.`;
  }

  // Sortiere nach Länge (absteigend) — deterministisch durch stabile Sort
  const sorted = [...valid].sort((a, b) => b.length - a.length);

  // Wähle die Top-Dialoge aus, die in ~60 Sekunden passen
  const targetChars = AUDITION_TARGET_SECONDS * CHARS_PER_WORD * (DEFAULT_SPEECH_RATE / 60);
  const selected: string[] = [];
  let totalChars = 0;

  for (const dialogue of sorted) {
    const trimmed = dialogue.trim();
    if (totalChars + trimmed.length > targetChars && selected.length > 0) {
      break;
    }
    selected.push(trimmed);
    totalChars += trimmed.length;
    if (totalChars >= targetChars) {
      break;
    }
  }

  // Fallback: wenn nichts ausgewählt wurde (erster Dialog zu lang), nimm den ersten
  if (selected.length === 0) {
    selected.push(sorted[0].trim());
  }

  const monologue = selected.join(" ");
  return `[${char}]\n\n${monologue}`;
}

// --- 3) exportCastingBriefing --------------------------------------------------------

/**
 * Exportiert ein professionelles Casting-Briefing als formatierten Text.
 * Die Ausgabe ist ein gut strukturierter Briefing-Text, der als PDF-Template
 * oder Druckvorlage dienen kann.
 */
export function exportCastingBriefing(profiles: VoiceProfile[]): string {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return "=== CASTING-BRIEFING ===\n\nKeine Profile vorhanden.\n";
  }

  const lines: string[] = [];
  lines.push("=== CASTING-BRIEFING ===");
  lines.push(`Datum: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Anzahl Profile: ${profiles.length}`);
  lines.push("");

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i];
    if (!profile || typeof profile !== "object") continue;

    const char = typeof profile.character === "string" && profile.character.trim().length > 0
      ? profile.character.trim()
      : `Charakter ${i + 1}`;

    const cfg = sanitizeVoiceConfig(profile.config);

    lines.push(`--- ${char} ---`);
    lines.push(`  Stimmtyp:    ${cfg.voiceType}`);
    lines.push(`  Tonhöhe:     ${cfg.pitchHz} Hz`);
    lines.push(`  Timbre:      ${cfg.timbre}`);
    lines.push(`  Sprechtempo: ${cfg.speechRate} wpm`);
    lines.push(`  Akzent:      ${cfg.accent}`);

    if (typeof profile.sampleDialogue === "string" && profile.sampleDialogue.trim().length > 0) {
      lines.push(`  Beispiel:    "${profile.sampleDialogue.trim()}"`);
    }

    lines.push("");
  }

  lines.push("=== ENDE BRIEFING ===");
  return lines.join("\n");
}
