// Schritt 1 des Assistenten: Begrüßung mit den drei Kernversprechen.

import { APP_NAME, APP_VERSION } from "@/version";

const PROMISES = [
  {
    num: "I",
    title: "Lokal schreiben",
    text: "Deine Manuskripte liegen auf deinem Rechner. Kein Konto, kein Abo, keine Übertragung, solange du es nicht ausdrücklich einrichtest.",
  },
  {
    num: "II",
    title: "Mit KI denken",
    text: "Weiterschreiben, umformulieren, gegenlesen. Über Ollama oder LM Studio vollständig offline, über OpenAI optional in der Cloud.",
  },
  {
    num: "III",
    title: "Manuskripte entwickeln",
    text: "Kapitel, Figuren, Zeitlinien und Projektwissen an einem Ort. Konsistenzprüfung und Exportkontrolle vor der Veröffentlichung.",
  },
];

export function StepWelcome() {
  return (
    <>
      <div className="welcome-brand">
        <span className="welcome-wordmark">{APP_NAME}</span>
        <span className="welcome-version">VERSION {APP_VERSION}</span>
      </div>

      <p className="welcome-claim">
        Ein Schreibstudio, das auf deinem Rechner bleibt.
      </p>
      <p className="welcome-sub">
        Die Einrichtung dauert weniger als eine Minute. Du kannst sie
        überspringen und später in den Einstellungen nachholen — die App
        funktioniert auch ohne KI-Anbindung vollständig.
      </p>

      <div className="welcome-promises">
        {PROMISES.map((p) => (
          <div className="welcome-promise" key={p.num}>
            <div className="welcome-promise-num">{p.num}</div>
            <div className="welcome-promise-title">{p.title}</div>
            <div className="welcome-promise-text">{p.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}
