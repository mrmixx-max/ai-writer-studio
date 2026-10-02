/**
 * Branching Engine Service — WP 16.2 (Interaktiver Verzweigungs-Plot)
 *
 * Lokaler, deterministischer Service für Verzweigungsgeschichten.
 * Keine LLM-Aufrufe, keine Netzwerkzugriffe.
 * Defensive Fallbacks bei fehlenden Daten.
 */

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface StoryCondition {
  variable: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

export interface Choice {
  id: string;
  text: string;
  targetSceneId: string;
  condition?: StoryCondition;
}

export interface SceneNode {
  id: string;
  title: string;
  content: string;
  choices: Choice[];
}

export interface BranchingStory {
  id: string;
  title: string;
  scenes: SceneNode[];
  variables: Record<string, string | number | boolean>;
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeInkString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isValidOperator(op: string): op is StoryCondition['operator'] {
  return ['==', '!=', '>', '<', '>=', '<='].includes(op);
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Erstellt eine Verzweigungsgeschichte.
 * Defensive Fallbacks: fehlende Felder werden mit Default-Werten gefüllt.
 */
export function createBranchingStory(story: BranchingStory): BranchingStory {
  if (!story) {
    return {
      id: generateId(),
      title: 'Untitled Story',
      scenes: [],
      variables: {},
    };
  }

  return {
    id: story.id || generateId(),
    title: story.title || 'Untitled Story',
    scenes: Array.isArray(story.scenes) ? story.scenes : [],
    variables: story.variables && typeof story.variables === 'object' ? story.variables : {},
  };
}

/**
 * Fügt eine Szene zur Geschichte hinzu.
 * Die Geschichte wird im globalen State verwaltet (Closure-basiert).
 */
export function addScene(scene: SceneNode): void {
  if (!scene) return;
  if (!scene.id) return;

  // Szene wird im globalen State gesetzt
  const state = getBranchingState();
  if (!state) return;

  // Prüfe ob Szene bereits existiert
  const existingIndex = state.scenes.findIndex((s) => s.id === scene.id);
  if (existingIndex >= 0) {
    // Bestehende Szene aktualisieren
    state.scenes[existingIndex] = {
      id: scene.id,
      title: scene.title || 'Untitled Scene',
      content: scene.content || '',
      choices: Array.isArray(scene.choices) ? scene.choices : [],
    };
  } else {
    // Neue Szene hinzufügen
    state.scenes.push({
      id: scene.id,
      title: scene.title || 'Untitled Scene',
      content: scene.content || '',
      choices: Array.isArray(scene.choices) ? scene.choices : [],
    });
  }
}

/**
 * Fügt eine Wahlmöglichkeit zu einer Szene hinzu.
 */
export function addChoice(fromSceneId: string, choice: Choice): void {
  if (!fromSceneId || !choice) return;
  if (!choice.id) return;

  const state = getBranchingState();
  if (!state) return;

  const scene = state.scenes.find((s) => s.id === fromSceneId);
  if (!scene) return;

  const existingIndex = scene.choices.findIndex((c) => c.id === choice.id);
  if (existingIndex >= 0) {
    scene.choices[existingIndex] = {
      id: choice.id,
      text: choice.text || '',
      targetSceneId: choice.targetSceneId || '',
      condition: choice.condition,
    };
  } else {
    scene.choices.push({
      id: choice.id,
      text: choice.text || '',
      targetSceneId: choice.targetSceneId || '',
      condition: choice.condition,
    });
  }
}

/**
 * Exportiert die Geschichte als Twine (Harlowe/SugarCube HTML).
 */
export function exportToTwine(story: BranchingStory): string {
  if (!story) {
    return '<html><body><p>Error: No story provided</p></body></html>';
  }

  const title = escapeHtml(story.title || 'Untitled Story');
  const scenes = Array.isArray(story.scenes) ? story.scenes : [];
  const variables = story.variables && typeof story.variables === 'object' ? story.variables : {};

  // Variablen als Twine-Set-Befehle
  const variableLines = Object.entries(variables)
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return `(set: $${key} to ${value})`;
      }
      if (typeof value === 'number') {
        return `(set: $${key} to ${value})`;
      }
      return `(set: $${key} to "${escapeHtml(String(value))}")`;
    })
    .join('\n');

  // Szenen als Twine-Passagen
  const sceneLines = scenes
    .map((scene) => {
      const sceneTitle = escapeHtml(scene.title || 'Untitled Scene');
      const sceneContent = escapeHtml(scene.content || '');
      const choices = Array.isArray(scene.choices) ? scene.choices : [];

      const choiceLines = choices
        .map((choice) => {
          const choiceText = escapeHtml(choice.text || '');
          const targetId = choice.targetSceneId || '';
          const condition = choice.condition;

          if (condition && condition.variable && isValidOperator(condition.operator)) {
            const condValue =
              typeof condition.value === 'string'
                ? `"${escapeHtml(condition.value)}"`
                : String(condition.value);
            return `  - [${choiceText}](if: $${condition.variable} is ${condition.operator} ${condValue})[[${targetId}]]`;
          }
          return `  - [${choiceText}][${targetId}]`;
        })
        .join('\n');

      return `:: ${sceneTitle}\n${sceneContent}\n${choiceLines}`;
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body>
<h1>${title}</h1>
${variableLines}
${sceneLines}
</body>
</html>`;
}

/**
 * Exportiert die Geschichte als Ink (Inkle-kompatibel).
 */
export function exportToInk(story: BranchingStory): string {
  if (!story) {
    return '// Error: No story provided\n';
  }

  const title = story.title || 'Untitled Story';
  const scenes = Array.isArray(story.scenes) ? story.scenes : [];
  const variables = story.variables && typeof story.variables === 'object' ? story.variables : {};

  // Variablen als Ink-Variablen
  const variableLines = Object.entries(variables)
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return `VAR ${key} = ${value}`;
      }
      if (typeof value === 'number') {
        return `VAR ${key} = ${value}`;
      }
      return `VAR ${key} = "${escapeInkString(String(value))}"`;
    })
    .join('\n');

  // Szenen als Ink-Knoten
  const sceneLines = scenes
    .map((scene) => {
      const sceneTitle = scene.title || 'Untitled Scene';
      const sceneContent = scene.content || '';
      const choices = Array.isArray(scene.choices) ? scene.choices : [];

      const choiceLines = choices
        .map((choice) => {
          const choiceText = choice.text || '';
          const targetId = choice.targetSceneId || '';
          const condition = choice.condition;

          if (condition && condition.variable && isValidOperator(condition.operator)) {
            const condValue =
              typeof condition.value === 'string'
                ? `"${escapeInkString(condition.value)}"`
                : String(condition.value);
            return `  * {${condition.variable} ${condition.operator} ${condValue}} [${choiceText}] -> ${targetId}`;
          }
          return `  * [${choiceText}] -> ${targetId}`;
        })
        .join('\n');

      return `=== ${sceneTitle} ===\n${sceneContent}\n${choiceLines}`;
    })
    .join('\n\n');

  return `// ${title}\n// Generated by Branching Engine\n\n${variableLines}\n\n${sceneLines}\n`;
}

// ─── Globaler State (Closure-basiert) ────────────────────────────────────────

let branchingState: BranchingStory | null = null;

function getBranchingState(): BranchingStory | null {
  return branchingState;
}

/**
 * Setzt den globalen State für die Branching Engine.
 * Wird intern verwendet, um addScene/addChoice zu ermöglichen.
 */
export function setBranchingState(story: BranchingStory | null): void {
  branchingState = story;
}

/**
 * Gibt den aktuellen State zurück.
 */
export function getBranchingStory(): BranchingStory | null {
  return branchingState;
}

/**
 * Setzt eine Variable in der Geschichte.
 */
export function setVariable(key: string, value: string | number | boolean): void {
  if (!branchingState) return;
  branchingState.variables[key] = value;
}

/**
 * Gibt den Wert einer Variable zurück.
 */
export function getVariable(key: string): string | number | boolean | undefined {
  if (!branchingState) return undefined;
  return branchingState.variables[key];
}

/**
 * Prüft, ob eine Bedingung erfüllt ist.
 */
export function evaluateCondition(condition: StoryCondition): boolean {
  if (!condition || !condition.variable || !isValidOperator(condition.operator)) {
    return false;
  }

  if (!branchingState) return false;

  const currentValue = branchingState.variables[condition.variable];
  if (currentValue === undefined) return false;

  const targetValue = condition.value;

  try {
    switch (condition.operator) {
      case '==':
        return currentValue === targetValue;
      case '!=':
        return currentValue !== targetValue;
      case '>':
        return Number(currentValue) > Number(targetValue);
      case '<':
        return Number(currentValue) < Number(targetValue);
      case '>=':
        return Number(currentValue) >= Number(targetValue);
      case '<=':
        return Number(currentValue) <= Number(targetValue);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Gibt alle verfügbaren Wahlmöglichkeiten für eine Szene zurück
 * (basierend auf den Bedingungen).
 */
export function getAvailableChoices(sceneId: string): Choice[] {
  if (!branchingState) return [];

  const scene = branchingState.scenes.find((s) => s.id === sceneId);
  if (!scene || !Array.isArray(scene.choices)) return [];

  return scene.choices.filter((choice) => {
    if (!choice.condition) return true;
    return evaluateCondition(choice.condition);
  });
}

/**
 * Setzt den State zurück.
 */
export function resetBranchingState(): void {
  branchingState = null;
}
