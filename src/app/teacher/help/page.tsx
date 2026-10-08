import { HelpVideos } from "@/components/help/HelpVideos";
import { HELP_VIDEOS } from "@/lib/help-videos";

export default function TeacherHelpPage() {
  return <HelpVideos videos={[HELP_VIDEOS.teacher]} />;
}
