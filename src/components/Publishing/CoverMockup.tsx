// 3D-Buchcover-Mockup: rendert das Cover als aufrechtes Buch mit Rücken.

import { useMemo, useState } from "react";
import { computeMockupSpec, coverDisplaySize, DEFAULT_MOCKUP_OPTIONS } from "@/services/kdp/mockup";
import { useI18n } from "@/i18n";
import type { KdpMetadata } from "@/types/bookwriter";

function imageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function CoverMockup({ metadata, title }: { metadata: KdpMetadata; title: string }) {
  const { t } = useI18n();
  const [pageCount, setPageCount] = useState(250);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const spec = useMemo(() => computeMockupSpec(pageCount), [pageCount]);

  const size = useMemo(
    () => (imgSize ? coverDisplaySize(imgSize.w, imgSize.h, DEFAULT_MOCKUP_OPTIONS.frontWidth) : null),
    [imgSize],
  );

  const cover = metadata.coverImage;
  if (cover) {
    void imageSize(cover).then((s) => {
      if (s && (s.w !== imgSize?.w || s.h !== imgSize?.h)) setImgSize(s);
    });
  }

  return (
    <section className="pub-section" data-testid="pub-cover-mockup">
      <div className="pub-mockup-controls">
        <label>
          {t("pub.pageCount")} <strong>{pageCount}</strong>
          <input
            type="range"
            min={50}
            max={800}
            step={10}
            value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
          />
        </label>
      </div>

      {cover ? (
        <div
          className="pub-mockup-stage"
          style={{ perspective: `${spec.perspective}px` }}
          data-testid="pub-mockup-stage"
        >
          <div className="pub-mockup-book" style={{ transform: spec.groupTransform, width: spec.frontWidth, height: spec.frontHeight }}>
            <div className="pub-mockup-front">
              {size ? (
                <img src={cover} alt={t("pub.coverAlt", { title })} width={size.width} height={size.height} />
              ) : (
                <img src={cover} alt={t("pub.coverAlt", { title })} style={{ width: "100%", height: "100%" }} />
              )}
            </div>
            <div className="pub-mockup-spine" style={{ transform: spec.spineTransform, width: spec.spineWidth, height: spec.frontHeight }}>
              <span className="pub-mockup-spine-text">{title}</span>
            </div>
            <div className="pub-mockup-pages" />
          </div>
        </div>
      ) : (
        <div className="pub-notice pub-notice-warn">
          {t("pub.noCover")}
        </div>
      )}
      <p className="pub-note">
        {t("pub.spineNote", { px: spec.spineWidth, pages: pageCount })}
      </p>
    </section>
  );
}
