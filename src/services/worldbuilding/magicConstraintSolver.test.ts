/**
 * Tests: Magie-Constraint-Solver (WP 32.1)
 */

import { describe, it, expect } from 'vitest';
import {
  defineAxiom,
  checkSceneCompliance,
  detectDeusExMachina,
  type Axiom,
  type SceneAction,
} from './magicConstraintSolver';

describe('defineAxiom', () => {
  it('definiert ein Axiom', () => {
    const axiom = defineAxiom({
      id: 'teleport',
      name: 'Teleportation',
      preconditions: ['sichtkontakt'],
      energyCost: 50,
      limitations: ['beton'],
    });
    expect(axiom.id).toBe('teleport');
    expect(axiom.name).toBe('Teleportation');
    expect(axiom.energyCost).toBe(50);
  });

  it('leeres Axiom wirft Fehler', () => {
    expect(() => defineAxiom(null as unknown as Axiom)).toThrow();
  });

  it('undefined wirft Fehler', () => {
    expect(() => defineAxiom(undefined as unknown as Axiom)).toThrow();
  });

  it('fehlende Felder werden mit Defaults gefüllt', () => {
    const axiom = defineAxiom({ id: 'test', name: 'Test', preconditions: [], energyCost: 0, limitations: [] });
    expect(axiom.preconditions).toEqual([]);
    expect(axiom.limitations).toEqual([]);
  });

  it('negativer Energiekosten wird zu 0', () => {
    const axiom = defineAxiom({ id: 'test', name: 'Test', preconditions: [], energyCost: -10, limitations: [] });
    expect(axiom.energyCost).toBe(0);
  });
});

describe('checkSceneCompliance', () => {
  const axiom: Axiom = {
    id: 'teleport',
    name: 'Teleportation',
    preconditions: ['sichtkontakt'],
    energyCost: 50,
    limitations: ['beton'],
  };

  it('leere Axiome ergibt compliant', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: [] };
    const result = checkSceneCompliance(scene, []);
    expect(result.compliant).toBe(true);
  });

  it('null/undefined Szene ergibt nicht compliant', () => {
    const result = checkSceneCompliance(null as unknown as SceneAction, [axiom]);
    expect(result.compliant).toBe(false);
  });

  it('erkennt fehlende Vorbedingung', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: [] };
    const result = checkSceneCompliance(scene, [axiom]);
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('erfüllte Vorbedingung ist compliant', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: ['sichtkontakt'] };
    const result = checkSceneCompliance(scene, [axiom]);
    expect(result.compliant).toBe(true);
  });

  it('erkennt Limitation-Verletzung', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: ['sichtkontakt', 'beton'] };
    const result = checkSceneCompliance(scene, [axiom]);
    expect(result.compliant).toBe(false);
  });

  it('mehrere Axiome werden geprüft', () => {
    const axiom2: Axiom = { id: 'feuer', name: 'Feuer', preconditions: ['luft'], energyCost: 30, limitations: [] };
    const scene: SceneAction = { id: '1', character: 'A', action: 'feuer', context: [] };
    const result = checkSceneCompliance(scene, [axiom, axiom2]);
    expect(result.compliant).toBe(false);
  });

  it('ungültige Eingaben werden behandelt', () => {
    const result = checkSceneCompliance(null as unknown as SceneAction, []);
    expect(result.compliant).toBe(false);
  });
});

describe('detectDeusExMachina', () => {
  it('leere etablierte Fähigkeiten ergibt keinen Fund', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: [] };
    const result = detectDeusExMachina(scene, []);
    expect(result.detected).toBe(false);
  });

  it('null/undefined ergibt keinen Fund', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: [] };
    expect(detectDeusExMachina(scene, null as unknown as string[]).detected).toBe(false);
    expect(detectDeusExMachina(scene, undefined as unknown as string[]).detected).toBe(false);
  });

  it('bekannte Fähigkeit wird nicht erkannt', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'teleport', context: [] };
    const result = detectDeusExMachina(scene, ['teleport']);
    expect(result.detected).toBe(false);
  });

  it('unbekannte Fähigkeit wird erkannt', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'zeitstopp', context: [] };
    const result = detectDeusExMachina(scene, ['teleport', 'feuer']);
    expect(result.detected).toBe(true);
  });

  it('unestablishedAbilities wird gefüllt', () => {
    const scene: SceneAction = { id: '1', character: 'A', action: 'zeitstopp', context: [] };
    const result = detectDeusExMachina(scene, ['teleport']);
    expect(result.unestablishedAbilities.length).toBeGreaterThan(0);
  });

  it('ungültige Eingaben werden behandelt', () => {
    const result = detectDeusExMachina(null as unknown as SceneAction, ['teleport']);
    expect(result.detected).toBe(false);
  });
});
