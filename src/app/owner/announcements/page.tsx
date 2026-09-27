import { PageHeader } from "@/components/ui/PageHeader";
import { listAnnouncements } from "./actions";
import { AnnouncementsClient } from "./AnnouncementsClient";

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <>
      <PageHeader
        eyebrow="Platform owner"
        title="Announcements"
        intro="Post a sticky banner every school, teacher and parent sees at the top of the app — updates, maintenance windows, anything platform-wide."
      />
      <AnnouncementsClient initialAnnouncements={announcements} />
    </>
  );
}
