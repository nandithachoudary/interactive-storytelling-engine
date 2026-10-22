import {
  type Story,
  type Scene,
  type Choice,
  type Condition,
  type ChoiceEffect,
  type StoryVariables,
  StorySchema,
} from './schema';

export type ValidationIssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationIssueSeverity;
  type:
    | 'missing_start_scene'
    | 'missing_destination_scene'
    | 'duplicate_scene_id'
    | 'duplicate_choice_id'
    | 'unreachable_scene'
    | 'unintended_dead_end'
    | 'undefined_variable'
    | 'incompatible_variable_type'
    | 'schema_error';
  message: string;
  sceneId?: string;
  choiceId?: string;
  variable?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

/**
 * Traverses structured conditions and verifies that any referenced variables
 * are declared in story.variables with compatible types.
 */
function checkConditionVariables(
  condition: Condition,
  declaredVariables: StoryVariables,
  sceneId: string,
  choiceId: string,
  addIssue: (issue: ValidationIssue) => void
): void {
  switch (condition.type) {
    case 'boolean': {
      if (!(condition.variable in declaredVariables)) {
        addIssue({
          severity: 'error',
          type: 'undefined_variable',
          message: `Condition on choice "${choiceId}" in scene "${sceneId}" references undeclared variable "${condition.variable}".`,
          sceneId,
          choiceId,
          variable: condition.variable,
        });
      } else {
        const declaredType = typeof declaredVariables[condition.variable];
        if (declaredType !== 'boolean') {
          addIssue({
            severity: 'error',
            type: 'incompatible_variable_type',
            message: `Boolean condition on choice "${choiceId}" checks variable "${condition.variable}", but it was declared as a ${declaredType}.`,
            sceneId,
            choiceId,
            variable: condition.variable,
          });
        }
      }
      break;
    }

    case 'compare': {
      if (!(condition.variable in declaredVariables)) {
        addIssue({
          severity: 'error',
          type: 'undefined_variable',
          message: `Condition on choice "${choiceId}" in scene "${sceneId}" references undeclared variable "${condition.variable}".`,
          sceneId,
          choiceId,
          variable: condition.variable,
        });
      } else {
        const declaredVal = declaredVariables[condition.variable];
        const declaredType = typeof declaredVal;
        const targetType = typeof condition.value;

        // Relational operators (<, <=, >, >=) require numbers
        if (['<', '<=', '>', '>='].includes(condition.operator)) {
          if (declaredType !== 'number' || targetType !== 'number') {
            addIssue({
              severity: 'error',
              type: 'incompatible_variable_type',
              message: `Relational comparison "${condition.operator}" on choice "${choiceId}" requires numeric values, but variable "${condition.variable}" is a ${declaredType} and target value is a ${targetType}.`,
              sceneId,
              choiceId,
              variable: condition.variable,
            });
          }
        } else if (declaredType !== targetType) {
          addIssue({
            severity: 'warning',
            type: 'incompatible_variable_type',
            message: `Comparison on choice "${choiceId}" compares variable "${condition.variable}" (${declaredType}) to a value of type ${targetType}.`,
            sceneId,
            choiceId,
            variable: condition.variable,
          });
        }
      }
      break;
    }

    case 'and':
    case 'or': {
      for (const child of condition.conditions) {
        checkConditionVariables(child, declaredVariables, sceneId, choiceId, addIssue);
      }
      break;
    }

    case 'not': {
      checkConditionVariables(condition.condition, declaredVariables, sceneId, choiceId, addIssue);
      break;
    }
  }
}

/**
 * Verifies that variable effects (set, add, toggle) reference declared variables
 * and do not perform invalid type operations.
 */
function checkEffectVariables(
  effect: ChoiceEffect,
  declaredVariables: StoryVariables,
  sceneId: string,
  choiceId: string,
  addIssue: (issue: ValidationIssue) => void
): void {
  if (!(effect.variable in declaredVariables)) {
    addIssue({
      severity: 'error',
      type: 'undefined_variable',
      message: `Effect on choice "${choiceId}" in scene "${sceneId}" modifies undeclared variable "${effect.variable}".`,
      sceneId,
      choiceId,
      variable: effect.variable,
    });
    return;
  }

  const declaredType = typeof declaredVariables[effect.variable];

  switch (effect.type) {
    case 'add': {
      if (declaredType !== 'number') {
        addIssue({
          severity: 'error',
          type: 'incompatible_variable_type',
          message: `Add effect on choice "${choiceId}" in scene "${sceneId}" cannot add to "${effect.variable}", which was declared as a ${declaredType}.`,
          sceneId,
          choiceId,
          variable: effect.variable,
        });
      }
      break;
    }

    case 'toggle': {
      if (declaredType !== 'boolean') {
        addIssue({
          severity: 'error',
          type: 'incompatible_variable_type',
          message: `Toggle effect on choice "${choiceId}" in scene "${sceneId}" cannot toggle "${effect.variable}", which was declared as a ${declaredType}.`,
          sceneId,
          choiceId,
          variable: effect.variable,
        });
      }
      break;
    }

    case 'set': {
      const targetType = typeof effect.value;
      if (declaredType !== targetType) {
        addIssue({
          severity: 'warning',
          type: 'incompatible_variable_type',
          message: `Set effect on choice "${choiceId}" in scene "${sceneId}" assigns a ${targetType} to "${effect.variable}", which was declared as a ${declaredType}.`,
          sceneId,
          choiceId,
          variable: effect.variable,
        });
      }
      break;
    }
  }
}

/**
 * Validates the graph structure and variable consistency of a validated Story object.
 *
 * Checks:
 * 1. Start scene exists.
 * 2. Scene IDs are unique.
 * 3. Choice IDs are unique within each scene.
 * 4. Every choice destination exists in the story.
 * 5. Every scene is reachable from startSceneId (reported as warning so optional scenes are tolerated).
 * 6. Non-ending scenes with 0 choices are reported as unintended dead ends.
 * 7. Ending scenes (with an ending marker) are recognized and not flagged as dead ends.
 * 8. Variables referenced in conditions and effects exist in initial variables.
 * 9. Types used in conditions and effects are compatible with declared variables.
 */
export function validateStoryGraph(story: Story): ValidationResult {
  const issues: ValidationIssue[] = [];
  const addIssue = (issue: ValidationIssue) => issues.push(issue);

  const declaredVariables = story.variables ?? {};

  // 1. Verify scene ID uniqueness
  const sceneIdCounts = new Map<string, number>();
  for (const scene of story.scenes) {
    sceneIdCounts.set(scene.id, (sceneIdCounts.get(scene.id) ?? 0) + 1);
  }
  for (const [sceneId, count] of sceneIdCounts.entries()) {
    if (count > 1) {
      addIssue({
        severity: 'error',
        type: 'duplicate_scene_id',
        message: `Scene ID "${sceneId}" is defined ${count} times. Scene IDs must be unique.`,
        sceneId,
      });
    }
  }

  const sceneMap = new Map<string, Scene>();
  for (const scene of story.scenes) {
    if (!sceneMap.has(scene.id)) {
      sceneMap.set(scene.id, scene);
    }
  }

  // 2. Verify start scene exists
  if (!sceneMap.has(story.startSceneId)) {
    addIssue({
      severity: 'error',
      type: 'missing_start_scene',
      message: `startSceneId "${story.startSceneId}" does not exist among the story's scenes.`,
      sceneId: story.startSceneId,
    });
  }

  // 3. Choice uniqueness, destination existence, dead ends, variable consistency
  for (const scene of story.scenes) {
    // Check choice ID uniqueness within this scene
    const choiceIds = new Set<string>();
    for (const choice of scene.choices) {
      if (choiceIds.has(choice.id)) {
        addIssue({
          severity: 'error',
          type: 'duplicate_choice_id',
          message: `Choice ID "${choice.id}" is duplicated in scene "${scene.id}". Choice IDs must be unique within a scene.`,
          sceneId: scene.id,
          choiceId: choice.id,
        });
      }
      choiceIds.add(choice.id);

      // Verify destination scene exists
      if (!sceneMap.has(choice.destinationSceneId)) {
        addIssue({
          severity: 'error',
          type: 'missing_destination_scene',
          message: `Choice "${choice.id}" in scene "${scene.id}" leads to nonexistent destination scene "${choice.destinationSceneId}".`,
          sceneId: scene.id,
          choiceId: choice.id,
        });
      }

      // Check condition variables
      if (choice.condition) {
        checkConditionVariables(
          choice.condition,
          declaredVariables,
          scene.id,
          choice.id,
          addIssue
        );
      }

      // Check effect variables
      if (choice.effects && choice.effects.length > 0) {
        for (const effect of choice.effects) {
          checkEffectVariables(
            effect,
            declaredVariables,
            scene.id,
            choice.id,
            addIssue
          );
        }
      }
    }

    // Unintended dead end: scene has no choices AND no ending marker
    if (scene.choices.length === 0 && !scene.ending) {
      addIssue({
        severity: 'error',
        type: 'unintended_dead_end',
        message: `Scene "${scene.id}" has no choices and is not marked as an ending. Readers will get stuck.`,
        sceneId: scene.id,
      });
    }
  }

  // 4. Reachability analysis (BFS from startSceneId)
  if (sceneMap.has(story.startSceneId)) {
    const reachable = new Set<string>();
    const queue: string[] = [story.startSceneId];
    reachable.add(story.startSceneId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentScene = sceneMap.get(currentId);
      if (!currentScene) continue;

      for (const choice of currentScene.choices) {
        if (!reachable.has(choice.destinationSceneId) && sceneMap.has(choice.destinationSceneId)) {
          reachable.add(choice.destinationSceneId);
          queue.push(choice.destinationSceneId);
        }
      }
    }

    for (const scene of story.scenes) {
      if (!reachable.has(scene.id)) {
        addIssue({
          severity: 'warning',
          type: 'unreachable_scene',
          message: `Scene "${scene.id}" cannot be reached from the start scene ("${story.startSceneId}").`,
          sceneId: scene.id,
        });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

/**
 * Validates untrusted data against both Zod schema and graph rules.
 */
export function validateStory(data: unknown): ValidationResult {
  const parseResult = StorySchema.safeParse(data);
  if (!parseResult.success) {
    const schemaErrors: ValidationIssue[] = parseResult.error.issues.map((issue) => ({
      severity: 'error',
      type: 'schema_error',
      message: `${issue.path.join('.')}: ${issue.message}`,
    }));
    return {
      isValid: false,
      errors: schemaErrors,
      warnings: [],
      issues: schemaErrors,
    };
  }

  return validateStoryGraph(parseResult.data);
}

