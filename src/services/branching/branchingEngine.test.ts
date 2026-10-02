/**
 * Branching Engine Tests — WP 16.2
 * Vitest-kompatible Unit-Tests für den Branching Engine Service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBranchingStory,
  addScene,
  addChoice,
  exportToTwine,
  exportToInk,
  setBranchingState,
  getBranchingStory,
  setVariable,
  getVariable,
  evaluateCondition,
  getAvailableChoices,
  resetBranchingState,
  type BranchingStory,
  type SceneNode,
  type Choice,
  type StoryCondition,
} from './branchingEngine';

describe('BranchingEngine', () => {
  beforeEach(() => {
    resetBranchingState();
  });

  // ─── createBranchingStory ─────────────────────────────────────────────────

  describe('createBranchingStory', () => {
    it('sollte eine Verzweigungsgeschichte mit allen Feldern erstellen', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test Story',
        scenes: [],
        variables: { health: 100 },
      };

      const result = createBranchingStory(story);

      expect(result.id).toBe('story-1');
      expect(result.title).toBe('Test Story');
      expect(result.scenes).toEqual([]);
      expect(result.variables).toEqual({ health: 100 });
    });

    it('sollte defensive Fallbacks bei fehlenden Daten verwenden', () => {
      const story = {} as BranchingStory;

      const result = createBranchingStory(story);

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Untitled Story');
      expect(result.scenes).toEqual([]);
      expect(result.variables).toEqual({});
    });

    it('sollte undefined/null-Input behandeln', () => {
      const result = createBranchingStory(undefined as unknown as BranchingStory);

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Untitled Story');
      expect(result.scenes).toEqual([]);
      expect(result.variables).toEqual({});
    });
  });

  // ─── addScene ─────────────────────────────────────────────────────────────

  describe('addScene', () => {
    it('sollte eine Szene zur Geschichte hinzufügen', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const scene: SceneNode = {
        id: 'scene-1',
        title: 'Opening',
        content: 'You wake up in a dark room.',
        choices: [],
      };

      addScene(scene);

      const state = getBranchingStory();
      expect(state?.scenes).toHaveLength(1);
      expect(state?.scenes[0].id).toBe('scene-1');
      expect(state?.scenes[0].title).toBe('Opening');
    });

    it('sollte eine bestehende Szene aktualisieren', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const scene: SceneNode = {
        id: 'scene-1',
        title: 'Opening',
        content: 'Original content',
        choices: [],
      };

      addScene(scene);

      const updatedScene: SceneNode = {
        id: 'scene-1',
        title: 'Updated Opening',
        content: 'Updated content',
        choices: [],
      };

      addScene(updatedScene);

      const state = getBranchingStory();
      expect(state?.scenes).toHaveLength(1);
      expect(state?.scenes[0].title).toBe('Updated Opening');
      expect(state?.scenes[0].content).toBe('Updated content');
    });

    it('sollte null/undefined-Szenen ignorieren', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      addScene(null as unknown as SceneNode);
      addScene(undefined as unknown as SceneNode);

      const state = getBranchingStory();
      expect(state?.scenes).toHaveLength(0);
    });
  });

  // ─── addChoice ────────────────────────────────────────────────────────────

  describe('addChoice', () => {
    it('sollte eine Wahlmöglichkeit zu einer Szene hinzufügen', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const scene: SceneNode = {
        id: 'scene-1',
        title: 'Opening',
        content: 'You wake up.',
        choices: [],
      };
      addScene(scene);

      const choice: Choice = {
        id: 'choice-1',
        text: 'Go left',
        targetSceneId: 'scene-2',
      };

      addChoice('scene-1', choice);

      const state = getBranchingStory();
      expect(state?.scenes[0].choices).toHaveLength(1);
      expect(state?.scenes[0].choices[0].text).toBe('Go left');
    });

    it('sollte eine bestehende Wahlmöglichkeit aktualisieren', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const scene: SceneNode = {
        id: 'scene-1',
        title: 'Opening',
        content: 'You wake up.',
        choices: [],
      };
      addScene(scene);

      const choice: Choice = {
        id: 'choice-1',
        text: 'Go left',
        targetSceneId: 'scene-2',
      };
      addChoice('scene-1', choice);

      const updatedChoice: Choice = {
        id: 'choice-1',
        text: 'Go right',
        targetSceneId: 'scene-3',
      };
      addChoice('scene-1', updatedChoice);

      const state = getBranchingStory();
      expect(state?.scenes[0].choices).toHaveLength(1);
      expect(state?.scenes[0].choices[0].text).toBe('Go right');
    });

    it('sollte null/undefined-Wahlmöglichkeiten ignorieren', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const scene: SceneNode = {
        id: 'scene-1',
        title: 'Opening',
        content: 'You wake up.',
        choices: [],
      };
      addScene(scene);

      addChoice('scene-1', null as unknown as Choice);
      addChoice('scene-1', undefined as unknown as Choice);

      const state = getBranchingStory();
      expect(state?.scenes[0].choices).toHaveLength(0);
    });
  });

  // ─── exportToTwine ────────────────────────────────────────────────────────

  describe('exportToTwine', () => {
    it('sollte eine gültige Twine-HTML-Datei generieren', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test Story',
        scenes: [
          {
            id: 'scene-1',
            title: 'Opening',
            content: 'You wake up in a dark room.',
            choices: [
              { id: 'c1', text: 'Go left', targetSceneId: 'scene-2' },
              { id: 'c2', text: 'Go right', targetSceneId: 'scene-3' },
            ],
          },
        ],
        variables: { health: 100 },
      };

      const result = exportToTwine(story);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Test Story');
      expect(result).toContain('Opening');
      expect(result).toContain('You wake up in a dark room.');
      expect(result).toContain('Go left');
      expect(result).toContain('Go right');
      expect(result).toContain('scene-2');
      expect(result).toContain('scene-3');
    });

    it('sollte HTML-Sonderzeichen escapen', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test <script>alert("xss")</script>',
        scenes: [
          {
            id: 'scene-1',
            title: 'Scene & More',
            content: 'Content with "quotes" & <tags>',
            choices: [],
          },
        ],
        variables: {},
      };

      const result = exportToTwine(story);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('sollte mit null/undefined umgehen', () => {
      const result = exportToTwine(null as unknown as BranchingStory);

      expect(result).toContain('Error');
    });
  });

  // ─── exportToInk ──────────────────────────────────────────────────────────

  describe('exportToInk', () => {
    it('sollte ein gültiges Ink-Skript generieren', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test Story',
        scenes: [
          {
            id: 'scene-1',
            title: 'Opening',
            content: 'You wake up in a dark room.',
            choices: [
              { id: 'c1', text: 'Go left', targetSceneId: 'scene-2' },
              { id: 'c2', text: 'Go right', targetSceneId: 'scene-3' },
            ],
          },
        ],
        variables: { health: 100 },
      };

      const result = exportToInk(story);

      expect(result).toContain('// Test Story');
      expect(result).toContain('VAR health = 100');
      expect(result).toContain('=== Opening ===');
      expect(result).toContain('You wake up in a dark room.');
      expect(result).toContain('[Go left] -> scene-2');
      expect(result).toContain('[Go right] -> scene-3');
    });

    it('sollte Bedingungen in Ink-Format exportieren', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test Story',
        scenes: [
          {
            id: 'scene-1',
            title: 'Opening',
            content: 'You wake up.',
            choices: [
              {
                id: 'c1',
                text: 'Fight',
                targetSceneId: 'scene-2',
                condition: { variable: 'health', operator: '>', value: 50 },
              },
            ],
          },
        ],
        variables: { health: 100 },
      };

      const result = exportToInk(story);

      expect(result).toContain('{health > 50}');
    });

    it('sollte mit null/undefined umgehen', () => {
      const result = exportToInk(null as unknown as BranchingStory);

      expect(result).toContain('Error');
    });
  });

  // ─── Variablen ────────────────────────────────────────────────────────────

  describe('Variablen', () => {
    it('sollte Variablen setzen und lesen', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      setVariable('health', 100);
      setVariable('name', 'Hero');
      setVariable('isAlive', true);

      expect(getVariable('health')).toBe(100);
      expect(getVariable('name')).toBe('Hero');
      expect(getVariable('isAlive')).toBe(true);
    });

    it('sollte undefined für nicht-existente Variablen zurückgeben', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      expect(getVariable('nonexistent')).toBeUndefined();
    });
  });

  // ─── Bedingungen ──────────────────────────────────────────────────────────

  describe('evaluateCondition', () => {
    it('sollte ==-Bedingung korrekt auswerten', () => {
      const story = createBranchingStory({
        id: 's1',
        title: 'Test',
        scenes: [],
        variables: { health: 100 },
      });
      setBranchingState(story);

      const condition: StoryCondition = { variable: 'health', operator: '==', value: 100 };
      expect(evaluateCondition(condition)).toBe(true);

      const falseCondition: StoryCondition = { variable: 'health', operator: '==', value: 50 };
      expect(evaluateCondition(falseCondition)).toBe(false);
    });

    it('sollte >-Bedingung korrekt auswerten', () => {
      const story = createBranchingStory({
        id: 's1',
        title: 'Test',
        scenes: [],
        variables: { health: 100 },
      });
      setBranchingState(story);

      const condition: StoryCondition = { variable: 'health', operator: '>', value: 50 };
      expect(evaluateCondition(condition)).toBe(true);

      const falseCondition: StoryCondition = { variable: 'health', operator: '>', value: 150 };
      expect(evaluateCondition(falseCondition)).toBe(false);
    });

    it('sollte ungültige Bedingungen als false zurückgeben', () => {
      const story = createBranchingStory({
        id: 's1',
        title: 'Test',
        scenes: [],
        variables: { health: 100 },
      });
      setBranchingState(story);

      expect(evaluateCondition(null as unknown as StoryCondition)).toBe(false);
      expect(evaluateCondition({ variable: 'nonexistent', operator: '==', value: 100 })).toBe(false);
    });
  });

  // ─── getAvailableChoices ───────────────────────────────────────────────────

  describe('getAvailableChoices', () => {
    it('sollte nur verfügbare Wahlmöglichkeiten zurückgeben', () => {
      const story: BranchingStory = {
        id: 'story-1',
        title: 'Test Story',
        scenes: [
          {
            id: 'scene-1',
            title: 'Opening',
            content: 'You wake up.',
            choices: [
              { id: 'c1', text: 'Go left', targetSceneId: 'scene-2' },
              {
                id: 'c2',
                text: 'Fight',
                targetSceneId: 'scene-3',
                condition: { variable: 'health', operator: '>', value: 50 },
              },
              {
                id: 'c3',
                text: 'Flee',
                targetSceneId: 'scene-4',
                condition: { variable: 'health', operator: '<', value: 50 },
              },
            ],
          },
        ],
        variables: { health: 100 },
      };
      setBranchingState(story);

      const available = getAvailableChoices('scene-1');

      expect(available).toHaveLength(2);
      expect(available.map((c) => c.id)).toContain('c1');
      expect(available.map((c) => c.id)).toContain('c2');
      expect(available.map((c) => c.id)).not.toContain('c3');
    });

    it('sollte leeres Array für nicht-existente Szene zurückgeben', () => {
      const story = createBranchingStory({ id: 's1', title: 'Test', scenes: [], variables: {} });
      setBranchingState(story);

      const available = getAvailableChoices('nonexistent');

      expect(available).toEqual([]);
    });
  });

  // ─── Integration ──────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('sollte einen kompletten Workflow unterstützen', () => {
      // Geschichte erstellen
      const story = createBranchingStory({
        id: 'story-1',
        title: 'The Adventure',
        scenes: [],
        variables: { gold: 0, health: 100 },
      });
      setBranchingState(story);

      // Szenen hinzufügen
      addScene({
        id: 'start',
        title: 'The Beginning',
        content: 'You stand at a crossroads.',
        choices: [],
      });

      addScene({
        id: 'forest',
        title: 'The Forest',
        content: 'You enter a dark forest.',
        choices: [],
      });

      addScene({
        id: 'cave',
        title: 'The Cave',
        content: 'You find a hidden cave.',
        choices: [],
      });

      // Wahlmöglichkeiten hinzufügen
      addChoice('start', { id: 'c1', text: 'Go to the forest', targetSceneId: 'forest' });
      addChoice('start', {
        id: 'c2',
        text: 'Enter the cave',
        targetSceneId: 'cave',
        condition: { variable: 'gold', operator: '>', value: 0 },
      });

      // Variablen ändern
      setVariable('gold', 50);

      // Verfügbare Wahlmöglichkeiten prüfen
      const choices = getAvailableChoices('start');
      expect(choices).toHaveLength(2);

      // Exportieren
      const twine = exportToTwine(getBranchingStory()!);
      expect(twine).toContain('The Adventure');
      expect(twine).toContain('The Beginning');

      const ink = exportToInk(getBranchingStory()!);
      expect(ink).toContain('// The Adventure');
      expect(ink).toContain('VAR gold = 50');
    });
  });
});
