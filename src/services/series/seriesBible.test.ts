import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSeriesEntity,
  updateEntityStatus,
  getEntityTimeline,
  checkSpoilerGuard,
  resetSeriesBible,
  getAllEntities,
  getEntity,

} from './seriesBible';

describe('SeriesBible Service', () => {
  beforeEach(() => {
    resetSeriesBible();
  });

  // ─── createSeriesEntity ──────────────────────────────────────────────────

  describe('createSeriesEntity', () => {
    it('sollte eine Figur korrekt erstellen', () => {
      const entity = createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 1,
        attributes: { role: 'Protagonistin', age: '28' },
      });

      expect(entity.id).toBe('char_001');
      expect(entity.name).toBe('Elena Voss');
      expect(entity.type).toBe('character');
      expect(entity.firstAppearance).toBe(1);
      expect(entity.attributes).toEqual({ role: 'Protagonistin', age: '28' });
    });

    it('sollte eine ID generieren wenn keine vorhanden ist', () => {
      const entity = createSeriesEntity({
        id: '',
        name: 'Test Figur',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      expect(entity.id).toBeTruthy();
      expect(entity.id.length).toBeGreaterThan(0);
    });

    it('sollte Default-Werte bei fehlenden Daten setzen', () => {
      const entity = createSeriesEntity({
        id: 'char_002',
        name: '',
        type: 'invalid' as any,
        firstAppearance: -5,
        attributes: null as any,
      });

      expect(entity.name).toBe('Unbekannt');
      expect(entity.type).toBe('character');
      expect(entity.firstAppearance).toBe(1);
      expect(entity.attributes).toEqual({});
    });

    it('sollte einen Ort korrekt erstellen', () => {
      const entity = createSeriesEntity({
        id: 'loc_001',
        name: 'Nebelwald',
        type: 'location',
        firstAppearance: 2,
        attributes: { climate: 'temperate', danger: 'high' },
      });

      expect(entity.type).toBe('location');
      expect(entity.firstAppearance).toBe(2);
    });

    it('sollte eine Organisation korrekt erstellen', () => {
      const entity = createSeriesEntity({
        id: 'org_001',
        name: 'Schattenrat',
        type: 'organization',
        firstAppearance: 3,
        attributes: { goal: 'Weltherrschaft', members: '12' },
      });

      expect(entity.type).toBe('organization');
      expect(entity.attributes.goal).toBe('Weltherrschaft');
    });
  });

  // ─── updateEntityStatus ─────────────────────────────────────────────────

  describe('updateEntityStatus', () => {
    it('sollte den Status einer Figur pro Band aktualisieren', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      updateEntityStatus('char_001', 1, 'alive');
      updateEntityStatus('char_001', 2, 'injured');
      updateEntityStatus('char_001', 3, 'dead');

      const timeline = getEntityTimeline('char_001');
      expect(timeline).toHaveLength(3);
      expect(timeline[0].status).toBe('alive');
      expect(timeline[1].status).toBe('injured');
      expect(timeline[2].status).toBe('dead');
    });

    it('sollte eine neue Entität erstellen wenn nicht vorhanden', () => {
      updateEntityStatus('char_new', 1, 'alive');

      const entity = getEntity('char_new');
      expect(entity).toBeTruthy();
      expect(entity!.name).toBe('Unbekannt');
      expect(entity!.type).toBe('character');
    });

    it('sollte ungültigen Status auf "unknown" setzen', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Test',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      updateEntityStatus('char_001', 1, 'invalid_status' as any);

      const timeline = getEntityTimeline('char_001');
      expect(timeline[0].status).toBe('unknown');
    });
  });

  // ─── getEntityTimeline ───────────────────────────────────────────────────

  describe('getEntityTimeline', () => {
    it('sollte ein leeres Array für unbekannte Entität zurückgeben', () => {
      const timeline = getEntityTimeline('nonexistent');
      expect(timeline).toEqual([]);
    });

    it('sollte Timeline-Einträge sortiert nach Band zurückgeben', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      updateEntityStatus('char_001', 3, 'dead');
      updateEntityStatus('char_001', 1, 'alive');
      updateEntityStatus('char_001', 2, 'injured');

      const timeline = getEntityTimeline('char_001');
      expect(timeline).toHaveLength(3);
      expect(timeline[0].bookNumber).toBe(1);
      expect(timeline[1].bookNumber).toBe(2);
      expect(timeline[2].bookNumber).toBe(3);
    });

    it('sollte Fallback-Basis-Eintrag liefern wenn keine Updates vorhanden', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena',
        type: 'character',
        firstAppearance: 2,
        attributes: { role: 'Nebenfigur' },
      });

      const timeline = getEntityTimeline('char_001');
      expect(timeline).toHaveLength(1);
      expect(timeline[0].bookNumber).toBe(2);
      expect(timeline[0].status).toBe('unknown');
      expect(timeline[0].attributes).toEqual({ role: 'Nebenfigur' });
    });
  });

  // ─── checkSpoilerGuard ───────────────────────────────────────────────────

  describe('checkSpoilerGuard', () => {
    it('sollte Spoiler aus späteren Bänden erkennen', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 5,
        attributes: {},
      });

      const warnings = checkSpoilerGuard('Elena Voss erscheint im Text', 2);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].entityName).toBe('Elena Voss');
      expect(warnings[0].entityBook).toBe(5);
      expect(warnings[0].currentBook).toBe(2);
      expect(warnings[0].message).toContain('erscheint erst in Band 5');
    });

    it('sollte keinen Spoiler melden wenn Entität schon erschienen ist', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      const warnings = checkSpoilerGuard('Elena Voss erscheint im Text', 3);
      expect(warnings).toHaveLength(0);
    });

    it('sollte Tod-Spoiler aus späteren Bänden erkennen', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });

      updateEntityStatus('char_001', 4, 'dead');

      const warnings = checkSpoilerGuard('Elena Voss lebt noch', 2);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('stirbt in Band 4');
    });

    it('sollte keine Warnungen bei leerem Text zurückgeben', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 5,
        attributes: {},
      });

      const warnings = checkSpoilerGuard('', 1);
      expect(warnings).toHaveLength(0);
    });

    it('sollte keine Warnungen bei unbekanntem Entitätsnamen zurückgeben', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena Voss',
        type: 'character',
        firstAppearance: 5,
        attributes: {},
      });

      const warnings = checkSpoilerGuard('Max Mustermann erscheint', 1);
      expect(warnings).toHaveLength(0);
    });
  });

  // ─── resetSeriesBible ────────────────────────────────────────────────────

  describe('resetSeriesBible', () => {
    it('sollte alle Daten löschen', () => {
      createSeriesEntity({
        id: 'char_001',
        name: 'Elena',
        type: 'character',
        firstAppearance: 1,
        attributes: {},
      });
      updateEntityStatus('char_001', 1, 'alive');

      resetSeriesBible();

      expect(getAllEntities()).toHaveLength(0);
      expect(getEntityTimeline('char_001')).toEqual([]);
    });
  });
});
