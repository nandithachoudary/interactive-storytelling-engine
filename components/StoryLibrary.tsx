'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { type Story } from '@/engine';
import { localProgressStore } from '@/lib/local-progress-store';
import type { SavedProgress } from '@/lib/progress-store';
import {
  filterStories,
  getAllGenres,
  getStoryProgressStatus,
} from '@/lib/stories';

interface StoryLibraryProps {
  stories: Story[];
}

export default function StoryLibrary({ stories }: StoryLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [progressMap, setProgressMap] = useState<Record<string, SavedProgress | null>>({});
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  // Available genres
  const genres = useMemo(() => ['all', ...getAllGenres()], []);

  // Load progress from localStorage safely on client mount
  useEffect(() => {
    setIsClientLoaded(true);
    const map: Record<string, SavedProgress | null> = {};
    for (const story of stories) {
      if (story.id) {
        map[story.id] = localProgressStore.load(story.id);
      }
    }
    setProgressMap(map);
  }, [stories]);

  // Filtered stories based on search query and genre
  const filteredStories = useMemo(
    () => filterStories(stories, searchQuery, selectedGenre),
    [stories, searchQuery, selectedGenre]
  );

  // Pick first story as featured if available
  const featuredStory = stories.find((s) => s.id === 'fog-island-mystery') ?? stories[0];
  const featuredProgress = featuredStory?.id ? progressMap[featuredStory.id] : null;
  const featuredStatus = featuredStory
    ? getStoryProgressStatus(featuredStory, isClientLoaded ? featuredProgress : null)
    : null;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-lg">✦</span>
            <span className="font-serif text-lg sm:text-xl font-medium tracking-wide text-amber-100">
              Chronicle & Choice
            </span>
          </div>
          <span className="text-xs text-slate-400 border border-slate-800 bg-slate-900/80 px-3 py-1 rounded-full">
            {stories.length} Stories Available
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Platform Hero */}
        <section className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs uppercase tracking-widest font-semibold text-amber-400/90 inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            Interactive Storytelling Platform
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-slate-100 tracking-tight leading-tight">
            Every choice branches the narrative.
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-serif">
            Immerse yourself in text-first narrative adventures across mystery, fantasy, and sci-fi.
            Inspect clues, make difficult moral decisions, and discover alternate endings.
          </p>
        </section>

        {/* Featured Story Showcase (shown when not filtering) */}
        {featuredStory && searchQuery === '' && selectedGenre === 'all' && (
          <section
            aria-label="Featured Story"
            className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#101b33] to-[#0d1424] border border-amber-500/30 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950">
                    Featured Tale
                  </span>
                  {featuredStory.genre && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-slate-700 bg-slate-900/80 text-slate-300">
                      {featuredStory.genre}
                    </span>
                  )}
                  {featuredStory.estimatedReadingTime && (
                    <span className="text-xs text-slate-400">
                      ⏱️ {featuredStory.estimatedReadingTime}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif text-amber-100 leading-snug">
                  {featuredStory.title}
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-serif">
                  {featuredStory.description}
                </p>

                {/* Status indicator */}
                {isClientLoaded && featuredStatus && featuredStatus.status !== 'not_started' && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                        featuredStatus.status === 'completed'
                          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          featuredStatus.status === 'completed'
                            ? 'bg-emerald-400'
                            : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span>{featuredStatus.label}</span>
                      {featuredStatus.currentSceneTitle && (
                        <span className="text-slate-400">
                          &bull; at {featuredStatus.currentSceneTitle}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                <Link
                  href={`/story/${featuredStory.id}/play`}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm text-center shadow-lg shadow-amber-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span>
                    {isClientLoaded && featuredStatus?.status === 'in_progress'
                      ? 'Continue Reading'
                      : 'Start Reading'}
                  </span>
                  <span>→</span>
                </Link>

                <Link
                  href={`/story/${featuredStory.id}`}
                  className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm text-center transition-colors"
                >
                  Story Details
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Search & Genre Filters */}
        <section aria-label="Story filters" className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories by title or description..."
                aria-label="Search stories"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-400/70 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 text-sm font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Genre Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0" role="tablist">
              {genres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedGenre === genre
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {genre === 'all' ? 'All Genres' : genre}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Story Grid */}
        <section aria-label="Story collection" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-xl font-serif font-medium text-slate-200">
              {selectedGenre === 'all' ? 'All Stories' : `${selectedGenre} Stories`}
            </h2>
            <span className="text-xs text-slate-400">
              Showing {filteredStories.length} of {stories.length}
            </span>
          </div>

          {filteredStories.length === 0 ? (
            /* Empty State */
            <div className="py-16 text-center space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8">
              <span className="text-3xl">📜</span>
              <h3 className="text-lg font-serif text-slate-200 font-medium">
                No stories match your criteria
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto font-serif">
                We couldn&apos;t find any stories matching &ldquo;{searchQuery}&rdquo;. Try clearing your search or switching genres.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGenre('all');
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStories.map((story) => {
                const saved = isClientLoaded && story.id ? progressMap[story.id] : null;
                const progressInfo = getStoryProgressStatus(story, saved);

                return (
                  <article
                    key={story.id}
                    className="p-6 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 hover:border-amber-500/40 hover:bg-[#111a30] transition-all duration-200 flex flex-col justify-between shadow-lg group relative"
                  >
                    <div className="space-y-3.5">
                      {/* Genre & Read time */}
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        {story.genre ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              story.genre.toLowerCase() === 'fantasy'
                                ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                                : story.genre.toLowerCase() === 'science fiction'
                                ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-300'
                                : 'bg-amber-950/60 border border-amber-500/30 text-amber-300'
                            }`}
                          >
                            {story.genre}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                            Story
                          </span>
                        )}

                        {story.estimatedReadingTime && (
                          <span className="text-slate-400 text-[11px]">
                            ⏱️ {story.estimatedReadingTime}
                          </span>
                        )}
                      </div>

                      {/* Title & Author */}
                      <div>
                        <h3 className="text-xl font-serif text-slate-100 group-hover:text-amber-100 transition-colors font-medium leading-snug">
                          <Link href={`/story/${story.id}`}>
                            {story.title}
                          </Link>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          By {story.author}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed font-serif">
                        {story.description}
                      </p>
                    </div>

                    {/* Card Footer: Progress Badge & Action Buttons */}
                    <div className="pt-6 mt-6 border-t border-slate-800/70 space-y-3">
                      {/* Progress status */}
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            progressInfo.status === 'completed'
                              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                              : progressInfo.status === 'in_progress'
                              ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              progressInfo.status === 'completed'
                                ? 'bg-emerald-400'
                                : progressInfo.status === 'in_progress'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-slate-500'
                            }`}
                          />
                          <span>{progressInfo.label}</span>
                        </span>

                        {progressInfo.totalEndingsCount > 0 && (
                          <span className="text-[11px] text-slate-400">
                            🏆 {progressInfo.endingsDiscoveredCount} / {progressInfo.totalEndingsCount} Endings
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/story/${story.id}/play`}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold text-center transition-colors shadow-sm"
                        >
                          {progressInfo.status === 'in_progress' ? 'Continue' : 'Start Reading'}
                        </Link>

                        <Link
                          href={`/story/${story.id}`}
                          className="py-2 px-3 rounded-xl border border-slate-700/80 hover:border-slate-500 bg-slate-900/80 text-slate-300 hover:text-white text-xs font-medium text-center transition-colors"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            Chronicle & Choice &bull; Reusable Interactive Fiction Platform
          </p>
          <p className="text-slate-600">
            Progress is preserved securely in your browser&apos;s local storage.
          </p>
        </div>
      </footer>
    </div>
  );
}

