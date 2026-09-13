import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TeachersPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Teacher management" intro="Invite teachers and assign them to classes." />
      <EmptyState icon={UserCog} title="No teachers yet" description="Invite a teacher and assign them to their classes." />
    </>
  );
}
