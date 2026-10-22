import { z } from 'zod';

/**
 * Supported primitive variable values for story state.
 * Interactive stories can track flags (booleans), counters/stats (numbers),
 * and descriptive names or states (strings).
 */
export const VariableValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
]);
export type VariableValue = z.infer<typeof VariableValueSchema>;

/**
 * Story-wide variables dictionary.
 * Example: { hasLantern: false, cluesFound: 0, detectiveName: "Sam" }
 */
export const StoryVariablesSchema = z.record(z.string(), VariableValueSchema);
export type StoryVariables = z.infer<typeof StoryVariablesSchema>;

/**
 * Comparison operators for numeric or equality conditions.
 */
export const ComparisonOperatorSchema = z.enum([
  '==',
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
]);
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;

/**
 * 1. Boolean condition: checks if a boolean variable matches expected boolean value.
 * Example: { type: 'boolean', variable: 'hasLantern', value: true }
 */
export const BooleanConditionSchema = z.object({
  type: z.literal('boolean'),
  variable: z.string().min(1, 'Variable name cannot be empty'),
  value: z.boolean(),
});
export type BooleanCondition = z.infer<typeof BooleanConditionSchema>;

/**
 * 2. Compare condition: compares a variable to a value using an operator.
 * Example: { type: 'compare', variable: 'cluesFound', operator: '>=', value: 3 }
 */
export const CompareConditionSchema = z.object({
  type: z.literal('compare'),
  variable: z.string().min(1, 'Variable name cannot be empty'),
  operator: ComparisonOperatorSchema,
  value: VariableValueSchema,
});
export type CompareCondition = z.infer<typeof CompareConditionSchema>;

/**
 * Compound conditions:
 * - AND: all child conditions must pass
 * - OR: at least one child condition must pass
 * - NOT: the child condition must fail
 */
export type AndCondition = {
  type: 'and';
  conditions: Condition[];
};

export type OrCondition = {
  type: 'or';
  conditions: Condition[];
};

export type NotCondition = {
  type: 'not';
  condition: Condition;
};

/**
 * Union of all valid conditions.
 * Defined recursively so conditions can be nested (e.g. AND containing OR).
 */
export type Condition =
  | BooleanCondition
  | CompareCondition
  | AndCondition
  | OrCondition
  | NotCondition;

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    BooleanConditionSchema,
    CompareConditionSchema,
    z.object({
      type: z.literal('and'),
      conditions: z.array(ConditionSchema).min(1, 'AND condition must contain at least one child condition'),
    }),
    z.object({
      type: z.literal('or'),
      conditions: z.array(ConditionSchema).min(1, 'OR condition must contain at least one child condition'),
    }),
    z.object({
      type: z.literal('not'),
      condition: ConditionSchema,
    }),
  ])
);

/**
 * Effects that run when a player selects a choice:
 * - set: assign a value to a variable
 * - add: increase/decrease a numeric variable
 * - toggle: invert a boolean variable
 */
export const SetEffectSchema = z.object({
  type: z.literal('set'),
  variable: z.string().min(1),
  value: VariableValueSchema,
});
export type SetEffect = z.infer<typeof SetEffectSchema>;

export const AddEffectSchema = z.object({
  type: z.literal('add'),
  variable: z.string().min(1),
  value: z.number(),
});
export type AddEffect = z.infer<typeof AddEffectSchema>;

export const ToggleEffectSchema = z.object({
  type: z.literal('toggle'),
  variable: z.string().min(1),
});
export type ToggleEffect = z.infer<typeof ToggleEffectSchema>;

export const ChoiceEffectSchema = z.discriminatedUnion('type', [
  SetEffectSchema,
  AddEffectSchema,
  ToggleEffectSchema,
]);
export type ChoiceEffect = z.infer<typeof ChoiceEffectSchema>;

/**
 * Choice: An interactive option presented to the reader.
 * - id: unique identifier for this choice within its scene
 * - text: reader-facing label
 * - destinationSceneId: ID of the scene to navigate to
 * - effects: optional variable changes triggered when chosen
 * - condition: optional requirement to show or enable this choice
 */
export const ChoiceSchema = z.object({
  id: z.string().min(1, 'Choice ID is required'),
  text: z.string().min(1, 'Choice text is required'),
  destinationSceneId: z.string().min(1, 'Destination scene ID is required'),
  effects: z.array(ChoiceEffectSchema).optional().default([]),
  condition: ConditionSchema.optional(),
});
export type Choice = z.infer<typeof ChoiceSchema>;

/**
 * Ending marker attached to a scene if it represents a story conclusion.
 * Allows tracking discovered endings separately from the current playthrough.
 */
export const EndingMarkerSchema = z.object({
  id: z.string().min(1, 'Ending ID is required'),
  title: z.string().min(1, 'Ending title is required'),
  type: z.string().optional(), // e.g. "good", "bad", "neutral", "secret"
  description: z.string().optional(),
});
export type EndingMarker = z.infer<typeof EndingMarkerSchema>;

/**
 * Scene: A single narrative node in the story graph.
 * - id: unique identifier for this scene
 * - title: scene heading
 * - content: main narrative text
 * - choices: list of choices leading to other scenes
 * - ending: optional ending marker if this scene is a conclusion
 */
export const SceneSchema = z.object({
  id: z.string().min(1, 'Scene ID is required'),
  title: z.string().min(1, 'Scene title is required'),
  content: z.string().min(1, 'Scene content is required'),
  choices: z.array(ChoiceSchema).default([]),
  ending: EndingMarkerSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

/**
 * Story: Complete story specification.
 * - schemaVersion: schema compatibility version (number or semver string)
 * - storyVersion: author's story version string
 * - title: title of the story
 * - author: creator of the story
 * - startSceneId: ID of the scene where the story begins
 * - variables: initial variables mapping
 * - scenes: list of all scenes in the story
 */
export const StorySchema = z.object({
  schemaVersion: z.union([z.number().int().positive(), z.string().min(1)]),
  storyVersion: z.string().min(1, 'storyVersion is required'),
  id: z.string().min(1).optional(),
  title: z.string().min(1, 'Story title is required'),
  author: z.string().min(1, 'Author is required'),
  description: z.string().optional(),
  genre: z.string().optional(),
  estimatedReadingTime: z.string().optional(),
  startSceneId: z.string().min(1, 'startSceneId is required'),
  variables: StoryVariablesSchema.optional().default({}),
  scenes: z.array(SceneSchema).min(1, 'A story must have at least one scene'),
});
export type Story = z.infer<typeof StorySchema>;

/**
 * Parse and validate an unknown object against the Story schema.
 * Throws a ZodError if validation fails.
 */
export function parseStory(data: unknown): Story {
  return StorySchema.parse(data);
}

/**
 * Safely parse an unknown object against the Story schema without throwing.
 */
export function safeParseStory(data: unknown) {
  return StorySchema.safeParse(data);
}

