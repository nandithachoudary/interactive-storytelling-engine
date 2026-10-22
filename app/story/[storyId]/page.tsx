import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStoryById, getAllStoryIds } from '@/lib/stories';
import StoryDetailClient from '@/components/StoryDetailClient';

interface StoryDetailPageProps {
  params: Promise<{ storyId: string }>;
}

export function generateStaticParams() {
  return getAllStoryIds().map((storyId) => ({ storyId }));
}

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { storyId } = await params;
  const story = getStoryById(storyId);

  if (!story) {
    notFound();
  }

  const startScene = story.scenes.find((s) => s.id === story.startSceneId);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-amber-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            <span>←</span>
            <span>Back to Story Library</span>
          </Link>
          <span className="text-xs text-slate-500">
            {story.genre ?? 'Interactive Story'}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Story Header Hero */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {story.genre && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-300">
                {story.genre}
              </span>
            )}
            {story.estimatedReadingTime && (
              <span className="text-xs text-slate-400 border border-slate-800 bg-slate-900/80 px-3 py-1 rounded-full">
                ⏱️ {story.estimatedReadingTime}
              </span>
            )}
            <span className="text-xs text-slate-500 border border-slate-800 bg-slate-900/80 px-2.5 py-1 rounded-full">
              v{story.storyVersion}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif text-slate-100 font-normal leading-tight">
            {story.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-serif">
            Written by <strong className="text-slate-200 font-medium">{story.author}</strong>
          </p>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-serif pt-2">
            {story.description}
          </p>
        </div>

        {/* Story Metadata Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block mb-1">Total Scenes</span>
            <span className="text-base font-semibold text-slate-200">
              {story.scenes.length} Scenes
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-1">Possible Endings</span>
            <span className="text-base font-semibold text-amber-300">
              {story.scenes.filter((s) => s.ending).length} Outcomes
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-1">Starting Point</span>
            <span className="text-base font-medium text-slate-300 truncate block">
              {startScene?.title ?? 'Start'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-1">Engine Status</span>
            <span className="text-base font-semibold text-emerald-400">
              Validated Graph
            </span>
          </div>
        </div>

        {/* Interactive Progress & Reading Client Component */}
        <StoryDetailClient story={story} />
      </main>
    </div>
  );
}

