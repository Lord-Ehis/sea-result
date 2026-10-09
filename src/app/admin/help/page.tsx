import { HelpVideos } from "@/components/help/HelpVideos";
import { getAdminAccess } from "@/lib/admin-access";
import { ADMIN_CHAPTERS, HELP_VIDEOS } from "@/lib/help-videos";

export default async function AdminHelpPage() {
  const access = await getAdminAccess();
  // Templates, billing and the other school-wide settings belong to the main school admin, so a campus admin
  // gets the first four chapters and no template guide, with a note saying why some steps don't apply.
  const everything = access.campusIds === null;
  const videos = everything ? [...ADMIN_CHAPTERS, HELP_VIDEOS.resultTemplate] : ADMIN_CHAPTERS.slice(0, 4);
  const note = everything
    ? undefined
    : "Some steps in these guides, such as the school profile, campuses, Team, templates and billing, are handled by your main school admin. You will not see them in your menu.";
  return <HelpVideos videos={videos} note={note} />;
}
