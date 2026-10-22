import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  setVariable,
  applyEffects,
  setCurrentScene,
  recordEnding,
  recordDiscoveredEnding,
} from '../state';
import type { Story, ChoiceEffect } from '../schema';
import demoStoryData from '../../content/demo-story.json';
import { parseStory } from '../schema';

describe('Story State Management', () => {
  const story: Story = parseStory(demoStoryData);

  describe('Initial state creation', () => {
    it('initializes playthrough state with story defaults', () => {
      const state = createInitialState(story);

      expect(state.schemaVersion).toBe(story.schemaVersion);
      expect(state.storyVersion).toBe(story.storyVersion);
      expect(state.storyId).toBe(story.id);
      expect(state.currentSceneId).toBe('dock');
      expect(state.variables).toEqual({
        hasLantern: false,
        cluesFound: 0,
        hasTreasure: false,
      });
      expect(state.isCompleted).toBe(false);
      expect(state.discoveredEndingId).toBeUndefined();
    });

    it('ensures separate playthrough states are completely independent', () => {
      const playthrough1 = createInitialState(story);
      const playthrough2 = createInitialState(story);

      // Mutate playthrough 1
      const updatedPlaythrough1 = setVariable(playthrough1, 'hasLantern', true);

      // Playthrough 2 must remain unchanged
      expect(updatedPlaythrough1.variables.hasLantern).toBe(true);
      expect(playthrough2.variables.hasLantern).toBe(false);

      // Original story template variables must remain unchanged
      expect(story.variables?.hasLantern).toBe(false);
    });
  });

  describe('Immutable state updates', () => {
    it('sets variables immutably without altering previous state', () => {
      const initial = createInitialState(story);
      const next = setVariable(initial, 'cluesFound', 5);

      expect(initial.variables.cluesFound).toBe(0);
      expect(next.variables.cluesFound).toBe(5);
      expect(initial).not.toBe(next);
      expect(initial.variables).not.toBe(next.variables);
    });

    it('updates current scene immutably', () => {
      const initial = createInitialState(story);
      const next = setCurrentScene(initial, 'beach');

      expect(initial.currentSceneId).toBe('dock');
      expect(next.currentSceneId).toBe('beach');
    });

    it('records ending completion immutably', () => {
      const initial = createInitialState(story);
      const finished = recordEnding(initial, 'ending_truth');

      expect(initial.isCompleted).toBe(false);
      expect(initial.discoveredEndingId).toBeUndefined();

      expect(finished.isCompleted).toBe(true);
      expect(finished.discoveredEndingId).toBe('ending_truth');
    });
  });

  describe('Applying Choice Effects', () => {
    it('applies set, add, and toggle effects predictably', () => {
      const initial = createInitialState(story);

      const effects: ChoiceEffect[] = [
        { type: 'set', variable: 'hasLantern', value: true },
        { type: 'add', variable: 'cluesFound', value: 2 },
        { type: 'toggle', variable: 'isSuspicious' }, // missing boolean -> toggles to true
      ];

      const afterEffects = applyEffects(initial, effects);

      expect(afterEffects.variables.hasLantern).toBe(true);
      expect(afterEffects.variables.cluesFound).toBe(2);
      expect(afterEffects.variables.isSuspicious).toBe(true);

      // Apply another add and toggle
      const subsequentEffects: ChoiceEffect[] = [
        { type: 'add', variable: 'cluesFound', value: 3 },
        { type: 'toggle', variable: 'isSuspicious' }, // now true -> toggles to false
      ];

      const finalState = applyEffects(afterEffects, subsequentEffects);
      expect(finalState.variables.cluesFound).toBe(5);
      expect(finalState.variables.isSuspicious).toBe(false);
    });

    it('returns unmodified state if effects array is empty', () => {
      const initial = createInitialState(story);
      const result = applyEffects(initial, []);
      expect(result).toBe(initial);
    });
  });

  describe('Discovered Endings Tracker', () => {
    it('records unique discovered endings without duplicates', () => {
      let discovered: string[] = [];

      discovered = recordDiscoveredEnding(discovered, 'ending_truth');
      expect(discovered).toEqual(['ending_truth']);

      // Adding duplicate should not duplicate
      discovered = recordDiscoveredEnding(discovered, 'ending_truth');
      expect(discovered).toEqual(['ending_truth']);

      // Adding second ending
      discovered = recordDiscoveredEnding(discovered, 'ending_locked');
      expect(discovered).toEqual(['ending_truth', 'ending_locked']);
    });
  });
});

