import { HelpVideos } from "@/components/help/HelpVideos";
import { HELP_VIDEOS } from "@/lib/help-videos";

export default function ParentHelpPage() {
  return <HelpVideos videos={[HELP_VIDEOS.parent]} />;
}
