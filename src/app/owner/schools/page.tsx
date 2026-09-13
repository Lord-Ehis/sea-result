import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SchoolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Schools"
        intro="Every school on SEA, their plan, and subscription status."
      />
      <EmptyState
        icon={Building2}
        title="No schools yet"
        description="Schools that sign up or are onboarded manually will appear here."
      />
    </>
  );
}
