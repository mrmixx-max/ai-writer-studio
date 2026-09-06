import { describe, it, expect } from "vitest";
import {
  normalizeVersion,
  hasSigningKey,
  windowsAssetName,
  assetUrl,
  buildPlatforms,
  buildFeed,
  validateFeed,
  renderFeed,
  fromReleaseJson,
  parseArgs,
  KEYGEN_HINT,
} from "../scripts/updater-feed.mjs";

const SIG = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQpleGFtcGxlc2lnbmF0dXJlMTIzNDU2Nzg5MAo=";

describe("normalizeVersion", () => {
  it("streift v-Praefix", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
  });
  it("akzeptiert plain SemVer", () => {
    expect(normalizeVersion("1.0.0")).toBe("1.0.0");
  });
  it("wirft bei ungueltig", () => {
    expect(() => normalizeVersion("abc")).toThrow();
  });
});

describe("hasSigningKey", () => {
  it("false ohne Key", () => {
    expect(hasSigningKey({})).toBe(false);
  });
  it("true wenn gesetzt", () => {
    expect(hasSigningKey({ TAURI_SIGNING_PRIVATE_KEY: "secret" })).toBe(true);
  });
});

describe("asset/platform helpers", () => {
  it("windowsAssetName folgt Tauri-Konvention", () => {
    expect(windowsAssetName("1.1.0")).toBe("AI-Writer-Studio_1.1.0_x64-setup.nsis.zip");
  });
  it("assetUrl baut GitHub-Download-URL", () => {
    expect(assetUrl("mrmixx-max/ai-writer-studio", "v1.1.0", "f.zip")).toBe(
      "https://github.com/mrmixx-max/ai-writer-studio/releases/download/v1.1.0/f.zip",
    );
  });
  it("buildPlatforms nutzt vorhandenes Asset + Sig", () => {
    const p = buildPlatforms({
      repo: "o/n",
      tag: "v1.1.0",
      version: "1.1.0",
      assets: [{ name: "AI-Writer-Studio_1.1.0_x64-setup.nsis.zip", url: "https://github.com/o/n/releases/download/v1.1.0/a.zip" }],
      sigs: { "windows-x86_64": SIG },
    });
    expect(p["windows-x86_64"].url).toContain("releases/download/v1.1.0");
    expect(p["windows-x86_64"].signature).toBe(SIG);
  });
  it("buildPlatforms wirft ohne Sig (strikt)", () => {
    expect(() =>
      buildPlatforms({ repo: "o/n", tag: "v1.1.0", version: "1.1.0", assets: [] }),
    ).toThrow();
  });
  it("buildPlatforms erlaubt unsigned Draft", () => {
    const p = buildPlatforms({ repo: "o/n", tag: "v1.1.0", version: "1.1.0", assets: [], allowUnsigned: true });
    expect(p["windows-x86_64"].signature).toBe("");
  });
});

describe("feed build/validate/render", () => {
  const platforms = { "windows-x86_64": { url: "https://github.com/o/n/releases/download/v1.1.0/a.zip", signature: SIG } };
  it("buildFeed setzt version/notes/platforms", () => {
    const f = buildFeed({ version: "v1.1.0", notes: "Neu", platforms });
    expect(f.version).toBe("1.1.0");
    expect(f.notes).toBe("Neu");
    expect(f.platforms["windows-x86_64"].url).toContain("https://");
  });
  it("unsigned Draft traegt unsigned-Flag", () => {
    const f = buildFeed({ version: "1.1.0", platforms: { "windows-x86_64": { url: "https://x/y.zip", signature: "" } }, unsigned: true });
    expect(f.unsigned).toBe(true);
  });
  it("validateFeed akzeptiert signierten Feed", () => {
    const f = buildFeed({ version: "1.1.0", notes: "n", platforms });
    expect(validateFeed(f)).toBe(true);
  });
  it("validateFeed lehnt unsigned ab", () => {
    expect(() => validateFeed({ version: "1.1.0", notes: "", pub_date: new Date().toISOString(), platforms: { "windows-x86_64": { url: "https://x/y", signature: "" } } })).toThrow();
  });
  it("renderFeed ist parsebares JSON", () => {
    const f = buildFeed({ version: "1.1.0", platforms });
    expect(JSON.parse(renderFeed(f)).version).toBe("1.1.0");
  });
});

describe("release-json + args", () => {
  it("fromReleaseJson mappt tag/body/assets", () => {
    const r = fromReleaseJson({ tag_name: "v2.0.0", body: "Hi", assets: [{ name: "a", url: "https://x/a" }] });
    expect(r.version).toBe("2.0.0");
    expect(r.notes).toBe("Hi");
    expect(r.assets).toHaveLength(1);
  });
  it("parseArgs liest --sig Paare", () => {
    const a = parseArgs(["--repo", "o/n", "--sig", "windows-x86_64=ABC"]);
    expect(a.repo).toBe("o/n");
    expect(a.sigs["windows-x86_64"]).toBe("ABC");
  });
  it("KEYGEN_HINT enthaelt exakten Befehl", () => {
    expect(KEYGEN_HINT).toContain("tauri signer generate -w");
  });
});
