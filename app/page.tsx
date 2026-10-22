import StoryLibrary from "@/components/StoryLibrary";
import { getAllStories } from "@/lib/stories";

export default function Home() {
  const stories = getAllStories();
  return <StoryLibrary stories={stories} />;
}
