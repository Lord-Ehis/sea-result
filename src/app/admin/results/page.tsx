import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ResultsPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Results awaiting approval" intro="Review submitted results before they're published." />
      <EmptyState icon={FileCheck} title="Nothing to review" description="Results submitted by teachers will appear here for approval." />
    </>
  );
}
