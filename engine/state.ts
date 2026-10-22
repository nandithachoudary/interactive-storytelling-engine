import type { ChoiceEffect, Story, StoryVariables, VariableValue } from './schema';

/**
 * Represents the current in-memory state of an active playthrough.
 *
 * Rules:
 * - schemaVersion & storyVersion are preserved to ensure saved states remain compatible.
 * - currentSceneId tracks which scene the reader is currently experiencing.
 * - variables tracks dynamic changes (flags, counters, strings).
 * - isCompleted indicates if the player has reached a terminal ending.
 */
export interface PlaythroughState {
  schemaVersion: number | string;
  storyVersion: string;
  storyId?: string;
  currentSceneId: string;
  variables: StoryVariables;
  isCompleted: boolean;
  discoveredEndingId?: string;
}

/**
 * Initializes a fresh, independent playthrough state from a validated story.
 * Deeply copies the story's initial variables to ensure playthroughs never mutate the original story.
 */
export function createInitialState(story: Story): PlaythroughState {
  return {
    schemaVersion: story.schemaVersion,
    storyVersion: story.storyVersion,
    storyId: story.id,
    currentSceneId: story.startSceneId,
    variables: { ...story.variables },
    isCompleted: false,
    discoveredEndingId: undefined,
  };
}

/**
 * Immutably updates or adds a variable in a playthrough state.
 */
export function setVariable(
  state: PlaythroughState,
  variable: string,
  value: VariableValue
): PlaythroughState {
  return {
    ...state,
    variables: {
      ...state.variables,
      [variable]: value,
    },
  };
}

/**
 * Pure function to apply a single ChoiceEffect onto a variables object.
 * Returns a new variables object without modifying the input.
 */
export function applyEffectToVariables(
  variables: StoryVariables,
  effect: ChoiceEffect
): StoryVariables {
  const updated = { ...variables };

  switch (effect.type) {
    case 'set':
      updated[effect.variable] = effect.value;
      break;

    case 'add': {
      const current = updated[effect.variable];
      const base = typeof current === 'number' ? current : 0;
      updated[effect.variable] = base + effect.value;
      break;
    }

    case 'toggle': {
      const current = updated[effect.variable];
      const base = typeof current === 'boolean' ? current : false;
      updated[effect.variable] = !base;
      break;
    }
  }

  return updated;
}

/**
 * Immutably applies a list of effects to a playthrough state.
 */
export function applyEffects(
  state: PlaythroughState,
  effects: ChoiceEffect[]
): PlaythroughState {
  if (!effects || effects.length === 0) {
    return state;
  }

  const updatedVariables = effects.reduce<StoryVariables>(
    (acc, effect) => applyEffectToVariables(acc, effect),
    state.variables
  );

  return {
    ...state,
    variables: updatedVariables,
  };
}

/**
 * Immutably updates the current scene of a playthrough.
 */
export function setCurrentScene(
  state: PlaythroughState,
  sceneId: string
): PlaythroughState {
  return {
    ...state,
    currentSceneId: sceneId,
  };
}

/**
 * Marks a playthrough as completed with a specific ending ID.
 */
export function recordEnding(
  state: PlaythroughState,
  endingId: string
): PlaythroughState {
  return {
    ...state,
    isCompleted: true,
    discoveredEndingId: endingId,
  };
}

/**
 * Pure helper to record discovered endings across playthroughs.
 * Maintains an array of unique ending IDs without mutating the input array.
 */
export function recordDiscoveredEnding(
  discoveredEndingIds: readonly string[],
  endingId: string
): string[] {
  if (discoveredEndingIds.includes(endingId)) {
    return [...discoveredEndingIds];
  }
  return [...discoveredEndingIds, endingId];
}

