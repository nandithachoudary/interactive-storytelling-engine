import { z } from 'zod';
import type { StoryVariables } from '@/engine';

/**
 * Zod schema to validate serialized story playthrough progress.
 * Guarantees that saved data has not been corrupted or tampered with before loading.
 */
export const SavedProgressSchema = z.object({
  storyId: z.string().min(1, 'Story ID is required'),
  schemaVersion: z.union([z.number().int().positive(), z.string().min(1)]),
  storyVersion: z.string().min(1, 'Story version is required'),
  history: z.array(z.string()),
  currentSceneId: z.string().min(1, 'Current scene ID is required'),
  variables: z.record(
    z.string(),
    z.union([z.boolean(), z.number(), z.string()])
  ),
  isCompleted: z.boolean(),
  discoveredEndingId: z.string().optional(),
  discoveredEndings: z.array(z.string()),
  updatedAt: z.string(),
});

export type SavedProgress = z.infer<typeof SavedProgressSchema>;

/**
 * Storage interface for saving, loading, and clearing reader progress.
 */
export interface ProgressStore {
  save(storyId: string, progress: SavedProgress): boolean;
  load(storyId: string): SavedProgress | null;
  clear(storyId: string): boolean;
}

