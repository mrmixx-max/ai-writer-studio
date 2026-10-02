/**
 * Tests: Dynastie-Engine-Service (WP 30.2)
 */

import { describe, it, expect } from 'vitest';
import {
  createDynasty,
  checkBiologicalPlausibility,
  generateEpilogueTimeline,
  type DynastyMember,
} from './dynastyEngine';

describe('createDynasty', () => {
  it('leeres Array ergibt leere Dynastie', () => {
    const dynasty = createDynasty([]);
    expect(dynasty.members).toEqual([]);
  });

  it('null/undefined ergibt leere Dynastie', () => {
    expect(createDynasty(null as unknown as DynastyMember[]).members).toEqual([]);
    expect(createDynasty(undefined as unknown as DynastyMember[]).members).toEqual([]);
  });

  it('erstellt Dynastie mit Mitgliedern', () => {
    const members: DynastyMember[] = [
      { id: '1', name: 'A', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
    ];
    const dynasty = createDynasty(members);
    expect(dynasty.members.length).toBe(1);
  });

  it('Mitglieder werden nach Geburtsjahr sortiert', () => {
    const members: DynastyMember[] = [
      { id: '1', name: 'B', birthYear: 1050, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
      { id: '2', name: 'A', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
    ];
    const dynasty = createDynasty(members);
    expect(dynasty.members[0].name).toBe('A');
    expect(dynasty.members[1].name).toBe('B');
  });
});

describe('checkBiologicalPlausibility', () => {
  it('leere Eltern ergibt plausibel', () => {
    const member: DynastyMember = { id: '1', name: 'A', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, []);
    expect(result.plausible).toBe(true);
  });

  it('null/undefined ergibt plausibel', () => {
    const member: DynastyMember = { id: '1', name: 'A', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] };
    expect(checkBiologicalPlausibility(member, null as unknown as DynastyMember[]).plausible).toBe(true);
    expect(checkBiologicalPlausibility(member, undefined as unknown as DynastyMember[]).plausible).toBe(true);
  });

  it('Mutter zu jung wird erkannt', () => {
    const member: DynastyMember = { id: '1', name: 'Kind', birthYear: 1010, title: 'Prinz', race: 'human', parentIds: ['2'], spouseIds: [] };
    const mother: DynastyMember = { id: '2', name: 'Mutter', birthYear: 1000, title: 'Königin', race: 'human', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, [mother]);
    expect(result.plausible).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('Mutter im richtigen Alter ist plausibel', () => {
    const member: DynastyMember = { id: '1', name: 'Kind', birthYear: 1030, title: 'Prinz', race: 'human', parentIds: ['2'], spouseIds: [] };
    const mother: DynastyMember = { id: '2', name: 'Mutter', birthYear: 1000, title: 'Königin', race: 'human', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, [mother]);
    expect(result.plausible).toBe(true);
  });

  it('Vater zu jung wird erkannt', () => {
    const member: DynastyMember = { id: '1', name: 'Kind', birthYear: 1010, title: 'Prinz', race: 'human', parentIds: ['2'], spouseIds: [] };
    const father: DynastyMember = { id: '2', name: 'Vater', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, [father]);
    expect(result.plausible).toBe(false);
  });

  it('Lebensspanne über Maximum wird erkannt', () => {
    const member: DynastyMember = { id: '1', name: 'A', birthYear: 1000, deathYear: 1200, title: 'König', race: 'human', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, []);
    expect(result.plausible).toBe(false);
  });

  it('Elfen haben längere Lebensspanne', () => {
    const member: DynastyMember = { id: '1', name: 'A', birthYear: 1000, deathYear: 1300, title: 'König', race: 'elf', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, []);
    expect(result.plausible).toBe(true);
  });

  it('Zwerge haben kürzere Lebensspanne als Elfen', () => {
    const member: DynastyMember = { id: '1', name: 'A', birthYear: 1000, deathYear: 1300, title: 'König', race: 'dwarf', parentIds: [], spouseIds: [] };
    const result = checkBiologicalPlausibility(member, []);
    expect(result.plausible).toBe(false);
  });
});

describe('generateEpilogueTimeline', () => {
  it('leere Dynastie ergibt leeres Array', () => {
    expect(generateEpilogueTimeline({ id: '1', name: 'Test', members: [] })).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(generateEpilogueTimeline(null as unknown as any)).toEqual([]);
    expect(generateEpilogueTimeline(undefined as unknown as any)).toEqual([]);
  });

  it('generiert Zeitleiste mit Geburten', () => {
    const members: DynastyMember[] = [
      { id: '1', name: 'A', birthYear: 1000, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
    ];
    const dynasty = createDynasty(members);
    const timeline = generateEpilogueTimeline(dynasty);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[0].event).toContain('Geburt');
  });

  it('generiert Zeitleiste mit Todesfällen', () => {
    const members: DynastyMember[] = [
      { id: '1', name: 'A', birthYear: 1000, deathYear: 1050, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
    ];
    const dynasty = createDynasty(members);
    const timeline = generateEpilogueTimeline(dynasty);
    expect(timeline.length).toBe(2);
    expect(timeline[1].event).toContain('Tod');
  });

  it('Zeitleiste ist chronologisch sortiert', () => {
    const members: DynastyMember[] = [
      { id: '1', name: 'A', birthYear: 1050, deathYear: 1100, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
      { id: '2', name: 'B', birthYear: 1000, deathYear: 1050, title: 'König', race: 'human', parentIds: [], spouseIds: [] },
    ];
    const dynasty = createDynasty(members);
    const timeline = generateEpilogueTimeline(dynasty);
    expect(timeline[0].year).toBeLessThanOrEqual(timeline[1].year);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateEpilogueTimeline(null as unknown as any)).toEqual([]);
  });
});
