import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewClient } from "./ReviewClient";
import type { TemplateField } from "@/app/admin/result-templates/actions";

export default async function ReviewBatchPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const template = await prisma.resultTemplate.findFirst({
    where: { id: templateId, schoolId },
    include: { class: true },
  });

  const results = template
    ? await prisma.result.findMany({
        where: { templateId, schoolId, status: "SUBMITTED" },
        include: { student: true, submittedBy: true },
        orderBy: { student: { firstName: "asc" } },
      })
    : [];

  if (!template || results.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Results / Review batch" title="Review results" intro="This batch has nothing pending review." />
        <EmptyState icon={FileCheck} title="Nothing to review" description="This batch may already have been published or sent back." />
      </>
    );
  }

  return (
    <ReviewClient
      templateId={template.id}
      className={template.class?.name ?? "All classes"}
      term={template.term ?? ""}
      teacherName={results[0]?.submittedBy?.name ?? "—"}
      submittedAt={results[0]?.submittedAt?.toISOString() ?? null}
      fields={Array.isArray(template.fields) ? (template.fields as unknown as TemplateField[]) : []}
      students={results.map((r) => ({
        resultId: r.id,
        name: `${r.student.firstName} ${r.student.lastName}`,
        studentCode: r.student.studentCode,
        data: (r.data as Record<string, string>) ?? {},
      }))}
    />
  );
}
