// Schritt 4: Startinhalte und Erscheinungsbild.

interface Props {
  sample: boolean;
  onSampleChange: (v: boolean) => void;
  demoPrompts: boolean;
  onDemoPromptsChange: (v: boolean) => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
}

export function StepFinish({
  sample,
  onSampleChange,
  demoPrompts,
  onDemoPromptsChange,
  theme,
  onThemeChange,
}: Props) {
  return (
    <>
      <div className="welcome-step-label">Schritt 4 von 4</div>
      <h2 className="welcome-step-title">Womit möchtest du beginnen?</h2>
      <p className="welcome-step-intro">
        Beides ist optional und lässt sich jederzeit löschen oder nachträglich
        anlegen.
      </p>

      <label className="welcome-option">
        <input
          type="checkbox"
          checked={sample}
          onChange={(e) => onSampleChange(e.target.checked)}
        />
        <span>
          <span className="welcome-option-title">Beispielprojekt anlegen</span>
          <span className="welcome-option-desc">
            „Der Novemberbrief“ — drei Kapitel, zwei Figurenprofile und zwei
            Notizen. Zeigt Editor, Projektwissen und Konsistenzprüfung an
            echtem Material.
          </span>
        </span>
      </label>

      <label className="welcome-option">
        <input
          type="checkbox"
          checked={demoPrompts}
          onChange={(e) => onDemoPromptsChange(e.target.checked)}
        />
        <span>
          <span className="welcome-option-title">Prompt-Vorlagen laden</span>
          <span className="welcome-option-desc">
            Ein Satz erprobter Anweisungen für Weiterschreiben, Umformulieren,
            Straffen und Gegenlesen.
          </span>
        </span>
      </label>

      <div className="welcome-field" style={{ marginTop: 24 }}>
        <label htmlFor="theme-select">Erscheinungsbild</label>
        <select
          id="theme-select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as "light" | "dark")}
        >
          <option value="dark">Dunkel — für lange Schreibsitzungen</option>
          <option value="light">Hell — pergamentfarben</option>
        </select>
      </div>
    </>
  );
}
