import { HelpVideos } from "@/components/help/HelpVideos";
import { getAdminAccess } from "@/lib/admin-access";
import { HELP_VIDEOS } from "@/lib/help-videos";

export default async function AdminHelpPage() {
  const access = await getAdminAccess();
  // Templates are a school-wide setting, so a campus admin isn't shown how to build one.
  const videos = access.campusIds === null ? [HELP_VIDEOS.schoolAdmin, HELP_VIDEOS.resultTemplate] : [HELP_VIDEOS.schoolAdmin];
  return <HelpVideos videos={videos} />;
}
