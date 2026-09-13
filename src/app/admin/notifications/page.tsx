import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotificationSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Notification settings" intro="Control SMS and email alerts sent to parents." />
      <EmptyState icon={Bell} title="No notification log yet" description="Notifications sent when results publish will be logged here." />
    </>
  );
}
