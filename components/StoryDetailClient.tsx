'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Story, initPlaythrough, restartPlaythrough } from '@/engine';
import { localProgressStore } from '@/lib/local-progress-store';
import type { SavedProgress } from '@/lib/progress-store';
import { getStoryProgressStatus } from '@/lib/stories';

interface StoryDetailClientProps {
  story: Story;
}

export default function StoryDetailClient({ story }: StoryDetailClientProps) {
  const router = useRouter();
  const storyId = story.id ?? '';
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load progress from localStorage safely after mount
  useEffect(() => {
    setIsClientLoaded(true);
    if (storyId) {
      setSavedProgress(localProgressStore.load(storyId));
    }
  }, [storyId]);

  const progressInfo = getStoryProgressStatus(story, isClientLoaded ? savedProgress : null);

  const handleRestart = () => {
    setShowRestartConfirm(false);
    if (!storyId) return;

    // Restart playthrough using engine and preserve discovered endings
    const currentEndings = savedProgress?.discoveredEndings ?? [];
    const restarted = restartPlaythrough(story, currentEndings);

    const snapshot: SavedProgress = {
      storyId,
      schemaVersion: story.schemaVersion,
      storyVersion: story.storyVersion,
      history: [],
      currentSceneId: restarted.state.currentSceneId,
      variables: restarted.state.variables,
      isCompleted: false,
      discoveredEndings: restarted.discoveredEndings,
      updatedAt: new Date().toISOString(),
    };

    localProgressStore.save(storyId, snapshot);
    router.push(`/story/${storyId}/play`);
  };

  const handleReset = () => {
    setShowResetConfirm(false);
    if (!storyId) return;
    localProgressStore.clear(storyId);
    setSavedProgress(null);
  };

  return (
    <div className="space-y-8">
      {/* Action buttons & Status Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0f172a]/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Current Status</span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  progressInfo.status === 'completed'
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                    : progressInfo.status === 'in_progress'
                    ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    progressInfo.status === 'completed'
                      ? 'bg-emerald-400'
                      : progressInfo.status === 'in_progress'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="font-semibold">{progressInfo.label}</span>
              </span>

              {progressInfo.currentSceneTitle && (
                <span className="text-xs text-slate-400">
                  at <strong className="text-slate-200">{progressInfo.currentSceneTitle}</strong>
                </span>
              )}
            </div>
          </div>

          {progressInfo.totalEndingsCount > 0 && (
            <div className="text-right">
              <span className="text-xs text-slate-400 block mb-1">Discovered Endings</span>
              <span className="text-sm font-semibold text-amber-300">
                🏆 {progressInfo.endingsDiscoveredCount} of {progressInfo.totalEndingsCount} Found
              </span>
            </div>
          )}
        </div>

        {/* Primary and secondary launch controls */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-3">
          <Link
            href={`/story/${storyId}/play`}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-amber-500/10 flex items-center gap-2"
          >
            <span>
              {progressInfo.status === 'in_progress' ? 'Continue Reading' : 'Start Reading'}
            </span>
            <span>→</span>
          </Link>

          {progressInfo.status === 'in_progress' && (
            <button
              type="button"
              onClick={() => setShowRestartConfirm(true)}
              className="px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors"
            >
              Restart from Beginning
            </button>
          )}

          {isClientLoaded && savedProgress && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-3 rounded-xl text-slate-500 hover:text-rose-400 text-xs font-medium ml-auto transition-colors"
            >
              Reset Saved Progress
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Restart Story */}
      {showRestartConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-serif font-medium text-slate-100">
              Restart &ldquo;{story.title}&rdquo;?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-serif">
              You are currently partway through this story. Restarting will take you back
              to the starting scene. Your previously discovered endings will remain saved.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              >
                Restart Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Saved Progress */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0f172a] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-serif font-medium text-rose-200">
              Clear Progress for &ldquo;{story.title}&rdquo;?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-serif">
              This will remove all saved choices and discovered ending achievements
              for this story from your browser. Other stories will not be affected.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg text-sm bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                Erase Progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

