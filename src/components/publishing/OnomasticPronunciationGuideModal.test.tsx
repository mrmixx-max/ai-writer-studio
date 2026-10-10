// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnomasticPronunciationGuideModal } from './OnomasticPronunciationGuideModal';

describe('OnomasticPronunciationGuideModal', () => {
  it('rendert ohne Fehler', () => {
    const { container } = render(<OnomasticPronunciationGuideModal />);
    expect(container).toBeTruthy();
  });

  it('zeigt den Titel', () => {
    render(<OnomasticPronunciationGuideModal />);
    expect(
      screen.getByText('🔊 Aussprache-Lexikon & IPA-Guide für Hörbücher')
    ).toBeTruthy();
  });

  it('zeigt NAMENS-EXTRAKTOR', () => {
    render(<OnomasticPronunciationGuideModal />);
    expect(screen.getByText('NAMENS-EXTRAKTOR')).toBeTruthy();
  });

  it('zeigt LAUTSCHRIFT', () => {
    render(<OnomasticPronunciationGuideModal />);
    expect(screen.getByText('LAUTSCHRIFT')).toBeTruthy();
  });

  it('zeigt AUSSPRACHE-LEXIKON', () => {
    render(<OnomasticPronunciationGuideModal />);
    expect(screen.getByText('AUSSPRACHE-LEXIKON')).toBeTruthy();
  });

  it('zeigt ANHANG-EXPORT', () => {
    render(<OnomasticPronunciationGuideModal />);
    expect(screen.getByText('ANHANG-EXPORT')).toBeTruthy();
  });

  it('zeigt einen IPA-Eintrag', () => {
    render(<OnomasticPronunciationGuideModal />);
    const ipaElements = screen.getAllByText(/\[/);
    expect(ipaElements.length).toBeGreaterThan(0);
  });

  it('nutzt keine Hex-Farben', () => {
    const { container } = render(<OnomasticPronunciationGuideModal />);
    const html = container.innerHTML;
    const hexMatches = html.match(/#[0-9a-fA-F]{3,8}/g);
    expect(hexMatches).toBeNull();
  });
});
