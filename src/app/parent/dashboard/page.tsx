import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ParentDashboardPage() {
  return (
    <>
      <PageHeader eyebrow="Parent workspace" title="Your children" intro="View results for every child linked to your account." />
      <EmptyState icon={LayoutGrid} title="No children linked yet" description="Link a child using their student code to see their results." />
    </>
  );
}
