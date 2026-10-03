/**
 * Tests: Editorial-Council-Service (WP 35.1)
 */

import { describe, it, expect } from 'vitest';
import {
  runEditorialCouncil,
  getCouncilConsensus,
  type CouncilReport,
} from './editorialCouncil';

describe('runEditorialCouncil', () => {
  it('leeres Kapitel ergibt leeren Report', () => {
    const result = runEditorialCouncil('');
    expect(result.plotChirurg).toEqual([]);
  });

  it('null/undefined ergibt leeren Report', () => {
    expect(runEditorialCouncil(null as unknown as string).plotChirurg).toEqual([]);
    expect(runEditorialCouncil(undefined as unknown as string).plotChirurg).toEqual([]);
  });

  it('erkennt Passivkonstruktionen', () => {
    const text = 'Es wurde gemacht. Es wurde gedacht. Es wurde gesagt. Es wurde getan.';
    const result = runEditorialCouncil(text);
    expect(result.stilGourmet.length).toBeGreaterThan(0);
  });

  it('erkennt Füllwörter', () => {
    const text = 'Das war eigentlich ganz gut. Im Grunde genommen war es okay.';
    const result = runEditorialCouncil(text);
    expect(result.stilGourmet.length).toBeGreaterThan(0);
  });

  it('erkennt viele Dialoge', () => {
    const text = '„Hallo» sagte er. „Wie geht es?» fragte sie. „Gut», antwortete er. „Was machst du?», fragte sie. „Nichts», sagte er. „Okay», meinte sie.';
    const result = runEditorialCouncil(text);
    expect(result.figurenPsychologe.length).toBeGreaterThan(0);
  });

  it('erkennt lange Textabschnitte', () => {
    const text = 'Dies ist ein sehr langer Satz. '.repeat(25);
    const result = runEditorialCouncil(text);
    expect(result.plotChirurg.length).toBeGreaterThan(0);
  });

  it('erkennt Wortwiederholungen', () => {
    const text = 'der der der der der der der der der der';
    const result = runEditorialCouncil(text);
    expect(result.kontinuitaetsPedant.length).toBeGreaterThan(0);
  });

  it('einfacher Text ergibt keine Fehler', () => {
    const text = 'Der Hund bellt.';
    const result = runEditorialCouncil(text);
    expect(result.plotChirurg).toEqual([]);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(runEditorialCouncil(null as unknown as string).plotChirurg).toEqual([]);
  });
});

describe('getCouncilConsensus', () => {
  it('leeres Report ergibt leere Zusammenfassung', () => {
    const result = getCouncilConsensus({ plotChirurg: [], figurenPsychologe: [], kontinuitaetsPedant: [], stilGourmet: [] });
    expect(result.totalFindings).toBe(0);
  });

  it('null/undefined ergibt leere Zusammenfassung', () => {
    expect(getCouncilConsensus(null as unknown as any).totalFindings).toBe(0);
    expect(getCouncilConsensus(undefined as unknown as any).totalFindings).toBe(0);
  });

  it('zählt Befunde', () => {
    const report: CouncilReport = {
      plotChirurg: [{ type: 'pacing', severity: 'warning', message: 'Test' }],
      figurenPsychologe: [],
      kontinuitaetsPedant: [],
      stilGourmet: [],
    };
    const result = getCouncilConsensus(report);
    expect(result.totalFindings).toBe(1);
  });

  it('zählt Fehler', () => {
    const report: CouncilReport = {
      plotChirurg: [{ type: 'error', severity: 'error', message: 'Fehler' }],
      figurenPsychologe: [],
      kontinuitaetsPedant: [],
      stilGourmet: [],
    };
    const result = getCouncilConsensus(report);
    expect(result.errors).toBe(1);
  });

  it('zählt Warnungen', () => {
    const report: CouncilReport = {
      plotChirurg: [{ type: 'warning', severity: 'warning', message: 'Warnung' }],
      figurenPsychologe: [],
      kontinuitaetsPedant: [],
      stilGourmet: [],
    };
    const result = getCouncilConsensus(report);
    expect(result.warnings).toBe(1);
  });

  it('zählt Infos', () => {
    const report: CouncilReport = {
      plotChirurg: [{ type: 'info', severity: 'info', message: 'Info' }],
      figurenPsychologe: [],
      kontinuitaetsPedant: [],
      stilGourmet: [],
    };
    const result = getCouncilConsensus(report);
    expect(result.infos).toBe(1);
  });

  it('topIssues werden gefüllt', () => {
    const report: CouncilReport = {
      plotChirurg: [{ type: 'error', severity: 'error', message: 'Top-Fehler' }],
      figurenPsychologe: [],
      kontinuitaetsPedant: [],
      stilGourmet: [],
    };
    const result = getCouncilConsensus(report);
    expect(result.topIssues).toContain('Top-Fehler');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(getCouncilConsensus(null as unknown as any).totalFindings).toBe(0);
  });
});
