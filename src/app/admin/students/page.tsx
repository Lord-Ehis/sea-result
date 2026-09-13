import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function StudentsPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Students & campuses" intro="Manage enrolment across every campus." />
      <EmptyState icon={Users} title="No students yet" description="Add campuses and enrol students, or import them in bulk." />
    </>
  );
}
