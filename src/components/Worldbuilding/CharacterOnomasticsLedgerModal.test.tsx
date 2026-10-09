// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CharacterOnomasticsLedgerModal } from './CharacterOnomasticsLedgerModal';

describe('CharacterOnomasticsLedgerModal', () => {
  it('rendert ohne Fehler', () => {
    const { container } = render(<CharacterOnomasticsLedgerModal />);
    expect(container).toBeTruthy();
  });

  it('zeigt den Titel', () => {
    render(<CharacterOnomasticsLedgerModal />);
    expect(
      screen.getByText('📛 Figuren-Onomastik & Namenskultur-Hauptbuch')
    ).toBeTruthy();
  });

  it('zeigt NAMENS-TRADITIONEN', () => {
    render(<CharacterOnomasticsLedgerModal />);
    expect(screen.getByText('📜 NAMENS-TRADITIONEN')).toBeTruthy();
  });

  it('zeigt NAMENSKULTUR', () => {
    render(<CharacterOnomasticsLedgerModal />);
    expect(screen.getByText('🗣️ NAMENSKULTUR')).toBeTruthy();
  });

  it('zeigt FIGURENNAME', () => {
    render(<CharacterOnomasticsLedgerModal />);
    expect(screen.getByText('🧑 FIGURENNAME')).toBeTruthy();
  });

  it('zeigt HARMONIE-PRÜFER', () => {
    render(<CharacterOnomasticsLedgerModal />);
    expect(screen.getByText('🎵 HARMONIE-PRÜFER')).toBeTruthy();
  });

  it('zeigt einen generierten Figurennamen (non-empty)', () => {
    render(<CharacterOnomasticsLedgerModal />);
    const figurennameSection = screen
      .getByText('🧑 FIGURENNAME')
      .closest('details');
    expect(figurennameSection).toBeTruthy();
    const nameSpan = figurennameSection?.querySelector('span');
    expect(nameSpan).toBeTruthy();
    expect(nameSpan?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('nutzt keine Hex-Farben', () => {
    const { container } = render(<CharacterOnomasticsLedgerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
