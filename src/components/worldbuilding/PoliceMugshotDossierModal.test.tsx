// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoliceMugshotDossierModal } from './PoliceMugshotDossierModal';

describe('PoliceMugshotDossierModal', () => {
  it('rendert ohne Fehler', () => {
    const { container } = render(<PoliceMugshotDossierModal />);
    expect(container).toBeTruthy();
  });

  it('zeigt den Titel', () => {
    render(<PoliceMugshotDossierModal />);
    expect(screen.getByText(/Erkennungsdienst- & Mugshot-Dossier/)).toBeInTheDocument();
  });

  it('zeigt MUGSHOT-SCHILD', () => {
    render(<PoliceMugshotDossierModal />);
    expect(screen.getByText(/MUGSHOT-SCHILD/)).toBeInTheDocument();
  });

  it('zeigt FINGERABDRUCK-KARTE', () => {
    render(<PoliceMugshotDossierModal />);
    expect(screen.getByText(/FINGERABDRUCK-KARTE/)).toBeInTheDocument();
  });

  it('zeigt SIGNALEMENT', () => {
    render(<PoliceMugshotDossierModal />);
    expect(screen.getByText(/SIGNALEMENT/)).toBeInTheDocument();
  });

  it('nutzt keine Hex-Farben', () => {
    const { container } = render(<PoliceMugshotDossierModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
