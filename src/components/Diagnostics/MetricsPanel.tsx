// Stil-Kennwerte als Tabelle, mit Bewertung.
//
// Die Zahlen allein sagen einem Autor nichts. Deshalb steht bei jedem Wert
// eine Einordnung: Was ist normal, was fällt auf. Ohne diese Deutung wäre
// die Ansicht ein Datenfriedhof.

import type { StyleMetrics } from "@/services/diagnostics/style";

interface Props {
  metrics: StyleMetrics;
  perChapter: Array<{ chapterId: string; title: string; metrics: StyleMetrics }>;
  onOpenChapter: (chapterId: string) => void;
}

/** Anteilswert als Balken plus Prozentangabe. */
function Ratio({
  label,
  value,
  threshold,
  hint,
}: {
  label: string;
  value: number;
  threshold: number;
  hint: string;
}) {
  const pct = value * 100;
  const over = value > threshold;
  // Balkenbreite auf das Doppelte des Schwellwerts skalieren, damit
  // Unterschiede im relevanten Bereich sichtbar bleiben.
  const width = Math.min(100, (value / (threshold * 2)) * 100);

  return (
    <>
      <span className="dg-m-key" title={hint}>
        {label}
      </span>
      <span className={`dg-m-val${over ? " warn" : ""}`}>{pct.toFixed(1)} %</span>
      <span className="dg-bar">
        <span
          className={`dg-bar-fill${over ? " warn" : ""}`}
          style={{ width: `${width}%` }}
        />
      </span>
    </>
  );
}

export function MetricsPanel({ metrics: m, perChapter, onOpenChapter }: Props) {
  return (
    <>
      <div className="dg-metrics">
        <div className="dg-m-group">Umfang</div>
        <span className="dg-m-key">Wörter</span>
        <span className="dg-m-val">{m.wordCount.toLocaleString("de-DE")}</span>
        <span className="dg-m-key">Sätze</span>
        <span className="dg-m-val">{m.sentenceCount.toLocaleString("de-DE")}</span>

        <div className="dg-m-group">Satzbau</div>
        <span className="dg-m-key" title="Werte zwischen 12 und 20 gelten als gut lesbar">
          Durchschnittliche Satzlänge
        </span>
        <span
          className={`dg-m-val${
            m.avgSentenceWords > 25 || (m.avgSentenceWords > 0 && m.avgSentenceWords < 8)
              ? " warn"
              : ""
          }`}
        >
          {m.avgSentenceWords} Wörter
        </span>

        <span className="dg-m-key" title="Unter 4 wirken die Sätze monoton">
          Streuung der Satzlängen
        </span>
        <span className={`dg-m-val${m.sentenceLengthStdDev < 4 ? " warn" : ""}`}>
          {m.sentenceLengthStdDev}
        </span>

        <span className="dg-m-key">Längster Satz</span>
        <span className={`dg-m-val${m.longestSentenceWords > 45 ? " warn" : ""}`}>
          {m.longestSentenceWords} Wörter
        </span>

        <div className="dg-m-group">Sprachliche Anteile</div>
        <Ratio
          label="Füllwörter"
          value={m.fillerRatio}
          threshold={0.05}
          hint="Über 5 % fällt es auf"
        />
        <Ratio
          label="Passivsätze"
          value={m.passiveRatio}
          threshold={0.25}
          hint="Über 25 % der Sätze nimmt Tempo"
        />
        <Ratio
          label="Substantivierungen"
          value={m.nominalRatio}
          threshold={0.04}
          hint="Endungen auf -ung, -heit, -keit"
        />
        <Ratio
          label="Dialoganteil"
          value={m.dialogueRatio}
          threshold={0.5}
          hint="Kein Richtwert — je nach Gattung sehr unterschiedlich"
        />

        <div className="dg-m-group">Wortschatz</div>
        <span
          className="dg-m-key"
          title="Anteil einmalig verwendeter Wörter. Höher heißt abwechslungsreicher."
        >
          Lexikalische Vielfalt
        </span>
        <span className={`dg-m-val${m.lexicalVariety < 0.4 ? " warn" : ""}`}>
          {(m.lexicalVariety * 100).toFixed(0)} %
        </span>
      </div>

      {perChapter.length > 0 && (
        <>
          <div className="dg-m-group" style={{ marginBottom: 8 }}>
            Je Kapitel
          </div>
          <div className="dg-chapters">
            {perChapter.map((c) => (
              <div
                className="dg-chapter"
                key={c.chapterId}
                onClick={() => onOpenChapter(c.chapterId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenChapter(c.chapterId);
                }}
              >
                <span className="dg-ch-title" title={c.title}>
                  {c.title}
                </span>
                <span className="dg-ch-num">
                  {c.metrics.wordCount.toLocaleString("de-DE")} W
                </span>
                <span
                  className="dg-ch-num"
                  title="Durchschnittliche Satzlänge"
                >
                  ⌀ {c.metrics.avgSentenceWords}
                </span>
                <span
                  className="dg-ch-num"
                  title="Füllwortanteil"
                  style={{
                    color: c.metrics.fillerRatio > 0.05 ? "var(--warn)" : undefined,
                  }}
                >
                  {(c.metrics.fillerRatio * 100).toFixed(1)} %
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
