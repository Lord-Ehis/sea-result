import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewClient } from "./ReviewClient";
import { getBatchAnnualReview } from "./actions";
import type { TemplateField } from "@/app/admin/result-templates/actions";

export default async function ReviewBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const batch = await prisma.resultBatch.findFirst({
    where: { id: batchId, schoolId },
    include: { class: true, template: true },
  });

  const reviewable = batch && (batch.status === "SUBMITTED" || batch.status === "APPROVED");
  const results = reviewable
    ? await prisma.result.findMany({
        where: { batchId: batch.id, schoolId },
        include: { student: true },
        orderBy: { student: { firstName: "asc" } },
      })
    : [];

  if (!batch || !reviewable || results.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Results / Review batch" title="Review results" intro="This batch has nothing pending review." />
        <EmptyState icon={FileCheck} title="Nothing to review" description="This batch may already have been published or sent back." />
      </>
    );
  }

  const [annual, classes] = await Promise.all([
    getBatchAnnualReview(batch.id),
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const submitter = batch.submittedByUserId
    ? await prisma.user.findUnique({ where: { id: batch.submittedByUserId }, select: { name: true } })
    : null;

  return (
    <ReviewClient
      batchId={batch.id}
      status={batch.status as "SUBMITTED" | "APPROVED"}
      className={batch.class.name}
      term={batch.term}
      teacherName={submitter?.name ?? "—"}
      submittedAt={batch.submittedAt?.toISOString() ?? null}
      fields={Array.isArray(batch.template.fields) ? (batch.template.fields as unknown as TemplateField[]) : []}
      annual={annual}
      classes={classes}
      students={results.map((r) => ({
        resultId: r.id,
        name: `${r.student.firstName} ${r.student.lastName}`,
        studentCode: r.student.studentCode,
        data: (r.data as Record<string, string>) ?? {},
      }))}
    />
  );
}
