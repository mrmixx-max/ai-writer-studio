// Tests for translator service
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  detectLanguage, 
  translate, 
  getGlossary, 
  addToGlossary, 
  removeFromGlossary,
  type TranslationRequest
} from './translator';

// Mock fetch for Ollama API
const mockFetch = async (url: string | URL, options?: RequestInit): Promise<Response> => {
  const urlStr = url.toString();
  if (urlStr.includes('localhost:11434/api/generate')) {
    const body = JSON.parse(options?.body as string || '{}');
    
    // Simple mock translation - reverse the text for testing
    const mockTranslation = body.prompt.includes('Deutsch') 
      ? 'Translated text (mock)' 
      : 'Übersetztes Text (mock)';
    
    return new Response(JSON.stringify({
      response: mockTranslation
    }), { status: 200 });
  }
  
  throw new Error('Unexpected fetch call');
};
global.fetch = mockFetch as typeof fetch;

describe('Translator Service', () => {
  beforeEach(async () => {
    // Reset glossary before each test
    const glossary = await getGlossary();
    for (const key of Object.keys(glossary)) {
      await removeFromGlossary(key);
    }
  });

  describe('detectLanguage', () => {
    it('should detect German text correctly', async () => {
      const germanText = 'Das ist ein deutscher Text mit vielen deutschen Wörtern und Umlauten wie ä, ö, ü.';
      const detected = await detectLanguage(germanText);
      expect(detected).toBe('de');
    });

    it('should detect English text correctly', async () => {
      const englishText = 'This is an English text with many English words and common patterns.';
      const detected = await detectLanguage(englishText);
      expect(detected).toBe('en');
    });

    it('should default to German for ambiguous text', async () => {
      const ambiguousText = '123 456 789';
      const detected = await detectLanguage(ambiguousText);
      expect(detected).toBe('de');
    });

    it('should detect German by special characters', async () => {
      const textWithUmlauts = 'Hübsch wäre größer.';
      const detected = await detectLanguage(textWithUmlauts);
      expect(detected).toBe('de');
    });
  });

  describe('translate', () => {
    it('should return original text when source and target languages are the same', async () => {
      const request: TranslationRequest = {
        text: 'Same language test',
        sourceLang: 'en',
        targetLang: 'en'
      };
      
      const result = await translate(request);
      expect(result.translated).toBe('Same language test');
      expect(result.confidence).toBe(1.0);
    });

    it('should translate text and return translation result', async () => {
      const request: TranslationRequest = {
        text: 'Hello world',
        sourceLang: 'en',
        targetLang: 'de'
      };
      
      const result = await translate(request);
      expect(result.translated).toBe('Translated text (mock)');
      expect(result.sourceLang).toBe('en');
      expect(result.targetLang).toBe('de');
      expect(result.confidence).toBe(0.85);
    });

    it('should include glossary in translation context', async () => {
      await addToGlossary('hello', 'hallo');
      
      const request: TranslationRequest = {
        text: 'Hello world',
        sourceLang: 'en',
        targetLang: 'de',
        glossary: { 'world': 'Welt' }
      };
      
      const result = await translate(request);
      expect(result.translated).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle translation failure gracefully', async () => {
      // Override fetch to simulate failure
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error('Network error');
      };
      
      const request: TranslationRequest = {
        text: 'Test text',
        sourceLang: 'en',
        targetLang: 'de'
      };
      
      const result = await translate(request);
      expect(result.translated).toBe('Test text'); // Fallback to original
      expect(result.confidence).toBe(0.0);
      
      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('glossary management', () => {
    it('should add entries to glossary', async () => {
      await addToGlossary('hello', 'hallo');
      await addToGlossary('world', 'Welt');
      
      const glossary = await getGlossary();
      expect(glossary['hello']).toBe('hallo');
      expect(glossary['world']).toBe('Welt');
    });

    it('should remove entries from glossary', async () => {
      await addToGlossary('hello', 'hallo');
      await addToGlossary('world', 'Welt');
      
      await removeFromGlossary('hello');
      
      const glossary = await getGlossary();
      expect(glossary['hello']).toBeUndefined();
      expect(glossary['world']).toBe('Welt');
    });

    it('should return empty glossary initially', async () => {
      const glossary = await getGlossary();
      expect(Object.keys(glossary)).toHaveLength(0);
    });

    it('should trim whitespace when adding to glossary', async () => {
      await addToGlossary('  hello  ', '  hallo  ');
      
      const glossary = await getGlossary();
      expect(glossary['hello']).toBe('hallo');
    });
  });
});