// Automatische Metadaten-Generierung: KI schreibt Beschreibung und Keywords.

import { useCallback, useState } from "react";
import {
  enrichInput,
  generateKdpDescription,
  generateKdpKeywords,
  type GeneratedDescription,
  type GeneratedKeywords,
} from "@/services/kdp/metadata-gen";
import { loadSettings } from "@/services/settings";
import type { KdpMetadata } from "@/types/bookwriter";

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

export function MetadataGenerator({
  metadata,
  authorName,
  onApply,
}: {
  metadata: KdpMetadata;
  authorName?: string;
  onApply: (patch: Partial<Pick<KdpMetadata, "blurbVariants" | "shortDescription" | "keywords">>) => void;
}) {
  const [busy, setBusy] = useState<"desc" | "kw" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [description, setDescription] = useState<GeneratedDescription | null>(null);
  const [keywords, setKeywords] = useState<GeneratedKeywords | null>(null);

  const runDescription = useCallback(async () => {
    setBusy("desc");
    setNotice(null);
    try {
      const input = enrichInput(metadata, authorName);
      const result = await generateKdpDescription(input, loadSettings());
      setDescription(result);
      setNotice({
        text: result.viaLlm ? "Beschreibung generiert (LLM)." : "LLM nicht erreichbar — Fallback-Vorlage erzeugt.",
        kind: result.viaLlm ? "ok" : "warn",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(null);
    }
  }, [metadata, authorName]);

  const runKeywords = useCallback(async () => {
    setBusy("kw");
    setNotice(null);
    try {
      const input = enrichInput(metadata, authorName);
      const result = await generateKdpKeywords(input, loadSettings());
      setKeywords(result);
      setNotice({
        text: result.viaLlm
          ? `${result.keywords.length} Keywords generiert (LLM).`
          : "LLM nicht erreichbar — Fallback-Keywords erzeugt.",
        kind: result.viaLlm ? "ok" : "warn",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(null);
    }
  }, [metadata, authorName]);

  return (
    <section className="pub-section" data-testid="pub-metadata-gen">
      <div className="pub-actions">
        <button onClick={runDescription} disabled={busy !== null}>
          {busy === "desc" ? "Generiere Beschreibung…" : "🪄 Beschreibung generieren"}
        </button>
        <button onClick={runKeywords} disabled={busy !== null}>
          {busy === "kw" ? "Generiere Keywords…" : "🪄 Keywords generieren"}
        </button>
      </div>

      {notice && <div className={`pub-notice pub-notice-${notice.kind}`}>{notice.text}</div>}

      {description && (
        <div className="pub-gen-result">
          <h4>Beschreibung {description.viaLlm ? "(KI)" : "(Fallback)"}</h4>
          <pre className="pub-gen-text">{description.description}</pre>
          <div className="pub-actions">
            <button
              onClick={() =>
                onApply({ blurbVariants: [description.description], shortDescription: description.shortDescription })
              }
            >
              ✎ In Metadaten übernehmen
            </button>
          </div>
        </div>
      )}

      {keywords && (
        <div className="pub-gen-result">
          <h4>Keywords {keywords.viaLlm ? "(KI)" : "(Fallback)"}</h4>
          <div className="pub-keyword-cloud">
            {keywords.keywords.map((kw) => (
              <span key={kw} className="pub-keyword">{kw}</span>
            ))}
          </div>
          <div className="pub-actions">
            <button onClick={() => onApply({ keywords: keywords.keywords })}>
              ✎ In Metadaten übernehmen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
