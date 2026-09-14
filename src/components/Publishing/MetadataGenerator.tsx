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
import { useI18n } from "@/i18n";
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
  const { t } = useI18n();

  const runDescription = useCallback(async () => {
    setBusy("desc");
    setNotice(null);
    try {
      const input = enrichInput(metadata, authorName);
      const result = await generateKdpDescription(input, loadSettings());
      setDescription(result);
      setNotice({
        text: result.viaLlm ? t("pub.descDone") : t("pub.descFallback"),
        kind: result.viaLlm ? "ok" : "warn",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(null);
    }
  }, [metadata, authorName, t]);

  const runKeywords = useCallback(async () => {
    setBusy("kw");
    setNotice(null);
    try {
      const input = enrichInput(metadata, authorName);
      const result = await generateKdpKeywords(input, loadSettings());
      setKeywords(result);
      setNotice({
        text: result.viaLlm
          ? t("pub.kwDone", { count: result.keywords.length })
          : t("pub.kwFallback"),
        kind: result.viaLlm ? "ok" : "warn",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(null);
    }
  }, [metadata, authorName, t]);

  return (
    <section className="pub-section" data-testid="pub-metadata-gen">
      <div className="pub-actions">
        <button onClick={runDescription} disabled={busy !== null}>
          {busy === "desc" ? t("pub.genDescBusy") : t("pub.genDesc")}
        </button>
        <button onClick={runKeywords} disabled={busy !== null}>
          {busy === "kw" ? t("pub.genKwBusy") : t("pub.genKw")}
        </button>
      </div>

      {notice && <div className={`pub-notice pub-notice-${notice.kind}`}>{notice.text}</div>}

      {description && (
        <div className="pub-gen-result">
          <h4>{t("pub.resultDesc")} {description.viaLlm ? t("pub.viaLlm") : t("pub.viaFallback")}</h4>
          <pre className="pub-gen-text">{description.description}</pre>
          <div className="pub-actions">
            <button
              onClick={() =>
                onApply({ blurbVariants: [description.description], shortDescription: description.shortDescription })
              }
            >
              {t("pub.applyMeta")}
            </button>
          </div>
        </div>
      )}

      {keywords && (
        <div className="pub-gen-result">
          <h4>{t("pub.resultKw")} {keywords.viaLlm ? t("pub.viaLlm") : t("pub.viaFallback")}</h4>
          <div className="pub-keyword-cloud">
            {keywords.keywords.map((kw) => (
              <span key={kw} className="pub-keyword">{kw}</span>
            ))}
          </div>
          <div className="pub-actions">
            <button onClick={() => onApply({ keywords: keywords.keywords })}>
              {t("pub.applyMeta")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
