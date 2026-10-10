// CharacterOnomasticsLedgerModal (Meilenstein 64.0 / v7.6.0 UI)
// Figuren-Onomastik- & Namenskultur-Hauptbuch.
import { useState, useMemo } from "react";
import {
  NAMING_TRADITIONS,
  buildNameCulture,
  generateCharacterName,
  explainNameMeaning,
  checkNameHarmony,
  createSampleNameCulture,
  createSampleCharacterName,
  type NamingTraditionId,
} from "@/services/worldbuilding/characterOnomasticsLedger";

export interface CharacterOnomasticsLedgerModalProps {
  className?: string;
}

const GENDERS: Array<{ value: "male" | "female" | "neutral"; label: string }> = [
  { value: "neutral", label: "Neutral (neutral)" },
  { value: "female", label: "Weiblich (female)" },
  { value: "male", label: "Männlich (male)" },
];

export function CharacterOnomasticsLedgerModal({ className }: CharacterOnomasticsLedgerModalProps) {
  const [seed, setSeed] = useState(42);
  const [cultureName, setCultureName] = useState("Nordmark");
  const [traditionId, setTraditionId] = useState<NamingTraditionId>("patronymic");
  const [gender, setGender] = useState<"male" | "female" | "neutral">("neutral");
  const [role, setRole] = useState("Krieger");
  const [namesToCheck, setNamesToCheck] = useState("Leifsson, Sigridsdóttir, Fitzgerald");

  const sampleCulture = useMemo(() => createSampleNameCulture(), []);
  const sampleName = useMemo(() => createSampleCharacterName(), []);

  const culture = useMemo(
    () => buildNameCulture({ cultureName, traditionId }, seed),
    [cultureName, traditionId, seed]
  );

  const characterName = useMemo(
    () => generateCharacterName({ cultureName, traditionId, gender, role }, seed),
    [cultureName, traditionId, gender, role, seed]
  );

  const meaning = useMemo(
    () => explainNameMeaning(characterName.name, seed),
    [characterName.name, seed]
  );

  const parsedNames = useMemo(
    () =>
      namesToCheck
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    [namesToCheck]
  );

  const harmony = useMemo(
    () => checkNameHarmony(parsedNames, cultureName, seed),
    [parsedNames, cultureName, seed]
  );

  return (
    <div
      className={className}
      data-testid="character-onomastics-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📛 Figuren-Onomastik &amp; Namenskultur-Hauptbuch
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Kultur: {cultureName} · Tradition: {traditionId} · Geschlecht: {gender}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Kultur-Name
          <input
            type="text"
            value={cultureName}
            onChange={(e) => setCultureName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Tradition
          <select
            value={traditionId}
            onChange={(e) => setTraditionId(e.target.value as NamingTraditionId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          >
            {NAMING_TRADITIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Geschlecht
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female" | "neutral")}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          >
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Rolle
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 220 }}>
          Namen zu prüfen (kommagetrennt)
          <input
            type="text"
            value={namesToCheck}
            onChange={(e) => setNamesToCheck(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📜 NAMENS-TRADITIONEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {NAMING_TRADITIONS.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--panel)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>{t.name}</span>
                <span style={{ color: "var(--muted)" }}>{t.id}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                Muster: {t.patterns.join(", ")}
              </div>
              <div style={{ fontSize: 10, color: "var(--text)", marginTop: 4 }}>
                Beispiele: {t.examples.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🗣️ NAMENSKULTUR
        </summary>
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{culture.cultureName}</span>
              <span style={{ color: "var(--muted)" }}>Tradition: {culture.tradition}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Konsonanten: {culture.consonants.join(", ")}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Vokale: {culture.vowels.join(", ")}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Silbenmuster: {culture.syllableStyle}
            </div>
            <div style={{ fontSize: 10, color: "var(--text)", marginTop: 4 }}>{culture.description}</div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧑 FIGURENNAME
        </summary>
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{characterName.name}</span>
              <span style={{ color: "var(--muted)" }}>
                {characterName.tradition} · {characterName.gender}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              Silben: {characterName.syllables.join("·")}
            </div>
            <div style={{ fontSize: 10, color: "var(--text)", marginTop: 4 }}>{characterName.meaning}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              {characterName.etymology}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔮 BEDEUTUNGS-RESONANZ
        </summary>
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--panel)",
            }}
          >
            <div style={{ fontWeight: 700 }}>{meaning.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{meaning.meaning}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{meaning.etymology}</div>
            <div style={{ fontSize: 10, color: "var(--text)", marginTop: 4, fontStyle: "italic" }}>
              {meaning.resonance}
            </div>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {meaning.components.map((c, i) => (
                <div key={`${c.part}-${i}`} style={{ fontSize: 10, color: "var(--muted)" }}>
                  <strong style={{ color: "var(--fg)" }}>{c.part}</strong> — {c.meaning}
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎵 HARMONIE-PRÜFER
        </summary>
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 8,
              border: `1px solid ${harmony.harmonious ? "var(--success)" : "var(--border)"}`,
              borderRadius: 4,
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{harmony.harmonious ? "✓ HARMONISCH" : "✗ ABWEICHUNG"}</span>
              <span style={{ color: "var(--muted)" }}>Score: {harmony.score}/100</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{harmony.description}</div>
            {harmony.violations.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>Verstöße:</div>
                {harmony.violations.map((v, i) => (
                  <div key={`viol-${i}`} style={{ fontSize: 10, color: "var(--muted)" }}>
                    • {v}
                  </div>
                ))}
              </div>
            )}
            {harmony.suggestions.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>Vorschläge:</div>
                {harmony.suggestions.map((s, i) => (
                  <div key={`sug-${i}`} style={{ fontSize: 10, color: "var(--muted)" }}>
                    • {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎲 BEISPIEL-DATENSÄTZE
        </summary>
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: "var(--muted)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div>
            Beispiel-Kultur: <strong style={{ color: "var(--fg)" }}>{sampleCulture.cultureName}</strong> —{" "}
            {sampleCulture.description}
          </div>
          <div>
            Beispiel-Name: <strong style={{ color: "var(--fg)" }}>{sampleName.name}</strong> —{" "}
            {sampleName.meaning}
          </div>
        </div>
      </details>
    </div>
  );
}
