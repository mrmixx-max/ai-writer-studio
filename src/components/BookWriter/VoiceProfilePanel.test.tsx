// @vitest-environment jsdom
// Component-Tests: VoiceProfilePanel — Voice-Profile & Abweichungen.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceProfilePanel } from "./VoiceProfilePanel";

const TEXT_WITH_CHARACTERS = `
Hans: "Guten Tag, wie geht es Ihnen heute?"
Greta: "Mir geht es gut, danke der Nachfrage."
Hans: "Das freut mich zu hören. Haben Sie schon Pläne für morgen?"
Greta: "Nein, noch nicht. Ich werde wohl zu Hause bleiben."
Hans: "Das klingt angenehm. Ich werde die Arbeit erledigen."
Greta: "Viel Erfolg damit, Hans."
`;

const TEXT_NO_DIALOGUE = "Der Hund bellt. Die Katze schläft. Der Vogel singt.";

describe("VoiceProfilePanel", () => {
  it("rendert ohne Absturz mit leerem Text", () => {
    render(<VoiceProfilePanel text="" />);
    expect(screen.getByTestId("voice-profile-panel")).toBeTruthy();
    expect(screen.getByTestId("voice-profile-empty")).toBeTruthy();
  });

  it("rendert ohne Absturz mit nur Whitespace", () => {
    render(<VoiceProfilePanel text={"   \n  \t  "} />);
    expect(screen.getByTestId("voice-profile-panel")).toBeTruthy();
    expect(screen.getByTestId("voice-profile-empty")).toBeTruthy();
  });

  it("zeigt Charakter-Profile bei vorhandenem Dialog", () => {
    render(<VoiceProfilePanel text={TEXT_WITH_CHARACTERS} />);
    expect(screen.getByTestId("voice-profile-panel")).toBeTruthy();
    expect(screen.getByTestId("voice-profile-list")).toBeTruthy();
    expect(screen.getByTestId("voice-profile-Hans")).toBeTruthy();
    expect(screen.getByTestId("voice-profile-Greta")).toBeTruthy();
  });

  it("zeigt Metriken der Charakter-Profile", () => {
    render(<VoiceProfilePanel text={TEXT_WITH_CHARACTERS} />);
    const hans = screen.getByTestId("voice-profile-Hans");
    expect(hans.textContent).toContain("Ø Satzlänge");
    expect(hans.textContent).toContain("Füllwort-Quote");
    expect(hans.textContent).toContain("Formalität");
    expect(hans.textContent).toContain("Dialekt");
  });

  it("zeigt Abweichungen bei unterschiedlichen Stimmen", () => {
    render(<VoiceProfilePanel text={TEXT_WITH_CHARACTERS} />);
    expect(screen.getByTestId("voice-profile-deviations")).toBeTruthy();
  });

  it("zeigt Hinweis wenn keine Dialoge gefunden werden", () => {
    render(<VoiceProfilePanel text={TEXT_NO_DIALOGUE} />);
    expect(screen.getByTestId("voice-profile-no-characters")).toBeTruthy();
  });

  it("rendert mit className prop", () => {
    render(<VoiceProfilePanel text="" className="custom-class" />);
    expect(screen.getByTestId("voice-profile-panel").className).toContain("custom-class");
  });
});
