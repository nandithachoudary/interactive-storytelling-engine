import { notFound } from 'next/navigation';
import { getStoryById, getAllStoryIds } from '@/lib/stories';
import StoryPlayer from '@/components/StoryPlayer';

interface StoryPlayPageProps {
  params: Promise<{ storyId: string }>;
}

export function generateStaticParams() {
  return getAllStoryIds().map((storyId) => ({ storyId }));
}

export default async function StoryPlayPage({ params }: StoryPlayPageProps) {
  const { storyId } = await params;
  const story = getStoryById(storyId);

  if (!story) {
    notFound();
  }

  return <StoryPlayer story={story} />;
}

