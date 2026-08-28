// Cover-Generator: Panel für professionelle Buchcover-Prompts.
import { useState, useCallback } from "react";
import {
  optimizeCoverPrompt,
  generateVariants,
  sharpenPrompt,
  makeMainstream,
  makePremium,
  makeMoreGenre,
  type CoverGenInput,
} from "@/services/llm/covergen";
import { IMAGE_PROVIDER_LABELS, type ImageProviderId } from "@/services/llm/image";

export function CoverGenPanel() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [genre, setGenre] = useState("");
  const [target, setTarget] = useState<"ebook" | "paperback" | "hardcover" | "ad-square" | "promo-wide">("ebook");
  const [mood, setMood] = useState("");
  const [motifs, setMotifs] = useState("");
  const [setting, setSetting] = useState("");
  const [figureDescription, setFigureDescription] = useState("");
  const [colorPalette, setColorPalette] = useState("");
  const [coverStyle, setCoverStyle] = useState<"photo-real" | "illustrated" | "painted" | "minimal" | "typographic" | "cinematic">("cinematic");
  const [provider, setProvider] = useState<ImageProviderId>("openai-dalle");
  const [result, setResult] = useState<ReturnType<typeof optimizeCoverPrompt> | null>(null);
  const [variants, setVariants] = useState<ReturnType<typeof generateVariants> | null>(null);

  const input: CoverGenInput = {
    title,
    subtitle: subtitle || undefined,
    authorName: authorName || undefined,
    genre,
    target,
    mood: mood || undefined,
    motifs: motifs || undefined,
    setting: setting || undefined,
    figureDescription: figureDescription || undefined,
    colorPalette: colorPalette || undefined,
    coverStyle,
    provider,
  };

  const handleGenerate = useCallback(() => {
    setResult(optimizeCoverPrompt(input));
    setVariants(null);
  }, [input]);

  const handleVariants = useCallback(() => {
    setVariants(generateVariants(input));
  }, [input]);

  return (
    <div className="covergen">
      <h2 className="covergen-title">Cover-Generator</h2>

      <div className="covergen-grid">
        <div className="covergen-field">
          <label>Buchtitel *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. NEON PROTOCOL" />
        </div>

        <div className="covergen-field">
          <label>Untertitel</label>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="z.B. Die letzte Entscheidung" />
        </div>

        <div className="covergen-field">
          <label>Autor</label>
          <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="z.B. Max Mustermann" />
        </div>

        <div className="covergen-field">
          <label>Genre *</label>
          <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="z.B. thriller, fantasy, science fiction" />
        </div>

        <div className="covergen-field">
          <label>Zielmarkt</label>
          <select value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
            <option value="ebook">eBook (KDP)</option>
            <option value="paperback">Taschenbuch</option>
            <option value="hardcover">Hardcover</option>
            <option value="ad-square">Social Ad (quadratisch)</option>
            <option value="promo-wide">Promo (Wide)</option>
          </select>
        </div>

        <div className="covergen-field">
          <label>Stimmung</label>
          <input type="text" value={mood} onChange={(e) => setMood(e.target.value)} placeholder="z.B. düster, hoffnungsvoll, episch" />
        </div>

        <div className="covergen-field">
          <label>Motive / Objekte</label>
          <input type="text" value={motifs} onChange={(e) => setMotifs(e.target.value)} placeholder="z.B. Schwert, Drache, Neonlichter" />
        </div>

        <div className="covergen-field">
          <label>Setting / Welt</label>
          <input type="text" value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="z.B. cyberpunk Stadt, mittelalterliche Burg" />
        </div>

        <div className="covergen-field">
          <label>Figurenbeschreibung</label>
          <input type="text" value={figureDescription} onChange={(e) => setFigureDescription(e.target.value)} placeholder="z.B. junge Frau mit rotem Umhang" />
        </div>

        <div className="covergen-field">
          <label>Farbpalette</label>
          <input type="text" value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} placeholder="z.B. blau-orange, monochrom" />
        </div>

        <div className="covergen-field">
          <label>Cover-Stil</label>
          <select value={coverStyle} onChange={(e) => setCoverStyle(e.target.value as typeof coverStyle)}>
            <option value="cinematic">Cinematic</option>
            <option value="photo-real">Photo-real</option>
            <option value="illustrated">Illustrated</option>
            <option value="painted">Painted</option>
            <option value="minimal">Minimal</option>
            <option value="typographic">Typographic</option>
          </select>
        </div>

        <div className="covergen-field">
          <label>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ImageProviderId)}>
            {Object.entries(IMAGE_PROVIDER_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="covergen-actions">
        <button className="covergen-button" onClick={handleGenerate} disabled={!title.trim() || !genre.trim()}>
          Prompt optimieren
        </button>
        <button className="covergen-button secondary" onClick={handleVariants} disabled={!title.trim() || !genre.trim()}>
          3 Varianten erzeugen
        </button>
      </div>

      {result && (
        <div className="covergen-result">
          <h3>Optimierter Prompt</h3>
          <pre className="covergen-prompt">{result.providerOptimizedPrompt}</pre>
          <h4>Negativ-Prompt</h4>
          <pre className="covergen-negative">{result.negativePrompt}</pre>
          <h4>Rationale</h4>
          <p>{result.shortRationale}</p>

          {result.warnings.length > 0 && (
            <div className="covergen-warnings">
              <h4>Warnungen</h4>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="covergen-actions">
            <button className="covergen-button small" onClick={() => setResult({ ...result, providerOptimizedPrompt: sharpenPrompt(result.providerOptimizedPrompt) })}>
              Schärfer
            </button>
            <button className="covergen-button small" onClick={() => setResult({ ...result, providerOptimizedPrompt: makeMainstream(result.providerOptimizedPrompt) })}>
              Mainstream
            </button>
            <button className="covergen-button small" onClick={() => setResult({ ...result, providerOptimizedPrompt: makePremium(result.providerOptimizedPrompt) })}>
              Premium
            </button>
            <button className="covergen-button small" onClick={() => setResult({ ...result, providerOptimizedPrompt: makeMoreGenre(result.providerOptimizedPrompt, genre) })}>
              Mehr Genre
            </button>
          </div>
        </div>
      )}

      {variants && (
        <div className="covergen-variants">
          <h3>Varianten</h3>
          {variants.map((v) => (
            <div key={v.variant} className="covergen-variant">
              <h4>{v.label}</h4>
              <pre>{v.prompt}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
