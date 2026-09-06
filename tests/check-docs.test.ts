import { describe, it, expect } from "vitest";
import {
  slugifyHeading,
  collectLinks,
  collectIndexRefs,
  isExternal,
  auditDocs,
} from "../scripts/check-docs.mjs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

describe("slugifyHeading (GitHub-Regel)", () => {
  it("stutzt Standard-Überschriften", () => {
    expect(slugifyHeading("1. Installation")).toBe("1-installation");
    expect(slugifyHeading("In-App-Hilfe (HelpPanel)")).toBe("in-app-hilfe-helppanel");
  });
  it("behandelt Umlaute/Sonderzeichen wie GitHub", () => {
    expect(slugifyHeading("2. Ollama einrichten (inkl. CORS / OLLAMA_ORIGINS)")).toBe(
      "2-ollama-einrichten-inkl-cors--ollama_origins",
    );
  });
});

describe("collectLinks / collectIndexRefs / isExternal", () => {
  it("findet Markdown-Links inkl. Bildern", () => {
    const links = collectLinks("Siehe [Handbuch](handbuch.md) und ![Logo](logo.png).");
    expect(links).toEqual(["handbuch.md", "logo.png"]);
  });
  it("sammelt nur .md-Backtick-Refs aus dem Index", () => {
    const refs = collectIndexRefs("- `handbuch.md` — Text, `npm run x` ignoriert");
    expect(refs).toEqual(["handbuch.md"]);
  });
  it("erkennt externe Ziele", () => {
    expect(isExternal("https://ollama.com")).toBe(true);
    expect(isExternal("mailto:a@b.de")).toBe(true);
    expect(isExternal("handbuch.md")).toBe(false);
  });
});

describe("auditDocs (Repo-Doku, lesend)", () => {
  it("meldet keine toten Links und keinen unvollständigen Index", () => {
    const { errors, checkedFiles } = auditDocs(path.join(ROOT, "docs"));
    expect(checkedFiles).toBeGreaterThan(40);
    expect(errors).toEqual([]);
  });
});

describe("check-docs CLI (trocken)", () => {
  it("exit 0 bei sauberer Doku", () => {
    const out = execFileSync("node", [path.join(ROOT, "scripts", "check-docs.mjs")], {
      encoding: "utf8",
    });
    expect(out).toContain("Keine toten Links");
  });
});
