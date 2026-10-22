import { describe, it, expect } from 'vitest';
import {
  recordChoice,
  replayChoices,
  replayChoicesStrict,
  undoLastChoice,
  restartPlaythrough,
  StorySession,
} from '../history';
import { advancePlaythrough, initPlaythrough } from '../runtime';
import { parseStory } from '../schema';
import demoStoryData from '../../content/demo-story.json';

describe('Story History, Replay & Undo', () => {
  const story = parseStory(demoStoryData);

  describe('Recording and Replaying choices', () => {
    it('records choice IDs sequentially', () => {
      let history: string[] = [];
      history = recordChoice(history, 'dock_to_beach');
      history = recordChoice(history, 'beach_take_lantern');
      expect(history).toEqual(['dock_to_beach', 'beach_take_lantern']);
    });

    it('reconstructs the exact playthrough state and variables by replaying history', () => {
      // Step-by-step live playthrough:
      // dock -> beach -> beach_cleared (lantern taken, clues=1) -> cave (in cave, clues=1) -> cave_studied (clues=3)
      const choices = [
        'dock_to_beach',
        'beach_take_lantern',
        'beach_to_cave',
        'cave_read_log',
      ];

      // Live execution
      const init = initPlaythrough(story);
      const s1 = advancePlaythrough(story, init.state, choices[0]);
      const s2 = advancePlaythrough(story, s1.nextState, choices[1]);
      const s3 = advancePlaythrough(story, s2.nextState, choices[2]);
      const s4 = advancePlaythrough(story, s3.nextState, choices[3]);

      // Replay execution from history array
      const replay = replayChoices(story, choices);

      expect(replay.error).toBeUndefined();
      expect(replay.validHistory).toEqual(choices);
      expect(replay.state.currentSceneId).toBe(s4.nextState.currentSceneId);
      expect(replay.state.variables).toEqual(s4.nextState.variables);
      expect(replay.state.variables.hasLantern).toBe(true);
      expect(replay.state.variables.cluesFound).toBe(3);
    });

    it('strict replay succeeds on valid history and throws on invalid history', () => {
      const valid = ['dock_to_beach', 'beach_take_lantern'];
      const result = replayChoicesStrict(story, valid);
      expect(result.state.currentSceneId).toBe('beach_cleared');

      const invalid = ['dock_to_beach', 'invalid_choice_xyz'];
      expect(() => replayChoicesStrict(story, invalid)).toThrowError();
    });
  });

  describe('Undoing choices', () => {
    it('undoes the most recent choice and accurately restores previous variables and scene', () => {
      const history = [
        'dock_to_beach',
        'beach_take_lantern', // sets hasLantern=true, cluesFound=1
        'beach_to_cave',
        'cave_read_log',      // adds cluesFound +2 -> cluesFound = 3
      ];

      // State before undo: scene is cave_studied, cluesFound is 3
      const stateBeforeUndo = replayChoices(story, history).state;
      expect(stateBeforeUndo.currentSceneId).toBe('cave_studied');
      expect(stateBeforeUndo.variables.cluesFound).toBe(3);

      // Undo one choice ('cave_read_log')
      const undoResult = undoLastChoice(story, history);

      expect(undoResult.history).toEqual([
        'dock_to_beach',
        'beach_take_lantern',
        'beach_to_cave',
      ]);
      expect(undoResult.state.currentSceneId).toBe('cave');
      // Crucial: variables must be reconstructed (cluesFound was 1 before reading log)
      expect(undoResult.state.variables.cluesFound).toBe(1);
      expect(undoResult.state.variables.hasLantern).toBe(true);
    });

    it('handles undo when history is already empty', () => {
      const undoResult = undoLastChoice(story, []);
      expect(undoResult.history).toEqual([]);
      expect(undoResult.state.currentSceneId).toBe('dock');
      expect(undoResult.state.variables.cluesFound).toBe(0);
    });
  });

  describe('Restarting and preserving discovered endings', () => {
    it('restarts the playthrough to initial state while preserving discovered endings', () => {
      // Complete the game by taking the quick path to the stranded ending
      const history = [
        'dock_to_lighthouse',
        'approach_enter',
        'ask_shelter', // leads to ending_stranded (discovered ending: 'ending_escape')
      ];

      const finishReplay = replayChoices(story, history);
      expect(finishReplay.state.isCompleted).toBe(true);
      expect(finishReplay.discoveredEndings).toContain('ending_escape');

      // Restart the story
      const restart = restartPlaythrough(story, finishReplay.discoveredEndings);

      expect(restart.history).toEqual([]);
      expect(restart.state.currentSceneId).toBe('dock');
      expect(restart.state.isCompleted).toBe(false);
      expect(restart.state.variables.cluesFound).toBe(0);

      // Preserves lifetime discovered endings!
      expect(restart.discoveredEndings).toContain('ending_escape');
    });

    it('preserves discovered endings even when undoing an ending choice', () => {
      const history = [
        'dock_to_lighthouse',
        'approach_enter',
        'ask_shelter', // reached ending_stranded
      ];

      const finishReplay = replayChoices(story, history);
      expect(finishReplay.discoveredEndings).toEqual(['ending_escape']);

      // Undo the choice that led to the ending
      const undoResult = undoLastChoice(
        story,
        history,
        finishReplay.discoveredEndings
      );

      // Current playthrough state is restored to active before the ending
      expect(undoResult.state.currentSceneId).toBe('lighthouse_interior');
      expect(undoResult.state.isCompleted).toBe(false);
      expect(undoResult.state.discoveredEndingId).toBeUndefined();

      // Discovered endings collection still preserves the discovered ending!
      expect(undoResult.discoveredEndings).toEqual(['ending_escape']);
    });
  });

  describe('Handling invalid or corrupted history safely', () => {
    it('safely stops replaying at the last valid state when encountering an invalid choice ID', () => {
      const corruptedHistory = [
        'dock_to_beach',
        'CORRUPTED_CHOICE_ID',
        'beach_take_lantern',
      ];

      const replay = replayChoices(story, corruptedHistory);

      // It must not throw or crash
      expect(replay.error).toBeDefined();
      expect(replay.error?.message).toMatch(/does not exist in scene/i);

      // It stopped after dock_to_beach
      expect(replay.validHistory).toEqual(['dock_to_beach']);
      expect(replay.state.currentSceneId).toBe('beach');
      expect(replay.state.variables.hasLantern).toBe(false);
    });

    it('safely stops replaying when encountering a choice whose condition is not met', () => {
      // At lighthouse_interior, 'confront_keeper_evidence' exists but requires cluesFound >= 3.
      // Since we go straight to the lighthouse with 0 clues, the condition is not met.
      const invalidConditionHistory = [
        'dock_to_lighthouse',
        'approach_enter',
        'confront_keeper_evidence',
      ];

      const replay = replayChoices(story, invalidConditionHistory);

      expect(replay.error).toBeDefined();
      expect(replay.error?.message).toMatch(/condition was not met/i);
      // Valid history should contain only the steps up to lighthouse_interior
      expect(replay.validHistory).toEqual(['dock_to_lighthouse', 'approach_enter']);
      expect(replay.state.currentSceneId).toBe('lighthouse_interior');
      expect(replay.state.variables.cluesFound).toBe(0);
    });
  });

  describe('StorySession class', () => {
    it('coordinates advance, undo, and restart with history tracking', () => {
      const session = new StorySession(story);

      expect(session.getCurrentScene().id).toBe('dock');
      expect(session.getHistory()).toEqual([]);

      session.advance('dock_to_beach');
      session.advance('beach_take_lantern');

      expect(session.getHistory()).toEqual([
        'dock_to_beach',
        'beach_take_lantern',
      ]);
      expect(session.getState().variables.hasLantern).toBe(true);

      // Undo
      session.undo();
      expect(session.getHistory()).toEqual(['dock_to_beach']);
      expect(session.getState().variables.hasLantern).toBe(false);
      expect(session.getCurrentScene().id).toBe('beach');

      // Restart
      session.restart();
      expect(session.getHistory()).toEqual([]);
      expect(session.getCurrentScene().id).toBe('dock');
    });
  });
});
