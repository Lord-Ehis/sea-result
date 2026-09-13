import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ResultTemplatesPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Result templates" intro="Configure the report format used for each class." />
      <EmptyState icon={FileText} title="No templates yet" description="Create a result template to start entering results for a class." />
    </>
  );
}
