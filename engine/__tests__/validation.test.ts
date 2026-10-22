import { describe, it, expect } from 'vitest';
import { validateStoryGraph, validateStory } from '../validation';
import { parseStory } from '../schema';
import * as EnginePublicAPI from '../index';
import demoStoryData from '../../content/demo-story.json';

describe('Story Graph Validation', () => {
  const validStory = parseStory(demoStoryData);

  describe('Valid stories', () => {
    it('produces no errors or warnings for the demo story', () => {
      const result = validateStoryGraph(validStory);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('validates raw demo story data directly via validateStory', () => {
      const result = validateStory(demoStoryData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Scene structure & references', () => {
    it('detects a nonexistent start scene', () => {
      const story = {
        ...validStory,
        startSceneId: 'nonexistent_start_scene',
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'missing_start_scene');
      expect(error).toBeDefined();
      expect(error?.sceneId).toBe('nonexistent_start_scene');
    });

    it('detects missing destination scenes in choices', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  ...s.choices,
                  {
                    id: 'bad_choice',
                    text: 'Go into the void',
                    destinationSceneId: 'phantom_island',
                    effects: [],
                  },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'missing_destination_scene');
      expect(error).toBeDefined();
      expect(error?.choiceId).toBe('bad_choice');
      expect(error?.message).toContain('phantom_island');
    });

    it('detects duplicate scene IDs', () => {
      const story = {
        ...validStory,
        scenes: [
          ...validStory.scenes,
          {
            id: 'dock', // Duplicate of existing dock
            title: 'Another Dock',
            content: 'Wait, another dock?',
            choices: [],
          },
        ],
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'duplicate_scene_id');
      expect(error).toBeDefined();
      expect(error?.sceneId).toBe('dock');
    });

    it('detects duplicate choice IDs within the same scene', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  { id: 'dup_choice', text: 'Left', destinationSceneId: 'beach', effects: [] },
                  { id: 'dup_choice', text: 'Right', destinationSceneId: 'lighthouse_approach', effects: [] },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'duplicate_choice_id');
      expect(error).toBeDefined();
      expect(error?.choiceId).toBe('dup_choice');
    });
  });

  describe('Reachability and dead ends', () => {
    it('reports unreachable scenes as non-fatal warnings', () => {
      const story = {
        ...validStory,
        scenes: [
          ...validStory.scenes,
          {
            id: 'secret_abandoned_hut',
            title: 'Forgotten Hut',
            content: 'Nobody knows this exists and no choice leads here.',
            choices: [],
            ending: {
              id: 'ending_secret',
              title: 'Secret Ending',
            },
          },
        ],
      };

      const result = validateStoryGraph(story);
      // Still valid because unreachable scenes are warnings, not fatal errors
      expect(result.isValid).toBe(true);
      const warning = result.warnings.find((w) => w.type === 'unreachable_scene');
      expect(warning).toBeDefined();
      expect(warning?.sceneId).toBe('secret_abandoned_hut');
    });

    it('reports unintended dead ends (scenes with no choices and no ending marker)', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'beach'
            ? {
                ...s,
                choices: [], // Removed choices and has no ending marker
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'unintended_dead_end');
      expect(error).toBeDefined();
      expect(error?.sceneId).toBe('beach');
    });

    it('handles ending scenes correctly without flagging them as dead ends', () => {
      // ending_solved, ending_captured, ending_stranded have 0 choices and are marked as endings
      const result = validateStoryGraph(validStory);
      const deadEndInEndings = result.errors.find(
        (e) =>
          e.type === 'unintended_dead_end' &&
          ['ending_solved', 'ending_captured', 'ending_stranded'].includes(
            e.sceneId ?? ''
          )
      );
      expect(deadEndInEndings).toBeUndefined();
    });
  });

  describe('Variables and type compatibility', () => {
    it('detects undefined variables referenced in conditions', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  {
                    id: 'dock_secret',
                    text: 'Use unknown key',
                    destinationSceneId: 'beach',
                    effects: [],
                    condition: {
                      type: 'boolean' as const,
                      variable: 'undeclaredSecretKey',
                      value: true,
                    },
                  },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'undefined_variable');
      expect(error).toBeDefined();
      expect(error?.variable).toBe('undeclaredSecretKey');
    });

    it('detects undefined variables modified in effects', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  {
                    id: 'dock_secret',
                    text: 'Explore',
                    destinationSceneId: 'beach',
                    effects: [
                      {
                        type: 'set' as const,
                        variable: 'missingCounter',
                        value: 10,
                      },
                    ],
                  },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find((e) => e.type === 'undefined_variable');
      expect(error).toBeDefined();
      expect(error?.variable).toBe('missingCounter');
    });

    it('detects incompatible effect operations', () => {
      // Attempting an 'add' (numeric) effect on 'hasLantern' (boolean)
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  {
                    id: 'dock_bad_effect',
                    text: 'Add to boolean',
                    destinationSceneId: 'beach',
                    effects: [
                      {
                        type: 'add' as const,
                        variable: 'hasLantern', // Boolean variable!
                        value: 5,
                      },
                    ],
                  },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find(
        (e) => e.type === 'incompatible_variable_type'
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('cannot add to "hasLantern"');
    });

    it('detects incompatible condition types (e.g. relational operator on boolean)', () => {
      const story = {
        ...validStory,
        scenes: validStory.scenes.map((s) =>
          s.id === 'dock'
            ? {
                ...s,
                choices: [
                  {
                    id: 'dock_bad_compare',
                    text: 'Check lantern with greater-than',
                    destinationSceneId: 'beach',
                    effects: [],
                    condition: {
                      type: 'compare' as const,
                      variable: 'hasLantern', // boolean!
                      operator: '>=' as const,
                      value: 1,
                    },
                  },
                ],
              }
            : s
        ),
      };

      const result = validateStoryGraph(story);
      expect(result.isValid).toBe(false);
      const error = result.errors.find(
        (e) => e.type === 'incompatible_variable_type'
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('requires numeric values');
    });
  });

  describe('Untrusted data validation & Public API', () => {
    it('rejects schema-invalid data gracefully in validateStory', () => {
      const result = validateStory({ invalid: true });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('schema_error');
    });

    it('exports all expected public engine constructs from engine/index.ts', () => {
      // Schemas & parsing
      expect(EnginePublicAPI.StorySchema).toBeDefined();
      expect(EnginePublicAPI.parseStory).toBeDefined();

      // Condition helpers
      expect(EnginePublicAPI.evaluateCondition).toBeDefined();
      expect(EnginePublicAPI.isChoiceAvailable).toBeDefined();

      // State helpers
      expect(EnginePublicAPI.createInitialState).toBeDefined();
      expect(EnginePublicAPI.setVariable).toBeDefined();

      // Runtime
      expect(EnginePublicAPI.initPlaythrough).toBeDefined();
      expect(EnginePublicAPI.advancePlaythrough).toBeDefined();
      expect(EnginePublicAPI.StoryRuntime).toBeDefined();

      // History
      expect(EnginePublicAPI.recordChoice).toBeDefined();
      expect(EnginePublicAPI.replayChoices).toBeDefined();
      expect(EnginePublicAPI.undoLastChoice).toBeDefined();
      expect(EnginePublicAPI.restartPlaythrough).toBeDefined();
      expect(EnginePublicAPI.StorySession).toBeDefined();

      // Validation
      expect(EnginePublicAPI.validateStoryGraph).toBeDefined();
      expect(EnginePublicAPI.validateStory).toBeDefined();
    });
  });
});

