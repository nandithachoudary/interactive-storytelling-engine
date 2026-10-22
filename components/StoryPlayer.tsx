'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  type Story,
  type PlaythroughState,
  initPlaythrough,
  advancePlaythrough,
  getCurrentScene,
  getAvailableChoices,
  undoLastChoice,
  restartPlaythrough,
  replayChoices,
} from '@/engine';
import { localProgressStore } from '@/lib/local-progress-store';
import type { SavedProgress } from '@/lib/progress-store';

interface StoryPlayerProps {
  story: Story;
}

export default function StoryPlayer({ story }: StoryPlayerProps) {
  // 1. Core playthrough state managed via engine
  const [playthroughState, setPlaythroughState] = useState<PlaythroughState>(
    () => initPlaythrough(story).state
  );
  const [history, setHistory] = useState<string[]>([]);
  const [discoveredEndings, setDiscoveredEndings] = useState<string[]>([]);

  // 2. Feedback & Storage states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error' | 'idle'>('idle');
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  // 3. Confirmation Dialog states
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);

  const storyId = story.id ?? 'fog-island-mystery';

  // Helper to persist state snapshots to localStorage
  const persistState = (
    nextState: PlaythroughState,
    nextHistory: string[],
    nextEndings: string[]
  ) => {
    const snapshot: SavedProgress = {
      storyId,
      schemaVersion: story.schemaVersion,
      storyVersion: story.storyVersion,
      history: nextHistory,
      currentSceneId: nextState.currentSceneId,
      variables: nextState.variables,
      isCompleted: nextState.isCompleted,
      discoveredEndingId: nextState.discoveredEndingId,
      discoveredEndings: nextEndings,
      updatedAt: new Date().toISOString(),
    };

    const success = localProgressStore.save(storyId, snapshot);
    setSaveStatus(success ? 'saved' : 'error');
  };

  // 4. Client-side mount: Load saved progress from localStorage (hydration safe)
  useEffect(() => {
    setIsClientLoaded(true);

    if (!localProgressStore.isAvailable()) {
      setStorageNotice(
        'Note: Browser local storage is unavailable. Your progress will only last for this active session.'
      );
      return;
    }

    const saved = localProgressStore.load(storyId);
    if (!saved) {
      return;
    }

    // Validate story version compatibility
    if (saved.storyVersion !== story.storyVersion) {
      setStorageNotice(
        `A previous save from story version v${saved.storyVersion} could not be fully restored because the story was updated to v${story.storyVersion}. Starting fresh with your discovered endings preserved.`
      );
      setDiscoveredEndings(saved.discoveredEndings ?? []);
      return;
    }

    // Restore through engine replay API to guarantee state consistency
    const replay = replayChoices(story, saved.history, saved.discoveredEndings);

    if (replay.error) {
      setStorageNotice(
        'Your saved playthrough contained an outdated choice and was restored to the last valid moment.'
      );
    } else if (saved.history.length > 0) {
      const scene = getCurrentScene(story, replay.state);
      setStorageNotice(`Resumed saved playthrough at “${scene.title}”.`);
    }

    setPlaythroughState(replay.state);
    setHistory(replay.validHistory);
    setDiscoveredEndings(replay.discoveredEndings);
    setSaveStatus('saved');
  }, [storyId, story]);

  // Derive current scene and choices from engine functions
  const currentScene = getCurrentScene(story, playthroughState);
  const availableChoices = getAvailableChoices(story, playthroughState);
  const isCompleted = playthroughState.isCompleted || !!currentScene.ending;
  const currentEnding = currentScene.ending;

  // Total possible endings in this story
  const totalEndingsCount = story.scenes.filter((s) => s.ending).length;

  // Handle advancing when a choice is clicked
  const handleSelectChoice = (choiceId: string) => {
    try {
      setErrorMessage(null);
      setStorageNotice(null);
      const result = advancePlaythrough(
        story,
        playthroughState,
        choiceId,
        discoveredEndings
      );
      const newHistory = [...history, choiceId];

      setPlaythroughState(result.nextState);
      setHistory(newHistory);
      setDiscoveredEndings(result.discoveredEndings);

      // Persist after successful transition
      persistState(result.nextState, newHistory, result.discoveredEndings);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    }
  };

  // Handle undo using engine history API
  const handleUndo = () => {
    if (history.length === 0) return;
    setErrorMessage(null);
    setStorageNotice(null);

    const result = undoLastChoice(story, history, discoveredEndings);
    setPlaythroughState(result.state);
    setHistory(result.history);
    setDiscoveredEndings(result.discoveredEndings);

    // Persist rolled back state
    persistState(result.state, result.history, result.discoveredEndings);
  };

  // Request restart (prompts if current playthrough is unfinished)
  const handleRestartClick = () => {
    if (history.length > 0 && !isCompleted) {
      setShowRestartConfirm(true);
    } else {
      executeRestart();
    }
  };

  // Execute restart
  const executeRestart = () => {
    setShowRestartConfirm(false);
    setErrorMessage(null);
    setStorageNotice('Started a new playthrough. Discovered endings preserved.');

    const result = restartPlaythrough(story, discoveredEndings);
    setPlaythroughState(result.state);
    setHistory(result.history);
    setDiscoveredEndings(result.discoveredEndings);

    // Persist restarted state
    persistState(result.state, result.history, result.discoveredEndings);
  };

  // Execute reset of all progress (including discovered endings)
  const executeResetAll = () => {
    setShowResetAllConfirm(false);
    localProgressStore.clear(storyId);

    const init = initPlaythrough(story);
    setPlaythroughState(init.state);
    setHistory([]);
    setDiscoveredEndings([]);
    setErrorMessage(null);
    setStorageNotice('All local progress and discovered endings have been reset.');
    setSaveStatus('idle');
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200 relative">
      {/* Top Header / Status Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-slate-400 hover:text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800/60"
              aria-label="Return to story library"
            >
              <span>←</span>
              <span>Library</span>
            </Link>

            <span className="text-slate-700">|</span>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-widest uppercase text-amber-400/90 block">
                  Interactive Fiction
                </span>
                {isClientLoaded && saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Saved locally
                  </span>
                )}
                {isClientLoaded && saveStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-400/90 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Storage unavailable
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-serif font-medium text-slate-100">
                {story.title}
              </h1>
            </div>
          </div>

          {/* Action buttons: Undo & Restart */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              aria-label="Undo last choice"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all duration-150 ${
                history.length === 0
                  ? 'border-slate-800 text-slate-600 cursor-not-allowed bg-slate-900/40'
                  : 'border-slate-700/80 text-slate-300 hover:text-amber-200 hover:border-amber-400/50 hover:bg-slate-800/60 bg-slate-900/80 shadow-sm'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 10h10a5 5 0 0 1 5 5v2m-15-7l4-4m-4 4l4 4"
                />
              </svg>
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleRestartClick}
              aria-label="Restart story"
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 text-slate-300 hover:text-amber-200 hover:border-amber-400/50 hover:bg-slate-800/60 bg-slate-900/80 transition-all duration-150 flex items-center gap-1.5 shadow-sm"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Restart</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Play Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Storage feedback notice */}
          {storageNotice && (
            <div
              role="status"
              className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-2">
                <span>📖</span>
                <span>{storageNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setStorageNotice(null)}
                className="text-amber-400 hover:text-amber-200 text-sm font-bold px-1"
                aria-label="Dismiss notice"
              >
                &times;
              </button>
            </div>
          )}

          {/* Error notice if transition failed */}
          {errorMessage && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-200 text-sm flex items-start gap-3"
            >
              <span className="text-rose-400 mt-0.5">⚠️</span>
              <div>
                <p className="font-medium">Action Unavailable</p>
                <p className="text-rose-300/90 text-xs mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Variables & State Bar */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {Object.entries(playthroughState.variables).map(([key, val]) => {
              const formattedName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase());

              const isBool = typeof val === 'boolean';
              const isNum = typeof val === 'number';

              let displayValue = String(val);
              let colorClass = 'text-slate-300';

              if (isBool) {
                displayValue = val ? 'Acquired' : 'None';
                colorClass = val ? 'text-emerald-400 font-semibold' : 'text-slate-400';
              } else if (isNum) {
                colorClass = 'text-amber-200 font-semibold';
              }

              return (
                <div
                  key={key}
                  className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5"
                >
                  <span className="text-amber-400/80">◈</span>
                  <span>
                    {formattedName}:{' '}
                    <strong className={colorClass}>{displayValue}</strong>
                  </span>
                </div>
              );
            })}

            {totalEndingsCount > 0 && (
              <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5 ml-auto">
                <span className="text-amber-400">🏆</span>
                <span>
                  Endings Found:{' '}
                  <strong className="text-amber-200 font-semibold">
                    {discoveredEndings.length} / {totalEndingsCount}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Narrative Content Card */}
          <article className="p-6 sm:p-10 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-2xl backdrop-blur-sm relative overflow-hidden">
            {/* Ambient accent glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Scene Header */}
            <header className="mb-6 pb-4 border-b border-slate-800/80">
              <h2 className="text-2xl sm:text-3xl font-serif text-amber-100/95 tracking-wide leading-tight">
                {currentScene.title}
              </h2>
            </header>

            {/* Narrative text */}
            <div className="font-serif text-slate-200 text-lg sm:text-xl leading-relaxed sm:leading-loose whitespace-pre-line space-y-4">
              <p>{currentScene.content}</p>
            </div>
          </article>

          {/* Ending Screen Component (if reached) */}
          {isCompleted && currentEnding && (
            <section
              aria-label="Story ending reached"
              className={`p-6 sm:p-8 rounded-2xl border shadow-xl ${
                currentEnding.type === 'good'
                  ? 'border-emerald-500/40 bg-emerald-950/30'
                  : currentEnding.type === 'bad'
                  ? 'border-rose-500/40 bg-rose-950/30'
                  : 'border-amber-500/40 bg-amber-950/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                    currentEnding.type === 'good'
                      ? 'border-emerald-400/50 bg-emerald-900/60 text-emerald-300'
                      : currentEnding.type === 'bad'
                      ? 'border-rose-400/50 bg-rose-900/60 text-rose-300'
                      : 'border-amber-400/50 bg-amber-900/60 text-amber-300'
                  }`}
                >
                  {currentEnding.type === 'good'
                    ? '★ Case Solved'
                    : currentEnding.type === 'bad'
                    ? '✖ Tragic Conclusion'
                    : '◆ Story Resolved'}
                </span>
                <span className="text-xs text-slate-400">Story Concluded</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-serif font-medium text-slate-100 mb-2">
                {currentEnding.title}
              </h3>

              {currentEnding.description && (
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-serif">
                  {currentEnding.description}
                </p>
              )}

              <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={executeRestart}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/10 flex items-center gap-2"
                >
                  <span>Play Again (Restart)</span>
                  <span>↺</span>
                </button>

                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-5 py-2.5 rounded-xl font-medium text-sm border border-slate-700 bg-slate-900/80 text-slate-200 hover:text-amber-200 hover:border-slate-500 transition-colors flex items-center gap-2"
                  >
                    <span>Undo Last Choice</span>
                    <span>↶</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Interactive Choices Section */}
          {!isCompleted && (
            <section aria-label="Available choices" className="space-y-3 pt-2">
              <div className="flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">
                  What will you do?
                </h3>
              </div>

              <div className="grid gap-3">
                {availableChoices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleSelectChoice(choice.id)}
                    className="group w-full text-left p-4 sm:p-5 rounded-xl border border-slate-800 bg-[#0f172a]/60 hover:bg-slate-800/80 hover:border-amber-400/60 transition-all duration-200 shadow-md hover:shadow-amber-500/5 flex items-start gap-3.5"
                  >
                    <span className="text-amber-400/70 group-hover:text-amber-300 text-base sm:text-lg transition-transform duration-200 group-hover:translate-x-0.5 mt-0.5">
                      ✦
                    </span>
                    <span className="text-base sm:text-lg text-slate-100 group-hover:text-amber-100 font-serif leading-snug">
                      {choice.text}
                    </span>
                  </button>
                ))}

                {availableChoices.length === 0 && (
                  <p className="text-slate-400 text-sm italic py-4">
                    No further choices are available from this scene.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer with Reset Progress Action */}
        <footer className="mt-14 pt-6 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            {story.title} &bull; Author: {story.author} &bull; v{story.storyVersion}
          </p>

          <button
            type="button"
            onClick={() => setShowResetAllConfirm(true)}
            className="text-slate-500 hover:text-rose-400 transition-colors underline underline-offset-2"
          >
            Reset All Saved Progress
          </button>
        </footer>
      </main>

      {/* Confirmation Modal: Restart unfinished playthrough */}
      {showRestartConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-serif font-medium text-slate-100">
              Restart Current Playthrough?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              You are currently in the middle of a story. Restarting will return
              you to the Foggy Pier at the beginning. Your discovered endings will
              remain saved.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Continue Playing
              </button>
              <button
                type="button"
                onClick={executeRestart}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium"
              >
                Restart Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset all progress & discovered endings */}
      {showResetAllConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0f172a] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-serif font-medium text-rose-200">
              Erase All Saved Data?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              This will completely delete your saved story position, clues,
              inventory, and all discovered ending achievements from this browser.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetAllConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetAll}
                className="px-4 py-2 rounded-lg text-sm bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                Erase Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
