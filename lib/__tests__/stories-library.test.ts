import { describe, it, expect } from 'vitest';
import {
  getAllStories,
  getStoryById,
  getAllStoryIds,
  getAllGenres,
  getStoryProgressStatus,
  filterStories,
} from '../stories';
import { validateStoryGraph, validateStory } from '@/engine';
import { LocalProgressStore } from '../local-progress-store';
import type { SavedProgress } from '../progress-store';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

describe('Story Library & Multi-Story Platform', () => {
  const stories = getAllStories();

  describe('Story validation & Graph consistency', () => {
    it('contains all 3 platform stories across different genres', () => {
      expect(stories).toHaveLength(3);
      const ids = getAllStoryIds();
      expect(ids).toContain('fog-island-mystery');
      expect(ids).toContain('whispering-woods');
      expect(ids).toContain('derelict-starship');

      const genres = getAllGenres();
      expect(genres).toContain('Mystery');
      expect(genres).toContain('Fantasy');
      expect(genres).toContain('Science Fiction');
    });

    it('passes story validation and graph checks for all registered stories without errors', () => {
      for (const story of stories) {
        const validation = validateStoryGraph(story);
        expect(validation.isValid, `Story "${story.title}" must be valid`).toBe(true);
        expect(validation.errors).toEqual([]);

        // Ensure start scene exists
        const startScene = story.scenes.find((s) => s.id === story.startSceneId);
        expect(startScene, `Start scene must exist in "${story.title}"`).toBeDefined();

        // Ensure at least two intentional endings exist
        const endings = story.scenes.filter((s) => s.ending);
        expect(
          endings.length,
          `"${story.title}" must have at least 2 endings`
        ).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Story retrieval and lookup', () => {
    it('retrieves each story accurately by ID', () => {
      const fogStory = getStoryById('fog-island-mystery');
      expect(fogStory?.title).toBe('The Mystery of Fog Island');
      expect(fogStory?.genre).toBe('Mystery');

      const woodsStory = getStoryById('whispering-woods');
      expect(woodsStory?.title).toBe('The Heart of Eldoria');
      expect(woodsStory?.genre).toBe('Fantasy');

      const sciFiStory = getStoryById('derelict-starship');
      expect(sciFiStory?.title).toBe('Echoes of the Void');
      expect(sciFiStory?.genre).toBe('Science Fiction');
    });

    it('returns null safely for unknown story IDs', () => {
      const unknown = getStoryById('nonexistent-story-123');
      expect(unknown).toBeNull();
    });
  });

  describe('Search and genre filtering', () => {
    it('filters stories by genre accurately', () => {
      const fantasyOnly = filterStories(stories, '', 'Fantasy');
      expect(fantasyOnly).toHaveLength(1);
      expect(fantasyOnly[0].id).toBe('whispering-woods');

      const sciFiOnly = filterStories(stories, '', 'Science Fiction');
      expect(sciFiOnly).toHaveLength(1);
      expect(sciFiOnly[0].id).toBe('derelict-starship');

      const all = filterStories(stories, '', 'all');
      expect(all).toHaveLength(3);
    });

    it('searches stories by title or description query (case-insensitive)', () => {
      const fogSearch = filterStories(stories, 'fog', 'all');
      expect(fogSearch).toHaveLength(1);
      expect(fogSearch[0].id).toBe('fog-island-mystery');

      const starshipSearch = filterStories(stories, 'pulsar', 'all');
      expect(starshipSearch).toHaveLength(1);
      expect(starshipSearch[0].id).toBe('derelict-starship');

      const noMatch = filterStories(stories, 'superheroes-flying-away', 'all');
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('Reading progress status calculation & Story isolation', () => {
    const mockStorage = new MockStorage();
    const store = new LocalProgressStore('test_lib_', mockStorage);
    const fogStory = getStoryById('fog-island-mystery')!;
    const woodsStory = getStoryById('whispering-woods')!;

    it('computes "Not started" when no progress is saved', () => {
      const status = getStoryProgressStatus(fogStory, null);
      expect(status.status).toBe('not_started');
      expect(status.label).toBe('Not started');
      expect(status.endingsDiscoveredCount).toBe(0);
      expect(status.totalEndingsCount).toBe(5);
    });

    it('computes "In progress" with scene and endings information for ongoing playthroughs', () => {
      const inProgressData: SavedProgress = {
        storyId: 'fog-island-mystery',
        schemaVersion: 1,
        storyVersion: '1.0.0',
        history: ['dock_to_beach'],
        currentSceneId: 'beach',
        variables: { hasLantern: false, cluesFound: 0, hasTreasure: false },
        isCompleted: false,
        discoveredEndings: ['ending_truth'],
        updatedAt: new Date().toISOString(),
      };

      const status = getStoryProgressStatus(fogStory, inProgressData);
      expect(status.status).toBe('in_progress');
      expect(status.label).toBe('In progress');
      expect(status.currentSceneTitle).toBe('The Shingle Beach');
      expect(status.endingsDiscoveredCount).toBe(1);
    });

    it('computes "Completed" when playthrough reached an ending', () => {
      const completedData: SavedProgress = {
        storyId: 'fog-island-mystery',
        schemaVersion: 1,
        storyVersion: '1.0.0',
        history: ['dock_to_lighthouse', 'approach_enter', 'ask_shelter'],
        currentSceneId: 'ending_stranded',
        variables: { hasLantern: false, cluesFound: 0, hasTreasure: false },
        isCompleted: true,
        discoveredEndingId: 'ending_escape',
        discoveredEndings: ['ending_escape'],
        updatedAt: new Date().toISOString(),
      };

      const status = getStoryProgressStatus(fogStory, completedData);
      expect(status.status).toBe('completed');
      expect(status.label).toBe('Completed');
    });

    it('isolates saved progress strictly between different stories', () => {
      const fogSave: SavedProgress = {
        storyId: 'fog-island-mystery',
        schemaVersion: 1,
        storyVersion: '1.0.0',
        history: ['dock_to_beach'],
        currentSceneId: 'beach',
        variables: { hasLantern: false, cluesFound: 0, hasTreasure: false },
        isCompleted: false,
        discoveredEndings: ['ending_truth'],
        updatedAt: new Date().toISOString(),
      };

      const woodsSave: SavedProgress = {
        storyId: 'whispering-woods',
        schemaVersion: 1,
        storyVersion: '1.0.0',
        history: ['crossroads_to_shrine', 'shrine_take_sunstone'],
        currentSceneId: 'shrine_cleared',
        variables: { hasSunstone: true, guardianTrust: 1 },
        isCompleted: false,
        discoveredEndings: [],
        updatedAt: new Date().toISOString(),
      };

      store.save('fog-island-mystery', fogSave);
      store.save('whispering-woods', woodsSave);

      const loadedFog = store.load('fog-island-mystery');
      const loadedWoods = store.load('whispering-woods');

      expect(loadedFog?.currentSceneId).toBe('beach');
      expect(loadedWoods?.currentSceneId).toBe('shrine_cleared');

      // Fog status does not leak into Woods status
      const fogStatus = getStoryProgressStatus(fogStory, loadedFog);
      const woodsStatus = getStoryProgressStatus(woodsStory, loadedWoods);

      expect(fogStatus.currentSceneTitle).toBe('The Shingle Beach');
      expect(woodsStatus.currentSceneTitle).toBe('The Sunken Shrine (Relic Attuned)');
      expect(fogStatus.endingsDiscoveredCount).toBe(1);
      expect(woodsStatus.endingsDiscoveredCount).toBe(0);
    });
  });
});

