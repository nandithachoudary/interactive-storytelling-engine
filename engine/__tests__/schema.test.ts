import { describe, it, expect } from 'vitest';
import {
  StorySchema,
  ChoiceSchema,
  ConditionSchema,
  parseStory,
  safeParseStory,
} from '../schema';
import demoStory from '../../content/demo-story.json';

describe('Story Schema & Types', () => {
  describe('Valid stories', () => {
    it('parses a minimal valid story successfully', () => {
      const minimalStory = {
        schemaVersion: 1,
        storyVersion: '1.0.0',
        title: 'Minimal Journey',
        author: 'Tester',
        startSceneId: 'start',
        scenes: [
          {
            id: 'start',
            title: 'Starting Point',
            content: 'You stand at the beginning.',
            choices: [],
          },
        ],
      };

      const parsed = StorySchema.parse(minimalStory);
      expect(parsed.title).toBe('Minimal Journey');
      expect(parsed.scenes).toHaveLength(1);
      expect(parsed.variables).toEqual({});
    });

    it('parses the complete demo island mystery story successfully', () => {
      const parsed = parseStory(demoStory);
      expect(parsed.id).toBe('fog-island-mystery');
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.storyVersion).toBe('1.0.0');
      expect(parsed.startSceneId).toBe('dock');
      expect(parsed.scenes.length).toBeGreaterThan(0);

      // Verify start scene exists
      const startScene = parsed.scenes.find((s) => s.id === parsed.startSceneId);
      expect(startScene).toBeDefined();
      expect(startScene?.choices.length).toBeGreaterThan(0);
    });
  });

  describe('Story metadata validation', () => {
    it('rejects a story missing required metadata (title, author, startSceneId, versions)', () => {
      const invalidStories = [
        // Missing title
        {
          schemaVersion: 1,
          storyVersion: '1.0.0',
          author: 'Tester',
          startSceneId: 'start',
          scenes: [{ id: 'start', title: 'T', content: 'C', choices: [] }],
        },
        // Missing author
        {
          schemaVersion: 1,
          storyVersion: '1.0.0',
          title: 'Title',
          startSceneId: 'start',
          scenes: [{ id: 'start', title: 'T', content: 'C', choices: [] }],
        },
        // Missing startSceneId
        {
          schemaVersion: 1,
          storyVersion: '1.0.0',
          title: 'Title',
          author: 'Tester',
          scenes: [{ id: 'start', title: 'T', content: 'C', choices: [] }],
        },
        // Missing schemaVersion
        {
          storyVersion: '1.0.0',
          title: 'Title',
          author: 'Tester',
          startSceneId: 'start',
          scenes: [{ id: 'start', title: 'T', content: 'C', choices: [] }],
        },
        // Missing storyVersion
        {
          schemaVersion: 1,
          title: 'Title',
          author: 'Tester',
          startSceneId: 'start',
          scenes: [{ id: 'start', title: 'T', content: 'C', choices: [] }],
        },
      ];

      for (const invalid of invalidStories) {
        const result = safeParseStory(invalid);
        expect(result.success).toBe(false);
      }
    });

    it('rejects a story with an empty scenes array', () => {
      const emptyStory = {
        schemaVersion: 1,
        storyVersion: '1.0.0',
        title: 'Empty Journey',
        author: 'Tester',
        startSceneId: 'start',
        scenes: [],
      };

      const result = safeParseStory(emptyStory);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least one scene');
      }
    });
  });

  describe('Choice schema validation', () => {
    it('parses a valid choice with condition and effects', () => {
      const validChoice = {
        id: 'take_torch',
        text: 'Take the lit torch from the wall',
        destinationSceneId: 'dark_hallway',
        condition: {
          type: 'boolean',
          variable: 'hasTorch',
          value: false,
        },
        effects: [
          { type: 'set', variable: 'hasTorch', value: true },
          { type: 'add', variable: 'courage', value: 5 },
        ],
      };

      const parsed = ChoiceSchema.parse(validChoice);
      expect(parsed.id).toBe('take_torch');
      expect(parsed.destinationSceneId).toBe('dark_hallway');
      expect(parsed.effects).toHaveLength(2);
      expect(parsed.condition?.type).toBe('boolean');
    });

    it('rejects a choice missing required fields', () => {
      // Missing destinationSceneId
      const missingDest = {
        id: 'c1',
        text: 'Walk left',
      };
      expect(() => ChoiceSchema.parse(missingDest)).toThrow();

      // Missing text
      const missingText = {
        id: 'c1',
        destinationSceneId: 'scene2',
      };
      expect(() => ChoiceSchema.parse(missingText)).toThrow();

      // Missing id
      const missingId = {
        text: 'Walk left',
        destinationSceneId: 'scene2',
      };
      expect(() => ChoiceSchema.parse(missingId)).toThrow();
    });
  });

  describe('Structured conditions validation', () => {
    it('validates boolean and comparison conditions correctly', () => {
      const boolCondition = {
        type: 'boolean',
        variable: 'hasKey',
        value: true,
      };
      expect(ConditionSchema.parse(boolCondition)).toEqual(boolCondition);

      const compareCondition = {
        type: 'compare',
        variable: 'gold',
        operator: '>=',
        value: 10,
      };
      expect(ConditionSchema.parse(compareCondition)).toEqual(compareCondition);
    });

    it('validates compound conditions (and, or, not)', () => {
      const compoundCondition = {
        type: 'and',
        conditions: [
          { type: 'boolean', variable: 'hasKey', value: true },
          {
            type: 'or',
            conditions: [
              { type: 'compare', variable: 'courage', operator: '>=', value: 10 },
              {
                type: 'not',
                condition: { type: 'boolean', variable: 'isAfraid', value: true },
              },
            ],
          },
        ],
      };

      const parsed = ConditionSchema.parse(compoundCondition);
      expect(parsed.type).toBe('and');
    });

    it('rejects invalid condition structures', () => {
      // Invalid condition type
      expect(() =>
        ConditionSchema.parse({
          type: 'magic_eval',
          code: 'player.gold > 10',
        })
      ).toThrow();

      // Missing variable in boolean condition
      expect(() =>
        ConditionSchema.parse({
          type: 'boolean',
          value: true,
        })
      ).toThrow();

      // Invalid operator in compare condition
      expect(() =>
        ConditionSchema.parse({
          type: 'compare',
          variable: 'gold',
          operator: '~=',
          value: 10,
        })
      ).toThrow();

      // Empty AND condition array
      expect(() =>
        ConditionSchema.parse({
          type: 'and',
          conditions: [],
        })
      ).toThrow();
    });
  });
});

