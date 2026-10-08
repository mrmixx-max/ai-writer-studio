// SocialMediaPostSynthesizerModal (WP 110.1 UI)
import { useState, useMemo } from "react";
import {
  generatePost,
  generateCarousel,
  curateHashtags,
  generateCampaign,
  PLATFORMS,
  type PlatformId,
} from "@/services/marketing/socialMediaPostSynthesizer";

export interface SocialMediaPostSynthesizerModalProps {
  className?: string;
}

export function SocialMediaPostSynthesizerModal({ className }: SocialMediaPostSynthesizerModalProps) {
  const [platform, setPlatform] = useState<PlatformId>("booktok");
  const [genre, setGenre] = useState("Dark Romance");
  const [seed, setSeed] = useState(42);

  const post = useMemo(() => generatePost(platform, seed), [platform, seed]);
  const carousel = useMemo(() => generateCarousel(seed), [seed]);
  const hashtags = useMemo(() => curateHashtags(genre, seed), [genre, seed]);
  const campaign = useMemo(() => generateCampaign(genre, seed), [genre, seed]);

  return (
    <div
      className={className}
      data-testid="social-media-post-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📱 Multi-Plattform-Post-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {post.platform.name} · {post.charCount} Zeichen · {post.hashtags.length} Hashtags
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Plattform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Genre
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📝 POST: {post.platform.name}
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>{post.platform.tone}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{post.content}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>{post.visualHint}</div>
          <div style={{ marginTop: 4, fontSize: 10 }}>
            {post.hashtags.map((h) => (
              <span key={h} style={{ display: "inline-block", margin: "2px 4px 2px 0", padding: "2px 6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3, fontSize: 9 }}>{h}</span>
            ))}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎠 KARUSSELL ({carousel.length} Folien)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {carousel.map((s) => (
            <div key={s.slideNumber} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>Folie {s.slideNumber}: {s.title}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{s.body}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>{s.designHint}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🏷️ HASHTAG-KURATOR
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div style={{ marginBottom: 4 }}>
            <strong>Primär:</strong> {hashtags.primary.join(" ")}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Sekundär:</strong> {hashtags.secondary.join(" ")}
          </div>
          <div>
            <strong>Nische:</strong> {hashtags.niche.join(" ")}
          </div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🚀 KAMPAGNEN-ÜBERSICHT ({campaign.posts.length} Plattformen)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {campaign.posts.map((p) => (
            <div key={p.platform.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{p.platform.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{p.content.substring(0, 80)}...</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
