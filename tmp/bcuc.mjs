const CUT_PATTERNS = [
  {
    id: "quadrant",
    name: "4-Quadranten-Schnitt",
    description: "Zerteilt beide Quellen in vier B\xE4nder und verschr\xE4nkt sie abwechselnd zu einem Schachbrett-Montagefluss.",
    bandCount: 4
  },
  {
    id: "diagonal",
    name: "Diagonalschnitt",
    description: "Zwei Dreiecksh\xE4lften: die Fremdquelle l\xE4uft der eigenen r\xFCckw\xE4rts entgegen und kreuzt sie auf der Diagonale.",
    bandCount: 2
  },
  {
    id: "threeWord",
    name: "3-Wort-B\xE4nder",
    description: "Schneidet in Dreiwort-B\xE4nder und w\xFCrfelt die Fremdb\xE4nder deterministisch durch den Eigenfluss.",
    bandCount: 3
  }
];
function hashString(input) {
  let hash = 2166136261;
  const str = input ?? "";
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let z = state;
    z = Math.imul(z ^ z >>> 15, 2923325);
    z = Math.imul(z ^ z >>> 13, 2715949);
    return ((z ^ z >>> 16) >>> 0) / 4294967296;
  };
}
function pick(arr, rng) {
  if (!arr || arr.length === 0) {
    throw new Error("pick: leeres Array kann kein Element liefern");
  }
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}
function shuffle(arr, rng) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function lowerFirst(text) {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}
function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function resolvePattern(patternId) {
  const found = CUT_PATTERNS.find((p) => p.id === patternId);
  return found ? { ...found } : { ...CUT_PATTERNS[0] };
}
function splitIntoBands(text, pattern) {
  const words = (text ?? "").split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  if (pattern.id === "threeWord") {
    const bands2 = [];
    for (let i = 0; i < words.length; i += 3) {
      bands2.push(words.slice(i, i + 3).join(" "));
    }
    return bands2;
  }
  const bandCount = Math.max(1, pattern.bandCount);
  const per = Math.max(1, Math.ceil(words.length / bandCount));
  const bands = [];
  for (let i = 0; i < words.length; i += per) {
    bands.push(words.slice(i, i + per).join(" "));
  }
  return bands;
}
function cutUpText(sourceText, foreignText, patternId, seed) {
  const pattern = resolvePattern(patternId);
  const rng = createSeededRandom(hashString(`${pattern.id}|${seed}`));
  const sourceBands = splitIntoBands(sourceText, pattern);
  let foreignBands = splitIntoBands(foreignText, pattern);
  if (pattern.id === "diagonal") {
    foreignBands = [...foreignBands].reverse();
  } else if (pattern.id === "threeWord") {
    foreignBands = shuffle(foreignBands, rng);
  }
  const segments = [];
  const maxLen = Math.max(sourceBands.length, foreignBands.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < sourceBands.length) segments.push(sourceBands[i]);
    if (i < foreignBands.length) segments.push(foreignBands[i]);
  }
  return {
    segments,
    pattern: pattern.id,
    sourceLength: (sourceText ?? "").length,
    foreignLength: (foreignText ?? "").length
  };
}
const CONNECTORS = [" \u2014 ", ", ", " und ", " dann ", " w\xE4hrend ", " worauf ", " wie "];
const DREAM_IMAGE_MARKERS = [
  "traum",
  "spiegel",
  "schatten",
  "nebel",
  "mond",
  "vogel",
  "uhr",
  "blut",
  "sturm",
  "auge"
];
function polishCutUp(segments, seed) {
  const clean = (segments ?? []).map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
  const rng = createSeededRandom(hashString(`polish|${seed}|${clean.length}`));
  if (clean.length === 0) {
    return { text: "", smoothness: 0, breathless: false };
  }
  const parts = [clean[0]];
  for (let i = 1; i < clean.length; i++) {
    const connector = pick(CONNECTORS, rng);
    parts.push(connector + lowerFirst(clean[i]));
  }
  let text = parts.join("").replace(/\s+/g, " ").trim();
  if (!/[.!?…]$/.test(text)) text += ".";
  const totalWords = clean.reduce(
    (n, s) => n + s.split(/\s+/).filter((w) => w.length > 0).length,
    0
  );
  const avgWords = totalWords / clean.length;
  const flowBonus = Math.min(1, avgWords / 16);
  const jitter = rng();
  const smoothness = Math.round(clamp(flowBonus * 85 + jitter * 15, 0, 100));
  const breathless = smoothness < 55;
  return { text, smoothness, breathless };
}
function stripWord(word) {
  return word.replace(/[^A-Za-zÄÖÜäöüß0-9-]/g, "");
}
function buildTitle(sourceText, foreignText, seed) {
  const rng = createSeededRandom(hashString(`title|${seed}`));
  const words = `${sourceText ?? ""} ${foreignText ?? ""}`.split(/\s+/).map(stripWord).filter((w) => w.length > 4);
  if (words.length === 0) {
    return "Stille Collage";
  }
  const first = capitalize(pick(words, rng));
  let second = capitalize(pick(words, rng));
  let guard = 0;
  while (second === first && words.length > 1 && guard < 8) {
    second = capitalize(pick(words, rng));
    guard++;
  }
  return `${first} ${second} \u2014 eine Cut-Up-Collage`;
}
function escapeXml(text) {
  return (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function buildCoverSvg(title, segments, pattern, seed) {
  const rng = createSeededRandom(hashString(`cover|${pattern.id}|${seed}|${segments.length}`));
  const backgrounds = ["#0d0d12", "#141420", "#1b1626", "#101a24", "#201820"];
  const accents = ["#e8b64c", "#d94f4f", "#4fb0d9", "#9b6bd9", "#63c98c"];
  const bg = pick(backgrounds, rng);
  const accent = pick(accents, rng);
  const ink = "#f2efe6";
  const W = 600;
  const H = 800;
  const bandCount = Math.min(6, Math.max(1, segments.length));
  const bandHeight = Math.round((H - 260) / bandCount);
  const bands = [];
  for (let i = 0; i < bandCount; i++) {
    const seg = segments[i] ?? "";
    const snippet = escapeXml(seg.length > 44 ? seg.slice(0, 41) + "\u2026" : seg);
    const y = 240 + i * bandHeight + Math.round(bandHeight / 2) + 4;
    const rotate = Math.round((rng() * 2 - 1) * 6);
    bands.push(
      `  <text x="40" y="${y}" font-size="15" fill="${ink}" opacity="0.82" transform="rotate(${rotate} 40 ${y})">${snippet}</text>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="font-family: Georgia, serif;">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${accent}" stroke-width="2"/>
  <rect x="20" y="20" width="${W - 40}" height="180" fill="${accent}" opacity="0.12"/>
  <text x="40" y="70" font-size="13" fill="${accent}" letter-spacing="3">BURROUGHS CUT-UP</text>
  <text x="40" y="118" font-size="30" font-weight="bold" fill="${ink}">${escapeXml(title)}</text>
  <text x="40" y="150" font-size="13" fill="${accent}">${escapeXml(pattern.name)}</text>
  <text x="40" y="174" font-size="11" fill="${ink}" opacity="0.6">Seed ${seed} \xB7 ${segments.length} Segmente</text>
${bands.join("\n")}
  <line x1="40" y1="${H - 70}" x2="${W - 40}" y2="${H - 70}" stroke="${accent}" stroke-width="1" opacity="0.6"/>
  <text x="40" y="${H - 44}" font-size="11" fill="${ink}" opacity="0.7">Montage aus Eigen- und Fremdquelle</text>
</svg>`;
}
function buildCollage(sourceText, foreignText, patternId, seed) {
  const pattern = resolvePattern(patternId);
  const cut = cutUpText(sourceText, foreignText, pattern.id, seed);
  const polished = polishCutUp(cut.segments, seed);
  const title = buildTitle(sourceText, foreignText, seed);
  const coverSvg = buildCoverSvg(title, cut.segments, pattern, seed);
  return {
    title,
    segments: cut.segments,
    polishedText: polished.text,
    smoothness: polished.smoothness,
    coverSvg
  };
}
function createSampleCutPattern() {
  return { ...CUT_PATTERNS[0] };
}
function createSampleCollage() {
  const source = "Der Traum \xF6ffnet seine Augen \xFCber der Stadt und die Uhr im Nebel schl\xE4gt dreizehnmal gegen das Fenster w\xE4hrend die V\xF6gel schweigen.";
  const foreign = "Ein Spiegel zerbricht in der Hand des Fremden und der Schatten liest eine Nachricht die niemand geschrieben hat im Sturm.";
  return buildCollage(source, foreign, "quadrant", 1252);
}
export {
  CUT_PATTERNS,
  buildCollage,
  createSampleCollage,
  createSampleCutPattern,
  createSeededRandom,
  cutUpText,
  hashString,
  polishCutUp
};
