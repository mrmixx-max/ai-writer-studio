// TranslatorPanel: DE↔EN translation with glossary
// Bloomberg Terminal theme styling
import { useState, useEffect } from 'react';
import { 
  translate, 
  detectLanguage, 
  getGlossary, 
  addToGlossary, 
  removeFromGlossary,
  type TranslationRequest 
} from '@/services/translator/translator';
import './translatorPanel.css';

export function TranslatorPanel() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState<'de' | 'en'>('de');
  const [targetLang, setTargetLang] = useState<'de' | 'en'>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  const [newGlossarySource, setNewGlossarySource] = useState('');
  const [newGlossaryTarget, setNewGlossaryTarget] = useState('');
  const [context, setContext] = useState('');

  // Load initial glossary
  useEffect(() => {
    loadGlossary();
  }, []);

  const loadGlossary = async () => {
    const currentGlossary = await getGlossary();
    setGlossary(currentGlossary);
  };

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleDetectLanguage = async () => {
    if (!sourceText.trim()) return;
    
    setIsDetecting(true);
    try {
      const detected = await detectLanguage(sourceText);
      setSourceLang(detected);
      setTargetLang(detected === 'de' ? 'en' : 'de');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    
    setIsTranslating(true);
    try {
      const request: TranslationRequest = {
        text: sourceText,
        sourceLang,
        targetLang,
        glossary,
        context: context.trim() || undefined
      };
      
      const result = await translate(request);
      setTranslatedText(result.translated);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAddToGlossary = async () => {
    if (!newGlossarySource.trim() || !newGlossaryTarget.trim()) return;
    
    await addToGlossary(newGlossarySource, newGlossaryTarget);
    setNewGlossarySource('');
    setNewGlossaryTarget('');
    await loadGlossary();
  };

  const handleRemoveFromGlossary = async (source: string) => {
    await removeFromGlossary(source);
    await loadGlossary();
  };

  const handleCopyTranslation = async () => {
    if (translatedText) {
      await navigator.clipboard.writeText(translatedText);
    }
  };

  return (
    <div className="translator-panel">
      <div className="translator-header">
        <h2>🌐 Übersetzer DE↔EN</h2>
      </div>

      {/* Language Selection */}
      <div className="language-controls">
        <div className="language-select">
          <label htmlFor="source-lang-select">Quellsprache:</label>
          <select 
            id="source-lang-select"
            value={sourceLang} 
            onChange={(e) => setSourceLang(e.target.value as 'de' | 'en')}
            className="lang-dropdown"
          >
            <option value="de">🇩🇪 Deutsch</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>

        <button 
          className="swap-button"
          onClick={handleSwapLanguages}
          title="Sprachen tauschen"
          aria-label="Sprachen tauschen"
        >
          ⇄
        </button>

        <div className="language-select">
          <label htmlFor="target-lang-select">Zielsprache:</label>
          <select 
            id="target-lang-select"
            value={targetLang} 
            onChange={(e) => setTargetLang(e.target.value as 'de' | 'en')}
            className="lang-dropdown"
          >
            <option value="de">🇩🇪 Deutsch</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>
      </div>

      {/* Translation Area */}
      <div className="translation-area">
        <div className="input-section">
          <div className="input-header">
            <label htmlFor="source-text">Eingabe ({sourceLang === 'de' ? 'Deutsch' : 'English'}):</label>
            <button 
              onClick={handleDetectLanguage}
              disabled={isDetecting || !sourceText.trim()}
              className="detect-button"
              title="Sprache automatisch erkennen"
            >
              {isDetecting ? '🔍 Erkenne...' : '🔍 Sprache erkennen'}
            </button>
          </div>
          
          <textarea
            id="source-text"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Text hier eingeben..."
            className="source-textarea"
            rows={8}
          />

          <div className="context-section">
            <label htmlFor="context-input">Kontext (optional):</label>
            <input
              id="context-input"
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="z.B. technischer Text, Roman, Dialog..."
              className="context-input"
            />
          </div>
        </div>

        <div className="translation-controls">
          <button
            onClick={handleTranslate}
            disabled={isTranslating || !sourceText.trim()}
            className="translate-button"
          >
            {isTranslating ? '⏳ Übersetze...' : '→ Übersetzen'}
          </button>
        </div>

        <div className="output-section">
          <div className="output-header">
            <label htmlFor="translated-text">Übersetzung ({targetLang === 'de' ? 'Deutsch' : 'English'}):</label>
            <button 
              onClick={handleCopyTranslation}
              disabled={!translatedText.trim()}
              className="copy-button"
              title="Übersetzung kopieren"
            >
              📋 Kopieren
            </button>
          </div>
          
          <textarea
            id="translated-text"
            value={translatedText}
            onChange={(e) => setTranslatedText(e.target.value)}
            placeholder="Übersetzung erscheint hier..."
            className="translated-textarea"
            rows={8}
          />
        </div>
      </div>

      {/* Glossary Section */}
      <div className="glossary-section">
        <h3>📚 Glossar</h3>
        
        <div className="glossary-add">
          <input
            type="text"
            value={newGlossarySource}
            onChange={(e) => setNewGlossarySource(e.target.value)}
            placeholder="Quellbegriff"
            className="glossary-input"
          />
          <input
            type="text"
            value={newGlossaryTarget}
            onChange={(e) => setNewGlossaryTarget(e.target.value)}
            placeholder="Zielbegriff"
            className="glossary-input"
          />
          <button
            onClick={handleAddToGlossary}
            disabled={!newGlossarySource.trim() || !newGlossaryTarget.trim()}
            className="add-glossary-button"
          >
            + Hinzufügen
          </button>
        </div>

        <div className="glossary-list">
          {Object.keys(glossary).length === 0 ? (
            <p className="empty-glossary">Noch keine Glossar-Einträge vorhanden.</p>
          ) : (
            <ul className="glossary-items">
              {Object.entries(glossary).map(([source, target]) => (
                <li key={source} className="glossary-item">
                  <span className="glossary-source">{source}</span>
                  <span className="glossary-arrow">→</span>
                  <span className="glossary-target">{target}</span>
                  <button
                    onClick={() => handleRemoveFromGlossary(source)}
                    className="remove-glossary-button"
                    title="Eintrag entfernen"
                    aria-label={`Glossar-Eintrag ${source} entfernen`}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}