import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Analytics & reports" intro="Adoption and revenue across all schools." />
      <EmptyState icon={BarChart3} title="No data yet" description="Analytics will populate once schools start subscribing." />
    </>
  );
}
