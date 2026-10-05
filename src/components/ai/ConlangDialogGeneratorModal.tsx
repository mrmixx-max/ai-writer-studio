// ConlangDialogGeneratorModal (WP 59.1)
//
// Erzeugt Kunstsprachen mit Phonologie-Profilen, übersetzt Dialogzeilen mit
// narrativer Einbettung und verwaltet das Lexikon-Gedächtnis.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createConlang,
  translateToConlang,
  lookupWord,
  lexiconSize,
  PROFILE_LABELS,
  type PhonologyProfile,
} from "@/services/ai/conlangDialogGenerator";

export interface ConlangDialogGeneratorModalProps {
  /** Vorbefüllter Sprachname. */
  initialLanguageName?: string;
  className?: string;
}

const PROFILES: { value: PhonologyProfile; label: string }[] = [
  { value: "guttural", label: "Kehlig / Kriegerisch" },
  { value: "melodic", label: "Fließend / Melodisch" },
  { value: "mechanical", label: "Maschinell / Prägnant" },
];

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function ConlangDialogGeneratorModal({
  initialLanguageName = "Khar'ash",
  className,
}: ConlangDialogGeneratorModalProps) {
  const [languageName, setLanguageName] = useState(initialLanguageName);
  const [profile, setProfile] = useState<PhonologyProfile>("guttural");
  const [sentence, setSentence] = useState("Blut und Asche");
  const [verb, setVerb] = useState("zischte");
  const [query, setQuery] = useState("Blut");

  const conlang = useMemo(() => createConlang(languageName, profile), [languageName, profile]);
  const phrase = useMemo(
    () => translateToConlang(sentence, conlang, { verb, speaker: "sie" }),
    [sentence, conlang, verb],
  );
  const lookup = useMemo(() => lookupWord(conlang, query), [conlang, query]);

  return (
    <div
      className={className}
      data-testid="conlang-dialog-generator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🗣️ Conlang-Generator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {conlang.name} · {PROFILE_LABELS[conlang.profile]} · {lexiconSize(conlang)} Vokabeln
      </div>

      {/* Sprache + Profil */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Sprachname
        <input
          data-testid="conlang-name-input"
          type="text"
          value={languageName}
          onChange={(e) => setLanguageName(e.target.value)}
          style={inputStyle}
        />
      </label>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PHONOLOGIE-PROFIL</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PROFILES.map((p) => (
            <button
              key={p.value}
              data-testid={`conlang-profile-${p.value}`}
              onClick={() => setProfile(p.value)}
              aria-pressed={profile === p.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: profile === p.value ? "var(--accent)" : "var(--panel)",
                color: profile === p.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phoneminventar */}
      <div
        data-testid="conlang-phonemes"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PHONEMINVENTAR</div>
        <div data-testid="conlang-consonants">
          Konsonanten: {conlang.consonants.join(" ")}
        </div>
        <div data-testid="conlang-vowels" style={{ marginTop: 2 }}>
          Vokale: {conlang.vowels.join(" ")}
        </div>
      </div>

      {/* Übersetzung */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Deutscher Satz
        <input
          data-testid="conlang-sentence-input"
          type="text"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Sprechverb
        <input
          data-testid="conlang-verb-input"
          type="text"
          value={verb}
          onChange={(e) => setVerb(e.target.value)}
          style={inputStyle}
        />
      </label>

      <div data-testid="conlang-phrase" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DIALOG-EINBETTUNG
        </div>
        <div
          data-testid="conlang-foreign"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 12,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {phrase.foreign || "—"}
        </div>
        <div
          data-testid="conlang-narrative"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 12,
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          {phrase.narrative || "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Wörtlich: <span data-testid="conlang-literal">{phrase.literal || "—"}</span>
        </div>
      </div>

      {/* Lexikon */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          LEXIKON-GEDÄCHTNIS ({lexiconSize(conlang)} Einträge)
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          Wort oder Bedeutung nachschlagen
          <input
            data-testid="conlang-lookup-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div
          data-testid="conlang-lookup-result"
          style={{
            border: `1px solid ${lookup.known ? "var(--success)" : "var(--border)"}`,
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
            color: lookup.known ? "var(--success)" : "var(--muted)",
          }}
        >
          {lookup.known
            ? `✓ ${lookup.word} → ${lookup.meaning}`
            : `✗ „${query}" steht nicht im Lexikon`}
        </div>

        <div
          data-testid="conlang-lexicon"
          style={{
            marginTop: 10,
            maxHeight: 180,
            overflow: "auto",
            fontSize: 11,
            lineHeight: 1.7,
          }}
        >
          {conlang.lexicon.map((e) => (
            <div key={e.word} data-testid={`conlang-entry-${e.meaning}`}>
              <strong style={{ color: "var(--accent)" }}>{e.word}</strong> — {e.meaning}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
