// Tests: KI-Rede-Prompt (politische Rede, Redenschreiber → LLM).
import { describe, expect, it } from "vitest";
import { buildRedePrompt, REDE_WOERTER_PRO_MINUTE } from "./index";
import type { KIRequest } from "./types";

function baseReq(overrides: Partial<KIRequest> = {}): KIRequest {
  return {
    action: "rede",
    selection: "",
    context: "",
    redeOpts: {
      anlass: "Wahlkampfauftakt in Musterstadt",
      publikum: "Bürgerinnen und Bürger",
      ton: "kämpferisch",
      minuten: 5,
      kernpunkte: "Bezahlbares Wohnen\nBildung zuerst",
    },
    ...overrides,
  };
}

describe("buildRedePrompt", () => {
  it("enthält Anlass, Publikum, Ton und Kernpunkte", () => {
    const p = buildRedePrompt(baseReq());
    expect(p).toContain("Wahlkampfauftakt in Musterstadt");
    expect(p).toContain("Bürgerinnen und Bürger");
    expect(p).toContain("kämpferisch");
    expect(p).toContain("- Bezahlbares Wohnen");
    expect(p).toContain("- Bildung zuerst");
  });

  it("rechnet Ziel-Länge aus Minuten um (130 Wörter/Min)", () => {
    const p = buildRedePrompt(baseReq());
    expect(p).toContain(`ca. 5 Minuten Redezeit (ca. ${5 * REDE_WOERTER_PRO_MINUTE} Wörter)`);
  });

  it("deckelt Minuten auf 1–60", () => {
    const p99 = buildRedePrompt(
      baseReq({ redeOpts: { ...baseReq().redeOpts!, minuten: 999 } }),
    );
    expect(p99).toContain("ca. 60 Minuten");
    const p0 = buildRedePrompt(
      baseReq({ redeOpts: { ...baseReq().redeOpts!, minuten: 0 } }),
    );
    expect(p0).toContain("ca. 5 Minuten");
  });

  it("baut Funktion und Gegenpositionen ein, wenn gesetzt", () => {
    const p = buildRedePrompt(
      baseReq({
        redeOpts: {
          ...baseReq().redeOpts!,
          funktion: "Bürgermeisterin",
          gegenposition: "Zu teuer\nDauert zu lange",
        },
      }),
    );
    expect(p).toContain("Bürgermeisterin");
    expect(p).toContain("GEGENPOSITIONEN");
    expect(p).toContain("- Zu teuer");
    expect(p).toContain("ohne Polemik");
  });

  it("lässt Funktion/Gegenpositionen weg, wenn leer", () => {
    const p = buildRedePrompt(baseReq());
    expect(p).not.toContain("FUNKTION");
    expect(p).not.toContain("GEGENPOSITIONEN");
  });

  it("hängt Dokumentkontext nur bei Inhalt an", () => {
    expect(buildRedePrompt(baseReq())).not.toContain("DOKUMENTKONTEXT");
    const p = buildRedePrompt(baseReq({ context: "Stilreferenz" }));
    expect(p).toContain("DOKUMENTKONTEXT");
    expect(p).toContain("Stilreferenz");
  });

  it("fordert politische Rhetorik ohne Metakommentare", () => {
    const p = buildRedePrompt(baseReq());
    expect(p).toContain("politische Rede");
    expect(p).toContain("Appell");
    expect(p).toContain("NUR den Redetext");
  });

  it("fällt ohne redeOpts auf Defaults zurück", () => {
    const req = baseReq();
    delete req.redeOpts;
    const p = buildRedePrompt(req);
    expect(p).toContain("(nicht angegeben)");
    expect(p).toContain("sachlich");
  });
});
