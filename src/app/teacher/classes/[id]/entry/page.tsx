import { PageHeader } from "@/components/ui/PageHeader";

export default async function ResultEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageHeader
      eyebrow="Teacher workspace"
      title="Result entry"
      intro={`Manual entry or CSV import for class ${id}. Submissions go to your school admin for approval.`}
    />
  );
}
