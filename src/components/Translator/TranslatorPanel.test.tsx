/**
 * @vitest-environment jsdom
 */

// Tests for TranslatorPanel component
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslatorPanel } from './TranslatorPanel';

// Mock the translator service
vi.mock('@/services/translator/translator', () => ({
  translate: vi.fn().mockResolvedValue({
    translated: 'Mock translation result',
    sourceLang: 'en',
    targetLang: 'de',
    confidence: 0.85
  }),
  detectLanguage: vi.fn().mockResolvedValue('en'),
  getGlossary: vi.fn().mockResolvedValue({}),
  addToGlossary: vi.fn().mockResolvedValue(undefined),
  removeFromGlossary: vi.fn().mockResolvedValue(undefined)
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

describe('TranslatorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders language selection dropdowns', () => {
    render(<TranslatorPanel />);
    
    expect(screen.getByLabelText(/Quellsprache/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Zielsprache/)).toBeInTheDocument();
  });

  it('renders swap button', () => {
    render(<TranslatorPanel />);
    
    const swapButton = screen.getByRole('button', { name: /Sprachen tauschen/ });
    expect(swapButton).toBeInTheDocument();
    expect(swapButton).toHaveTextContent('⇄');
  });

  it('renders text input areas', () => {
    render(<TranslatorPanel />);
    
    expect(screen.getByPlaceholderText(/Text hier eingeben/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Übersetzung erscheint hier/)).toBeInTheDocument();
  });

  it('renders translate button', () => {
    render(<TranslatorPanel />);
    
    const translateButton = screen.getByRole('button', { name: /→ Übersetzen/ });
    expect(translateButton).toBeInTheDocument();
  });

  it('disables translate button when no source text', () => {
    render(<TranslatorPanel />);
    
    const translateButton = screen.getByRole('button', { name: /→ Übersetzen/ });
    expect(translateButton).toBeDisabled();
  });

  it('enables translate button when source text is entered', () => {
    render(<TranslatorPanel />);
    
    const sourceTextarea = screen.getByPlaceholderText(/Text hier eingeben/);
    fireEvent.change(sourceTextarea, { target: { value: 'Test text' } });
    
    const translateButton = screen.getByRole('button', { name: /→ Übersetzen/ });
    expect(translateButton).not.toBeDisabled();
  });

  it('swaps languages when swap button is clicked', () => {
    render(<TranslatorPanel />);
    
    const sourceSelect = screen.getByLabelText(/Quellsprache/) as HTMLSelectElement;
    const targetSelect = screen.getByLabelText(/Zielsprache/) as HTMLSelectElement;
    const swapButton = screen.getByRole('button', { name: /Sprachen tauschen/ });
    
    // Initial state: DE -> EN
    expect(sourceSelect.value).toBe('de');
    expect(targetSelect.value).toBe('en');
    
    fireEvent.click(swapButton);
    
    // After swap: EN -> DE
    expect(sourceSelect.value).toBe('en');
    expect(targetSelect.value).toBe('de');
  });

  it('renders glossary section', () => {
    render(<TranslatorPanel />);
    
    expect(screen.getByText(/📚 Glossar/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Quellbegriff/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Zielbegriff/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hinzufügen/ })).toBeInTheDocument();
  });

  it('disables add glossary button when inputs are empty', () => {
    render(<TranslatorPanel />);
    
    const addButton = screen.getByRole('button', { name: /Hinzufügen/ });
    expect(addButton).toBeDisabled();
  });

  it('enables add glossary button when both inputs have values', () => {
    render(<TranslatorPanel />);
    
    const sourceInput = screen.getByPlaceholderText(/Quellbegriff/);
    const targetInput = screen.getByPlaceholderText(/Zielbegriff/);
    const addButton = screen.getByRole('button', { name: /Hinzufügen/ });
    
    fireEvent.change(sourceInput, { target: { value: 'hello' } });
    fireEvent.change(targetInput, { target: { value: 'hallo' } });
    
    expect(addButton).not.toBeDisabled();
  });

  it('shows context input field', () => {
    render(<TranslatorPanel />);
    
    const contextInput = screen.getByPlaceholderText(/technischer Text, Roman, Dialog/);
    expect(contextInput).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<TranslatorPanel />);
    
    const copyButton = screen.getByRole('button', { name: /📋 Kopieren/ });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toBeDisabled(); // Initially disabled because no translation
  });

  it('enables copy button when translation is available', () => {
    render(<TranslatorPanel />);
    
    const translatedTextarea = screen.getByPlaceholderText(/Übersetzung erscheint hier/);
    fireEvent.change(translatedTextarea, { target: { value: 'Some translation' } });
    
    const copyButton = screen.getByRole('button', { name: /📋 Kopieren/ });
    expect(copyButton).not.toBeDisabled();
  });

  it('shows detect language button', () => {
    render(<TranslatorPanel />);
    
    const detectButton = screen.getByRole('button', { name: /🔍 Sprache erkennen/ });
    expect(detectButton).toBeInTheDocument();
  });

  it('disables detect button when no source text', () => {
    render(<TranslatorPanel />);
    
    const detectButton = screen.getByRole('button', { name: /🔍 Sprache erkennen/ });
    expect(detectButton).toBeDisabled();
  });

  it('enables detect button when source text is entered', () => {
    render(<TranslatorPanel />);
    
    const sourceTextarea = screen.getByPlaceholderText(/Text hier eingeben/);
    fireEvent.change(sourceTextarea, { target: { value: 'Test text' } });
    
    const detectButton = screen.getByRole('button', { name: /🔍 Sprache erkennen/ });
    expect(detectButton).not.toBeDisabled();
  });

  it('shows empty glossary message initially', () => {
    render(<TranslatorPanel />);
    
    expect(screen.getByText(/Noch keine Glossar-Einträge vorhanden/)).toBeInTheDocument();
  });
});