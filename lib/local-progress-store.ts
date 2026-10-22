import {
  type ProgressStore,
  type SavedProgress,
  SavedProgressSchema,
} from './progress-store';

/**
 * Browser localStorage implementation of ProgressStore.
 *
 * Rules:
 * 1. Safe during server-side rendering (SSR): Never touches window.localStorage if undefined.
 * 2. Validates saved JSON against SavedProgressSchema before returning to prevent runtime crashes.
 * 3. Catches DOMException / quota exceeded / security errors gracefully and returns boolean success.
 * 4. Supports dependency injection of custom storage for unit testing.
 */
export class LocalProgressStore implements ProgressStore {
  private prefix: string;
  private customStorage?: Storage;

  constructor(prefix = 'story_progress_', customStorage?: Storage) {
    this.prefix = prefix;
    this.customStorage = customStorage;
  }

  /**
   * Retrieves the active storage mechanism safely.
   */
  private getStorage(): Storage | null {
    if (this.customStorage) {
      return this.customStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  /**
   * Constructs the storage key for a specific story ID.
   */
  private getKey(storyId: string): string {
    return `${this.prefix}${storyId}`;
  }

  /**
   * Checks whether persistent storage is available in the current environment.
   */
  isAvailable(): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const testKey = `__storage_test__`;
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Saves a playthrough progress snapshot to localStorage.
   */
  save(storyId: string, progress: SavedProgress): boolean {
    const storage = this.getStorage();
    if (!storage) return false;

    // Validate progress data shape before saving
    const validation = SavedProgressSchema.safeParse(progress);
    if (!validation.success) {
      return false;
    }

    try {
      const serialized = JSON.stringify(validation.data);
      storage.setItem(this.getKey(storyId), serialized);
      return true;
    } catch (err) {
      // Handles quota exceeded or private mode security restrictions
      return false;
    }
  }

  /**
   * Loads and validates saved playthrough progress for a story ID.
   * Returns null if no progress is found, JSON is corrupted, or schema validation fails.
   */
  load(storyId: string): SavedProgress | null {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(this.getKey(storyId));
      if (!raw) return null;

      const parsedJson = JSON.parse(raw);
      const validation = SavedProgressSchema.safeParse(parsedJson);

      if (!validation.success) {
        return null;
      }

      return validation.data;
    } catch (err) {
      // Handles invalid JSON or parsing errors
      return null;
    }
  }

  /**
   * Removes saved progress for a given story ID.
   */
  clear(storyId: string): boolean {
    const storage = this.getStorage();
    if (!storage) return false;

    try {
      storage.removeItem(this.getKey(storyId));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance of LocalProgressStore for application-wide use.
 */
export const localProgressStore = new LocalProgressStore();

