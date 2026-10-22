import type { Story, Scene, Choice, StoryVariables } from './schema';
import { evaluateCondition } from './conditions';
import {
  type PlaythroughState,
  createInitialState,
  applyEffects,
  setCurrentScene,
  recordEnding,
  recordDiscoveredEnding,
} from './state';

/**
 * Result of advancing a playthrough by one choice.
 */
export interface AdvanceResult {
  nextState: PlaythroughState;
  nextScene: Scene;
  discoveredEndings: string[];
}

/**
 * Result of initializing a playthrough.
 */
export interface InitPlaythroughResult {
  state: PlaythroughState;
  currentScene: Scene;
  discoveredEndings: string[];
}

/**
 * Looks up a scene in the story by its unique ID.
 * Throws a descriptive error if the scene is missing.
 */
export function getScene(story: Story, sceneId: string): Scene {
  const scene = story.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new Error(`Scene "${sceneId}" not found in story "${story.title}".`);
  }
  return scene;
}

/**
 * Returns the current scene for an active playthrough.
 */
export function getCurrentScene(story: Story, state: PlaythroughState): Scene {
  return getScene(story, state.currentSceneId);
}

/**
 * Returns only the choices whose structured conditions are satisfied by current variables.
 * If the playthrough is completed (at an ending), returns an empty array.
 */
export function getAvailableChoices(
  story: Story,
  state: PlaythroughState
): Choice[] {
  if (state.isCompleted) {
    return [];
  }

  const currentScene = getCurrentScene(story, state);
  return currentScene.choices.filter((choice) =>
    evaluateCondition(choice.condition, state.variables)
  );
}

/**
 * Initializes a new playthrough from a validated story.
 * If the starting scene is already marked as an ending, records it immediately.
 */
export function initPlaythrough(
  story: Story,
  initialDiscoveredEndings: readonly string[] = []
): InitPlaythroughResult {
  const baseState = createInitialState(story);
  const startScene = getScene(story, baseState.currentSceneId);

  let state = baseState;
  let discoveredEndings = [...initialDiscoveredEndings];

  if (startScene.ending) {
    state = recordEnding(state, startScene.ending.id);
    discoveredEndings = recordDiscoveredEnding(
      discoveredEndings,
      startScene.ending.id
    );
  }

  return {
    state,
    currentScene: startScene,
    discoveredEndings,
  };
}

/**
 * Advances a playthrough by selecting a choice by ID.
 *
 * Rules:
 * 1. Rejects transitions if the playthrough is already completed.
 * 2. Rejects choices that do not exist in the current scene.
 * 3. Rejects choices whose conditions are not met (cannot bypass conditions).
 * 4. Applies variable effects defined on the choice.
 * 5. Transitions to destination scene.
 * 6. Detects endings: if destination scene has an ending marker, marks playthrough complete
 *    and records ending ID in discoveredEndings separately.
 * 7. Never mutates input state or story data.
 */
export function advancePlaythrough(
  story: Story,
  state: PlaythroughState,
  choiceId: string,
  discoveredEndings: readonly string[] = []
): AdvanceResult {
  if (state.isCompleted) {
    throw new Error('Cannot advance: playthrough has already reached an ending.');
  }

  const currentScene = getCurrentScene(story, state);

  // Look up choice in current scene
  const choice = currentScene.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(
      `Choice "${choiceId}" does not exist in scene "${currentScene.id}".`
    );
  }

  // Validate condition
  if (!evaluateCondition(choice.condition, state.variables)) {
    throw new Error(
      `Choice "${choiceId}" is not available because its condition was not met.`
    );
  }

  // Look up destination scene
  const destinationScene = getScene(story, choice.destinationSceneId);

  // Apply choice effects to state variables
  const stateWithEffects = applyEffects(state, choice.effects);

  // Transition to destination scene
  let nextState = setCurrentScene(stateWithEffects, destinationScene.id);
  let nextEndings = [...discoveredEndings];

  // If destination scene has an ending marker, record ending
  if (destinationScene.ending) {
    nextState = recordEnding(nextState, destinationScene.ending.id);
    nextEndings = recordDiscoveredEnding(nextEndings, destinationScene.ending.id);
  }

  return {
    nextState,
    nextScene: destinationScene,
    discoveredEndings: nextEndings,
  };
}

/**
 * Optional object-oriented runtime wrapper around the functional engine.
 * Useful for maintaining a stateful playthrough session.
 */
export class StoryRuntime {
  private story: Story;
  private state: PlaythroughState;
  private discoveredEndings: string[];

  constructor(
    story: Story,
    initialState?: PlaythroughState,
    initialDiscoveredEndings: readonly string[] = []
  ) {
    this.story = story;
    if (initialState) {
      this.state = initialState;
      this.discoveredEndings = [...initialDiscoveredEndings];
    } else {
      const init = initPlaythrough(story, initialDiscoveredEndings);
      this.state = init.state;
      this.discoveredEndings = init.discoveredEndings;
    }
  }

  getState(): PlaythroughState {
    return this.state;
  }

  getDiscoveredEndings(): string[] {
    return [...this.discoveredEndings];
  }

  getCurrentScene(): Scene {
    return getCurrentScene(this.story, this.state);
  }

  getAvailableChoices(): Choice[] {
    return getAvailableChoices(this.story, this.state);
  }

  choose(choiceId: string): Scene {
    const result = advancePlaythrough(
      this.story,
      this.state,
      choiceId,
      this.discoveredEndings
    );
    this.state = result.nextState;
    this.discoveredEndings = result.discoveredEndings;
    return result.nextScene;
  }
}

