import type { Condition, ComparisonOperator, StoryVariables, VariableValue } from './schema';

/**
 * Safely compares two values using a structured comparison operator.
 * Returns false if numeric operators (<, <=, >, >=) are applied to non-numeric values.
 */
function compareValues(
  current: VariableValue | undefined,
  operator: ComparisonOperator,
  target: VariableValue
): boolean {
  switch (operator) {
    case '==':
    case '=':
      return current === target;

    case '!=':
      return current !== target;

    case '>':
      if (typeof current !== 'number' || typeof target !== 'number') return false;
      return current > target;

    case '>=':
      if (typeof current !== 'number' || typeof target !== 'number') return false;
      return current >= target;

    case '<':
      if (typeof current !== 'number' || typeof target !== 'number') return false;
      return current < target;

    case '<=':
      if (typeof current !== 'number' || typeof target !== 'number') return false;
      return current <= target;

    default:
      return false;
  }
}

/**
 * Pure function to evaluate a structured condition against current story variables.
 *
 * Rules:
 * - If condition is undefined or null, it evaluates to true (unconditional).
 * - Boolean conditions treat missing variables as false.
 * - Comparison conditions safely return false when encountering incompatible or missing types.
 * - Compound conditions (and, or, not) evaluate recursively without ever using eval().
 */
export function evaluateCondition(
  condition: Condition | undefined | null,
  variables: StoryVariables
): boolean {
  // Unconditional choices are always valid
  if (!condition) {
    return true;
  }

  switch (condition.type) {
    case 'boolean': {
      const currentVal = variables[condition.variable];
      // If variable is missing or not a boolean, treat it as false
      const boolVal = typeof currentVal === 'boolean' ? currentVal : false;
      return boolVal === condition.value;
    }

    case 'compare': {
      const currentVal = variables[condition.variable];
      return compareValues(currentVal, condition.operator, condition.value);
    }

    case 'and': {
      if (!condition.conditions || condition.conditions.length === 0) return true;
      return condition.conditions.every((sub) => evaluateCondition(sub, variables));
    }

    case 'or': {
      if (!condition.conditions || condition.conditions.length === 0) return false;
      return condition.conditions.some((sub) => evaluateCondition(sub, variables));
    }

    case 'not': {
      return !evaluateCondition(condition.condition, variables);
    }

    default:
      return false;
  }
}

/**
 * Helper to check whether a choice is available given current variables.
 */
export function isChoiceAvailable(
  choice: { condition?: Condition },
  variables: StoryVariables
): boolean {
  return evaluateCondition(choice.condition, variables);
}

