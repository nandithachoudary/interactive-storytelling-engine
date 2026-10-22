/**
 * Public Engine API Barrel
 *
 * Exposes core schemas, state management, runtime execution,
 * history tracking, and graph validation for interactive stories.
 */

// 1. Schemas & Types
export {
  VariableValueSchema,
  StoryVariablesSchema,
  ComparisonOperatorSchema,
  BooleanConditionSchema,
  CompareConditionSchema,
  ConditionSchema,
  SetEffectSchema,
  AddEffectSchema,
  ToggleEffectSchema,
  ChoiceEffectSchema,
  ChoiceSchema,
  EndingMarkerSchema,
  SceneSchema,
  StorySchema,
  parseStory,
  safeParseStory,
  type VariableValue,
  type StoryVariables,
  type ComparisonOperator,
  type BooleanCondition,
  type CompareCondition,
  type AndCondition,
  type OrCondition,
  type NotCondition,
  type Condition,
  type SetEffect,
  type AddEffect,
  type ToggleEffect,
  type ChoiceEffect,
  type Choice,
  type EndingMarker,
  type Scene,
  type Story,
} from './schema';

// 2. Condition Evaluation
export {
  evaluateCondition,
  isChoiceAvailable,
} from './conditions';

// 3. Playthrough State
export {
  createInitialState,
  setVariable,
  applyEffectToVariables,
  applyEffects,
  setCurrentScene,
  recordEnding,
  recordDiscoveredEnding,
  type PlaythroughState,
} from './state';

// 4. Runtime Execution
export {
  getScene,
  getCurrentScene,
  getAvailableChoices,
  initPlaythrough,
  advancePlaythrough,
  StoryRuntime,
  type AdvanceResult,
  type InitPlaythroughResult,
} from './runtime';

// 5. History, Replay & Undo
export {
  recordChoice,
  replayChoices,
  replayChoicesStrict,
  undoLastChoice,
  restartPlaythrough,
  StorySession,
  type ReplayResult,
  type HistoryOperationResult,
} from './history';

// 6. Graph Validation
export {
  validateStoryGraph,
  validateStory,
  type ValidationIssue,
  type ValidationIssueSeverity,
  type ValidationResult,
} from './validation';

