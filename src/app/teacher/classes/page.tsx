import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MyClassesPage() {
  return (
    <>
      <PageHeader eyebrow="Teacher workspace" title="My classes" intro="Enter results for the classes assigned to you." />
      <EmptyState icon={GraduationCap} title="No classes assigned" description="Ask your school admin to assign you to a class." />
    </>
  );
}
