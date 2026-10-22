import { describe, it, expect } from 'vitest';
import {
  initPlaythrough,
  advancePlaythrough,
  getCurrentScene,
  getAvailableChoices,
  undoLastChoice,
  restartPlaythrough,
  type Story,
  type PlaythroughState,
} from '../index';
import demoStoryData from '../../content/demo-story.json';

describe('Story Player UI Interaction Flow', () => {
  const story = demoStoryData as Story;

  it('mirrors the UI player lifecycle: start, choice selection, scene update, and variable changes', () => {
    // 1. Initial player mount
    let state: PlaythroughState = initPlaythrough(story).state;
    let history: string[] = [];
    let discoveredEndings: string[] = [];

    let currentScene = getCurrentScene(story, state);
    let availableChoices = getAvailableChoices(story, state);

    expect(currentScene.id).toBe('dock');
    expect(currentScene.title).toBe('The Foggy Pier');
    expect(availableChoices.map((c) => c.id)).toEqual([
      'dock_to_beach',
      'dock_to_lighthouse',
    ]);
    expect(state.variables.hasLantern).toBe(false);
    expect(state.variables.cluesFound).toBe(0);

    // 2. Reader clicks 'dock_to_beach'
    const step1 = advancePlaythrough(story, state, 'dock_to_beach', discoveredEndings);
    state = step1.nextState;
    history.push('dock_to_beach');
    discoveredEndings = step1.discoveredEndings;

    currentScene = getCurrentScene(story, state);
    availableChoices = getAvailableChoices(story, state);

    expect(currentScene.id).toBe('beach');
    expect(availableChoices.map((c) => c.id)).toContain('beach_take_lantern');

    // 3. Reader clicks 'beach_take_lantern'
    const step2 = advancePlaythrough(story, state, 'beach_take_lantern', discoveredEndings);
    state = step2.nextState;
    history.push('beach_take_lantern');
    discoveredEndings = step2.discoveredEndings;

    currentScene = getCurrentScene(story, state);
    availableChoices = getAvailableChoices(story, state);

    expect(currentScene.id).toBe('beach_cleared');
    expect(state.variables.hasLantern).toBe(true);
    expect(state.variables.cluesFound).toBe(1);
    expect(availableChoices.map((c) => c.id)).toContain('beach_to_cave');
  });

  it('mirrors UI undo behavior: rolls back scene, choices, and variables, and updates history', () => {
    let state: PlaythroughState = initPlaythrough(story).state;
    let history: string[] = [];
    let discoveredEndings: string[] = [];

    // Advance 2 steps
    const step1 = advancePlaythrough(story, state, 'dock_to_beach', discoveredEndings);
    state = step1.nextState;
    history.push('dock_to_beach');

    const step2 = advancePlaythrough(story, state, 'beach_take_lantern', discoveredEndings);
    state = step2.nextState;
    history.push('beach_take_lantern');

    expect(state.currentSceneId).toBe('beach_cleared');
    expect(state.variables.hasLantern).toBe(true);
    expect(history).toHaveLength(2);

    // Reader clicks "Undo" in the UI
    const undoResult = undoLastChoice(story, history, discoveredEndings);
    state = undoResult.state;
    history = undoResult.history;
    discoveredEndings = undoResult.discoveredEndings;

    const currentScene = getCurrentScene(story, state);
    const availableChoices = getAvailableChoices(story, state);

    // Must be back at beach, with lantern not acquired yet
    expect(currentScene.id).toBe('beach');
    expect(state.variables.hasLantern).toBe(false);
    expect(history).toEqual(['dock_to_beach']);
    expect(availableChoices.map((c) => c.id)).toContain('beach_take_lantern');
  });

  it('mirrors UI restart behavior: resets scene and variables while retaining discovered endings', () => {
    let state: PlaythroughState = initPlaythrough(story).state;
    let history: string[] = ['dock_to_lighthouse', 'approach_enter', 'ask_shelter'];
    let discoveredEndings: string[] = ['ending_escape'];

    // Player clicks "Restart" in the UI
    const restartResult = restartPlaythrough(story, discoveredEndings);
    state = restartResult.state;
    history = restartResult.history;
    discoveredEndings = restartResult.discoveredEndings;

    expect(state.currentSceneId).toBe('dock');
    expect(state.variables.hasLantern).toBe(false);
    expect(state.variables.cluesFound).toBe(0);
    expect(state.isCompleted).toBe(false);
    expect(history).toEqual([]);
    // Lifetime discovered endings preserved for trophy bar
    expect(discoveredEndings).toEqual(['ending_escape']);
  });
});

