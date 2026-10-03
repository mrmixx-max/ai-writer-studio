// Media-Overlay-Service (WP 37.2): SMIL 3.0-Generierung, OPF-Manifest-Verwaltung,
// Timecode-Formatierung für EPUB-Media-Overlays.
//
// Rein deterministisch, keine LLM-Abhängigkeit, defensive Fallbacks.
// SMIL-Markup ist strikt XML-valide (W3C SMIL 3.0 Namespace).

export interface SmilDocument {
  xml: string;
  sentenceCount: number;
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zweistellige Null-Padding für Stunden/Minuten/Sekunden. */
function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Dreistellige Null-Padding für Millisekunden. */
function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Formatiert Millisekunden als HH:MM:SS.mmm (z. B. 00:01:23.450).
 * Negative oder nicht-endliche Werte werden zu 00:00:00.000.
 */
export function formatTimecode(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00:00.000";
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = Math.floor(clamped % 1000);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

/**
 * Erzeugt ein W3C-valides SMIL 3.0-Dokument für Media-Overlays.
 * Die Gesamtdauer wird gleichmäßig auf alle Sätze verteilt.
 * Jeder Satz erhält ein <par> mit <text> und <audio> Kindelement.
 */
export function generateSmil(sentences: string[], audioDurationMs: number): SmilDocument {
  const safeSentences = Array.isArray(sentences) ? sentences : [];
  const safeDuration =
    Number.isFinite(audioDurationMs) && audioDurationMs > 0 ? audioDurationMs : 0;
  const count = safeSentences.length;

  // Defensiver Fallback: leeres Dokument
  if (count === 0 || safeDuration === 0) {
    return {
      xml:
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">\n` +
        `  <body>\n` +
        `    <seq>\n` +
        `    </seq>\n` +
        `  </body>\n` +
        `</smil>`,
      sentenceCount: 0,
      totalDurationMs: 0,
    };
  }

  const perSentence = safeDuration / count;
  const parts: string[] = [];

  for (let i = 0; i < count; i++) {
    const begin = i * perSentence;
    const end = (i + 1) * perSentence;
    const id = `s${i + 1}`;
    parts.push(
      `      <par id="${id}">\n` +
      `        <text src="chapter1.xhtml#${id}"/>\n` +
      `        <audio src="audio/chapter1.mp3" clipBegin="${formatTimecode(begin)}" clipEnd="${formatTimecode(end)}"/>\n` +
      `      </par>`,
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">\n` +
    `  <body>\n` +
    `    <seq>\n` +
    `${parts.join("\n")}\n` +
    `    </seq>\n` +
    `  </body>\n` +
    `</smil>`;

  return {
    xml,
    sentenceCount: count,
    totalDurationMs: safeDuration,
  };
}

/**
 * Erweitert ein OPF-Dokument (content.opf) um einen Media-Overlay-Eintrag
 * im <manifest>-Bereich. Fügt ein <item> mit media-type="application/smil+xml" ein.
 * Defensiver Fallback: wenn kein </manifest> gefunden wird, wird ein neuer
 * <manifest>-Block angehängt.
 */
export function wireManifest(opfContent: string, smilId: string): string {
  const safeOpf = typeof opfContent === "string" ? opfContent : "";
  const safeSmilId =
    typeof smilId === "string" && smilId.length > 0 ? smilId : "smil";

  const item =
    `    <item id="${safeSmilId}" href="${safeSmilId}.smil" media-type="application/smil+xml"/>`;

  // Füge das item vor </manifest> ein
  if (safeOpf.includes("</manifest>")) {
    return safeOpf.replace("</manifest>", `${item}\n  </manifest>`);
  }

  // Fallback: keinen </manifest> gefunden — Block am Ende anhängen
  return `${safeOpf}\n  <manifest>\n${item}\n  </manifest>`;
}
