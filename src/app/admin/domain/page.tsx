import { Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CustomDomainPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Custom domain" intro="Point your own domain at your SEA result portal." />
      <EmptyState icon={Globe} title="No domain connected" description="Add a domain and verify DNS records to go live on your own URL." />
    </>
  );
}
