import type { Story } from './schema';
import {
  type PlaythroughState,
  recordDiscoveredEnding,
} from './state';
import {
  initPlaythrough,
  advancePlaythrough,
  getCurrentScene,
  getAvailableChoices,
  type AdvanceResult,
} from './runtime';

/**
 * Result of replaying choice history.
 */
export interface ReplayResult {
  state: PlaythroughState;
  validHistory: string[];
  discoveredEndings: string[];
  error?: Error;
}

/**
 * Result of history operations such as undo or restart.
 */
export interface HistoryOperationResult {
  state: PlaythroughState;
  history: string[];
  discoveredEndings: string[];
}

/**
 * Pure function to record a choice ID to history.
 */
export function recordChoice(
  history: readonly string[],
  choiceId: string
): string[] {
  return [...history, choiceId];
}

/**
 * Replays a sequence of choice IDs from the story's initial state.
 *
 * Rules:
 * 1. Restores both the current scene and all story variables correctly.
 * 2. Replays choices sequentially using advancePlaythrough.
 * 3. Handles invalid or corrupted history safely: if a choice fails (missing choice,
 *    unmet condition, already completed), stops replaying at the last valid state,
 *    preserves all choices leading up to the error, and reports the error without crashing.
 * 4. Preserves all previously discovered endings passed into initialDiscoveredEndings.
 */
export function replayChoices(
  story: Story,
  choiceHistory: readonly string[],
  initialDiscoveredEndings: readonly string[] = []
): ReplayResult {
  const init = initPlaythrough(story, initialDiscoveredEndings);
  let currentState = init.state;
  let currentEndings = init.discoveredEndings;
  const validHistory: string[] = [];

  for (let i = 0; i < choiceHistory.length; i++) {
    const choiceId = choiceHistory[i];
    try {
      const result = advancePlaythrough(
        story,
        currentState,
        choiceId,
        currentEndings
      );
      currentState = result.nextState;
      currentEndings = result.discoveredEndings;
      validHistory.push(choiceId);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(`Replay failed at choice index ${i} ("${choiceId}"): ${String(err)}`);
      return {
        state: currentState,
        validHistory,
        discoveredEndings: currentEndings,
        error,
      };
    }
  }

  return {
    state: currentState,
    validHistory,
    discoveredEndings: currentEndings,
  };
}

/**
 * Strict replay: throws immediately if any choice in history cannot be executed.
 */
export function replayChoicesStrict(
  story: Story,
  choiceHistory: readonly string[],
  initialDiscoveredEndings: readonly string[] = []
): HistoryOperationResult {
  const result = replayChoices(story, choiceHistory, initialDiscoveredEndings);
  if (result.error) {
    throw result.error;
  }
  return {
    state: result.state,
    history: result.validHistory,
    discoveredEndings: result.discoveredEndings,
  };
}

/**
 * Undoes the most recent choice taken in the playthrough.
 *
 * Rules:
 * 1. Drops the last choice from history.
 * 2. Completely reconstructs the state (both scene and variables) by replaying the remaining choices.
 * 3. Preserves all discovered endings! Undoing an ending scene does NOT remove the ending
 *    from the player's lifetime discovered endings collection.
 * 4. If history is already empty, returns initial state.
 */
export function undoLastChoice(
  story: Story,
  choiceHistory: readonly string[],
  discoveredEndings: readonly string[] = []
): HistoryOperationResult {
  if (choiceHistory.length === 0) {
    const init = initPlaythrough(story, discoveredEndings);
    return {
      state: init.state,
      history: [],
      discoveredEndings: [...discoveredEndings],
    };
  }

  const shortenedHistory = choiceHistory.slice(0, -1);
  const replay = replayChoices(story, shortenedHistory, discoveredEndings);

  return {
    state: replay.state,
    history: replay.validHistory,
    discoveredEndings: replay.discoveredEndings,
  };
}

/**
 * Restarts a playthrough back to its initial scene and variables.
 *
 * Rules:
 * 1. Resets state to the start scene and original variables.
 * 2. Clears the current playthrough's choice history.
 * 3. Preserves all discovered endings discovered across all playthroughs.
 */
export function restartPlaythrough(
  story: Story,
  discoveredEndings: readonly string[] = []
): HistoryOperationResult {
  const init = initPlaythrough(story, discoveredEndings);
  return {
    state: init.state,
    history: [],
    discoveredEndings: init.discoveredEndings,
  };
}

/**
 * Complete story session combining runtime transitions, choice history,
 * undo, restart, and discovered endings tracking in one high-level controller.
 */
export class StorySession {
  private story: Story;
  private state: PlaythroughState;
  private history: string[];
  private discoveredEndings: string[];

  constructor(
    story: Story,
    initialDiscoveredEndings: readonly string[] = [],
    initialHistory: readonly string[] = []
  ) {
    this.story = story;
    if (initialHistory.length > 0) {
      const replay = replayChoices(story, initialHistory, initialDiscoveredEndings);
      this.state = replay.state;
      this.history = replay.validHistory;
      this.discoveredEndings = replay.discoveredEndings;
    } else {
      const init = initPlaythrough(story, initialDiscoveredEndings);
      this.state = init.state;
      this.history = [];
      this.discoveredEndings = init.discoveredEndings;
    }
  }

  getState(): PlaythroughState {
    return this.state;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getDiscoveredEndings(): string[] {
    return [...this.discoveredEndings];
  }

  getCurrentScene() {
    return getCurrentScene(this.story, this.state);
  }

  getAvailableChoices() {
    return getAvailableChoices(this.story, this.state);
  }

  advance(choiceId: string): AdvanceResult {
    const result = advancePlaythrough(
      this.story,
      this.state,
      choiceId,
      this.discoveredEndings
    );
    this.state = result.nextState;
    this.discoveredEndings = result.discoveredEndings;
    this.history.push(choiceId);
    return result;
  }

  undo(): HistoryOperationResult {
    const result = undoLastChoice(this.story, this.history, this.discoveredEndings);
    this.state = result.state;
    this.history = result.history;
    this.discoveredEndings = result.discoveredEndings;
    return result;
  }

  restart(): HistoryOperationResult {
    const result = restartPlaythrough(this.story, this.discoveredEndings);
    this.state = result.state;
    this.history = result.history;
    this.discoveredEndings = result.discoveredEndings;
    return result;
  }
}

