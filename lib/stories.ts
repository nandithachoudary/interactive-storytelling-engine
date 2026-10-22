import { parseStory, type Story } from '@/engine';
import demoStoryData from '@/content/demo-story.json';
import whisperingWoodsData from '@/content/whispering-woods.json';
import derelictStarshipData from '@/content/derelict-starship.json';
import type { SavedProgress } from './progress-store';

/**
 * Validated in-memory collection of all platform stories.
 */
const storyRegistry: Story[] = [
  parseStory(demoStoryData),
  parseStory(whisperingWoodsData),
  parseStory(derelictStarshipData),
];

/**
 * Returns all available stories on the platform.
 */
export function getAllStories(): Story[] {
  return storyRegistry;
}

/**
 * Looks up a story by its unique identifier. Returns null if not found.
 */
export function getStoryById(id: string): Story | null {
  return storyRegistry.find((story) => story.id === id) ?? null;
}

/**
 * Returns all unique story IDs available on the platform.
 */
export function getAllStoryIds(): string[] {
  return storyRegistry
    .map((s) => s.id)
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Extracts all unique genres present across registered stories.
 */
export function getAllGenres(): string[] {
  const genres = new Set<string>();
  for (const story of storyRegistry) {
    if (story.genre) {
      genres.add(story.genre);
    }
  }
  return Array.from(genres);
}

export type StoryReadingStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Accurately calculates reading status from real, validated saved progress.
 * Does not fabricate percentages or fictitious statuses.
 */
export function getStoryProgressStatus(
  story: Story,
  saved: SavedProgress | null
): {
  status: StoryReadingStatus;
  label: string;
  endingsDiscoveredCount: number;
  totalEndingsCount: number;
  currentSceneTitle?: string;
} {
  const totalEndingsCount = story.scenes.filter((s) => s.ending).length;

  if (!saved || saved.history.length === 0) {
    return {
      status: 'not_started',
      label: 'Not started',
      endingsDiscoveredCount: 0,
      totalEndingsCount,
    };
  }

  const endingsDiscoveredCount = saved.discoveredEndings?.length ?? 0;
  const currentScene = story.scenes.find((s) => s.id === saved.currentSceneId);

  if (saved.isCompleted) {
    return {
      status: 'completed',
      label: 'Completed',
      endingsDiscoveredCount,
      totalEndingsCount,
      currentSceneTitle: currentScene?.title,
    };
  }

  return {
    status: 'in_progress',
    label: 'In progress',
    endingsDiscoveredCount,
    totalEndingsCount,
    currentSceneTitle: currentScene?.title,
  };
}

/**
 * Pure search and genre filter for library display.
 */
export function filterStories(
  stories: Story[],
  searchQuery: string,
  selectedGenre: string
): Story[] {
  const query = searchQuery.trim().toLowerCase();

  return stories.filter((story) => {
    // Genre filter
    if (selectedGenre !== 'all' && story.genre?.toLowerCase() !== selectedGenre.toLowerCase()) {
      return false;
    }

    // Search query filter (title, description, author)
    if (query) {
      const matchTitle = story.title.toLowerCase().includes(query);
      const matchDescription = story.description?.toLowerCase().includes(query) ?? false;
      const matchAuthor = story.author.toLowerCase().includes(query);
      return matchTitle || matchDescription || matchAuthor;
    }

    return true;
  });
}

