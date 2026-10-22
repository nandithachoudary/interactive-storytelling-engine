import { describe, it, expect } from 'vitest';
import { evaluateCondition, isChoiceAvailable } from '../conditions';
import type { Condition, StoryVariables } from '../schema';

describe('Condition Evaluation Engine', () => {
  describe('Unconditional / default cases', () => {
    it('returns true when condition is undefined or null', () => {
      const vars: StoryVariables = { clues: 2 };
      expect(evaluateCondition(undefined, vars)).toBe(true);
      expect(evaluateCondition(null, vars)).toBe(true);
      expect(isChoiceAvailable({ destinationSceneId: 'next' } as any, vars)).toBe(true);
    });
  });

  describe('Boolean conditions', () => {
    it('evaluates matching and non-matching boolean variables', () => {
      const vars: StoryVariables = { hasLantern: true, hasKey: false };

      const requiresLantern: Condition = {
        type: 'boolean',
        variable: 'hasLantern',
        value: true,
      };
      const requiresNoLantern: Condition = {
        type: 'boolean',
        variable: 'hasLantern',
        value: false,
      };
      const requiresKey: Condition = {
        type: 'boolean',
        variable: 'hasKey',
        value: true,
      };

      expect(evaluateCondition(requiresLantern, vars)).toBe(true);
      expect(evaluateCondition(requiresNoLantern, vars)).toBe(false);
      expect(evaluateCondition(requiresKey, vars)).toBe(false);
    });

    it('safely handles missing or non-boolean variables by treating them as false', () => {
      const vars: StoryVariables = { name: 'Detective' };

      const missingTrue: Condition = {
        type: 'boolean',
        variable: 'uninitializedFlag',
        value: true,
      };
      const missingFalse: Condition = {
        type: 'boolean',
        variable: 'uninitializedFlag',
        value: false,
      };
      const nonBooleanVar: Condition = {
        type: 'boolean',
        variable: 'name',
        value: true,
      };

      expect(evaluateCondition(missingTrue, vars)).toBe(false);
      expect(evaluateCondition(missingFalse, vars)).toBe(true);
      expect(evaluateCondition(nonBooleanVar, vars)).toBe(false);
    });
  });

  describe('Numeric & comparison conditions', () => {
    const vars: StoryVariables = {
      gold: 50,
      silver: 20,
      title: 'Captain',
    };

    it('handles equality and inequality', () => {
      const eqCondition: Condition = {
        type: 'compare',
        variable: 'gold',
        operator: '==',
        value: 50,
      };
      const aliasEqCondition: Condition = {
        type: 'compare',
        variable: 'gold',
        operator: '=',
        value: 50,
      };
      const neqCondition: Condition = {
        type: 'compare',
        variable: 'gold',
        operator: '!=',
        value: 10,
      };
      const stringEqCondition: Condition = {
        type: 'compare',
        variable: 'title',
        operator: '==',
        value: 'Captain',
      };

      expect(evaluateCondition(eqCondition, vars)).toBe(true);
      expect(evaluateCondition(aliasEqCondition, vars)).toBe(true);
      expect(evaluateCondition(neqCondition, vars)).toBe(true);
      expect(evaluateCondition(stringEqCondition, vars)).toBe(true);
    });

    it('evaluates relational operators (>, >=, <, <=)', () => {
      expect(
        evaluateCondition(
          { type: 'compare', variable: 'gold', operator: '>', value: 40 },
          vars
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { type: 'compare', variable: 'gold', operator: '>', value: 50 },
          vars
        )
      ).toBe(false);

      expect(
        evaluateCondition(
          { type: 'compare', variable: 'gold', operator: '>=', value: 50 },
          vars
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { type: 'compare', variable: 'silver', operator: '<', value: 30 },
          vars
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { type: 'compare', variable: 'silver', operator: '<=', value: 20 },
          vars
        )
      ).toBe(true);
    });

    it('safely fails relational comparisons on missing variables or incompatible types', () => {
      // Missing variable with relational operator
      const missingRelational: Condition = {
        type: 'compare',
        variable: 'stamina',
        operator: '>=',
        value: 10,
      };
      expect(evaluateCondition(missingRelational, vars)).toBe(false);

      // Comparing a string variable with a numeric relational operator
      const stringComparison: Condition = {
        type: 'compare',
        variable: 'title',
        operator: '>',
        value: 10,
      };
      expect(evaluateCondition(stringComparison, vars)).toBe(false);
    });
  });

  describe('Compound conditions (and, or, not)', () => {
    const vars: StoryVariables = {
      hasLantern: true,
      cluesFound: 3,
      isAfraid: false,
    };

    it('evaluates AND conditions (all must match)', () => {
      const andCondition: Condition = {
        type: 'and',
        conditions: [
          { type: 'boolean', variable: 'hasLantern', value: true },
          { type: 'compare', variable: 'cluesFound', operator: '>=', value: 3 },
        ],
      };
      expect(evaluateCondition(andCondition, vars)).toBe(true);

      const failingAnd: Condition = {
        type: 'and',
        conditions: [
          { type: 'boolean', variable: 'hasLantern', value: true },
          { type: 'compare', variable: 'cluesFound', operator: '>', value: 10 },
        ],
      };
      expect(evaluateCondition(failingAnd, vars)).toBe(false);
    });

    it('evaluates OR conditions (at least one must match)', () => {
      const orCondition: Condition = {
        type: 'or',
        conditions: [
          { type: 'boolean', variable: 'hasLantern', value: false },
          { type: 'compare', variable: 'cluesFound', operator: '>=', value: 3 },
        ],
      };
      expect(evaluateCondition(orCondition, vars)).toBe(true);

      const failingOr: Condition = {
        type: 'or',
        conditions: [
          { type: 'boolean', variable: 'hasLantern', value: false },
          { type: 'compare', variable: 'cluesFound', operator: '<', value: 1 },
        ],
      };
      expect(evaluateCondition(failingOr, vars)).toBe(false);
    });

    it('evaluates NOT conditions (inverts result)', () => {
      const notAfraid: Condition = {
        type: 'not',
        condition: { type: 'boolean', variable: 'isAfraid', value: true },
      };
      expect(evaluateCondition(notAfraid, vars)).toBe(true);

      const notLantern: Condition = {
        type: 'not',
        condition: { type: 'boolean', variable: 'hasLantern', value: true },
      };
      expect(evaluateCondition(notLantern, vars)).toBe(false);
    });

    it('evaluates nested arbitrary combinations', () => {
      // (hasLantern == true AND (cluesFound >= 5 OR NOT isAfraid))
      const nested: Condition = {
        type: 'and',
        conditions: [
          { type: 'boolean', variable: 'hasLantern', value: true },
          {
            type: 'or',
            conditions: [
              { type: 'compare', variable: 'cluesFound', operator: '>=', value: 5 },
              {
                type: 'not',
                condition: { type: 'boolean', variable: 'isAfraid', value: true },
              },
            ],
          },
        ],
      };

      expect(evaluateCondition(nested, vars)).toBe(true);
    });
  });
});

