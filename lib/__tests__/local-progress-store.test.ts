import { describe, it, expect, beforeEach } from 'vitest';
import { LocalProgressStore } from '../local-progress-store';
import type { SavedProgress } from '../progress-store';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  public shouldThrowOnSet = false;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) {
      throw new Error('QuotaExceededError: storage is full');
    }
    this.store.set(key, value);
  }
}

describe('LocalProgressStore', () => {
  let mockStorage: MockStorage;
  let progressStore: LocalProgressStore;

  const validProgress: SavedProgress = {
    storyId: 'fog-island-mystery',
    schemaVersion: 1,
    storyVersion: '1.0.0',
    history: ['dock_to_beach', 'beach_take_lantern'],
    currentSceneId: 'beach_cleared',
    variables: {
      hasLantern: true,
      cluesFound: 1,
      hasTreasure: false,
    },
    isCompleted: false,
    discoveredEndings: ['ending_truth'],
    updatedAt: '2026-10-22T21:00:00.000Z',
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    progressStore = new LocalProgressStore('test_story_', mockStorage);
  });

  describe('Saving and loading progress', () => {
    it('saves and loads a valid playthrough progress snapshot', () => {
      const saved = progressStore.save('fog-island-mystery', validProgress);
      expect(saved).toBe(true);

      const loaded = progressStore.load('fog-island-mystery');
      expect(loaded).toEqual(validProgress);
      expect(loaded?.currentSceneId).toBe('beach_cleared');
      expect(loaded?.variables.hasLantern).toBe(true);
      expect(loaded?.history).toHaveLength(2);
    });

    it('returns null if no progress is saved for a story ID', () => {
      const loaded = progressStore.load('unknown-story-id');
      expect(loaded).toBeNull();
    });

    it('clears saved progress successfully', () => {
      progressStore.save('fog-island-mystery', validProgress);
      expect(progressStore.load('fog-island-mystery')).not.toBeNull();

      const cleared = progressStore.clear('fog-island-mystery');
      expect(cleared).toBe(true);
      expect(progressStore.load('fog-island-mystery')).toBeNull();
    });
  });

  describe('Isolation between different stories', () => {
    it('does not overwrite or mix saved progress between different stories', () => {
      const secondStoryProgress: SavedProgress = {
        ...validProgress,
        storyId: 'haunted-mansion',
        currentSceneId: 'entrance_hall',
        variables: { hasKey: true },
      };

      progressStore.save('fog-island-mystery', validProgress);
      progressStore.save('haunted-mansion', secondStoryProgress);

      const fog = progressStore.load('fog-island-mystery');
      const haunted = progressStore.load('haunted-mansion');

      expect(fog?.storyId).toBe('fog-island-mystery');
      expect(fog?.currentSceneId).toBe('beach_cleared');

      expect(haunted?.storyId).toBe('haunted-mansion');
      expect(haunted?.currentSceneId).toBe('entrance_hall');

      // Clearing one does not affect the other
      progressStore.clear('haunted-mansion');
      expect(progressStore.load('haunted-mansion')).toBeNull();
      expect(progressStore.load('fog-island-mystery')).not.toBeNull();
    });
  });

  describe('Resilience to corrupted data or storage failures', () => {
    it('safely returns null if stored data contains invalid JSON', () => {
      mockStorage.setItem('test_story_fog-island-mystery', '{ invalid json ...');
      const loaded = progressStore.load('fog-island-mystery');
      expect(loaded).toBeNull();
    });

    it('safely returns null if stored data violates the SavedProgress schema', () => {
      const invalidData = {
        storyId: 'fog-island-mystery',
        // missing required fields: schemaVersion, history, variables, etc.
      };
      mockStorage.setItem(
        'test_story_fog-island-mystery',
        JSON.stringify(invalidData)
      );

      const loaded = progressStore.load('fog-island-mystery');
      expect(loaded).toBeNull();
    });

    it('returns false when storage throws an exception (e.g. quota exceeded)', () => {
      mockStorage.shouldThrowOnSet = true;
      const result = progressStore.save('fog-island-mystery', validProgress);
      expect(result).toBe(false);
    });

    it('safely handles environments where localStorage is not available (SSR)', () => {
      const ssrStore = new LocalProgressStore('test_', undefined);
      // In node/SSR without window.localStorage, must return false/null gracefully
      expect(ssrStore.save('fog-island-mystery', validProgress)).toBe(false);
      expect(ssrStore.load('fog-island-mystery')).toBeNull();
      expect(ssrStore.clear('fog-island-mystery')).toBe(false);
      expect(ssrStore.isAvailable()).toBe(false);
    });
  });
});

