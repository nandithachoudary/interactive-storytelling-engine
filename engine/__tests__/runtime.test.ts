import { describe, it, expect } from 'vitest';
import {
  initPlaythrough,
  getCurrentScene,
  getAvailableChoices,
  advancePlaythrough,
  StoryRuntime,
} from '../runtime';
import { parseStory } from '../schema';
import demoStoryData from '../../content/demo-story.json';

describe('Story Runtime', () => {
  const story = parseStory(demoStoryData);

  describe('Initialization and scene lookup', () => {
    it('initializes a playthrough at the start scene with initial variables', () => {
      const init = initPlaythrough(story);
      expect(init.state.currentSceneId).toBe('dock');
      expect(init.currentScene.id).toBe('dock');
      expect(init.state.variables.hasLantern).toBe(false);
      expect(init.state.variables.cluesFound).toBe(0);
      expect(init.state.isCompleted).toBe(false);
      expect(init.discoveredEndings).toEqual([]);
    });

    it('returns the current scene correctly', () => {
      const init = initPlaythrough(story);
      const scene = getCurrentScene(story, init.state);
      expect(scene.id).toBe('dock');
      expect(scene.title).toBe('The Foggy Pier');
    });
  });

  describe('Choices and conditions', () => {
    it('returns available choices at the start scene', () => {
      const init = initPlaythrough(story);
      const available = getAvailableChoices(story, init.state);
      expect(available.map((c) => c.id)).toEqual([
        'dock_to_beach',
        'dock_to_lighthouse',
      ]);
    });

    it('hides a choice when its condition is not satisfied', () => {
      // Create a state at beach_cleared without the lantern
      const init = initPlaythrough(story);
      const atBeachClearedWithoutLantern = {
        ...init.state,
        currentSceneId: 'beach_cleared',
        variables: { hasLantern: false, cluesFound: 0 },
      };

      const choices = getAvailableChoices(story, atBeachClearedWithoutLantern);
      // 'beach_to_cave' requires hasLantern == true, so it must not be available
      const choiceIds = choices.map((c) => c.id);
      expect(choiceIds).not.toContain('beach_to_cave');
      expect(choiceIds).toContain('beach_to_lighthouse');
    });

    it('shows a choice when its condition is satisfied', () => {
      const init = initPlaythrough(story);
      const atBeachClearedWithLantern = {
        ...init.state,
        currentSceneId: 'beach_cleared',
        variables: { hasLantern: true, cluesFound: 1 },
      };

      const choices = getAvailableChoices(story, atBeachClearedWithLantern);
      const choiceIds = choices.map((c) => c.id);
      expect(choiceIds).toContain('beach_to_cave');
    });

    it('rejects an unavailable choice if caller attempts to advance with it', () => {
      const init = initPlaythrough(story);
      const stateWithoutLantern = {
        ...init.state,
        currentSceneId: 'beach_cleared',
        variables: { hasLantern: false },
      };

      expect(() =>
        advancePlaythrough(story, stateWithoutLantern, 'beach_to_cave')
      ).toThrowError(/condition was not met/i);
    });
  });

  describe('Advancing and applying effects', () => {
    it('advances to destination scene and applies choice effects', () => {
      const init = initPlaythrough(story);

      // 1. Advance from dock to beach
      const step1 = advancePlaythrough(story, init.state, 'dock_to_beach');
      expect(step1.nextState.currentSceneId).toBe('beach');
      expect(step1.nextScene.id).toBe('beach');
      expect(step1.nextState.variables.hasLantern).toBe(false);

      // 2. Pick up lantern at beach (sets hasLantern=true, adds cluesFound+1)
      const step2 = advancePlaythrough(
        story,
        step1.nextState,
        'beach_take_lantern'
      );
      expect(step2.nextState.currentSceneId).toBe('beach_cleared');
      expect(step2.nextState.variables.hasLantern).toBe(true);
      expect(step2.nextState.variables.cluesFound).toBe(1);
    });

    it('rejects an invalid or nonexistent choice ID without changing state', () => {
      const init = initPlaythrough(story);
      const originalState = { ...init.state, variables: { ...init.state.variables } };

      expect(() =>
        advancePlaythrough(story, init.state, 'non_existent_choice_id')
      ).toThrowError(/does not exist in scene/i);

      // Original state must be completely untouched
      expect(init.state).toEqual(originalState);
    });
  });

  describe('Endings', () => {
    it('reaches and records an ending, marking playthrough complete', () => {
      const init = initPlaythrough(story);

      // Navigate to lighthouse interior: dock -> lighthouse_approach -> lighthouse_interior
      const s1 = advancePlaythrough(story, init.state, 'dock_to_lighthouse');
      const s2 = advancePlaythrough(story, s1.nextState, 'approach_enter');

      // Select 'ask_shelter' which leads directly to ending_stranded
      const s3 = advancePlaythrough(story, s2.nextState, 'ask_shelter');

      expect(s3.nextState.currentSceneId).toBe('ending_stranded');
      expect(s3.nextState.isCompleted).toBe(true);
      expect(s3.nextState.discoveredEndingId).toBe('ending_escape');
      expect(s3.discoveredEndings).toContain('ending_escape');

      // Choices at an ending scene must be empty
      expect(getAvailableChoices(story, s3.nextState)).toEqual([]);

      // Attempting to advance after reaching an ending throws an error
      expect(() =>
        advancePlaythrough(story, s3.nextState, 'any_choice')
      ).toThrowError(/already reached an ending/i);
    });
  });

  describe('StoryRuntime session class', () => {
    it('orchestrates playthrough transitions smoothly', () => {
      const runtime = new StoryRuntime(story);
      expect(runtime.getCurrentScene().id).toBe('dock');
      expect(runtime.getAvailableChoices()).toHaveLength(2);

      const nextScene = runtime.choose('dock_to_beach');
      expect(nextScene.id).toBe('beach');
      expect(runtime.getState().currentSceneId).toBe('beach');
    });
  });
});

