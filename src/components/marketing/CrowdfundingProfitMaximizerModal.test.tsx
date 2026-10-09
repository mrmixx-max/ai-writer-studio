// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrowdfundingProfitMaximizerModal } from './CrowdfundingProfitMaximizerModal';

describe('CrowdfundingProfitMaximizerModal', () => {
  it('rendert ohne Fehler', () => {
    render(<CrowdfundingProfitMaximizerModal />);
    expect(screen.getByTestId('crowdfunding-modal')).toBeDefined();
  });

  it('zeigt den Titel', () => {
    render(<CrowdfundingProfitMaximizerModal />);
    expect(screen.getByText('🚀 Crowdfunding-Gewinn- & Tier-Maximierer')).toBeDefined();
  });

  it('zeigt REINGEWINN-KALKULATOR', () => {
    render(<CrowdfundingProfitMaximizerModal />);
    expect(screen.getByText('REINGEWINN-KALKULATOR')).toBeDefined();
  });

  it('zeigt TIER-ARCHITEKTUR', () => {
    render(<CrowdfundingProfitMaximizerModal />);
    expect(screen.getByText('TIER-ARCHITEKTUR')).toBeDefined();
  });

  it('zeigt STRETCH-GOAL-ROI', () => {
    render(<CrowdfundingProfitMaximizerModal />);
    expect(screen.getByText('STRETCH-GOAL-ROI')).toBeDefined();
  });

  it('nutzt keine Hex-Farben', () => {
    const { container } = render(<CrowdfundingProfitMaximizerModal />);
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
