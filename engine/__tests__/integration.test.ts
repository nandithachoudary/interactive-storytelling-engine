import { describe, it, expect } from 'vitest';
import {
  validateStory,
  validateStoryGraph,
  StorySession,
  StoryRuntime,
  initPlaythrough,
  advancePlaythrough,
  getAvailableChoices,
  replayChoices,
  type Story,
} from '../index';
import demoStoryData from '../../content/demo-story.json';

describe('Story Engine Integration Tests', () => {
  const story = demoStoryData as Story;

  // 10. Story validation and runtime initialization working together correctly
  it('validates the story graph before initializing runtime session', () => {
    const validation = validateStory(story);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.warnings).toHaveLength(0);

    // Initializing runtime session with the validated story
    const session = new StorySession(story);
    expect(session.getCurrentScene().id).toBe('dock');
    expect(session.getState().isCompleted).toBe(false);
  });

  // 1. A complete path from the starting scene to an ending (Good Ending)
  it('completes a full journey to the victorious good ending (The Mastermind Exposed)', () => {
    const session = new StorySession(story);

    // 1. Start at dock -> head to beach
    expect(session.getCurrentScene().id).toBe('dock');
    session.advance('dock_to_beach');

    // 2. Beach -> pick up storm lantern and key
    expect(session.getCurrentScene().id).toBe('beach');
    session.advance('beach_take_lantern');

    // 3. Beach cleared -> venture into cave with lantern
    expect(session.getCurrentScene().id).toBe('beach_cleared');
    expect(session.getState().variables.hasLantern).toBe(true);
    expect(session.getState().variables.cluesFound).toBe(1);
    session.advance('beach_to_cave');

    // 4. Cave -> study the smuggler's logbook (+2 clues)
    expect(session.getCurrentScene().id).toBe('cave');
    session.advance('cave_read_log');

    // 5. Cave studied -> confront lighthouse keeper
    expect(session.getCurrentScene().id).toBe('cave_studied');
    expect(session.getState().variables.cluesFound).toBe(3);
    session.advance('studied_to_lighthouse');

    // 6. Lighthouse interior -> present evidence (cluesFound >= 3)
    expect(session.getCurrentScene().id).toBe('lighthouse_interior');
    const availableChoices = session.getAvailableChoices().map((c) => c.id);
    expect(availableChoices).toContain('confront_keeper_evidence');
    expect(availableChoices).not.toContain('confront_keeper_unprepared'); // Hidden because cluesFound is 3 (not < 3)

    session.advance('confront_keeper_evidence');

    // Reached good ending
    const finalState = session.getState();
    expect(finalState.currentSceneId).toBe('ending_solved');
    expect(finalState.isCompleted).toBe(true);
    expect(finalState.discoveredEndingId).toBe('ending_truth');
    expect(session.getDiscoveredEndings()).toEqual(['ending_truth']);
    expect(session.getCurrentScene().ending?.type).toBe('good');
  });

  // 2. A different set of choices reaching a different ending (Bad Ending)
  it('navigates an alternative route to the bad ending (Silenced in the Dark)', () => {
    const session = new StorySession(story);

    // Dock -> straight to lighthouse without gathering any clues
    session.advance('dock_to_lighthouse');
    expect(session.getCurrentScene().id).toBe('lighthouse_approach');

    session.advance('approach_enter');
    expect(session.getCurrentScene().id).toBe('lighthouse_interior');
    expect(session.getState().variables.cluesFound).toBe(0);

    // Because cluesFound is 0 (< 3), unprepared accusation is available, but evidence accusation is not
    const choices = session.getAvailableChoices().map((c) => c.id);
    expect(choices).toContain('confront_keeper_unprepared');
    expect(choices).not.toContain('confront_keeper_evidence');

    session.advance('confront_keeper_unprepared');

    // Reached bad ending
    expect(session.getCurrentScene().id).toBe('ending_captured');
    expect(session.getState().isCompleted).toBe(true);
    expect(session.getState().discoveredEndingId).toBe('ending_locked');
    expect(session.getDiscoveredEndings()).toEqual(['ending_locked']);
    expect(session.getCurrentScene().ending?.type).toBe('bad');
  });

  // 3. Choices becoming available or unavailable as variables change
  it('dynamically unlocks and locks choices as variables change', () => {
    const session = new StorySession(story);

    // Dock -> beach
    session.advance('dock_to_beach');
    expect(session.getState().variables.hasLantern).toBe(false);

    // At beach, 'beach_take_lantern' is available (hasLantern == false)
    expect(session.getAvailableChoices().map((c) => c.id)).toContain(
      'beach_take_lantern'
    );

    // Take lantern -> advances to beach_cleared
    session.advance('beach_take_lantern');
    expect(session.getState().variables.hasLantern).toBe(true);

    // In beach_cleared, 'beach_to_cave' is now available because hasLantern is true
    expect(session.getAvailableChoices().map((c) => c.id)).toContain(
      'beach_to_cave'
    );
  });

  // 4. Effects being applied in the correct order
  it('applies sequential effects on state variables accurately', () => {
    const session = new StorySession(story);

    // Initial state
    expect(session.getState().variables.hasLantern).toBe(false);
    expect(session.getState().variables.cluesFound).toBe(0);

    // beach_take_lantern has two effects: set hasLantern=true, add cluesFound=1
    session.advance('dock_to_beach');
    session.advance('beach_take_lantern');

    expect(session.getState().variables.hasLantern).toBe(true);
    expect(session.getState().variables.cluesFound).toBe(1);

    // cave_read_log adds +2 clues
    session.advance('beach_to_cave');
    session.advance('cave_read_log');

    expect(session.getState().variables.cluesFound).toBe(3);
  });

  // 5. Undo restoring the previous scene and variables
  it('undoes choices and rolls back both scene and variable mutations accurately', () => {
    const session = new StorySession(story);

    session.advance('dock_to_beach');
    session.advance('beach_take_lantern'); // cluesFound = 1
    session.advance('beach_to_cave');
    session.advance('cave_read_log');      // cluesFound = 3

    expect(session.getCurrentScene().id).toBe('cave_studied');
    expect(session.getState().variables.cluesFound).toBe(3);

    // Undo reading the log
    session.undo();

    expect(session.getCurrentScene().id).toBe('cave');
    // Must restore cluesFound back to 1!
    expect(session.getState().variables.cluesFound).toBe(1);
    expect(session.getState().variables.hasLantern).toBe(true);
    expect(session.getHistory()).toEqual([
      'dock_to_beach',
      'beach_take_lantern',
      'beach_to_cave',
    ]);
  });

  // 6. Replaying history reproducing the same state
  it('reconstructs the exact state when replaying recorded history', () => {
    const session = new StorySession(story);

    session.advance('dock_to_beach');
    session.advance('beach_take_lantern');
    session.advance('beach_to_cave');
    session.advance('cave_read_log');
    session.advance('studied_to_lighthouse');

    const liveState = session.getState();
    const liveHistory = session.getHistory();

    // Replay from raw choice IDs
    const replayResult = replayChoices(story, liveHistory);

    expect(replayResult.error).toBeUndefined();
    expect(replayResult.validHistory).toEqual(liveHistory);
    expect(replayResult.state.currentSceneId).toBe(liveState.currentSceneId);
    expect(replayResult.state.variables).toEqual(liveState.variables);
    expect(replayResult.state.isCompleted).toBe(liveState.isCompleted);
  });

  // 7. Restart resetting the playthrough while preserving discovered endings
  it('resets playthrough on restart while accumulating unique discovered endings across playthroughs', () => {
    const session = new StorySession(story);

    // Playthrough 1: Reach good ending ('ending_truth')
    session.advance('dock_to_beach');
    session.advance('beach_take_lantern');
    session.advance('beach_to_cave');
    session.advance('cave_read_log');
    session.advance('studied_to_lighthouse');
    session.advance('confront_keeper_evidence');

    expect(session.getState().isCompleted).toBe(true);
    expect(session.getDiscoveredEndings()).toEqual(['ending_truth']);

    // Restart playthrough
    session.restart();

    expect(session.getCurrentScene().id).toBe('dock');
    expect(session.getState().isCompleted).toBe(false);
    expect(session.getState().variables.cluesFound).toBe(0);
    expect(session.getHistory()).toEqual([]);
    // Ending is preserved!
    expect(session.getDiscoveredEndings()).toEqual(['ending_truth']);

    // Playthrough 2: Reach bad ending ('ending_locked')
    session.advance('dock_to_lighthouse');
    session.advance('approach_enter');
    session.advance('confront_keeper_unprepared');

    expect(session.getState().isCompleted).toBe(true);
    // Both endings are now recorded in lifetime discovered endings!
    expect(session.getDiscoveredEndings()).toEqual([
      'ending_truth',
      'ending_locked',
    ]);
  });

  // 8. Invalid choices not corrupting the session
  it('safely rejects invalid or out-of-context choices without mutating session state', () => {
    const session = new StorySession(story);

    const stateBeforeError = {
      ...session.getState(),
      variables: { ...session.getState().variables },
    };
    const historyBeforeError = [...session.getHistory()];

    // Attempting a choice that does not exist in 'dock'
    expect(() => session.advance('beach_take_lantern')).toThrowError(
      /does not exist in scene "dock"/i
    );

    // State, variables, and history must remain completely intact
    expect(session.getState()).toEqual(stateBeforeError);
    expect(session.getHistory()).toEqual(historyBeforeError);

    // Valid choices continue to work normally
    session.advance('dock_to_beach');
    expect(session.getCurrentScene().id).toBe('beach');
  });

  // 9. Ending completion preventing further choices
  it('prevents any further transitions once an ending has been reached', () => {
    const session = new StorySession(story);

    // Take fast path to neutral ending: dock -> lighthouse_approach -> lighthouse_interior -> ask_shelter
    session.advance('dock_to_lighthouse');
    session.advance('approach_enter');
    session.advance('ask_shelter');

    expect(session.getCurrentScene().id).toBe('ending_stranded');
    expect(session.getState().isCompleted).toBe(true);
    expect(session.getAvailableChoices()).toEqual([]);

    // Any attempt to advance throws
    expect(() => session.advance('any_choice_id')).toThrowError(
      /playthrough has already reached an ending/i
    );
  });

  // 11. Finding the smuggler's silver treasure unlocks a distinct restitution ending
  it('allows discovering the stolen silver treasure and confronting the keeper with physical evidence', () => {
    const session = new StorySession(story);

    session.advance('dock_to_beach');
    session.advance('beach_take_lantern');
    session.advance('beach_to_cave');

    // Discover the secret strongbox treasure
    expect(session.getAvailableChoices().map((c) => c.id)).toContain(
      'cave_search_strongbox'
    );
    session.advance('cave_search_strongbox');

    expect(session.getCurrentScene().id).toBe('cave_treasure');
    expect(session.getState().variables.hasTreasure).toBe(true);

    // Head directly to the lighthouse with the recovered silver
    session.advance('treasure_to_lighthouse');
    session.advance('approach_enter');

    expect(session.getCurrentScene().id).toBe('lighthouse_interior');
    // confront_keeper_treasure is available because hasTreasure is true
    expect(session.getAvailableChoices().map((c) => c.id)).toContain(
      'confront_keeper_treasure'
    );

    session.advance('confront_keeper_treasure');

    expect(session.getCurrentScene().id).toBe('ending_treasure_restitution');
    expect(session.getState().isCompleted).toBe(true);
    expect(session.getState().discoveredEndingId).toBe('ending_restitution');
    expect(session.getCurrentScene().ending?.type).toBe('good');
  });

  // 12. A reader who misses optional clues can still reach a satisfying conclusion (Guardian of the Beacon)
  it('enables a reader who skipped optional clues to reach a satisfying heroic conclusion by restoring the beacon', () => {
    const session = new StorySession(story);

    // Direct path without exploring the beach or cave
    session.advance('dock_to_lighthouse');
    expect(session.getState().variables.cluesFound).toBe(0);
    expect(session.getState().variables.hasTreasure).toBe(false);

    // Optional observation of catwalk adds +1 clue
    session.advance('approach_inspect_catwalk');
    expect(session.getCurrentScene().id).toBe('lighthouse_lookout');
    expect(session.getState().variables.cluesFound).toBe(1);

    session.advance('lookout_enter');
    expect(session.getCurrentScene().id).toBe('lighthouse_interior');

    // Rather than an arbitrary failure or dead end, the reader can inspect and restore the beacon
    expect(session.getAvailableChoices().map((c) => c.id)).toContain(
      'inspect_beacon_mechanism'
    );
    session.advance('inspect_beacon_mechanism');

    expect(session.getCurrentScene().id).toBe('ending_beacon_restored');
    expect(session.getState().isCompleted).toBe(true);
    expect(session.getState().discoveredEndingId).toBe('ending_safe_beacon');
    expect(session.getCurrentScene().ending?.type).toBe('good');
  });
});

