import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DeletionRequestPage() {
  return (
    <>
      <PageHeader
        eyebrow="School workspace"
        title="Request account deletion"
        intro="Deletion requires Platform Owner approval — this can't be undone once approved."
      />
      <EmptyState icon={Trash2} title="No deletion requested" description="Submitting a request will notify the Platform Owner for manual approval." />
    </>
  );
}
