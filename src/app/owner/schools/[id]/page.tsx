import { PageHeader } from "@/components/ui/PageHeader";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageHeader
      eyebrow="School detail"
      title={`School ${id}`}
      intro="Subscription, campuses, and deletion approval for this school."
    />
  );
}
